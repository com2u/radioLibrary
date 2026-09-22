"""
Library Service – Scannt und cached die MP3-Bibliothek.

Verantwortlichkeit:
  - Dateisystem nach MP3s durchsuchen
  - ID3-Metadaten auslesen
  - In-Memory Cache verwalten
  - Daten-Persistenz (Favoriten, Ratings) laden/speichern

Wichtige Pfade:
  MUSIC_DIR = /mnt/radio/music
  DATA_FILE = backend/data.json
"""
import json
import logging
import os
import subprocess
import struct
from pathlib import Path

from mutagen.mp3 import MP3
from mutagen.id3 import ID3, ID3NoHeaderError

from utils.id3_helpers import get_id3_text, get_comment, get_rating

logger = logging.getLogger(__name__)

MUSIC_DIR = Path(os.environ.get("RADIO_DIR", "/mnt/radio")) / "music"
DATA_FILE = Path(__file__).parent.parent / "data.json"
CACHE_FILE = Path(__file__).parent.parent / "library_cache.json"

PEAKS_NUM = 800  # Anzahl Peaks pro Song für Waveform


def compute_peaks(filepath: Path) -> list | None:
    """Berechnet Waveform-Peaks via ffmpeg → numpy."""
    try:
        proc = subprocess.run(
            ['ffmpeg', '-i', str(filepath), '-f', 's16le', '-ac', '1', '-ar', '22050',
             '-loglevel', 'error', '-'],
            capture_output=True, timeout=30
        )
        if not proc.stdout or proc.returncode != 0:
            return None

        import numpy as np
        samples = np.frombuffer(proc.stdout, dtype=np.int16)
        count = len(samples)
        chunk = max(1, count // PEAKS_NUM)

        if count >= PEAKS_NUM:
            trimmed = samples[:chunk * PEAKS_NUM]
            peaks = np.abs(trimmed.reshape(-1, chunk)).max(axis=1) / 32768.0
        else:
            peaks = np.abs(samples) / 32768.0

        return [round(float(p), 4) for p in peaks.tolist()]
    except Exception as e:
        logger.debug("Peaks-Fehler für '%s': %s", filepath.name, e)
        return None

# In-Memory Cache: None bedeutet "noch nicht geladen"
_library_cache: list | None = None
_scanning: bool = False


def load_data() -> dict:
    """
    Lädt Favoriten und Ratings aus der JSON-Persistenzdatei.

    Output: dict mit Keys 'favorites' (list[str]) und 'ratings' (dict[str, float])
    """
    if DATA_FILE.exists():
        try:
            with open(DATA_FILE) as f:
                data = json.load(f)
                logger.debug("data.json geladen: %d Favoriten, %d Ratings",
                             len(data.get("favorites", [])),
                             len(data.get("ratings", {})))
                return data
        except Exception as e:
            logger.error("Fehler beim Lesen von data.json: %s", e)
    return {"favorites": [], "ratings": {}}


def save_data(data: dict) -> None:
    """
    Speichert Favoriten und Ratings in die JSON-Persistenzdatei.

    Input: dict mit Keys 'favorites' und 'ratings'
    """
    try:
        with open(DATA_FILE, "w") as f:
            json.dump(data, f)
        logger.debug("data.json gespeichert")
    except Exception as e:
        logger.error("Fehler beim Schreiben von data.json: %s", e)


def scan_file(filepath: Path, data: dict) -> dict:
    """
    Scannt eine einzelne MP3-Datei und gibt deren Metadaten zurück.

    Input:
        filepath – Absoluter Pfad zur MP3-Datei
        data     – Aktueller Daten-Store (Favoriten, Ratings)
    Output:
        dict – Song-Metadaten inkl. ID3-Tags und Dateisystem-Info
    """
    rel_path = str(filepath.relative_to(MUSIC_DIR))
    file_id = rel_path.replace("/", "|")

    # Audio-Dauer auslesen
    try:
        audio = MP3(filepath)
        duration = audio.info.length
    except Exception as e:
        logger.debug("Audio-Info für '%s' nicht lesbar: %s", filepath.name, e)
        duration = 0

    # ID3-Tags auslesen
    try:
        tag = ID3(filepath)
        title = get_id3_text(tag, "TIT2") or filepath.stem
        artist = get_id3_text(tag, "TPE1")
        album = get_id3_text(tag, "TALB")
        year = get_id3_text(tag, "TDRC")
        genre = get_id3_text(tag, "TCON")
        comment = get_comment(tag)
        track = get_id3_text(tag, "TRCK")
        rating_raw = get_rating(tag)
        # POPM-Skala 0–255 auf 0–10 umrechnen
        community_rating = round(rating_raw / 25.5, 1) if rating_raw > 0 else 0
    except ID3NoHeaderError:
        logger.debug("Keine ID3-Tags in '%s'", filepath.name)
        title = filepath.stem
        artist = album = year = genre = comment = track = ""
        community_rating = 0
    except Exception as e:
        logger.warning("ID3-Fehler bei '%s': %s", filepath.name, e)
        title = filepath.stem
        artist = album = year = genre = comment = track = ""
        community_rating = 0

    # Gespeichertes Rating hat Vorrang vor ID3-Rating
    if file_id in data.get("ratings", {}):
        community_rating = data["ratings"][file_id]

    # Dateisystem-Zeitstempel
    try:
        stat = filepath.stat()
        created = stat.st_ctime
        modified = stat.st_mtime
    except Exception:
        created = modified = 0

    song = {
        "id": file_id,
        "path": str(filepath),
        "rel_path": rel_path,
        "filename": filepath.name,
        "title": title,
        "artist": artist,
        "album": album,
        "year": str(year),
        "genre": genre,
        "comment": comment,
        "track": track,
        "duration": round(duration, 2),
        "community_rating": community_rating,
        "favorite": file_id in data.get("favorites", []),
        "created": created,
        "modified": modified,
    }
    return song


def scan_library() -> list:
    """
    Scannt alle MP3-Dateien im MUSIC_DIR rekursiv.

    Output: list[dict] – Alle Songs mit Metadaten
    """
    global _scanning
    _scanning = True
    logger.info("Starte Library-Scan in '%s'", MUSIC_DIR)
    data = load_data()
    songs = []
    for filepath in sorted(MUSIC_DIR.rglob("*.mp3")):
        try:
            song = scan_file(filepath, data)
            songs.append(song)
        except Exception as e:
            logger.error("Fehler beim Scannen von '%s': %s", filepath, e)
    logger.info("Library-Scan abgeschlossen: %d Songs gefunden", len(songs))
    _scanning = False

    # Persistiere Cache auf Disk für schnelle Neustarts
    _save_cache(songs)

    return songs


def _cache_is_stale(songs: list) -> bool:
    """
    Prüft ob ein geladener Disk-Cache unbrauchbare Daten enthält.

    Hintergrund: Ältere Cache-Versionen wurden geschrieben, bevor das Feld
    'duration' korrekt befüllt wurde. Solche Caches enthalten bei JEDEM Song
    duration=0 – die Songliste zeigt dann überall "0:00". Ein solcher Cache
    darf nicht einfach verwendet werden.

    Input:  songs – aus dem Cache geladene Liste
    Output: True wenn der Cache als defekt gilt und neu gescannt werden muss
    """
    if not songs:
        return False
    # duration-Feld fehlt komplett -> alte Cache-Struktur
    if "duration" not in songs[0]:
        logger.warning("Cache ohne 'duration'-Feld erkannt – veraltet")
        return True
    # Wenn praktisch alle Songs duration=0 haben, ist der Cache defekt.
    # (Einzelne 0-Werte sind legitime Sonderfälle und werden separat
    #  von repair_missing_durations() korrigiert.)
    zero = sum(1 for s in songs if not s.get("duration"))
    ratio = zero / len(songs)
    if ratio > 0.5:
        logger.warning(
            "Cache defekt: %d/%d Songs ohne Dauer (%.0f%%) – wird neu aufgebaut",
            zero, len(songs), ratio * 100
        )
        return True
    return False


_duration_repair_running = False


def _schedule_duration_repair() -> None:
    """
    Startet die Dauer-Reparatur für den gesamten Cache in einem
    Hintergrund-Thread.

    Grund: Bei über 40.000 Songs dauert das Nachlesen der Dauern viele
    Minuten. Würde das beim Start synchron laufen, wäre die API so lange
    blockiert. So bleibt die Library sofort bedienbar und die Dauern
    erscheinen nach und nach.
    """
    global _duration_repair_running
    if _duration_repair_running:
        return
    _duration_repair_running = True

    import threading

    def worker():
        global _duration_repair_running
        try:
            logger.info("Hintergrund-Reparatur der Dauern gestartet")
            songs = _library_cache or []
            total = sum(1 for s in songs if not s.get("duration"))
            logger.info("Zu prüfen: %d Songs", total)
            fixed = 0
            for song in songs:
                if song.get("duration"):
                    continue
                try:
                    audio = MP3(song["path"])
                    d = round(audio.info.length, 2)
                    if d > 0:
                        song["duration"] = d
                        fixed += 1
                except Exception:
                    pass
                # Zwischenspeichern, damit Fortschritt erhalten bleibt.
                # Intervall absichtlich gross: das Schreiben des ~23 MB
                # Caches ist der teure Teil (Festplatte), das reine Lesen
                # der MP3-Dauern ist dagegen schnell.
                if fixed > 0 and fixed % 10000 == 0:
                    logger.info("Dauer-Reparatur: %d/%d korrigiert", fixed, total)
                    _save_cache(songs)
            _save_cache(songs)
            logger.info("Hintergrund-Reparatur abgeschlossen: %d Dauern korrigiert", fixed)
        except Exception as e:
            logger.error("Hintergrund-Reparatur fehlgeschlagen: %s", e)
        finally:
            _duration_repair_running = False

    threading.Thread(target=worker, daemon=True).start()


def repair_missing_durations(songs: list, max_items: int = 2000) -> int:
    """
    Ergänzt fehlende Dauer-Werte (duration=0) direkt aus den MP3-Dateien.

    Wird nach dem Laden aus dem Cache ausgeführt, damit die Songliste nie
    "0:00" anzeigt, nur weil ein alter Cache-Eintrag keine Dauer hatte.
    Liest ausschliesslich die Dateien nach, bei denen die Dauer fehlt.

    Input:
        songs     – Liste der Songs (wird IN-PLACE korrigiert)
        max_items – Maximale Anzahl Korrekturen pro Lauf (Laufzeit-Bremse)
    Output: int – Anzahl korrigierter Songs
    """
    missing = [s for s in songs if not s.get("duration")]
    if not missing:
        return 0

    logger.info("Repariere fehlende Dauern für %d Songs (Maximum: %d)",
                len(missing), max_items)
    fixed = 0
    for song in missing[:max_items]:
        try:
            audio = MP3(song["path"])
            duration = round(audio.info.length, 2)
            if duration > 0:
                song["duration"] = duration
                fixed += 1
        except Exception as e:
            logger.debug("Dauer nicht lesbar für '%s': %s", song.get("path"), e)

    if fixed:
        logger.info("Dauer-Reparatur: %d Songs korrigiert", fixed)
        _save_cache(songs)
    return fixed


def _save_cache(songs: list) -> None:
    """Speichert die Library als Disk-Cache (für schnelle Neustarts)."""
    try:
        with open(CACHE_FILE, "w") as f:
            json.dump(songs, f)
        logger.info("Library-Cache gespeichert: %s (%.1f MB)", CACHE_FILE,
                    CACHE_FILE.stat().st_size / 1024 / 1024)
    except Exception as e:
        logger.warning("Konnte Library-Cache nicht speichern: %s", e)


def save_cache(songs: list) -> None:
    """Öffentlicher Wrapper um _save_cache — für externe Aufrufer (z.B. Cleanup)."""
    _save_cache(songs)


def get_library() -> list:
    """
    Gibt die gecachte Library zurück. Lädt von Disk-Cache oder scannt.

    Validiert den Disk-Cache: Enthält er bei fast allen Songs duration=0,
    wird er verworfen und neu gescannt. Danach werden einzelne fehlende
    Dauern gezielt nachgelesen, damit die Anzeige nie "0:00" zeigt.

    Output: list[dict] – Alle Songs (aus Cache oder frisch gescannt)
    """
    global _library_cache, _scanning
    if _library_cache is not None:
        logger.debug("Library-Cache verwendet: %d Songs", len(_library_cache))
        return _library_cache

    if _scanning:
        logger.info("Library-Scan läuft bereits, warte...")
        return []

    # Versuche vom Disk-Cache zu laden
    if CACHE_FILE.exists():
        try:
            with open(CACHE_FILE) as f:
                _library_cache = json.load(f)
            logger.info("Library-Cache von Disk geladen: %d Songs (%.1f MB)",
                        len(_library_cache), CACHE_FILE.stat().st_size / 1024 / 1024)

            # Cache auf unbrauchbare Dauer-Werte prüfen
            if _cache_is_stale(_library_cache):
                logger.warning(
                    "Cache hat keine Dauer-Werte – starte Reparatur im Hintergrund. "
                    "Die Library ist sofort verfügbar, die Dauern werden nachgeladen."
                )
                # NICHT blockierend neu scannen! Bei über 40.000 Songs dauert
                # ein Voll-Scan viele Minuten und würde die API blockieren.
                # Stattdessen: Cache behalten, Dauern im Hintergrund ergänzen.
                _schedule_duration_repair()

            # Einzelne fehlende Dauern gezielt nachlesen (schnell, begrenzt)
            repair_missing_durations(_library_cache, max_items=300)
            return _library_cache
        except Exception as e:
            logger.warning("Konnte Library-Cache nicht laden: %s", e)
            _library_cache = None

    logger.info("Library-Cache leer, lade neu...")
    _library_cache = scan_library()
    return _library_cache


def invalidate_cache() -> None:
    """Invalidiert den Library-Cache. Nächster get_library()-Aufruf scannt neu."""
    global _library_cache
    _library_cache = None
    # Auch den Disk-Cache löschen, sonst lädt get_library() beim
    # nächsten Aufruf den alten Disk-Cache statt neu zu scannen.
    if CACHE_FILE.exists():
        CACHE_FILE.unlink()
        logger.info("Disk-Cache gelöscht: %s", CACHE_FILE)
    logger.info("Library-Cache invalidiert")


def find_song(song_id: str) -> dict | None:
    """
    Sucht einen Song nach ID in der Library.

    Input:  song_id – Song-ID (rel_path mit | statt /)
    Output: dict oder None
    """
    songs = get_library()
    for s in songs:
        if s["id"] == song_id:
            return s
    logger.debug("Song nicht gefunden: '%s'", song_id)
    return None

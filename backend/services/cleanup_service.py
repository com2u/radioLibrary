"""
Cleanup Service – Aufräumen der Musikbibliothek.

Bietet drei Aufräum-Regeln, jeweils erst als Vorschau (Dry-Run) und dann
zum tatsächlichen Löschen:

  1) invalid_title – Songs ohne gültigen Titel.
     Ein gültiger Titel folgt dem Muster "Artist - Title". Dateien wie
     "(1).mp3" oder "(1) (4613).mp3" haben keinen Künstler und keinen
     Titel und sind Aufnahme-Abfall.

  2) unwatched – Songs ohne jede Wertung.
     Weder als Favorit markiert (Herz), noch mit Rating (Sterne),
     noch mit Kommentar versehen.

  3) duplicates – Mehrfach vorhandene Songs.
     "Artist - Title (1).mp3", "... (2).mp3" usw. sind dieselbe Aufnahme.
     Es bleibt die Variante (1) – oder falls es keine (1) gibt,
     die mit der niedrigsten Nummer.

Sicherheit:
  - Jede Regel liefert zuerst eine Vorschau (analyze_*), nichts wird gelöscht.
  - Dateien mit Favorit/Rating/Kommentar werden bei den Regeln 1 und 3
    NICHT gelöscht, sondern übersprungen (Schutz vor Datenverlust).
  - Gelöscht wird ausschliesslich innerhalb von /mnt/radio/music.
"""

import logging
import re
from collections import defaultdict
from pathlib import Path

from services.library import (
    get_library, load_data, save_data, invalidate_cache, save_cache, MUSIC_DIR
)

logger = logging.getLogger(__name__)

# "Artist - Title (3).mp3"  ->  Basis "Artist - Title", Nummer 3
DUP_PATTERN = re.compile(r"^(?P<base>.+?) \((?P<num>\d+)\)\.mp3$")

# Dateiname gilt als gültiger Titel wenn Artist und Title gesetzt sind
# und nicht nur aus Klammern/Zahlen bestehen (z.B. "(1) (4613)").
# Absichtlich kurz: "U2 - OK" ist ein echter Song, kein Müll.
MIN_TITLE_LEN = 1


def _has_value(song: dict, data: dict) -> bool:
    """
    Prüft ob ein Song irgendeine Wertung durch den Nutzer hat.

    Input:
        song – Song-Dict
        data – Persistenz-Daten (favorites, ratings)
    Output: True wenn Herz, Sterne oder Kommentar gesetzt sind
    """
    song_id = song["id"]
    if song_id in data.get("favorites", []):
        return True
    if data.get("ratings", {}).get(song_id):
        return True
    if song.get("community_rating"):
        return True
    if (song.get("comment") or "").strip():
        return True
    return False


def _is_valid_title(song: dict) -> bool:
    """
    Prüft ob ein Song einen gültigen Titel hat.

    Entscheidend ist der ID3-Inhalt, NICHT der Dateiname:
    streamripper ersetzt beim Aufnehmen gelegentlich " - " durch " ' "
    (aus "10CC - Dreadlock Holiday" wird "10CC ' Dreadlock Holiday").
    Solche Dateien sind inhaltlich völlig in Ordnung und dürfen nicht
    als Müll aussortiert werden.

    Ungültig ist ein Song nur, wenn Artist oder Title fehlen – bzw. wenn
    der Name ein reiner Platzhalter ist wie "(1).mp3" oder "(1) (4613).mp3".

    Input:  song – Song-Dict
    Output: bool
    """
    artist = (song.get("artist") or "").strip()
    title = (song.get("title") or "").strip()

    # Beides vorhanden und lang genug -> gültig
    if len(artist) >= MIN_TITLE_LEN and len(title) >= MIN_TITLE_LEN:
        # Titel darf nicht nur aus Zahlen/Klammern bestehen
        if re.search(r"[A-Za-z0-9ÄÖÜäöüß]", title):
            return True

    # Keine ID3-Tags: dann den Dateinamen als letzte Instanz prüfen.
    # Dabei auch das Hochkomma-Trennzeichen von streamripper akzeptieren.
    filename = song.get("filename") or ""
    stem = filename[:-4] if filename.lower().endswith(".mp3") else filename

    for sep in (" - ", " ' "):
        if sep in stem:
            a, _, t = stem.partition(sep)
            a, t = a.strip(), t.strip()
            if len(a) >= MIN_TITLE_LEN and len(t) >= MIN_TITLE_LEN:
                if re.search(r"[A-Za-z0-9ÄÖÜäöüß]", t):
                    return True

    return False


def _safe_path(song: dict) -> Path | None:
    """
    Stellt sicher dass eine Datei wirklich im Musikverzeichnis liegt.
    Verhindert versehentliches Löschen ausserhalb der Bibliothek.

    Input:  song – Song-Dict
    Output: Path oder None wenn ausserhalb des Musikverzeichnisses
    """
    try:
        path = Path(song["path"]).resolve()
        music_root = MUSIC_DIR.resolve()
        if music_root not in path.parents and path.parent != music_root:
            logger.warning("Pfad ausserhalb der Bibliothek, wird übersprungen: %s", path)
            return None
        return path
    except Exception as e:
        logger.warning("Pfad nicht prüfbar '%s': %s", song.get("path"), e)
        return None


def _filter_station(songs: list, station: str | None) -> list:
    """
    Filtert die Songliste auf eine Station.

    Achtung: Das ID3-Genre-Feld ist in dieser Bibliothek bei fast allen
    Dateien LEER – ein Filter darauf würde immer 0 Treffer liefern.
    Verlässlich ist stattdessen der Ordnername unter /mnt/radio/music/
    (erster Teil von rel_path), z.B. "Vintage Radio - Musik".
    Daher wird gegen beides geprüft: Ordner und Genre.

    Input:
        songs   – vollständige Liste
        station – Sendername oder None (kein Filter)
    Output: gefilterte Liste
    """
    if not station:
        return songs

    station_l = station.lower()
    result = [
        s for s in songs
        if (s["rel_path"].split("/")[0].lower() == station_l
            or s["rel_path"].split("/")[0].lower().replace(" - musik", "") == station_l
            or (s.get("genre") or "").lower() == station_l)
    ]
    logger.info("Stations-Filter '%s': %d von %d Songs",
                station, len(result), len(songs))
    return result


def analyze(station: str | None = None) -> dict:
    """
    Berechnet die Vorschau für alle drei Cleanup-Regeln.
    Löscht NICHTS.

    Input:
        station – Optionaler Sendername zur Einschränkung.
                  None = gesamte Bibliothek.
    Output: dict mit Vorschau pro Regel (Anzahl, Bytes, Beispiele)
    """
    songs = get_library()
    data = load_data()

    if station:
        songs = _filter_station(songs, station)

    # ── Regel 1: Kein gültiger Titel ───────────────────────────────
    invalid = []
    for song in songs:
        if _is_valid_title(song):
            continue
        # Schutz: bewertete Dateien nie löschen
        if _has_value(song, data):
            continue
        invalid.append(song)

    # ── Regel 3: Duplikate ────────────────────────────────────────
    # Dieselbe Funktion wie bei der Ausführung – so sind Vorschau und
    # tatsächliches Löschen garantiert deckungsgleich.
    duplicates = _collect_duplicates(songs, data)

    # ── Regel 2: Keine Wertung ────────────────────────────────────
    # Erst NACH Regel 1 und 3 berechnen, damit Dateien die ohnehin
    # gelöscht werden nicht doppelt gezählt werden.
    already_flagged = {s["id"] for s in invalid + duplicates}
    unvalued = [
        song for song in songs
        if song["id"] not in already_flagged and not _has_value(song, data)
    ]

    def summarize(items: list) -> dict:
        size = 0
        for s in items:
            try:
                size += Path(s["path"]).stat().st_size
            except Exception:
                pass
        return {
            "count": len(items),
            "bytes": size,
            "size_mb": round(size / 1024 / 1024, 1),
            "samples": [s["filename"] for s in items[:15]],
        }

    result = {
        "station": station or "Alle",
        "total_songs": len(songs),
        "invalid_title": summarize(invalid),
        "unvalued": summarize(unvalued),
        "duplicates": summarize(duplicates),
    }
    logger.info(
        "Cleanup-Vorschau: %d ungültige Titel, %d ohne Wertung, %d Duplikate",
        result["invalid_title"]["count"],
        result["unvalued"]["count"],
        result["duplicates"]["count"],
    )
    return result


def _id_set(songs: list) -> set:
    return {s["id"] for s in songs}


def _collect_duplicates(songs: list, data: dict) -> list:
    """
    Ermittelt die löschbaren Duplikate.

    Gruppiert nach (Verzeichnis, Basisname). Existieren nummerierte
    Varianten ("Title (1).mp3", "Title (2).mp3", …), gehört auch die
    Basis-Datei ohne Nummer ("Title.mp3") – falls vorhanden – zur selben
    Gruppe. Innerhalb einer Gruppe bleibt die Basis-Datei ohne Nummer,
    sonst die Variante (1), sonst die niedrigste Nummer. Alle übrigen
    Varianten sind löschbar.

    Zwei Schutzmechanismen:
      - Ist das zu behaltende Exemplar selbst Müll (kein gültiger Titel),
        wird die ganze Gruppe übersprungen – sie gehört zu Regel 1 und
        würde sonst doppelt gezählt.
      - Duplikate mit Favorit, Rating oder Kommentar bleiben verschont.

    Input:
        songs – zu prüfende Songs (bereits nach Station gefiltert)
        data  – Persistenz-Daten (favorites, ratings)
    Output: list[Song-Dicts] – löschbare Duplikate
    """
    groups: dict[tuple, list] = defaultdict(list)
    by_dir_name: dict[tuple, dict] = {}
    for song in songs:
        directory = song["rel_path"].rsplit("/", 1)[0] if "/" in song["rel_path"] else ""
        by_dir_name[(directory, song.get("filename") or "")] = song
        m = DUP_PATTERN.match(song.get("filename") or "")
        if not m:
            continue
        groups[(directory, m.group("base"))].append((int(m.group("num")), song))

    # Basis-Datei ohne Nummer einbeziehen: "Title.mp3" gehört zur selben
    # Gruppe wie "Title (1).mp3", "Title (2).mp3" usw. – aber nur, wenn
    # mindestens eine nummerierte Variante existiert (sonst gäbe es keine
    # Gruppe und die Basis-Datei ist einfach ein normaler Song).
    # Intern erhält die Basis-Datei die Pseudo-Nummer 0, damit sie in der
    # Sortierung immer vor (1) liegt und bevorzugt behalten wird.
    for (directory, base), entries in groups.items():
        base_song = by_dir_name.get((directory, f"{base}.mp3"))
        if base_song is not None and not any(s is base_song for _, s in entries):
            entries.append((0, base_song))

    to_delete = []
    for (_directory, _base), entries in groups.items():
        if len(entries) < 2:
            continue
        entries.sort(key=lambda e: e[0])

        # Zu behalten: Basis-Datei ohne Nummer (0), sonst (1),
        # sonst die niedrigste Nummer
        nums = [n for n, _ in entries]
        if 0 in nums:
            keep_num = 0
        elif 1 in nums:
            keep_num = 1
        else:
            keep_num = entries[0][0]

        # Müll-Gruppe -> von Regel 1 erfasst, hier überspringen
        keep = next(s for n, s in entries if n == keep_num)
        if not _is_valid_title(keep):
            continue

        for num, song in entries:
            if num == keep_num:
                continue
            if _has_value(song, data):
                continue
            to_delete.append(song)

    return to_delete


def _collect(station: str | None, rule: str) -> list:
    """
    Ermittelt die zu löschenden Songs für eine Regel.

    Input:
        station – Sendername oder None für alle
        rule    – 'invalid_title' | 'unvalued' | 'duplicates'
    Output: list[Song-Dicts]
    """
    songs = get_library()
    data = load_data()

    if station:
        songs = _filter_station(songs, station)

    if rule == "invalid_title":
        return [s for s in songs if not _is_valid_title(s) and not _has_value(s, data)]

    if rule == "unvalued":
        # Ohne Wertung, aber nicht schon von Regel 1 oder 3 erfasst –
        # exakt dieselbe Logik wie in analyze(), damit Vorschau und
        # Ausführung identische Zahlen liefern.
        invalid_ids = _id_set(
            [s for s in songs if not _is_valid_title(s) and not _has_value(s, data)]
        )
        dup_ids = _id_set(_collect_duplicates(songs, data))
        return [
            s for s in songs
            if s["id"] not in invalid_ids
            and s["id"] not in dup_ids
            and not _has_value(s, data)
        ]

    if rule == "duplicates":
        return _collect_duplicates(songs, data)

    raise ValueError(f"Unbekannte Cleanup-Regel: {rule}")


def execute(rules: list, station: str | None = None, limit: int | None = None) -> dict:
    """
    Löscht die Songs, die von den gewählten Regeln erfasst werden.

    Input:
        rules   – Liste mit 'invalid_title', 'unvalued' und/oder 'duplicates'
        station – Optionaler Sendername zur Einschränkung
        limit   – Maximale Anzahl Löschungen (Sicherheitsbremse)
    Output: dict mit deleted, failed, freed_bytes und Fehlerliste
    """
    if not rules:
        return {"deleted": 0, "failed": 0, "freed_bytes": 0, "errors": []}

    # Auswahl einsammeln (Duplikate über die Regeln hinweg vermeiden)
    selected: dict[str, dict] = {}
    for rule in rules:
        for song in _collect(station, rule):
            selected[song["id"]] = song

    targets = list(selected.values())
    if limit and limit > 0:
        targets = targets[:limit]

    logger.warning("Cleanup gestartet: %d Dateien, Regeln=%s, Station=%s",
                   len(targets), rules, station or "Alle")

    data = load_data()
    deleted = 0
    failed = 0
    freed = 0
    errors = []
    deleted_ids = set()

    for song in targets:
        path = _safe_path(song)
        if path is None:
            failed += 1
            continue
        try:
            size = path.stat().st_size if path.exists() else 0
            path.unlink(missing_ok=True)
            deleted += 1
            freed += size
            deleted_ids.add(song["id"])

            # Persistenz aufräumen
            song_id = song["id"]
            if song_id in data.get("favorites", []):
                data["favorites"].remove(song_id)
            if song_id in data.get("ratings", {}):
                del data["ratings"][song_id]
        except Exception as e:
            failed += 1
            errors.append({"file": song.get("filename"), "error": str(e)})
            logger.error("Cleanup: Löschen fehlgeschlagen '%s': %s", path, e)

    save_data(data)

    # Cache aktualisieren: gelöschte Songs aus dem In-Memory- und Disk-Cache entfernen
    if deleted_ids:
        current = get_library()
        if current:
            updated = [s for s in current if s["id"] not in deleted_ids]
            save_cache(updated)
            logger.info("Cache aktualisiert: %d Songs entfernt, %d verbleiben",
                        len(deleted_ids), len(updated))

    invalidate_cache()

    logger.warning("Cleanup beendet: %d gelöscht, %d fehlgeschlagen, %.1f MB frei",
                   deleted, failed, freed / 1024 / 1024)

    return {
        "deleted": deleted,
        "failed": failed,
        "freed_bytes": freed,
        "freed_mb": round(freed / 1024 / 1024, 1),
        "errors": errors[:20],
    }

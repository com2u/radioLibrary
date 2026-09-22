"""
Playlist Service – Verwaltet M3U8-Playlists.

Verantwortlichkeit:
  - M3U8-Dateien im Radio-Verzeichnis auflisten
  - Songs zu Playlists hinzufügen (Duplikat-Check)
"""
import logging
import os
from pathlib import Path

logger = logging.getLogger(__name__)

RADIO_DIR = Path(os.environ.get("RADIO_DIR", "/mnt/radio"))
MUSIC_DIR = RADIO_DIR / "music"


def create_playlist(playlist_name: str) -> dict:
    """
    Erstellt eine neue leere M3U8-Playlist.

    Input:  playlist_name – Name ohne .m3u8
    Output: { name, path }
    Raises: FileExistsError wenn bereits vorhanden
    """
    playlist_path = RADIO_DIR / f"{playlist_name}.m3u8"
    if playlist_path.exists():
        raise FileExistsError(f"Playlist '{playlist_name}' existiert bereits")
    playlist_path.write_text("#EXTM3U\n", encoding="utf-8")
    logger.info("Playlist erstellt: '%s'", playlist_name)
    return {"name": playlist_name, "path": str(playlist_path)}


def rename_playlist(old_name: str, new_name: str) -> dict:
    """
    Benennt eine Playlist um.

    Input:  old_name, new_name (ohne .m3u8)
    Output: { name, path }
    Raises: FileNotFoundError / FileExistsError
    """
    old_path = RADIO_DIR / f"{old_name}.m3u8"
    new_path = RADIO_DIR / f"{new_name}.m3u8"
    if not old_path.exists():
        raise FileNotFoundError(f"Playlist '{old_name}' nicht gefunden")
    if new_path.exists():
        raise FileExistsError(f"Playlist '{new_name}' existiert bereits")
    old_path.rename(new_path)
    logger.info("Playlist umbenannt: '%s' → '%s'", old_name, new_name)
    return {"name": new_name, "path": str(new_path)}


def delete_playlist(playlist_name: str) -> bool:
    """
    Löscht eine M3U8-Playlist.

    Input:  playlist_name – Name ohne .m3u8
    Output: True
    Raises: FileNotFoundError
    """
    playlist_path = RADIO_DIR / f"{playlist_name}.m3u8"
    if not playlist_path.exists():
        raise FileNotFoundError(f"Playlist '{playlist_name}' nicht gefunden")
    playlist_path.unlink()
    logger.info("Playlist gelöscht: '%s'", playlist_name)
    return True


def get_playlist_songs(playlist_name: str) -> list[str]:
    """
    Gibt alle Song-Pfade einer Playlist zurück.

    Input:  playlist_name
    Output: list[str] – relative Pfade der Songs
    """
    playlist_path = RADIO_DIR / f"{playlist_name}.m3u8"
    if not playlist_path.exists():
        raise FileNotFoundError(f"Playlist '{playlist_name}' nicht gefunden")
    lines = playlist_path.read_text(encoding="utf-8", errors="replace").splitlines()
    return [l.strip() for l in lines if l.strip() and not l.startswith("#")]


def remove_song_from_playlist(playlist_name: str, song_path: str) -> bool:
    """
    Entfernt einen Song aus einer Playlist.

    Input:  playlist_name, song_path (absolut oder relativ)
    Output: True wenn entfernt, False wenn nicht gefunden
    Raises: FileNotFoundError wenn Playlist nicht existiert
    """
    playlist_path = RADIO_DIR / f"{playlist_name}.m3u8"
    if not playlist_path.exists():
        raise FileNotFoundError(f"Playlist '{playlist_name}' nicht gefunden")

    song_path_obj = Path(song_path)
    if song_path_obj.is_absolute() and MUSIC_DIR in song_path_obj.parents:
        relative_path = str(song_path_obj.relative_to(MUSIC_DIR))
    else:
        relative_path = str(song_path_obj)

    lines = playlist_path.read_text(encoding="utf-8", errors="replace").splitlines(keepends=True)
    new_lines = [l for l in lines if l.strip() != relative_path]
    if len(new_lines) == len(lines):
        return False  # Nicht gefunden
    playlist_path.write_text("".join(new_lines), encoding="utf-8")
    logger.info("Song aus Playlist '%s' entfernt: '%s'", playlist_name, relative_path)
    return True


def get_playlists() -> list[dict]:
    """
    Findet alle .m3u8-Dateien im Radio-Verzeichnis.

    Output: list[dict] mit Keys 'name' (str) und 'path' (str)
    """
    playlists = []
    if RADIO_DIR.exists():
        for f in sorted(RADIO_DIR.glob("*.m3u8")):
            playlists.append({"name": f.stem, "path": str(f)})
    logger.debug("Playlists gefunden: %d", len(playlists))
    return playlists


def add_song_to_playlist(playlist_name: str, song_path: str) -> str:
    """
    Fügt einen Song-Pfad zu einer M3U8-Playlist hinzu.

    Input:
        playlist_name – Name der Playlist (ohne .m3u8)
        song_path     – Absoluter Pfad zum Song
    Output:
        str – 'added' oder 'already_exists'
    Raises:
        FileNotFoundError wenn die Playlist nicht existiert
    """
    playlist_path = RADIO_DIR / f"{playlist_name}.m3u8"
    if not playlist_path.exists():
        logger.warning("Playlist nicht gefunden: '%s'", playlist_name)
        raise FileNotFoundError(f"Playlist '{playlist_name}' nicht gefunden")

    # Pfad relativ zu MUSIC_DIR machen
    song_path_obj = Path(song_path)
    if song_path_obj.is_absolute() and MUSIC_DIR in song_path_obj.parents:
        relative_path = str(song_path_obj.relative_to(MUSIC_DIR))
    else:
        relative_path = str(song_path_obj)

    # Duplikat-Check
    existing = playlist_path.read_text(encoding="utf-8", errors="replace")
    if relative_path in existing:
        logger.debug("Song bereits in Playlist '%s': '%s'", playlist_name, relative_path)
        return "already_exists"

    # Anhängen
    with open(playlist_path, "a", encoding="utf-8") as f:
        if existing and not existing.endswith("\n"):
            f.write("\n")
        f.write(relative_path + "\n")

    logger.info("Song zu Playlist '%s' hinzugefügt: '%s'", playlist_name, relative_path)
    return "added"

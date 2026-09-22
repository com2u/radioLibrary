"""
Hilfsfunktionen für ID3-Tag Lesen und Schreiben.

Zweck: Abstrahiert die mutagen-Bibliothek, sodass Services
       sauber auf Metadaten zugreifen können ohne direkt
       von mutagen-Interna abhängig zu sein.
"""
import logging
from mutagen.id3 import (
    ID3, TIT2, TPE1, TALB, TDRC, TCON, COMM, POPM, TRCK, ID3NoHeaderError
)

logger = logging.getLogger(__name__)


def get_id3_text(tag, key: str) -> str:
    """
    Liest einen Text-Wert aus einem ID3-Tag sicher aus.

    Input:
        tag  – mutagen.id3.ID3 Objekt
        key  – ID3-Frame-Schlüssel z.B. 'TIT2', 'TPE1'
    Output:
        str – Wert des Tags, oder leer wenn nicht vorhanden
    """
    try:
        frame = tag.get(key)
        if frame is None:
            return ""
        return str(frame.text[0]) if hasattr(frame, 'text') and frame.text else ""
    except Exception as e:
        logger.debug("ID3 get_text('%s') fehlgeschlagen: %s", key, e)
        return ""


def get_comment(tag) -> str:
    """
    Liest den ersten COMM-Kommentar aus einem ID3-Tag.

    Input:  tag – mutagen.id3.ID3 Objekt
    Output: str – Kommentar-Text oder leer
    """
    for key in tag.keys():
        if key.startswith("COMM"):
            try:
                return str(tag[key].text[0])
            except Exception as e:
                logger.debug("ID3 get_comment('%s') fehlgeschlagen: %s", key, e)
    return ""


def get_rating(tag) -> int:
    """
    Liest den POPM-Rating-Wert aus einem ID3-Tag.

    Input:  tag – mutagen.id3.ID3 Objekt
    Output: int – Rating 0–255 (POPM-Skala), 0 wenn nicht vorhanden
    """
    for key in tag.keys():
        if key.startswith("POPM"):
            try:
                return tag[key].rating
            except Exception as e:
                logger.debug("ID3 get_rating('%s') fehlgeschlagen: %s", key, e)
    return 0


def write_tags(path: str, update: dict) -> None:
    """
    Schreibt ID3-Tags in eine MP3-Datei.

    Input:
        path   – Absoluter Dateipfad zur MP3-Datei
        update – Dict mit optionalen Keys:
                 title, artist, album, year, genre, comment, track
    Output: None
    Raises: Exception bei Schreibfehler
    """
    try:
        tag = ID3(path)
    except ID3NoHeaderError:
        logger.info("Keine ID3-Header in '%s', erstelle neu", path)
        tag = ID3()

    if update.get("title") is not None:
        tag["TIT2"] = TIT2(text=[update["title"]])
    if update.get("artist") is not None:
        tag["TPE1"] = TPE1(text=[update["artist"]])
    if update.get("album") is not None:
        tag["TALB"] = TALB(text=[update["album"]])
    if update.get("year") is not None:
        tag["TDRC"] = TDRC(text=[update["year"]])
    if update.get("genre") is not None:
        tag["TCON"] = TCON(text=[update["genre"]])
    if update.get("comment") is not None:
        tag["COMM::eng"] = COMM(lang="eng", desc="", text=[update["comment"]])
    if update.get("track") is not None:
        tag["TRCK"] = TRCK(text=[update["track"]])

    tag.save(path)
    logger.debug("ID3-Tags gespeichert: '%s'", path)

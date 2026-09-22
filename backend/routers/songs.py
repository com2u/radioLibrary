"""
Router für Song-Endpunkte.

Endpunkte:
  GET  /api/songs          – Liste mit Paginierung, Filter, Sortierung
  GET  /api/songs/meta     – Genres, Jahre, Texte für Filter-UI
  GET  /api/songs/{id}     – Einzelner Song
  PATCH /api/songs/{id}    – Metadaten aktualisieren
  PATCH /api/songs/{id}/favorite – Favorit setzen
  DELETE /api/songs/{id}   – Song löschen
  GET  /api/stream/{id}    – MP3-Stream
  POST /api/rescan         – Cache invalidieren
"""
import logging
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Body
from fastapi.responses import FileResponse

from models.song import MetadataUpdate
from services.library import (
    get_library, find_song, invalidate_cache, load_data, save_data
)
from utils.id3_helpers import write_tags

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/api/songs")
def list_songs(
    page: int = Query(1, ge=1),
    per_page: int = Query(100, ge=1, le=500),
    search: Optional[str] = None,
    genre: Optional[str] = None,
    year: Optional[str] = None,
    favorite: Optional[bool] = None,
    text: Optional[str] = None,
    min_rating: Optional[float] = None,
    sort_by: Optional[str] = Query(
        None,
        description="Sortierfeld: filename, created, modified, community_rating, title, artist, album, genre, duration"
    ),
    sort_dir: Optional[str] = Query("asc", description="Richtung: asc oder desc"),
):
    """
    Gibt eine paginierte und gefilterte Song-Liste zurück.

    Input:  Query-Parameter für Filter und Sortierung
    Output: { songs, total, page, per_page, pages }
    """
    logger.info("GET /api/songs page=%d search='%s' sort_by=%s sort_dir=%s",
                page, search or "", sort_by or "", sort_dir)

    songs = get_library()
    filtered = songs

    # Volltext-Filter (Titel, Artist, Album, Dateiname)
    if search:
        s = search.lower()
        filtered = [
            song for song in filtered
            if s in song["filename"].lower()
            or s in song["title"].lower()
            or s in song["artist"].lower()
            or s in song["album"].lower()
        ]
        logger.debug("Nach Suche '%s': %d Songs", search, len(filtered))

    # Genre-Filter (komma-separiert)
    if genre:
        genres = [g.strip().lower() for g in genre.split(",") if g.strip()]
        filtered = [s for s in filtered if any(g in s["genre"].lower() for g in genres)]

    # Jahr-Filter (komma-separiert)
    if year:
        years = [y.strip() for y in year.split(",") if y.strip()]
        filtered = [s for s in filtered if any(s["year"].startswith(y) for y in years)]

    # Favoriten-Filter
    if favorite is not None:
        filtered = [s for s in filtered if s["favorite"] == favorite]

    # Kommentar-/Text-Filter
    if text:
        t = text.lower()
        filtered = [s for s in filtered if t in s["comment"].lower()]

    # Mindest-Rating-Filter
    if min_rating is not None:
        filtered = [s for s in filtered if s["community_rating"] >= min_rating]

    logger.debug("Nach allen Filtern: %d Songs (von %d gesamt)", len(filtered), len(songs))

    # Sortierung
    if sort_by:
        reverse = (sort_dir == "desc")
        sort_map = {
            "filename": lambda s: s["filename"].lower(),
            "created": lambda s: s.get("created", 0),
            "modified": lambda s: s.get("modified", 0),
            "community_rating": lambda s: s["community_rating"],
            "title": lambda s: s["title"].lower(),
            "artist": lambda s: s["artist"].lower(),
            "album": lambda s: s["album"].lower(),
            "genre": lambda s: s["genre"].lower(),
            "duration": lambda s: s["duration"],
        }
        if sort_by in sort_map:
            filtered.sort(key=sort_map[sort_by], reverse=reverse)

    total = len(filtered)
    start = (page - 1) * per_page
    page_songs = filtered[start:start + per_page]

    return {
        "songs": page_songs,
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": (total + per_page - 1) // per_page,
    }


@router.get("/api/songs/meta")
def get_meta():
    """
    Gibt alle einzigartigen Genres, Jahre und Kommentare für die Filter-UI zurück.

    Output: { genres: list[str], years: list[str], texts: list[str] }
    """
    logger.debug("GET /api/songs/meta")
    songs = get_library()
    genres, years, texts = set(), set(), set()
    for s in songs:
        if s["genre"]:
            for g in s["genre"].split(";"):
                g = g.strip()
                if g:
                    genres.add(g)
        if s["year"] and len(s["year"]) >= 4:
            years.add(s["year"][:4])
        if s["comment"]:
            texts.add(s["comment"].strip())
    return {
        "genres": sorted(genres),
        "years": sorted(years, reverse=True),
        "texts": sorted(texts),
    }


@router.get("/api/songs/{song_id}")
def get_song(song_id: str):
    """
    Gibt einen einzelnen Song zurück.

    Input:  song_id – URL-encoded Song-ID
    Output: Song-Dict oder 404
    """
    logger.debug("GET /api/songs/%s", song_id)
    song = find_song(song_id)
    if not song:
        raise HTTPException(status_code=404, detail="Song nicht gefunden")
    return song


@router.get("/api/stream/{song_id}/peaks")
def stream_peaks(song_id: str):
    """
    Gibt vorberechnete Waveform-Peaks zurück (als JSON-Array).
    """
    data = load_data()
    peaks = data.get("peaks", {}).get(song_id)

    if not peaks:
        # Peaks on-the-fly berechnen falls nicht gecached
        song = find_song(song_id)
        if not song:
            raise HTTPException(status_code=404, detail="Song nicht gefunden")
        from services.library import compute_peaks
        path = Path(song["path"])
        if not path.exists():
            raise HTTPException(status_code=404, detail="Datei nicht gefunden")
        peaks = compute_peaks(path) or []
        # Cachen für zukünftige Anfragen
        if peaks:
            data.setdefault("peaks", {})[song_id] = peaks
            save_data(data)

    return {
        "peaks": peaks,
        "length": len(peaks),
        "duration": find_song(song_id)["duration"] if find_song(song_id) else 0,
    }


@router.get("/api/stream/{song_id}")
def stream_song(song_id: str):
    """
    Streamt eine MP3-Datei als FileResponse.

    Input:  song_id – URL-encoded Song-ID
    Output: FileResponse mit audio/mpeg
    """
    logger.info("GET /api/stream/%s", song_id)
    song = find_song(song_id)
    if not song:
        raise HTTPException(status_code=404, detail="Song nicht gefunden")
    path = Path(song["path"])
    if not path.exists():
        logger.error("Datei nicht gefunden: '%s'", song["path"])
        raise HTTPException(status_code=404, detail="Datei nicht gefunden")
    return FileResponse(
        path,
        media_type="audio/mpeg",
        headers={"Accept-Ranges": "bytes", "Cache-Control": "no-cache"},
    )


@router.patch("/api/songs/{song_id}")
def update_song(song_id: str, update: MetadataUpdate):
    """
    Aktualisiert Metadaten eines Songs (ID3-Tags + Favoriten/Ratings).

    Input:  MetadataUpdate (alle Felder optional)
    Output: { ok: True }
    """
    logger.info("PATCH /api/songs/%s %s", song_id, update.model_dump(exclude_none=True))
    song = find_song(song_id)
    if not song:
        raise HTTPException(status_code=404, detail="Song nicht gefunden")

    data = load_data()
    path = song["path"]

    # ID3-Tags schreiben
    try:
        write_tags(path, {
            "title": update.title,
            "artist": update.artist,
            "album": update.album,
            "year": update.year,
            "genre": update.genre,
            "comment": update.comment,
            "track": update.track,
        })
    except Exception as e:
        logger.error("ID3-Schreibfehler für '%s': %s", song_id, e)
        raise HTTPException(status_code=500, detail=f"Tags konnten nicht gespeichert werden: {e}")

    # Rating in data.json speichern
    if update.community_rating is not None:
        data.setdefault("ratings", {})[song_id] = update.community_rating
        logger.debug("Rating für '%s' gesetzt: %s", song_id, update.community_rating)

    # Favoriten aktualisieren
    if update.favorite is not None:
        favs = data.get("favorites", [])
        if update.favorite and song_id not in favs:
            favs.append(song_id)
        elif not update.favorite and song_id in favs:
            favs.remove(song_id)
        data["favorites"] = favs

    save_data(data)
    invalidate_cache()
    return {"ok": True}


@router.patch("/api/songs/{song_id}/favorite")
def toggle_favorite(song_id: str, favorite: bool = Body(..., embed=True)):
    """
    Setzt oder entfernt den Favoriten-Status eines Songs.

    Input:  { favorite: bool }
    Output: { ok: True }
    """
    logger.info("PATCH /api/songs/%s/favorite favorite=%s", song_id, favorite)
    data = load_data()
    favs = data.get("favorites", [])
    if favorite and song_id not in favs:
        favs.append(song_id)
    elif not favorite and song_id in favs:
        favs.remove(song_id)
    data["favorites"] = favs
    save_data(data)
    invalidate_cache()
    return {"ok": True}


@router.delete("/api/songs/{song_id}")
def delete_song(song_id: str):
    """
    Löscht eine Song-Datei von der Festplatte.

    Input:  song_id – Song-ID
    Output: { ok: True }
    """
    logger.info("DELETE /api/songs/%s", song_id)
    song = find_song(song_id)
    if not song:
        raise HTTPException(status_code=404, detail="Song nicht gefunden")

    path = Path(song["path"])
    try:
        path.unlink()
        logger.info("Datei gelöscht: '%s'", path)
    except Exception as e:
        logger.error("Löschen fehlgeschlagen '%s': %s", path, e)
        raise HTTPException(status_code=500, detail=f"Datei konnte nicht gelöscht werden: {e}")

    # Aus data.json entfernen
    data = load_data()
    if song_id in data.get("favorites", []):
        data["favorites"].remove(song_id)
    if song_id in data.get("ratings", {}):
        del data["ratings"][song_id]
    save_data(data)
    invalidate_cache()
    return {"ok": True}


@router.post("/api/rescan")
def rescan():
    """
    Invalidiert den Library-Cache und scannt neu.

    Output: { count: int } – Anzahl gefundener Songs
    """
    logger.info("POST /api/rescan")
    invalidate_cache()
    songs = get_library()
    return {"count": len(songs)}

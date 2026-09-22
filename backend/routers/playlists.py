"""
Router für Playlist-Endpunkte.

Endpunkte:
  GET    /api/playlists                    – Alle M3U8-Playlists auflisten
  POST   /api/playlists                    – Neue Playlist erstellen
  POST   /api/playlists/{name}/add         – Song zu Playlist hinzufügen
  DELETE /api/playlists/{name}/songs       – Song aus Playlist entfernen
  GET    /api/playlists/{name}/songs       – Songs einer Playlist auflisten
  PUT    /api/playlists/{name}/rename      – Playlist umbenennen
  DELETE /api/playlists/{name}             – Playlist löschen
"""
import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from models import PlaylistAddRequest
from services.library import find_song
from services.playlist_service import (
    get_playlists,
    add_song_to_playlist,
    create_playlist,
    rename_playlist,
    delete_playlist,
    get_playlist_songs,
    remove_song_from_playlist,
)

logger = logging.getLogger(__name__)
router = APIRouter()


class CreatePlaylistRequest(BaseModel):
    name: str


class RenamePlaylistRequest(BaseModel):
    new_name: str


class RemoveSongRequest(BaseModel):
    song_id: str


@router.get("/api/playlists")
def list_playlists():
    """Listet alle verfügbaren M3U8-Playlists auf."""
    logger.debug("GET /api/playlists")
    playlists = get_playlists()
    # Song-Anzahl je Playlist hinzufügen
    result = []
    for pl in playlists:
        try:
            songs = get_playlist_songs(pl["name"])
            count = len(songs)
        except Exception:
            count = 0
        result.append({**pl, "count": count})
    return result


@router.post("/api/playlists")
def create_playlist_endpoint(req: CreatePlaylistRequest):
    """Erstellt eine neue leere Playlist."""
    logger.info("POST /api/playlists name='%s'", req.name)
    try:
        pl = create_playlist(req.name)
        return {**pl, "count": 0}
    except FileExistsError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/playlists/{name}/songs")
def list_playlist_songs(name: str):
    """Gibt alle Songs einer Playlist zurück (mit Song-Metadaten soweit verfügbar)."""
    logger.debug("GET /api/playlists/%s/songs", name)
    from services.library import get_library
    try:
        rel_paths = get_playlist_songs(name)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

    # Versuche Metadaten aus der Library zu laden
    all_songs = get_library()
    songs_by_path = {}
    for s in all_songs:
        # Normalize path for lookup
        from pathlib import Path
        from services.playlist_service import MUSIC_DIR
        sp = Path(s.get("path", ""))
        try:
            rel = str(sp.relative_to(MUSIC_DIR))
            songs_by_path[rel] = s
        except Exception:
            songs_by_path[str(sp)] = s

    result = []
    for rel_path in rel_paths:
        song = songs_by_path.get(rel_path)
        if song:
            result.append(song)
        else:
            result.append({"id": rel_path, "filename": rel_path.split("/")[-1], "path": rel_path})
    return result


@router.post("/api/playlists/{name}/add")
def add_to_playlist(name: str, req: PlaylistAddRequest):
    """Fügt einen Song zu einer Playlist hinzu."""
    logger.info("POST /api/playlists/%s/add song_id='%s'", name, req.song_id)

    song = find_song(req.song_id)
    if not song:
        raise HTTPException(status_code=404, detail="Song nicht gefunden")

    try:
        result = add_song_to_playlist(name, song["path"])
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error("Fehler beim Hinzufügen zu Playlist '%s': %s", name, e)
        raise HTTPException(status_code=500, detail=str(e))

    if result == "already_exists":
        return {"ok": True, "message": "Already in playlist"}
    return {"ok": True}


@router.delete("/api/playlists/{name}/songs")
def remove_from_playlist(name: str, req: RemoveSongRequest):
    """Entfernt einen Song aus einer Playlist."""
    logger.info("DELETE /api/playlists/%s/songs song_id='%s'", name, req.song_id)

    song = find_song(req.song_id)
    if not song:
        raise HTTPException(status_code=404, detail="Song nicht gefunden")

    try:
        removed = remove_song_from_playlist(name, song["path"])
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {"ok": True, "removed": removed}


@router.put("/api/playlists/{name}/rename")
def rename_playlist_endpoint(name: str, req: RenamePlaylistRequest):
    """Benennt eine Playlist um."""
    logger.info("PUT /api/playlists/%s/rename → '%s'", name, req.new_name)
    try:
        pl = rename_playlist(name, req.new_name)
        songs = get_playlist_songs(req.new_name)
        return {**pl, "count": len(songs)}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except FileExistsError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/api/playlists/{name}")
def delete_playlist_endpoint(name: str):
    """Löscht eine Playlist."""
    logger.info("DELETE /api/playlists/%s", name)
    try:
        delete_playlist(name)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"ok": True}

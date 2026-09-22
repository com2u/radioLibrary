"""
Router für Clip-Endpunkte.

Endpunkte:
  POST /api/clip/save – MP3 trimmen und ggf. Fades anwenden
"""
import logging
from pathlib import Path

from fastapi import APIRouter, HTTPException

from models import ClipSave
from services.library import find_song, invalidate_cache
from services.clip_service import apply_clip

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/api/clip/save")
def save_clip(clip: ClipSave):
    """
    Wendet einen Clip (Trim + optionale Fades) auf eine Song-Datei an.

    Der Original-Song wird dabei dauerhaft überschrieben!
    ID3-Tags werden wiederhergestellt, Kommentar wird auf 'saved' gesetzt
    falls vorher leer.

    Input:  ClipSave { song_id, start, end, fade_in, fade_out, fade_duration }
    Output: { ok: True }
    """
    logger.info("POST /api/clip/save song_id='%s' [%.2f–%.2f] fade_in=%s fade_out=%s",
                clip.song_id, clip.start, clip.end, clip.fade_in, clip.fade_out)

    song = find_song(clip.song_id)
    if not song:
        raise HTTPException(status_code=404, detail="Song nicht gefunden")

    path = Path(song["path"])
    if not path.exists():
        logger.error("Datei nicht gefunden für Clip: '%s'", song["path"])
        raise HTTPException(status_code=404, detail="Datei nicht gefunden")

    try:
        apply_clip(
            path=path,
            start=clip.start,
            end=clip.end,
            fade_in=clip.fade_in,
            fade_out=clip.fade_out,
            fade_duration=clip.fade_duration,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error("Unerwarteter Clip-Fehler: %s", e)
        raise HTTPException(status_code=500, detail=f"Clip fehlgeschlagen: {e}")

    # Cache invalidieren damit neue Dauer angezeigt wird
    invalidate_cache()
    return {"ok": True}

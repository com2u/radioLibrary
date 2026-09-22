"""
Router für Cleanup-Endpunkte.

Endpunkte:
  GET  /api/cleanup/preview   – Vorschau was aufgeräumt werden würde (löscht nichts)
  POST /api/cleanup/execute   – Führt das Aufräumen für gewählte Regeln aus
  GET  /api/cleanup/stations  – Liste der Stationen für den Filter
"""
import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from services.cleanup_service import analyze, execute
from services.recording_service import load_stations_config

logger = logging.getLogger(__name__)
router = APIRouter()


class CleanupRequest(BaseModel):
    """Input für POST /api/cleanup/execute."""
    rules: list                 # z.B. ['invalid_title', 'duplicates']
    station: Optional[str] = None
    limit: Optional[int] = None


@router.get("/api/cleanup/preview")
def cleanup_preview(station: Optional[str] = None):
    """
    Vorschau der Aufräum-Optionen. Löscht NICHTS.

    Input:  station – optionaler Sendername zur Einschränkung
    Output: { invalid_title: {...}, unvalued: {...}, duplicates: {...} }
    """
    logger.info("GET /api/cleanup/preview station=%s", station or "Alle")
    try:
        return analyze(station=station)
    except Exception as e:
        logger.error("Cleanup-Vorschau fehlgeschlagen: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/cleanup/execute")
def cleanup_execute(req: CleanupRequest):
    """
    Führt das Aufräumen aus.

    Input:  { rules: [...], station?: str, limit?: int }
    Output: { deleted, failed, freed_mb, errors }
    """
    logger.warning("POST /api/cleanup/execute rules=%s station=%s",
                   req.rules, req.station or "Alle")

    allowed = {"invalid_title", "unvalued", "duplicates"}
    rules = [r for r in req.rules if r in allowed]
    if not rules:
        raise HTTPException(
            status_code=400,
            detail=f"Keine gültigen Regeln. Erlaubt: {sorted(allowed)}"
        )

    unknown = [r for r in req.rules if r not in allowed]
    if unknown:
        logger.warning("Unbekannte Regeln ignoriert: %s", unknown)

    try:
        return execute(rules=rules, station=req.station, limit=req.limit)
    except Exception as e:
        logger.error("Cleanup-Ausführung fehlgeschlagen: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/cleanup/stations")
def cleanup_stations():
    """
    Liste der verfügbaren Stationen für den Cleanup-Filter.

    Output: list[str]
    """
    stations = load_stations_config()
    return [s["name"] for s in stations]

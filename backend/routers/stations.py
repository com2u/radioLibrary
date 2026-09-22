"""
Router für Stations-Konfiguration.

Endpunkte:
  GET    /api/stations           – Alle Stationen laden
  POST   /api/stations           – Alle Stationen speichern
  POST   /api/stations/add       – Neue Station hinzufügen
  PUT    /api/stations/{name}    – Station aktualisieren
  DELETE /api/stations/{name}    – Station löschen
"""
import logging
from typing import List

from fastapi import APIRouter, HTTPException

from models import StationConfig
from services.recording_service import load_stations_config, save_stations_config

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/api/stations")
def get_stations():
    """
    Gibt alle gespeicherten Stationskonfigurationen zurück.

    Output: list[StationConfig]
    """
    logger.debug("GET /api/stations")
    return load_stations_config()


@router.post("/api/stations")
def save_stations(stations: List[StationConfig]):
    """
    Überschreibt alle Stationskonfigurationen.

    Input:  list[StationConfig]
    Output: { ok: True }
    """
    logger.info("POST /api/stations (%d Stationen)", len(stations))
    data = [s.model_dump() for s in stations]
    save_stations_config(data)
    return {"ok": True}


@router.post("/api/stations/add")
def add_station(station: StationConfig):
    """
    Fügt eine neue Station hinzu.

    Input:  StationConfig
    Output: { ok: True }
    Raises: 400 wenn Name bereits vergeben
    """
    logger.info("POST /api/stations/add name='%s'", station.name)
    stations = load_stations_config()
    for s in stations:
        if s["name"] == station.name:
            raise HTTPException(status_code=400, detail=f"Station '{station.name}' existiert bereits")
    stations.append(station.model_dump())
    save_stations_config(stations)
    return {"ok": True}


@router.put("/api/stations/{station_name}")
def update_station(station_name: str, station: StationConfig):
    """
    Aktualisiert eine bestehende Station.

    Input:  station_name (URL-Param) + StationConfig
    Output: { ok: True }
    """
    logger.info("PUT /api/stations/%s", station_name)
    stations = load_stations_config()
    found = False
    for i, s in enumerate(stations):
        if s["name"] == station_name:
            stations[i] = station.model_dump()
            found = True
            break
    if not found:
        raise HTTPException(status_code=404, detail=f"Station '{station_name}' nicht gefunden")
    save_stations_config(stations)
    return {"ok": True}


@router.delete("/api/stations/{station_name}")
def delete_station(station_name: str):
    """
    Löscht eine Station.

    Input:  station_name – Name der zu löschenden Station
    Output: { ok: True }
    """
    logger.info("DELETE /api/stations/%s", station_name)
    stations = load_stations_config()
    original_count = len(stations)
    stations = [s for s in stations if s["name"] != station_name]
    if len(stations) == original_count:
        raise HTTPException(status_code=404, detail=f"Station '{station_name}' nicht gefunden")
    save_stations_config(stations)
    return {"ok": True}

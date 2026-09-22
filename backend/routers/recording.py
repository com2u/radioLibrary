"""
Router für Recording-Endpunkte.

Endpunkte:
  GET  /api/recording/stations          – Alle Stationen mit Status
  POST /api/recording/{station}/start   – Aufnahme starten
  POST /api/recording/{station}/stop    – Aufnahme stoppen
  GET  /api/recording/stats             – Statistiken
"""
import logging

from fastapi import APIRouter, HTTPException

from services.recording_service import (
    load_stations_config, station_running, station_enabled,
    start_station, stop_station, get_recording_stats,
    init_station_states
)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/api/recording/stations")
def get_recording_stations():
    """
    Gibt alle Stationen mit aktuellem Laufzustand zurück.

    Output: list[{ name, url, path, default_enabled, running, enabled }]
    """
    logger.debug("GET /api/recording/stations")
    stations = load_stations_config()
    # WICHTIG: Hier werden KEINE State-Dateien mehr angelegt!
    # Früher wurde bei jedem GET das State-File neu erzeugt, wenn
    # default_enabled=true war. Dadurch war eine gestoppte Station beim
    # nächsten Rendern des Frontends sofort wieder aktiv und der
    # Manager-Daemon startete die Aufnahme neu -> Stop war wirkungslos.
    # Die Initialisierung passiert jetzt ausschliesslich beim Backend-Start
    # über init_station_states().
    result = []
    for station in stations:
        name = station["name"]
        result.append({
            "name": name,
            "url": station.get("url", ""),
            "path": station.get("path", ""),
            "default_enabled": station.get("default_enabled", False),
            "running": station_running(name),
            "enabled": station_enabled(name),
        })
    return result


@router.post("/api/recording/{station}/start")
def start_recording(station: str):
    """
    Startet die Streamripper-Aufnahme für eine Station.

    Input:  station – Stationsname (URL-Param)
    Output: { ok: True, message?: str }
    """
    logger.info("POST /api/recording/%s/start", station)
    station_names = [s["name"] for s in load_stations_config()]
    if station not in station_names:
        raise HTTPException(status_code=404, detail=f"Unbekannte Station: {station}")
    try:
        result = start_station(station)
        return result
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/recording/{station}/stop")
def stop_recording(station: str):
    """
    Stoppt die Streamripper-Aufnahme für eine Station.

    Input:  station – Stationsname (URL-Param)
    Output: { ok: True }
    """
    logger.info("POST /api/recording/%s/stop", station)
    station_names = [s["name"] for s in load_stations_config()]
    if station not in station_names:
        raise HTTPException(status_code=404, detail=f"Unbekannte Station: {station}")
    try:
        result = stop_station(station)
        # Verifikation: Stop erst als erfolgreich melden, wenn tatsächlich
        # kein Streamripper-Prozess mehr läuft und die Station deaktiviert ist.
        # Ausnahme: Docker-Container hat keine CAP_KILL – dann delegiert
        # stop_station an den Manager-Daemon (max. 5 Min Verzögerung).
        still_running = station_running(station)
        still_enabled = station_enabled(station)
        if (still_running or still_enabled) and not result.get("delegated_to_manager"):
            logger.error(
                "Stop-Verifikation fehlgeschlagen für '%s' (running=%s, enabled=%s)",
                station, still_running, still_enabled
            )
            raise HTTPException(
                status_code=500,
                detail=(
                    f"Aufnahme für '{station}' konnte nicht vollständig gestoppt werden "
                    f"(running={still_running}, enabled={still_enabled})."
                )
            )
        result["verified"] = True
        if result.get("delegated_to_manager"):
            result["warning"] = (
                f"Aufnahme wird innerhalb von 5 Minuten vom Manager-Daemon beendet. "
                f"State-Datei wurde gelöscht."
            )
        return result
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/recording/{station}/restart")
def restart_recording(station: str):
    """
    Startet die Streamripper-Aufnahme für eine Station neu (Stop + Start).

    Input:  station – Stationsname (URL-Param)
    Output: { ok: True }
    """
    logger.info("POST /api/recording/%s/restart", station)
    station_names = [s["name"] for s in load_stations_config()]
    if station not in station_names:
        raise HTTPException(status_code=404, detail=f"Unbekannte Station: {station}")
    try:
        stop_station(station)
    except RuntimeError:
        pass  # Ignorieren falls Station nicht läuft
    try:
        result = start_station(station)
        return result
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/recording/stats")
def recording_stats():
    """
    Berechnet Recording-Statistiken.

    Output: { total_music, today_music, last_30min_music, stations: {} }
    """
    logger.debug("GET /api/recording/stats")
    return get_recording_stats()

"""
Radio Library Backend – FastAPI Anwendung

Einstiegspunkt: Registriert alle Router und konfiguriert CORS.
Die eigentliche Logik ist aufgeteilt in:
  - routers/   – HTTP-Handler (thin layer)
  - services/  – Business-Logik
  - models/    – Pydantic-Datenmodelle
  - utils/     – Hilfsfunktionen
"""
import logging
import sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Logging konfigurieren: INFO für die Anwendung, WARNING für externe Libs
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
    stream=sys.stdout,
)
logger = logging.getLogger(__name__)

# Router importieren
from routers.songs import router as songs_router
from routers.clips import router as clips_router
from routers.playlists import router as playlists_router
from routers.recording import router as recording_router
from routers.stations import router as stations_router
from routers.cleanup import router as cleanup_router

app = FastAPI(
    title="Radio Library API",
    description="Backend für die Radio Library – Verwaltet MP3s, Playlists und Streamripper-Aufnahmen",
    version="2.0.0",
)

# CORS: Erlaubt alle Origins (für lokalen Entwicklungsbetrieb)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Alle Router registrieren
app.include_router(songs_router)
app.include_router(clips_router)
app.include_router(playlists_router)
app.include_router(recording_router)
app.include_router(stations_router)
app.include_router(cleanup_router)

logger.info("Radio Library API gestartet – alle Router registriert")


@app.on_event("startup")
async def startup_event():
    """
    Beim Start:
      1. Library-Cache im Hintergrund vorwärmen
      2. Stations-States einmalig initialisieren (default_enabled)

    WICHTIG: Die State-Initialisierung gehört HIERHER und nicht in einen
    GET-Endpunkt. Sie legt fehlende .enabled-Dateien nur an, wenn die Datei
    noch nie existierte. Manuell gestoppte Stationen bleiben gestoppt.
    """
    import threading
    from services.library import get_library
    from services.recording_service import init_station_states

    created = init_station_states()
    if created:
        logger.info("Beim Start aktivierte Stationen: %s", ", ".join(created))

    logger.info("Starte Library-Pre-Scan im Hintergrund...")
    thread = threading.Thread(target=get_library, daemon=True)
    thread.start()


@app.get("/api/status")
async def api_status():
    """Gibt Status zurück (Scan-Fortschritt, Cache-Status)."""
    from services.library import _library_cache, _scanning
    return {
        "ready": _library_cache is not None,
        "scanning": _scanning,
        "song_count": len(_library_cache) if _library_cache else 0,
    }


if __name__ == "__main__":
    import uvicorn
    logger.info("Starte uvicorn auf 0.0.0.0:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=False)

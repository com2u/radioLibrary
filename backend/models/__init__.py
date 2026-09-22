"""
Pydantic-Modelle für Clip, Playlist und Station.
"""
from typing import Optional
from pydantic import BaseModel, Field


class ClipSave(BaseModel):
    """
    Parameter für POST /api/clip/save.

    Beschreibt einen Schnitt in eine MP3-Datei mit optionalen Fades.
    """
    song_id: str = Field(description="Song-ID (rel_path mit |)")
    start: float = Field(description="Schnitt-Start in Sekunden")
    end: float = Field(description="Schnitt-Ende in Sekunden")
    fade_in: bool = Field(False, description="Fade-In am Clip-Anfang aktivieren")
    fade_out: bool = Field(False, description="Fade-Out am Clip-Ende aktivieren")
    fade_duration: float = Field(3.0, description="Fade-Dauer in Sekunden")


class PlaylistAddRequest(BaseModel):
    """
    Parameter für POST /api/playlists/{name}/add.
    """
    song_id: str = Field(description="ID des Songs der hinzugefügt werden soll")


class StationConfig(BaseModel):
    """
    Konfiguration einer Radiostation.

    Verwendet von: GET/POST/PUT /api/stations
    """
    name: str = Field(description="Anzeigename der Station")
    url: str = Field(description="Stream-URL (HTTP/HTTPS)")
    path: str = Field(description="Relativer Unterordner unter MUSIC_DIR")
    default_enabled: bool = Field(False, description="Soll Station standardmäßig aufnehmen?")

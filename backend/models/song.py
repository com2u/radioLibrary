"""
Pydantic-Modelle für Song-bezogene Requests und Responses.

Zweck: Typsichere Datenstrukturen für die API-Schicht,
       unabhängig von der Datenbank- oder Dateisystem-Implementierung.
"""
from typing import Optional
from pydantic import BaseModel, Field


class Song(BaseModel):
    """
    Vollständige Song-Daten wie vom Backend zurückgegeben.

    Output von: GET /api/songs, GET /api/songs/{id}
    """
    id: str = Field(description="Relativer Pfad mit | statt /, z.B. 'WDR2|song.mp3'")
    path: str = Field(description="Absoluter Dateipfad")
    rel_path: str = Field(description="Pfad relativ zum MUSIC_DIR")
    filename: str
    title: str
    artist: str
    album: str
    year: str
    genre: str
    comment: str
    track: str
    duration: float = Field(description="Dauer in Sekunden")
    community_rating: float = Field(ge=0, le=10, description="Bewertung 0–10")
    favorite: bool
    created: float = Field(description="Unix-Timestamp der Erstellung")
    modified: float = Field(description="Unix-Timestamp der letzten Änderung")


class MetadataUpdate(BaseModel):
    """
    Optionale Felder für PATCH /api/songs/{id}.
    Nur angegebene Felder werden aktualisiert.

    Input für: PATCH /api/songs/{id}
    """
    title: Optional[str] = None
    artist: Optional[str] = None
    album: Optional[str] = None
    year: Optional[str] = None
    genre: Optional[str] = None
    comment: Optional[str] = None
    track: Optional[str] = None
    community_rating: Optional[float] = Field(None, ge=0, le=10)
    favorite: Optional[bool] = None


class SongListResponse(BaseModel):
    """
    Paginierte Song-Liste als API-Antwort.

    Output von: GET /api/songs
    """
    songs: list
    total: int
    page: int
    per_page: int
    pages: int


class MetaResponse(BaseModel):
    """
    Metadaten für die Filter-UI.

    Output von: GET /api/songs/meta
    """
    genres: list[str]
    years: list[str]
    texts: list[str]

# Radio Library – Architektur-Dokumentation

> Erstellt: 2026-05-27  
> Stand: Nach Refactoring (von monolithischem App.jsx + main.py zu modularer Struktur)

---

## 1. Übersicht

Die Radio Library ist eine Webanwendung zum Verwalten, Abspielen und Bearbeiten einer lokalen MP3-Bibliothek, die von Streamripper-Radio-Aufnahmen gespeist wird.

```
┌─────────────────────────────────────────┐
│           Browser (React/Vite)          │
│  ┌──────────┐  ┌────────┐  ┌─────────┐  │
│  │ Song List │  │ Player │  │ Modals  │  │
│  └────┬─────┘  └───┬────┘  └────┬────┘  │
│       └────────────┴────────────┘        │
│                  api.js                  │
└──────────────────┬──────────────────────┘
                   │ HTTP (JSON)
                   ▼
┌─────────────────────────────────────────┐
│         FastAPI Backend (Port 8000)     │
│  ┌──────────┐  ┌──────────┐            │
│  │  /songs  │  │/recording│  /playlists │
│  └────┬─────┘  └────┬─────┘            │
│       └─────────────┘                   │
│       Library Service / Clip Service    │
└──────────────────┬──────────────────────┘
                   │
          ┌────────┴────────┐
          ▼                 ▼
   /mnt/radio/music    data.json
   (MP3 Dateien)       (Favorites, Ratings)
```

---

## 2. Verzeichnisstruktur (Ziel nach Refactoring)

### Backend

```
backend/
├── main.py                  # FastAPI-App, Startup, CORS (≤ 50 Zeilen)
├── data.json                # Persistenz: Favorites & Ratings
├── models/
│   ├── __init__.py
│   ├── song.py              # Pydantic: Song, MetadataUpdate
│   ├── clip.py              # Pydantic: ClipSave
│   ├── playlist.py          # Pydantic: PlaylistAddRequest
│   └── station.py           # Pydantic: StationConfig
├── services/
│   ├── __init__.py
│   ├── library.py           # MP3-Scan, Cache, Metadaten-Lesen
│   ├── clip_service.py      # ffmpeg Clip-Schnitt & Fades
│   ├── playlist_service.py  # M3U8 Lesen/Schreiben
│   └── recording_service.py # Streamripper Start/Stop, PID-Management
├── routers/
│   ├── __init__.py
│   ├── songs.py             # GET/PATCH/DELETE /api/songs/*
│   ├── clips.py             # POST /api/clip/save
│   ├── playlists.py         # GET/POST /api/playlists/*
│   ├── recording.py         # GET/POST /api/recording/*
│   └── stations.py          # GET/POST/PUT/DELETE /api/stations/*
└── utils/
    ├── __init__.py
    └── id3_helpers.py       # ID3-Tag Lesen/Schreiben Hilfsfunktionen
```

### Frontend

```
frontend/src/
├── main.jsx                 # React-Entry, Render
├── App.jsx                  # Haupt-Layout, State-Management (≤ 200 Zeilen)
├── App.css                  # Globale Styles
├── index.css                # Reset/Base Styles
├── api.js                   # Alle Axios-Aufrufe (bereits modular)
├── hooks/
│   ├── useSongs.js          # State + Logik für Song-Liste, Paginierung
│   ├── usePlayer.js         # WaveSurfer-Init, Play/Pause, Clip-Mode
│   └── useKeyboard.js       # Globale Keyboard-Shortcuts
├── components/
│   ├── Player.jsx           # Audio-Player mit WaveSurfer + Clip-Overlay
│   ├── SongTable.jsx        # Song-Liste mit Tabelle + Pagination
│   ├── StarRating.jsx       # Stern-Bewertungs-Komponente
│   ├── NowPlayingBars.jsx   # Animierte "Läuft"-Balken
│   └── AppHeader.jsx        # Top-Bar mit Filter/Sort/Rescan-Buttons
└── modals/
    ├── FilterModal.jsx      # Filter-Dialog (Genre, Jahr, Favoriten)
    ├── MetaEditModal.jsx    # ID3-Metadaten bearbeiten
    ├── SortOrderModal.jsx   # Sortier-Dialog
    ├── ConfirmModal.jsx     # Bestätigungs-Dialog (Löschen)
    ├── PlaylistModal.jsx    # Song zu Playlist hinzufügen
    ├── StationEditModal.jsx # Radiostation anlegen/bearbeiten
    └── RecordingControlDialog.jsx  # Recording-Übersicht + Stats
```

---

## 3. Komponenten-Baum (Frontend)

```
App
├── AppHeader
│   └── [Filter/Sort/Reload/Recording Buttons]
├── SongTable
│   ├── NowPlayingBars  (bei aktivem Song)
│   ├── StarRating      (pro Zeile)
│   └── Pagination
├── Player
│   ├── WaveSurfer      (Waveform-Anzeige)
│   ├── ClipOverlay     (Rote/grüne Markierungen im Clip-Modus)
│   ├── StarRating
│   └── ConfirmModal    (Löschen aus dem Player heraus)
└── [Modals - conditional render]
    ├── FilterModal
    ├── SortOrderModal
    ├── MetaEditModal
    ├── ConfirmModal
    ├── PlaylistModal
    ├── RecordingControlDialog
    └── StationEditModal
```

---

## 4. API-Endpunkte

### Songs

| Method | Endpoint | Beschreibung |
|--------|----------|-------------|
| GET | `/api/songs` | Song-Liste mit Paginierung, Filtern, Sortierung |
| GET | `/api/songs/meta` | Alle Genres, Jahre, Texte für Filter-UI |
| GET | `/api/songs/{id}` | Einzelner Song |
| PATCH | `/api/songs/{id}` | Metadaten aktualisieren (ID3 + data.json) |
| PATCH | `/api/songs/{id}/favorite` | Favorit setzen/entfernen |
| DELETE | `/api/songs/{id}` | Song-Datei löschen |
| GET | `/api/stream/{id}` | MP3-Stream (FileResponse mit Range-Support) |
| POST | `/api/rescan` | Library-Cache invalidieren und neu einlesen |

### Clips

| Method | Endpoint | Beschreibung |
|--------|----------|-------------|
| POST | `/api/clip/save` | Clip trimmen (+ optionale Fades) via ffmpeg |

### Playlists

| Method | Endpoint | Beschreibung |
|--------|----------|-------------|
| GET | `/api/playlists` | Alle .m3u8-Dateien auflisten |
| POST | `/api/playlists/{name}/add` | Song zu Playlist hinzufügen |

### Recording / Stations

| Method | Endpoint | Beschreibung |
|--------|----------|-------------|
| GET | `/api/recording/stations` | Stationen mit Laufzustand |
| GET | `/api/recording/stats` | Statistiken (Gesamt, Heute, 30 Min) |
| POST | `/api/recording/{station}/start` | Streamripper starten |
| POST | `/api/recording/{station}/stop` | Streamripper stoppen |
| GET | `/api/stations` | Station-Konfigurationen |
| POST | `/api/stations` | Alle Stationen speichern |
| POST | `/api/stations/add` | Neue Station hinzufügen |
| PUT | `/api/stations/{name}` | Station aktualisieren |
| DELETE | `/api/stations/{name}` | Station löschen |

---

## 5. Datenfluss

### Song laden & abspielen

```
User klickt Zeile
     │
     ▼
App.setIdx(i)  →  currentSong = songs[i]
     │
     ▼
<Player song={currentSong} />
     │
     ▼
useEffect([song.id])  →  WaveSurfer.load(streamUrl(song.id))
     │
     ▼
GET /api/stream/{id}  →  FileResponse(mp3)
     │
     ▼
WaveSurfer rendert Waveform + spielt ab
```

### Song filtern

```
User öffnet FilterModal (F-Taste)
     │
     ▼
onApply(newFilters)  →  App.setFilters()  →  useEffect trigger
     │
     ▼
fetchSongs({ ...filters, page:1, sort_by, sort_dir })
     │
     ▼
GET /api/songs?search=...&genre=...&...
     │
     ▼
Backend filtert in-memory aus Library-Cache
     │
     ▼
setSongs(result)  →  Re-render SongTable
```

### Clip speichern

```
Player: Clip-Modus aktivieren (C-Taste)
     │
     ▼
[ Taste] / ]Taste]  →  setClipStart / setClipEnd
     │
     ▼
[S-Taste]  →  saveClip({ song_id, start, end, fade_in, fade_out })
     │
     ▼
POST /api/clip/save
     │
     ▼
Backend: ffmpeg trim → ffmpeg fade → Datei ersetzen → ID3 Tags wiederherstellen
     │
     ▼
_library_cache = None  →  nächster Request scannt neu
```

---

## 6. Wichtige Datenstrukturen

### Song (Backend → Frontend)

```typescript
interface Song {
  id: string;           // rel_path mit | statt /  z.B. "WDR2|song.mp3"
  path: string;         // Absoluter Pfad
  rel_path: string;     // Relativer Pfad ab MUSIC_DIR
  filename: string;
  title: string;
  artist: string;
  album: string;
  year: string;
  genre: string;
  comment: string;
  track: string;
  duration: number;     // Sekunden
  community_rating: number;  // 0–10
  favorite: boolean;
  created: number;      // Unix-Timestamp
  modified: number;     // Unix-Timestamp
}
```

### Filter-Parameter (Frontend → Backend)

```typescript
interface SongFilter {
  search?: string;       // Volltext-Suche (Titel, Artist, Album, Dateiname)
  genre?: string;        // Komma-separierte Genre-Liste
  year?: string;         // Komma-separierte Jahre
  favorite?: boolean;    // Nur Favoriten
  text?: string;         // Kommentar-Filter
  min_rating?: number;   // Mindest-Rating
  sort_by?: string;      // Sortierfeld
  sort_dir?: 'asc'|'desc';
  page?: number;
  per_page?: number;
}
```

---

## 7. Keyboard-Shortcuts

| Taste | Funktion | Kontext |
|-------|----------|---------|
| Space / Enter | Play/Pause | Global |
| → / ↓ | Nächster Song | Global |
| ← / ↑ | Vorheriger Song | Global |
| , | -10 Sekunden | Global |
| . | +10 Sekunden | Global |
| F | Filter öffnen | Global |
| M | Metadaten bearbeiten | Global |
| C | Clip-Modus aktivieren | Global |
| O | Sortier-Dialog | Global |
| P | Playlist-Dialog | Global |
| A | Song zu Playlist 1 hinzufügen | Global |
| B | Song zu Playlist 2 hinzufügen | Global |
| 1–9 | Community Rating setzen | Global |
| Delete | Song löschen (Bestätigung) | Global |
| [ | Clip-Start setzen | Clip-Modus |
| ] | Clip-Ende setzen | Clip-Modus |
| S | Clip speichern | Clip-Modus |
| L | Fade-In umschalten | Clip-Modus |
| R | Fade-Out umschalten | Clip-Modus |
| Escape | Clip-Modus verlassen | Clip-Modus |

---

## 8. Architecture Decision Records (ADR)

### ADR-001: In-Memory Library Cache

**Entscheidung:** Die MP3-Bibliothek wird beim ersten Request eingelesen und im Speicher gehalten (`_library_cache`). Invalidierung bei Schreiboperationen (PATCH, DELETE, clip/save, rescan).

**Begründung:** Dateisystem-Scans über Tausende MP3s sind langsam. Eine Datenbank wäre Over-Engineering für den Anwendungsfall.

**Nachteil:** Neuerdings hinzugekommene Songs erscheinen erst nach Rescan.

---

### ADR-002: Song-IDs aus relativen Pfaden

**Entscheidung:** Song-IDs werden aus dem relativen Pfad gebildet (Slashes durch `|` ersetzt).

**Begründung:** Keine UUID-Datenbank nötig, IDs sind deterministisch und menschenlesbar.

**Nachteil:** Umbenennen einer Datei bricht die ID (Ratings/Favorites gehen verloren).

---

### ADR-003: Favoriten & Ratings in data.json

**Entscheidung:** Favoriten-Liste und Ratings werden in einer JSON-Datei gespeichert, nicht in den MP3-ID3-Tags (außer beim expliziten PATCH).

**Begründung:** Schnelle Reads ohne Datei-I/O für jede Anfrage, atomares Schreiben möglich.

---

### ADR-004: WaveSurfer für Audio-Player

**Entscheidung:** WaveSurfer.js für die Waveform-Visualisierung und Playback.

**Begründung:** Bietet native Seek-Funktionalität, Zoom und Event-Callbacks, die für den Clip-Modus benötigt werden.

---

### ADR-005: Modulare Dateistruktur (dieses Refactoring)

**Entscheidung:** Aufteilung von `App.jsx` (1360 Zeilen) und `main.py` (890 Zeilen) in thematische Module ≤ 300 Zeilen.

**Begründung:** Bessere Wartbarkeit, klare Zuständigkeiten, einfacheres Debugging, unabhängige Entwicklung.

**Regeln:**
- Backend: models/ für Pydantic, services/ für Business-Logik, routers/ für HTTP-Handler
- Frontend: hooks/ für State-Logik, components/ für UI, modals/ für Dialog-Komponenten

---

## 9. Externe Abhängigkeiten

### Backend

| Package | Version | Zweck |
|---------|---------|-------|
| fastapi | ≥0.100 | HTTP Framework |
| uvicorn | ≥0.20 | ASGI Server |
| mutagen | ≥1.46 | MP3/ID3 Metadaten |
| pydantic | ≥2.0 | Datenvalidierung |
| ffmpeg | System | Audio-Clip-Verarbeitung |
| streamripper | System | Radio-Aufnahmen |

### Frontend

| Package | Version | Zweck |
|---------|---------|-------|
| react | ≥18 | UI Framework |
| vite | ≥4 | Build Tool |
| wavesurfer.js | ≥7 | Audio-Waveform + Player |
| axios | ≥1.4 | HTTP Client |

---

## 10. Logging-Strategie

### Backend Log-Level

```
DEBUG  – Library-Scan Details, Cache-Treffer/Misses
INFO   – API-Requests, Recording Start/Stop
WARNING – Fehlende Dateien, ungültige Tags
ERROR  – ffmpeg-Fehler, Dateioperationen fehlgeschlagen
```

### Frontend Console-Log-Gruppen

```
[API]    – Alle fetchSongs/updateSong/etc. Aufrufe mit Timing
[Player] – WaveSurfer Events (load, ready, play, pause, finish)
[Clip]   – Clip-Modus Aktionen (start/end setzen, speichern)
[State]  – State-Änderungen in App (filters, sort, page)
```

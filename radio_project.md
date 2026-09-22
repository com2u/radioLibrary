# Radio Library – Vollständige Projektdokumentation

> Stand: 2026-05-27  
> Ziel: Ein Entwickler kann das gesamte System **ausschließlich mit dieser Datei** neu aufsetzen.

---

## Inhaltsverzeichnis

1. [Einleitung & Projektübersicht](#1-einleitung--projektübersicht)
2. [Systemarchitektur](#2-systemarchitektur)
3. [Backend-Dokumentation](#3-backend-dokumentation)
4. [Frontend-Dokumentation](#4-frontend-dokumentation)
5. [Radio-Recording Pipeline](#5-radio-recording-pipeline)
6. [Cronjob-Konfiguration & Scripts](#6-cronjob-konfiguration--scripts)
7. [Installation & Setup](#7-installation--setup)
8. [API-Referenz](#8-api-referenz)
9. [Konfigurationsdateien](#9-konfigurationsdateien)
10. [Jellyfin-Integration](#10-jellyfin-integration)
11. [Troubleshooting & FAQ](#11-troubleshooting--faq)

---

## 1. Einleitung & Projektübersicht

### Was ist die Radio Library?

Die **Radio Library** ist eine Self-Hosted-Webanwendung zur Verwaltung einer lokalen MP3-Bibliothek, die automatisch durch Radio-Stream-Aufnahmen befüllt wird. Das System:

- **Nimmt** kontinuierlich mehrere Radiosender via Streamripper auf
- **Filtert** aufgenommene Dateien (Dauer, Dateiname) um nur Musik zu behalten
- **Taggt** MP3s mit korrekten ID3-Metadaten (Artist/Title/Album/Genre)
- **Stellt** eine Web-UI zum Abspielen, Bewerten, Schneiden und Verwalten bereit
- **Exportiert** die Bibliothek nach Jellyfin (optionales Media-Center)

### Technologie-Stack

| Schicht | Technologie | Version |
|---------|------------|---------|
| Backend | Python + FastAPI | ≥3.10 / ≥0.100 |
| Backend-Server | Uvicorn (ASGI) | ≥0.20 |
| Audio-Metadaten | Mutagen | ≥1.46 |
| Audio-Schnitt | FFmpeg | System-Paket |
| Radio-Aufnahmen | Streamripper | System-Paket |
| Frontend | React + Vite | ≥18 / ≥4 |
| Audio-Player | WaveSurfer.js | ≥7 |
| HTTP-Client | Axios | ≥1.4 |
| Media-Center | Jellyfin | Docker |

### Projektverzeichnis-Übersicht

```
/root/src/radio/
├── backend/                # FastAPI-Backend (Python)
│   ├── main.py             # App-Einstiegspunkt
│   ├── data.json           # Persistenz: Favoriten & Ratings
│   ├── models/             # Pydantic-Datenmodelle
│   ├── routers/            # HTTP-Handler
│   ├── services/           # Business-Logik
│   └── utils/              # Hilfsfunktionen
├── frontend/               # React-Frontend
│   └── src/
│       ├── App.jsx         # Haupt-Komponente
│       ├── api.js          # API-Aufrufe (Axios)
│       ├── utils.js        # Hilfsfunktionen
│       ├── components/     # UI-Komponenten
│       ├── modals/         # Dialog-Komponenten
│       └── i18n/           # Übersetzungen (DE/EN)
└── scripts-docs/           # Shell-Scripts & Python-Hilfsskripte
```

### Mount-Punkte (wichtig!)

Das System setzt folgende Verzeichnisstruktur unter `/mnt/radio/` voraus:

```
/mnt/radio/
├── inbox/          # Streamripper-Ausgabe (temporär)
│   ├── WDR2/
│   ├── ANTENNE/
│   └── ...
├── music/          # Endgültige Musikbibliothek
│   ├── WDR2 - Musik/
│   ├── ANTENNE - Musik/
│   └── ...
├── config/
│   └── stations.json   # Stations-Konfiguration
├── state/              # Aktivierungs-State-Dateien
│   └── WDR2.enabled    # Datei existiert = Station aktiv
├── logs/               # Streamripper & Pipeline-Logs
├── scripts/            # Produktions-Scripts (symlink od. copy)
│   ├── streamripper-manager.sh
│   └── fix-id3-tags.py
└── *.m3u8              # Playlists (Wurzel des Radio-Verzeichnisses)
```

**Pitfall:** Das Backend erwartet **zwingend** `/mnt/radio/music` als Musikverzeichnis. Dieser Pfad ist hardcodiert in `backend/services/library.py:25` und `backend/services/playlist_service.py:14`.

---

## 2. Systemarchitektur

### Gesamtübersicht (ASCII-Diagramm)

```
┌────────────────────────────────────────────────────────────────────┐
│                    INTERNET / RADIO-STREAMS                        │
│  WDR2  ANTENNE  R.S.A  FluxFM  SLAM  SwissPop  (weitere...)        │
└────────────────────┬───────────────────────────────────────────────┘
                     │ HTTP-Streams (MP3/AAC)
                     ▼
┌────────────────────────────────────────────────────────────────────┐
│                 RECORDING-LAYER (Server)                           │
│                                                                    │
│  streamripper-manager.sh  (Watchdog, alle 5 Min via Cron)          │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  streamripper WDR2 → /mnt/radio/inbox/WDR2/                │   │
│  │  streamripper ANTENNE → /mnt/radio/inbox/ANTENNE/           │   │
│  │  streamripper R.S.A → /mnt/radio/inbox/R.S.A/              │   │
│  │  ...                                                        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                    │
│  Datei-Filter im Manager (alle 5 Min):                             │
│    - Dauer < 120s → LÖSCHEN (Jingles/Werbung)                     │
│    - Kein " - " im Dateinamen → LÖSCHEN (unbekannte Inhalte)       │
│    - Sonst → /mnt/radio/music/{Station} - Musik/                  │
│    - ID3-Tags setzen via fix-id3-tags.py                           │
└────────────────────┬───────────────────────────────────────────────┘
                     │ MP3-Dateien
                     ▼
┌────────────────────────────────────────────────────────────────────┐
│              MUSIKBIBLIOTHEK  /mnt/radio/music/                    │
│                                                                    │
│  WDR2 - Musik/        ANTENNE - Musik/        R.S.A - Musik/      │
│  FluxFM - Musik/      SLAM - Musik/           SwissPop - Musik/   │
└────────────────────┬───────────────────────────────────────────────┘
                     │ Dateisystem-Scan (mutagen)
                     ▼
┌────────────────────────────────────────────────────────────────────┐
│           FASTAPI BACKEND  (Port 8000)                             │
│                                                                    │
│  main.py (Startup, CORS, Router-Registrierung)                     │
│                                                                    │
│  routers/          services/           models/                     │
│  ├── songs.py      ├── library.py      ├── song.py                 │
│  ├── clips.py      ├── clip_service.py └── __init__.py             │
│  ├── playlists.py  ├── playlist_service.py   (ClipSave,            │
│  ├── recording.py  └── recording_service.py   PlaylistAddRequest,  │
│  └── stations.py                              StationConfig)       │
│                                                                    │
│  utils/                                                            │
│  └── id3_helpers.py   (ID3-Tag Lesen/Schreiben via mutagen)       │
│                                                                    │
│  Persistenz: backend/data.json  (Favoriten + Ratings)              │
└────────────────────┬───────────────────────────────────────────────┘
                     │ HTTP/JSON (Port 8000)
                     ▼
┌────────────────────────────────────────────────────────────────────┐
│           REACT FRONTEND  (Port 5173 dev / statisch prod)          │
│                                                                    │
│  App.jsx (Globaler State, Keyboard-Shortcuts, Modal-Koordination)  │
│                                                                    │
│  components/              modals/                                  │
│  ├── AppHeader.jsx         ├── FilterModal.jsx                     │
│  ├── SongTable.jsx         ├── SortOrderModal.jsx                  │
│  ├── Player.jsx            ├── MetaEditModal.jsx                   │
│  ├── StarRating.jsx        ├── ConfirmModal.jsx                    │
│  └── NowPlayingBars.jsx    ├── PlaylistManager.jsx                 │
│                            ├── RecordingControlDialog.jsx          │
│                            └── StationEditModal.jsx                │
└────────────────────────────────────────────────────────────────────┘
                     │ Optional
                     ▼
┌────────────────────────────────────────────────────────────────────┐
│           JELLYFIN  (Docker, Port 8096)                            │
│  Liest /mnt/radio/music/ als Medienbibliothek                      │
└────────────────────────────────────────────────────────────────────┘
```

### Datenfluss: Song laden & abspielen

```
User klickt auf Zeile in SongTable
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
GET /api/stream/{id}  →  FileResponse(mp3-Datei)
     │
     ▼
WaveSurfer: Waveform rendern, automatisch abspielen
```

### Datenfluss: Clip speichern

```
C-Taste drücken → Clip-Modus aktivieren
[-Taste → clipStart = aktuelle Position
]-Taste → clipEnd = aktuelle Position
S-Taste → POST /api/clip/save
     │
     ▼
Backend: clip_service.apply_clip()
  1. ID3-Tags sichern (mutagen)
  2. ffmpeg -ss {start} -t {duration} -c copy → temp.mp3
  3. Optional: ffmpeg -af "afade=..." → temp_faded.mp3
  4. Original-Datei ersetzen (shutil.move)
  5. ID3-Tags wiederherstellen, Kommentar "saved" setzen
     │
     ▼
invalidate_cache()  →  nächster GET /api/songs lädt neu
```

---

## 3. Backend-Dokumentation

### 3.1 `main.py` – Einstiegspunkt

**Pfad:** `backend/main.py`  
**Zeilen:** 60

Startet die FastAPI-Anwendung, konfiguriert CORS und registriert alle Router.

```python
# Wichtige Konfiguration
app = FastAPI(
    title="Radio Library API",
    version="2.0.0"
)

# CORS: Alle Origins erlaubt (Development)
app.add_middleware(CORSMiddleware, allow_origins=["*"], ...)

# Registrierte Router:
app.include_router(songs_router)      # /api/songs/*
app.include_router(clips_router)      # /api/clip/*
app.include_router(playlists_router)  # /api/playlists/*
app.include_router(recording_router)  # /api/recording/*
app.include_router(stations_router)   # /api/stations/*
```

**Starten:**
```bash
cd /root/src/radio/backend
uvicorn main:app --host 0.0.0.0 --port 8000
# oder direkt:
python main.py
```

**Pitfall:** CORS ist auf `allow_origins=["*"]` gesetzt. Für Produktionsbetrieb sollte dies auf die tatsächliche Frontend-Domain eingeschränkt werden.

---

### 3.2 Models (`backend/models/`)

#### `models/song.py`

```
Song              – Vollständiges Song-Objekt (Backend → Frontend)
MetadataUpdate    – Optionale Felder für PATCH /api/songs/{id}
SongListResponse  – Paginierte Antwort für GET /api/songs
MetaResponse      – Filter-Metadaten (Genres, Jahre, Texte)
```

**`Song` – Datenstruktur:**

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| `id` | str | Relativer Pfad mit `\|` statt `/` z.B. `"WDR2 - Musik\|song.mp3"` |
| `path` | str | Absoluter Dateipfad `/mnt/radio/music/WDR2 - Musik/song.mp3` |
| `rel_path` | str | Pfad relativ zu `MUSIC_DIR` |
| `filename` | str | Dateiname mit Extension |
| `title` | str | ID3 TIT2-Tag |
| `artist` | str | ID3 TPE1-Tag |
| `album` | str | ID3 TALB-Tag (z.B. `"WDR2 - Musik"`) |
| `year` | str | ID3 TDRC-Tag |
| `genre` | str | ID3 TCON-Tag (enthält den Sendernamen) |
| `comment` | str | ID3 COMM-Tag (z.B. `"saved"`) |
| `track` | str | ID3 TRCK-Tag |
| `duration` | float | Länge in Sekunden |
| `community_rating` | float | Rating 0–10 (aus `data.json` oder POPM-Tag) |
| `favorite` | bool | Steht in `data.json` Favoriten-Liste |
| `created` | float | Unix-Timestamp der Datei-Erstellung |
| `modified` | float | Unix-Timestamp der letzten Änderung |

**`MetadataUpdate` – Alle Felder optional:**

```python
class MetadataUpdate(BaseModel):
    title: Optional[str] = None
    artist: Optional[str] = None
    album: Optional[str] = None
    year: Optional[str] = None
    genre: Optional[str] = None
    comment: Optional[str] = None
    track: Optional[str] = None
    community_rating: Optional[float] = Field(None, ge=0, le=10)
    favorite: Optional[bool] = None
```

#### `models/__init__.py`

```
ClipSave            – Parameter für POST /api/clip/save
PlaylistAddRequest  – Parameter für POST /api/playlists/{name}/add
StationConfig       – Konfiguration einer Radiostation
```

**`ClipSave`:**

| Feld | Typ | Default | Beschreibung |
|------|-----|---------|-------------|
| `song_id` | str | – | Song-ID (rel_path mit `\|`) |
| `start` | float | – | Clip-Start in Sekunden |
| `end` | float | – | Clip-Ende in Sekunden |
| `fade_in` | bool | `False` | Fade-In aktivieren |
| `fade_out` | bool | `False` | Fade-Out aktivieren |
| `fade_duration` | float | `3.0` | Fade-Dauer in Sekunden |

**`StationConfig`:**

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| `name` | str | Anzeigename (z.B. `"WDR2"`) |
| `url` | str | Stream-URL |
| `path` | str | Relativer Unterordner unter `MUSIC_DIR` (z.B. `"WDR2"`) |
| `default_enabled` | bool | Soll die Station standardmäßig aufnehmen? |

---

### 3.3 Services (`backend/services/`)

#### `services/library.py` – MP3-Bibliothek-Service

**Zweck:** Scannt das Dateisystem nach MP3s, liest ID3-Metadaten und verwaltet einen In-Memory-Cache.

**Wichtige Konstanten:**
```python
MUSIC_DIR = Path("/mnt/radio/music")       # Hardcodiert!
DATA_FILE = Path(__file__).parent.parent / "data.json"
```

---

##### `load_data() -> dict`

Lädt Favoriten und Ratings aus `data.json`.

- **Parameter:** keine
- **Rückgabe:** `{"favorites": list[str], "ratings": dict[str, float]}`
- **Fallback:** Leeres Dict bei fehlender/korrupter Datei

```python
data = load_data()
# Ergebnis: {"favorites": ["WDR2|song.mp3", ...], "ratings": {"WDR2|other.mp3": 7.0}}
```

---

##### `save_data(data: dict) -> None`

Speichert Favoriten und Ratings in `data.json`.

- **Parameter:** `data` – Dict mit Keys `favorites` und `ratings`
- **Rückgabe:** None (Fehler werden geloggt, nicht geworfen)

---

##### `scan_file(filepath: Path, data: dict) -> dict`

Scannt eine einzelne MP3-Datei und gibt ein Song-Dict zurück.

- **Parameter:**
  - `filepath` – Absoluter Pfad zur MP3
  - `data` – Aktueller Daten-Store (für Favoriten und Ratings)
- **Rückgabe:** Song-Dict mit allen Metadaten
- **Besonderheit:** Gespeichertes Rating aus `data.json` hat Vorrang vor POPM-ID3-Tag
- **Song-ID-Bildung:** `rel_path.replace("/", "|")` – z.B. `"WDR2 - Musik|song.mp3"`

**POPM-Rating-Konvertierung:**
```python
# POPM-Skala 0-255 → App-Skala 0-10
community_rating = round(rating_raw / 25.5, 1) if rating_raw > 0 else 0
```

---

##### `scan_library() -> list`

Scannt alle MP3-Dateien in `MUSIC_DIR` rekursiv.

- **Parameter:** keine
- **Rückgabe:** `list[dict]` – Alle Songs mit Metadaten
- **Pitfall:** Bei einer großen Bibliothek (>10.000 Songs) kann dieser Aufruf mehrere Sekunden dauern

---

##### `get_library() -> list`

Gibt die gecachte Library zurück. Scannt bei erstem Aufruf oder nach Invalidierung.

- **Parameter:** keine
- **Rückgabe:** `list[dict]` – Aus Cache oder frisch gescannt
- **Cache-Variable:** `_library_cache` (global, None = nicht geladen)

---

##### `invalidate_cache() -> None`

Invalidiert den Library-Cache. Wird nach jeder Schreiboperation aufgerufen.

- **Wann aufrufen:** Nach PATCH, DELETE, clip/save, rescan

---

##### `find_song(song_id: str) -> dict | None`

Sucht einen Song nach ID.

- **Parameter:** `song_id` – Song-ID (relativer Pfad mit `|`)
- **Rückgabe:** Song-Dict oder `None`

```python
song = find_song("WDR2 - Musik|Artist - Title.mp3")
```

---

#### `services/clip_service.py` – Audio-Schnitt-Service

**Zweck:** Schneidet MP3-Dateien via FFmpeg und stellt ID3-Tags wieder her.

**Abhängigkeit:** `ffmpeg` muss als System-Binary verfügbar sein.

---

##### `apply_clip(path, start, end, fade_in, fade_out, fade_duration) -> None`

Schneidet eine MP3-Datei und ersetzt sie mit dem Clip. **Achtung: Destruktiv! Das Original wird überschrieben.**

- **Parameter:**
  - `path: Path` – Absoluter Pfad zur MP3 (wird überschrieben)
  - `start: float` – Clip-Start in Sekunden
  - `end: float` – Clip-Ende in Sekunden
  - `fade_in: bool` – Fade-In aktivieren
  - `fade_out: bool` – Fade-Out aktivieren
  - `fade_duration: float` – Fade-Länge in Sekunden
- **Rückgabe:** `None`
- **Raises:** `RuntimeError` bei FFmpeg-Fehler

**Ablauf:**
1. ID3-Tags via mutagen sichern
2. `ffmpeg -ss {start} -t {duration} -c copy` → temporäre Datei
3. Optional: `ffmpeg -af "afade=t=in:... ,afade=t=out:..."` mit `libmp3lame -q:a 2`
4. `shutil.move(tmp, original)` – Original ersetzen
5. ID3-Tags wiederherstellen
6. Falls COMM-Kommentar leer: `"saved"` setzen

**Pitfall:** Wenn FFmpeg während des Trims einen Fehler wirft aber die temporäre Datei bereits existiert, wird sie gelöscht und `RuntimeError` weitergereicht. Das Original bleibt in diesem Fall unverändert.

---

#### `services/playlist_service.py` – Playlist-Service

**Zweck:** Verwaltet M3U8-Playlist-Dateien im Radio-Verzeichnis.

**Wichtige Konstanten:**
```python
RADIO_DIR = Path("/mnt/radio")       # Playlists liegen im Wurzelverzeichnis
MUSIC_DIR = Path("/mnt/radio/music") # Für relative Pfad-Berechnung
```

**Playlist-Format:** Standard M3U8, Songs als relative Pfade (relativ zu `MUSIC_DIR`):
```
#EXTM3U
WDR2 - Musik/Artist - Title.mp3
ANTENNE - Musik/Other Artist - Song.mp3
```

---

##### `create_playlist(name: str) -> dict`

Erstellt eine neue leere M3U8-Playlist.

- **Parameter:** `name` – Name ohne `.m3u8`-Extension
- **Rückgabe:** `{"name": str, "path": str}`
- **Raises:** `FileExistsError` wenn Playlist bereits existiert

---

##### `rename_playlist(old_name, new_name) -> dict`

Benennt eine Playlist um (Datei umbenennen).

- **Raises:** `FileNotFoundError` / `FileExistsError`

---

##### `delete_playlist(name: str) -> bool`

Löscht eine Playlist-Datei. Raises `FileNotFoundError`.

---

##### `get_playlists() -> list[dict]`

Findet alle `.m3u8`-Dateien in `RADIO_DIR`.

- **Rückgabe:** `list[{"name": str, "path": str}]`

---

##### `get_playlist_songs(name: str) -> list[str]`

Liest alle Song-Pfade aus einer Playlist.

- **Rückgabe:** `list[str]` – relative Pfade (Kommentarzeilen werden übersprungen)

---

##### `add_song_to_playlist(playlist_name, song_path) -> str`

Fügt einen Song zu einer Playlist hinzu.

- **Parameter:**
  - `playlist_name` – Name der Playlist
  - `song_path` – Absoluter oder relativer Pfad zum Song
- **Rückgabe:** `"added"` oder `"already_exists"` (Duplikat-Check via Stringsuche)
- **Pitfall:** Der Pfad wird relativ zu `MUSIC_DIR` gespeichert. Absolute Pfade außerhalb von `MUSIC_DIR` werden unverändert gespeichert.

---

##### `remove_song_from_playlist(playlist_name, song_path) -> bool`

Entfernt einen Song aus einer Playlist.

- **Rückgabe:** `True` wenn entfernt, `False` wenn nicht gefunden

---

#### `services/recording_service.py` – Streamripper-Service

**Zweck:** Verwaltet Streamripper-Prozesse, State-Dateien und Stationskonfiguration.

**Wichtige Konstanten:**
```python
RADIO_DIR        = Path("/mnt/radio")
INBOX_DIR        = Path("/mnt/radio/inbox")
STATE_DIR        = Path("/mnt/radio/state")       # Aktivierungs-State
MUSIC_DIR        = Path("/mnt/radio/music")
STATIONS_CONFIG  = Path("/mnt/radio/config/stations.json")
MANAGER_SCRIPT   = Path("/mnt/radio/scripts/streamripper-manager.sh")
```

**State-Mechanismus:** Eine Station ist aktiv, wenn die Datei `/mnt/radio/state/{name}.enabled` existiert.

---

##### `load_stations_config() -> list`

Lädt Stationskonfiguration aus `stations.json`. Gibt `DEFAULT_STATIONS` zurück wenn keine Datei vorhanden.

**Standard-Stationen (hardcodiert als Fallback):**

| Name | URL | Path | Default |
|------|-----|------|---------|
| WDR2 | wdr-wdr2-aachenundregion... | WDR2 | ja |
| ANTENNE | stream.antenne.de/antenne | ANTENNE | ja |
| R.S.A | stream.rsa-web.de/rsa/mp3-128 | R.S.A | ja |
| FluxFM | fluxfm.streamabc.net/flx-chillhop | FluxFM | ja |
| SLAM | stream.slam.nl/slam_mp3 | SLAM | ja |
| SwissPop | stream.srg-ssr.ch/m/rsp/mp3_128 | SwissPop | ja |
| Vintage Radio | vintageradio.ice.infomaniak.ch | VINTAGE | nein |
| Vintage Radio 80er | vintage80s.ice.infomaniak.ch | VINTAGE80 | nein |

**Pitfall:** Die URLs im Code können veraltet sein! Aktuelle URLs sind in `/root/src/radio/scripts-docs/stations.conf` dokumentiert.

---

##### `save_stations_config(stations: list) -> None`

Speichert Stationskonfiguration in `stations.json`. Erstellt das Verzeichnis falls nicht vorhanden.

---

##### `station_enabled(station: str) -> bool`

Prüft ob eine Station aktiv ist.

**Prüfreihenfolge:**
1. State-Datei `/mnt/radio/state/{station}.enabled` prüfen
2. Fallback: `default_enabled` aus `stations.json`

---

##### `set_station_enabled(station: str, enabled: bool) -> None`

Aktiviert/Deaktiviert eine Station durch State-Datei-Verwaltung.

---

##### `station_running(station: str) -> bool`

Prüft ob Streamripper für eine Station läuft.

**Prüfreihenfolge:**
1. PID-Datei `/tmp/streamripper-{station}.pid` lesen
2. `ps -p {pid}` prüfen
3. Fallback: `ps aux | grep "streamripper.*{station}"`

---

##### `start_station(station_name: str) -> dict`

Startet Streamripper für eine Station via `streamripper-manager.sh start {name}`.

- **Rückgabe:** `{"ok": True}` oder `{"ok": True, "message": "Already running"}`
- **Raises:** `RuntimeError` wenn Manager-Script nicht gefunden oder fehlschlägt

---

##### `stop_station(station_name: str) -> dict`

Stoppt Streamripper für eine Station.

**Stoppvorgehen:**
1. State-Datei löschen
2. PID-Datei lesen und `kill {pid}` 
3. Fallback: `pkill -f "streamripper.*{station_name}"`

---

##### `count_mp3(path, since_minutes=None, since_today=False) -> int`

Zählt MP3-Dateien in einem Verzeichnis, optional zeitgefiltert.

- **Parameter:**
  - `path` – Zu durchsuchendes Verzeichnis
  - `since_minutes` – Nur Dateien jünger als N Minuten
  - `since_today` – Nur Dateien vom heutigen Tag
- **Rückgabe:** Anzahl der Dateien (0 bei Fehler)

---

##### `get_recording_stats() -> dict`

Berechnet Recording-Statistiken **nur für aktive Stationen**.

- **Rückgabe:**
```python
{
    "total_music": int,
    "today_music": int,
    "last_30min_music": int,
    "stations": {
        "WDR2": {"total_music": int, "today_music": int, "last_30min_music": int, "last_activity": str},
        ...
    }
}
```

**Pfad-Konvention für Musikordner:**
```
station.path = "WDR2"
→ music_path = /mnt/radio/music/WDR2 - Musik
```
Enthält `path` bereits `" - Musik"`, wird es nicht doppelt angehängt.

---

### 3.4 Routers (`backend/routers/`)

#### `routers/songs.py` – Song-Endpunkte

**Alle Endpunkte:**

```
GET  /api/songs          → list_songs()
GET  /api/songs/meta     → get_meta()
GET  /api/songs/{id}     → get_song()
PATCH /api/songs/{id}    → update_song()
PATCH /api/songs/{id}/favorite → toggle_favorite()
DELETE /api/songs/{id}   → delete_song()
GET  /api/stream/{id}    → stream_song()
POST /api/rescan         → rescan()
```

##### `list_songs()` – Filter-Logik

Filter werden **in-memory** auf dem Library-Cache angewendet:

```python
# Volltext-Filter prüft: filename, title, artist, album
if search:
    s = search.lower()
    filtered = [song for song in filtered if
        s in song["filename"].lower() or
        s in song["title"].lower() or
        s in song["artist"].lower() or
        s in song["album"].lower()
    ]

# Genre-Filter (komma-separiert, jedes Genre wird einzeln geprüft)
if genre:
    genres = [g.strip().lower() for g in genre.split(",")]
    filtered = [s for s in filtered if any(g in s["genre"].lower() for g in genres)]

# Jahr-Filter (Jahr muss mit dem Suchstring beginnen)
if year:
    years = [y.strip() for y in year.split(",")]
    filtered = [s for s in filtered if any(s["year"].startswith(y) for y in years)]
```

**Sortierfelder:** `filename`, `created`, `modified`, `community_rating`, `title`, `artist`, `album`, `genre`, `duration`

##### `update_song()` – Metadaten-Update

Schreibt Metadaten in zwei Stores:
1. ID3-Tags via `utils.id3_helpers.write_tags()` (Title, Artist, Album, Year, Genre, Comment, Track)
2. Rating + Favoriten in `backend/data.json`

**Pitfall:** Nach einem Update wird `invalidate_cache()` aufgerufen. Der nächste `GET /api/songs`-Request triggert einen vollständigen Rescan, was bei großer Bibliothek spürbar ist.

##### `stream_song()` – MP3-Streaming

Gibt die Datei als `FileResponse` zurück mit:
```python
headers={"Accept-Ranges": "bytes", "Cache-Control": "no-cache"}
```
**Pitfall:** WaveSurfer.js benötigt Range-Request-Support für Seeking. Der `Accept-Ranges: bytes` Header wird gesetzt, FastAPI's `FileResponse` unterstützt Range Requests jedoch nur teilweise. Bei Problemen mit Seeking kann Nginx als Reverse-Proxy helfen.

---

#### `routers/clips.py` – Clip-Endpunkte

```
POST /api/clip/save → save_clip(clip: ClipSave)
```

Delegiert an `clip_service.apply_clip()`. Invalidiert den Cache nach erfolgreichem Clip.

---

#### `routers/playlists.py` – Playlist-Endpunkte

```
GET    /api/playlists                → list_playlists()
POST   /api/playlists                → create_playlist_endpoint()
GET    /api/playlists/{name}/songs   → list_playlist_songs()
POST   /api/playlists/{name}/add     → add_to_playlist()
DELETE /api/playlists/{name}/songs   → remove_from_playlist()
PUT    /api/playlists/{name}/rename  → rename_playlist_endpoint()
DELETE /api/playlists/{name}         → delete_playlist_endpoint()
```

`list_playlists()` ergänzt die Playlist-Liste um die Song-Anzahl (`count`). Dies erfordert das Einlesen jeder Playlist-Datei.

`list_playlist_songs()` versucht Metadaten aus dem Library-Cache zu laden und gibt für nicht gefundene Songs ein minimales Objekt zurück.

---

#### `routers/recording.py` – Recording-Endpunkte

```
GET  /api/recording/stations        → get_recording_stations()
POST /api/recording/{station}/start → start_recording()
POST /api/recording/{station}/stop  → stop_recording()
POST /api/recording/{station}/restart → restart_recording()
GET  /api/recording/stats           → recording_stats()
```

`get_recording_stations()` erstellt beim ersten Aufruf automatisch State-Dateien für Stationen mit `default_enabled: True`.

---

#### `routers/stations.py` – Stations-Konfiguration

```
GET    /api/stations           → get_stations()
POST   /api/stations           → save_stations()          # ÜBERSCHREIBT ALLES
POST   /api/stations/add       → add_station()
PUT    /api/stations/{name}    → update_station()
DELETE /api/stations/{name}    → delete_station()
```

**Pitfall:** `POST /api/stations` überschreibt die gesamte Stations-Liste! Diese Route ist für Bulk-Updates gedacht.

---

### 3.5 Utils (`backend/utils/`)

#### `utils/id3_helpers.py` – ID3-Hilfsfunktionen

Abstrahiert die mutagen-Bibliothek.

##### `get_id3_text(tag, key: str) -> str`

Liest einen Text-Wert aus einem ID3-Tag sicher aus.

- **Parameter:** `tag` – mutagen ID3-Objekt, `key` – Frame-Schlüssel z.B. `"TIT2"`
- **Rückgabe:** String oder leer bei Fehler/nicht vorhanden

##### `get_comment(tag) -> str`

Liest den ersten COMM-Kommentar. Iteriert über alle Keys die mit `"COMM"` beginnen.

##### `get_rating(tag) -> int`

Liest den POPM-Rating-Wert (0–255). Iteriert über alle Keys die mit `"POPM"` beginnen.

##### `write_tags(path: str, update: dict) -> None`

Schreibt ID3-Tags in eine MP3-Datei. Nur Felder die nicht `None` sind werden geschrieben.

**Unterstützte Keys:** `title` (TIT2), `artist` (TPE1), `album` (TALB), `year` (TDRC), `genre` (TCON), `comment` (COMM::eng mit `lang="eng"`), `track` (TRCK)

```python
# Beispiel
write_tags("/mnt/radio/music/WDR2 - Musik/song.mp3", {
    "title": "Bohemian Rhapsody",
    "artist": "Queen",
    "genre": "WDR2",
    "comment": "saved"
})
```

---

### 3.6 `backend/data.json` – Persistenz-Datei

Speichert Favoriten und Community-Ratings, die nicht in den ID3-Tags der MP3s stehen.

```json
{
    "favorites": [
        "ANTENNE - Musik|Artist - Song.mp3",
        "R.S.A - Musik|Other Artist - Other Song.mp3"
    ],
    "ratings": {
        "ANTENNE - Musik|Artist - Song.mp3": 7.0,
        "R.S.A - Musik|Other Artist - Other Song.mp3": 5.0
    }
}
```

**Pitfall:** IDs bestehen aus dem relativen Pfad relativ zu `MUSIC_DIR` mit `|` statt `/`. Wird eine Datei umbenannt oder verschoben, verliert sie ihre Ratings und Favoriten-Zuordnung. Die ID-Keys sind UTF-8, Umlaute müssen korrekt gespeichert werden.

---

## 4. Frontend-Dokumentation

### 4.1 `main.jsx` – React-Entry

Rendert `<App />` in `#root`. Standard Vite-Boilerplate.

### 4.2 `App.jsx` – Haupt-Komponente

**Pfad:** `frontend/src/App.jsx`  
**Zeilen:** 430

Zentrales State-Management und Koordination aller Sub-Komponenten.

**State-Übersicht:**

| State | Typ | Beschreibung |
|-------|-----|-------------|
| `songs` | `array` | Aktuelle Song-Seite |
| `total` | `number` | Gesamtanzahl gefiltert |
| `page` | `number` | Aktuelle Seite (1-basiert) |
| `perPage` | `number` | 100 (fest) |
| `idx` | `number` | Index des aktiven Songs in `songs[]` |
| `loading` | `bool` | Ladeindikator |
| `isPlaying` | `bool` | Wird aktuell abgespielt? |
| `meta` | `object` | `{genres, years, texts}` für FilterModal |
| `filters` | `object` | Aktive Filter |
| `sortBy` | `string` | Sortierfeld (Standard: `"created"`) |
| `sortDir` | `string` | `"asc"` oder `"desc"` (Standard: `"desc"`) |
| `playlists` | `array` | Alle Playlists |
| `showFilter` | `bool` | FilterModal sichtbar? |
| `showSort` | `bool` | SortOrderModal sichtbar? |
| `showRecording` | `bool` | RecordingControlDialog sichtbar? |
| `showPlaylistManager` | `bool` | PlaylistManager sichtbar? |
| `editingSong` | `object\|null` | Song im MetaEditModal |
| `deleteConfirmSong` | `object\|null` | Song in ConfirmModal |

**Keyboard-Shortcuts (global in `App.jsx`):**

| Taste | Funktion |
|-------|---------|
| Space / Enter | `window._playerPlayPause?.()` |
| ↓ | `handleNext()` |
| ↑ | `handlePrev()` |
| → | `window._playerSeek?.(10)` |
| ← | `window._playerSeek?.(-10)` |
| `,` | `window._playerSeek?.(-10)` |
| `.` | `window._playerSeek?.(10)` |
| `F` | `setShowFilter(true)` |
| `M` | `setEditingSong(currentSong)` |
| `C` | `window._playerClipMode?.()` |
| `O` | `setShowSort(true)` |
| `Delete` | `setDeleteConfirmSong(currentSong)` |
| `A` | Song zu Playlist 1 hinzufügen |
| `B` | Song zu Playlist 2 hinzufügen |
| `P` | `setShowPlaylistManager(true)` |
| `1`–`9` | Numerisches Rating setzen |

**Pitfall:** Shortcuts werden nicht ausgelöst wenn der Fokus auf einem Input-Element (`input`, `textarea`, `select`) liegt.

**Seitennavigation:** Beim Erreichen des letzten Songs einer Seite wird automatisch die nächste Seite geladen (`handleNext`). Entsprechend beim ersten Song und `handlePrev`.

---

### 4.3 `api.js` – API-Client

**Pfad:** `frontend/src/api.js`

Alle HTTP-Aufrufe laufen über eine zentrale Axios-Instanz.

**Basis-URL:**
```javascript
const getBaseUrl = () => {
    // Nimmt den gleichen Hostnamen wie das Frontend, Port 8000
    return `${window.location.protocol}//${window.location.hostname}:8000`;
};
```

**Pitfall:** Das Backend wird immer auf Port 8000 erwartet. Wird ein anderer Port verwendet, muss `api.js:10` geändert werden (Fallback für Server-Side: `http://192.168.0.197:8000` – diese IP muss angepasst werden!).

**Alle exportierten Funktionen:**

```javascript
// Songs
fetchSongs(params)               // GET /api/songs
fetchMeta()                      // GET /api/songs/meta
fetchSong(id)                    // GET /api/songs/{id}
updateSong(id, data)             // PATCH /api/songs/{id}
toggleFavorite(id, favorite)     // PATCH /api/songs/{id}/favorite
deleteSong(id)                   // DELETE /api/songs/{id}
saveClip(data)                   // POST /api/clip/save
rescan()                         // POST /api/rescan
streamUrl(id)                    // URL-String für Stream

// Recording
getRecordingStations()           // GET /api/recording/stations
startRecording(station)          // POST /api/recording/{station}/start
stopRecording(station)           // POST /api/recording/{station}/stop
restartRecording(station)        // POST /api/recording/{station}/restart
getRecordingStats()              // GET /api/recording/stats

// Playlists
getPlaylists()                   // GET /api/playlists
createPlaylist(name)             // POST /api/playlists
renamePlaylist(name, new_name)   // PUT /api/playlists/{name}/rename
deletePlaylist(name)             // DELETE /api/playlists/{name}
getPlaylistSongs(name)           // GET /api/playlists/{name}/songs
addToPlaylist(name, songId)      // POST /api/playlists/{name}/add
removeFromPlaylist(name, songId) // DELETE /api/playlists/{name}/songs

// Stations
getStationsConfig()              // GET /api/stations
saveStationsConfig(stations)     // POST /api/stations
addStation(station)              // POST /api/stations/add
updateStation(oldName, station)  // PUT /api/stations/{oldName}
deleteStation(name)              // DELETE /api/stations/{name}
```

---

### 4.4 `utils.js` – Hilfsfunktionen

##### `fmtTime(sec: number) -> string`
Formatiert Sekunden als `"M:SS"`. z.B. `fmtTime(225)` → `"3:45"`.

##### `fmtDateTime(ts: number) -> string`
Formatiert Unix-Timestamp als lokalen Datums-/Zeitstring.

##### `STAR_VALUES: number[]`
Rating-Mapping: `[1, 3, 5, 7, 9]` – Index 0 = 1 Stern (Rating 1), Index 4 = 5 Sterne (Rating 9).

##### `starsFromRating(rating: number) -> number`
Konvertiert einen Rating-Wert (0–10) in Stern-Anzahl (0–5).

```javascript
starsFromRating(0)  // → 0
starsFromRating(3)  // → 2
starsFromRating(7)  // → 4
starsFromRating(9)  // → 5
```

---

### 4.5 Komponenten (`frontend/src/components/`)

#### `AppHeader.jsx`

Obere Navigationsleiste mit Aktions-Buttons.

**Props:**
```
total: number       – Gesamtanzahl Songs
page: number        – Aktuelle Seite
totalPages: number  – Gesamtanzahl Seiten
hasFilters: bool    – Sind Filter aktiv? (zeigt Punkt-Indikator)
onFilter: fn        – Filter-Modal öffnen
onSort: fn          – Sortier-Modal öffnen
onRecording: fn     – Recording-Dialog öffnen
onPlaylists: fn     – Playlist-Manager öffnen
```

**Buttons:**
- 🔍 Filter (zeigt Punkt wenn aktiv)
- ↕ Sortierung
- 🔄 Library neu laden (ruft `POST /api/rescan`)
- ⚙ Recording-Steuerung
- 📋 Playlist Manager
- 🇬🇧/🇩🇪 Sprache wechseln
- ? Keyboard-Shortcuts anzeigen

**Internes `HelpOverlay`:** Zeigt alle Keyboard-Shortcuts in einer Overlay-Box.

---

#### `SongTable.jsx`

Tabellen-Ansicht der Song-Liste mit Paginierung.

**Props:**
```
songs: array        – Aktuelle Song-Seite
idx: number         – Index des aktiven Songs
isPlaying: bool     – Wird abgespielt?
page, perPage, totalPages, total: number
loading: bool
onSelectSong(i): fn – Song auswählen
onFavorite(song): fn
onRating(song, val): fn
onEditMeta(song): fn
onAddToPlaylist(song): fn
onPageChange(p): fn
```

**Tabellenspalten:** # · Titel/Artist · ♥ · Länge · Rating (Sterne) · Genre · 📋 · Kommentar · ✏️

**Zeilennummer:** Wird durch `NowPlayingBars` ersetzt wenn der Song aktiv und `isPlaying=true` ist.

**Globale Zeilennummer:** `(page - 1) * perPage + i + 1` (seiten-übergreifend korrekt).

---

#### `Player.jsx`

Audio-Player mit WaveSurfer-Waveform, Clip-Modus und vollständiger Playback-Steuerung.

**Props:**
```
song: object            – Aktueller Song
playlists: array        – Für Playlist-Shortcuts A/B
isPlaying: bool
setIsPlaying: fn
onPrev, onNext: fn
onFavoriteToggle(song): fn
onEditMeta(song): fn
onDeleteSong(song): fn
onRatingChange(val): fn
onOpenPlaylist: fn
```

**WaveSurfer-Konfiguration:**
```javascript
WaveSurfer.create({
    waveColor: '#2a2f55',
    progressColor: '#7c8cf8',
    height: 72,
    normalize: true,
    barWidth: 2,
    barGap: 1,
    barRadius: 2,
    scrollParent: true,
    minPxPerSec: 10,
})
```

**Globale Window-Funktionen** (für App.jsx Shortcuts):
```javascript
window._playerPlayPause   // Play/Pause umschalten
window._playerSeek        // Sekunden vorwärts/rückwärts
window._playerPrev        // Vorheriger Song
window._playerNext        // Nächster Song
window._playerClipMode    // Clip-Modus aktivieren
window._playerCancelClip  // Clip-Modus abbrechen
window._playerEditMeta    // Metadaten-Dialog öffnen
```

**Clip-Modus Keyboard-Shortcuts (nur wenn Clip-Modus aktiv):**

| Taste | Funktion |
|-------|---------|
| `[` | `clipStart = getCurrentTime()` |
| `]` | `clipEnd = getCurrentTime()` |
| `S` | `handleSaveClip()` |
| `L` | `fadeIn` umschalten |
| `R` | `fadeOut` umschalten |
| `M` | MetaEditModal öffnen |
| `Escape` | Clip-Modus abbrechen |
| `Delete` | Song-Lösch-Dialog öffnen |
| `A/B` | Song zu Playlist 1/2 hinzufügen |
| `1`–`9` | Rating setzen |

**Clip-Overlay:** Visualisiert Start/Ende-Punkte und Fade-Bereiche als farbige Overlays auf der Waveform (absolute Positionierung).

**Race-Condition-Schutz:** `mounted`-Flag verhindert State-Updates nach Komponenten-Unmount.

---

#### `StarRating.jsx`

Klickbare 5-Sterne-Bewertungskomponente.

**Props:** `rating: number`, `onChange: fn`, `size: number (default 14)`

**Mapping:** 1 Stern = Rating 1, 2 Sterne = 3, 3 Sterne = 5, 4 Sterne = 7, 5 Sterne = 9.

**Besonderheit:** Klick auf 5. Stern wenn bereits alle 5 Sterne aktiv → `onChange(0)` (Rating entfernen).

---

#### `NowPlayingBars.jsx`

Animierte Balken-Anzeige für den aktiven Song. Drei `<span class="bar">` Elemente, Animation via `App.css`.

---

### 4.6 Modals (`frontend/src/modals/`)

#### `FilterModal.jsx`

**Props:** `meta`, `filters`, `onApply(newFilters)`, `onClose`

**Filter-Optionen:**
- Volltext-Suche (Titel, Artist, Album, Dateiname)
- Nur Favoriten (Checkbox)
- Mindest-Rating (Zahleneingabe 0–10)
- Jahr (Multi-Checkbox aus `meta.years`)
- Genre (Multi-Checkbox aus `meta.genres`)
- Kommentar-Suche (Texteingabe + Multi-Checkbox aus `meta.texts`)

**Zurücksetzen-Button** setzt alle Filter auf `{}` zurück.

---

#### `SortOrderModal.jsx`

**Props:** `sortBy`, `sortDir`, `onApply(sortBy, sortDir)`, `onClose`

**Sortierfelder:** `filename`, `created`, `modified`, `community_rating`, `title`, `artist`, `album`, `genre`, `duration`

---

#### `MetaEditModal.jsx`

**Props:** `song`, `onSave(updatedSong)`, `onClose`

Formular mit Feldern: Titel, Artist, Album, Jahr, Genre, Kommentar (Textarea), Track#, Community Rating.

Zeigt Erstellungsdatum (read-only) und Dateipfad an. Speichert via `PATCH /api/songs/{id}`.

---

#### `ConfirmModal.jsx`

**Props:** `message`, `onConfirm`, `onClose`

Generischer Bestätigungs-Dialog mit "Abbrechen" und "Löschen"-Button.

---

#### `PlaylistManager.jsx`

**Props:** `open`, `onClose`, `currentSong`, `onPlaylistsChanged`

Zweispalten-Layout: Links Playlist-Liste, rechts Songs der gewählten Playlist.

**Funktionen:**
- Neue Playlist erstellen (Enter zum Bestätigen)
- Playlist umbenennen (Inline-Edit)
- Playlist löschen (`window.confirm` Dialog)
- Song zur Playlist hinzufügen (☕-Button oder `currentSong`)
- Song aus Playlist entfernen

---

#### `RecordingControlDialog.jsx`

**Props:** `onClose`, `onEditStation(station)`

Lädt beim Öffnen parallel `getRecordingStations()` und `getRecordingStats()`.

**Layout:**
1. Kompakte Statistik-Box (Gesamt / Heute / Letzte 30 Min)
2. Tabelle aller Stationen mit Status, Aktionen (Start/Stop/Restart/Bearbeiten)
3. Pro-Station-Statistik
4. Details-Panel (erscheint bei Klick auf Station)

---

#### `StationEditModal.jsx`

**Props:** `open`, `onClose`, `station` (null = neu), `onSave`, `onDelete`

Formular mit Feldern: Name, Stream-URL, Pfad (relativer Ordner), Standard aktiviert (Checkbox).

Zweistufiges Löschen: Erst "Löschen"-Button → zeigt Bestätigung → "Ja, löschen".

---

### 4.7 i18n (`frontend/src/i18n/`)

- `de.json` – Deutsche Übersetzungen
- `en.json` – Englische Übersetzungen
- `LanguageContext.jsx` – React Context für Sprachumschaltung

Sprachauswahl via 🇬🇧/🇩🇪 Flags im AppHeader. Standard: `"de"`.

---

## 5. Radio-Recording Pipeline

### 5.1 Überblick: Vom Stream zur Musikbibliothek

```
Internet-Radiostream
        │
        ▼
streamripper (Pro Station 1 Prozess)
  - Automatische Song-Erkennung via ICY-Metadaten
  - Splittete bei Titel-Wechsel
  - Ablage: /mnt/radio/inbox/{Station}/Artist - Title.mp3
        │
        ▼ (alle 5 Min via Manager-Loop)
streamripper-manager.sh (Datei-Verarbeitungsloop)
  Prüfungen:
    - Datei älter als 2 Min? (verhindert aktive Streams zu verarbeiten)
    - Dauer < 120 Sekunden? → LÖSCHEN (Jingles/Werbung)
    - Kein " - " im Dateinamen? → LÖSCHEN (nicht erkannte Inhalte)
        │
        ▼ (nur wenn alle Checks bestanden)
fix-id3-tags.py
  - Genre = Sendername setzen
  - Artist/Title aus Dateinamen extrahieren falls ID3 leer
  - Album = "{Sendername} - Musik"
        │
        ▼
Verschieben nach /mnt/radio/music/{Station} - Musik/
  - Duplikat-Handling: (1), (2), (3) Suffix bei Namenskonflikt
        │
        ▼
Bibliothek verfügbar für Backend
  - Backend scannt beim nächsten Request via get_library()
  - Oder manuell via POST /api/rescan
```

### 5.2 Streamripper-Kommandozeilenaufruf

```bash
nohup streamripper "$url" -s -d "$inbox_dir" --quiet \
    > "$logdir/${sender}_streamripper.log" 2>&1 &

# Parameter:
# -s    : Nicht-Musik-Segmente in separatem Ordner (incomplete/)
# -d    : Ausgabeverzeichnis
# --quiet : Minimale Ausgabe
```

**Streamripper schreibt Dateien direkt als:**
```
Artist - Title.mp3
```
basierend auf den ICY-Metadaten des Streams (StreamTitle-Header).

### 5.3 `scripts-docs/streamripper-manager.sh` – Haupt-Manager

**Pfad:** `/mnt/radio/scripts/streamripper-manager.sh` (Produktions-Symlink/Copy)

**Drei Betriebsmodi:**

```bash
# Sender starten (von Backend API aufgerufen)
streamripper-manager.sh start WDR2

# Sender stoppen (von Backend API aufgerufen)
streamripper-manager.sh stop WDR2

# Manager-Loop starten (via Cron)
streamripper-manager.sh manager
```

**`start_sender()`:**
1. URL aus `stations.json` laden (Python-Einzeiler)
2. State-Datei erstellen (`/mnt/radio/state/{sender}.enabled`)
3. Inbox-Verzeichnis erstellen
4. PID-Datei prüfen – falls Prozess noch läuft: Return
5. `nohup streamripper ... &` starten
6. PID in `/tmp/streamripper-{sender}.pid` speichern

**`stop_sender()`:**
1. State-Datei löschen
2. PID-Datei lesen, `kill {pid}`
3. Fallback: `pkill -f "streamripper.*{sender}"`

**`run_manager()` – Manager-Loop:**
1. Alle Sender aus `stations.json` laden
2. Für jeden aktivierten Sender: Läuft Streamripper? Falls nicht → neu starten
3. Fertige Dateien verarbeiten (Dauer-Check, Musik-Filter, Verschieben, ID3-Tagging)
4. `sleep 300` (5 Minuten)

**Musik-Filter im Manager:**
```bash
# Dauer-Prüfung via ffprobe
duration=$(ffprobe -v quiet -show_entries format=duration -of csv=p=0 "$f" | cut -d. -f1)
if [ "$duration" -lt 120 ]; then
    rm -f "$f"  # Zu kurz = Jingle/Werbung
    continue
fi

# Dateiname muss " - " enthalten (Artist - Title Format)
if ! echo "$filename" | grep -q " - "; then
    rm -f "$f"  # Kein Standard-Format
    continue
fi
```

**Duplikat-Handling:**
```bash
target="$music_dir/$filename"
counter=1
while [ -f "$target" ]; do
    base="${filename%.mp3}"
    target="$music_dir/${base} ($counter).mp3"
    counter=$((counter + 1))
done
mv "$f" "$target"
```

### 5.4 `scripts-docs/fix-id3-tags.py` – ID3-Tag-Setter

**Aufruf:**
```bash
python3 fix-id3-tags.py <datei.mp3> <sender_name>
```

**Was es tut:**
1. Genre setzen: immer `TCON = sender_name`
2. Album setzen: immer `TALB = "{sender_name} - Musik"`
3. Artist/Title prüfen: Wenn leer, "unknown" oder Sendername enthält → aus Dateinamen extrahieren

**Dateiname-Parsing:**
```python
# Format: "Artist - Title.mp3" oder "Artist - Title_20260524_000000.mp3"
match = re.match(r'^(.+?)\s+-\s+(.+?)(_\d+)?\.mp3$', basename)
if match:
    new_artist = match.group(1).strip()
    new_title = match.group(2).strip()
```

**Pitfall:** Das Script nutzt `mutagen.mp3.MP3` und überschreibt immer Genre und Album. Manuelle Änderungen dieser Felder werden beim nächsten Durchlauf des Managers überschrieben, wenn die Datei noch in der Inbox liegt.

### 5.5 `scripts-docs/process-inbox.sh` – Inbox-Verarbeitung

Älteres Script für manuelle Inbox-Verarbeitung (wurde vom Manager-Loop abgelöst).

```bash
# Aufruf
./process-inbox.sh [Sender-Name]  # ohne Parameter = alle Sender

# Pfade
INBOX="/mnt/radio/inbox"
MUSIC="/mnt/radio/music"
SCRIPT="/mnt/radio/scripts/fix-id3-tags.py"
```

Findet MP3s in `{INBOX}/{Sender}/` (nur maxdepth 1, nicht in `incomplete/`), ruft `fix-id3-tags.py` auf und verschiebt ins Music-Verzeichnis.

### 5.6 `scripts-docs/process-recordings.sh` – ffmpeg-basierte Verarbeitung

Alternatives Script das ffmpeg-Metadaten aus Log-Dateien liest:

1. Prüft ob ffmpeg für die Datei noch läuft (Größen-Vergleich über 1 Sekunde)
2. Überspringt Dateien < 1MB
3. Liest `StreamTitle` aus Log-Datei
4. Filtert Non-Musik-Einträge (Regex für Kontakt, Werbung, etc.)
5. Setzt Tags via ffmpeg: `ffmpeg -c copy -metadata artist="..." -metadata title="..."`
6. Verschiebt in `MUSIC/{sender} - Musik/`

---

## 6. Cronjob-Konfiguration & Scripts

### 6.1 Empfohlene Crontab-Konfiguration

```crontab
# Radio Recording Manager – Watchdog (alle 5 Minuten)
*/5 * * * * /mnt/radio/scripts/streamripper-manager.sh manager >> /mnt/radio/logs/manager.log 2>&1

# Pipeline-Check – Tägliche Statusprüfung
0 8 * * * /mnt/radio/scripts/check-pipeline.sh >> /mnt/radio/logs/pipeline-check.log 2>&1

# Optional: Jelyfin-Scan nach Mitternacht
30 0 * * * curl -s http://localhost:8096/Library/Refresh > /dev/null 2>&1
```

### 6.2 `scripts-docs/check-pipeline.sh` – Pipeline-Statuscheck

```bash
./check-pipeline.sh [Minuten]  # Default: letzte 30 Minuten
```

**Prüft in Reihenfolge:**
1. FFmpeg-Prozesse (erwartet 7 Sender)
2. Neue MP3-Dateien in `music/` der letzten N Minuten
3. Inbox-Status (wieviele Dateien warten)
4. ID3-Tags (Stichprobe pro Sender via Python/mutagen)
5. Jellyfin Docker-Status
6. Cronjob-Status (System-Cron + Hermes)

**Ausgabe-Beispiel:**
```
[1] FFMPEG AUFNAHMEN
✅ 7 ffmpeg-Prozesse laufen (alle 7 Sender)

[2] DATEIEN IN MUSIC (letzte 30 Min)
✅ WDR2 - Musik: 3 neue Dateien
✅ ANTENNE - Musik: 2 neue Dateien

[3] INBOX STATUS
✅ Inbox ist leer (alles verarbeitet)

[4] ID3-TAG PRÜFUNG
✅ WDR2 - Musik: "Bohemian Rhapsod..." | Genre: WDR2

[5] JELLYFIN STATUS
✅ Jellyfin: Up 2 days
```

### 6.3 `scripts-docs/ensure-recordings.sh` – Älterer ffmpeg-Recorder

Startet Streams direkt mit ffmpeg (ohne Song-Splitting). Liest URLs aus `/mnt/radio/radiorecorder/stations.txt`. **Wird nicht mehr empfohlen** – `streamripper-manager.sh` ist besser.

```bash
# Starte alle fehlenden ffmpeg-Prozesse
./ensure-recordings.sh

# URLs werden aus stations.txt gelesen (1 URL pro Zeile)
```

### 6.4 `scripts-docs/start-all.sh` – Manueller ffmpeg-Start

Stoppt alle ffmpeg-Prozesse und startet alle 7 Sender neu. Nützlich nach Systemstart.

```bash
./start-all.sh
```

Beinhaltet automatische Wachstumsprüfung (Dateigröße nach 5+3 Sekunden vergleichen).

**Bekannte Sender-URLs:**

```
SWR3     → https://liveradio.swr.de/sw282p3/swr3/play.mp3
WDR2     → https://wdr-wdr2-rheinruhr.icecastssl.wdr.de/wdr/wdr2/rheinruhr/mp3/128/stream.mp3
ANTENNE  → https://stream.antenne.de/nur-die-musik/stream/mp3
R.S.A    → https://streams.rsa-sachsen.de/mix-nonstop/mp3-192/streams.rsa-sachsen.de/
FluxFM   → https://streams.fluxfm.de/indiedisco/mp3-320/streams.fluxfm.de/
SLAM     → https://streaming.slam.nl/web10_mp3
SwissPop → https://stream.srg-ssr.ch/srgssr/rsp/mp3/128
```

### 6.5 Weitere Scripts im `scripts-docs/` Verzeichnis

| Script | Zweck | Status |
|--------|-------|--------|
| `radio-recorder-v2.sh` | ffmpeg-basierter Recorder v2 | Experimentell |
| `radio-restarter.sh` | Einfacher Prozess-Restarter | Veraltet |
| `radio-restarter-v2.sh` | Verbesserter Restarter | Veraltet |
| `radio-monitor.sh` | Monitoring-Script | Hilfreich |
| `radio-smart-recorder.py` | Python-Recorder mit Song-Erkennung | Experimentell |
| `radio-song-recorder.py` | Python Song-Recorder | Experimentell |
| `radio-song-recorder-final.py` | Python Song-Recorder (final) | Experimentell |
| `radio-professional.py` | Professioneller Recorder | Experimentell |
| `radio-robust-splitter.py` | Robuster Splitter | Experimentell |
| `professional-splitter.py` | Song-Splitter via Stille-Erkennung | Experimentell |
| `split-songs.py` | Song-Splitter | Experimentell |
| `split-songs-v2.py` | Song-Splitter v2 | Experimentell |
| `split-segments.py` | Segment-Splitter | Experimentell |
| `beets-enricher.py` | MusicBrainz-Tagging via beets | Optional |
| `tag-from-logs.py` | Tags aus Log-Dateien setzen | Hilfreich |
| `simple-process.py` | Einfaches Processing-Script | Veraltet |
| `supervisor.sh` | Prozess-Supervisor | Veraltet |
| `radio-supervisor.sh` | Radio-spezifischer Supervisor | Veraltet |
| `launcher.sh` | Starter-Script | Veraltet |
| `robust-recordings.sh` | Robuste Aufnahme | Veraltet |
| `selbsttest*.sh` | Selbsttests | Debugging |

**Empfehlung für Produktion:** Nur `streamripper-manager.sh` und `fix-id3-tags.py` für die Recording-Pipeline verwenden.

---

## 7. Installation & Setup

### 7.1 Systemvoraussetzungen

```bash
# Betriebssystem: Linux (Ubuntu 22.04+ empfohlen)
# Minimum: 2GB RAM, 2 CPU-Kerne, 100GB+ Speicher

# System-Pakete installieren
apt-get update && apt-get install -y \
    python3 python3-pip python3-venv \
    ffmpeg \
    streamripper \
    nodejs npm \
    git \
    curl
```

### 7.2 Verzeichnisstruktur anlegen

```bash
# Mountpunkt erstellen (NFS, lokale HDD, etc.)
mkdir -p /mnt/radio

# Verzeichnisstruktur anlegen
mkdir -p /mnt/radio/{inbox,music,config,state,logs,scripts}

# Berechtigungen setzen
chmod 777 /mnt/radio/inbox
chmod 755 /mnt/radio/{music,config,state,logs,scripts}
```

### 7.3 Projekt klonen

```bash
cd /root/src
git clone <repository-url> radio
cd radio
```

### 7.4 Backend einrichten

```bash
cd /root/src/radio/backend

# Virtual Environment erstellen
python3 -m venv venv
source venv/bin/activate

# Abhängigkeiten installieren
pip install fastapi uvicorn mutagen pydantic

# Leere data.json erstellen
echo '{"favorites": [], "ratings": {}}' > data.json
```

**Backend starten:**
```bash
cd /root/src/radio/backend
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**Als Systemd-Service:**
```ini
# /etc/systemd/system/radio-backend.service
[Unit]
Description=Radio Library Backend
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/src/radio/backend
Environment=PATH=/root/src/radio/backend/venv/bin
ExecStart=/root/src/radio/backend/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable radio-backend
systemctl start radio-backend
```

### 7.5 Frontend einrichten

```bash
cd /root/src/radio/frontend

# Abhängigkeiten installieren
npm install

# Entwicklungsserver starten
npm run dev

# Oder Production-Build erstellen
npm run build
# Statische Dateien liegen dann in frontend/dist/
```

**Frontend als Nginx-Static:**
```nginx
server {
    listen 80;
    server_name radio.local;
    root /root/src/radio/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend-Proxy
    location /api {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
    }
}
```

**Pitfall:** Die `api.js` verwendet `window.location.hostname:8000`. Bei einem Nginx-Proxy-Setup, wo Frontend und Backend auf Port 80 laufen, muss `api.js` angepasst werden:
```javascript
// Statt:
return `${window.location.protocol}//${window.location.hostname}:8000`;
// Einfacher Proxy:
return `${window.location.protocol}//${window.location.hostname}`;
```

### 7.6 Stationskonfiguration erstellen

```bash
# stations.json erstellen
mkdir -p /mnt/radio/config
cat > /mnt/radio/config/stations.json << 'EOF'
[
  {
    "name": "WDR2",
    "url": "https://wdr-wdr2-rheinruhr.icecastssl.wdr.de/wdr/wdr2/rheinruhr/mp3/128/stream.mp3",
    "path": "WDR2",
    "default_enabled": true
  },
  {
    "name": "ANTENNE",
    "url": "https://stream.antenne.de/nur-die-musik/stream/mp3",
    "path": "ANTENNE",
    "default_enabled": true
  },
  {
    "name": "R.S.A",
    "url": "https://streams.rsa-sachsen.de/mix-nonstop/mp3-192/streams.rsa-sachsen.de/",
    "path": "R.S.A",
    "default_enabled": true
  },
  {
    "name": "FluxFM",
    "url": "https://streams.fluxfm.de/indiedisco/mp3-320/streams.fluxfm.de/",
    "path": "FluxFM",
    "default_enabled": true
  },
  {
    "name": "SLAM",
    "url": "https://streaming.slam.nl/web10_mp3",
    "path": "SLAM",
    "default_enabled": true
  },
  {
    "name": "SwissPop",
    "url": "https://stream.srg-ssr.ch/srgssr/rsp/mp3/128",
    "path": "SwissPop",
    "default_enabled": true
  }
]
EOF
```

### 7.7 Recording-Scripts einrichten

```bash
# Scripts kopieren
cp /root/src/radio/scripts-docs/streamripper-manager.sh /mnt/radio/scripts/
cp /root/src/radio/scripts-docs/fix-id3-tags.py /mnt/radio/scripts/
chmod +x /mnt/radio/scripts/streamripper-manager.sh

# Musik-Verzeichnisse erstellen
for sender in WDR2 ANTENNE R.S.A FluxFM SLAM SwissPop; do
    mkdir -p "/mnt/radio/music/${sender} - Musik"
    mkdir -p "/mnt/radio/inbox/${sender}"
    chmod 777 "/mnt/radio/inbox/${sender}"
done

# State-Dateien für Standard-Stationen erstellen
for sender in WDR2 ANTENNE R.S.A FluxFM SLAM SwissPop; do
    touch "/mnt/radio/state/${sender}.enabled"
done
```

### 7.8 Manager-Loop als Systemd-Service

```ini
# /etc/systemd/system/radio-manager.service
[Unit]
Description=Radio StreamRipper Manager
After=network.target

[Service]
Type=simple
User=root
ExecStart=/mnt/radio/scripts/streamripper-manager.sh manager
Restart=always
RestartSec=30

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable radio-manager
systemctl start radio-manager
```

**Alternativ: Cron**
```bash
crontab -e
# Eintragen:
*/5 * * * * /mnt/radio/scripts/streamripper-manager.sh manager >> /mnt/radio/logs/manager.log 2>&1
```

### 7.9 Vollständige Abhängigkeitsliste

**Python (`pip install`):**
```
fastapi>=0.100.0
uvicorn[standard]>=0.20.0
mutagen>=1.46.0
pydantic>=2.0.0
python-multipart  # für Form-Uploads (optional)
```

**npm (`package.json`):**
```json
{
  "dependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "axios": "^1.4.0",
    "wavesurfer.js": "^7.0.0"
  },
  "devDependencies": {
    "vite": "^4.0.0",
    "@vitejs/plugin-react": "^4.0.0"
  }
}
```

**System:**
```
ffmpeg        # Audio-Verarbeitung, Clip-Schnitt
streamripper  # Radio-Stream-Aufnahme mit Song-Splitting
python3-mutagen  # Falls pip nicht verfügbar
```

---

## 8. API-Referenz

### 8.1 Songs

#### `GET /api/songs`

Paginierte Song-Liste mit optionalen Filtern.

**Query-Parameter:**

| Parameter | Typ | Default | Beschreibung |
|-----------|-----|---------|-------------|
| `page` | int | 1 | Seite (≥1) |
| `per_page` | int | 100 | Einträge pro Seite (1–500) |
| `search` | string | – | Volltext (Titel, Artist, Album, Dateiname) |
| `genre` | string | – | Komma-separierte Genres |
| `year` | string | – | Komma-separierte Jahre (4-stellig) |
| `favorite` | bool | – | Nur Favoriten |
| `text` | string | – | Kommentar-Suche |
| `min_rating` | float | – | Mindest-Community-Rating |
| `sort_by` | string | – | Sortierfeld |
| `sort_dir` | string | `"asc"` | `"asc"` oder `"desc"` |

**Antwort:**
```json
{
    "songs": [...],
    "total": 1234,
    "page": 1,
    "per_page": 100,
    "pages": 13
}
```

**Beispiel:**
```bash
curl "http://localhost:8000/api/songs?search=beatles&genre=WDR2&sort_by=created&sort_dir=desc&page=1"
```

---

#### `GET /api/songs/meta`

Filter-Metadaten für die UI.

**Antwort:**
```json
{
    "genres": ["ANTENNE", "FluxFM", "R.S.A", "SLAM", "SwissPop", "WDR2"],
    "years": ["2026", "2025", "2024"],
    "texts": ["saved", "myfavorite"]
}
```

---

#### `GET /api/songs/{song_id}`

Einzelnen Song abrufen.

**Antwort:** Song-Objekt oder `404`.

**Song-ID-Format:** `"WDR2 - Musik|Artist - Title.mp3"` (URL-enkodiert: `%7C` statt `|`)

---

#### `PATCH /api/songs/{song_id}`

Metadaten aktualisieren.

**Request-Body** (alle Felder optional):
```json
{
    "title": "Neuer Titel",
    "artist": "Neuer Artist",
    "community_rating": 7.0,
    "favorite": true
}
```

**Antwort:** `{"ok": true}`

---

#### `PATCH /api/songs/{song_id}/favorite`

Favorit-Status setzen.

**Request-Body:**
```json
{"favorite": true}
```

**Antwort:** `{"ok": true}`

---

#### `DELETE /api/songs/{song_id}`

Song-Datei löschen (physisch vom Dateisystem!).

**Antwort:** `{"ok": true}`

---

#### `GET /api/stream/{song_id}`

MP3-Stream.

**Antwort:** `FileResponse` mit `Content-Type: audio/mpeg`

---

#### `POST /api/rescan`

Library-Cache invalidieren und neu einlesen.

**Antwort:** `{"count": 1234}` – Anzahl gefundener Songs

---

### 8.2 Clips

#### `POST /api/clip/save`

Clip anwenden (DESTRUKTIV – Original wird überschrieben!).

**Request-Body:**
```json
{
    "song_id": "WDR2 - Musik|song.mp3",
    "start": 15.5,
    "end": 210.0,
    "fade_in": true,
    "fade_out": false,
    "fade_duration": 3.0
}
```

**Antwort:** `{"ok": true}`

---

### 8.3 Playlists

#### `GET /api/playlists`

Alle Playlists mit Song-Anzahl.

**Antwort:**
```json
[
    {"name": "Favoriten", "path": "/mnt/radio/Favoriten.m3u8", "count": 42},
    {"name": "Entspannung", "path": "/mnt/radio/Entspannung.m3u8", "count": 15}
]
```

---

#### `POST /api/playlists`

Neue Playlist erstellen.

**Request-Body:** `{"name": "Neue Playlist"}`

**Antwort:** `{"name": "...", "path": "...", "count": 0}` oder `409 Conflict`

---

#### `GET /api/playlists/{name}/songs`

Songs einer Playlist auflisten (mit Metadaten aus der Library).

**Antwort:** `list[Song]`

---

#### `POST /api/playlists/{name}/add`

Song zu Playlist hinzufügen.

**Request-Body:** `{"song_id": "WDR2 - Musik|song.mp3"}`

**Antwort:** `{"ok": true}` oder `{"ok": true, "message": "Already in playlist"}`

---

#### `DELETE /api/playlists/{name}/songs`

Song aus Playlist entfernen.

**Request-Body:** `{"song_id": "WDR2 - Musik|song.mp3"}`

**Antwort:** `{"ok": true, "removed": true/false}`

---

#### `PUT /api/playlists/{name}/rename`

Playlist umbenennen.

**Request-Body:** `{"new_name": "Neuer Name"}`

**Antwort:** Playlist-Objekt mit neuem Namen

---

#### `DELETE /api/playlists/{name}`

Playlist löschen.

**Antwort:** `{"ok": true}`

---

### 8.4 Recording

#### `GET /api/recording/stations`

Alle Stationen mit aktuellem Laufzustand.

**Antwort:**
```json
[
    {
        "name": "WDR2",
        "url": "https://...",
        "path": "WDR2",
        "default_enabled": true,
        "running": true,
        "enabled": true
    }
]
```

---

#### `POST /api/recording/{station}/start`

Streamripper für Station starten.

**Antwort:** `{"ok": true}` oder `{"ok": true, "message": "Already running"}`

---

#### `POST /api/recording/{station}/stop`

Streamripper für Station stoppen.

**Antwort:** `{"ok": true}`

---

#### `POST /api/recording/{station}/restart`

Station neu starten (Stop + Start).

**Antwort:** `{"ok": true}`

---

#### `GET /api/recording/stats`

Recording-Statistiken.

**Antwort:**
```json
{
    "total_music": 4521,
    "today_music": 47,
    "last_30min_music": 8,
    "stations": {
        "WDR2": {
            "total_music": 1200,
            "today_music": 12,
            "last_30min_music": 2,
            "last_activity": "2026-05-27"
        }
    }
}
```

---

### 8.5 Stations-Konfiguration

#### `GET /api/stations`

Alle Stationskonfigurationen laden.

#### `POST /api/stations`

Alle Stationskonfigurationen überschreiben (Bulk-Update).

**Request-Body:** `list[StationConfig]`

#### `POST /api/stations/add`

Neue Station hinzufügen.

**Request-Body:**
```json
{
    "name": "Neue Station",
    "url": "https://stream.example.com/radio.mp3",
    "path": "NeueStation",
    "default_enabled": false
}
```

**Antwort:** `{"ok": true}` oder `400` wenn Name bereits existiert

#### `PUT /api/stations/{station_name}`

Station aktualisieren.

#### `DELETE /api/stations/{station_name}`

Station löschen.

---

### 8.6 FastAPI Swagger-Dokumentation

Die interaktive API-Dokumentation ist verfügbar unter:
- **Swagger UI:** `http://localhost:8000/docs`
- **ReDoc:** `http://localhost:8000/redoc`
- **OpenAPI JSON:** `http://localhost:8000/openapi.json`

---

## 9. Konfigurationsdateien

### 9.1 `/mnt/radio/config/stations.json`

Zentrale Stationskonfiguration. Wird vom Backend gelesen und geschrieben.

```json
[
  {
    "name": "WDR2",
    "url": "https://wdr-wdr2-rheinruhr.icecastssl.wdr.de/wdr/wdr2/rheinruhr/mp3/128/stream.mp3",
    "path": "WDR2",
    "default_enabled": true
  }
]
```

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| `name` | string | Anzeigename, wird als Sender-ID verwendet |
| `url` | string | HTTP/HTTPS Stream-URL (MP3 oder AAC) |
| `path` | string | Ordner-Suffix unter `/mnt/radio/music/` – Musikpfad ist `{path} - Musik` |
| `default_enabled` | bool | Neue Installationen: Soll die Station bei Start aktiviert sein? |

**Pitfall:** Beim Ändern von `path` werden bestehende Aufnahmen nicht umbenannt! Die Musikbibliothek müsste manuell migriert werden.

---

### 9.2 `backend/data.json`

Interne Persistenzdatei für Favoriten und Ratings. Wird vom Backend gelesen und geschrieben.

**Nicht manuell bearbeiten** – Formatfehler führen zu leerem Datenbestand (Fallback auf leeres Dict).

**Backup-Empfehlung:**
```bash
cp /root/src/radio/backend/data.json /root/src/radio/backend/data.json.backup
```

---

### 9.3 `/mnt/radio/state/{station}.enabled`

Leere Dateien, die den Aktivierungsstatus einer Station speichern.

```bash
# Station aktivieren
touch /mnt/radio/state/WDR2.enabled

# Station deaktivieren
rm /mnt/radio/state/WDR2.enabled

# Alle aktiven Stationen auflisten
ls /mnt/radio/state/*.enabled
```

---

### 9.4 `scripts-docs/stations.conf` – Referenz-Konfiguration

Älteres Format mit verifizierten Stream-URLs (Stand: Mai 2026):

```
WDR2|https://wdr-wdr2-rheinruhr.icecastssl.wdr.de/wdr/wdr2/rheinruhr/mp3/128/stream.mp3
ANTENNE|https://stream.antenne.de/nur-die-musik/stream/mp3
R.S.A|https://streams.rsa-sachsen.de/mix-nonstop/mp3-192/streams.rsa-sachsen.de/
FluxFM|https://streams.fluxfm.de/indiedisco/mp3-320/streams.fluxfm.de/
SLAM|https://streaming.slam.nl/web10_mp3
SwissPop|https://stream.srg-ssr.ch/srgssr/rsp/mp3/128
```

---

## 10. Jellyfin-Integration

### 10.1 Jellyfin als Docker-Container starten

```bash
docker run -d \
    --name radio-jellyfin \
    --restart unless-stopped \
    -p 8096:8096 \
    -v /mnt/radio/music:/media/radio:ro \
    -v jellyfin-config:/config \
    -v jellyfin-cache:/cache \
    jellyfin/jellyfin:latest
```

Jellyfin ist dann erreichbar unter: `http://localhost:8096`

### 10.2 Medienbibliothek einrichten

1. Jellyfin öffnen → Einstellungen → Bibliotheken
2. Neue Bibliothek hinzufügen
3. Typ: **Musik**
4. Ordner: `/media/radio` (der gemountete Pfad innerhalb des Containers)
5. Scan starten

Jellyfin liest die ID3-Tags der MP3-Dateien automatisch. Die Tags werden von `fix-id3-tags.py` korrekt gesetzt:
- **Genre** = Sendername (z.B. "WDR2")
- **Album** = Sendername + " - Musik" (z.B. "WDR2 - Musik")
- **Artist/Title** = aus StreamTitle extrahiert

### 10.3 Jellyfin-Scan nach neuen Aufnahmen

```bash
# Manueller Scan via API
curl -X POST "http://localhost:8096/Library/Refresh" \
    -H "X-Emby-Token: <API-KEY>"

# Automatisch via Cron (täglich 00:30)
30 0 * * * curl -s "http://localhost:8096/Library/Refresh" -H "X-Emby-Token: <KEY>"
```

### 10.4 Playlist-Integration

Die vom Backend erstellten `.m3u8`-Dateien in `/mnt/radio/` können in Jellyfin importiert werden, wenn der Ordner gemountet wird:

```bash
docker run -d \
    --name radio-jellyfin \
    -v /mnt/radio:/media/radio:ro \   # Musik UND Playlists
    ...
```

**Pitfall:** Jellyfin erwartet absolute Pfade oder relative Pfade innerhalb des gemounteten Verzeichnisses. Die M3U8-Dateien des Backends verwenden relative Pfade relativ zu `MUSIC_DIR`. Diese stimmen möglicherweise nicht mit Jellyins Erwartungen überein.

### 10.5 Monitoring

```bash
# Status prüfen
docker ps --filter "name=radio-jellyfin"

# Logs ansehen
docker logs radio-jellyfin --tail 50

# Neu starten
docker restart radio-jellyfin
```

---

## 11. Troubleshooting & FAQ

### Problem: Backend startet nicht

```bash
# Log ansehen
uvicorn main:app --host 0.0.0.0 --port 8000
# oder
journalctl -u radio-backend -f

# Häufige Ursachen:
# 1. Port 8000 belegt
lsof -i :8000

# 2. Python-Module fehlen
pip install fastapi uvicorn mutagen pydantic

# 3. /mnt/radio/music existiert nicht
mkdir -p /mnt/radio/music
```

---

### Problem: Frontend zeigt "Keine Songs gefunden"

```bash
# 1. Prüfen ob Backend läuft
curl http://localhost:8000/api/songs

# 2. Prüfen ob Musikdateien vorhanden
ls /mnt/radio/music/

# 3. Library-Cache invalidieren
curl -X POST http://localhost:8000/api/rescan

# 4. CORS-Fehler im Browser-DevTools?
#    → Backend muss auf gleicher Domain oder CORS korrekt konfiguriert sein
```

---

### Problem: Streamripper startet nicht

```bash
# 1. Streamripper installiert?
which streamripper

# 2. stations.json vorhanden?
cat /mnt/radio/config/stations.json

# 3. Manager-Script ausführbar?
chmod +x /mnt/radio/scripts/streamripper-manager.sh

# 4. Manuell starten und Fehler sehen
streamripper "https://stream-url.com/radio.mp3" -s -d /mnt/radio/inbox/TEST/

# 5. Logs prüfen
tail -f /mnt/radio/logs/WDR2_streamripper.log
```

---

### Problem: Keine neuen Songs in der Bibliothek

```bash
# 1. Prüfen ob Dateien in der Inbox ankommen
ls /mnt/radio/inbox/WDR2/

# 2. Manager-Loop läuft?
ps aux | grep streamripper-manager

# 3. Musik-Filter zu streng?
#    Dateinamen müssen " - " enthalten (Artist - Title Format)
ls /mnt/radio/inbox/WDR2/

# 4. Dateien zu kurz (< 120 Sekunden)?
ffprobe -v quiet -show_entries format=duration -of csv=p=0 datei.mp3

# 5. Manuell Manager ausführen
/mnt/radio/scripts/streamripper-manager.sh manager
# (Ctrl+C nach erstem Durchlauf)
```

---

### Problem: ID3-Tags fehlen oder falsch

```bash
# Manuell für eine Datei testen
python3 /mnt/radio/scripts/fix-id3-tags.py \
    "/mnt/radio/music/WDR2 - Musik/Artist - Title.mp3" "WDR2"

# Alle Dateien einer Station neu taggen
for f in /mnt/radio/music/WDR2\ -\ Musik/*.mp3; do
    python3 /mnt/radio/scripts/fix-id3-tags.py "$f" "WDR2"
done

# Prüfen ob mutagen installiert ist
python3 -c "import mutagen; print('OK')"
```

---

### Problem: Clip speichern schlägt fehl

```bash
# ffmpeg installiert?
which ffmpeg
ffmpeg -version

# Test-Clip von Hand
ffmpeg -i eingabe.mp3 -ss 15 -t 180 -c copy ausgabe.mp3

# Schreibrechte?
ls -la /mnt/radio/music/WDR2\ -\ Musik/
```

---

### Problem: API gibt 500 zurück beim Song-Update

```bash
# Prüfen ob ffmpeg verfügbar
which ffmpeg

# Fehler im Backend-Log
journalctl -u radio-backend -n 50

# Datei schreibbar?
ls -la "/mnt/radio/music/WDR2 - Musik/song.mp3"

# ID3-Tags manuell testen
python3 -c "
from mutagen.id3 import ID3
tag = ID3('/mnt/radio/music/WDR2 - Musik/song.mp3')
print(tag.keys())
"
```

---

### Problem: Frontend API-URL stimmt nicht

```bash
# api.js prüfen – Zeile 10 (Fallback-IP)
grep -n "192.168" /root/src/radio/frontend/src/api.js

# Anpassen wenn nötig
# Die getBaseUrl() Funktion nimmt den Browser-Hostnamen + :8000
# Falls Backend auf anderem Port: api.js:6 anpassen
```

---

### Problem: Playlists werden nicht gefunden

```bash
# .m3u8-Dateien im Radio-Verzeichnis?
ls /mnt/radio/*.m3u8

# Berechtigung
ls -la /mnt/radio/

# Neue Playlist über API erstellen
curl -X POST http://localhost:8000/api/playlists \
    -H "Content-Type: application/json" \
    -d '{"name": "Meine Playlist"}'
```

---

### FAQ: Wie werden Song-IDs gebildet?

Song-IDs sind der relative Pfad ab `MUSIC_DIR`, mit `/` ersetzt durch `|`:

```
Datei: /mnt/radio/music/WDR2 - Musik/Queen - Bohemian Rhapsody.mp3
Relative zu MUSIC_DIR: WDR2 - Musik/Queen - Bohemian Rhapsody.mp3
ID: WDR2 - Musik|Queen - Bohemian Rhapsody.mp3
```

**Wichtig:** Wird eine Datei umbenannt oder verschoben, ändert sich die ID und damit gehen Ratings und Favoriten-Zuordnungen verloren.

---

### FAQ: Wie werden Ratings gespeichert?

Ratings werden **nicht** in die MP3-ID3-Tags geschrieben (außer beim expliziten `PATCH /api/songs/{id}` mit `community_rating`). Sie werden in `backend/data.json` gespeichert.

Die App liest beim Library-Scan zuerst den POPM-ID3-Tag (0-255, umgerechnet auf 0-10), überschreibt diesen aber mit dem Wert aus `data.json` falls vorhanden.

---

### FAQ: Was passiert beim Server-Neustart?

- **Backend-Cache** wird geleert → erster Request triggert vollständigen Rescan
- **Streamripper-Prozesse** laufen bis sie beendet werden (kein automatischer Neustart ohne Systemd oder Cron)
- **State-Dateien** in `/mnt/radio/state/` bleiben erhalten → beim Neustart des Manager-Loops werden aktivierte Stationen automatisch neu gestartet
- **data.json** (Ratings/Favoriten) bleibt erhalten
- **M3U8-Playlists** bleiben erhalten

---

### FAQ: Wie groß wird die Musikbibliothek?

Typische Werte:
- 1 Radiosender nimmt ~8-15 Songs/Stunde auf
- Durchschnittliche Song-Länge: ~3:30 Min
- Durchschnittliche MP3-Größe (128kbps): ~3.3 MB/Min → ~11 MB/Song
- 6 Sender × 12 Songs/Stunde × 24 Stunden = ~1728 Songs/Tag
- ~19 GB/Tag bei 6 Sendern

**Empfehlung:** Automatisches Löschen alter oder niedrig bewerteter Songs einplanen.

---

### FAQ: Kann ich eigene Radio-Sender hinzufügen?

Ja, über die Web-UI (⚙ → "+ Station hinzufügen") oder via API:

```bash
curl -X POST http://localhost:8000/api/stations/add \
    -H "Content-Type: application/json" \
    -d '{
        "name": "Mein Sender",
        "url": "https://stream.beispiel.de/radio.mp3",
        "path": "MeinSender",
        "default_enabled": false
    }'
```

Dann in der UI starten oder:
```bash
curl -X POST "http://localhost:8000/api/recording/Mein%20Sender/start"
```

---

### FAQ: Wie kann ich die Bibliothek auf ein anderes System migrieren?

1. Backend stoppen
2. Alle Daten kopieren:
   ```bash
   rsync -av /mnt/radio/ user@neuer-server:/mnt/radio/
   rsync -av /root/src/radio/backend/data.json user@neuer-server:/root/src/radio/backend/
   ```
3. Auf neuem System: Installation (Abschnitt 7) durchführen
4. `MUSIC_DIR` in `backend/services/library.py:25` anpassen falls der Pfad sich ändert

---

### Logging-Strategie

**Backend-Logging:**
```
DEBUG   – Library-Scan Details, Cache-Treffer/Misses, ID3-Details
INFO    – API-Requests, Recording Start/Stop, Library-Scan-Ergebnisse
WARNING – Fehlende Dateien, ungültige Tags, Fallbacks
ERROR   – ffmpeg-Fehler, Dateioperationen fehlgeschlagen
```

**Frontend-Konsole-Gruppen:**
```
[API]    – fetchSongs/updateSong/etc. mit Parametern
[Player] – WaveSurfer Events (load, ready, play, pause, finish, error)
[Clip]   – Clip-Modus Aktionen
[State]  – State-Änderungen in App (filters, sort, page)
```

**Script-Logs:**
```
/mnt/radio/logs/WDR2_streamripper.log      – Streamripper Output pro Sender
/mnt/radio/logs/manager.log               – Manager-Loop
/mnt/radio/logs/pipeline-check.log        – Pipeline-Check
/mnt/radio/logs/process-inbox.log         – Inbox-Verarbeitung
```

---

*Dokumentation generiert: 2026-05-27*  
*Projekt-Pfad: `/root/src/radio/`*

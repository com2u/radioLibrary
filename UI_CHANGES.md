# UI Changes – Playlist Manager Überarbeitung

## Datum
2026-05-27

## Motivation
Das alte Playlist-Konzept war unlogisch: Songs konnten nur über ein Dropdown direkt in der Songliste zu Playlists hinzugefügt werden. Playlists selbst waren nicht verwaltbar (kein Erstellen, Umbenennen, Löschen, keine Song-Verwaltung).

---

## Neues Konzept

### 1. Playlist Manager (Hauptfeature)

**Neuer Button `📋` im AppHeader** (neben Recording-Steuerung, Shortcut: `P`)

Öffnet ein Modal **Playlist Manager** mit zwei Spalten:

**Links – Playlist-Liste:**
- Alle M3U8-Playlists mit Song-Anzahl
- `＋ Neue Playlist` anlegen (Inline-Eingabe, Enter zum Bestätigen)
- Umbenennen per `✏️`-Button (Inline-Eingabe)
- Löschen per `🗑️`-Button (mit Bestätigung)
- `＋`-Button je Playlist: fügt den aktuellen Song sofort hinzu
- Klick auf Playlist zeigt Songs rechts

**Rechts – Songs der ausgewählten Playlist:**
- Liste aller Songs mit Titel, Artist, Dauer
- `✕` entfernt den Song aus der Playlist
- Playlist ist leer? → Hinweistext

**Footer:**
- Zeigt den aktuellen Song (aus Player oder aus SongTable-Auswahl)
- Schließen-Button

---

### 2. SongTable Anpassung

**Entfernt:** Playlist-Dropdown-Spalte (war unlogisch, braucht Platz, zeigt keine Info)

**Neu:** `📋`-Button je Song-Zeile
- Öffnet den Playlist Manager
- Der angeklickte Song wird als "aktiver Song" im Manager gesetzt
- So kann man direkt entscheiden, zu welcher Playlist hinzugefügt werden soll

---

### 3. Player Integration

- Der `📋`-Button im Player öffnet weiterhin den Playlist Manager (Shortcut `P`)
- Keyboard-Shortcuts `A` / `B` fügen den aktuellen Song zur ersten / zweiten Playlist hinzu
- **Neu: Feedback** – nach dem Hinzufügen erscheint kurz ein grüner Status-Text im Player (z.B. „Zu „Favoriten" hinzugefügt")

---

## Backend-Erweiterungen

### Neue API-Endpunkte (`/api/playlists`)

| Methode | Pfad | Beschreibung |
|---------|------|--------------|
| `GET` | `/api/playlists` | Alle Playlists (mit Song-Anzahl) |
| `POST` | `/api/playlists` | Neue Playlist erstellen |
| `GET` | `/api/playlists/{name}/songs` | Songs einer Playlist (mit Metadaten) |
| `POST` | `/api/playlists/{name}/add` | Song hinzufügen (bereits vorhanden: kein Fehler) |
| `DELETE` | `/api/playlists/{name}/songs` | Song entfernen |
| `PUT` | `/api/playlists/{name}/rename` | Playlist umbenennen |
| `DELETE` | `/api/playlists/{name}` | Playlist löschen |

### Neue Service-Funktionen (`playlist_service.py`)

- `create_playlist(name)` – erstellt leere .m3u8
- `rename_playlist(old, new)` – benennt um
- `delete_playlist(name)` – löscht Datei
- `get_playlist_songs(name)` – gibt relative Pfade zurück
- `remove_song_from_playlist(name, song_path)` – entfernt Eintrag

---

## Geänderte Dateien

| Datei | Änderung |
|-------|----------|
| `backend/routers/playlists.py` | Vollständig neu – alle CRUD-Endpunkte |
| `backend/services/playlist_service.py` | 5 neue Funktionen ergänzt |
| `frontend/src/modals/PlaylistManager.jsx` | **Neu** – Playlist Manager Komponente |
| `frontend/src/modals/PlaylistModal.jsx` | Nicht mehr verwendet (kann entfernt werden) |
| `frontend/src/components/SongTable.jsx` | Dropdown entfernt, `📋`-Button ergänzt |
| `frontend/src/components/Player.jsx` | Feedback nach Playlist-Hinzufügen |
| `frontend/src/components/AppHeader.jsx` | `📋 Playlists`-Button ergänzt |
| `frontend/src/App.jsx` | PlaylistManager integriert, PlaylistModal ersetzt |
| `frontend/src/api.js` | 5 neue API-Funktionen |
| `frontend/src/App.css` | CSS-Syntaxfehler (Doppelblock) behoben |

---

## Beibehaltene Funktionen

- Alle bestehenden Filter, Sortierung, Favoriten, Ratings
- Clip-Modus unverändert
- Recording-Steuerung unverändert
- Keyboard-Shortcuts `A`/`B` für schnelles Hinzufügen zu Playlist 1/2
- Keyboard-Shortcut `P` für Playlist Manager

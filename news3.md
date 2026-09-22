# news3.md – Neue Features außerhalb der Spezifikation

Dieses Dokument beschreibt alle Funktionen, die im Code implementiert wurden, aber **nicht** in den Spezifikationsdateien `project.md`, `news1.md`, `news2.md` oder `recordingControl.md` beschrieben sind.

---

## 1. Playlist Manager (Vollständige Verwaltungsoberfläche)

**Datei:** `frontend/src/modals/PlaylistManager.jsx`

### Beschreibung

Die Spezifikation (`news2.md`) beschreibt nur das Hinzufügen eines Songs zu einer Playlist. Implementiert wurde jedoch ein vollständiger **Playlist Manager** mit folgenden Funktionen:

- **Playlist-Übersicht:** Anzeige aller Playlists mit Song-Anzahl
- **Neue Playlist erstellen:** Direkt im Dialog per Texteingabe
- **Playlist umbenennen:** Inline-Umbenennung über ✏️-Button
- **Playlist löschen:** Mit Bestätigungs-Dialog
- **Song-Liste einer Playlist anzeigen:** Rechte Spalte zeigt alle Songs der ausgewählten Playlist
- **Songs aus Playlist entfernen:** Einzelne Songs können per ✕-Button entfernt werden
- **Song zur Playlist hinzufügen:** Aktueller Song kann per ＋-Button direkt einer Playlist zugewiesen werden

### Backend-Endpunkte (zusätzlich zu spec)

- `POST /api/playlists` – Neue Playlist erstellen
- `PUT /api/playlists/{name}/rename` – Playlist umbenennen
- `DELETE /api/playlists/{name}` – Playlist löschen
- `GET /api/playlists/{name}/songs` – Songs einer Playlist laden
- `DELETE /api/playlists/{name}/songs` – Song aus Playlist entfernen

---

## 2. Keyboard-Shortcut für Playlist-Manager öffnen (P-Taste)

**Datei:** `frontend/src/App.jsx`

### Beschreibung

Die Spezifikation definiert `A` und `B` als Shortcuts für Playlist 1 und 2. Zusätzlich implementiert wurde:

- **P-Taste:** Öffnet den Playlist Manager Dialog

---

## 3. Keyboard-Shortcuts im Clip-Modus: [ und ] für Clip-Grenzen

**Datei:** `frontend/src/components/Player.jsx`

### Beschreibung

Die Spezifikation definiert im Clip-Modus Shortcuts wie `S`, `L`, `R`, `M`, `Delete`. Zusätzlich implementiert wurden:

- **`[`-Taste:** Setzt den Clip-Start auf die aktuelle Wiedergabeposition
- **`]`-Taste:** Setzt das Clip-Ende auf die aktuelle Wiedergabeposition
- **Escape-Taste:** Beendet den Clip-Modus (Cancel)

---

## 4. Rescan-Funktion (Library neu laden)

**Datei:** `frontend/src/components/AppHeader.jsx`, `backend/routers/songs.py`

### Beschreibung

Nicht in der Spezifikation enthalten ist ein **manueller Rescan-Button** in der Kopfleiste:

- 🔄-Button löst einen Rescan der MP3-Bibliothek aus
- Backend-Endpunkt `POST /api/rescan` invalidiert den Library-Cache und scannt neu
- Gibt die Anzahl der neu gefundenen Songs zurück

---

## 5. Keyboard-Shortcut-Hilfe (? Taste / Help-Overlay)

**Datei:** `frontend/src/components/AppHeader.jsx`

### Beschreibung

Die Spezifikation erwähnt Keyboard-Shortcuts, aber kein Hilfe-System. Implementiert wurde:

- **?-Button** in der Kopfleiste zeigt ein **Help-Overlay** an
- Das Overlay zeigt alle verfügbaren Keyboard-Shortcuts übersichtlich in Kategorien
- Escape oder Klick auf den Hintergrund schließt das Overlay

---

## 6. Dynamische API-Basis-URL

**Datei:** `frontend/src/api.js`

### Beschreibung

Die API-Basis-URL wird dynamisch aus der aktuellen Browseradresse ermittelt:

- Verwendet `window.location.hostname` + Port 8000
- Kein hartkodierter Hostname notwendig
- Fallback auf eine feste IP-Adresse (`192.168.0.197`) für Server-Side-Rendering

---

## 7. Playlist-Feedback-Meldungen im Player

**Datei:** `frontend/src/components/Player.jsx`

### Beschreibung

Im Player und im Clip-Modus werden Feedback-Meldungen angezeigt, wenn:

- Ein Song erfolgreich zu einer Playlist hinzugefügt wurde
- Ein Song bereits in der Playlist vorhanden ist ("Bereits in …")
- Ein Fehler beim Hinzufügen aufgetreten ist

Die Meldung erscheint für 3 Sekunden und verschwindet dann automatisch.

---

## 8. Playlist-Shortcuts auch im Clip-Modus (A und B)

**Datei:** `frontend/src/components/Player.jsx`

### Beschreibung

Die Spezifikation (`news2.md`) beschreibt A/B-Shortcuts für den normalen Modus. Im Clip-Modus sind diese Shortcuts ebenfalls aktiv und ermöglichen es, den aktuellen Song während des Editierens zu Playlist 1 oder 2 hinzuzufügen.

---

## 9. Numerisches Rating 1–9 auch im Clip-Modus

**Datei:** `frontend/src/components/Player.jsx`

### Beschreibung

Die Spezifikation (`news2.md`) beschreibt Zifferntasten 1–9 für das Rating. Diese sind nicht nur global, sondern auch explizit im Clip-Modus implementiert, um ein Überschreiben durch den globalen Handler zu verhindern.

---

## 10. NowPlaying-Animationsbalken in der Song-Tabelle

**Datei:** `frontend/src/components/NowPlayingBars.jsx`, `SongTable.jsx`

### Beschreibung

Anstatt nur den aktuellen Song optisch hervorzuheben (wie in der Spec), wird für den gerade spielenden Song in der Tabelle eine **animierte "NowPlaying"-Balkengrafik** angezeigt (analog zu Spotify/Apple Music).

---

## 11. Stations-CRUD mit vollständiger REST-API

**Datei:** `backend/routers/stations.py`

### Beschreibung

Die Spezifikation beschreibt das Bearbeiten von Stationsdaten. Implementiert wurde eine vollständige REST-API:

- `GET /api/stations` – Alle Stationen laden
- `POST /api/stations` – Alle Stationen überschreiben (Bulk-Update)
- `POST /api/stations/add` – Einzelne Station hinzufügen
- `PUT /api/stations/{name}` – Station aktualisieren
- `DELETE /api/stations/{name}` – Station löschen

---

## 12. Globaler Filter-Indikator in der Kopfleiste

**Datei:** `frontend/src/components/AppHeader.jsx`, `App.jsx`

### Beschreibung

Wenn aktive Filter gesetzt sind, zeigt der 🔍-Button in der Kopfleiste einen kleinen farbigen Punkt als Indikator:

- Visuelles Signal, dass die Song-Liste gefiltert ist
- Klick auf den Button öffnet den Filter-Dialog zum Anpassen

---

## 13. Zoom-Funktion auch im normalen Play-Modus

**Datei:** `frontend/src/components/Player.jsx`

### Beschreibung

Die Spezifikation (`news1.md`) beschreibt Zoom nur für den **Clip-Modus**. Implementiert wurde der Zoom-Schieberegler jedoch auch im **normalen Play-Modus** sichtbar und nutzbar.

---

## 14. WaveSurfer Autoplay mit Fehlerbehandlung

**Datei:** `frontend/src/components/Player.jsx`

### Beschreibung

Wenn ein neuer Song geladen wird, startet die Wiedergabe automatisch. Wenn der Browser Autoplay blockiert:

- Kein Crash oder Fehlermeldung
- Der Play-Button wird korrekt angezeigt
- Benutzer kann manuell Play drücken

---

## 15. Race-Condition-Schutz im WaveSurfer

**Datei:** `frontend/src/components/Player.jsx`

### Beschreibung

Internes `mounted`-Flag verhindert, dass Callbacks auf einer bereits unmounted Komponente ausgeführt werden (z.B. beim schnellen Song-Wechsel).

# UI/UX Redesign – Änderungen

## Überblick

Vollständige Überarbeitung der Radio Library UI mit modernem dunklen Design, Icon-Buttons, Tooltips und Keyboard-Shortcut-Indikatoren. Alle Funktionen bleiben vollständig erhalten.

---

## App.css – Neue Farbpalette & Design-System

### Farbvariablen (CSS Custom Properties)
| Variable       | Wert      | Verwendung                     |
|----------------|-----------|-------------------------------|
| `--bg`         | `#0d0f1a` | Hintergrund-Basis              |
| `--surface`    | `#161829` | Karten, Header, Player-Bar     |
| `--elevated`   | `#1e2038` | Inputs, Buttons, Tags          |
| `--border`     | `#252840` | Trennlinien, Rahmen            |
| `--accent`     | `#7c8cf8` | Primärfarbe, aktive Elemente   |
| `--accent-2`   | `#a78bfa` | Gradient-Endfarbe              |
| `--danger`     | `#e05c5c` | Löschen, Clip-Modus            |
| `--success`    | `#4ade80` | Fade-Visualisierung, Ratings   |
| `--text`       | `#e2e4f0` | Primärer Text                  |
| `--text-muted` | `#6b7280` | Sekundärer / inaktiver Text    |
| `--text-dim`   | `#9ca3af` | Mittlere Textebene             |

### Neue CSS-Klassen
- **`.btn-play`** – Runder Play/Pause-Button mit Gradient und Glow
- **`.btn-ghost`** – Transparenter Button, leichter Hover
- **`.icon-btn.danger`** – Icon-Button mit Rot-Hover
- **`.clip-badge`** – Clip-Modus-Label in der Player-Bar
- **`.clip-fade-label`** – Fade-In/Out Checkbox-Label
- **`.kbd`** – Keyboard-Shortcut-Badge (monospace, dunkel umrandet)
- **`.help-overlay` / `.help-box`** – Shortcuts-Hilfe-Overlay
- **`.help-grid` / `.help-row`** – Zweispaltiges Layout im Help-Overlay
- **`.song-count`** – Pill-Badge im Header für Song-Zähler
- **`.header-divider`** – Vertikale Trennlinie im Header
- **`.playlist-select`** – Verbesserter Playlist-Dropdown in der Tabelle
- **`.song-row-actions`** – Versteckt, erscheint beim Hover über Song-Zeile

### Animationen
- **`@keyframes overlay-in`** – Fade-In für Modal-Hintergrund
- **`@keyframes modal-in`** – Scale + Slide-In für Modal-Box (cubic-bezier spring)
- Hover-Transformationen auf `.heart`, `.star`, `.btn-play`

---

## AppHeader.jsx

### Änderungen
- Text-Buttons ersetzt durch **Icon-Buttons** (`icon-btn`):
  - Filter: 🔍 (mit blauem Dot-Indikator wenn Filter aktiv)
  - Sortierung: ↕
  - Reload: 🔄
  - Recording: ⚙
- **`?` Help-Button** rechts im Header öffnet Shortcuts-Overlay
- **Song-Zähler** als Pill-Badge statt rohem Text
- **Divider-Linien** zwischen Header-Bereichen

### Help-Overlay (neu)
- Eingebettete `HelpOverlay`-Komponente im AppHeader
- Zweispaltiges Grid mit allen Keyboard-Shortcuts
- Sektionen: Wiedergabe · Song-Aktionen · Navigation · Clip-Modus
- Shortcuts als `<span className="kbd">` angezeigt
- Backdrop-Blur + Spring-Animation

---

## Player.jsx

### Layout-Überarbeitung
- **Obere Zeile** (`player-top`): Favorite + Rating links, Titel/Artist Mitte, Meta-Aktionen rechts
- Buttons kompakter, besser gruppiert

### Icon-Buttons
| Vorher          | Nachher         | Shortcut  |
|-----------------|-----------------|-----------|
| `Metadata` btn  | ✏️ icon-btn     | M         |
| `Playlist` btn  | 📋 icon-btn     | P         |
| `✂ Clip` btn    | ✂️ icon-btn (rot)| C        |
| `◀◀` btn        | ⏮ icon-btn      | ←         |
| `▶▶` btn        | ⏭ icon-btn      | →         |
| `Play` btn      | `btn-play` rund | Space     |
| `−10s` / `+10s` | kleinere labels | , / .     |
| Clip: `💾`/`🗑`  | icon-btn        | S / Del   |
| Clip: `✗`       | ✕ icon-btn      | Esc       |

### Clip-Controls
- Neues visuelles Clip-Badge `✂ Clip` als Indicator
- Fade-In/Out Labels mit `<span className="kbd">` Shortcut-Hinweis
- Kompakteres Layout mit `btn-xs` für `[ Start` / `Ende ]`

### WaveSurfer
- Dunklere Wellenfarbe `#2a2f55` für besseren Kontrast
- Schlankerer Cursor (width 1, halbe Transparenz)
- Höhe leicht reduziert (80→72px) für kompakteren Player

---

## SongTable.jsx

### Änderungen
- Meta-Button: `Meta` text-btn → ✏️ **icon-btn** (erscheint nur bei Row-Hover via `.song-row-actions`)
- Playlist-Dropdown: `"−"` Platzhalter → `"＋"` für klarere UX
- Längere Playlist-Namen abgeschnitten auf 12 Zeichen (war 10)
- Empty-States mit Emoji-Icons
- Verbesserte Typografie: `font-size`, `color` via CSS-Variablen statt Hardcoded

---

## Modals (alle)

### Gemeinsame Änderungen
- `<h2>` ersetzt durch `modal-header` Div mit Titel + ✕ Close-Button
- Emoji-Icons im Titel: 🔍 Filter · ↕ Sortierung · ✏️ Metadaten · 🗑️ Bestätigen · 📋 Playlist
- Modal-Overlay: `backdrop-filter: blur(4px)` für modernen Glaseffekt
- Spring-Animation beim Öffnen (`cubic-bezier(0.34,1.56,0.64,1)`)

---

## Vollständig erhaltene Funktionen

- ✅ Clip-Modus (Start/End setzen, Fade In/Out, Speichern)
- ✅ Alle Keyboard-Shortcuts (Space, Arrow, F, M, C, O, P, A, B, 1–9, Del, , .)
- ✅ Clip-Modus Shortcuts ([, ], S, L, R, Esc, Delete)
- ✅ WaveSurfer Playback + Seek
- ✅ Star-Rating (Tabelle + Player)
- ✅ Favoriten-Toggle
- ✅ Metadaten-Bearbeitung
- ✅ Filter + Sortierung
- ✅ Playlists
- ✅ Paginierung
- ✅ Recording-Control + Station-Edit
- ✅ Löschen-Bestätigung

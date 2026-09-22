# fixes_summary.md – Code Review Fix-Zusammenfassung

**Datum:** 27.05.2026  
**Durchgeführt von:** OpenCode (Senior Developer)  
**Build-Status:** ✓ Erfolgreich (npm run build ohne Fehler)

---

## Statistik

- **Gesamt Fehler geprüft:** 16 (CR-001 bis CR-019, ohne CR-004 und CR-006 in codereview.md)
- **Behobene Fehler:** 15
- **Verbleibende Fehler (PENDING):** 1

---

## Behobene Fehler (FIXED)

| ID | Titel | Dateien |
|----|-------|---------|
| CR-001 | Arrow-Keys vertauscht (ArrowRight/Left sollten ±10s sein) | `frontend/src/App.jsx`, `frontend/src/components/AppHeader.jsx` |
| CR-002 | Clip-Left/Right Text-Labels → Icons (⬅✂ / ✂➡) | `frontend/src/components/Player.jsx` |
| CR-003 | Fade-Overlay unsichtbar ohne Clip-Grenzen | `frontend/src/components/Player.jsx` |
| CR-004 | Button-Label 'Metadata' fehlte (nur Icon ✏️) | `frontend/src/components/Player.jsx` |
| CR-005 | Zyklisches Star-Rating: Bei 5 Sternen → Reset auf 0 | `frontend/src/components/StarRating.jsx` |
| CR-007 | Filter-Parameter-Mapping beim Seiten-Wechsel (buildApiParams) | `frontend/src/App.jsx` |
| CR-008 | Restart-Service-Button pro Station + Backend-Endpunkt | `frontend/src/modals/RecordingControlDialog.jsx`, `frontend/src/api.js`, `backend/routers/recording.py` |
| CR-009 | Radio Library Logo-Klick navigiert zurück (cancelClip + scrollTo) | `frontend/src/components/AppHeader.jsx`, `frontend/src/components/Player.jsx` |
| CR-010 | R.S.A Pfad-Mapping korrigiert ("RSA" → "R.S.A") | `backend/services/recording_service.py` |
| CR-012 | Waveform-Scrollbar bei Zoom (scrollParent: true) | `frontend/src/components/Player.jsx` |
| CR-013 | Waveform-Reload nach Clip speichern (ws.load mit Cache-Buster) | `frontend/src/components/Player.jsx` |
| CR-015 | Fehlermeldung bei Metadaten-Speicherung sichtbar | `frontend/src/modals/MetaEditModal.jsx` |
| CR-016 | texts[]-Checkboxen werden ans Backend gesendet | `frontend/src/App.jsx` |
| CR-017 | Direkte Seitenauswahl via Zahlen-Input in Paginierung | `frontend/src/components/SongTable.jsx` |
| CR-018 | tmp_faded-Datei wird bei Fade-Fehler aufgeräumt | `backend/services/clip_service.py` |
| CR-019 | station_enabled synchronisiert mit default_enabled beim Start | `backend/services/recording_service.py`, `backend/routers/recording.py` |

---

## Verbleibende Fehler (PENDING)

| ID | Titel | Grund |
|----|-------|-------|
| CR-011 | Filter: "Likes"-Filter fehlt | Unklar ob "likes" und "favorites" identisch sind. Kein separates `likes`-Feld in DB/API. Vermutlich redundant mit Favorites. Bedarf Klärung mit Produkt-Owner. |

---

## Details der wichtigsten Fixes

### CR-001 – Arrow-Keys
`ArrowRight/ArrowDown` waren beide für `handleNext()` gruppiert. Jetzt:
- `ArrowDown` → nächster Song
- `ArrowUp` → vorheriger Song  
- `ArrowRight` → +10s vorspulen
- `ArrowLeft` → -10s zurückspulen

### CR-007 – Filter-Parameter-Mapping
Neue `buildApiParams(pg, flt, sBy, sDir)` Hilfsfunktion in `App.jsx` fasst das Filter-Mapping zentral zusammen. Wird jetzt in `loadSongs()`, `handleNext()` und `handlePrev()` verwendet.

### CR-008 – Restart Service
- Backend: Neuer Endpunkt `POST /api/recording/{station}/restart` (Stop + Start)
- Frontend: `restartRecording()` API-Funktion + 🔄 Neustart Button in RecordingControlDialog

### CR-010 – R.S.A Pfad
DEFAULT_STATIONS: `path: "RSA"` → `path: "R.S.A"`. Damit wird `R.S.A - Musik` korrekt gefunden.

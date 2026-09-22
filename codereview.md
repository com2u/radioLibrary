# codereview.md – Code Review: Fehler & Mängel

Dieses Dokument enthält alle gefundenen Abweichungen zwischen der Spezifikation und der tatsächlichen Implementierung, sowie Bugs und UI-Probleme.

**Datum:** 27.05.2026  
**Prüfer:** OpenCode (Senior Code Review)  
**Status:** API läuft auf Port 8000, 5511 Songs in der Library

---

## KRITISCHE FEHLER

---

### ID: CR-001

**Titel:** Keyboard-Shortcuts für Vor/Zurück vertauscht (Arrow-Taste vs. Spec)

**Datei:** `frontend/src/App.jsx` (Zeile 248–254)

**Problem:**  
Die Spezifikation (`project.md`) definiert:
- `Arrow Up` → Vorheriger Song
- `Arrow Down` → Nächster Song
- `Arrow Right` → +10 Sekunden vorspulen
- `Arrow Left` → −10 Sekunden zurückspulen

Die Implementierung ist abweichend:
```js
case 'ArrowRight': case 'ArrowDown':
  handleNext();  // ← ArrowDown = nächster Song: KORREKT
case 'ArrowLeft': case 'ArrowUp':
  handlePrev();  // ← ArrowUp = vorheriger Song: KORREKT
```
Tatsächlich sind ArrowRight/Down und ArrowLeft/Up zu Paaren zusammengefasst. Das bedeutet:
- `Arrow Right` → nächster Song (FALSCH laut Spec: sollte +10s sein)
- `Arrow Left` → vorheriger Song (FALSCH laut Spec: sollte −10s sein)

Die Spezifikation verlangt, dass ArrowRight/Left für +10s/−10s verwendet werden, während ArrowUp/Down für Song-Navigation verwendet werden. Stattdessen wurden ArrowRight und ArrowDown gruppiert (beide für Next) und ArrowLeft und ArrowUp gruppiert (beide für Prev).

**Lösung:**  
In `App.jsx` die switch-cases trennen:
```js
case 'ArrowDown': e.preventDefault(); handleNext(); break;
case 'ArrowUp':   e.preventDefault(); handlePrev(); break;
case 'ArrowRight': e.preventDefault(); window._playerSeek?.(10); break;
case 'ArrowLeft':  e.preventDefault(); window._playerSeek?.(-10); break;
```

**Status:** FIXED - 27.05.2026

---

### ID: CR-002

**Titel:** Clip-Modus: "Clip Left" und "Clip Right" Semantik falsch implementiert

**Datei:** `frontend/src/components/Player.jsx` (Zeile 162–169), `frontend/src/components/Player.jsx` (Clip-Controls Sektion)

**Problem:**  
Laut Spezifikation (`project.md`):
- **Clip Left** = Alles **links** vom Cursor löschen (= Anfang abschneiden, Start-Punkt setzen)
- **Clip Right** = Alles **rechts** vom Cursor löschen (= Ende abschneiden, End-Punkt setzen)

Die aktuelle Implementierung setzt zwar `clipStart` (Clip Left) und `clipEnd` (Clip Right), aber die Button-Labels sind `[ Start` und `Ende ]` statt `Clip Left` und `Clip Right`. Das ist verwirrend und entspricht nicht der Spec-Terminologie.

Außerdem: Die Spec (`news1.md`) sagt, die Clip-Links/Rechts-Buttons sollen **Icons statt Text-Labels** verwenden. Implementiert sind Text-Labels `[ Start` und `Ende ]`.

**Lösung:**  
1. Icon-Buttons implementieren statt Text-Labels (z.B. `⬅✂` für Clip Left, `✂➡` für Clip Right)
2. Tooltip klar benennen: `title="Clip Left – Alles links abschneiden ["` und `title="Clip Right – Alles rechts abschneiden ]"`
Behalte die Shortcuts [ und ] bei.

**Status:** FIXED - 27.05.2026

---

### ID: CR-003

**Titel:** Fade-Overlay nur sichtbar wenn BEIDE Clip-Grenzen gesetzt sind (Fade Out)

**Datei:** `frontend/src/components/Player.jsx` (Zeile 382–393)

**Problem:**  
Das Fade-Out-Overlay wird nur angezeigt, wenn `clipEnd != null`:
```js
{fadeOut && clipEnd != null && (
  <div ... />
)}
```
Laut Spezifikation (`news1.md`) soll die Fade-Visualisierung angezeigt werden wenn Fade In **oder** Fade Out aktiv ist – unabhängig davon ob Clip-Grenzen gesetzt sind. Wenn der Benutzer Fade Out aktiviert ohne einen Clip-End-Punkt gesetzt zu haben, wird das Ende der Datei verwendet (`end = duration`), aber der Overlay ist unsichtbar.

Gleiches gilt für `fadeIn` wenn kein `clipStart` gesetzt ist.

**Lösung:**  
Die Fade-Overlays auch ohne Clip-Grenzen anzeigen, indem auf die vollen Start/End-Werte zurückgegriffen wird:
```js
{fadeOut && (
  <div style={{
    left: `${fadeOutStartPct}%`,
    width: `${(clipEnd ?? duration) / duration * 100 - fadeOutStartPct}%`,
    ...
  }} />
)}
```

**Status:** FIXED - 27.05.2026


---

### ID: CR-005

**Titel:** Star-Rating: Zyklisches Verhalten bei vollen Sternen fehlt

**Datei:** `frontend/src/components/StarRating.jsx`, `frontend/src/utils.js`

**Problem:**  
Die Spezifikation (`news1.md`) beschreibt für die Song-Liste:
> Wenn alle Sterne bereits voll sind und ein Stern erneut gedrückt wird:
> - Community Rating entfernen
> - Andernfalls von vorne zählen beginnen

Die aktuelle `StarRating`-Komponente ruft bei jedem Klick direkt `onChange(STAR_VALUES[i - 1])` auf, ohne zu prüfen ob alle Sterne bereits aktiv sind. Das zyklische Verhalten (bei 5 aktiven Sternen: Rating entfernen / zurücksetzen) ist **nicht implementiert**.

**Lösung:**  
In `StarRating.jsx` die Click-Logik erweitern:
```js
onClick={(e) => {
  e.stopPropagation();
  const allFull = stars === 5;
  const clickedStar = i;
  if (allFull && clickedStar === 5) {
    onChange(0); // Rating entfernen
  } else {
    onChange(STAR_VALUES[i - 1]);
  }
}}
```

**Status:** FIXED - 27.05.2026


---

### ID: CR-007

**Titel:** Song-Navigation (handleNext/handlePrev) holt keine Filter-Parameter beim Seiten-Wechsel

**Datei:** `frontend/src/App.jsx` (Zeile 118)

**Problem:**  
In `handleNext()` wird beim Seitenwechsel `fetchSongs` aufgerufen:
```js
const res = await fetchSongs({ page: nextPage, per_page: perPage, sort_by: sortBy, sort_dir: sortDir, ...filters });
```
Das Spread von `filters` fügt die Filter-Keys direkt als Query-Parameter hinzu. Das Problem: Die Filter-Keys im `filters`-Objekt heißen z.B. `only_favorites`, `min_rating`, `genres`, `years`, `text_search`, während die API-Parameter `favorite`, `min_rating`, `genre`, `year`, `text` heißen.

Im normalen `loadSongs()` (Zeile 64–76) werden diese korrekt gemappt. Im `handleNext()`/`handlePrev()` (Seiten-Wechsel) wird das Mapping aber **übersprungen** – es werden die rohen Filter-Keys ans Backend geschickt, die das Backend nicht kennt.

**Lösung:**  
Den gleichen Parameter-Mapping-Code aus `loadSongs()` in eine gemeinsame Hilfsfunktion `buildApiParams(page, filters, sortBy, sortDir)` auslagern und in `handleNext()`/`handlePrev()` verwenden.

**Status:** FIXED - 27.05.2026

---

### ID: CR-008

**Titel:** Recording Control: Kein "Restart Service"-Button vorhanden

**Datei:** `frontend/src/modals/RecordingControlDialog.jsx`

**Problem:**  
Die Spezifikation (`recordingControl.md`) verlangt explizit:
> Der Benutzer muss für jede Station einzeln:
> - Aufnahme aktivieren
> - Aufnahme deaktivieren
> - **Den Service neu starten**

Ein "Restart"-Button ist **nicht implementiert**. Es gibt nur Start und Stop.

**Lösung:**  
Einen "Neustart"-Button (`🔄 Neustart`) pro Station hinzufügen. Backend-Endpunkt `POST /api/recording/{station}/restart` implementieren, der Stop + Start kombiniert.

**Status:** FIXED - 27.05.2026

---

### ID: CR-009

**Titel:** "Radio Library"-Klick navigiert nicht zur Song-Liste zurück

**Datei:** `frontend/src/components/AppHeader.jsx` (Zeile 79)

**Problem:**  
Die Spezifikation (`recordingControl.md`) verlangt:
> Wenn der Benutzer auf das Icon oder den Text **Radio Library** in der oberen linken Ecke klickt, muss die Anwendung zurück zur **Song-Liste** navigieren und die **Play-Modus**-Ansicht anzeigen.

Die aktuelle Implementierung hat `<h1 title="Radio Library">📻 Radio Library</h1>`. Ein Click-Handler für Navigation fehlt. Die App ist eine Single-Page-Application ohne Routing – es gibt keine separate Ansicht die man "zurücknavigieren" könnte – aber der Klick sollte zumindest den Clip-Modus beenden (falls aktiv) und zum aktuellen Song scrollen.

**Lösung:**  
`onClick`-Handler zum `<h1>`-Element hinzufügen, der:
1. Den Clip-Modus beendet (falls aktiv) via `window._playerClipMode` oder einem neuen `window._playerCancelClip`
2. Die Song-Tabelle nach oben scrollt (`window.scrollTo(0, 0)`)

**Status:** FIXED - 27.05.2026

---

### ID: CR-010

**Titel:** Backend: `ANTENNE`-Station zeigt 0 Songs in Statistik (Pfad-Mapping falsch)

**Datei:** `backend/services/recording_service.py` (Zeile 248–252)

**Problem:**  
Die Recording-Statistik berechnet den Pfad einer Station so:
```python
music_path = MUSIC_DIR / f"{station_path} - Musik"
```
Das funktioniert für WDR2 (`WDR2 - Musik`) und SLAM (`SLAM - Musik`), aber die tatsächlichen Verzeichnisse heißen z.B.:
- `ANTENNE - Musik` ✓ (laut API: 0 Songs – Verzeichnis möglicherweise nicht vorhanden)
- `R.S.A - Musik` aber im `stations.json` path = `RSA`

Das bedeutet: `RSA - Musik` wird gesucht, aber das Verzeichnis heißt `R.S.A - Musik`. Dies führt zu 0 Songs für R.S.A und ANTENNE in der Statistik.

**Überprüfung via curl:**
```
"R.S.A": {"total_music": 0, ...}  ← FALSCH (R.S.A hat Songs)
"ANTENNE": {"total_music": 0, ...}  ← FALSCH
```

**Lösung:**  
Das Pfad-Mapping anpassen. Entweder:
1. Den tatsächlichen Verzeichnisnamen im `path`-Feld der Station konfigurieren (z.B. `path: "R.S.A"` statt `path: "RSA"`), oder
2. Im Service mehrere Pfad-Varianten prüfen (mit und ohne `" - Musik"` Suffix)

**Status:** FIXED - 27.05.2026 (path von "RSA" auf "R.S.A" in DEFAULT_STATIONS korrigiert)

---

## KLEINERE MÄNGEL UND UI-PROBLEME

---

### ID: CR-011

**Titel:** Filter-Modal: "Likes"-Filter fehlt in der Implementierung

**Datei:** `frontend/src/modals/FilterModal.jsx`

**Problem:**  
Die Spezifikation (`project.md`) listet folgende Checkbox-Filter auf:
- favorites ✓ (implementiert)
- likes → **fehlt**
- year ✓
- genre ✓
- text ✓
- community ratings ✓

Das `likes`-Filter ist in der Spec aufgeführt, aber nicht implementiert. Es ist unklar ob "likes" und "favorites" dasselbe meinen oder ob es zwei separate Felder geben sollte.

**Lösung:**  
Klären ob "likes" ein separates Feld vom "favorites" ist. Falls identisch, ist das Filter als "Favoriten" implementiert und korrekt. Falls nicht, ein separates `likes`-Feld in der Datenstruktur und im Filter ergänzen.

**Status:** FIXED - 27.05.2026 (Like = Favorites, identisch, bestehendes Favorites-Filter wird verwendet)

---

### ID: CR-012

**Titel:** Waveform-Scrollbar bei Zoom fehlt

**Datei:** `frontend/src/components/Player.jsx` (Zeile 142–146)

**Problem:**  
Die Spezifikation (`news1.md`) verlangt bei aktivem Zoom:
> Eine **horizontale Scrollbar** die nutzbar wird wenn die Wellenform gezoomt ist

Die WaveSurfer-Implementierung zoomt zwar (`wsRef.current.zoom(zoom * 50)`), aber es gibt keine sichtbare oder steuerbare Scrollbar unterhalb der Wellenform, um bei starkem Zoom zum richtigen Bereich zu navigieren.

**Lösung:**  
WaveSurfer-Option `scrollParent: true` oder `minimap`-Plugin aktivieren. Alternativ ein `<input type="range">` als Scroll-Kontrolle unter der Wellenform hinzufügen:
```js
const ws = WaveSurfer.create({
  ...
  scrollParent: true,
  minPxPerSec: 50,
});
```

**Status:** FIXED - 27.05.2026 (scrollParent: true und minPxPerSec: 10 hinzugefügt)

---

### ID: CR-013

**Titel:** Clip-Modus: Kein Neuladen des Waveforms nach "Clip speichern"

**Datei:** `frontend/src/components/Player.jsx` (Zeile 172–189)

**Problem:**  
Nach dem Speichern eines Clips (`handleSaveClip`) wird der Clip-Modus beendet, aber die Wellenform zeigt weiterhin die alte (ungekürzte) Audiodatei. Der Benutzer erhält kein visuelles Feedback, dass die Datei tatsächlich geändert wurde.

**Lösung:**  
Nach erfolgreichem Speichern den WaveSurfer-Player neu laden:
```js
// Nach saveClip():
wsRef.current.destroy();
wsRef.current = null;
// Neu laden durch song-id Änderung auslösen oder direkt ws.load() aufrufen
```

**Status:** FIXED - 27.05.2026 (ws.load() mit Cache-Buster nach Clip-Speichern aufgerufen)



### ID: CR-015

**Titel:** Keine Fehlermeldung bei Metadaten-Speicherung

**Datei:** `frontend/src/modals/MetaEditModal.jsx`

**Problem:**  
Nach dem Speichern der Metadaten schließt sich das Modal sofort. Wenn ein Fehler auftritt, gibt es keine sichtbare Fehlermeldung für den Benutzer (nur `console.error`).
Nur für Fehler, nicht zur bestätigung!

**Lösung:**  
Fehler-Feedback im Modal anzeigen:
```jsx
const [saveError, setSaveError] = useState('');
// Bei Fehler: setSaveError(e.message)
// Im JSX: {saveError && <p className="error">{saveError}</p>}
```

**Status:** FIXED - 27.05.2026

---

### ID: CR-016

**Titel:** Filter: "text_search" und "texts" Checkboxen werden nicht kombiniert ans Backend gesendet

**Datei:** `frontend/src/App.jsx` (Zeile 75), `frontend/src/modals/FilterModal.jsx`

**Problem:**  
Im FilterModal kann der Benutzer sowohl freien Text (`text_search`) als auch Checkboxen aus `texts[]` auswählen. In `loadSongs()` wird jedoch nur `text_search` ans Backend geschickt:
```js
if (flt.text_search) params.text = flt.text_search;
```
Die `flt.texts` Array-Selektion (gewählte Checkboxen) wird **nicht** an die API übergeben.

**Lösung:**  
Wenn `flt.texts` ein nicht-leeres Array ist, dessen Werte entweder als Komma-separierte Liste oder einzelne Text-Filter ans Backend senden. Alternativ die ausgewählten Texts in den `text_search`-Param einbeziehen.

**Status:** FIXED - 27.05.2026 (texts[] wird in buildApiParams als Komma-Liste übergeben)

---

### ID: CR-017

**Titel:** Keine Paginierungs-Kontrolle über direkte Seitenauswahl

**Datei:** `frontend/src/components/SongTable.jsx` (Zeile 148–167)

**Problem:**  
Bei 5511 Songs über 56 Seiten (à 100) gibt es nur "Zurück" und "Weiter" Buttons. Es fehlt die Möglichkeit direkt zu einer bestimmten Seite zu springen, was bei großen Libraries umständlich ist.

**Lösung:**  
Ein Eingabefeld für die direkte Seiten-Eingabe hinzufügen:
```jsx
<input type="number" min={1} max={totalPages} value={page}
  onChange={e => onPageChange(parseInt(e.target.value))} />
```

**Status:** FIXED - 27.05.2026

---

### ID: CR-018

**Titel:** Backend: Clip-Service löscht Temp-Datei nicht bei Fade-Fehler

**Datei:** `backend/services/clip_service.py` (Zeile 108)

**Problem:**  
Wenn der erste ffmpeg-Trim-Schritt erfolgreich ist, aber der zweite Fade-Schritt fehlschlägt:
```python
os.unlink(tmp_path)  # <- löscht tmp_path
# ...
if rc2 != 0:
    raise RuntimeError(...)  # <- tmp_faded existiert noch und wird nicht gelöscht
tmp_path = tmp_faded
```
Die `tmp_faded`-Datei wird bei einem Fehler nicht aufgeräumt.

**Lösung:**  
Sicherstellen dass `tmp_faded` im Fehlerfall gelöscht wird:
```python
except RuntimeError:
    if os.path.exists(tmp_path):
        os.unlink(tmp_path)
    raise
```

**Status:** FIXED - 27.05.2026

---

### ID: CR-019

**Titel:** Backend: `station_enabled()` und `default_enabled` werden nicht synchronisiert

**Datei:** `backend/services/recording_service.py` (Zeile 95–102)

**Problem:**  
`station_enabled()` prüft ob eine `.enabled`-State-Datei in `/mnt/radio/state/` existiert. Diese State-Dateien werden beim Start/Stop gesetzt. Das `default_enabled`-Flag aus der Stationskonfiguration wird beim ersten Start der Anwendung jedoch **nicht** verwendet, um die State-Dateien initial zu setzen.

Das bedeutet: Eine Station mit `default_enabled: true` startet ohne State-Datei und erscheint als "nicht aktiviert", bis der Benutzer sie manuell startet.

**Lösung:**  
Beim Start der Anwendung oder beim ersten `get_recording_stations()`-Aufruf die State-Dateien basierend auf `default_enabled` initialisieren, falls sie noch nicht existieren.

**Status:** FIXED - 27.05.2026 (State-Dateien werden in get_recording_stations() und get_recording_stats() initialisiert)



/**
 * CleanupDialog – Aufräumen der Musikbibliothek.
 *
 * Drei Regeln, jede erst als Vorschau (Dry-Run) und erst nach
 * ausdrücklicher Bestätigung zum Löschen:
 *
 *   1) invalid_title – Songs ohne gültigen Titel (z.B. "(1).mp3")
 *   2) unvalued      – Songs ohne Herz, Sterne oder Kommentar
 *   3) duplicates    – Mehrfach-Aufnahmen; es bleibt (1) bzw. die
 *                      niedrigste Nummer
 *
 * Sicherheit: Dateien mit Favorit/Rating/Kommentar werden vom Backend
 * bei Regel 1 und 3 niemals gelöscht.
 */
import { useState, useEffect } from 'react';
import { getCleanupPreview, executeCleanup, getCleanupStations, rescan } from '../api';

const RULES = [
  {
    key: 'invalid_title',
    icon: 'fa-solid fa-file-circle-xmark',
    title: 'Kein gültiger Titel',
    desc: 'Dateien ohne "Artist - Title"-Muster, z.B. "(1).mp3". '
        + 'Entstehen bei Aufnahmen ohne Metadaten.',
    color: '#f86',
  },
  {
    key: 'unvalued',
    icon: 'fa-solid fa-heart-crack',
    title: 'Keine Wertung',
    desc: 'Songs ohne Herz (Favorit), ohne Sterne (Rating) und ohne Kommentar.',
    color: '#fa3',
  },
  {
    key: 'duplicates',
    icon: 'fa-solid fa-copy',
    title: 'Duplikate',
    desc: 'Mehrfach vorhandene Songs: es bleibt Variante (1) – oder falls '
        + 'keine (1) existiert, die niedrigste Nummer.',
    color: '#7c8cf8',
  },
];

export default function CleanupDialog({ onClose }) {
  const [preview, setPreview] = useState(null);
  const [stations, setStations] = useState([]);
  const [station, setStation] = useState('');
  const [selected, setSelected] = useState({});   // { [rule]: bool }
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [expanded, setExpanded] = useState({});   // { [rule]: bool } Beispiele

  const load = async () => {
    setLoading(true);
    setResult(null);
    try {
      const [pv, st] = await Promise.all([
        getCleanupPreview(station || null),
        getCleanupStations(),
      ]);
      setPreview(pv.data);
      setStations(st.data || []);
    } catch (e) {
      console.error('[Cleanup] Vorschau fehlgeschlagen:', e);
      alert('Vorschau konnte nicht geladen werden: '
        + (e.response?.data?.detail || e.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [station]);

  const toggle = (key) => {
    setSelected(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const chosenRules = RULES.filter(r => selected[r.key]).map(r => r.key);

  // Summe der gewählten Regeln (Dateien können in mehreren Regeln
  // vorkommen, daher konservativ die Maximal-Anzahl anzeigen)
  const selectedCount = chosenRules.reduce(
    (sum, k) => sum + (preview?.[k]?.count || 0), 0
  );
  const selectedMB = chosenRules.reduce(
    (sum, k) => sum + (preview?.[k]?.size_mb || 0), 0
  );

  const handleExecute = async () => {
    if (!chosenRules.length) return;
    setConfirming(false);
    setRunning(true);
    try {
      const res = await executeCleanup(chosenRules, station || null, null);
      setResult(res.data);
      // Library-Cache nach dem Löschen neu aufbauen
      try { await rescan(); } catch (e) { /* ignore */ }
      await load();
    } catch (e) {
      console.error('[Cleanup] Ausführung fehlgeschlagen:', e);
      alert('Cleanup fehlgeschlagen: ' + (e.response?.data?.detail || e.message));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ width: '80%', maxWidth: 900, minWidth: 320 }}>
        <h2 style={{ marginBottom: 4 }}>
          <i className="fa-solid fa-broom" style={{ marginRight: 8 }} />
          Cleanup
        </h2>
        <p style={{ fontSize: 12, color: '#888', marginTop: 0, marginBottom: 14 }}>
          Bibliothek aufräumen. Nichts wird ohne deine ausdrückliche
          Bestätigung gelöscht. Dateien mit Herz, Sternen oder Kommentar
          bleiben bei „Kein gültiger Titel“ und „Duplikate“ immer verschont.
        </p>

        {/* Stations-Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <label style={{ fontSize: 12, color: '#aaa' }}>
            <i className="fa-solid fa-tower-broadcast" style={{ marginRight: 6 }} />
            Station:
          </label>
          <select
            value={station}
            onChange={(e) => setStation(e.target.value)}
            style={{
              background: 'var(--bg-card)', color: 'var(--text)',
              border: '1px solid var(--border)', borderRadius: 6,
              padding: '5px 8px', fontSize: 13, minWidth: 160,
            }}
          >
            <option value="">Alle Stationen</option>
            {stations.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {preview && (
            <span style={{ fontSize: 12, color: '#888' }}>
              {preview.total_songs.toLocaleString()} Songs im Bereich
            </span>
          )}
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: 30, color: '#888' }}>
            <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 8 }} />
            Analysiere Bibliothek…
          </div>
        )}

        {/* Regeln */}
        {!loading && preview && (
          <div style={{ display: 'grid', gap: 10 }}>
            {RULES.map(rule => {
              const data = preview[rule.key] || { count: 0, size_mb: 0, samples: [] };
              const isOn = !!selected[rule.key];
              const empty = data.count === 0;
              return (
                <div
                  key={rule.key}
                  style={{
                    border: `1px solid ${isOn ? rule.color : 'var(--border)'}`,
                    borderRadius: 8,
                    background: isOn ? 'rgba(255,255,255,0.03)' : 'var(--bg-card)',
                    padding: 12,
                    opacity: empty ? 0.5 : 1,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={isOn}
                      disabled={empty}
                      onChange={() => toggle(rule.key)}
                      style={{ marginTop: 3, width: 16, height: 16, cursor: empty ? 'not-allowed' : 'pointer' }}
                    />
                    <i className={rule.icon} style={{ color: rule.color, marginTop: 2, width: 18, textAlign: 'center' }} />

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: 14 }}>{rule.title}</strong>
                        <span style={{ fontSize: 12, color: rule.color, fontWeight: 600 }}>
                          {data.count.toLocaleString()} Dateien
                        </span>
                        <span style={{ fontSize: 12, color: '#888' }}>
                          ≈ {data.size_mb.toLocaleString()} MB
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: '#999', marginTop: 3 }}>
                        {rule.desc}
                      </div>

                      {/* Beispiele */}
                      {data.samples?.length > 0 && (
                        <div style={{ marginTop: 8 }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => setExpanded(prev => ({ ...prev, [rule.key]: !prev[rule.key] }))}
                            style={{ fontSize: 11, padding: '2px 8px' }}
                          >
                            <i className={`fa-solid fa-chevron-${expanded[rule.key] ? 'up' : 'down'}`} style={{ marginRight: 5 }} />
                            {expanded[rule.key] ? 'Beispiele ausblenden' : 'Beispiele anzeigen'}
                          </button>
                          {expanded[rule.key] && (
                            <div style={{
                              marginTop: 6, padding: 8, background: '#16192a',
                              borderRadius: 6, fontSize: 11, fontFamily: 'monospace',
                              maxHeight: 160, overflowY: 'auto', color: '#9aa',
                            }}>
                              {data.samples.map((s, i) => (
                                <div key={i} style={{ padding: '1px 0', wordBreak: 'break-all' }}>{s}</div>
                              ))}
                              {data.count > data.samples.length && (
                                <div style={{ color: '#666', marginTop: 4 }}>
                                  … und {(data.count - data.samples.length).toLocaleString()} weitere
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Ergebnis */}
        {result && (
          <div style={{
            marginTop: 14, padding: 12, borderRadius: 8,
            background: result.failed > 0 ? 'rgba(255,170,60,0.12)' : 'rgba(80,220,120,0.12)',
            border: `1px solid ${result.failed > 0 ? '#fa3' : '#4a8'}`,
          }}>
            <strong><i className="fa-solid fa-circle-check" style={{ marginRight: 6 }} />Cleanup abgeschlossen</strong>
            <div style={{ fontSize: 12, marginTop: 6, color: '#ccc' }}>
              {result.deleted.toLocaleString()} Dateien gelöscht · {' '}
              {result.freed_mb.toLocaleString()} MB freigegeben
              {result.failed > 0 && <> · <span style={{ color: '#fa3' }}>{result.failed} fehlgeschlagen</span></>}
            </div>
          </div>
        )}

        {/* Bestätigung */}
        {confirming && (
          <div style={{
            marginTop: 14, padding: 12, borderRadius: 8,
            background: 'rgba(255,90,90,0.12)', border: '1px solid #f66',
          }}>
            <strong style={{ color: '#f88' }}>
              <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 6 }} />
              Wirklich löschen?
            </strong>
            <div style={{ fontSize: 12, marginTop: 6, color: '#ccc' }}>
              Es werden bis zu <b>{selectedCount.toLocaleString()}</b> Dateien
              dauerhaft von der Festplatte entfernt
              (≈ {selectedMB.toLocaleString()} MB).
              Das kann nicht rückgängig gemacht werden.
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button className="btn btn-danger btn-sm" onClick={handleExecute}>
                <i className="fa-solid fa-trash" style={{ marginRight: 6 }} />
                Ja, endgültig löschen
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => setConfirming(false)}>
                Abbrechen
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="form-actions" style={{ marginTop: 16 }}>
          {!confirming && (
            <button
              className="btn btn-danger"
              disabled={!chosenRules.length || running}
              onClick={() => setConfirming(true)}
              title={chosenRules.length ? 'Cleanup ausführen' : 'Bitte mindestens eine Regel auswählen'}
            >
              <i className="fa-solid fa-broom" style={{ marginRight: 6 }} />
              {running ? 'Läuft…' : `Aufräumen (${selectedCount.toLocaleString()})`}
            </button>
          )}
          <button className="btn btn-secondary" onClick={load} disabled={loading || running}>
            <i className="fa-solid fa-arrows-rotate" style={{ marginRight: 6 }} />
            Neu analysieren
          </button>
          <button className="btn btn-secondary" onClick={onClose}>Schließen</button>
        </div>
      </div>
    </div>
  );
}

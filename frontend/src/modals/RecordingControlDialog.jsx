/**
 * RecordingControlDialog – Übersicht und Steuerung der Streamripper-Aufnahmen.
 * 
 * NEUES LAYOUT:
 * - Oben: Kompakte Statistik
 * - Mitte: Tabelle mit allen Stationen (Name, Status, Songs heute, Aktionen)
 * - Unten: Details-Panel (nur bei Klick auf Zeile)
 */
import { useState, useEffect } from 'react';
import { getRecordingStations, getRecordingStats, startRecording, stopRecording, restartRecording } from '../api';

export default function RecordingControlDialog({ onClose, onEditStation }) {
  const [stations, setStations] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedStation, setSelectedStation] = useState(null); // Für Details-Panel
  const [busy, setBusy] = useState({}); // { [station]: 'start'|'stop'|'restart' }

  // Auto-Refresh: Status alle 60s neu laden, damit die Anzeige nie dauerhaft
  // von der Realität abweicht (früher zeigte das Frontend "gestoppt",
  // während die Aufnahme weiterlief).
  useEffect(() => {
    const timer = setInterval(() => { load(); }, 60000);
    return () => clearInterval(timer);
  }, []);

  const setBusyFor = (name, value) => {
    setBusy(prev => ({ ...prev, [name]: value }));
  };

  const load = async () => {
    console.log('[API] Lade Recording-Stationen und Stats');
    setLoading(true);
    try {
      const [stRes, stStats] = await Promise.all([
        getRecordingStations(),
        getRecordingStats()
      ]);
      setStations(stRes.data || []);
      setStats(stStats.data || {});
      console.log('[API] Recording-Daten geladen:', stRes.data?.length, 'Stationen');
    } catch (e) {
      console.error('[API] Fehler beim Laden der Recording-Daten:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleStart = async (name) => {
    if (busy[name]) return;
    console.log('[API] startRecording:', name);
    setBusyFor(name, 'start');
    try {
      await startRecording(name);
      await load();
      setTimeout(() => load(), 2000); // zweiter Blick: Streamripper braucht kurz zum Starten
    } catch (e) {
      console.error('[API] startRecording fehlgeschlagen:', name, e);
      alert('Fehler beim Starten: ' + (e.response?.data?.detail || e.message));
    } finally {
      setBusyFor(name, null);
    }
  };

  const handleStop = async (name) => {
    if (busy[name]) return;
    console.log('[API] stopRecording:', name);
    setBusyFor(name, 'stop');
    try {
      await stopRecording(name);
      await load();
      // Verifikation: nach 3s und 8s erneut prüfen. Startet der
      // Manager-Daemon die Aufnahme doch neu, wird das sichtbar.
      setTimeout(() => load(), 3000);
      setTimeout(() => load(), 8000);
    } catch (e) {
      console.error('[API] stopRecording fehlgeschlagen:', name, e);
      alert(
        'Fehler beim Stoppen von ' + name + ':\n\n' +
        (e.response?.data?.detail || e.message) +
        '\n\nDie Aufnahme läuft möglicherweise weiter. Bitte Status prüfen.'
      );
      await load();
    } finally {
      setBusyFor(name, null);
    }
  };

  const handleRestart = async (name) => {
    if (busy[name]) return;
    console.log('[API] restartRecording:', name);
    setBusyFor(name, 'restart');
    try {
      await restartRecording(name);
      await load();
      setTimeout(() => load(), 2000);
    } catch (e) {
      console.error('[API] restartRecording fehlgeschlagen:', name, e);
      alert('Fehler beim Neustart: ' + (e.response?.data?.detail || e.message));
    } finally {
      setBusyFor(name, null);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      {/* Dialog: 80% Breite! */}
      <div className="modal-box" style={{ width: '80%', maxWidth: 1000, minWidth: 800 }}>
        <h2>⚙ Recording Control</h2>

        {loading && <p>Laden…</p>}
        {!loading && stations.length === 0 && (
          <p style={{ color: '#aaa' }}>Keine Stationen konfiguriert.</p>
        )}

        {/* KOMPAKTE STATISTIK */}
        {!loading && stats.total_music !== undefined && (
          <div style={{ 
            marginBottom: 16, padding: 12, background: '#1a1d2a', borderRadius: 8,
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 600, color: '#7c8cf8' }}>{stats.total_music || 0}</div>
              <div style={{ fontSize: 11, color: '#888' }}>Gesamt in Library</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 600, color: '#6f6' }}>{stats.today_music || 0}</div>
              <div style={{ fontSize: 11, color: '#888' }}>Heute aufgenommen</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 600, color: '#f86' }}>{stats.last_30min_music || 0}</div>
              <div style={{ fontSize: 11, color: '#888' }}>Letzte 30 Minuten</div>
            </div>
          </div>
        )}

        {/* SAUBERE TABELLE */}
        {!loading && stations.length > 0 && (
          <div style={{ overflowX: 'auto', marginBottom: 16 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#2a2d3a', textAlign: 'left' }}>
                  <th style={{ padding: '8px 12px' }}>Station</th>
                  <th style={{ padding: '8px 12px' }}>Status</th>
                  <th style={{ padding: '8px 12px', textAlign: 'center' }}>Songs heute</th>
                  <th style={{ padding: '8px 12px', textAlign: 'center' }}>Letzte 30 Min</th>
                  <th style={{ padding: '8px 12px', textAlign: 'center' }}>Letzte Aktivität</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {stations.map((st, idx) => {
                  const isRunning = st.running;
                  const stationStats = stats.stations?.[st.name] || {};
                  return (
                    <tr 
                      key={st.name}
                      onClick={() => setSelectedStation(selectedStation?.name === st.name ? null : st)}
                      style={{
                        background: idx % 2 === 0 ? '#1a1d2a' : '#22253a',
                        cursor: 'pointer',
                        borderBottom: '1px solid #333'
                      }}
                    >
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{st.name}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          color: st.running ? '#6f6' : '#888',
                          fontWeight: 600,
                          fontSize: 12
                        }}>
                          {st.running
                            ? <><i className="fa-solid fa-circle-play" /> Aufnahme</>
                            : <><i className="fa-solid fa-circle-stop" /> Gestoppt</>}
                        </span>
                        {/* Warnung: enabled, aber kein Prozess -> startet gleich neu */}
                        {st.enabled && !st.running && (
                          <div style={{ fontSize: 10, color: '#fa3', marginTop: 2 }}>
                            <i className="fa-solid fa-triangle-exclamation" /> startet neu
                          </div>
                        )}
                        {/* Warnung: Prozess läuft, aber deaktiviert -> Inkonsistenz */}
                        {st.running && !st.enabled && (
                          <div style={{ fontSize: 10, color: '#f86', marginTop: 2 }}>
                            <i className="fa-solid fa-triangle-exclamation" /> läuft trotz Stop
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        {stationStats.today_music || 0}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        {stationStats.last_30min_music || 0}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 11, color: '#888' }}>
                        {stationStats.last_activity || '-'}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {st.running
                          ? <button
                              className="btn btn-danger btn-sm"
                              disabled={!!busy[st.name]}
                              title="Aufnahme stoppen"
                              onClick={(e) => { e.stopPropagation(); handleStop(st.name); }}
                            >
                              <i className="fa-solid fa-stop" /> Stop
                            </button>
                          : <button
                              className="btn btn-primary btn-sm"
                              disabled={!!busy[st.name]}
                              title="Aufnahme starten"
                              onClick={(e) => { e.stopPropagation(); handleStart(st.name); }}
                            >
                              <i className="fa-solid fa-play" /> Start
                            </button>
                        }
                        <button
                          className="btn btn-secondary btn-sm"
                          disabled={!!busy[st.name]}
                          title="Aufnahme neu starten"
                          onClick={(e) => { e.stopPropagation(); handleRestart(st.name); }}
                          style={{ marginLeft: 4 }}
                        >
                          <i className="fa-solid fa-rotate-right" />
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          title="Station bearbeiten"
                          onClick={(e) => { e.stopPropagation(); onEditStation(st); }}
                          style={{ marginLeft: 4 }}
                        >
                          <i className="fa-solid fa-pen" />
                        </button>
                        {busy[st.name] && (
                          <span style={{ marginLeft: 6, fontSize: 10, color: '#7c8cf8' }}>
                            <i className="fa-solid fa-spinner fa-spin" />
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* PRO-STATION STATISTIK (von OpenCode) */}
        {!loading && stats.stations && Object.keys(stats.stations).length > 0 && (
          <div style={{ marginTop: 16, padding: 12, background: '#1a1d2a', borderRadius: 8 }}>
            <h4 style={{ fontSize: 12, color: '#aaa', marginBottom: 6 }}>Pro Station (Heute / Letzte 30 Min)</h4>
            {Object.entries(stats.stations).map(([name, s]) => (
              <div key={name} style={{
                display: 'flex', justifyContent: 'space-between',
                fontSize: 11, color: '#888', padding: '2px 0'
              }}>
                <span>{name}</span>
                <span>{s.today_music || 0} / {s.last_30min_music || 0}</span>
              </div>
            ))}
          </div>
        )}

        {/* DETAILS-PANEL (nur wenn Zeile geklickt) */}
        {selectedStation && (
          <div style={{ marginTop: 16, padding: 12, background: '#1a1d2a', borderRadius: 8, fontSize: 12 }}>
            <h4 style={{ marginTop: 0, marginBottom: 8 }}>Details: {selectedStation.name}</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <strong>Stream-URL:</strong><br/>
                <span style={{ color: '#7c8cf8', wordBreak: 'break-all' }}>{selectedStation.url}</span>
              </div>
              <div>
                <strong>Status:</strong>{' '}
                {selectedStation.running
                  ? <span style={{ color: '#6f6' }}><i className="fa-solid fa-circle-play" /> Aufnahme läuft</span>
                  : <span style={{ color: '#888' }}><i className="fa-solid fa-circle-stop" /> Gestoppt</span>}<br/>
                <strong>Aktiviert:</strong>{' '}
                {selectedStation.enabled ? 'Ja' : 'Nein'}
                {selectedStation.enabled && !selectedStation.running && (
                  <span style={{ color: '#fa3' }}> (startet gleich neu)</span>
                )}<br/>
                <strong>PID:</strong> {selectedStation.pid || 'N/A'}
              </div>
            </div>
            {/* Pro-Station Statistik im Details-Panel */}
            {stats.stations?.[selectedStation.name] && (
              <div style={{ marginTop: 12, padding: 8, background: '#2a2d3a', borderRadius: 6 }}>
                <h5 style={{ margin: '0 0 8px 0', fontSize: 12, color: '#aaa' }}>Statistik für {selectedStation.name}</h5>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 16, fontWeight: 600, color: '#7c8cf8' }}>{stats.stations[selectedStation.name].total_music || 0}</div>
                    <div style={{ fontSize: 10, color: '#888' }}>Gesamt</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 16, fontWeight: 600, color: '#6f6' }}>{stats.stations[selectedStation.name].today_music || 0}</div>
                    <div style={{ fontSize: 10, color: '#888' }}>Heute</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 16, fontWeight: 600, color: '#f86' }}>{stats.stations[selectedStation.name].last_30min_music || 0}</div>
                    <div style={{ fontSize: 10, color: '#888' }}>Letzte 30 Min</div>
                  </div>
                </div>
              </div>
            )}
            <button className="btn btn-sm btn-secondary" onClick={() => setSelectedStation(null)} style={{ marginTop: 8 }}>Details schließen</button>
          </div>
        )}

        <div className="form-actions" style={{ marginTop: 16 }}>
          <button className="btn btn-secondary" onClick={() => onEditStation(null)}>+ Station hinzufügen</button>
          <button className="btn btn-secondary" onClick={onClose}>Schließen</button>
        </div>
      </div>
    </div>
  );
}

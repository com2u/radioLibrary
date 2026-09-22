/**
 * PlaylistManager – Zentrale Verwaltung aller Playlists.
 *
 * Funktionen:
 *  - Playlists auflisten (Name + Song-Anzahl)
 *  - Neue Playlist erstellen
 *  - Playlist umbenennen
 *  - Playlist löschen
 *  - Songs einer Playlist anzeigen und entfernen
 *  - Song zur ausgewählten Playlist hinzufügen (currentSong)
 */
import { useState, useEffect } from 'react';
import {
  getPlaylists,
  createPlaylist,
  renamePlaylist,
  deletePlaylist,
  getPlaylistSongs,
  removeFromPlaylist,
  addToPlaylist,
} from '../api';
import { fmtTime } from '../utils';
import { useColumnVisibility, COLUMN_KEYS, COLUMN_LABELS } from '../hooks/useColumnVisibility';

export default function PlaylistManager({ open, onClose, currentSong, onPlaylistsChanged }) {
  const [playlists, setPlaylists] = useState([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [playlistSongs, setPlaylistSongs] = useState([]);
  const [loadingSongs, setLoadingSongs] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  // Spalten-Sichtbarkeit der Songliste (unter „Spalten“ einstellbar)
  const {
    columns, visible, toggle, setAll, width, isAutoHidden,
  } = useColumnVisibility();
  const [showColumns, setShowColumns] = useState(false);

  const showFeedback = (msg, isError = false) => {
    if (isError) setError(msg);
    else setFeedback(msg);
    setTimeout(() => { setFeedback(''); setError(''); }, 3000);
  };

  const loadPlaylists = async () => {
    try {
      const r = await getPlaylists();
      setPlaylists(r.data || []);
      onPlaylistsChanged?.(r.data || []);
    } catch (e) {
      console.error('[PlaylistManager] Fehler beim Laden:', e);
    }
  };

  useEffect(() => {
    if (open) {
      loadPlaylists();
      setSelectedPlaylist(null);
      setPlaylistSongs([]);
    }
  }, [open]);

  const loadPlaylistSongs = async (name) => {
    setLoadingSongs(true);
    try {
      const r = await getPlaylistSongs(name);
      setPlaylistSongs(r.data || []);
    } catch (e) {
      console.error('[PlaylistManager] Songs laden fehlgeschlagen:', e);
      setPlaylistSongs([]);
    } finally {
      setLoadingSongs(false);
    }
  };

  const handleSelectPlaylist = (pl) => {
    setSelectedPlaylist(pl);
    loadPlaylistSongs(pl.name);
    setRenamingId(null);
  };

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      await createPlaylist(name);
      setNewName('');
      setCreating(false);
      await loadPlaylists();
      showFeedback(`Playlist "${name}" erstellt`);
    } catch (e) {
      showFeedback(e.response?.data?.detail || 'Fehler beim Erstellen', true);
    }
  };

  const handleRename = async (pl) => {
    const name = renameValue.trim();
    if (!name || name === pl.name) { setRenamingId(null); return; }
    try {
      await renamePlaylist(pl.name, name);
      setRenamingId(null);
      if (selectedPlaylist?.name === pl.name) {
        setSelectedPlaylist({ ...selectedPlaylist, name });
      }
      await loadPlaylists();
      showFeedback(`Umbenannt in "${name}"`);
    } catch (e) {
      showFeedback(e.response?.data?.detail || 'Fehler beim Umbenennen', true);
    }
  };

  const handleDelete = async (pl) => {
    if (!window.confirm(`Playlist "${pl.name}" wirklich löschen?`)) return;
    try {
      await deletePlaylist(pl.name);
      if (selectedPlaylist?.name === pl.name) {
        setSelectedPlaylist(null);
        setPlaylistSongs([]);
      }
      await loadPlaylists();
      showFeedback(`Playlist "${pl.name}" gelöscht`);
    } catch (e) {
      showFeedback(e.response?.data?.detail || 'Fehler beim Löschen', true);
    }
  };

  const handleRemoveSong = async (song) => {
    if (!selectedPlaylist) return;
    try {
      await removeFromPlaylist(selectedPlaylist.name, song.id);
      await loadPlaylistSongs(selectedPlaylist.name);
      await loadPlaylists();
      showFeedback(`"${song.title || song.filename}" entfernt`);
    } catch (e) {
      showFeedback(e.response?.data?.detail || 'Fehler beim Entfernen', true);
    }
  };

  const handleAddCurrentSong = async (pl) => {
    if (!currentSong) return;
    try {
      const r = await addToPlaylist(pl.name, currentSong.id);
      if (r.data?.message === 'Already in playlist') {
        showFeedback(`"${currentSong.title || currentSong.filename}" bereits in "${pl.name}"`);
      } else {
        showFeedback(`"${currentSong.title || currentSong.filename}" zu "${pl.name}" hinzugefügt`);
        await loadPlaylists();
        if (selectedPlaylist?.name === pl.name) {
          await loadPlaylistSongs(pl.name);
        }
      }
    } catch (e) {
      showFeedback(e.response?.data?.detail || 'Fehler beim Hinzufügen', true);
    }
  };

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ width: 720, maxWidth: '95vw', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div className="modal-header">
          <h2>📋 Playlist Manager</h2>
          <button className="icon-btn" onClick={onClose} title="Schließen" style={{ fontSize: 13 }}>✕</button>
        </div>

        {/* Feedback */}
        {feedback && (
          <div style={{ padding: '6px 12px', background: 'rgba(74,222,128,0.15)', color: '#4ade80', borderRadius: 4, fontSize: 12, marginBottom: 8 }}>
            ✓ {feedback}
          </div>
        )}
        {error && (
          <div style={{ padding: '6px 12px', background: 'rgba(248,113,113,0.15)', color: '#f87171', borderRadius: 4, fontSize: 12, marginBottom: 8 }}>
            ✗ {error}
          </div>
        )}

        {/* Body: two-column layout */}
        <div style={{ display: 'flex', gap: 16, flex: 1, overflow: 'hidden', minHeight: 0 }}>
          {/* Left: Playlist list */}
          <div style={{ width: 240, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
              Playlists ({playlists.length})
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {playlists.length === 0 && (
                <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: '8px 0' }}>
                  Noch keine Playlists. Erstelle eine neue!
                </div>
              )}
              {playlists.map(pl => (
                <div
                  key={pl.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 8px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    background: selectedPlaylist?.name === pl.name ? 'var(--accent-bg, rgba(124,140,248,0.2))' : 'transparent',
                    border: selectedPlaylist?.name === pl.name ? '1px solid var(--accent, #7c8cf8)' : '1px solid transparent',
                  }}
                  onClick={() => handleSelectPlaylist(pl)}
                >
                  {renamingId === pl.name ? (
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleRename(pl);
                        if (e.key === 'Escape') setRenamingId(null);
                      }}
                      onClick={e => e.stopPropagation()}
                      style={{ flex: 1, fontSize: 12, padding: '2px 4px' }}
                    />
                  ) : (
                    <span style={{ flex: 1, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {pl.name}
                    </span>
                  )}
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>{pl.count ?? 0}</span>

                  {/* Add current song to this playlist */}
                  {currentSong && (
                    <button
                      className="icon-btn"
                      style={{ fontSize: 12, padding: '2px 4px', flexShrink: 0 }}
                      onClick={e => { e.stopPropagation(); handleAddCurrentSong(pl); }}
                      title={`"${currentSong.title || currentSong.filename}" zu dieser Playlist hinzufügen`}
                    >＋</button>
                  )}

                  <button
                    className="icon-btn"
                    style={{ fontSize: 11, padding: '2px 4px', flexShrink: 0 }}
                    onClick={e => {
                      e.stopPropagation();
                      setRenamingId(pl.name);
                      setRenameValue(pl.name);
                    }}
                    title="Umbenennen"
                  >✏️</button>
                  <button
                    className="icon-btn danger"
                    style={{ fontSize: 11, padding: '2px 4px', flexShrink: 0 }}
                    onClick={e => { e.stopPropagation(); handleDelete(pl); }}
                    title="Löschen"
                  >🗑️</button>
                </div>
              ))}
            </div>

            {/* Create new playlist */}
            {creating ? (
              <div style={{ display: 'flex', gap: 4 }}>
                <input
                  autoFocus
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleCreate();
                    if (e.key === 'Escape') { setCreating(false); setNewName(''); }
                  }}
                  placeholder="Playlist-Name"
                  style={{ flex: 1, fontSize: 12, padding: '4px 8px' }}
                />
                <button className="btn btn-primary btn-xs" onClick={handleCreate}>OK</button>
                <button className="btn btn-secondary btn-xs" onClick={() => { setCreating(false); setNewName(''); }}>✕</button>
              </div>
            ) : (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setCreating(true)}
                style={{ width: '100%' }}
              >＋ Neue Playlist</button>
            )}
          </div>

          {/* Divider */}
          <div style={{ width: 1, background: 'var(--border, rgba(255,255,255,0.1))' }} />

          {/* Right: Songs in selected playlist */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
            {!selectedPlaylist ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 13, paddingTop: 20, textAlign: 'center' }}>
                ← Playlist auswählen
              </div>
            ) : (
              <>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
                  Songs in „{selectedPlaylist.name}" ({playlistSongs.length})
                </div>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  {loadingSongs && <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Lade Songs…</div>}
                  {!loadingSongs && playlistSongs.length === 0 && (
                    <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Playlist ist leer.</div>
                  )}
                  {!loadingSongs && playlistSongs.map((song, i) => (
                    <div
                      key={song.id || i}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '5px 6px',
                        borderRadius: 4,
                        borderBottom: '1px solid var(--border, rgba(255,255,255,0.06))',
                      }}
                    >
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', minWidth: 20 }}>{i + 1}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {song.title || song.filename}
                        </div>
                        {song.artist && (
                          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{song.artist}</div>
                        )}
                      </div>
                      {song.duration && (
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>
                          {fmtTime(song.duration)}
                        </span>
                      )}
                      <button
                        className="icon-btn danger"
                        style={{ fontSize: 12, flexShrink: 0 }}
                        onClick={() => handleRemoveSong(song)}
                        title="Aus Playlist entfernen"
                      >✕</button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Spalten-Auswahl für die Songliste */}
        <div style={{
          marginTop: 12, padding: 10, background: '#1a1d2a',
          borderRadius: 8, border: '1px solid var(--border)',
        }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setShowColumns(prev => !prev)}
            style={{ width: '100%', justifyContent: 'flex-start' }}
          >
            <i className="fa-solid fa-table-columns" style={{ marginRight: 8 }} />
            Spalten der Songliste
            <i className={`fa-solid fa-chevron-${showColumns ? 'up' : 'down'}`} style={{ marginLeft: 'auto' }} />
          </button>

          {showColumns && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>
                Welche Spalten sollen in der Songliste erscheinen?
                Der <b>Titel bleibt immer sichtbar</b>. Bei schmalen Fenstern
                (aktuell {width} px) werden Spalten automatisch ausgeblendet –
                diese sind unten markiert.
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 6 }}>
                {COLUMN_KEYS.map(key => {
                  const auto = isAutoHidden(key);
                  const on = columns[key] !== false;
                  return (
                    <label
                      key={key}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        fontSize: 12, padding: '5px 8px', borderRadius: 6,
                        background: '#22253a', cursor: 'pointer',
                        opacity: auto ? 0.55 : 1,
                      }}
                      title={auto ? 'Wegen geringer Fensterbreite automatisch ausgeblendet' : ''}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => toggle(key)}
                        style={{ cursor: 'pointer' }}
                      />
                      <span style={{ flex: 1 }}>{COLUMN_LABELS[key]}</span>
                      {auto && (
                        <i
                          className="fa-solid fa-compress"
                          style={{ fontSize: 10, color: '#fa3' }}
                          title="Automatisch ausgeblendet (zu wenig Platz)"
                        />
                      )}
                    </label>
                  );
                })}
              </div>

              <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setAll(true)}>
                  Alle aktivieren
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => setAll(false)}>
                  Alle deaktivieren
                </button>
                <span style={{ fontSize: 11, color: '#666', marginLeft: 'auto', alignSelf: 'center' }}>
                  Aktiv sichtbar: {Object.values(visible).filter(Boolean).length} Spalten
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="form-actions" style={{ marginTop: 12 }}>
          {currentSong && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)', flex: 1 }}>
              Aktueller Song: <strong>{currentSong.title || currentSong.filename}</strong>
              {' – '}Klicke ＋ neben einer Playlist zum Hinzufügen
            </span>
          )}
          <button className="btn btn-secondary" onClick={onClose}>Schließen</button>
        </div>
      </div>
    </div>
  );
}

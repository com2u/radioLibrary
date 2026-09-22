/**
 * PlaylistModal – Dialog zum Hinzufügen eines Songs zu einer Playlist.
 * 
 * @param {boolean}  props.open        - Ob der Dialog offen ist
 * @param {Function} props.onClose     - () => void
 * @param {Array}    props.playlists   - Verfügbare Playlists [{ name, path }]
 * @param {Object}   props.currentSong - Der aktuell ausgewählte Song
 * @param {Function} props.onAdd       - (playlistName, songId) => void
 */
export default function PlaylistModal({ open, onClose, playlists, currentSong, onAdd }) {
  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ width: 400 }}>
        <div className="modal-header">
          <h2>📋 Playlist</h2>
          <button className="icon-btn" onClick={onClose} title="Schließen" style={{ fontSize: 13 }}>✕</button>
        </div>
        {(!playlists || playlists.length === 0) && (
          <p style={{ color: '#aaa' }}>Keine Playlists vorhanden.</p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '16px 0' }}>
          {(playlists || []).map(pl => (
            <button
              key={pl.name}
              className="btn btn-secondary"
              style={{ textAlign: 'left' }}
              onClick={() => {
                console.log('[API] addToPlaylist', pl.name, currentSong?.id);
                onAdd(pl.name, currentSong?.id);
                onClose();
              }}
            >
              {pl.name}
            </button>
          ))}
        </div>
        <div className="form-actions">
          <button className="btn btn-secondary" onClick={onClose}>Schließen</button>
        </div>
      </div>
    </div>
  );
}

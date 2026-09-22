/**
 * MetaEditModal – Dialog zum Bearbeiten der Song-Metadaten (ID3-Tags).
 * 
 * @param {Object}   props.song    - Song-Objekt mit aktuellen Metadaten
 * @param {Function} props.onSave  - (updatedSong) => void
 * @param {Function} props.onClose - () => void
 */
import { useState } from 'react';
import { updateSong } from '../api';
import { fmtDateTime } from '../utils';

export default function MetaEditModal({ song, onSave, onClose }) {
  const [form, setForm] = useState({
    title: song.title || '',
    artist: song.artist || '',
    album: song.album || '',
    year: song.year || '',
    genre: song.genre || '',
    comment: song.comment || '',
    track: song.track || '',
    community_rating: song.community_rating ?? 0,
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const handleSave = async () => {
    console.log('[API] updateSong', song.id, form);
    setSaving(true);
    try {
      await updateSong(song.id, form);
      console.log('[API] updateSong erfolgreich');
      onSave({ ...song, ...form });
    } catch (e) {
      console.error('[API] updateSong fehlgeschlagen:', e);
      setSaveError(e.response?.data?.detail || e.message || 'Unbekannter Fehler');
    } finally {
      setSaving(false);
    }
  };

  // Hilfsfunktion für einheitliche Formularfelder
  const field = (label, key, type = 'text', opts = {}) => (
    <div className="form-row">
      <label>{label}</label>
      <input
        type={type}
        value={form[key] ?? ''}
        onChange={e => setForm({ ...form, [key]: e.target.value })}
        {...opts}
      />
    </div>
  );

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-header">
          <h2>✏️ Metadaten</h2>
          <button className="icon-btn" onClick={onClose} title="Schließen" style={{ fontSize: 13 }}>✕</button>
        </div>
        <div className="filepath-display">{song.path}</div>
        {song.created > 0 && (
          <div className="form-row">
            <label>Erstellt</label>
            <div className="meta-readonly">{fmtDateTime(song.created)}</div>
          </div>
        )}
        {field('Titel', 'title')}
        {field('Artist', 'artist')}
        {field('Album', 'album')}
        {field('Jahr', 'year')}
        {field('Genre', 'genre')}
        <div className="form-row">
          <label>Kommentar / Text</label>
          <textarea
            value={form.comment}
            onChange={e => setForm({ ...form, comment: e.target.value })}
          />
        </div>
        {field('Track #', 'track')}
        {field('Community Rating (0–10)', 'community_rating', 'number', { min: 0, max: 10, step: 0.1 })}
        <div className="form-actions">
          <button className="btn btn-secondary" onClick={onClose}>Abbrechen</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Speichern…' : 'Speichern'}
          </button>
        </div>
        {saveError && <p style={{ color: 'var(--danger)', marginTop: 8, fontSize: 13 }}>{saveError}</p>}
      </div>
    </div>
  );
}

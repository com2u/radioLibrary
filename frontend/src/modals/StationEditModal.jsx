/**
 * StationEditModal – Dialog zum Anlegen und Bearbeiten von Radiostationen.
 * 
 * @param {boolean}  props.open      - Ob der Dialog offen ist
 * @param {Function} props.onClose   - () => void
 * @param {Object}   [props.station] - Bestehende Station (null = neue Station)
 * @param {Function} props.onSave    - () => void – nach erfolgreichem Speichern
 * @param {Function} props.onDelete  - () => void – nach erfolgreichem Löschen
 */
import { useState, useEffect } from 'react';
import { addStation, updateStation, deleteStation } from '../api';

export default function StationEditModal({ open, onClose, station, onSave, onDelete }) {
  const isNew = !station;
  const [form, setForm] = useState({
    name: station?.name || '',
    url: station?.url || '',
    path: station?.path || '',
    default_enabled: station?.default_enabled ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Formular aktualisieren wenn sich die Station ändert
  useEffect(() => {
    setForm({
      name: station?.name || '',
      url: station?.url || '',
      path: station?.path || '',
      default_enabled: station?.default_enabled ?? true,
    });
    setConfirmDelete(false);
  }, [station, open]);

  if (!open) return null;

  const handleSave = async () => {
    console.log('[API] Station speichern:', isNew ? 'neu' : station.name, form);
    setSaving(true);
    try {
      if (isNew) {
        await addStation(form);
      } else {
        await updateStation(station.name, form);
      }
      console.log('[API] Station gespeichert');
      onSave();
      onClose();
    } catch (e) {
      console.error('[API] Station-Speichern fehlgeschlagen:', e);
      alert('Fehler beim Speichern: ' + (e.response?.data?.detail || e.message));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    console.log('[API] Station löschen:', station.name);
    try {
      await deleteStation(station.name);
      console.log('[API] Station gelöscht:', station.name);
      onDelete();
      onClose();
    } catch (e) {
      console.error('[API] Station-Löschen fehlgeschlagen:', e);
      alert('Fehler beim Löschen: ' + (e.response?.data?.detail || e.message));
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ width: 480 }}>
        <h2>{isNew ? 'Station hinzufügen' : 'Station bearbeiten'}</h2>
        <div className="form-row">
          <label>Name</label>
          <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="form-row">
          <label>Stream-URL</label>
          <input type="text" value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} />
        </div>
        <div className="form-row">
          <label>Pfad (relativer Ordner)</label>
          <input type="text" value={form.path} onChange={e => setForm({ ...form, path: e.target.value })} />
        </div>
        <div className="form-row" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <label style={{ marginBottom: 0 }}>Standard aktiviert</label>
          <input
            type="checkbox"
            checked={form.default_enabled}
            onChange={e => setForm({ ...form, default_enabled: e.target.checked })}
            style={{ width: 'auto' }}
          />
        </div>
        {confirmDelete && (
          <p style={{ color: '#f77', margin: '12px 0' }}>
            Station "{station?.name}" wirklich löschen?{' '}
            <button className="btn btn-danger" onClick={handleDelete}>Ja, löschen</button>{' '}
            <button className="btn btn-secondary" onClick={() => setConfirmDelete(false)}>Abbrechen</button>
          </p>
        )}
        <div className="form-actions">
          {!isNew && !confirmDelete && (
            <button className="btn btn-danger" onClick={() => setConfirmDelete(true)}>Löschen</button>
          )}
          <button className="btn btn-secondary" onClick={onClose}>Abbrechen</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Speichern…' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  );
}

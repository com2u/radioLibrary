/**
 * FilterModal – Dialog zum Filtern der Song-Liste.
 * 
 * @param {Object} props
 * @param {Object}   props.meta      - { genres, years, texts } aus /api/songs/meta
 * @param {Object}   props.filters   - Aktuell aktive Filter
 * @param {Function} props.onApply   - (newFilters) => void
 * @param {Function} props.onClose   - () => void
 */
import { useState } from 'react';

export default function FilterModal({ meta, filters, onApply, onClose }) {
  const [local, setLocal] = useState({ ...filters });

  // Mehrfachauswahl-Felder (Arrays) umschalten
  const toggleArr = (field, val) => {
    const arr = local[field] || [];
    setLocal({
      ...local,
      [field]: arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val]
    });
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ width: 700 }}>
        <div className="modal-header">
          <h2>🔍 Filter</h2>
          <button className="icon-btn" onClick={onClose} title="Schließen" style={{ fontSize: 13 }}>✕</button>
        </div>

        <div className="filter-section">
          <h3>Volltext-Suche</h3>
          <input
            type="text"
            placeholder="Titel, Artist, Album, Dateiname..."
            value={local.search || ''}
            onChange={e => setLocal({ ...local, search: e.target.value })}
            style={{ width: '100%' }}
          />
        </div>

        <div className="filter-section">
          <h3>Favoriten</h3>
          <div className="checkbox-grid">
            <label className="checkbox-item">
              <input
                type="checkbox"
                checked={!!local.only_favorites}
                onChange={e => setLocal({ ...local, only_favorites: e.target.checked })}
              />
              Nur Favoriten ♥
            </label>
          </div>
        </div>

        <div className="filter-section">
          <h3>Mindest-Rating</h3>
          <input
            type="number"
            min="0" max="10" step="0.5"
            value={local.min_rating ?? ''}
            onChange={e => setLocal({ ...local, min_rating: e.target.value ? parseFloat(e.target.value) : undefined })}
            style={{ width: 100 }}
          />
        </div>

        <div className="filter-section">
          <h3>Jahr</h3>
          <div className="checkbox-grid">
            {(meta?.years || []).map(y => (
              <label className="checkbox-item" key={y}>
                <input
                  type="checkbox"
                  checked={(local.years || []).includes(y)}
                  onChange={() => toggleArr('years', y)}
                />
                {y}
              </label>
            ))}
          </div>
        </div>

        <div className="filter-section">
          <h3>Genre</h3>
          <div className="checkbox-grid">
            {(meta?.genres || []).map(g => (
              <label className="checkbox-item" key={g}>
                <input
                  type="checkbox"
                  checked={(local.genres || []).includes(g)}
                  onChange={() => toggleArr('genres', g)}
                />
                {g}
              </label>
            ))}
          </div>
        </div>

        <div className="filter-section">
          <h3>Tags / Kommentar</h3>
          <input
            type="text"
            placeholder="Nach Kommentar-Text filtern..."
            value={local.text_search || ''}
            onChange={e => setLocal({ ...local, text_search: e.target.value })}
            style={{ width: '100%', marginBottom: 8 }}
          />
          {(meta?.texts || []).length > 0 && (
            <div className="checkbox-grid">
              {(meta?.texts || []).slice(0, 50).map(t => (
                <label className="checkbox-item" key={t}>
                  <input
                    type="checkbox"
                    checked={(local.texts || []).includes(t)}
                    onChange={() => toggleArr('texts', t)}
                  />
                  {t.length > 40 ? t.slice(0, 40) + '…' : t}
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="form-actions">
          <button className="btn btn-secondary" onClick={() => setLocal({})}>Zurücksetzen</button>
          <button className="btn btn-secondary" onClick={onClose}>Abbrechen</button>
          <button className="btn btn-primary" onClick={() => onApply(local)}>Anwenden</button>
        </div>
      </div>
    </div>
  );
}

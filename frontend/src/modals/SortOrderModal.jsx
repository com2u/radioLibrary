/**
 * SortOrderModal – Dialog zur Auswahl von Sortierfeld und -richtung.
 * 
 * @param {string}   props.sortBy   - Aktuelles Sortierfeld
 * @param {string}   props.sortDir  - Aktuelle Sortierrichtung ('asc'|'desc')
 * @param {Function} props.onApply  - (sortBy, sortDir) => void
 * @param {Function} props.onClose  - () => void
 */
import { useState } from 'react';

const SORT_OPTIONS = [
  'filename', 'created', 'modified', 'community_rating',
  'title', 'artist', 'album', 'genre', 'duration'
];

export default function SortOrderModal({ sortBy, sortDir, onApply, onClose }) {
  const [localSortBy, setLocalSortBy] = useState(sortBy);
  const [localSortDir, setLocalSortDir] = useState(sortDir);

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ width: 400 }}>
        <div className="modal-header">
          <h2>↕ Sortierung</h2>
          <button className="icon-btn" onClick={onClose} title="Schließen" style={{ fontSize: 13 }}>✕</button>
        </div>
        <div className="filter-section">
          <h3>Sortieren nach</h3>
          {SORT_OPTIONS.map(opt => (
            <div
              key={opt}
              className={`order-option ${localSortBy === opt ? 'active' : ''}`}
              onClick={() => setLocalSortBy(opt)}
            >
              {opt.charAt(0).toUpperCase() + opt.slice(1).replace('_', ' ')}
            </div>
          ))}
        </div>
        <div className="filter-section">
          <h3>Richtung</h3>
          <div
            className={`order-option ${localSortDir === 'asc' ? 'active' : ''}`}
            onClick={() => setLocalSortDir('asc')}
          >Aufsteigend ↑</div>
          <div
            className={`order-option ${localSortDir === 'desc' ? 'active' : ''}`}
            onClick={() => setLocalSortDir('desc')}
          >Absteigend ↓</div>
        </div>
        <div className="form-actions">
          <button className="btn btn-secondary" onClick={onClose}>Abbrechen</button>
          <button className="btn btn-primary" onClick={() => { onApply(localSortBy, localSortDir); onClose(); }}>
            Anwenden
          </button>
        </div>
      </div>
    </div>
  );
}

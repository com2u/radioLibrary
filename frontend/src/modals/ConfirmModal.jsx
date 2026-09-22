/**
 * ConfirmModal – Generischer Bestätigungs-Dialog.
 * 
 * @param {string}   props.message   - Anzuzeigende Frage/Nachricht
 * @param {Function} props.onConfirm - () => void – Bestätigung
 * @param {Function} props.onClose   - () => void – Abbrechen
 */
export default function ConfirmModal({ message, onConfirm, onClose }) {
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ width: 400 }}>
        <div className="modal-header">
          <h2>🗑️ Bestätigen</h2>
          <button className="icon-btn" onClick={onClose} title="Schließen" style={{ fontSize: 13 }}>✕</button>
        </div>
        <p style={{ margin: '0 0 20px', color: 'var(--text-dim)', lineHeight: 1.6 }}>{message}</p>
        <div className="form-actions">
          <button className="btn btn-secondary" onClick={onClose}>Abbrechen</button>
          <button className="btn btn-danger" onClick={onConfirm}>🗑️ Löschen</button>
        </div>
      </div>
    </div>
  );
}

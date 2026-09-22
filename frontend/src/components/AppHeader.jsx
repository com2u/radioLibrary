/**
 * AppHeader – Obere Navigationsleiste mit Icon-Buttons und Help-Overlay.
 */
import { useState } from 'react';
import { rescan } from '../api';
import { useLanguage } from '../i18n/LanguageContext';

function HelpOverlay({ onClose }) {
  return (
    <div className="help-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="help-box">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <h2>⌨ Keyboard Shortcuts</h2>
          <button className="icon-btn" onClick={onClose} title="Schließen (Escape)" style={{ fontSize: 14 }}>✕</button>
        </div>
        <div className="help-grid">
          <div className="help-section-title">Wiedergabe</div>
          <div className="help-row"><span className="help-desc">Play / Pause</span><div className="help-key"><span className="kbd">Space</span><span className="kbd">Enter</span></div></div>
          <div className="help-row"><span className="help-desc">Nächster Song</span><div className="help-key"><span className="kbd">↓</span></div></div>
          <div className="help-row"><span className="help-desc">Vorheriger Song</span><div className="help-key"><span className="kbd">↑</span></div></div>
          <div className="help-row"><span className="help-desc">−10 Sekunden</span><div className="help-key"><span className="kbd">←</span><span className="kbd">,</span></div></div>
          <div className="help-row"><span className="help-desc">+10 Sekunden</span><div className="help-key"><span className="kbd">→</span><span className="kbd">.</span></div></div>

          <div className="help-section-title">Song-Aktionen</div>
          <div className="help-row"><span className="help-desc">Rating 1–9</span><div className="help-key"><span className="kbd">1</span>–<span className="kbd">9</span></div></div>
          <div className="help-row"><span className="help-desc">Metadaten bearbeiten</span><div className="help-key"><span className="kbd">M</span></div></div>
          <div className="help-row"><span className="help-desc">Clip-Modus ein</span><div className="help-key"><span className="kbd">C</span></div></div>
          <div className="help-row"><span className="help-desc">Song löschen</span><div className="help-key"><span className="kbd">Del</span></div></div>
          <div className="help-row"><span className="help-desc">Playlist öffnen</span><div className="help-key"><span className="kbd">P</span></div></div>
          <div className="help-row"><span className="help-desc">Zu Playlist 1 hinzuf.</span><div className="help-key"><span className="kbd">A</span></div></div>
          <div className="help-row"><span className="help-desc">Zu Playlist 2 hinzuf.</span><div className="help-key"><span className="kbd">B</span></div></div>

          <div className="help-section-title">Navigation</div>
          <div className="help-row"><span className="help-desc">Filter öffnen</span><div className="help-key"><span className="kbd">F</span></div></div>
          <div className="help-row"><span className="help-desc">Sortierung öffnen</span><div className="help-key"><span className="kbd">O</span></div></div>

          <div className="help-section-title">Clip-Modus</div>
          <div className="help-row"><span className="help-desc">Clip-Start setzen</span><div className="help-key"><span className="kbd">[</span></div></div>
          <div className="help-row"><span className="help-desc">Clip-Ende setzen</span><div className="help-key"><span className="kbd">]</span></div></div>
          <div className="help-row"><span className="help-desc">Clip speichern</span><div className="help-key"><span className="kbd">S</span></div></div>
          <div className="help-row"><span className="help-desc">Fade-In umschalten</span><div className="help-key"><span className="kbd">L</span></div></div>
          <div className="help-row"><span className="help-desc">Fade-Out umschalten</span><div className="help-key"><span className="kbd">R</span></div></div>
          <div className="help-row"><span className="help-desc">Abbrechen</span><div className="help-key"><span className="kbd">Esc</span></div></div>
        </div>
      </div>
    </div>
  );
}

export default function AppHeader({
  total,
  page,
  totalPages,
  hasFilters,
  onFilter,
  onSort,
  onRecording,
  onPlaylists,
  onCleanup,
}) {
  const [showHelp, setShowHelp] = useState(false);
  const { language, setLanguage } = useLanguage();

  const handleRescan = () => {
    console.log('[App] Rescan ausgelöst');
    rescan().then(() => {
      console.log('[App] Rescan abgeschlossen');
    }).catch(err => {
      console.error('[App] Rescan fehlgeschlagen:', err);
    });
  };

  // Close help on Escape
  const handleHelpKeyDown = (e) => {
    if (e.key === 'Escape') setShowHelp(false);
  };

  return (
    <>
      <div className="app-header" onKeyDown={handleHelpKeyDown}>
        {/* Logo / Title */}
        <h1
          title="Radio Library – zur Song-Liste"
          style={{ cursor: 'pointer' }}
          onClick={() => {
            window._playerCancelClip?.();
            window.scrollTo(0, 0);
          }}
        >📻 Radio Library V1.4</h1>

        <div className="header-divider" />

        {/* Filter button – icon + active indicator */}
        <button
          className={`icon-btn ${hasFilters ? 'active' : ''}`}
          onClick={onFilter}
          title="Filter (F)"
          style={{ fontSize: 17, position: 'relative' }}
        >
          🔍
          {hasFilters && (
            <span style={{
              position: 'absolute', top: 4, right: 4,
              width: 6, height: 6, borderRadius: '50%',
              background: 'var(--accent)', display: 'block'
            }} />
          )}
        </button>

        {/* Sort button */}
        <button
          className="icon-btn"
          onClick={onSort}
          title="Sortierung (O)"
          style={{ fontSize: 16 }}
        >
          <i className="fa-solid fa-arrow-down-wide-short"></i>
        </button>

        {/* Reload / Rescan */}
        <button
          className="icon-btn"
          onClick={handleRescan}
          title="Library neu laden"
          style={{ fontSize: 16 }}
        >
          <i className="fa-solid fa-arrows-rotate"></i>
        </button>

        {/* Recording Control */}
        <button
          className="icon-btn"
          onClick={onRecording}
          title="Recording-Steuerung"
          style={{ fontSize: 17 }}
        >
          ⚙
        </button>

        {/* Playlist Manager */}
        <button
          className="icon-btn"
          onClick={onPlaylists}
          title="Playlist Manager (P)"
          style={{ fontSize: 16 }}
        >
          <i className="fa-solid fa-list"></i>
        </button>

        {/* Cleanup */}
        <button
          className="icon-btn"
          onClick={onCleanup}
          title="Cleanup – Bibliothek aufräumen"
          style={{ fontSize: 16 }}
        >
          <i className="fa-solid fa-broom"></i>
        </button>

        <div className="header-spacer" />

        {/* Language Switcher */}
        <button
          className="icon-btn"
          onClick={() => setLanguage('en')}
          title="English"
          style={{ fontSize: 20, opacity: language === 'en' ? 1 : 0.45 }}
        >
          🇬🇧
        </button>
        <button
          className="icon-btn"
          onClick={() => setLanguage('de')}
          title="Deutsch"
          style={{ fontSize: 20, opacity: language === 'de' ? 1 : 0.45 }}
        >
          🇩🇪
        </button>

        {/* Song count */}
        <span className="song-count">
          {total.toLocaleString()} Songs · {page}/{totalPages || 1}
        </span>

        <div className="header-divider" />

        {/* Help button */}
        <button
          className="icon-btn"
          onClick={() => setShowHelp(true)}
          title="Keyboard-Shortcuts anzeigen"
          style={{ fontSize: 14, fontWeight: 700, fontFamily: 'monospace' }}
        >
          ?
        </button>
      </div>

      {showHelp && <HelpOverlay onClose={() => setShowHelp(false)} />}
    </>
  );
}

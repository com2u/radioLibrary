/**
 * NowPlayingBars – Animierte Balken-Anzeige für den gerade spielenden Song.
 * 
 * Zeigt drei animierte Balken (CSS-Animation in App.css definiert).
 * Wird in der Song-Tabelle anstelle der Zeilennummer angezeigt.
 */
export default function NowPlayingBars() {
  return (
    <span className="now-playing-indicator" title="Spielt gerade">
      <span className="bar" />
      <span className="bar" />
      <span className="bar" />
    </span>
  );
}

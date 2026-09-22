/**
 * Player – Audio-Player mit WaveSurfer-Waveform und Clip-Modus.
 * 
 * Funktionen:
 *  - WaveSurfer-Initialisierung und Playback-Steuerung
 *  - Clip-Modus: Start/End-Punkte setzen, Vorschau, Speichern
 *  - Fade-In / Fade-Out Optionen
 *  - Zoom und Lautstärke-Regler
 *  - Keyboard-Shortcuts im Clip-Modus
 */
import { useState, useEffect, useRef } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { saveClip, addToPlaylist, streamUrl } from '../api';
import StarRating from './StarRating';
import ConfirmModal from '../modals/ConfirmModal';
import { fmtTime } from '../utils';

const FADE_DURATION = 3;

export default function Player({
  song,
  nextSong,
  playlists,
  isPlaying,
  setIsPlaying,
  playMode,
  setPlayMode,
  onPrev,
  onNext,
  onFavoriteToggle,
  onEditMeta,
  onDeleteSong,
  onRatingChange,
  onOpenPlaylist,
}) {
  const waveRef = useRef(null);
  const wsRef = useRef(null);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [zoom, setZoom] = useState(1);
  const [wsReady, setWsReady] = useState(false);
  const [loading, setLoading] = useState(false);

  const [clipMode, setClipMode] = useState(false);
  const clipModeRef = useRef(clipMode);
  useEffect(() => { clipModeRef.current = clipMode; }, [clipMode]);
  const [clipStart, setClipStart] = useState(null);
  const [clipEnd, setClipEnd] = useState(null);
  const [fadeIn, setFadeIn] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [playlistFeedback, setPlaylistFeedback] = useState('');

  // Prefetch-Cache für nächsten Song
  const prefetchRef = useRef({ id: null, peaks: null });

  const showPlaylistFeedback = (msg) => {
    setPlaylistFeedback(msg);
    setTimeout(() => setPlaylistFeedback(''), 3000);
  };

  // ── WaveSurfer init ──────────────────────────────────────────────
  useEffect(() => {
    if (!song) return;
    console.log('[Player] Lade Song:', song.id, song.title || song.filename);

    if (wsRef.current) {
      wsRef.current.destroy();
      wsRef.current = null;
    }

    setWsReady(false);
    setLoading(true);
    setCurrentTime(0);
    setDuration(0);
    setClipMode(false);
    setClipStart(null);
    setClipEnd(null);
    setZoom(1);

    let mounted = true;

    // Peaks laden (aus Cache oder API)
    const loadPeaks = async () => {
      const cache = prefetchRef.current;
      if (cache.id === song.id && cache.peaks) {
        console.log('[Player] Peaks aus Cache:', cache.peaks.length);
        return cache.peaks;
      }
      try {
        const peaksUrl = `/api/stream/${encodeURIComponent(song.id)}/peaks`;
        const resp = await fetch(peaksUrl);
        const data = await resp.json();
        if (data.peaks?.length) {
          console.log('[Player] Peaks geladen:', data.peaks.length);
          return data.peaks;
        }
      } catch (e) {
        console.warn('[Player] Peaks-Fehler:', e.message);
      }
      return null;
    };

    // ─────────────────────────────────────────────────────────────
    // AUDIO-FIX (V1.4) – ROOT CAUSE
    //
    // Bisher wurde `peaks` + `duration` in die WaveSurfer.create()-Config
    // gelegt UND zusaetzlich direkt danach `ws.load(url)` aufgerufen.
    // In wavesurfer.js v7 ist das fatal:
    //
    //   Der v7-Konstruktor startet in einem Microtask selbst einen Load:
    //     if (initialUrl || (peaks && duration)) this.load(initialUrl, peaks, duration)
    //   `initialUrl` ist hier '' (keine `url`-Option gesetzt), also lief
    //     load('', peaks, duration)
    //   ERST NACHDEM unser eigenes ws.load(url) bereits gestartet war.
    //
    //   loadAudio() macht dann zwei Dinge:
    //     1. abortController.abort()  -> bricht unseren laufenden Audio-Fetch ab
    //     2. setSrc('', undefined)    -> newSrc = '' -> `if (newSrc || url)`
    //                                    ist FALSE -> media.src wird NIE gesetzt
    //
    //   Ergebnis: Das <audio>-Element hat ueberhaupt keine Quelle.
    //   'ready' feuert trotzdem (aus den Peaks), aber play() ist ein No-Op
    //   -> kein Ton, kein Playhead-Fortschritt, Player "startet nicht".
    //   Genau das Symptom. Der Backend-Wechsel WebAudio/MediaElement war
    //   nie die Ursache, deshalb hat kein Rueckbau geholfen.
    //
    // FIX: Instanz OHNE url/peaks/duration erzeugen (dann macht der
    // Konstruktor gar nichts) und danach GENAU EINEN Load absetzen:
    //   ws.load(url, [peaks], duration)
    // loadAudio() ueberspringt wegen `channelData` den Blob-Fetch, setzt
    // media.src = url (natives Streaming) und rendert die Waveform sofort
    // aus den Peaks. Ein Load, eine Quelle, kein Abort-Race.
    //
    // Weitere v7-Korrekturen:
    //  - `peaks` erwartet Array<channel>, nicht ein flaches Number-Array
    //    (Backend liefert flach) -> in [peaks] wrappen.
    //  - `duration` muss > 0 sein, sonst wirft Decoder.createBuffer().
    //  - `scrollParent` gibt es in v7 nicht mehr -> `autoScroll`.
    //  - Event 'seek' existiert in v7 nicht mehr -> 'seeking' (Sekunden).
    // ─────────────────────────────────────────────────────────────
    const ws = WaveSurfer.create({
      container: waveRef.current,
      backend: 'MediaElement',
      waveColor: '#2a2f55',
      progressColor: '#7c8cf8',
      cursorColor: 'rgba(255,255,255,0.7)',
      cursorWidth: 1,
      height: 72,
      normalize: true,
      interact: true,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      autoScroll: true,
      minPxPerSec: 10,
    });
    // Sofort setzen: Controls/Refs duerfen nicht auf den Peaks-Fetch warten.
    wsRef.current = ws;
    ws.setVolume(volume);

    ws.on('ready', () => {
      if (!mounted) return;
      const dur = ws.getDuration();
      console.log('[Player] Ready – Dauer:', dur.toFixed(1) + 's');
      setDuration(dur);
      setWsReady(true);
      setLoading(false);
      ws.setVolume(volume);
    });

    // 'timeupdate' statt 'audioprocess': feuert auch beim Seeken/Pause.
    ws.on('timeupdate', (t) => {
      if (mounted) setCurrentTime(t);
    });
    ws.on('seeking', (t) => {
      if (mounted) setCurrentTime(t);
    });
    ws.on('play', () => { if (mounted) setIsPlaying(true); });
    ws.on('pause', () => { if (mounted) setIsPlaying(false); });
    ws.on('finish', () => {
      if (mounted) {
        setIsPlaying(false);
        if (clipModeRef.current) {
          setPlayMode(false);  // Clip-Modus-Ende → Play-Modus aus
        } else {
          onNext();  // Normal-Ende → nächster Song (playMode steuert Autoplay)
        }
      }
    });
    ws.on('error', (err) => {
      // AbortError ist kein echter Fehler – WaveSurfer bricht interne
      // Fetch-Requests beim Cleanup ab (z.B. durch React StrictMode).
      if (err && err.name === 'AbortError') {
        console.log('[Player] Audio-Ladung abgebrochen (normal bei Navigation)');
        return;
      }
      console.error('[Player] WaveSurfer Fehler:', err);
      if (mounted) setLoading(false);
    });

    loadPeaks().then(peaks => {
      if (!mounted || wsRef.current !== ws) return;

      const url = streamUrl(song.id);
      // duration nur verwenden wenn plausibel – sonst wirft createBuffer()
      const dbDuration = Number(song.duration);
      const usePeaks = peaks?.length && dbDuration > 0;

      // Ein einziger Load. Mit channelData -> kein Blob-Download,
      // media.src = url -> natives Streaming + Waveform sofort aus Peaks.
      const p = usePeaks
        ? ws.load(url, [peaks], dbDuration)
        : ws.load(url);

      p?.catch(err => {
        if (err && err.name === 'AbortError') {
          console.log('[Player] ws.load aborted (normal bei Navigation)');
          return;
        }
        console.error('[Player] ws.load Fehler:', err);
        if (mounted) setLoading(false);
      });
    });

    return () => {
      mounted = false;
      try {
        if (wsRef.current) {
          wsRef.current.destroy();
          wsRef.current = null;
        }
      } catch (e) {
        console.warn('[Player] WaveSurfer destroy Fehler:', e.message);
      }
    };
    // eslint-disable-next-line
  }, [song?.id]);

  // ── Pre-Loading: nächsten Song vorladen wenn 70% erreicht ──────
  useEffect(() => {
    if (!nextSong || !wsReady || !duration) return;
    if (currentTime / duration < 0.7) return;
    
    const nextId = nextSong.id;
    if (prefetchRef.current.id === nextId && prefetchRef.current.peaks) {
      return; // bereits gecached
    }

    console.log('[Player] Prefetch nächster Song:', nextSong.title || nextSong.filename);
    const peaksUrl = `/api/stream/${encodeURIComponent(nextId)}/peaks`;
    fetch(peaksUrl)
      .then(r => r.json())
      .then(data => {
        if (data.peaks?.length) {
          prefetchRef.current = { id: nextId, peaks: data.peaks };
          console.log('[Player] Prefetch OK:', data.peaks.length, 'peaks');
        }
      })
      .catch(e => console.warn('[Player] Prefetch Fehler:', e.message));
  }, [currentTime, duration, wsReady, nextSong]);

  useEffect(() => {
    if (wsRef.current && wsReady) wsRef.current.setVolume(volume);
  }, [volume, wsReady]);

  // v7: zoom() wirft "No audio loaded" ohne decodedData und erwartet eine
  // ZAHL. `false` (v6-Stil) landete als minPxPerSec im Renderer.
  // 0 = fillParent, also "kein Zoom".
  useEffect(() => {
    if (!wsRef.current || !wsReady) return;
    try {
      wsRef.current.zoom(zoom === 1 ? 0 : zoom * 50);
    } catch (e) {
      console.warn('[Player] zoom Fehler:', e.message);
    }
  }, [zoom, wsReady]);

  // ── Play-Modus: isPlaying=true → ws.play() (für externe Trigger) ──
  const isPlayingRef = useRef(isPlaying);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

  useEffect(() => {
    const ws = wsRef.current;
    if (!ws || !wsReady) return;
    if (isPlaying && !ws.isPlaying()) {
      console.log('[Player] sync-effect: ws.play() (externer Trigger)');
      ws.play().catch(err => {
        // AbortError/NotAllowedError beim Playback sind normal
        if (err && (err.name === 'AbortError' || err.name === 'NotAllowedError')) {
          console.log('[Player] Play angehalten:', err.name);
          return;
        }
        console.warn('[Player] Play-Fehler:', err);
      });
    } else if (!isPlaying && ws.isPlaying()) {
      ws.pause();
    }
  }, [isPlaying, wsReady]);

  // ── Controls ────────────────────────────────────────────────────
  // playPause() steuert WaveSurfer SYNCHRON im Click-Handler, damit der
  // Aufruf im "User-Gesture"-Kontext bleibt (Chrome/Safari Autoplay-Policy).
  // Der zusaetzliche isPlaying-Sync-Effect oben ist nur fuer externe Trigger
  // (Prev/Next/Autoplay) und greift hier nicht ein, weil ws.isPlaying()
  // direkt nach playPause() bereits dem Zielzustand entspricht
  // (HTMLMediaElement.paused kippt synchron).
  // Zusaetzlich halten die 'play'/'pause'-Listener den React-State korrekt,
  // falls der Browser das play()-Promise doch noch ablehnt.
  const playPause = () => {
    if (!wsRef.current || !wsReady) return;
    wsRef.current.playPause();
    const playing = wsRef.current.isPlaying();
    console.log('[Player] playPause() called – now playing:', playing);
    setIsPlaying(playing);
    setPlayMode(playing);  // Play-Modus folgt Play-Button
  };

  const seek = (delta) => {
    if (!wsRef.current || !wsReady) return;
    const d = wsRef.current.getDuration();
    const t = wsRef.current.getCurrentTime();
    wsRef.current.seekTo(Math.max(0, Math.min(1, (t + delta) / d)));
  };

  const handleClipLeft = () => {
    if (!wsRef.current) return;
    setClipStart(wsRef.current.getCurrentTime());
  };

  const handleClipRight = () => {
    if (!wsRef.current) return;
    setClipEnd(wsRef.current.getCurrentTime());
  };

  const handleSaveClip = async () => {
    if (!song || !wsRef.current) return;
    const start = clipStart ?? 0;
    const end = clipEnd ?? duration;
    setSaving(true);
    try {
      await saveClip({ song_id: song.id, start, end, fade_in: fadeIn, fade_out: fadeOut, fade_duration: FADE_DURATION });
      setClipMode(false);
      setClipStart(null);
      setClipEnd(null);
      setFadeIn(false);
      setFadeOut(false);
      // Waveform neu laden damit der Clip sichtbar wird.
      // Peaks-Cache fuer diesen Song invalidieren (Audio hat sich geaendert)
      // und ohne channelData laden -> WaveSurfer dekodiert die neue Datei.
      if (prefetchRef.current.id === song.id) {
        prefetchRef.current = { id: null, peaks: null };
      }
      if (wsRef.current) {
        setWsReady(false);
        wsRef.current.load(streamUrl(song.id) + '?t=' + Date.now())
          ?.catch(err => {
            if (err && err.name === 'AbortError') return;
            console.error('[Clip] Reload Fehler:', err);
          });
      }
    } catch (e) {
      console.error('[Clip] Fehler beim Speichern:', e);
      alert('Fehler beim Speichern: ' + (e.response?.data?.detail || e.message));
    } finally {
      setSaving(false);
    }
  };

  const cancelClip = () => {
    setClipMode(false);
    setClipStart(null);
    setClipEnd(null);
    setFadeIn(false);
    setFadeOut(false);
  };

  const handleDeleteInClip = async () => {
    setShowDeleteConfirm(false);
    await onDeleteSong(song);
    setClipMode(false);
  };

  // ── Clip-Modus Keyboard Shortcuts ───────────────────────────────
  useEffect(() => {
    if (!clipMode) return;
    const handler = (e) => {
      const tag = e.target.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      switch (e.key) {
        case 'Delete':   e.preventDefault(); setShowDeleteConfirm(true); break;
        case 's': case 'S': e.preventDefault(); handleSaveClip(); break;
        case 'l': case 'L': e.preventDefault(); setFadeIn(v => !v); break;
        case 'r': case 'R': e.preventDefault(); setFadeOut(v => !v); break;
        case 'm': case 'M': e.preventDefault(); onEditMeta(song); break;
        case 'Escape': e.preventDefault(); cancelClip(); break;
        case '[': e.preventDefault(); handleClipLeft(); break;
        case ']': e.preventDefault(); handleClipRight(); break;
        case 'a': case 'A':
          e.preventDefault();
          if (playlists[0] && song) {
            addToPlaylist(playlists[0].name, song.id)
              .then(r => showPlaylistFeedback(
                r.data?.message === 'Already in playlist'
                  ? `Bereits in „${playlists[0].name}"`
                  : `Zu „${playlists[0].name}" hinzugefügt`
              ))
              .catch(() => showPlaylistFeedback('Fehler beim Hinzufügen'));
          }
          break;
        case 'b': case 'B':
          e.preventDefault();
          if (playlists[1] && song) {
            addToPlaylist(playlists[1].name, song.id)
              .then(r => showPlaylistFeedback(
                r.data?.message === 'Already in playlist'
                  ? `Bereits in „${playlists[1].name}"`
                  : `Zu „${playlists[1].name}" hinzugefügt`
              ))
              .catch(() => showPlaylistFeedback('Fehler beim Hinzufügen'));
          }
          break;
        case '1': case '2': case '3': case '4': case '5':
        case '6': case '7': case '8': case '9':
          e.preventDefault();
          if (song) onRatingChange(parseInt(e.key));
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line
  }, [clipMode, song, fadeIn, fadeOut, playlists]);

  // Globale Funktionen für App-Keyboard-Handler
  useEffect(() => {
    window._playerPlayPause = playPause;
    window._playerSeek = seek;
    window._playerPrev = onPrev;
    window._playerNext = onNext;
    window._playerClipMode = () => setClipMode(true);
    window._playerCancelClip = cancelClip;
    window._playerEditMeta = () => onEditMeta(song);
    return () => {
      delete window._playerPlayPause;
      delete window._playerSeek;
      delete window._playerPrev;
      delete window._playerNext;
      delete window._playerClipMode;
      delete window._playerCancelClip;
      delete window._playerEditMeta;
    };
  }, [playPause, seek, onPrev, onNext, onEditMeta, song]);

  // ── Clip-Overlays (DOM-basiert, im WaveSurfer-Wrapper) ──────────
  const overlayRef = useRef(null);

  // Overlay-Container im WaveSurfer-Wrapper erstellen
  useEffect(() => {
    if (!wsReady || !wsRef.current) return;
    const wrapper = wsRef.current.renderer?.wrapper;
    if (!wrapper) return;

    // Alten Container entfernen
    if (overlayRef.current) overlayRef.current.remove();

    const container = document.createElement('div');
    container.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:2;';
    wrapper.appendChild(container);
    overlayRef.current = container;

    return () => {
      if (container.parentNode) container.remove();
      overlayRef.current = null;
    };
  }, [wsReady, song?.id]);

  // Overlays aktualisieren wenn Clip-Daten sich ändern
  useEffect(() => {
    const container = overlayRef.current;
    if (!container || !duration) return;

    const dur = duration || 1;
    const s = clipStart ?? 0;
    const e = clipEnd ?? dur;

    // Prozentwerte relativ zur GESAMTEN Waveform (0–100)
    const sPct = (s / dur) * 100;
    const ePct = (e / dur) * 100;
    const fiEnd = clipStart != null ? ((clipStart + FADE_DURATION) / dur) * 100 : (FADE_DURATION / dur) * 100;
    const foStart = clipEnd != null ? (Math.max(0, clipEnd - FADE_DURATION) / dur) * 100 : ((dur - FADE_DURATION) / dur) * 100;

    if (!clipMode) {
      container.innerHTML = '';
      return;
    }

    const CUT_LEFT = clipStart != null ? `<div style="position:absolute;top:0;left:0;width:${sPct}%;height:100%;background:rgba(255,60,60,0.35)"><span style="position:absolute;right:4px;top:4px;color:#f66;font-size:9px;font-weight:700">CUT</span></div>` : '';
    
    const CUT_RIGHT = clipEnd != null ? `<div style="position:absolute;top:0;left:${ePct}%;right:0;height:100%;background:rgba(255,60,60,0.35)"><span style="position:absolute;left:4px;top:4px;color:#f66;font-size:9px;font-weight:700">CUT</span></div>` : '';
    
    const KEEP_BORDER = (clipStart != null && clipEnd != null) ? `<div style="position:absolute;top:0;left:${sPct}%;width:${ePct - sPct}%;height:100%;border:2px solid rgba(74,222,128,0.7);border-radius:2px;box-sizing:border-box"></div>` : '';
    
    const LINE_START = clipStart != null ? `<div style="position:absolute;top:0;left:${sPct}%;width:2px;height:100%;background:#4ade80"></div>` : '';
    const LINE_END = clipEnd != null ? `<div style="position:absolute;top:0;left:${ePct}%;width:2px;height:100%;background:#f87c7c"></div>` : '';
    
    const FADE_IN = (fadeIn && clipStart != null) ? `<div style="position:absolute;top:0;left:${sPct}%;width:${fiEnd - sPct}%;height:100%;background:linear-gradient(to right,rgba(74,222,128,0.4),transparent);border-left:2px solid #4ade80;display:flex;align-items:flex-start;padding-top:4px"><span style="color:#4ade80;font-size:9px;font-weight:700;margin-left:3px">FADE IN</span></div>` : '';
    
    const FADE_OUT = (fadeOut && clipEnd != null) ? `<div style="position:absolute;top:0;left:${foStart}%;width:${ePct - foStart}%;height:100%;background:linear-gradient(to left,rgba(74,222,128,0.4),transparent);border-right:2px solid #4ade80;display:flex;align-items:flex-start;padding-top:4px;justify-content:flex-end"><span style="color:#4ade80;font-size:9px;font-weight:700;margin-right:3px">FADE OUT</span></div>` : '';

    container.innerHTML = CUT_LEFT + CUT_RIGHT + KEEP_BORDER + LINE_START + LINE_END + FADE_IN + FADE_OUT;
  }, [clipMode, clipStart, clipEnd, fadeIn, fadeOut, duration, wsReady]);

  if (!song) return null;

  // Nur clipDuration für die Anzeige
  const clipDuration = (clipEnd ?? duration) - (clipStart ?? 0);

  return (
    <div className="player-bar">
      {/* ── Top row: favorite + info + actions ── */}
      <div className="player-top">
        {/* Title / artist with favorite & rating inline */}
        <div className="player-title-area">
          <div className="player-song-title">{song.title || song.filename}</div>
          <div className="player-song-artist">{song.artist}</div>
          {/* Favorite & rating - inline rechts neben Titel/Artist */}
          <span
            className={`heart ${song.favorite ? 'active' : ''}`}
            onClick={() => onFavoriteToggle(song)}
            title="Favorit umschalten (♥)"
          >♥</span>
          <StarRating rating={song.community_rating} onChange={onRatingChange} size={16} />
        </div>

        {/* Meta actions */}
        <div className="player-meta-actions">
          <button
            className="icon-btn"
            onClick={() => onEditMeta(song)}
            title="Metadaten bearbeiten (M)"
            style={{ fontSize: 15 }}
          ><i className="fa-solid fa-pen-to-square"></i></button>
          <button
            className="icon-btn"
            onClick={onOpenPlaylist}
            title="Playlist Manager (P)"
            style={{ fontSize: 15 }}
          ><i className="fa-solid fa-list"></i></button>
          {playlistFeedback && (
            <span style={{ fontSize: 11, color: '#4ade80', padding: '2px 8px', background: 'rgba(74,222,128,0.1)', borderRadius: 4 }}>
              ✓ {playlistFeedback}
            </span>
          )}
          {!clipMode && (
            <button
              className="icon-btn"
              onClick={() => setClipMode(true)}
              title="Clip-Modus (C)"
              style={{ fontSize: 16, color: 'var(--danger)' }}
            >✂️</button>
          )}
        </div>
      </div>

      {/* ── Waveform ── */}
      <div className="waveform-wrap">
        <div ref={waveRef} style={{ width: '100%' }} />
      </div>

      {/* ── Bottom controls ── */}
      <div className="player-bottom">
        {/* Time display */}
        <div className="player-time">{fmtTime(currentTime)} / {fmtTime(duration)}</div>

        {/* Transport buttons */}
        <div className="player-btns">
          <button className="icon-btn" onClick={onPrev} title="Vorheriger Song (←)" style={{ fontSize: 18 }}>⏮</button>
          <button className="icon-btn" onClick={() => seek(-10)} title="−10 Sekunden (,)" style={{ fontSize: 13 }}>−10s</button>
          <button className="btn-play" onClick={playPause} title="Play / Pause (Leertaste)">
            {isPlaying ? '⏸' : '▶'}
          </button>
          <button className="icon-btn" onClick={() => seek(10)} title="+10 Sekunden (.)" style={{ fontSize: 13 }}>+10s</button>
          <button className="icon-btn" onClick={onNext} title="Nächster Song (→)" style={{ fontSize: 18 }}>⏭</button>
        </div>

        {/* Zoom & Volume */}
        <div className="player-zoom-vol">
          <label title="Zoom der Wellenform">🔍</label>
          <input type="range" min="1" max="10" step="0.5" value={zoom}
            onChange={e => setZoom(parseFloat(e.target.value))}
            title="Zoom" style={{ width: 80 }} />
          <label title="Lautstärke">🔊</label>
          <input type="range" min="0" max="1" step="0.05" value={volume}
            onChange={e => setVolume(parseFloat(e.target.value))}
            title="Lautstärke" style={{ width: 100 }} />
        </div>

        {/* Clip controls (when active) */}
        {clipMode && (
          <div className="clip-controls">
            <span className="clip-badge">✂ Clip</span>
            <button
              className="btn btn-secondary btn-xs"
              onClick={handleClipLeft}
              title="Clip Left – Alles links abschneiden ([)"
            >⬅✂</button>
            <button
              className="btn btn-secondary btn-xs"
              onClick={handleClipRight}
              title="Clip Right – Alles rechts abschneiden (])"
            >✂➡</button>
            <span className="clip-time">{fmtTime(clipDuration)}</span>
            <label className="clip-fade-label" title="Fade-In aktivieren (L)">
              <input type="checkbox" checked={fadeIn} onChange={() => setFadeIn(v => !v)} />
              Fade In <span className="kbd">L</span>
            </label>
            <label className="clip-fade-label" title="Fade-Out aktivieren (R)">
              <input type="checkbox" checked={fadeOut} onChange={() => setFadeOut(v => !v)} />
              Fade Out <span className="kbd">R</span>
            </label>
            <button
              className="icon-btn"
              onClick={handleSaveClip}
              disabled={saving}
              title="Clip speichern (S)"
              style={{ fontSize: 16 }}
            >{saving ? '⏳' : '💾'}</button>
            <button
              className="icon-btn danger"
              onClick={() => setShowDeleteConfirm(true)}
              title="Song löschen (Delete)"
              style={{ fontSize: 16 }}
            >🗑️</button>
            <button
              className="icon-btn"
              onClick={cancelClip}
              title="Clip-Modus beenden (Escape)"
              style={{ fontSize: 14 }}
            >✕</button>
          </div>
        )}
      </div>

      {showDeleteConfirm && (
        <ConfirmModal
          message={`"${song.title || song.filename}" wirklich löschen?`}
          onConfirm={handleDeleteInClip}
          onClose={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  );
}

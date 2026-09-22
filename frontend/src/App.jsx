import { useState, useEffect, useCallback } from 'react';
import { fetchSongs, fetchMeta, updateSong, toggleFavorite, deleteSong, getPlaylists, addToPlaylist } from './api';
import AppHeader from './components/AppHeader';
import SongTable from './components/SongTable';
import Player from './components/Player';
import FilterModal from './modals/FilterModal';
import SortOrderModal from './modals/SortOrderModal';
import MetaEditModal from './modals/MetaEditModal';
import ConfirmModal from './modals/ConfirmModal';
import PlaylistManager from './modals/PlaylistManager';
import RecordingControlDialog from './modals/RecordingControlDialog';
import StationEditModal from './modals/StationEditModal';
import CleanupDialog from './modals/CleanupDialog';
import { useColumnVisibility } from './hooks/useColumnVisibility';
import { LanguageProvider } from './i18n/LanguageContext';
import './App.css';

/**
 * App – Haupt-Komponente der Radio Library.
 * 
 * Verantwortlich für:
 *  - Globalen State (Songs, Filter, Sortierung, aktiver Song)
 *  - Laden der Song-Liste vom Backend
 *  - Keyboard-Shortcuts (globale Ebene)
 *  - Koordination aller Modals
 */
export default function App() {
  // ── Song-Listen State ──────────────────────────────────────────
  const [songs, setSongs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage] = useState(100);
  const [idx, setIdx] = useState(0);     // Index des ausgewählten Songs in songs[]
  const [loading, setLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playMode, setPlayMode] = useState(false);  // true = automatisch nächsten Song starten

  // ── Filter & Sortierung State ──────────────────────────────────
  const [meta, setMeta] = useState(null);
  const [filters, setFilters] = useState({});
  const [sortBy, setSortBy] = useState('created');
  const [sortDir, setSortDir] = useState('desc');

  // ── Modal-Sichtbarkeit ─────────────────────────────────────────
  const [showFilter, setShowFilter] = useState(false);
  const [showSort, setShowSort] = useState(false);
  const [showRecording, setShowRecording] = useState(false);
  const [showPlaylistManager, setShowPlaylistManager] = useState(false);
  // songForPlaylist: which song to pre-select when opening PlaylistManager from SongTable
  const [songForPlaylist, setSongForPlaylist] = useState(null);
  const [editingSong, setEditingSong] = useState(null);
  const [deleteConfirmSong, setDeleteConfirmSong] = useState(null);
  const [showStationEditModal, setShowStationEditModal] = useState(false);
  const [editingStation, setEditingStation] = useState(null);
  const [showCleanup, setShowCleanup] = useState(false);

  // Spalten-Sichtbarkeit der Songliste (responsive + Nutzereinstellung)
  const { visible: visibleColumns } = useColumnVisibility();

  // ── Playlists State ────────────────────────────────────────────
  const [playlists, setPlaylists] = useState([]);

  const currentSong = songs[idx] || null;
  const totalPages = Math.ceil(total / perPage);

  // ── Hilfsfunktion: Filter-Objekt in API-Parameter umwandeln ──────
  const buildApiParams = useCallback((pg, flt, sBy, sDir) => {
    const params = {
      page: pg,
      per_page: perPage,
      sort_by: sBy,
      sort_dir: sDir,
    };
    if (flt.search) params.search = flt.search;
    if (flt.only_favorites) params.favorite = true;
    if (flt.min_rating !== undefined) params.min_rating = flt.min_rating;
    if (flt.genres?.length) params.genre = flt.genres.join(',');
    if (flt.years?.length) params.year = flt.years.join(',');
    if (flt.text_search) params.text = flt.text_search;
    if (flt.texts?.length) params.texts = flt.texts.join(',');
    return params;
  }, [perPage]);

  // ── Songs vom Backend laden ────────────────────────────────────
  const loadSongs = useCallback(async (pg, flt, sBy, sDir) => {
    console.log('[State] loadSongs page=%d sortBy=%s sortDir=%s filters=%o', pg, sBy, sDir, flt);
    setLoading(true);
    try {
      const params = buildApiParams(pg, flt, sBy, sDir);
      const res = await fetchSongs(params);
      setSongs(res.data.songs || []);
      setTotal(res.data.total || 0);
      console.log('[State] Songs geladen: %d (gesamt %d)', res.data.songs?.length, res.data.total);
    } catch (e) {
      console.error('[State] fetchSongs fehlgeschlagen:', e);
    } finally {
      setLoading(false);
    }
  }, [perPage, buildApiParams]);

  // ── Initialer Daten-Load ───────────────────────────────────────
  useEffect(() => {
    console.log('[State] App mount – lade Meta und Playlists');
    fetchMeta().then(r => {
      setMeta(r.data);
      console.log('[State] Meta geladen:', r.data?.genres?.length, 'Genres');
    }).catch(e => console.error('[State] fetchMeta fehlgeschlagen:', e));

    getPlaylists().then(r => {
      setPlaylists(r.data || []);
      console.log('[State] Playlists geladen:', r.data?.length);
    }).catch(e => console.error('[State] getPlaylists fehlgeschlagen:', e));
  }, []);

  // ── Songs neu laden wenn Filter/Sort/Page sich ändert ──────────
  useEffect(() => {
    loadSongs(page, filters, sortBy, sortDir);
    // eslint-disable-next-line
  }, [page, filters, sortBy, sortDir]);

  // ── Navigation: Nächster Song (ggf. nächste Seite) ────────────
  const handleNext = useCallback(async () => {
    if (idx < songs.length - 1) {
      setIdx(idx + 1);
      if (playMode) setIsPlaying(true);
    } else {
      if (page < totalPages) {
        const nextPage = page + 1;
        console.log('[State] Nächste Seite:', nextPage);
        setLoading(true);
        try {
          const res = await fetchSongs(buildApiParams(nextPage, filters, sortBy, sortDir));
          setSongs(res.data.songs || []);
          setTotal(res.data.total || 0);
          setPage(nextPage);
          setIdx(0);
        } finally {
          setLoading(false);
        }
        if (playMode) setIsPlaying(true);
      }
    }
  }, [idx, songs, page, totalPages, perPage, sortBy, sortDir, filters, buildApiParams, playMode]);

  // ── Navigation: Vorheriger Song (ggf. vorherige Seite) ────────
  const handlePrev = useCallback(async () => {
    if (idx > 0) {
      setIdx(idx - 1);
      if (playMode) setIsPlaying(true);
    } else if (page > 1) {
      const prevPage = page - 1;
      console.log('[State] Vorherige Seite:', prevPage);
      setLoading(true);
      try {
        const res = await fetchSongs(buildApiParams(prevPage, filters, sortBy, sortDir));
        const newSongs = res.data.songs || [];
        setSongs(newSongs);
        setTotal(res.data.total || 0);
        setPage(prevPage);
        setIdx(newSongs.length - 1);
      } finally {
        setLoading(false);
      }
      if (playMode) setIsPlaying(true);
    }
  }, [idx, page, perPage, sortBy, sortDir, filters, buildApiParams, playMode]);

  // ── Handler: Favorit umschalten ───────────────────────────────
  const handleFavoriteToggle = async (song) => {
    const newFav = !song.favorite;
    console.log('[State] Favorit umschalten:', song.id, '→', newFav);
    await toggleFavorite(song.id, newFav);
    setSongs(prev => prev.map(s => s.id === song.id ? { ...s, favorite: newFav } : s));
  };

  // ── Handler: Rating des aktuellen Songs setzen ────────────────
  const handleRatingChange = async (val) => {
    if (!currentSong) return;
    console.log('[State] Rating setzen:', currentSong.id, '→', val);
    await updateSong(currentSong.id, { community_rating: val });
    setSongs(prev => prev.map(s => s.id === currentSong.id ? { ...s, community_rating: val } : s));
  };

  // ── Handler: Rating eines beliebigen Songs setzen ────────────
  const handleSongRating = async (song, val) => {
    console.log('[State] Song-Rating setzen:', song.id, '→', val);
    await updateSong(song.id, { community_rating: val });
    setSongs(prev => prev.map(s => s.id === song.id ? { ...s, community_rating: val } : s));
  };

  // ── Handler: Numerisches Rating 1–9 ─────────────────────────
  const handleNumericRating = useCallback(async (num) => {
    if (!currentSong) return;
    console.log('[State] Numerisches Rating:', num);
    await updateSong(currentSong.id, { community_rating: num });
    setSongs(prev => prev.map(s => s.id === currentSong.id ? { ...s, community_rating: num } : s));
  }, [currentSong]);

  // ── Handler: Metadaten-Speicherung ───────────────────────────
  const handleMetaSave = (updatedSong) => {
    console.log('[State] Metadaten gespeichert:', updatedSong.id);
    setSongs(prev => prev.map(s => s.id === updatedSong.id ? updatedSong : s));
    setEditingSong(null);
  };

  // ── Handler: Song löschen ─────────────────────────────────────
  const handleDeleteSong = async (song) => {
    console.log('[State] Song löschen:', song.id);
    await deleteSong(song.id);
    setSongs(prev => {
      const newSongs = prev.filter(s => s.id !== song.id);
      if (idx >= newSongs.length) setIdx(Math.max(0, newSongs.length - 1));
      return newSongs;
    });
    setDeleteConfirmSong(null);
  };

  // ── Handler: Playlist hinzufügen ──────────────────────────────
  const handleAddToPlaylist = async (name, songId) => {
    console.log('[API] addToPlaylist', name, songId);
    try {
      await addToPlaylist(name, songId);
    } catch (e) {
      console.error('[API] addToPlaylist fehlgeschlagen:', e);
    }
  };

  // ── Handler: Filter anwenden ──────────────────────────────────
  const handleApplyFilter = (newFilters) => {
    console.log('[State] Filter angewandt:', newFilters);
    setFilters(newFilters);
    setPage(1);
    setIdx(0);
    setShowFilter(false);
  };

  // ── Handler: Sortierung anwenden ─────────────────────────────
  const handleApplySort = (newSortBy, newSortDir) => {
    console.log('[State] Sortierung:', newSortBy, newSortDir);
    setSortBy(newSortBy);
    setSortDir(newSortDir);
    setPage(1);
    setIdx(0);
  };

  // ── Globale Keyboard-Shortcuts ────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      const tag = e.target.tagName.toLowerCase();
      const isTextInput = (tag === 'input' && !['checkbox','radio','range','button','submit'].includes(e.target.type))
                        || tag === 'textarea';
      if (isTextInput && (e.key === ' ' || e.key === 'Enter')) return;
      if (tag === 'select') return;
      const key = e.key;

      // Numerisches Rating 1–9 direkt setzen
      if (key >= '1' && key <= '9') {
        e.preventDefault();
        if (currentSong) handleNumericRating(parseInt(key));
        return;
      }

      switch (key) {
        case ' ': case 'Enter':
          e.preventDefault();
          window._playerPlayPause?.();
          break;
        case 'ArrowDown':
          e.preventDefault();
          window._playerNext?.();
          break;
        case 'ArrowUp':
          e.preventDefault();
          window._playerPrev?.();
          break;
        case 'ArrowRight':
          e.preventDefault();
          window._playerSeek?.(10);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          window._playerSeek?.(-10);
          break;
        case ',':
          e.preventDefault();
          window._playerSeek?.(-10);
          break;
        case '.':
          e.preventDefault();
          window._playerSeek?.(10);
          break;
        case 'f': case 'F':
          e.preventDefault();
          setShowFilter(true);
          break;
        case 'm': case 'M':
          e.preventDefault();
          if (currentSong) setEditingSong(currentSong);
          break;
        case 'c': case 'C':
          e.preventDefault();
          window._playerClipMode?.();
          break;
        case 'o': case 'O':
          e.preventDefault();
          setShowSort(true);
          break;
        case 'Delete':
          e.preventDefault();
          if (currentSong) setDeleteConfirmSong(currentSong);
          break;
        case 'a': case 'A':
          e.preventDefault();
          if (playlists[0] && currentSong) handleAddToPlaylist(playlists[0].name, currentSong.id);
          break;
        case 'b': case 'B':
          e.preventDefault();
          if (playlists[1] && currentSong) handleAddToPlaylist(playlists[1].name, currentSong.id);
          break;
        case 'p': case 'P':
          e.preventDefault();
          setShowPlaylistManager(true);
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line
  }, [currentSong, playlists, handleNext, handlePrev, handleNumericRating]);

  // ── Station-Edit Callbacks ────────────────────────────────────
  const openStationEdit = (station) => {
    setEditingStation(station);
    setShowStationEditModal(true);
  };

  const handleStationSaveOrDelete = () => {
    setShowStationEditModal(false);
    setEditingStation(null);
  };

  // Ob aktive Filter gesetzt sind (für visuelle Hervorhebung)
  const hasFilters = Object.keys(filters).some(k => {
    const v = filters[k];
    if (Array.isArray(v)) return v.length > 0;
    return v !== undefined && v !== '' && v !== false;
  });

  return (
    <LanguageProvider>
    <div className="app-layout">
      {/* ── Kopfleiste ── */}
      <AppHeader
        total={total}
        page={page}
        totalPages={totalPages}
        hasFilters={hasFilters}
        onFilter={() => setShowFilter(true)}
        onSort={() => setShowSort(true)}
        onRecording={() => setShowRecording(true)}
        onPlaylists={() => setShowPlaylistManager(true)}
        onCleanup={() => setShowCleanup(true)}
      />

      {/* ── Song-Tabelle + Pagination ── */}
      <div className="app-main">
        <SongTable
          songs={songs}
          idx={idx}
          isPlaying={isPlaying}
          page={page}
          perPage={perPage}
          totalPages={totalPages}
          total={total}
          loading={loading}
          onSelectSong={(i) => { setIdx(i); setPlayMode(true); setIsPlaying(true); }}
          onFavorite={handleFavoriteToggle}
          onRating={handleSongRating}
          onEditMeta={setEditingSong}
          onAddToPlaylist={(song) => { setSongForPlaylist(song); setShowPlaylistManager(true); }}
          onPageChange={(p) => { setPage(p); setIdx(0); }}
          visibleColumns={visibleColumns}
        />
      </div>

      {/* ── Player-Bar ── */}
      {currentSong && (
        <Player
          song={currentSong}
          nextSong={songs[idx + 1] || null}
          playlists={playlists}
          isPlaying={isPlaying}
          setIsPlaying={setIsPlaying}
          playMode={playMode}
          setPlayMode={setPlayMode}
          onPrev={handlePrev}
          onNext={handleNext}
          onFavoriteToggle={handleFavoriteToggle}
          onEditMeta={(s) => setEditingSong(s)}
          onDeleteSong={handleDeleteSong}
          onRatingChange={handleRatingChange}
          onOpenPlaylist={() => setShowPlaylistManager(true)}
        />
      )}

      {/* ── Modals (conditional render) ── */}
      {showFilter && (
        <FilterModal meta={meta} filters={filters} onApply={handleApplyFilter} onClose={() => setShowFilter(false)} />
      )}
      {showSort && (
        <SortOrderModal sortBy={sortBy} sortDir={sortDir} onApply={handleApplySort} onClose={() => setShowSort(false)} />
      )}
      {editingSong && (
        <MetaEditModal song={editingSong} onSave={handleMetaSave} onClose={() => setEditingSong(null)} />
      )}
      {deleteConfirmSong && (
        <ConfirmModal
          message={`"${deleteConfirmSong.title || deleteConfirmSong.filename}" wirklich löschen?`}
          onConfirm={() => handleDeleteSong(deleteConfirmSong)}
          onClose={() => setDeleteConfirmSong(null)}
        />
      )}
      {showCleanup && (
        <CleanupDialog onClose={() => {
          setShowCleanup(false);
          // Nach dem Aufräumen Liste neu laden
          loadSongs(page, filters, sortBy, sortDir);
        }} />
      )}

      {showRecording && (
        <RecordingControlDialog
          onClose={() => setShowRecording(false)}
          onEditStation={openStationEdit}
        />
      )}
      {showPlaylistManager && (
        <PlaylistManager
          open={showPlaylistManager}
          onClose={() => { setShowPlaylistManager(false); setSongForPlaylist(null); }}
          currentSong={songForPlaylist || currentSong}
          onPlaylistsChanged={(pls) => setPlaylists(pls)}
        />
      )}
      {showStationEditModal && (
        <StationEditModal
          open={showStationEditModal}
          onClose={() => { setShowStationEditModal(false); setEditingStation(null); }}
          station={editingStation}
          onSave={handleStationSaveOrDelete}
          onDelete={handleStationSaveOrDelete}
        />
      )} 
    </div>
    </LanguageProvider>
  );
}

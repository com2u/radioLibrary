/**
 * SongTable – Tabellen-Ansicht der Song-Liste mit Paginierung.
 */
import StarRating from './StarRating';
import NowPlayingBars from './NowPlayingBars';
import { fmtTime } from '../utils';

export default function SongTable({
  songs,
  idx,
  isPlaying,
  page,
  perPage,
  totalPages,
  total,
  loading,
  onSelectSong,
  onFavorite,
  onRating,
  onEditMeta,
  onAddToPlaylist,
  onPageChange,
  visibleColumns,
}) {
  // Fallback: falls keine Sichtbarkeit übergeben wurde, alles anzeigen
  const vis = visibleColumns || {
    title: true, favorite: true, length: true, rating: true,
    genre: true, playlist: true, comment: true, edit: true,
  };
  if (loading) return (
    <div className="empty-state">
      <div style={{ fontSize: 28, marginBottom: 10, opacity: 0.4 }}>⏳</div>
      Laden…
    </div>
  );
  if (!songs.length) return (
    <div className="empty-state">
      <div style={{ fontSize: 32, marginBottom: 10, opacity: 0.3 }}>🎵</div>
      Keine Songs gefunden.
    </div>
  );

  return (
    <>
      <div className="song-table-wrap">
        <table className="song-table">
          <thead>
            <tr>
              <th style={{ width: 40, textAlign: 'center' }}>#</th>
              <th style={{ width: vis.title && !vis.genre ? '70%' : '38%' }}>Titel</th>
              {vis.favorite && <th style={{ width: 36, textAlign: 'center' }} title="Favorit"><i className="fa-solid fa-heart" /></th>}
              {vis.length && <th style={{ width: 64 }}>Länge</th>}
              {vis.rating && <th style={{ width: 110 }}>Rating</th>}
              {vis.genre && <th style={{ width: '11%' }}>Genre</th>}
              {vis.playlist && <th style={{ width: 46, textAlign: 'center' }} title="Zur Playlist hinzufügen"><i className="fa-solid fa-list"></i></th>}
              {vis.comment && <th style={{ width: '17%' }}>Kommentar</th>}
              {vis.edit && <th style={{ width: 46, textAlign: 'center' }} title="Metadaten bearbeiten"><i className="fa-solid fa-pen-to-square"></i></th>}
            </tr>
          </thead>
          <tbody>
            {songs.map((song, i) => (
              <tr
                key={song.id}
                className={`song-row ${i === idx ? 'playing' : ''}`}
                onClick={() => onSelectSong(i)}
              >
                {/* Row number / now playing indicator */}
                <td style={{ color: 'var(--text-muted)', textAlign: 'center', fontSize: 11 }}>
                  {i === idx && isPlaying
                    ? <NowPlayingBars />
                    : (page - 1) * perPage + i + 1
                  }
                </td>

                {/* Title + Artist */}
                <td>
                  <div className="song-title">{song.title || song.filename}</div>
                  {song.artist && <div className="song-artist">{song.artist}</div>}
                </td>

                {/* Favorite */}
                {vis.favorite && (
                  <td style={{ textAlign: 'center' }}>
                    <span
                      className={`heart-sm ${song.favorite ? 'active' : ''}`}
                      onClick={(e) => { e.stopPropagation(); onFavorite(song); }}
                      title="Favorit umschalten"
                    >♥</span>
                  </td>
                )}

                {/* Duration */}
                {vis.length && (
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{fmtTime(song.duration)}</td>
                )}

                {/* Star Rating */}
                {vis.rating && (
                  <td onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <StarRating
                        rating={song.community_rating}
                        onChange={(val) => onRating(song, val)}
                        size={13}
                      />
                      {song.community_rating > 0 && (
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                          {song.community_rating}
                        </span>
                      )}
                    </div>
                  </td>
                )}

                {/* Genre */}
                {vis.genre && (
                  <td>
                    {song.genre && <span className="genre-tag">{song.genre}</span>}
                  </td>
                )}

                {/* Add to Playlist button */}
                {vis.playlist && (
                  <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                    <button
                      className="icon-btn"
                      style={{ fontSize: 13, minWidth: 28, minHeight: 28 }}
                      onClick={() => onAddToPlaylist(song)}
                      title="Zu Playlist hinzufügen"
                    ><i className="fa-solid fa-list"></i></button>
                  </td>
                )}

                {/* Comment */}
                {vis.comment && (
                  <td style={{
                    fontSize: 11,
                    color: 'var(--text-muted)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {song.comment}
                  </td>
                )}

                {/* Edit meta icon */}
                {vis.edit && (
                  <td
                    className="song-row-actions"
                    style={{ textAlign: 'center' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      className="icon-btn"
                      style={{ fontSize: 13, minWidth: 28, minHeight: 28 }}
                      onClick={() => onEditMeta(song)}
                      title="Metadaten bearbeiten (M)"
                    ><i className="fa-solid fa-pen-to-square"></i></button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <button
            className="btn btn-secondary btn-sm"
            disabled={page <= 1}
            onClick={() => onPageChange(1)}
            title="Erste Seite"
          ><i className="fa-solid fa-angles-left"></i></button>
          <button
            className="btn btn-secondary btn-sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            title="Vorherige Seite"
          ><i className="fa-solid fa-angle-left"></i></button>
          <span className="page-info">
            Seite{' '}
            <input
              type="number"
              min={1}
              max={totalPages}
              value={page}
              onChange={e => {
                const p = parseInt(e.target.value);
                if (p >= 1 && p <= totalPages) onPageChange(p);
              }}
              style={{ width: 56, textAlign: 'center', background: 'var(--bg-card)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 4px' }}
            />
            {' '}/ {totalPages} &nbsp;·&nbsp; {total.toLocaleString()} Songs
          </span>
          <button
            className="btn btn-secondary btn-sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            title="Nächste Seite"
          ><i className="fa-solid fa-angle-right"></i></button>
          <button
            className="btn btn-secondary btn-sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange(totalPages)}
            title="Letzte Seite"
          ><i className="fa-solid fa-angles-right"></i></button>
        </div>
      )}
    </>
  );
}

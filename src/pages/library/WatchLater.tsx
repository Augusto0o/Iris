import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomSheet, Empty, Icon, NavBar } from '@/components/ui';
import { useStore } from '@/hooks/useData';
import { mediaLists, sourceOf } from '@/services/lists';
import { Poster } from '@/pages/Movies';
import type { MediaItem } from '@/types';
import { cx } from '@/utils/misc';

const DONE = new Set(['watched', 'finished', 'dismissed']);

/** «Para ver»: películas y videos pendientes, juntos, con filtro por tipo y género. */
export default function WatchLater() {
  const snap = useStore();
  const navigate = useNavigate();
  const [kind, setKind] = useState<'all' | 'movie' | 'video'>('all');
  const [genre, setGenre] = useState<string | null>(null);
  const [play, setPlay] = useState<MediaItem | null>(null);
  const lists = mediaLists(snap.folder);

  /** Género de cada cosa: el de la película, o la lista / categoría del video. */
  const genreOf = (m: MediaItem) => (m.mediaType === 'movie' ? m.genre ?? null : lists.find((l) => l.id === m.listId)?.name ?? m.category ?? null);

  const pending = useMemo(
    () => snap.media.filter((m) => (m.mediaType === 'movie' || m.mediaType === 'video') && !DONE.has(m.status)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [snap.media],
  );
  const ofKind = pending.filter((m) => kind === 'all' || m.mediaType === kind);
  const genres = [...new Set(ofKind.map(genreOf).filter((g): g is string => !!g))].sort((a, b) => a.localeCompare(b, 'es'));
  const shown = genre ? ofKind.filter((m) => genreOf(m) === genre) : ofKind;

  const open = (m: MediaItem) => {
    if (m.mediaType === 'movie') navigate(`/peliculas?id=${m.id}`);
    else if (m.meta?.videoId) setPlay(m);
    else if (m.url) window.open(m.url, '_blank', 'noopener');
  };

  return (
    <main className="page">
      <NavBar back="/biblioteca" backLabel="Biblioteca" />
      <header className="today-head"><h1 className="today-title">Para ver</h1></header>
      <div className="seg-tabs" role="tablist">
        {([['all', 'Todo'], ['movie', 'Películas'], ['video', 'Videos']] as const).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={kind === id} className={cx('seg-tab', kind === id && 'is-on')} onClick={() => { setKind(id); setGenre(null); }}>
            {label} <span className="num muted">{pending.filter((m) => id === 'all' || m.mediaType === id).length}</span>
          </button>
        ))}
      </div>
      {genres.length > 0 && (
        <div className="genre-row mt-4">
          <button type="button" className="pill-btn" aria-pressed={!genre} onClick={() => setGenre(null)}>Todos los géneros</button>
          {genres.map((g) => <button key={g} type="button" className="pill-btn" aria-pressed={genre === g} onClick={() => setGenre(genre === g ? null : g)}>{g}</button>)}
        </div>
      )}
      {!shown.length ? (
        <Empty title="Nada pendiente acá" message="Las películas que marcás «Quiero verla» y los videos que guardás aparecen en esta lista." />
      ) : (
        <div className="watch-grid">
          {shown.map((m) => (
            <button key={m.id} type="button" className={cx('watch-card', m.mediaType === 'video' && 'is-video')} onClick={() => open(m)}>
              {m.mediaType === 'movie' ? <Poster src={m.cover} title={m.title} /> : (
                <span className="watch-thumb">{m.cover ? <img src={m.cover} alt="" loading="lazy" /> : <Icon name="video" size={22} />}</span>
              )}
              <span className="poster-title clamp-2">{m.title}</span>
              <span className="poster-sub">{m.mediaType === 'movie' ? [m.year, m.genre].filter(Boolean).join(' · ') : [genreOf(m), sourceOf(m) === 'youtube' ? 'YouTube' : sourceOf(m) === 'instagram' ? 'Instagram' : sourceOf(m) === 'tiktok' ? 'TikTok' : ''].filter(Boolean).join(' · ')}</span>
            </button>
          ))}
        </div>
      )}
      <BottomSheet open={!!play} onClose={() => setPlay(null)} title={play?.title ?? 'Video'}>
        {play?.meta?.videoId && <iframe className="trailer-frame" src={`https://www.youtube-nocookie.com/embed/${play.meta.videoId}?autoplay=1&playsinline=1&rel=0`} title={play.title} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />}
      </BottomSheet>
    </main>
  );
}

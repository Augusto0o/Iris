import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BottomSheet, Icon, useFeedback } from '@/components/ui';
import { useStore } from '@/hooks/useData';
import { aiAvailable, recommend, type RecItem } from '@/services/ai';
import { dismissedOf, dismissRec } from '@/services/dismissed';
import { mediaLists } from '@/services/lists';
import { newMedia, saveMedia } from '@/services/media';
import { buildDocs } from '@/services/queries';
import { ytConnected, ytFind } from '@/services/youtube';
import { MoveSheet } from '@/pages/library/ListPage';
import type { MediaItem } from '@/types';
import { cx } from '@/utils/misc';

const TOPICS = ['Todo', 'IA y tecnología', 'Ciencia', 'Historia', 'Documentales', 'Negocios', 'Filosofía', 'Diseño', 'Psicología', 'Charlas', 'Aprender algo nuevo'];

interface VideoRec extends RecItem { videoId?: string | null; thumb?: string | null }

const CACHE = 'pos-video-recs';
const cacheGet = (): Record<string, string> => {
  try {
    return JSON.parse(localStorage.getItem(CACHE) ?? '{}');
  } catch {
    return {};
  }
};

/** Videos recomendados (no solo música): charlas, documentales, explicativos… con portada y para ver acá. */
export function VideoRecs() {
  const snap = useStore();
  const { toast } = useFeedback();
  const [topic, setTopic] = useState('Todo');
  const [items, setItems] = useState<VideoRec[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [play, setPlay] = useState<VideoRec | null>(null);
  const [moving, setMoving] = useState<MediaItem | null>(null);
  const yt = ytConnected();

  const load = async (t = topic) => {
    if (!aiAvailable()) {
      toast('Activá la IA en Ajustes → IA para recomendaciones de videos.', { tone: 'error' });
      return;
    }
    setBusy(true);
    setItems(null);
    try {
      const saved = snap.media.filter((m) => m.mediaType === 'video').map((v) => v.title).slice(0, 25);
      const lists = mediaLists(snap.folder).map((l) => l.name);
      const notes = buildDocs(snap, [], 'all').filter((d) => d.kind === 'journal' || d.kind === 'note').slice(0, 25).map((d) => d.title).filter(Boolean);
      const dismissed = dismissedOf('videos');
      const profile = [
        'Recomendá VIDEOS CONCRETOS de YouTube que existan (title = título exacto del video, creator = canal, category = tipo). NO videos musicales ni videoclips.',
        'Variedad: documentales, charlas, explicativos, entrevistas, ensayos en video. Preferí contenido en español o con subtítulos.',
        t !== 'Todo' ? `Tema pedido: ${t}. Solo videos de ese tema.` : 'Tema libre: mezclá temas según sus intereses.',
        `Videos que guardó: ${saved.join('; ') || '—'}`,
        `Sus listas de videos: ${lists.join(', ') || '—'}`,
        `Temas de sus notas: ${notes.join(', ') || '—'}`,
        `Marcó «no me interesa» (no recomendar): ${dismissed.slice(-40).join('; ') || '—'}`,
      ].join('\n');
      const recs = (await recommend('videos', profile)).filter((r) => !dismissed.some((d) => d.toLowerCase() === r.title.toLowerCase()));
      const cache = cacheGet();
      const out: VideoRec[] = [];
      for (const r of recs.slice(0, 8)) {
        const key = `${r.title}|${r.creator}`;
        let id: string | null = cache[key] ?? null;
        if (!id && yt) {
          try {
            id = (await ytFind(`${r.title} ${r.creator}`)).videoId;
            if (id) cache[key] = id;
          } catch {
            /* sin cupo: queda sin portada */
          }
        }
        out.push({ ...r, videoId: id, thumb: id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null });
        setItems([...out]);
      }
      try {
        localStorage.setItem(CACHE, JSON.stringify(cache));
      } catch {
        /* lleno */
      }
      setItems(out);
    } catch (e) {
      const msg = (e as Error).message;
      toast(/fetch|network|load failed/i.test(msg) ? 'No se pudieron cargar las recomendaciones (¿sin conexión?).' : msg, { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async (r: VideoRec) => {
    const m = newMedia('video', {
      title: r.title, creator: r.creator ?? '', category: 'Ver más tarde', notes: r.why ?? '',
      url: r.videoId ? `https://www.youtube.com/watch?v=${r.videoId}` : `https://www.youtube.com/results?search_query=${encodeURIComponent(`${r.title} ${r.creator}`)}`,
      cover: r.thumb ?? null, status: 'later', ...(r.videoId ? { meta: { videoId: r.videoId } } : {}),
    });
    await saveMedia(m);
    return m;
  };

  return (
    <section className="block">
      <div className="genre-row">
        {TOPICS.map((t) => (
          <button key={t} type="button" className="pill-btn" aria-pressed={topic === t} onClick={() => { setTopic(t); void load(t); }}>{t}</button>
        ))}
      </div>
      {!yt && <p className="group-foot">Conectá YouTube en <Link to="/ajustes#youtube">Ajustes → YouTube Music</Link> para ver las portadas y reproducir los videos acá.</p>}
      {busy && !items?.length && <div className="video-recs">{Array.from({ length: 4 }, (_, i) => <div key={i} className="video-rec skeleton" style={{ height: 230 }} />)}</div>}
      {items && (
        <div className="video-recs">
          {items.map((r, i) => (
            <article key={`${r.title}-${i}`} className="video-rec">
              <button type="button" className={cx('video-thumb', !r.thumb && 'is-empty')} onClick={() => (r.videoId ? setPlay(r) : window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(`${r.title} ${r.creator}`)}`, '_blank', 'noopener'))}>
                {r.thumb ? <img src={r.thumb} alt="" loading="lazy" /> : <Icon name="video" size={26} />}
                <span className="play-disc is-light"><Icon name="play" size={16} filled strokeWidth={0} /></span>
              </button>
              <div className="video-rec-body">
                <p className="media-title clamp-2">{r.title}</p>
                <p className="row-sub">{[r.creator, r.category].filter(Boolean).join(' · ')}</p>
                {r.why && <p className="rec-why">{r.why}</p>}
                <div className="rec-actions">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={async () => { await save(r); toast('En Para ver'); }}>Ver después</button>
                  <button type="button" className="icon-btn" aria-label="Guardar en una lista" onClick={async () => setMoving(await save(r))}><Icon name="folder" size={18} /></button>
                  <button type="button" className="icon-btn" aria-label="No me interesa" onClick={() => { void dismissRec('videos', r.title); setItems((l) => l?.filter((x) => x !== r) ?? null); }}><Icon name="thumbDown" size={18} /></button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      {!busy && (
        <button type="button" className="btn btn-secondary btn-block mt-4" onClick={() => void load()}>
          <Icon name="refresh" size={16} /> Otros videos
        </button>
      )}
      <BottomSheet open={!!play} onClose={() => setPlay(null)} title={play?.title ?? 'Video'}>
        {play?.videoId && (
          <iframe className="trailer-frame" src={`https://www.youtube-nocookie.com/embed/${play.videoId}?autoplay=1&playsinline=1&rel=0`} title={play.title} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
        )}
      </BottomSheet>
      <MoveSheet item={moving} lists={mediaLists(snap.folder)} onClose={() => setMoving(null)} />
    </section>
  );
}

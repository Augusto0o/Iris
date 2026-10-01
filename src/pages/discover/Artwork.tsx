import { useEffect, useState } from 'react';
import { Icon, NavBar, useFeedback } from '@/components/ui';
import { useStore, useToday } from '@/hooks/useData';
import { store } from '@/database/store';
import { deleteMedia, fetchArtwork, moreArtworks, newMedia, saveMedia, type ArtThumb, type Artwork as Art } from '@/services/media';

const PREF_ART = 'artworkToday3'; // v3: solo paisajes y abstractos

export function daySeed(day: string) {
  return Math.floor(new Date(`${day}T12:00:00`).getTime() / 86_400_000);
}

/** Obra del día con caché diaria (sirve también para el bloque de Inicio). */
export function useArtwork(day: string) {
  const snap = useStore();
  const cached = snap.prefs[PREF_ART] as { day: string; art: Art } | undefined;
  const fresh = cached?.day === day ? cached.art : null;
  const [art, setArt] = useState<Art | null>(fresh);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (fresh) {
      setArt(fresh);
      return;
    }
    let alive = true;
    setError(false);
    setArt(null);
    fetchArtwork(daySeed(day))
      .then((a) => {
        if (!alive) return;
        setArt(a);
        void store.setPref(PREF_ART, { day, art: a });
      })
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day]);
  return { art, error };
}

export default function Artwork() {
  const today = useToday();
  const snap = useStore();
  const daily = useArtwork(today);
  const [pick, setPick] = useState<{ seed: number; index: number } | null>(null);
  const [picked, setPicked] = useState<Art | null>(null);
  const [pickError, setPickError] = useState(false);
  const [others, setOthers] = useState<ArtThumb[]>([]);
  const [fav, setFav] = useState<Art | null>(null);
  const { toast } = useFeedback();
  const favs = snap.media.filter((m) => m.mediaType === 'art');

  const art = fav ?? (pick ? picked : daily.art);
  const error = fav ? false : pick ? pickError : daily.error;
  const saved = art ? favs.find((f) => f.meta?.artId === String(art.id)) : undefined;
  const seed = pick?.seed ?? daySeed(today);

  // Obra elegida («Ver otra» o una de la galería).
  useEffect(() => {
    if (!pick) return;
    let alive = true;
    setPicked(null);
    setPickError(false);
    fetchArtwork(pick.seed, pick.index).then((a) => alive && setPicked(a)).catch(() => alive && setPickError(true));
    return () => {
      alive = false;
    };
  }, [pick]);

  // Más obras de la misma tanda para explorar.
  useEffect(() => {
    if (!art) return;
    let alive = true;
    void moreArtworks(seed, art.id).then((l) => alive && setOthers(l)).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [seed, art]);

  const another = () => {
    setFav(null);
    setPick({ seed: Math.floor(Math.random() * 100_000), index: Math.floor(Math.random() * 25) });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <main className="page">
      <NavBar back="/biblioteca" backLabel="Biblioteca" title={fav ? 'Favorita' : pick ? 'Otra obra' : 'Obra del día'} />
      {error ? (
        <div className="mt-6">
          <p className="quiet">No se pudo cargar la obra (necesita conexión).</p>
          <button type="button" className="btn btn-secondary btn-block mt-4" onClick={another}>Probar con otra</button>
        </div>
      ) : !art ? (
        <div className="mt-4">
          <div className="art-skeleton skeleton" />
          <p className="quiet">{pick ? 'Buscando la obra y traduciendo su historia…' : 'Cargando la obra del día…'}</p>
        </div>
      ) : (
        <article className="art">
          <a href={art.url} target="_blank" rel="noopener noreferrer" className="art-frame">
            <img src={art.image} alt={`${art.title}, ${art.artist}`} />
          </a>
          <h1 className="art-title">{art.title}</h1>
          <p className="art-meta">{art.artist}{art.year ? ` · ${art.year}` : ''}</p>
          <p className="art-museum">{art.museum}</p>
          {art.story && <p className="art-story">{art.story}</p>}
          {art.context && <p className="art-context">{art.context}</p>}
          <div className="hstack mt-6">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={async () => {
                if (saved) {
                  await deleteMedia(saved.id);
                  toast('Quitada de favoritas');
                } else {
                  await saveMedia(newMedia('art', { title: art.title, creator: art.artist, cover: art.thumb, url: art.url, year: art.year, notes: art.story, status: 'liked', meta: { artId: String(art.id), museum: art.museum, image: art.image, context: art.context } }));
                  toast('Guardada en favoritas');
                }
              }}
            >
              <Icon name="heart" size={16} filled={!!saved} strokeWidth={saved ? 0 : 1.75} /> {saved ? 'En favoritas' : 'Guardar en favoritas'}
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={another}>Ver otra</button>
            {(pick || fav) && <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setPick(null); setFav(null); }}>Volver a la del día</button>}
          </div>
        </article>
      )}

      {others.length > 0 && (
        <section className="block">
          <div className="block-head"><h2>Más obras</h2></div>
          <div className="art-strip">
            {others.map((o) => (
              <button key={o.id} type="button" className="art-thumb" onClick={() => { setFav(null); setPick({ seed: o.seed, index: o.index }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                <img src={o.thumb} alt={o.title} loading="lazy" />
                <span className="clamp-2">{o.artist}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {favs.length > 0 && (
        <section className="group">
          <h2 className="group-title"><span>Tus favoritas · {favs.length}</span></h2>
          <ul className="art-favs">
            {favs.map((f) => (
              <li key={f.id}>
                <button type="button" onClick={() => {
                  setFav({ id: f.meta?.artId ?? f.id, title: f.title, artist: f.creator, year: f.year ?? '', museum: f.meta?.museum ?? '', image: f.meta?.image ?? f.cover ?? '', thumb: f.cover ?? '', story: f.notes ?? '', context: f.meta?.context ?? '', url: f.url ?? '' });
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}>
                  {f.cover && <img src={f.cover} alt={f.title} loading="lazy" onError={(e) => (e.currentTarget.style.visibility = 'hidden')} />}
                  <span className="media-title clamp-2">{f.title}</span>
                  <span className="row-sub">{f.creator}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="group-foot mt-6">Obras de dominio público del Cleveland Museum of Art. Textos traducidos al español.</p>
    </main>
  );
}

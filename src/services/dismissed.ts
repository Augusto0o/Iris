/**
 * «No me interesa»: lo descartado no se vuelve a recomendar (se guarda y se sincroniza).
 */
import { store } from '@/database/store';
import { PREF } from './prefs';

export type RecKindKey = 'movies' | 'books' | 'videos' | 'topics' | 'music';
type Dismissed = Partial<Record<RecKindKey, string[]>>;

const all = (): Dismissed => store.pref<Dismissed>(PREF.dismissedRecs, {});

export const dismissedOf = (kind: RecKindKey) => all()[kind] ?? [];

export async function dismissRec(kind: RecKindKey, ...names: (string | null | undefined)[]) {
  const cur = all();
  const list = cur[kind] ?? [];
  const add = names.filter((n): n is string => !!n && !list.some((x) => x.toLowerCase() === n.toLowerCase()));
  if (!add.length) return;
  await store.setPref(PREF.dismissedRecs, { ...cur, [kind]: [...list, ...add].slice(-300) });
}

export const isDismissed = (kind: RecKindKey, ...names: (string | null | undefined)[]) => {
  const set = new Set(dismissedOf(kind).map((x) => x.toLowerCase()));
  return names.some((n) => !!n && set.has(n.toLowerCase()));
};

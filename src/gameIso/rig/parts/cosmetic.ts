import type { PartArt } from './types';
import { baseSpeciesOf } from '../skeletons';
import { GENERATED_HEADS } from './generated/heads';
import { HAIRSTYLES } from './generated/hairstyles';
import HEAD_VIEWS_JSON from './generated/headViews.json';

// Vues dos/profil des têtes (E·7, générées par workflow) — composées au front existant.
type HeadViewSet = { back?: string; profile?: string };
const HEAD_VIEWS = HEAD_VIEWS_JSON as Record<string, { visage?: HeadViewSet; cheveux?: HeadViewSet }>;

// Œil de secours : blanc + iris @yeux + pupille (PAS le gradient monstre g_eye).
const eye = (cx: number) =>
  `<ellipse cx="${cx}" cy="7" rx="2" ry="1.3" fill="#f3ede1"/><circle cx="${cx}" cy="7" r="1.1" fill="@yeux"/><circle cx="${cx}" cy="7" r="0.6" fill="#140a06"/>`;

const VISAGE: Record<string, string[]> = {
  default: [
    `<circle cx="0" cy="7" r="9" fill="@peau"/>${eye(-3)}${eye(3)}`,
    `<circle cx="0" cy="7" r="9" fill="@peauO"/>${eye(-3)}${eye(3)}`,
  ],
};

const CHEVEUX: Record<string, string[]> = {
  'Humain:M': [
    `<path d="M-9 6 Q0 -7 9 6 Q5 -1 0 -1 Q-5 -1 -9 6Z" fill="@cheveux"/>`,
    `<path d="M-9 7 Q-10 -8 0 -8 Q10 -8 9 7 Q4 -2 0 -2 Q-4 -2 -9 7Z" fill="@cheveuxO"/>`,
    `<path d="M-9 6 Q0 -6 9 6 L9 12 Q0 8 -9 12Z" fill="@cheveux"/>`,
  ],
  'Humain:F': [
    `<path d="M-10 4 Q0 -8 10 4 L11 22 Q6 18 5 6 Q0 2 -5 6 Q-6 18 -11 22Z" fill="@cheveux"/>`,
    `<path d="M-10 4 Q0 -9 10 4 L10 16 Q0 10 -10 16Z" fill="@cheveuxH"/>`,
  ],
};

// Vue de DOS générique : crâne COUVERT de cheveux (@cheveux) — corrige « cheveux invisibles
// de dos » (avant : ovale de peau). La nuque/cou minimale (@peau) vient du visage de dos.
const BACK_HAIR =
  '<path d="M-9.7 6 Q-10.7 -9.5 0 -10 Q10.7 -9.5 9.7 6 Q9.3 11 6 12.4 Q0 13.4 -6 12.4 Q-9.3 11 -9.7 6Z" fill="@cheveux"/>' +
  '<path d="M-9.7 6 Q-10.7 -9.5 0 -10 Q-6.5 -7.5 -7.8 0 Q-8.9 4 -9.7 6Z" fill="@cheveuxH" opacity="0.7"/>' +
  '<path d="M0 -10 Q10.7 -9.5 9.7 6 Q8.4 0 6.6 -3.4 Q3.4 -7.4 0 -8Z" fill="@cheveuxO" opacity="0.7"/>' +
  '<path d="M-5 9 Q0 11.5 5 9 M-6 4 Q0 6.5 6 4" stroke="@cheveuxO" stroke-width="0.5" fill="none" opacity="0.5"/>';
// Nuque/cou vus de dos (le crâne est couvert par les cheveux ci-dessus).
const BACK_NAPE =
  '<path d="M-3.8 9.5 Q0 12 3.8 9.5 L3.2 17 Q0 18.6 -3.2 17Z" fill="@peau"/>' +
  '<path d="M-3.6 11 Q0 12.6 3.6 11" stroke="@peauO" stroke-width="0.5" fill="none" opacity="0.5"/>';

function pick(table: Record<string, string[]>, key: string, fallbackKey: string, idx: number): string {
  const arr = table[key] ?? table[fallbackKey] ?? Object.values(table)[0];
  return arr[idx >= 0 && idx < arr.length ? idx : 0];
}

/** Part cosmétique (toujours espèce×sexe). slot ∈ {visage, cheveux}.
 *  Priorité à l'art généré par espèce (dessiné depuis le LDB) ; sinon tables de secours.
 *  CHEVEUX : choix dans [défaut espèce, ...pool de coiffures partagé] via idx (pins/seed). */
export function cosmeticPart(slot: 'visage' | 'cheveux', species: string, sex: 'M' | 'F', idx: number): PartArt {
  const base = baseSpeciesOf(species);
  const key = `${base}:${sex}`;
  const gen = GENERATED_HEADS[key];
  if (slot === 'cheveux') {
    const pool = [gen?.cheveux, ...(HAIRSTYLES[sex] ?? []).map((h) => h.svg)].filter((s): s is string => s != null);
    if (pool.length) {
      const i = ((idx % pool.length) + pool.length) % pool.length;
      // DOS générique (crâne chevelu) pour TOUTES les coiffures ; profil par espèce si dispo.
      const profile = HEAD_VIEWS[key]?.cheveux?.profile;
      return { front: pool[i], back: BACK_HAIR, ...(profile ? { profile } : {}) };
    }
    return { front: pick(CHEVEUX, key, 'Humain:M', idx), back: BACK_HAIR };
  }
  if (gen?.visage != null) {
    // Visage de DOS = nuque seule (le crâne est couvert par les cheveux) ; profil par espèce.
    const profile = HEAD_VIEWS[key]?.visage?.profile;
    return { front: gen.visage, back: BACK_NAPE, ...(profile ? { profile } : {}) };
  }
  // Secours (espèce sans tête générée, ex. Ogre) : nuque de dos, pas le visage de face.
  return { front: pick(VISAGE, key, 'default', idx), back: BACK_NAPE };
}

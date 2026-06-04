import type { PartArt } from './types';
import { baseSpeciesOf } from '../skeletons';
import { GENERATED_HEADS } from './generated/heads';
import { SLICE_HEADS } from './slice-soldat';

const eye = (cx: number) =>
  `<ellipse cx="${cx}" cy="7" rx="1.4" ry="2" fill="url(#g_eye)"/><circle cx="${cx}" cy="7" r="0.8" fill="#140a06"/>`;

const VISAGE: Record<string, string[]> = {
  default: [
    `<circle cx="0" cy="7" r="9" fill="#e2b48c"/>${eye(-3)}${eye(3)}`,
    `<circle cx="0" cy="7" r="9" fill="#d9a87e"/>${eye(-3)}${eye(3)}`,
  ],
};

const CHEVEUX: Record<string, string[]> = {
  'Humain:M': [
    `<path d="M-9 6 Q0 -7 9 6 Q5 -1 0 -1 Q-5 -1 -9 6Z" fill="#5a4427"/>`,
    `<path d="M-9 7 Q-10 -8 0 -8 Q10 -8 9 7 Q4 -2 0 -2 Q-4 -2 -9 7Z" fill="#2f2418"/>`,
    `<path d="M-9 6 Q0 -6 9 6 L9 12 Q0 8 -9 12Z" fill="#7a4a22"/>`,
  ],
  'Humain:F': [
    `<path d="M-10 4 Q0 -8 10 4 L11 22 Q6 18 5 6 Q0 2 -5 6 Q-6 18 -11 22Z" fill="#3a2a18"/>`,
    `<path d="M-10 4 Q0 -9 10 4 L10 16 Q0 10 -10 16Z" fill="#9a6a2a"/>`,
  ],
};

function pick(table: Record<string, string[]>, key: string, fallbackKey: string, idx: number): string {
  const arr = table[key] ?? table[fallbackKey] ?? Object.values(table)[0];
  return arr[idx >= 0 && idx < arr.length ? idx : 0];
}

/** Part cosmétique (toujours espèce×sexe). slot ∈ {visage, cheveux}.
 *  Priorité à l'art généré par espèce (dessiné depuis le LDB) ; sinon tables de secours. */
export function cosmeticPart(slot: 'visage' | 'cheveux', species: string, sex: 'M' | 'F', idx: number): PartArt {
  const base = baseSpeciesOf(species);
  const slice = SLICE_HEADS[`${base}:${sex}`]; // tranche verticale (front/back/profile)
  if (slice?.[slot] != null) return slice[slot];
  const gen = GENERATED_HEADS[`${base}:${sex}`];
  if (gen?.[slot] != null) return gen[slot]!; // PartArt (string = front, ou objet par vue)
  if (slot === 'visage') return pick(VISAGE, `${base}:${sex}`, 'default', idx);
  return pick(CHEVEUX, `${base}:${sex}`, 'Humain:M', idx);
}

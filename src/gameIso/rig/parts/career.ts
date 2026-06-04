import careers from '../../../data/careers.json';
import type { Part } from './types';
import { GENERATED_CAREER_TENUES } from './generated/careerTenues';

type CareerRow = { label: string; class: string };
const BY_LABEL: Record<string, string> = {};
for (const row of careers as CareerRow[]) BY_LABEL[row.label] = row.class;

export function careerClass(career: string): string {
  return BY_LABEL[career] ?? 'Citadins';
}

/** Tenue par défaut d'une classe (torse/jambes, parfois bras/tete). Socle simple. */
const TENUES: Record<string, Partial<Record<'torse' | 'jambes' | 'bras' | 'tete', Part>>> = {
  Guerriers: {
    torse: { svg: `<path d="M-14 -28 Q0 -33 14 -28 L13 4 L11 34 Q0 38 -11 34 L-13 4 Z" fill="url(#g_steel)" stroke="#3a4150"/>` },
    jambes: { svg: `<rect x="-4" y="0" width="8" height="50" rx="3" fill="#3a2c22"/>` },
  },
  Lettrés: {
    torse: { svg: `<path d="M-13 -28 Q0 -32 13 -28 L8 4 L18 50 L-18 50 L-8 4 Z" fill="url(#g_robe)"/>` },
    jambes: { svg: `<rect x="-4" y="0" width="8" height="50" rx="3" fill="#171a36"/>` },
    tete: { svg: `<path d="M-9 -2 Q0 -22 9 -2 Q4 -4 0 -4 Q-4 -4 -9 -2Z" fill="url(#g_robe)"/>` },
  },
  Roublards: {
    torse: { svg: `<path d="M-13 -28 Q0 -32 13 -28 L12 4 L10 34 Q0 38 -10 34 L-12 4 Z" fill="url(#g_coat)"/>` },
    jambes: { svg: `<rect x="-4" y="0" width="8" height="50" rx="3" fill="#1a140e"/>` },
  },
  Ruraux: {
    torse: { svg: `<path d="M-13 -28 Q0 -32 13 -28 L12 4 L10 34 Q0 38 -10 34 L-12 4 Z" fill="#6a5a3a"/>` },
    jambes: { svg: `<rect x="-4" y="0" width="8" height="50" rx="3" fill="#5a4630"/>` },
  },
  Citadins: {
    torse: { svg: `<path d="M-13 -28 Q0 -32 13 -28 L12 4 L10 34 Q0 38 -10 34 L-12 4 Z" fill="#8a7048"/>` },
    jambes: { svg: `<rect x="-4" y="0" width="8" height="50" rx="3" fill="#4c3a26"/>` },
  },
  Courtisans: {
    torse: { svg: `<path d="M-13 -28 Q0 -32 13 -28 L12 4 L10 34 Q0 38 -10 34 L-12 4 Z" fill="#7a3a6a"/>` },
    jambes: { svg: `<rect x="-4" y="0" width="8" height="50" rx="3" fill="#3a2440"/>` },
  },
  Itinérants: {
    torse: { svg: `<path d="M-13 -28 Q0 -32 13 -28 L12 4 L10 34 Q0 38 -10 34 L-12 4 Z" fill="#5a6a3a"/>` },
    jambes: { svg: `<rect x="-4" y="0" width="8" height="50" rx="3" fill="#46521f"/>` },
  },
  Riverains: {
    torse: { svg: `<path d="M-13 -28 Q0 -32 13 -28 L12 4 L10 34 Q0 38 -10 34 L-12 4 Z" fill="#3a5a6a"/>` },
    jambes: { svg: `<rect x="-4" y="0" width="8" height="50" rx="3" fill="#243a44"/>` },
  },
};

export function careerTenue(cls: string): Partial<Record<'torse' | 'jambes' | 'bras' | 'tete', Part>> {
  return TENUES[cls] ?? TENUES.Citadins;
}

/** Tenue résolue pour une carrière : art PAR CARRIÈRE si dispo, sinon archétype de CLASSE. */
export function careerTenueFor(career: string | undefined): Partial<Record<'torse' | 'jambes' | 'bras' | 'tete', Part>> {
  const gen = career ? GENERATED_CAREER_TENUES[career] : undefined;
  if (gen && Object.keys(gen).length) {
    const out: Partial<Record<'torse' | 'jambes' | 'bras' | 'tete', Part>> = {};
    for (const [slot, svg] of Object.entries(gen)) out[slot as 'torse'] = { svg };
    return out;
  }
  return careerTenue(careerClass(career ?? ''));
}

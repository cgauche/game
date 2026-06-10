/**
 * Tables & bonus de la création de personnage — LDB chapitres 04/05 « Personnage ».
 *
 *  - Races aléatoires (LDB 04 l.87-90) : d100 → 01-90 Humain, 91-94 Halfling, 95-98 Nain,
 *    99 Haut elfe, 00 Elfe sylvain ; +20 PX si le PREMIER tirage est accepté.
 *  - Classes et Carrières aléatoires (LDB 05 l.191-195) : 1er jet accepté = +50 PX ; sinon
 *    2 jets de plus et choix parmi les 3 = +25 PX ; sinon choix libre / relances = 0 PX.
 *  - Caractéristiques (LDB 05 l.381-385) : tirage 2d10 gardé = +50 PX ; réassignation des dix
 *    jets = +25 PX ; relance ou répartition de 100 Points (min 4, max 18 par Caractéristique,
 *    + bonus d'espèce) = 0 PX.
 *  - Richesse initiale (LDB 05 l.578-583) : Bronze 2d10 sous × Standing ; Argent 1d10 pistoles
 *    × Standing ; Or 1 couronne d'or × Standing.
 *  - Détails (LDB 05 l.691-744) : âge Humain 15+1d10, Nain 15+10d10, Halfling 15+5d10,
 *    Elfe 30+10d10 ; taille Humain 145+5d10 cm, Nain 130+3d10, Halfling 90+2d10,
 *    Elfe 180+2d10 ; yeux/cheveux : 2d10 sur les tables (eyes.json / hairs.json).
 */
import { RNG, defaultRNG, roll } from './dice';
import { CharKey, CHAR_KEYS } from './types';
import { Money } from './money';
import { SpeciesData, CareerData, eyes as eyesTable, hairs as hairsTable } from '../data';

// Bonus de PX des choix aléatoires acceptés (citations en tête de fichier).
export const XP_SPECIES_ACCEPTED = 20; // LDB 04 l.87
export const XP_CAREER_FIRST = 50; // LDB 05 l.191
export const XP_CAREER_TOP3 = 25; // LDB 05 l.193
export const XP_CHARS_KEPT = 50; // LDB 05 l.381
export const XP_CHARS_REASSIGNED = 25; // LDB 05 l.383

/** Tableau des Races aléatoires (LDB 04 l.90) — bornes hautes d100, labels de species.json. */
export const RANDOM_SPECIES_TABLE: { max: number; label: string }[] = [
  { max: 90, label: 'Humains (Reiklander)' }, // 01-90 Humain
  { max: 94, label: 'Halflings' }, // 91-94
  { max: 98, label: 'Nains' }, // 95-98
  { max: 99, label: 'Hauts elfes' }, // 99
  { max: 100, label: 'Elfes sylvains' }, // 00
];

export function rollSpecies(rng: RNG = defaultRNG): { roll: number; label: string } {
  const r = roll(1, 100, rng);
  const entry = RANDOM_SPECIES_TABLE.find((e) => r <= e.max)!;
  return { roll: r, label: entry.label };
}

/**
 * Tire une Carrière sur le Tableau des Classes et Carrières aléatoires (LDB 05 l.197+), colonne
 * de l'espèce (`refCareer`). Les bornes des données sont les bornes HAUTES par carrière.
 */
export function rollCareer(careers: CareerData[], sp: SpeciesData, rng: RNG = defaultRNG): { roll: number; label: string } | null {
  const col = sp.refCareer;
  const table = careers
    .filter((c) => c.rand?.[col] != null)
    .sort((a, b) => (a.rand[col] as number) - (b.rand[col] as number));
  if (!table.length) return null;
  const r = roll(1, 100, rng);
  const entry = table.find((c) => r <= (c.rand[col] as number)) ?? table[table.length - 1];
  return { roll: r, label: entry.label };
}

/** Répartition manuelle (LDB 05 l.385) : 100 Points, min 4 / max 18 par Caractéristique. */
export const POINT_BUY_TOTAL = 100;
export const POINT_BUY_MIN = 4;
export const POINT_BUY_MAX = 18;

export function validatePointBuy(alloc: Record<CharKey, number>): { ok: boolean; reason?: string } {
  for (const k of CHAR_KEYS) {
    const v = alloc[k];
    if (v == null || !Number.isInteger(v)) return { ok: false, reason: `${k} : valeur manquante` };
    if (v < POINT_BUY_MIN) return { ok: false, reason: `${k} : minimum ${POINT_BUY_MIN} Points` };
    if (v > POINT_BUY_MAX) return { ok: false, reason: `${k} : maximum ${POINT_BUY_MAX} Points` };
  }
  const total = CHAR_KEYS.reduce((a, k) => a + alloc[k], 0);
  if (total !== POINT_BUY_TOTAL) return { ok: false, reason: `total ${total}/${POINT_BUY_TOTAL} Points` };
  return { ok: true };
}

export interface Status {
  tier: 'Bronze' | 'Argent' | 'Or';
  standing: number;
}

/** Parse « Bronze 2 » / « Or 5 » — tolère la typo de données « Agent 1 » (= Argent). */
export function parseStatus(s: string): Status {
  const m = s.trim().match(/^(\S+)\s+(\d+)$/);
  const raw = (m?.[1] ?? s).toLowerCase();
  const standing = m ? parseInt(m[2], 10) : 0;
  const tier: Status['tier'] = raw.startsWith('or') ? 'Or' : raw.startsWith('bron') ? 'Bronze' : 'Argent';
  return { tier, standing };
}

/** Richesse initiale (LDB 05 l.581-583) : Bronze 2d10 sc × Standing ; Argent 1d10 pa ×
 *  Standing ; Or 1 CO × Standing. Standing 0 (ex. Mendiant « Bronze 0 ») → rien. */
export function rollInitialWealth(status: Status, rng: RNG = defaultRNG): Money {
  const m: Money = { gold: 0, silver: 0, brass: 0 };
  if (status.standing <= 0) return m;
  if (status.tier === 'Bronze') m.brass = roll(2 * status.standing, 10, rng);
  else if (status.tier === 'Argent') m.silver = roll(status.standing, 10, rng);
  else m.gold = status.standing;
  return m;
}

/** Famille de détails par refChar : Humain / Nain / Halfling / Elfe (LDB 05 l.691-707). */
function detailFamily(sp: SpeciesData): 'Humain' | 'Nain' | 'Halfling' | 'Elfe' {
  if (/Elfe/i.test(sp.refChar)) return 'Elfe';
  if (/Nain/i.test(sp.refChar)) return 'Nain';
  if (/Halfling|Gnome/i.test(sp.refChar)) return 'Halfling';
  return 'Humain';
}

/** Âge (LDB 05 l.693) : Humain 15+1d10, Nain 15+10d10, Elfe 30+10d10, Halfling 15+5d10. */
export function rollAge(sp: SpeciesData, rng: RNG = defaultRNG): number {
  switch (detailFamily(sp)) {
    case 'Nain': return 15 + roll(10, 10, rng);
    case 'Elfe': return 30 + roll(10, 10, rng);
    case 'Halfling': return 15 + roll(5, 10, rng);
    default: return 15 + roll(1, 10, rng);
  }
}

/** Taille en cm (LDB 05 l.707) : Humain 145+5d10, Nain 130+3d10, Elfe 180+2d10,
 *  Halfling 90+2d10. (Le dé bonus humain sur un 10 — l.705 — n'est pas simulé.) */
export function rollHeight(sp: SpeciesData, rng: RNG = defaultRNG): number {
  switch (detailFamily(sp)) {
    case 'Nain': return 130 + roll(3, 10, rng);
    case 'Elfe': return 180 + roll(2, 10, rng);
    case 'Halfling': return 90 + roll(2, 10, rng);
    default: return 145 + roll(5, 10, rng);
  }
}

/** Couleur des yeux (2d10, table LDB 05 l.719-731) pour la colonne d'espèce (refChar). */
export function rollEyes(sp: SpeciesData, rng: RNG = defaultRNG): string {
  return rollDetail(eyesTable, sp, rng);
}

/** Couleur des cheveux (2d10, table LDB 05 l.733-744). */
export function rollHair(sp: SpeciesData, rng: RNG = defaultRNG): string {
  return rollDetail(hairsTable, sp, rng);
}

function rollDetail(table: { rand: number; color: Record<string, string> }[], sp: SpeciesData, rng: RNG): string {
  const r = roll(2, 10, rng);
  const sorted = [...table].sort((a, b) => a.rand - b.rand);
  const entry = sorted.find((e) => r <= e.rand) ?? sorted[sorted.length - 1];
  return entry.color[sp.refChar] ?? entry.color['Humain'] ?? '';
}

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
import { SpeciesData, CareerData, species as allSpecies, eyes as eyesTable, hairs as hairsTable, details as detailTables } from '../data';

// Bonus de PX des choix aléatoires acceptés (citations en tête de fichier).
export const XP_SPECIES_ACCEPTED = 20; // LDB 04 l.87
export const XP_CAREER_FIRST = 50; // LDB 05 l.191
export const XP_CAREER_TOP3 = 25; // LDB 05 l.193
export const XP_CHARS_KEPT = 50; // LDB 05 l.381
export const XP_CHARS_REASSIGNED = 25; // LDB 05 l.383

/**
 * Tableau des Races aléatoires (LDB 04 l.90) — DÉRIVÉ des données : chaque espèce porte sa
 * borne haute d100 (`SpeciesData.rand`, suppléments inclus). Plusieurs espèces partagent une
 * même borne (variantes régionales d'ADE) : la représentante d'une borne est l'espèce du
 * Livre de base si elle existe, sinon la première en priorité de livre (LDB > ADE1 > ADE2 >
 * autres suppléments).
 */
const BOOK_PRIORITY = ['LDB', 'ADE1', 'ADE2'];
export function randomSpeciesTable(): { max: number; label: string }[] {
  const byBound = new Map<number, SpeciesData[]>();
  for (const s of allSpecies) {
    if (typeof s.rand !== 'number') continue;
    byBound.set(s.rand, [...(byBound.get(s.rand) ?? []), s]);
  }
  const rank = (s: SpeciesData) => {
    const i = BOOK_PRIORITY.indexOf(s.source.book);
    return i === -1 ? BOOK_PRIORITY.length : i;
  };
  return [...byBound.entries()]
    .sort(([a], [b]) => a - b)
    .map(([max, list]) => ({ max, label: list.sort((a, b) => rank(a) - rank(b))[0].label }));
}

export function rollSpecies(rng: RNG = defaultRNG): { roll: number; label: string } {
  const table = randomSpeciesTable();
  const r = roll(1, 100, rng);
  const entry = table.find((e) => r <= e.max) ?? table[table.length - 1];
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

/** Formule « base + N d10 » des tables de détails (details.json), colonne refChar de l'espèce
 *  (repli : colonne Humain). N non entier dans les données (Gnome 2,5) → arrondi au plus près. */
function rollDetailFormula(base: Record<string, number>, dice: Record<string, number>, sp: SpeciesData, rng: RNG): number {
  const b = base[sp.refChar] ?? base['Humain'] ?? 0;
  const n = Math.round(dice[sp.refChar] ?? dice['Humain'] ?? 1);
  return b + (n > 0 ? roll(n, 10, rng) : 0);
}

/** Âge (LDB 05 l.693, table par espèce — ex. Humain 15+1d10, Nain 15+10d10). */
export function rollAge(sp: SpeciesData, rng: RNG = defaultRNG): number {
  return rollDetailFormula(detailTables.ageBase, detailTables.ageRoll, sp, rng);
}

/** Taille en cm (LDB 05 l.707 — ex. Humain 145+5d10, Halfling 90+2d10).
 *  (Le dé bonus humain sur un 10 — l.705 — n'est pas simulé.) */
export function rollHeight(sp: SpeciesData, rng: RNG = defaultRNG): number {
  return rollDetailFormula(detailTables.heightBase, detailTables.heightRoll, sp, rng);
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

/**
 * PÉRILS EN MER — couche PURE de MDG ch.13 (l.423-564), données verbatim dans `src/data/sea-perils.json`.
 * Les COLLISIONS elles-mêmes (Indice de Collision, facteurs) vivent déjà dans `collision.ts` — ici les
 * périls ENVIRONNEMENTAUX qui les déclenchent et leurs états propres :
 *  - **Échouer** (l.471-473) : le navire s'arrête net ; dégagement = Test de Force avec une pénalité
 *    égale au total d'Encombrement du navire et de sa cargaison.
 *  - **Icebergs / Débris marins / Rochers / Bas-fonds** (l.475-499) : IC moyens, chances d'échouage,
 *    empêtrement dans les débris (pénalité par Taille du bateau + Test étendu de Force pour se dégager).
 *  - **Détroits** (l.501-511) : entraînement au M du courant + pénalité aux Tests de Navigation.
 *  - **Tourbillons** (l.514-537) : M / Zone / Man / IC / Évasion des cinq gabarits.
 *  - **Gestion des périls** (l.429-438) : Perception pour repérer / Manœuvre pour éviter, par distance ;
 *    « Un Test d'Orientation est toujours nécessaire après avoir croisé un péril » (l.438).
 */
import seaPerilsJson from '../data/sea-perils.json';
import { d100, type RNG, defaultRNG } from './dice';
import type { Difficulty } from './types';
import type { ShipSize } from '../data';

const SIZE_ORDER: ShipSize[] = ['minuscule', 'tres-petite', 'petite', 'moyenne', 'grande', 'enorme', 'monstrueuse'];

export interface SeaHazardDef {
  id: string;
  label: string;
  m?: number;
  ic: number;
  strandChancePct?: number;
  entangleChancePct?: number;
  entanglePenalties?: { minSize?: ShipSize; maxSize?: ShipSize; manDR: number; mMod: number }[];
  freeTest?: { skillId: string; difficulty: Difficulty; totalDR: number };
  desc: string;
}

export interface StraitDef { id: string; label: string; m: number; navDR: number }

export interface WhirlpoolDef {
  id: string;
  label: string;
  m: number;
  zoneRadiusM: number;
  zoneSpiralM: number;
  manDR: number;
  ic: number;
  evasion: { difficulty: Difficulty; totalDR: number };
}

const DATA = seaPerilsJson as unknown as {
  echouer: { desc: string };
  hazards: SeaHazardDef[];
  detroits: StraitDef[];
  tourbillons: WhirlpoolDef[];
  tourbillonSwim: { skillId: string; difficulty: Difficulty };
  gestionDesPerils: { distanceM: number; spot: Difficulty; avoid: Difficulty }[];
};

export const SEA_HAZARDS = DATA.hazards;
export const STRAITS = DATA.detroits;
export const WHIRLPOOLS = DATA.tourbillons;
export const ECHOUER_DESC = DATA.echouer.desc;
export const findSeaHazard = (id: string): SeaHazardDef | undefined => DATA.hazards.find((h) => h.id === id);
export const findStrait = (id: string): StraitDef | undefined => DATA.detroits.find((s) => s.id === id);
export const findWhirlpool = (id: string): WhirlpoolDef | undefined => DATA.tourbillons.find((w) => w.id === id);

/** Difficultés de GESTION D'UN PÉRIL à `distanceM` (l.429-436) : Perception pour le repérer, Manœuvre
 *  pour l'éviter — la ligne la plus proche ≥ distance (100 m et plus = la plus permissive). PUR. */
export function perilManagement(distanceM: number): { spot: Difficulty; avoid: Difficulty } {
  const rows = [...DATA.gestionDesPerils].sort((a, b) => a.distanceM - b.distanceM);
  for (const r of rows) if (distanceM <= r.distanceM) return { spot: r.spot, avoid: r.avoid };
  return { spot: rows[rows.length - 1].spot, avoid: rows[rows.length - 1].avoid };
}

/** Pénalité de dégagement d'un ÉCHOUAGE (l.473) : « un Test de Force avec une pénalité égale au total
 *  de points d'Encombrement du navire et de sa cargaison ». PUR. */
export function strandingPenalty(shipEnc: number, cargoEnc: number): number {
  return -(Math.max(0, shipEnc) + Math.max(0, cargoEnc));
}

/** Le navire s'échoue-t-il sur ce péril (Rochers 20 % / Bas-fonds 40 %, l.497/499) ? PUR (RNG injecté). */
export function rollStranding(hazard: SeaHazardDef, rng: RNG = defaultRNG): boolean {
  return hazard.strandChancePct != null && d100(rng) <= hazard.strandChancePct;
}

export interface EntangleResult { entangled: boolean; manDR: number; mMod: number }

/** Empêtrement dans des DÉBRIS MARINS après collision (l.485-489) : 20 % de chances ; pénalité par
 *  Taille du bateau (Minuscule-Petite −2 DR Man / −1 M ; Moyenne-Grande −1 DR Man ; au-delà rien). PUR. */
export function rollDebrisEntangle(hazard: SeaHazardDef, shipSize: ShipSize, rng: RNG = defaultRNG): EntangleResult {
  if (hazard.entangleChancePct == null || d100(rng) > hazard.entangleChancePct) return { entangled: false, manDR: 0, mMod: 0 };
  const idx = SIZE_ORDER.indexOf(shipSize);
  for (const p of hazard.entanglePenalties ?? []) {
    const min = p.minSize ? SIZE_ORDER.indexOf(p.minSize) : 0;
    const max = p.maxSize ? SIZE_ORDER.indexOf(p.maxSize) : SIZE_ORDER.length - 1;
    if (idx >= min && idx <= max) return { entangled: true, manDR: p.manDR, mMod: p.mMod };
  }
  return { entangled: true, manDR: 0, mMod: 0 }; // Taille supérieure à Grande : « aucun effet » (l.489)
}

/** Nage dans la Zone d'un Tourbillon (l.522) : « Quiconque nage dans la Zone doit réussir un Test de
 *  Natation Complexe (–10) sous peine de commencer à se noyer. » */
export const WHIRLPOOL_SWIM_TEST = DATA.tourbillonSwim;

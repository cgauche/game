/**
 * CONSTRUIRE UN NAVIRE (MDG ch.12 l.108-164) + INSTALLATION D'AMÉLIORATIONS (l.195-364) + RÉPARATIONS
 * (ch.13 l.639-651) — couche PURE, données verbatim dans `ship-construction.json` / `naval-traits.json`
 * (`install`) / `sea-navigation.json` (`reparation`).
 *
 * Construction en 4 étapes (l.110) : « la Taille du bateau ; son mode de propulsion ; si son style
 * affecte ou non la manœuvrabilité, la vitesse ou l'espace pour la cargaison ; et si des Traits ou des
 * Améliorations s'appliquent au navire. »
 *  1. Taille (l.114-129) : le tableau CARACTÉRISTIQUES DE BATEAU STANDARD donne coût/équipage/M/E/B/Contenance.
 *  2. Propulsion (l.131-133) : « Choisissez la méthode de propulsion principale et réduisez le Mouvement
 *     de l'autre méthode de 2 (jusqu'à un minimum de 3). À noter que les plus grandes catégories de
 *     vaisseaux ne peuvent pas être propulsés à la rame. »
 *  3. Manœuvrabilité (l.135-143) : −2 DR → −40 % ; −1 DR → −20 % ; +1 DR → +20 %.
 *  4. Vitesse (l.145-164) : Escargot… Foudroyant (M ±, Contenance ±%, Man, coût ±%).
 *  Traits de construction (l.167-193) : Peu maniable (−10 %/niveau), Renforcé (+10 E, −10 % Contenance,
 *  +10 %/niveau), Robuste (+10 %), Solide (+30 % B, −10 % Contenance, +20 %/niveau).
 *
 * Améliorations : coût / poids d'installation par bande de Taille (`NavalInstall`, verbatim ch.12) —
 * `per:'5m'` = par tranche de 5 m de Taille (Blindage l.225, Lissage l.289) ; `per:'unite'` = par
 * cabine (l.240) ; `'modele'` = ceux du modèle embarqué (Embarcation de bord, l.268).
 *
 * Réparations (ch.13 l.639-651) : constructeur naval au port — « 1 CO par Blessure restaurée. Chaque
 * Test réussi prend 1d10 heures de travail et restaure 1d10 Blessures » ; Métier (Charpentier) à −10
 * (l.641) ; réparations TEMPORAIRES (l.647-651) : Complexe (−10) à Très Difficile (−30), 1 h et 1d10
 * Blessures par réparation, puis Test d'Endurance par jour de voyage et à chaque Manœuvre — chaque
 * échec inflige 1d10−4 Dégâts. Lissage : réparation +50 % sinon perte du bénéfice (ch.12 l.295).
 */
import shipConstructionJson from '../data/ship-construction.json';
import steamBreakdownJson from '../data/steam-breakdown.json';
import { findTableEntry } from './tables';
import { d100, roll as rollDice, type RNG, defaultRNG } from './dice';
import { rollTest } from './tests';
import type { Difficulty } from './types';
import type { ShipSize, NavalInstall, InstallBand } from '../data';

export type PropulsionKind = 'voile' | 'avirons';

export interface StandardShipRow {
  size: ShipSize;
  costGold: number;
  crew: number;
  sail?: { m: number; crew: number };
  oars?: { m: number; crew: number };
  lengthM: [number, number];
  e: number;
  b: number;
  capacity: number;
}

export interface SpeedTrait { id: string; label: string; mMod: number; capacityPct: number; manDR: number; costPct: number }
interface ManRow { manDR: number; costPct: number }
interface ConstructionTraitRule { id: string; maxLevel: number; costPctPerLevel: number; ePerLevel?: number; bPctPerLevel?: number; capacityPctPerLevel?: number }

const DATA = shipConstructionJson as unknown as {
  standard: StandardShipRow[];
  propulsion: { secondaryMalus: number; secondaryMinM: number };
  manoeuvrability: ManRow[];
  speedTraits: SpeedTrait[];
  constructionTraits: ConstructionTraitRule[];
};

export const STANDARD_SHIPS = DATA.standard;
export const SPEED_TRAITS = DATA.speedTraits;
export const MAN_CHOICES = DATA.manoeuvrability;
export const CONSTRUCTION_TRAITS = DATA.constructionTraits;

const SIZE_ORDER: ShipSize[] = ['minuscule', 'tres-petite', 'petite', 'moyenne', 'grande', 'enorme', 'monstrueuse'];

/** Taille MDG d'un navire d'après sa LONGUEUR (tableau standard, ch.12 l.120-129 : 1-10 m Minuscule …
 *  81 m+ Monstrueuse). PUR. */
export function shipSizeOfLength(lengthM: number): ShipSize {
  for (const row of DATA.standard) if (lengthM <= row.lengthM[1]) return row.size;
  return 'monstrueuse';
}

export interface ShipBuildSpec {
  size: ShipSize;
  /** Méthode de propulsion PRINCIPALE (l.131) ; l'autre est réduite de 2, min 3 — si la catégorie l'offre. */
  primary: PropulsionKind;
  /** Garder la propulsion secondaire ? (les plus grandes catégories n'ont pas d'avirons du tout.) */
  secondary?: boolean;
  /** Modificateur de Manœuvre choisi (−2/−1/0/+1 DR, l.139-143). */
  manDR?: number;
  /** Trait de vitesse (l.149-164), défaut « moyen ». */
  speedTraitId?: string;
  /** Traits de construction (l.167-193) : id (catalogue `naval-traits.json`) → niveau. */
  traits?: { id: string; level: number }[];
}

export interface ShipBuildResult {
  size: ShipSize;
  sail?: { m: number; crew: number };
  oars?: { m: number; crew: number };
  manDR: number;
  e: number;
  b: number;
  capacity: number;
  crew: number;
  /** Coût FINAL en couronnes d'or (base × Σ des modificateurs de %). */
  costGold: number;
  traits: { id: string; level: number }[];
}

/** Construit un navire par les 4 étapes RAW (ch.12 l.108-164) + Traits de construction (l.167-193).
 *  Les % de coût s'appliquent tous AU COÛT DE BASE (« ajoutez 10 % au coût de base ») → additifs. PUR. */
export function buildShip(spec: ShipBuildSpec): ShipBuildResult {
  const std = DATA.standard.find((r) => r.size === spec.size)!;
  const speed = DATA.speedTraits.find((s) => s.id === (spec.speedTraitId ?? 'moyen')) ?? DATA.speedTraits[3];
  const manChoice = DATA.manoeuvrability.find((m) => m.manDR === (spec.manDR ?? 0)) ?? { manDR: 0, costPct: 0 };

  // Étape 2 — propulsion principale : l'autre méthode M −2, min 3 (l.133) ; supprimée si non gardée.
  const adjust = (m: number) => Math.max(DATA.propulsion.secondaryMinM, m - DATA.propulsion.secondaryMalus);
  let sail = std.sail ? { ...std.sail } : undefined;
  let oars = std.oars ? { ...std.oars } : undefined;
  if (spec.primary === 'voile' && oars) oars = spec.secondary ? { ...oars, m: adjust(oars.m) } : undefined;
  if (spec.primary === 'avirons' && sail) sail = spec.secondary ? { ...sail, m: adjust(sail.m) } : undefined;

  // Étape 4 — vitesse : M ± sur la propulsion principale, Contenance ±%, Man cumulée (l.147).
  if (spec.primary === 'voile' && sail) sail.m += speed.mMod;
  if (spec.primary === 'avirons' && oars) oars.m += speed.mMod;

  let capacityPct = speed.capacityPct;
  let costPct = manChoice.costPct + speed.costPct;
  let e = std.e;
  let bPct = 0;

  const traits = (spec.traits ?? []).filter((t) => t.level > 0);
  for (const t of traits) {
    const rule = DATA.constructionTraits.find((r) => r.id === t.id);
    if (!rule) continue;
    const level = Math.min(t.level, rule.maxLevel);
    costPct += rule.costPctPerLevel * level;
    if (rule.ePerLevel) e += rule.ePerLevel * level;
    if (rule.bPctPerLevel) bPct += rule.bPctPerLevel * level;
    if (rule.capacityPctPerLevel) capacityPct += rule.capacityPctPerLevel * level;
  }

  return {
    size: spec.size,
    sail,
    oars,
    manDR: manChoice.manDR + speed.manDR,
    e,
    b: Math.round(std.b * (1 + bPct / 100)),
    capacity: Math.max(0, Math.round(std.capacity * (1 + capacityPct / 100))),
    crew: std.crew,
    costGold: Math.round(std.costGold * (1 + costPct / 100)),
    traits: traits.map((t) => ({ id: t.id, level: Math.min(t.level, DATA.constructionTraits.find((r) => r.id === t.id)?.maxLevel ?? t.level) })),
  };
}

// ── Installation d'Améliorations (MDG ch.12 l.195-364, `NavalInstall`) ───────────────────────────

function bandValue(bands: InstallBand[], size: ShipSize): number {
  const idx = SIZE_ORDER.indexOf(size);
  for (const b of bands) {
    const min = b.min ? SIZE_ORDER.indexOf(b.min) : 0;
    const max = b.max ? SIZE_ORDER.indexOf(b.max) : SIZE_ORDER.length - 1;
    if (idx >= min && idx <= max) return b.value;
  }
  return 0;
}

/** Coût (CO) ou poids (Enc) d'installation d'une Amélioration : bande de Taille × multiplicateur
 *  `per:'5m'` (« par tranche de 5 mètres de Taille », l.225/289 — tranches ENTAMÉES comptées) ou
 *  `per:'unite'` (× `units`). `'modele'` (Embarcation de bord) → `null` : le prix est celui du modèle
 *  embarqué, résolu par l'appelant. PUR. */
export function installAmount(
  part: NonNullable<NavalInstall['cost']>,
  size: ShipSize,
  lengthM: number,
  units = 1,
): number | null {
  if (part === 'modele') return null;
  const base = bandValue(part.bands, size);
  if (part.per === '5m') return base * Math.max(1, Math.ceil(lengthM / 5));
  if (part.per === 'unite') return base * Math.max(1, units);
  return base;
}

/** Coût + poids d'installation d'une Amélioration navale sur une coque de `lengthM` mètres. PUR. */
export function installCost(install: NavalInstall, lengthM: number, units = 1): { gold: number | null; enc: number | null } {
  const size = shipSizeOfLength(lengthM);
  return {
    gold: installAmount(install.cost, size, lengthM, units),
    enc: install.weightEnc ? installAmount(install.weightEnc, size, lengthM, units) : 0,
  };
}

// ── Réparations (MDG ch.13 l.639-651) ────────────────────────────────────────────────────────────

export interface RepairTick { roll: number; target: number; success: boolean; wounds: number; hours: number; costGold: number }

/** UNE passe de réparation au PORT (l.643 : « 1 CO par Blessure restaurée. Chaque Test réussi prend
 *  1d10 heures de travail et restaure 1d10 Blessures ») — `skillValue` = Métier (Constructeur de
 *  navires), ou Métier (Charpentier) déjà pénalisé de −10 par l'appelant (l.641). `lissage` : le coût
 *  monte de 50 % (ch.12 l.295). PUR (RNG injecté). */
export function rollPortRepair(skillValue: number, woundsMissing: number, rng: RNG = defaultRNG, opts: { lissage?: boolean; difficulty?: Difficulty } = {}): RepairTick {
  const t = rollTest(skillValue, opts.difficulty ?? 'intermediaire', rng);
  const hours = rollDice(1, 10, rng);
  if (!t.success) return { roll: t.roll, target: t.target, success: false, wounds: 0, hours, costGold: 0 };
  const wounds = Math.min(woundsMissing, rollDice(1, 10, rng));
  const costGold = wounds * (opts.lissage ? 1.5 : 1);
  return { roll: t.roll, target: t.target, success: true, wounds, hours, costGold };
}

/** UNE réparation TEMPORAIRE en mer (l.647-649) : Complexe (−10) à Très Difficile (−30) selon les
 *  conditions ; réussie → 1 heure, 1d10 Blessures. Le navire devra tester son Endurance par jour de
 *  voyage et à chaque Manœuvre (l.651) — suivi par l'appelant (`temporaryPatched`). PUR. */
export function rollTemporaryRepair(skillValue: number, woundsMissing: number, difficulty: Difficulty, rng: RNG = defaultRNG): RepairTick {
  const t = rollTest(skillValue, difficulty, rng);
  return { roll: t.roll, target: t.target, success: t.success, wounds: t.success ? Math.min(woundsMissing, rollDice(1, 10, rng)) : 0, hours: 1, costGold: 0 };
}

/** Dégâts d'une réparation temporaire qui CÈDE (l.651 : « Chaque Test raté inflige 1d10–4 Dégâts »),
 *  plancher 0. PUR. */
export function temporaryRepairFailureDamage(rng: RNG = defaultRNG): number {
  return Math.max(0, rollDice(1, 10, rng) - 4);
}

// ── Panne de Vapeur (MDG ch.12 l.313-352) ────────────────────────────────────────────────────────

export interface SteamBreakdownEntry {
  min: number;
  max: number;
  id: string;
  label: string;
  desc: string;
  mMod?: number;
  mSet?: number;
  durationRounds?: string;
  failDamage?: string;
  engineDestroyed?: boolean;
  hullCritical?: boolean;
  compartmentDamage?: number;
  restart?: { skillId: string; spec?: string; difficulty: Difficulty; extendedDR?: number }[];
}

export const STEAM_BREAKDOWNS = steamBreakdownJson as SteamBreakdownEntry[];

/** Tirage du tableau PANNE DE VAPEUR (ch.12 l.313 : « Chaque fois que quelqu'un obtient un double sur
 *  un Test de Métier (Ingénieur) raté, que le résultat est un Échec Stupéfiant ou que le bateau subit
 *  un Coup Critique à la Coque »). PUR (RNG injecté). */
export function rollSteamBreakdown(rng: RNG = defaultRNG): SteamBreakdownEntry {
  return findTableEntry(STEAM_BREAKDOWNS, d100(rng));
}

/** Le Test de Métier (Ingénieur) déclenche-t-il une Panne de Vapeur (ch.12 l.313) ? Double sur un Test
 *  RATÉ, ou Échec Stupéfiant (DR ≤ −6). PUR. */
export function steamBreakdownTriggered(t: { success: boolean; sl: number; isDouble?: boolean }): boolean {
  return !t.success && (!!t.isDouble || t.sl <= -6);
}

/**
 * Corruption & mutations — Livre de base, chapitre 19 (p.184-187).
 *
 * Modèle : `Combatant.corruption` (Points de Corruption) + `Combatant.mutations`
 * (la DONNÉE persistée ; les effets mécaniques sont lus à la volée — effectiveChar,
 * testValue, effectiveMovement, recomputeLoadout — pour survivre au writeback de
 * fin de combat, comme les Traumatismes).
 *
 *  - Gains (l.30-75) : expositions mineure/modérée/majeure — Test de Résistance ou
 *    de Calme, Points selon le DR ; Sombre Pacte (l.16/41) : +1 Point volontaire
 *    pour relancer un Test, même après une relance de Chance.
 *  - Seuil (l.80) : corruption > BFM + BE → Test de Résistance Intermédiaire (+0)
 *    à CHAQUE nouveau gain ; échec → mutation.
 *  - Mutation (l.85-91) : −BFM Points, d100 corps/esprit PAR ESPÈCE, tirage sur le
 *    Tableau de Corruption physique ou mentale (src/data/mutations.ts, verbatim).
 *  - Limites (l.95) : mutations physiques > BE ou mentales > BFM → DAMNÉ (le
 *    personnage bascule dans le Chaos — hors-jeu définitif).
 */
import { Combatant, CharKey, HitLocation } from './types';
import { bonus, effectiveChar } from './characteristics';
import type { PsychTrait } from './psychology';

export type ExposureLevel = 'mineure' | 'moderee' | 'majeure';

export const EXPOSURE_LABELS: Record<ExposureLevel, string> = {
  mineure: 'mineure',
  moderee: 'modérée',
  majeure: 'majeure',
};

/** Mutation subie (donnée persistée ; cf. Tableaux LDB 19 p.184-185). */
export interface Mutation {
  label: string;
  kind: 'physique' | 'mentale';
  /** Jet d100 sur le tableau (traçabilité). */
  roll: number;
  /** Modifications PERMANENTES de caractéristiques (« +5 Force », « -10 Sociabilité »…). */
  charMods?: Partial<Record<CharKey, number>>;
  /** Modification du Mouvement (« +1 Mouvement », « -1 Mouvement »). */
  movement?: number;
  /** PA naturels à TOUTES les localisations (Peau d'acier +2, Écailles épineuses +1). */
  apAll?: number;
  /** PA naturels par localisation (Cornes asymétriques : +1 Tête). */
  apLocations?: Partial<Record<HitLocation, number>>;
  /** Modificateur aux Tests d'une Compétence nommée (clé minuscule-préfixe — Groin poilu :
   *  +10 Pistage ; Langue pendante : −10 Langue). Lu par testValue, comme les Traumatismes. */
  skillMods?: Record<string, number>;
  /** Modificateur aux TESTS dérivés d'une caractéristique (Visage inversé : −20 aux Tests
   *  de Sociabilité) — un mod de TEST, pas de caractéristique (le Bonus n'en dérive pas). */
  testMods?: { char: CharKey; mod: number }[];
  /** Traits de créature gagnés (Tentacule épais → « Tentacules »). */
  traits?: string[];
  /** Traits psychologiques gagnés (Colère impie → Frénésie). */
  psychTraits?: PsychTrait[];
  /** Partie non modélisée de l'effet — verbatim, arbitrage MJ (rien d'inventé). */
  note?: string;
}

// ---------------------------------------------------------------------------
// Gains de Corruption (l.30-75)
// ---------------------------------------------------------------------------

/**
 * Points de Corruption gagnés à l'issue du Test de résistance à une exposition :
 *  - mineure (l.31) : échec → 1 ; succès → 0.
 *  - modérée (l.52) : échec → 2 ; Succès Minime (0-1 DR) → 1 ; Succès (2+) → 0.
 *  - majeure (l.65) : échec → 3 ; 0-1 DR → 2 ; 2-3 DR → 1 ; Impressionnant (4+) → 0.
 */
export function corruptionGain(level: ExposureLevel, success: boolean, dr: number): number {
  if (level === 'mineure') return success ? 0 : 1;
  if (level === 'moderee') return success ? (dr <= 1 ? 1 : 0) : 2;
  return success ? (dr <= 1 ? 2 : dr <= 3 ? 1 : 0) : 3;
}

/** Seuil « Corrompu » (l.80) : plus de Points de Corruption que BFM + BE. */
export function corruptionThresholdExceeded(c: Combatant): boolean {
  return (c.corruption ?? 0) > bonus(effectiveChar(c, 'FM')) + bonus(effectiveChar(c, 'E'));
}

// ---------------------------------------------------------------------------
// Dissolution du corps et de l'esprit (l.82-91)
// ---------------------------------------------------------------------------

/**
 * Corps ou esprit, selon l'espèce et le d100 (Tableau l.87-91) :
 *  Corps — Elfe : jamais ; Halfling : 01-10 ; Humain : 01-50 ; Nain : 01-05.
 *  (Les variantes « Haut Elfe », « Elfe sylvain », « Nain (Norse) »… retombent sur
 *  leur racine ; toute autre espèce est traitée comme Humain — le Tableau ne
 *  couvre que les quatre espèces jouables.)
 */
export function mutationKindFor(species: string | undefined, roll: number): 'physique' | 'mentale' {
  const s = (species ?? '').toLowerCase();
  const bodyMax = s.includes('elfe') ? 0 : s.includes('halfling') ? 10 : s.includes('nain') ? 5 : 50;
  return roll <= bodyMax ? 'physique' : 'mentale';
}

/** Limites de Corruption (l.95) : mutations physiques > BE OU mentales > BFM → damné. */
export function mutationLimitExceeded(c: Combatant): boolean {
  const phys = (c.mutations ?? []).filter((m) => m.kind === 'physique').length;
  const ment = (c.mutations ?? []).filter((m) => m.kind === 'mentale').length;
  return phys > bonus(effectiveChar(c, 'E')) || ment > bonus(effectiveChar(c, 'FM'));
}

/** Attache une mutation au personnage : donnée + traits dérivés (créature/psychologie). */
export function attachMutation(c: Combatant, m: Mutation): void {
  c.mutations = [...(c.mutations ?? []), m];
  if (m.traits?.length) c.traits = [...(c.traits ?? []), ...m.traits];
  if (m.psychTraits?.length) c.psychTraits = [...(c.psychTraits ?? []), ...m.psychTraits];
}

// ---------------------------------------------------------------------------
// Lecture des effets (à la volée, comme les Traumatismes)
// ---------------------------------------------------------------------------

/** Somme des modifications PERMANENTES de `key` dues aux mutations (s'ajoute à la base). */
export function mutationCharDelta(c: Combatant, key: CharKey): number {
  let d = 0;
  for (const m of c.mutations ?? []) d += m.charMods?.[key] ?? 0;
  return d;
}

/** Delta de Mouvement dû aux mutations (Pattes d'animaux +1, Corpulent/Court sur pattes −1). */
export function mutationMovementDelta(c: Combatant): number {
  let d = 0;
  for (const m of c.mutations ?? []) d += m.movement ?? 0;
  return d;
}

/** PA naturels de mutation à `loc` (Peau d'acier, Écailles épineuses, Cornes…) — additifs. */
export function mutationArmourBonus(c: Combatant, loc: HitLocation): number {
  let d = 0;
  for (const m of c.mutations ?? []) d += (m.apAll ?? 0) + (m.apLocations?.[loc] ?? 0);
  return d;
}

/** Modificateur de TEST dû aux mutations : compétence nommée (préfixe) + tests dérivés d'une
 *  caractéristique (Visage inversé → −20 aux Tests de Sociabilité). Signé, cumulable. */
export function mutationTestMod(c: Combatant, skill: string | undefined, charKey: CharKey): number {
  let d = 0;
  const low = skill?.toLowerCase();
  for (const m of c.mutations ?? []) {
    if (low && m.skillMods) for (const [k, v] of Object.entries(m.skillMods)) if (low.startsWith(k)) d += v;
    for (const t of m.testMods ?? []) if (t.char === charKey) d += t.mod;
  }
  return d;
}

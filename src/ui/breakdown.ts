import type { ReactNode } from 'react';
import { combineMods, type ModLine, type RollBreakdown, type RollMask } from '../engine/combat';
import { DIFFICULTY_MODIFIERS, type Difficulty } from '../engine/types';
import type { PendingRoll } from './RollLine';

/** Soutien (LDB 12) : la ligne de mod et le rebasage de la valeur soutenue vivent avec la règle
 *  (`engine/skills`), pour que les surfaces composées CÔTÉ ÉTAT (récap de voyage) et les modales
 *  lisent la MÊME source. Ré-exportés ici : les modales composent leur breakdown depuis ce module. */
export { soutienMod, supportSplit } from '../engine/skills';

/**
 * Ligne de jet (RollLine) d'un Test simple : base + modificateurs = cible · d100 · DR — la même
 * présentation que l'Attaque/Défense, pour TOUS les flux de jet (fin du verdict legacy `.test-result`).
 * `target` peut manquer (résultat synthétique d'une Résilience pré-jet) → on retombe sur la base.
 * `difficulty` (optionnelle) est une donnée de LIGNE, jamais une chip (#1072) : `RollLine` la rend en
 * texte + valeur ; sa valeur reste comprise dans `modifier`/`target`. `easedBy` l'annote.
 */
export function testBreakdown(
  label: string,
  base: number,
  r: { roll: number; target?: number; sl?: number; success?: boolean; clamped?: number },
  difficulty?: Difficulty,
  extraMods?: ModLine[],
  easedBy?: string,
): RollBreakdown {
  const target = r.target ?? base;
  return {
    label,
    base,
    modifier: target - base,
    ...(difficulty ? { difficulty } : {}),
    ...(easedBy ? { easedBy } : {}),
    mods: extraMods?.length ? extraMods : undefined,
    target,
    // L'écrêtage voyage tel que le résolveur l'a MESURÉ (`TestResult.clamped`) — jamais redevine ici.
    ...(r.clamped ? { clamped: r.clamped } : {}),
    roll: r.roll,
    success: r.success ?? r.roll <= target,
    sl: r.sl ?? 0,
  };
}

/** Ligne de jet EN ATTENTE (pré-jet) d'un Test simple — même base / cible / mods que `testBreakdown`,
 *  dé et DR vides : pour le panneau PRÉ-REMPLI des flux `RollShell` (parité Attaque/Défense).
 *  `target` omis → dérivé `base + modificateur de Difficulté` (comme le calcule le jet) ; la
 *  Difficulté voyage en donnée de LIGNE (#1072), pas en chip. */
export function testPending(label: ReactNode, base: number, target?: number, difficulty?: Difficulty, extraMods?: ModLine[], easedBy?: string, clamped?: number): PendingRoll {
  const t = target ?? base + (difficulty ? DIFFICULTY_MODIFIERS[difficulty] : 0) + combineMods(extraMods ?? []);
  return {
    label,
    base,
    target: t,
    ...(difficulty ? { difficulty } : {}),
    ...(easedBy ? { easedBy } : {}),
    mods: extraMods?.length ? extraMods : undefined,
    ...(clamped ? { clamped } : {}),
  };
}

/** Une ligne d'un Test OPPOSÉ : sa compétence/caractéristique, sa base, ses mods circonstanciels, et
 *  son résultat MESURÉ (`r`) s'il est déjà lancé — sinon la ligne reste en attente (pré-jet). */
export interface OpposedLineSpec {
  label: string;
  base: number;
  r?: { roll: number; target?: number; sl?: number; success?: boolean; clamped?: number } | null;
  /** Cible pré-jet déjà connue (sinon dérivée `base + Difficulté + mods`). */
  target?: number;
  mods?: ModLine[];
  /** Masque d'AFFICHAGE de la ligne (adversaire opaque — les valeurs restent exactes, cf. `RollMask`). */
  mask?: RollMask;
}

/**
 * Les N lignes d'un Test OPPOSÉ, avec la Difficulté DÉCLARÉE UNE fois pour l'opposition entière
 * (LDB 12 l.166). Chaque ligne sort prête pour une rangée de `RollShell` : `d` (jet lancé) ou
 * `pending` (pré-jet). Réutiliser — ne pas semer la Difficulté ligne à ligne ni refabriquer les
 * `RollBreakdown` d'une opposition à la main.
 */
export function opposedLines(
  specs: OpposedLineSpec[],
  difficulty: Difficulty = 'intermediaire',
): Array<{ d?: RollBreakdown; pending?: PendingRoll }> {
  return specs.map((s) => (s.r
    ? { d: { ...testBreakdown(s.label, s.base, s.r, difficulty, s.mods), ...(s.mask ? { mask: s.mask } : {}) } }
    : { pending: testPending(s.label, s.base, s.target, difficulty, s.mods) }));
}

/**
 * Valeur effective d'une « option de jet » = `base + combineMods(mods)` (plafonds de Difficulté
 * inclus). SOURCE UNIQUE du calcul « base + mods » montré sur le sélecteur d'options
 * (`OptionChooser`) — jusqu'ici réécrit inline dans chaque modale (ex. `segVal` de la Défense).
 * Réutiliser ; ne pas recombiner les mods à la main.
 */
export function optionValue(base: number, mods: ModLine[]): number {
  return base + combineMods(mods);
}

/**
 * Ligne pré-jet d'une option choisie, dans la forme UNIQUE `{ label, base, mods }` (cible omise →
 * dérivée par `PendingRollLine`, ou fournie si déjà plafonnée). Builder canonique vers lequel
 * convergent `previewAttack`/`previewDefense`/`previewCast`/`testPending` (cf. P6) :
 * un seul endroit assemble le pré-jet d'une option. Réutiliser ; ne pas refabriquer l'objet à la main.
 * `difficulty` : donnée de LIGNE (#1072) — `PendingRollLine` la rend en texte et l'inclut dans la
 * cible dérivée, les `mods` restant aux modificateurs circonstanciels.
 */
export function optionPending(label: ReactNode, base: number, mods: ModLine[], target?: number, difficulty?: Difficulty): PendingRoll {
  return { label, base, mods, ...(target != null ? { target } : {}), ...(difficulty ? { difficulty } : {}) };
}

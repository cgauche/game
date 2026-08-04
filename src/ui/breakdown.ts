import type { ReactNode } from 'react';
import { combineMods, type ModLine, type RollBreakdown } from '../engine/combat';
import { DIFFICULTY_LABELS, DIFFICULTY_MODIFIERS, type Difficulty } from '../engine/types';
import type { PendingRoll } from './RollLine';

/** Chip du modificateur de Difficulté (« Accessible +20 ») quand il réconcilie le total — partagé
 *  par la ligne jetée (`testBreakdown`), le pré-jet (`testPending`) et les pieds de volet qui
 *  composent leurs mods (`optionPending` + acharnement…), pas de copie.
 *  `easedBy` : la difficulté a été ALLÉGÉE par une compétence/un talent présent dans le groupe
 *  (`FlowTest.easierIf`) — le chip PORTE la raison (« Facile (allégée : Crochetage) ») au lieu
 *  d'afficher une difficulté tombée du ciel. */
export function difficultyMods(difficulty?: Difficulty, easedBy?: string): ModLine[] | undefined {
  return difficulty && DIFFICULTY_MODIFIERS[difficulty] !== 0
    // « Accessible » sans le suffixe « (+20) » du label canonique : la RollLine affiche déjà la valeur.
    ? [{ label: `${DIFFICULTY_LABELS[difficulty].replace(/\s*\(.*\)$/, '')}${easedBy ? ` (allégée : ${easedBy})` : ''}`, value: DIFFICULTY_MODIFIERS[difficulty] }]
    : undefined;
}

/** Soutien (LDB 12) : la ligne de mod et le rebasage de la valeur soutenue vivent avec la règle
 *  (`engine/skills`), pour que les surfaces composées CÔTÉ ÉTAT (récap de voyage) et les modales
 *  lisent la MÊME source. Ré-exportés ici : les modales composent leur breakdown depuis ce module. */
export { soutienMod, supportSplit } from '../engine/skills';

/**
 * Ligne de jet (RollLine) d'un Test simple : base + modificateurs = cible · d100 · DR — la même
 * présentation que l'Attaque/Défense, pour TOUS les flux de jet (fin du verdict legacy `.test-result`).
 * `target` peut manquer (résultat synthétique d'une Résilience pré-jet) → on retombe sur la base.
 * `difficulty` (optionnelle) étiquette le modificateur (« Accessible +20 ») quand il réconcilie le total.
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
  const mods = [...(extraMods ?? []), ...(difficultyMods(difficulty, easedBy) ?? [])];
  return {
    label,
    base,
    modifier: target - base,
    mods: mods.length ? mods : undefined,
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
 *  `target` omis → dérivé `base + modificateur de Difficulté` (comme le calcule le jet). */
export function testPending(label: ReactNode, base: number, target?: number, difficulty?: Difficulty, extraMods?: ModLine[], easedBy?: string, clamped?: number): PendingRoll {
  const mods = [...(extraMods ?? []), ...(difficultyMods(difficulty, easedBy) ?? [])];
  const t = target ?? base + (difficulty ? DIFFICULTY_MODIFIERS[difficulty] : 0) + combineMods(extraMods ?? []);
  return { label, base, target: t, mods: mods.length ? mods : undefined, ...(clamped ? { clamped } : {}) };
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
 */
export function optionPending(label: ReactNode, base: number, mods: ModLine[], target?: number): PendingRoll {
  return { label, base, mods, ...(target != null ? { target } : {}) };
}

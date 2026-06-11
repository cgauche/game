import type { ModLine, RollBreakdown } from '../engine/combat';
import { DIFFICULTY_LABELS, DIFFICULTY_MODIFIERS, type Difficulty } from '../engine/types';
import type { PendingRoll } from './RollLine';

/** Chip du modificateur de Difficulté (« Accessible +20 ») quand il réconcilie le total — partagé
 *  par la ligne jetée (`testBreakdown`) ET le pré-jet (`testPending`), pas de copie. */
function difficultyMods(difficulty?: Difficulty): ModLine[] | undefined {
  return difficulty && DIFFICULTY_MODIFIERS[difficulty] !== 0
    // « Accessible » sans le suffixe « (+20) » du label canonique : la RollLine affiche déjà la valeur.
    ? [{ label: DIFFICULTY_LABELS[difficulty].replace(/\s*\(.*\)$/, ''), value: DIFFICULTY_MODIFIERS[difficulty] }]
    : undefined;
}

/**
 * Ligne de jet (RollLine) d'un Test simple : base + modificateurs = cible · d100 · DR — la même
 * présentation que l'Attaque/Défense, pour TOUS les flux de jet (fin du verdict legacy `.test-result`).
 * `target` peut manquer (résultat synthétique d'une Résilience pré-jet) → on retombe sur la base.
 * `difficulty` (optionnelle) étiquette le modificateur (« Accessible +20 ») quand il réconcilie le total.
 */
export function testBreakdown(
  label: string,
  base: number,
  r: { roll: number; target?: number; sl?: number; success?: boolean },
  difficulty?: Difficulty,
): RollBreakdown {
  const target = r.target ?? base;
  return {
    label,
    base,
    modifier: target - base,
    mods: difficultyMods(difficulty),
    target,
    roll: r.roll,
    success: r.success ?? r.roll <= target,
    sl: r.sl ?? 0,
  };
}

/** Ligne de jet EN ATTENTE (pré-jet) d'un Test simple — même base / cible / mods que `testBreakdown`,
 *  dé et DR vides : pour le panneau PRÉ-REMPLI des flux `RollFlowShell` (parité Attaque/Défense).
 *  `target` omis → dérivé `base + modificateur de Difficulté` (comme le calcule le jet). */
export function testPending(label: string, base: number, target?: number, difficulty?: Difficulty): PendingRoll {
  const t = target ?? base + (difficulty ? DIFFICULTY_MODIFIERS[difficulty] : 0);
  return { label, base, target: t, mods: difficultyMods(difficulty) };
}

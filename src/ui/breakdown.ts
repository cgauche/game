import type { RollBreakdown } from '../engine/combat';
import { DIFFICULTY_LABELS, DIFFICULTY_MODIFIERS, type Difficulty } from '../engine/types';

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
  const mods = difficulty && DIFFICULTY_MODIFIERS[difficulty] !== 0
    // « Accessible » sans le suffixe « (+20) » du label canonique : la RollLine affiche déjà la valeur.
    ? [{ label: DIFFICULTY_LABELS[difficulty].replace(/\s*\(.*\)$/, ''), value: DIFFICULTY_MODIFIERS[difficulty] }]
    : undefined;
  return {
    label,
    base,
    modifier: target - base,
    mods,
    target,
    roll: r.roll,
    success: r.success ?? r.roll <= target,
    sl: r.sl ?? 0,
  };
}

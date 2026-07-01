/**
 * Ciblage au SURVOL — source unique du tooltip + réticule + ligne de visée du joueur (IsoStage).
 * Rejoue les MÊMES prédicats que le clic (via le REGISTRE DE MODES `targetingModes.ts`) pour que
 * l'affordance ne mente jamais : réticule présent = le clic aboutira, ⛔ = il sera refusé (et pourquoi).
 * Pur (lit l'état). `hoverTargeting`/`validTargets` ne sont plus que des entrées qui délèguent au mode
 * courant ; les corps d'affordance/candidats vivent dans `targetingModes.ts` (source unique).
 */
import { Combatant } from '../engine/types';
import { isOutOfAction } from '../engine/conditions';
import { combatDistance } from './footprint';
import type { GameState } from './store';
import { currentTargetingMode, type HoverTargeting } from './targetingModes';

// Réexports de compatibilité : le TYPE d'affordance et la dérivation du côté visé d'un sort vivent
// désormais dans le registre de modes ; les importeurs historiques (IsoStage, tests) restent valides.
export type { HoverTargeting, SpellAffinity } from './targetingModes';
export { spellAffinity } from './targetingModes';

/**
 * Évalue le survol de `target` par le héros `active` selon le MODE de ciblage courant
 * (`currentTargetingMode`) : attaque implicite, incantation, soin, surincantation, bordée… Retourne
 * `none` quand le survol n'a pas de sens (mauvaise équipe, hors mode, hors combat, mode-CASE pur).
 */
export function hoverTargeting(get: () => GameState, active: Combatant, target: Combatant): HoverTargeting {
  const battle = get().battle;
  if (!battle || battle.over || !active.pos || !target.pos) return { kind: 'none' };
  // Un engin de siège INERTE (immune, RAW AA p.122-123) n'est JAMAIS une cible d'attaque/sort/soin : pas de
  // réticule — on vise son équipage (combattants ordinaires), pas la pièce. (Structures/véhicules NE sont pas `inert`.)
  if (target.inert) return { kind: 'none' };
  return currentTargetingMode(get).affordance?.(get, active, target) ?? { kind: 'none' };
}

/** Combattants que le héros ACTIF peut cibler au survol selon le mode courant — `candidates` du mode
 *  s'il en fournit (soin/surincantation/cleave/dual), sinon ceux dont l'affordance ≠ 'none' — triés du
 *  PLUS PROCHE au plus loin. Base du ciblage clavier (Tab). */
export function validTargets(get: () => GameState): Combatant[] {
  const battle = get().battle;
  if (!battle || battle.over) return [];
  const active = battle.combatants.find((c) => c.id === battle.order[battle.turn]);
  if (!active || active.kind !== 'hero' || !active.pos) return [];
  const mode = currentTargetingMode(get);
  const cands = mode.candidates
    ? mode.candidates(get, active)
    : battle.combatants.filter((c) => c.id !== active.id && c.pos && !isOutOfAction(c) && hoverTargeting(get, active, c).kind !== 'none');
  return [...cands].sort((a, b) => combatDistance(active, a) - combatDistance(active, b));
}

/** Cible SUIVANTE (Tab) : la plus proche valide, ou la suivante par distance si une est déjà visée —
 *  cycle complet sur toutes les cibles valides puis retour à la première. Null si aucune. */
export function cycleTarget(get: () => GameState, currentId: string | null): Combatant | null {
  const sorted = validTargets(get);
  if (!sorted.length) return null;
  const idx = sorted.findIndex((c) => c.id === currentId);
  return sorted[(idx + 1) % sorted.length];
}

/** Cible PRÉCÉDENTE (Maj+Tab / gâchette gauche) : symétrique de `cycleTarget`, sens inverse. Null si aucune. */
export function cyclePrevTarget(get: () => GameState, currentId: string | null): Combatant | null {
  const sorted = validTargets(get);
  if (!sorted.length) return null;
  const idx = sorted.findIndex((c) => c.id === currentId);
  // idx === -1 (aucune cible courante) → -1-1 = -2 ; +len ramène à l'avant-dernier. On veut la DERNIÈRE
  // quand rien n'est visé → on part de 0 dans ce cas pour que (0-1+len)%len = dernière.
  const from = idx < 0 ? 0 : idx;
  return sorted[(from - 1 + sorted.length) % sorted.length];
}

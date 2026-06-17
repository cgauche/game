/**
 * Pertinence d'attaque — scoreur PARTAGÉ joueur (clic droit = meilleure attaque) + IA (choix de l'attaque
 * principale). Combine le POIDS ÉDITABLE par manœuvre (`AttackOption.priority`, depuis `ManeuverDef.priority`,
 * défaut 1) avec des bonus situationnels AUTO : dégâts attendus en mêlée (via `previewAttack`, depuis la case
 * d'ARRIVÉE après approche), nombre de cibles groupées pour la zone. Pur (lit l'état). Aucune heuristique
 * « quelle manœuvre » en dur : un nouveau souffle/regard hérite du scoreur dès qu'il porte un `priority`.
 */
import { Combatant } from '../engine/types';
import { isOutOfAction } from '../engine/conditions';
import { chebyshev } from './path';
import type { GameState, BattleState } from './store';
import { attackPlan, previewAttack, availableAttacks, type AttackOption } from './combatFlow';

/** Score de pertinence d'une `AttackOption` contre `target` (plus haut = plus pertinent ; -∞ = injouable :
 *  hors de portée même après approche). `priority ≤ 0` = jamais auto-choisie (reste manuelle). */
export function scoreAttack(get: () => GameState, active: Combatant, option: AttackOption, target: Combatant, battle: BattleState | null = get().battle): number {
  const priority = option.priority ?? 1;
  if (priority <= 0 || !battle || !active.pos || !target.pos) return -Infinity;
  // ZONE (Souffle/Vomi/Hurlement…) : base + bonus par ennemi SUPPLÉMENTAIRE groupé autour du point d'impact
  // (le gros intérêt d'une zone = frapper un paquet) — détection auto, pondérée par le `priority` éditable.
  if (option.targeting === 'zone') {
    const near = battle.combatants.filter((c) => c.kind !== active.kind && !isOutOfAction(c) && c.pos && chebyshev(c.pos, target.pos!) <= 2).length;
    return priority * (5 + Math.max(0, near - 1) * 6);
  }
  if (option.targeting === 'trample') return priority * 6;
  // MÊLÉE (Arme + gratuites) : dégâts attendus depuis la case d'arrivée (l'approche est prise en compte) ;
  // injouable si l'approche est bloquée (pas de chemin / hors de portée de tir).
  const plan = attackPlan(get, active, target, { reach: option.reach, forceMelee: option.forceMelee });
  if (plan.kind === 'blocked') return -Infinity;
  const from = plan.kind === 'attack' ? active : { ...active, pos: plan.dest };
  return priority * Math.max(1, previewAttack(get, from, target).dmg ?? 4);
}

/** L'attaque ABORDABLE la plus pertinente d'`active` contre `target` — source du clic droit joueur ET de la
 *  décision d'attaque principale de l'IA. `undefined` si aucune attaque jouable. */
export function bestAttack(get: () => GameState, active: Combatant, battle: BattleState, target: Combatant): AttackOption | undefined {
  let best: AttackOption | undefined;
  let bestScore = -Infinity;
  for (const o of availableAttacks(active, battle)) {
    const s = scoreAttack(get, active, o, target, battle);
    if (s > bestScore) { bestScore = s; best = o; }
  }
  return best;
}

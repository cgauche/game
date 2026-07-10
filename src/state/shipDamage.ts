/**
 * Foyer COQUE — vocabulaire UNIQUE des Dégâts/soins de coque (T2C ch.5, MDG ch.13-15) : les Dégâts de
 * coque RAW sont des valeurs FINALES (bélier, échouage, collision, réparation temporaire) — jamais
 * mitigées par BE/PA, `ignoreTB`/`ignoreAP` du GameOp `wounds` (LDB 18) l'expriment directement.
 *
 * DEUX formes de coque coexistent (#296, PAS résolu ici — chaque site continue d'écrire la MÊME copie
 * qu'avant) :
 *  - le Combattant-coque (`travelPlan.vehicle`, `vehicleCombatant`) : route par `applyOps` (langue
 *    UNIQUE des effets — journal + effets déclenchés compris) ;
 *  - la copie BARE `CampaignVessel.wounds` (`state.vessel`, `{current,max}` sans Combattant) : MÊME
 *    formule de clamp (soustraction/plafond), sans passer par `applyOps` (pas un Combattant complet).
 */
import type { Combatant } from '../engine/types';
import { applyOps } from '../engine/ops';

/** Copie BARE de coque (`CampaignVessel.wounds`, #296) — pas un Combattant. */
export interface HullWounds { current: number; max: number }

function isCombatant(h: Combatant | HullWounds): h is Combatant {
  return 'id' in h;
}

/** Inflige `amount` Dégâts de coque (valeur finale, ignore BE+PA). Mute `hull` en place ; renvoie le
 *  journal `applyOps` pour un Combattant-coque, `undefined` pour la copie bare (`HullWounds`). */
export function damageHull(hull: Combatant, amount: number): string[];
export function damageHull(hull: HullWounds, amount: number): void;
export function damageHull(hull: Combatant | HullWounds, amount: number): string[] | void {
  if (amount <= 0) return isCombatant(hull) ? [] : undefined;
  if (isCombatant(hull)) return applyOps(hull, [{ op: 'wounds', amount, ignoreTB: true, ignoreAP: true }]);
  hull.current = Math.max(0, hull.current - amount);
}

/** Restaure `amount` Blessures de coque (plafonné au max). Mute `hull` en place ; renvoie le journal
 *  `applyOps` pour un Combattant-coque, `undefined` pour la copie bare (`HullWounds`). */
export function healHull(hull: Combatant, amount: number): string[];
export function healHull(hull: HullWounds, amount: number): void;
export function healHull(hull: Combatant | HullWounds, amount: number): string[] | void {
  if (amount <= 0) return isCombatant(hull) ? [] : undefined;
  if (isCombatant(hull)) return applyOps(hull, [{ op: 'heal', amount }]);
  hull.current = Math.min(hull.max, hull.current + amount);
}

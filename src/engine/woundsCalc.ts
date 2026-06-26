/**
 * Résolveur de Blessures d'un COUP D'ARME — `woundsFromHit`. Module FEUILLE extrait de `combat.ts`
 * (pour être réutilisable SANS cycle par `ops.ts` : `op:'wounds'` en « mode coup d'arme » y délègue, et
 * `combat.ts` le ré-exporte pour ses importeurs). N'importe QUE des modules feuilles (characteristics,
 * combatFeatures, qualities, armourBypass) — aucune dépendance vers `ops`/`combat`. Comportement IDENTIQUE
 * à l'ancien `combat.woundsFromHit` (refacto pure).
 */
import type { Weapon, Combatant, HitLocation } from './types';
import { bonus, effectiveChar, effectiveArmourAt } from './characteristics';
import { bypassedAP } from './armourBypass';
import { qualitySum } from './qualities/dispatch';
import { talentDamageReduction } from './combatFeatures/dispatch';

/**
 * Blessures infligées par un coup : `totalDamage` (Dégâts d'arme + DR + qualités) moins le Bonus
 * d'Endurance et les PA EFFECTIFS à la `location` (armure portée/naturelle + `extraAP` − Perforante,
 * puis ignorance de PA de l'arme `weapon.bypass`). `minWounds` = plancher (1 pour un PERSONNAGE — garantit
 * Robuste LDB 10 ; 0 pour un NAVIRE, MDG ch.13 l.605 : un coup trop faible peut ricocher sur la coque).
 */
export function woundsFromHit(weapon: Weapon, target: Combatant, location: HitLocation, totalDamage: number, extraAP = 0, minWounds = 1): number {
  // Robuste (LDB 10) : « Vous réduisez tous les Dégâts subis de 1 par niveau […] toujours un minimum de 1 Blessure ».
  totalDamage -= talentDamageReduction(target);
  const tb = bonus(effectiveChar(target, 'E'));
  // PA effectifs = armure portée/naturelle + PA temporisés de sort + PA conférés par l'arme d'opposition
  // (`extraAP`), Perforante déduite.
  const baseAP = Math.max(0, effectiveArmourAt(target, location) + extraAP - qualitySum(weapon, 'armourReduction'));
  // Ignorance de PA de l'arme (Épée de justice → 'all', etc.) via le moteur GÉNÉRAL (engine/armourBypass).
  const ap = Math.max(0, baseAP - bypassedAP(target, location, weapon.bypass, baseAP));
  return Math.max(minWounds, totalDamage - (tb + ap));
}

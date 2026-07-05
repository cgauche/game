/**
 * Résolveur de Blessures d'un COUP D'ARME — `woundsFromHit`. Module FEUILLE extrait de `combat.ts`
 * (pour être réutilisable SANS cycle par `ops.ts` : `op:'wounds'` en « mode coup d'arme » y délègue, et
 * `combat.ts` le ré-exporte pour ses importeurs). N'importe QUE des modules feuilles (characteristics,
 * combatFeatures, qualities, armourBypass) — aucune dépendance vers `ops`/`combat`.
 */
import type { Weapon, Combatant, HitLocation } from './types';
import { bonus, effectiveChar, effectiveArmourAt } from './characteristics';
import { bypassedAP } from './armourBypass';
import { qualitySum } from './qualities/dispatch';
import { talentDamageReduction } from './combatFeatures/dispatch';
import { isStructure, structureImmune, siegeMultiplier } from './structures';

/**
 * Blessures infligées par un coup : `totalDamage` (Dégâts d'arme + DR + qualités) moins le Bonus
 * d'Endurance et les PA EFFECTIFS à la `location` (armure portée/naturelle + `extraAP` − Perforante,
 * puis ignorance de PA de l'arme `weapon.bypass`). `minWounds` = plancher (1 pour un PERSONNAGE — garantit
 * Robuste LDB 10 ; 0 pour un NAVIRE, MDG ch.13 l.605 : un coup trop faible peut ricocher sur la coque).
 *
 * STRUCTURE de siège (ADE II ch.08) : on greffe l'Atout Siège data-driven (cf. `engine/structures`). Une arme
 * IMPARABLE (Résistant/Impénétrable/Bélier hors-porte) inflige 0 ; sinon le TOTAL de Dégâts est doublé par
 * Siège AVANT le Bonus d'Endurance (RAW « le double des dégâts »), et le plancher passe à 0 (un coup trop
 * faible ne raye pas la structure — comme une coque). Sans PA, l'`effectiveArmour` d'une structure vaut 0.
 */
export function woundsFromHit(weapon: Weapon, target: Combatant, location: HitLocation | undefined, totalDamage: number, extraAP = 0, minWounds = 1): number {
  // Engin de siège INERTE (AA p.122-123) : le RAW ne lui donne aucune Blessure → NON-DESTRUCTIBLE (immune).
  // On le neutralise en tuant son équipage, jamais en le frappant. (≠ structure/véhicule, qui NE sont PAS `inert`.)
  if (target.inert) return 0;
  if (isStructure(target)) {
    if (structureImmune(weapon, target)) return 0;
    totalDamage *= siegeMultiplier(weapon, target);
    minWounds = 0;
  }
  // Robuste (LDB 10) : « Vous réduisez tous les Dégâts subis de 1 par niveau […] toujours un minimum de 1 Blessure ».
  totalDamage -= talentDamageReduction(target);
  const tb = bonus(effectiveChar(target, 'E'));
  // PA effectifs = armure portée/naturelle + PA temporisés de sort + PA conférés par l'arme d'opposition
  // (`extraAP`), Perforante déduite. `location` ABSENTE (STRUCTURE inanimée, ADE II ch.08 : pas de
  // Localisation) → aucune armure de pièce (une structure a 0 PA partout) : le terme d'armure vaut 0.
  const baseAP = Math.max(0, (location ? effectiveArmourAt(target, location) : 0) + extraAP - qualitySum(weapon, 'armourReduction'));
  // Ignorance de PA de l'arme (Épée de justice → 'all', etc.) via le moteur GÉNÉRAL (engine/armourBypass).
  const ap = Math.max(0, baseAP - (location ? bypassedAP(target, location, weapon.bypass, baseAP) : 0));
  return Math.max(minWounds, totalDamage - (tb + ap));
}

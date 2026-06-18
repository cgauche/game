/**
 * Mise en place d'un combat — MODULE FEUILLE (n'importe RIEN de combatFlow ; combatFlow le ré-exporte).
 * Extrait du corps de `store.startCombat` les points NOMMÉS surchargeables, pour ouvrir des coutures
 * d'extension (cf. refonte par hooks, plan transient-dancing-shamir.md) sans éditer le monolithe.
 */
import type { Combatant } from '../engine/types';
import type { RNG } from '../engine/dice';
import { baseWithTraits, bonus, effectiveChar } from '../engine/characteristics';
import { talentInitiativeBonus } from '../engine/combatFeatures/dispatch';
import { rule } from '../engine/policy';

/**
 * Initiative d'un combattant au début du combat — POINT NOMMÉ, seam de la règle optionnelle « méthode
 * d'Initiative » (`combat-init-method`, LDB 13 l.39). Combat instinctif (LDB 10 : +10 × niveau) toujours
 * ajouté via `talentInitiativeBonus`. Le `rng` est passé par l'appelant (un `rng.int(1,10)` par combattant
 * dans `roll-i`/`roll-bi`) → l'ordre de tirage est préservé par la boucle appelante.
 *  - `roll-i` (DÉFAUT, comportement RAW du jeu) : 1d10 + Initiative.
 *  - `fixed-i` : Initiative fixe, SANS dé (ordre stable d'un Round à l'autre ; ne consomme pas le RNG).
 *  - `roll-bi` : 1d10 + Bonus d'Initiative + Bonus d'Agilité.
 */
export function rollInitiative(c: Combatant, rng: RNG): number {
  const talent = talentInitiativeBonus(c);
  switch (rule('combat-init-method')) {
    case 'fixed-i':
      return baseWithTraits(c, 'I') + talent;
    case 'roll-bi':
      return rng.int(1, 10) + bonus(baseWithTraits(c, 'I')) + bonus(effectiveChar(c, 'Ag')) + talent;
    default: // 'roll-i'
      return baseWithTraits(c, 'I') + rng.int(1, 10) + talent;
  }
}

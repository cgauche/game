/**
 * Mise en place d'un combat — MODULE FEUILLE (n'importe RIEN de combatFlow ; combatFlow le ré-exporte).
 * Extrait du corps de `store.startCombat` les points NOMMÉS surchargeables, pour ouvrir des coutures
 * d'extension (cf. refonte par hooks, plan transient-dancing-shamir.md) sans éditer le monolithe.
 */
import type { Combatant } from '../engine/types';
import type { RNG } from '../engine/dice';
import { baseWithTraits } from '../engine/characteristics';
import { talentInitiativeBonus } from '../engine/combatFeatures/dispatch';

/**
 * Initiative d'un combattant au début du combat (LDB 13) : Initiative de base (profil + traits) + 1d10,
 * + Combat instinctif (LDB 10 : +10 × niveau, via `talentInitiativeBonus`). POINT NOMMÉ — seam de la
 * future règle optionnelle « méthode d'Initiative » (init-method). Le `rng` est passé par l'appelant
 * (un appel `rng.int(1,10)` par combattant) → l'ordre de tirage est préservé par la boucle appelante.
 */
export function rollInitiative(c: Combatant, rng: RNG): number {
  return baseWithTraits(c, 'I') + rng.int(1, 10) + talentInitiativeBonus(c);
}

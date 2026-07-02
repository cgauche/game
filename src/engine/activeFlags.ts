/**
 * Drapeaux booléens portés par un ActiveEffect (Jalon 2.6 L9) — sorts à effet
 * « par identité » qui n'altèrent pas une caractéristique mais ouvrent un droit :
 *  - `freeReroll` : « peut relancer le prochain Test auquel elle échoue » (Bénédiction
 *    de Chance, LDB 41) — consommé À L'USAGE au point de relance des flux de jet ;
 *  - `critRollTwice` : « effectuez deux lancers et choisissez le meilleur résultat »
 *    quand le porteur INFLIGE une Blessure Critique (Bénédiction de Sauvagerie, LDB 41) ;
 *  - `ignoreStatePenalties` : « ne subit aucune pénalité causée par les États »
 *    (Endurance de l'anachorète, LDB 42).
 * La durée de vie (rounds/horloge) est celle de l'ActiveEffect porteur (entretien existant).
 */
import type { Combatant } from './types';

export type ActiveFlag = 'freeReroll' | 'critRollTwice' | 'ignoreStatePenalties' | 'suffocates' | 'noBreath' | 'attackWardFM' | 'noHunger' | 'drunkIgnore';

/** Le combattant porte-t-il un effet actif avec ce drapeau ? */
export function hasActiveFlag(c: Combatant, flag: ActiveFlag): boolean {
  return (c.activeEffects ?? []).some((e) => e[flag]);
}

/** Consomme UNE instance du drapeau (retire l'effet porteur) ; retourne son label, ou null. */
export function consumeActiveFlag(c: Combatant, flag: ActiveFlag): string | null {
  const idx = (c.activeEffects ?? []).findIndex((e) => e[flag]);
  if (idx < 0) return null;
  const [removed] = c.activeEffects!.splice(idx, 1);
  return removed.label;
}

/** Relance gratuite disponible ? (Bénédiction de Chance) — null-safe, pour les modales. */
export function freeRerollOf(c?: Combatant | null): boolean {
  return !!c && hasActiveFlag(c, 'freeReroll');
}

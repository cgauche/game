/**
 * Source UNIQUE des visuels dérivés de l'ÉTAT d'un Combatant — mutations (Corruption,
 * LDB 19) + amputations/prothèses (LDB 18/73). Consommée par tous les chemins de rendu
 * (token combat/exploration, vue top, portrait HUD, cavalier) : un nouveau visuel d'état
 * se branche ICI, pas dans chaque site.
 */
import type { Combatant } from '../../../engine/types';
import type { RigOverlay } from '../bones';
import type { Appearance } from '../appearance';
import { mutationOverlaysFor, mutationAppearance } from './mutations';
import { injuryOverlaysFor } from './injuries';

/** Calques d'état (mutations physiques + amputations/prothèses portées). */
export function combatantOverlays(c: Combatant): RigOverlay[] {
  return [...mutationOverlaysFor(c.mutations), ...injuryOverlaysFor(c)];
}

/** Apparence modifiée par l'état (morpho/peau/visage des mutations). */
export function combatantAppearance(a: Appearance, c: Combatant): Appearance {
  return mutationAppearance(a, c.mutations);
}

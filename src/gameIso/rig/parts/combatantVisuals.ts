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
import { injuryOverlaysFor, injuryAppearance } from './injuries';
import { traitOverlaysFor } from './traitVisuals';

/** Calques d'état (mutations physiques + amputations/prothèses + traits de créature). */
export function combatantOverlays(c: Combatant): RigOverlay[] {
  return [...mutationOverlaysFor(c.mutations), ...injuryOverlaysFor(c), ...traitOverlaysFor(c)];
}

/** Apparence modifiée par l'état (morpho/peau/visage/yeux — mutations puis blessures). */
export function combatantAppearance(a: Appearance, c: Combatant): Appearance {
  return injuryAppearance(mutationAppearance(a, c.mutations), c);
}

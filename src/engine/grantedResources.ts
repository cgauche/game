/**
 * Ressources de héros ACCORDÉES temporairement par un Sort (Points de Chance / Destin —
 * ops `gainResource` / `gainResource`, LDB 47 « Les Signes d'Amul », « Maître du Destin »…).
 *
 * Le grant est immédiat (incrément de `c.fortune` / `c.fate`) ; les points NON dépensés sont
 * retirés à l'expiration de l'`ActiveEffect` porteur — fin de Round (`endOfRound`) OU échéance
 * d'horloge (cascade #T3). Même mécanique que `dropExpiredGrantedTraits` : un seul helper, appelé
 * aux deux sites d'expiration (aucune duplication).
 *
 * Approximation assumée : on retire `min(accordé, courant)` — si le héros a dépensé les points,
 * il n'en perd pas au-delà de ce qu'il lui reste ; la fongibilité Chance/Destin empêche de savoir
 * lesquels (originaux vs accordés) ont été consommés.
 */
import { Combatant } from './types';

/** Retire les Points de Chance/Destin accordés par les effets actifs EXPIRÉS, sans descendre sous 0. */
export function dropExpiredGrantedResources(
  c: Combatant,
  expired: { grantedFortune?: number; grantedFate?: number }[],
): void {
  for (const e of expired) {
    if (e.grantedFortune) c.fortune = Math.max(0, (c.fortune ?? 0) - e.grantedFortune);
    if (e.grantedFate) c.fate = Math.max(0, (c.fate ?? 0) - e.grantedFate);
  }
}

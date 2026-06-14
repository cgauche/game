/**
 * Armes INVOQUÉES (op `conjureWeapon` — Arme aethyrique LDB 47, Faux de Shyish / Épée ardente de
 * Rhuin LDB 48) : portées par un effet actif (`ActiveEffect.conjuredWeapon`), injectées en tête de
 * `c.weapons` par `recomputeLoadout`. Quand l'effet expire (fin de Round ou échéance d'horloge),
 * l'arme doit quitter `c.weapons` — on recompose le loadout. Même mécanique que
 * `dropExpiredGrantedTraits` / `dropExpiredGrantedResources` : un seul helper, appelé par
 * `endOfRound` (combat) ET `purgeClockEffects` (cascade #T3 hors combat). Pur ; mute `c`.
 */
import { Combatant } from './types';
import { recomputeLoadout } from './items';

/** Si l'un des effets expirés portait une arme invoquée, recompose le loadout pour la retirer de
 *  `c.weapons` (l'arme directrice redevient l'arme réellement équipée / les Mains nues). */
export function dropExpiredConjuredWeapons(c: Combatant, expired: { conjuredWeapon?: unknown }[]): void {
  if (expired.some((e) => e.conjuredWeapon)) recomputeLoadout(c);
}

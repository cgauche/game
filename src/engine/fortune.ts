import type { Combatant } from './types';

/**
 * Dépense d'un Point de Chance — Livre de base, « Destin et Résistance » (ch.17 l.22-28).
 * La RELANCE est réservée aux Tests qui se sont conclus par un ÉCHEC (l.24) et ne peut être
 * faite qu'UNE FOIS par Test (règle générale de relance, ch.12 l.56 : « une fois qu'une relance
 * a été effectuée […] il n'est plus possible de le relancer »). L'« échec » d'un Test est défini
 * par TON propre jet (d100 > cible, ch.12 l.29-31), indépendamment d'un éventuel Test opposé.
 */
export function canReroll(ownRollFailed: boolean, alreadyRerolled: boolean): boolean {
  return ownRollFailed && !alreadyRerolled;
}

/**
 * Restauration des Points de Chance d'un groupe (LDB 17 l.47 : « au début de chaque session de jeu,
 * vos Points de Chance sont remis au niveau de votre Destin actuel »). PUR : renvoie un nouveau
 * tableau (un héros doté d'un Destin voit sa Chance ramenée à `fate`, les autres restent inchangés).
 * SOURCE UNIQUE partagée par l'Effet de scène `restoreFortune` (combatEffects) ET l'action de store
 * `restoreFortuneNow()` (règle optionnelle « Longues Séances de Jeu », LDB 17 l.52).
 */
export function restoreFortune(party: Combatant[]): Combatant[] {
  return party.map((h) => (h.kind === 'hero' && h.fate != null ? { ...h, fortune: h.fate } : h));
}

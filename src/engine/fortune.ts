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
 * COUTURE UNIQUE de « début de séance de jeu » : restaure les Points de Chance (LDB 17 l.47 : « au
 * début de chaque session de jeu, vos Points de Chance sont remis au niveau de votre Destin actuel »)
 * ET remet à zéro les compteurs PAR-SÉANCE (Résistance (Menace), LDB 10 l.1015-1021 : « à chaque
 * séance de jeu » → `resistanceUsed`). PUR : renvoie un nouveau tableau (héros seulement ; un héros
 * sans Destin garde sa Chance mais voit tout de même ses compteurs de séance remis).
 * SOURCE UNIQUE partagée par l'Effet de scène `restoreFortune` (combatEffects) ET l'action de store
 * `restoreFortuneNow()` (règle optionnelle « Longues Séances de Jeu », LDB 17 l.52).
 */
export function restoreFortune(party: Combatant[]): Combatant[] {
  return party.map((h) => (h.kind === 'hero'
    ? { ...h, ...(h.fate != null ? { fortune: h.fate } : {}), resistanceUsed: undefined }
    : h));
}

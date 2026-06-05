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

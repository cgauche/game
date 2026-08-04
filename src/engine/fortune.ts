import type { Combatant } from './types';

/**
 * Relance d'un Test par un Point de Chance — LDB 17 l.23 ; unicité de la relance — LDB 12 l.40.
 * `ownRollFailed` se juge sur le jet PROPRE du personnage (LDB 12 l.13), jamais sur l'issue d'une
 * opposition.
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

/** Mort certaine évitée en brûlant 1 Point de Destin (LDB 17 l.29-39) : Destin −1 et la cible
 *  survit à 1 Blessure minimum (true) ; sans Destin, elle meurt (`dead`, false). La prose du
 *  dénouement reste au call-site (contexte : hémorragie, op kill, tick de maladie). */
export function fateSaveOrDie(c: Combatant): boolean {
  if ((c.fate ?? 0) > 0) {
    c.fate = (c.fate ?? 0) - 1;
    c.wounds.current = Math.max(1, c.wounds.current);
    return true;
  }
  c.dead = true;
  return false;
}

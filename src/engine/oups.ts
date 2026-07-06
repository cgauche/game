/**
 * Maladresses — Livre de base, « Maladresses » (14-_GoBack.md l.53-57). Une Maladresse = Test de
 * combat ÉCHOUÉ dont le d100 est un double (miroir du Critique = double réussi). Déclenche le
 * Tableau des Oups !, ou un Incident de Tir (arme à Poudre noire + jet pair → explosion, l.56-57).
 */
import { d100, RNG, defaultRNG } from './dice';
import { findTableEntry } from './tables';
import { isDoubleRoll } from './tests';
import { Weapon } from './types';
import { OUPS_TABLE, OupsKind } from '../data/oups';
import { isFirearmQuality } from './qualities/dispatch';

export interface OupsResolved {
  roll: number;
  kind: OupsKind | 'misfire';
  label: string;
}

/** Une Maladresse = jet d100 raté ET (double (11,22,…,99,00), OU — Doigts amputés, LDB 18 l.251 — chiffre
 *  des unités du jet ∈ [1..fingersLost] si le Test implique une main où `fingersLost` doigts ont été
 *  perdus). `fingersLost` omis/0 = comportement d'origine (LDB 14 l.53). */
export function isFumble(roll: number, success: boolean, fingersLost = 0): boolean {
  if (success) return false;
  if (isDoubleRoll(roll)) return true;
  if (fingersLost <= 0) return false;
  const unit = roll % 10;
  return unit >= 1 && unit <= fingersLost;
}

/** Arme à Poudre noire / explosive (Incident de Tir, l.56-57). On détecte la famille « Poudre noire ». */
function isFirearm(w: Weapon | undefined): boolean {
  if (!w) return false;
  return /poudre|explos/i.test(w.subType ?? '') || isFirearmQuality(w);
}

/** Tire sur le Tableau des Oups ! ; Incident de Tir prioritaire (arme à poudre + jet PAIR). */
export function rollOups(weapon: Weapon | undefined, rng: RNG = defaultRNG): OupsResolved {
  const roll = d100(rng);
  if (isFirearm(weapon) && roll % 2 === 0) {
    return { roll, kind: 'misfire', label: 'Incident de Tir ! L’arme explose dans votre main (Dégâts au Bras principal, arme détruite).' };
  }
  const entry = findTableEntry(OUPS_TABLE, roll);
  return { roll, kind: entry.kind, label: entry.label };
}

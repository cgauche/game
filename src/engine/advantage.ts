import type { Combatant } from './types';
import { rule } from './policy';
import { bonus, effectiveChar } from './characteristics';

/** Plafond d'Avantage FIXE — règle optionnelle « Limiter les Avantages » (LDB 14 l.198 :
 *  « 10 fonctionne plutôt bien puisque vous pouvez facilement les comptabiliser avec 1d10 »).
 *  Registre `combat-advantage-cap`. */
export function advantageCap(): number {
  return rule('combat-advantage-cap') as number;
}

/** Plafond d'Avantage EFFECTIF d'un combattant — SOURCE UNIQUE (gain + affichage). Par défaut le
 *  plafond fixe ; si « Plafond = Bonus d'Initiative » est actif (LDB 14 l.197), le Bonus
 *  d'Initiative du combattant prime (plafond par combattant). */
export function advantageCapFor(c: Combatant): number {
  return rule('combat-advantage-cap-bi') ? bonus(effectiveChar(c, 'I')) : advantageCap();
}

/** Gain d'Avantage CENTRALISÉ (héros ET ennemis) : clamp au plafond effectif du combattant. Les
 *  pertes et remises à zéro restent des affectations directes (LDB 15 l.40, 16 l.15…). Pure. */
export function gainAdvantage(c: Combatant, n = 1): void {
  if (n > 0) c.advantage = Math.min(advantageCapFor(c), c.advantage + n);
}

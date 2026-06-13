import type { Combatant } from './types';
import { rule } from './policy';

/** Plafond d'Avantage — règle optionnelle « Limiter les Avantages » (LDB 15-Dépl l.17 :
 *  « 10 fonctionne plutôt bien puisque vous pouvez facilement les comptabiliser avec 1d10 »).
 *  SOURCE UNIQUE (registre `combat-advantage-cap`) : changer la valeur en jeu suffit. */
export function advantageCap(): number {
  return rule('combat-advantage-cap') as number;
}

/** Gain d'Avantage CENTRALISÉ (héros ET ennemis) : clamp au plafond. Les pertes et remises
 *  à zéro restent des affectations directes (LDB 15 l.40, 16 l.15…). Pure. */
export function gainAdvantage(c: Combatant, n = 1): void {
  if (n > 0) c.advantage = Math.min(advantageCap(), c.advantage + n);
}

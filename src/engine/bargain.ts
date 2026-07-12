/**
 * Marchandage RAW (LDB 60 « Marchandage » l.12) : gagner un Test opposé réduit le prix de 10 %,
 * jusqu'à 20 % avec un Succès Stupéfiant (DR net ≥ 6) ou le talent Négociateur. Vente (l.22) :
 * base = ½ du prix listé, on obtient ¼ à ½ après Marchandage.
 *
 * Homonyme `bargainPct` (`state/portFlow.ts`, MDG 15 l.335/385) : NON convergent, VOLONTAIREMENT —
 * source RAW distincte (négoce de cargaison, pas l'achat/vente d'objet du commerce courant), #351.
 */
import { SL_ASTOUNDING } from './tests';

/** Facteur appliqué au prix d'ACHAT : perdu = 1 (plein), gagné = 0.9, gagné fort (DR≥6 ou Négociateur) = 0.8. */
export function bargainBuyFactor(won: boolean, drNet: number, negotiator: boolean): number {
  if (!won) return 1;
  return drNet >= SL_ASTOUNDING || negotiator ? 0.8 : 0.9; // DR net Stupéfiant (LDB 12 l.107)
}

/** Facteur appliqué à la base de VENTE (½ du listé) : gagné = 1 (½ plein), perdu = 0.5 (→ ¼). */
export function bargainSellFactor(won: boolean, _drNet: number, _negotiator: boolean): number {
  return won ? 1 : 0.5;
}

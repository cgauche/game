/**
 * COGUE (MDG, ~25 m, voile) — kogge hanséatique : coque HAUTE et ventrue à clins, château arrière
 * crénelé, petit gaillard d'avant, UN mât central à grande voile carrée avec hune, safran d'étambot.
 */
import type { ShipArtDef } from '../artkit';
import { castle, flag, hune, pennant, rudder, spar, squareSail, stay } from '../artkit';

function profile(): string {
  return '<g>'
    + rudder(-31, -20)
    // Gréement : mât unique puissant, hune, grande voile carrée à ris.
    + spar(0, -14, 0, -88, 3)
    + squareSail(0, -78, 46, 19, { seams: 2, reefs: 2 })
    + hune(0, -84)
    + stay(0, -88, 30, -28) + stay(0, -88, -29, -37) + stay(0, -78, 26, -24)
    + pennant(0, -88, 10)
    // Coque haute et ronde : tonture creusée, étraves droites et hautes.
    + '<path d="M-31 -26 Q-16 -14.5 0 -14 Q16 -14.5 31 -27 L27 -1.5 Q0 3 -26 -1.5 Z" fill="@coque" stroke="@coqueO" stroke-width="1.5"/>'
    + '<path d="M-31 -26 Q-16 -14.5 0 -14 Q16 -14.5 31 -27" fill="none" stroke="@coqueH" stroke-width="1.4"/>'
    // Bordé à clins (virures suivant la tonture).
    + '<path d="M-29.5 -20 Q0 -9.5 29.5 -21 M-28 -14 Q0 -5 28 -15 M-27 -8 Q0 -1 27 -9" fill="none" stroke="@coqueO" stroke-width="0.8" opacity="0.5"/>'
    // Château ARRIÈRE crénelé sur jambettes + gaillard d'avant plus modeste.
    + castle(-31, -13, -38, -25, 4)
    + '<path d="M-27 -25 l0 -1.8 M-19 -25 l0 -1.8" stroke="@coqueO" stroke-width="1.1"/>'
    + castle(18, 31, -34, -26, 3)
    + flag(-30, -38, 7, 4.5)
    + '</g>';
}

export const hullArt: ShipArtDef = { id: 'cogue', profile };

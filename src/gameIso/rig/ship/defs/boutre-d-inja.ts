/**
 * BOUTRE D'INJA (MDG, ~25 m, voile) — dhow des mers du Sud : UNE immense voile latine sur mât
 * en quête avant, étrave très élancée, tonture remontant en haute plage arrière, barre franche.
 */
import type { ShipArtDef } from '../artkit';
import { lateenSail, pennant, rudder, spar, stay } from '../artkit';

function profile(): string {
  return '<g>'
    + rudder(-30, -14)
    // Mât unique incliné vers l'avant + immense antenne latine (pointe haute sur l'avant).
    + spar(0, -7, 9, -64, 2.4)
    + lateenSail([32, -72], [-24, -26], [14, -9], [5, 7])
    + stay(9, -64, -28, -16)
    + pennant(30, -70, 9)
    // Coque : bouchain doux, étrave RAKÉE très élancée, arrière haut (plage de poupe).
    + '<path d="M-30 -19 Q-24 -9 -8 -7.4 Q8 -6.4 20 -8 L34 -13.5 L26 -1.2 Q0 2 -26 -1.2 Z" fill="@coque" stroke="@coqueO" stroke-width="1.4"/>'
    + '<path d="M-30 -19 Q-24 -9 -8 -7.4 Q8 -6.4 20 -8 L34 -13.5" fill="none" stroke="@coqueH" stroke-width="1.2"/>'
    + '<path d="M-26.5 -11 Q0 -2.8 27 -8.6" fill="none" stroke="@coqueO" stroke-width="0.7" opacity="0.55"/>'
    // Plage arrière haute (petit pont surélevé) + barre franche.
    + '<path d="M-30 -19 L-19 -19 L-19 -14.5 L-30 -14.5 Z" fill="@coque" stroke="@coqueO" stroke-width="1"/>'
    + spar(-27, -19, -21, -24, 1.4)
    + '</g>';
}

export const hullArt: ShipArtDef = { id: 'boutre-d-inja', profile };

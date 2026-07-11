/**
 * CORACLE (LDB 306, ~3 m) — coquille ronde minuscule en cuir tendu sur cadre d'osier, une seule rame.
 * La plus petite silhouette de la toise navale.
 */
import type { ShipArtDef } from '../artkit';
import { spar } from '../artkit';

function profile(): string {
  return '<g>'
    // Coquille demi-œuf (cuir tendu), bord roulé en haut.
    + '<path d="M-9 -9 Q-11 -2 -4 -0.6 Q0 0.2 4 -0.6 Q11 -2 9 -9 Q0 -12 -9 -9 Z" fill="@coque" stroke="@coqueO" stroke-width="1.3"/>'
    + '<path d="M-9 -9 Q0 -12 9 -9" fill="none" stroke="@coqueH" stroke-width="1.6"/>'
    // Membrures d'osier apparentes (arcs du cadre sous le cuir).
    + '<path d="M-7 -6 Q0 -8.5 7 -6 M-5.5 -3 Q0 -5 5.5 -3" fill="none" stroke="@coqueO" stroke-width="0.7" opacity="0.55"/>'
    // L'unique rame, posée en travers du bord.
    + spar(3, -14, 9, 0, 1.4)
    + '<path d="M9 0 q2.6 1 1.8 4.4 q-2.8 -0.2 -3.6 -2.8 Z" fill="@mat"/>'
    + '</g>';
}

export const hullArt: ShipArtDef = { id: 'coracle', profile };

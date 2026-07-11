/**
 * ESQUIF (LDB 306, ~15 m, gréement mixte) — la plus grande des embarcations ouvertes : un petit mât
 * au tiers avec voile carrée modeste, deux avirons en renfort.
 */
import type { ShipArtDef } from '../artkit';
import { oarBank, pennant, spar, squareSail, stay } from '../artkit';

function profile(): string {
  return '<g>'
    + oarBank(-14, -4, 2, -6, 5)
    // Gréement : petit mât + voile carrée basse.
    + spar(4, -5, 4, -46, 2)
    + squareSail(4, -42, 24, 10, { seams: 1 })
    + stay(4, -46, 22, -8) + stay(4, -46, -20, -8)
    + pennant(4, -46, 7)
    // Coque ouverte longue et fine, étrave élancée.
    + '<path d="M-24 -10 L-21 -1.2 Q0 2.6 16 -1 L25 -11 Q11 -6.6 0 -6.4 Q-12 -6.4 -24 -10 Z" fill="@coque" stroke="@coqueO" stroke-width="1.3"/>'
    + '<path d="M-24 -10 Q-12 -6.4 0 -6.4 Q11 -6.6 25 -11" fill="none" stroke="@coqueH" stroke-width="1.2"/>'
    + '<path d="M-20 -4 Q0 -0.8 18 -4.4" fill="none" stroke="@coqueO" stroke-width="0.7" opacity="0.5"/>'
    + '<path d="M-10 -6.4 l0 -2 M12 -6.6 l0 -2" stroke="@matO" stroke-width="1.3"/>'
    + '</g>';
}

export const hullArt: ShipArtDef = { id: 'esquif', profile };

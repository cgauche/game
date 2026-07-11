/**
 * LANGSKIP (MDG, ~25 m, mixte) — navire LONG norse : coque très basse, tête de dragon en proue,
 * queue en volute, rangée de pavois sur le plat-bord, long rang d'avirons, grande voile carrée
 * à laizes. Réf : planche MDG p.098 (au centre).
 */
import type { ShipArtDef } from '../artkit';
import { oarBank, pennant, shieldRow, spar, squareSail, stay } from '../artkit';

function profile(): string {
  return '<g>'
    + oarBank(-30, 26, 8, -5, 6)
    // Gréement : mât central, grande voile carrée à laizes verticales.
    + spar(0, -6, 0, -80, 2.6)
    + squareSail(0, -76, 44, 20, { seams: 0 })
    + '<path d="M-12 -74 Q-8 -52 -11 -33 M-1 -74.6 Q3 -52 0 -32.6 M10 -75 Q14 -52 11 -32.6" stroke="@pavillon" stroke-width="2.6" opacity="0.6" fill="none"/>'
    + stay(0, -80, 36, -21) + stay(0, -80, -37, -19)
    + pennant(0, -80, 10)
    // Coque-croissant très basse et longue.
    + '<path d="M-40 -18 Q-30 -6.5 -15 -4.6 Q0 -4 15 -4.6 Q30 -6.5 38 -20 Q28 -11 15 -9.4 Q0 -8.8 -15 -9.4 Q-30 -11 -40 -18 Z" fill="@coque" stroke="@coqueO" stroke-width="1.3"/>'
    + '<path d="M-40 -18 Q-30 -11 -15 -9.4 Q0 -8.8 15 -9.4 Q28 -11 38 -20" fill="none" stroke="@coqueH" stroke-width="1"/>'
    // Queue en volute (poupe) et TÊTE DE DRAGON (proue).
    + '<path d="M-40 -18 q-3 -4 -1 -7 q1.6 -2.4 4.4 -1.6" fill="none" stroke="@coque" stroke-width="2.6" stroke-linecap="round"/>'
    + '<path d="M38 -20 Q42 -24 42 -30 Q42 -35 47 -35 L45 -31.4 Q45.4 -26 41.6 -22.6" fill="@coque" stroke="@coqueO" stroke-width="1.1"/>'
    + '<path d="M42 -33 l5.4 -1 l-3.4 3.2 Z" fill="@coque" stroke="@coqueO" stroke-width="0.9"/>' // gueule
    + '<circle cx="43" cy="-32" r="0.9" fill="@pavillon"/>' // œil
    // Pavois : boucliers ronds alternés le long du bord.
    + shieldRow(-30, 30, 9, -7, 2.6)
    + '</g>';
}

export const hullArt: ShipArtDef = { id: 'langskip', profile };

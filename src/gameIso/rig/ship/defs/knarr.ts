/**
 * KNARR (MDG, ~15 m, mixte) — drakkar MARCHAND : coque basse et ventrue, étraves relevées en
 * volutes, un mât central à voile carrée frappée d'une croix, fret amarré au milieu.
 * Réf : planche MDG p.098 (en tête).
 */
import type { ShipArtDef } from '../artkit';
import { oarBank, pennant, spar, squareSail, stay } from '../artkit';

function profile(): string {
  return '<g>'
    + oarBank(-18, -10, 2, -6.5, 5)
    // Gréement : mât central, voile carrée à croix, étais jusqu'aux étraves.
    + spar(0, -5, 0, -58, 2.4)
    + squareSail(0, -54, 30, 13, { seams: 1 })
    + '<path d="M0 -50 l0 22 M-8.5 -40 l17 0" stroke="@pavillon" stroke-width="3" opacity="0.85" stroke-linecap="round"/>'
    + stay(0, -58, 23, -15) + stay(0, -58, -23, -15)
    + pennant(0, -58, 8)
    // Coque en croissant bas, bordé à clins, étraves montantes.
    + '<path d="M-24 -16 Q-20 -5 -10 -3.2 Q0 -2.4 10 -3.2 Q20 -5 24 -17 Q19 -10 9 -8 Q0 -7.4 -9 -8 Q-19 -10 -24 -16 Z" fill="@coque" stroke="@coqueO" stroke-width="1.3"/>'
    + '<path d="M-24 -16 Q-19 -10 -9 -8 Q0 -7.4 9 -8 Q19 -10 24 -17" fill="none" stroke="@coqueH" stroke-width="1.1"/>'
    + '<path d="M-21 -11 Q0 -5 21 -11.5" fill="none" stroke="@coqueO" stroke-width="0.7" opacity="0.55"/>'
    // Volutes des étraves.
    + '<circle cx="-24" cy="-17.5" r="1.7" fill="none" stroke="@coqueH" stroke-width="1.2"/>'
    + '<circle cx="24" cy="-18.5" r="1.7" fill="none" stroke="@coqueH" stroke-width="1.2"/>'
    // Fret amarré au milieu (tonneaux sous bâche).
    + '<path d="M-7 -7.6 q1 -3.6 5 -3.6 q4 0 5 3.4 Z" fill="@voileO" stroke="@matO" stroke-width="0.8"/>'
    + '</g>';
}

export const hullArt: ShipArtDef = { id: 'knarr', profile };

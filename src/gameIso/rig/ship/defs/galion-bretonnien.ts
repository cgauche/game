/**
 * GALION BRETONNIEN (MDG, ~60 m, voile) — vaisseau d'apparat : château arrière MASSIF à trois
 * étages ornés de volutes dorées, quatre mâts, éperon-guibre sculpté, sabords, emblème
 * (trèfle-de-lys) sur la grand-voile.
 */
import type { ShipArtDef } from '../artkit';
import { castle, flag, gunports, hune, lateenSail, pennant, rudder, spar, squareSail, stay } from '../artkit';

/** Emblème bretonnien stylisé (trèfle-de-lys @pavillon) posé sur la toile. */
const lys = (x: number, y: number): string =>
  `<g fill="@pavillon" opacity="0.85"><circle cx="${x}" cy="${y - 3}" r="2.2"/><circle cx="${x - 2.6}" cy="${y}" r="2"/><circle cx="${x + 2.6}" cy="${y}" r="2"/><path d="M${x - 1.4} ${y + 1} h2.8 l0.8 5 h-4.4 Z"/></g>`;

function profile(): string {
  return '<g>'
    + rudder(-54, -22)
    // Quatre mâts : contre-artimon latin, artimon latin, grand mât (2 étages + emblème), misaine ; beaupré à civadière.
    + spar(-44, -32, -44, -64, 2)
    + lateenSail([-36, -60], [-54, -38], [-39, -31], [2, 4])
    + spar(-24, -26, -24, -84, 2.2)
    + lateenSail([-14, -80], [-40, -44], [-18, -27], [3, 5])
    + spar(2, -18, 2, -110, 2.8)
    + squareSail(2, -70, 40, 18, { seams: 2 }) + lys(6, -52) + squareSail(2, -102, 28, 12, { seams: 1 }) + hune(2, -76)
    + spar(30, -22, 30, -80, 2.2)
    + squareSail(30, -74, 28, 11, { seams: 1 })
    + spar(44, -24, 57, -35, 2)
    + squareSail(51, -33, 12, 5)
    + stay(2, -110, 30, -24) + stay(2, -110, -24, -28) + stay(30, -80, 55, -34) + stay(-24, -84, -52, -34)
    + pennant(2, -110, 12) + pennant(30, -80, 9)
    // Coque haute, guibre en éperon sculpté, deux préceintes dorées, sabords.
    + '<path d="M-54 -28 Q-28 -16.5 0 -15.4 Q26 -16.5 46 -24 L42 -2 Q0 3.4 -48 -2 Z" fill="@coque" stroke="@coqueO" stroke-width="1.5"/>'
    + '<path d="M-54 -28 Q-28 -16.5 0 -15.4 Q26 -16.5 46 -24" fill="none" stroke="@coqueH" stroke-width="1.3"/>'
    + '<path d="M-52 -19 Q0 -9.5 45 -18 M-50 -11 Q0 -3.6 43 -10.5" fill="none" stroke="@coqueH" stroke-width="1.3" opacity="0.9"/>'
    + gunports(-40, 34, 7, -13, 3)
    // GUIBRE (éperon d'étrave sculpté, volute).
    + '<path d="M46 -24 Q54 -22 57 -15 Q53 -16.5 49 -19.5" fill="@coque" stroke="@coqueO" stroke-width="1.1"/>'
    + '<path d="M55 -16.5 q3 -1.6 2.6 -4.6" fill="none" stroke="@coqueH" stroke-width="1.2"/>'
    // Château arrière MASSIF à 3 étages + volutes d'ornement.
    + castle(-54, -30, -36, -26.5, 4)
    + castle(-53, -34, -44, -35.5, 3)
    + castle(-51.5, -38, -52, -43.5, 2)
    + '<path d="M-55 -30 q-4 2.6 -2.6 7 M-55.5 -40 q-3.6 2.4 -2.4 6.4" fill="none" stroke="@coqueH" stroke-width="1.3"/>' // volutes de poupe
    + '<path d="M-50 -32.5 l14 0 M-49 -41 l9 0" stroke="@coqueH" stroke-width="0.9" opacity="0.8"/>' // moulures dorées
    + flag(-50.5, -52, 9, 5.5)
    + '</g>';
}

export const hullArt: ShipArtDef = { id: 'galion-bretonnien', profile };

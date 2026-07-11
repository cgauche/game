/**
 * CROISEUR (MDG, ~60 m, voile) — grand vaisseau de guerre à voiles étagées : trois mâts, deux
 * étages de voiles carrées, châteaux à TOURELLES coiffées en poivrière, rangée de sabords,
 * beaupré. Réf : planche MDG p.098 (en bas à droite — les tourelles font la signature).
 */
import type { ShipArtDef } from '../artkit';
import { castle, gunports, hune, pennant, rudder, spar, squareSail, stay } from '../artkit';

/** Tourelle de château (guette ronde à toit en poivrière @pavillon). */
const turret = (x: number, yBase: number): string =>
  `<rect x="${x - 2.4}" y="${yBase - 6}" width="4.8" height="6" fill="@coque" stroke="@coqueO" stroke-width="0.9"/>`
  + `<path d="M${x - 3.4} ${yBase - 6} L${x} ${yBase - 11.4} L${x + 3.4} ${yBase - 6} Z" fill="@pavillon" stroke="@coqueO" stroke-width="0.7"/>`;

function profile(): string {
  return '<g>'
    + rudder(-54, -20)
    // Trois mâts : misaine, grand mât (2 étages), artimon latin ; beaupré.
    + spar(26, -26, 26, -92, 2.6)
    + squareSail(26, -60, 32, 15, { seams: 1 }) + squareSail(26, -86, 24, 11, { seams: 1 }) + hune(26, -66)
    + spar(-4, -24, -4, -112, 3)
    + squareSail(-4, -68, 40, 18, { seams: 2 }) + squareSail(-4, -104, 30, 13, { seams: 1 }) + hune(-4, -74)
    + spar(-32, -26, -32, -84, 2.4)
    + squareSail(-32, -78, 26, 11, { seams: 1 })
    + spar(44, -28, 57, -38, 2.2) // beaupré
    + stay(-4, -112, 26, -30) + stay(-4, -112, -32, -32) + stay(26, -92, 56, -37) + stay(-32, -84, -53, -28)
    + pennant(-4, -112, 12) + pennant(26, -92, 9) + pennant(-32, -84, 9)
    // Coque haute à forte tonture, deux préceintes, sabords.
    + '<path d="M-54 -26 Q-28 -17 0 -16.4 Q28 -17.5 54 -28 L48 -2 Q0 3.4 -48 -2 Z" fill="@coque" stroke="@coqueO" stroke-width="1.5"/>'
    + '<path d="M-54 -26 Q-28 -17 0 -16.4 Q28 -17.5 54 -28" fill="none" stroke="@coqueH" stroke-width="1.4"/>'
    + '<path d="M-52 -19 Q0 -10.5 52 -20.5 M-50 -11 Q0 -4 50 -12" fill="none" stroke="@coqueH" stroke-width="1.2" opacity="0.8"/>'
    + gunports(-42, 40, 7, -14.5, 3)
    // Châteaux étagés à tourelles (arrière double, avant simple).
    + castle(-54, -30, -37, -25, 4)
    + castle(-50, -36, -45, -36.5, 3)
    + turret(-52, -45) + turret(-34, -45)
    + castle(34, 54, -38, -26.5, 3)
    + turret(52, -38)
    + '</g>';
}

export const hullArt: ShipArtDef = { id: 'croiseur', profile };

/**
 * CARAVELLE TILÉENNE (MDG, ~40 m, voile) — fine et basse (rien des châteaux massifs de la
 * caraque) : dunette modeste, trois mâts « redonda » (misaine et grand mât carrés, artimon latin),
 * flammes tiléennes en girouette.
 */
import type { ShipArtDef } from '../artkit';
import { hune, lateenSail, pennant, rudder, spar, squareSail, stay } from '../artkit';

function profile(): string {
  return '<g>'
    + rudder(-44, -14)
    // Artimon latin, grand mât, misaine — mâture élancée.
    + spar(-28, -18, -28, -66, 2)
    + lateenSail([-18, -62], [-42, -30], [-20, -20], [3, 5])
    + spar(-2, -13, -2, -92, 2.4)
    + squareSail(-2, -84, 40, 15, { seams: 2 }) + hune(-2, -89)
    + spar(26, -14, 28, -70, 2)
    + squareSail(27, -64, 26, 10, { seams: 1 })
    + spar(40, -16, 53, -26, 1.8)
    + stay(-2, -92, 26, -18) + stay(-2, -92, -28, -20) + stay(28, -70, 51, -25)
    + pennant(-2, -92, 12) + pennant(28, -70, 9) + pennant(-28, -66, 8)
    // Coque longue et BASSE, tonture douce, une préceinte.
    + '<path d="M-44 -16 Q-22 -10 0 -9.4 Q22 -10.5 44 -15 L40 -1.4 Q0 2.6 -40 -1.4 Z" fill="@coque" stroke="@coqueO" stroke-width="1.4"/>'
    + '<path d="M-44 -16 Q-22 -10 0 -9.4 Q22 -10.5 44 -15" fill="none" stroke="@coqueH" stroke-width="1.2"/>'
    + '<path d="M-42 -9.5 Q0 -3.6 42 -9" fill="none" stroke="@coqueH" stroke-width="1.1" opacity="0.8"/>'
    // Dunette modeste (seul relief du pont).
    + '<path d="M-44 -16 L-28 -16 L-28 -22 L-44 -22 Z" fill="@coque" stroke="@coqueO" stroke-width="1"/>'
    + '<path d="M-42 -22 L-30 -22" stroke="@coqueH" stroke-width="1"/>'
    + '</g>';
}

export const hullArt: ShipArtDef = { id: 'caravelle-tileenne', profile };

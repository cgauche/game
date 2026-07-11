/**
 * CARAQUE (MDG, ~35 m, voile) — hauturier marchand : hauts châteaux AVANT (en surplomb de
 * l'étrave) et arrière, trois mâts (grand carré, misaine, artimon LATIN), beaupré, hune.
 * Réf : MDG p.114 (caraque tous mâts, profil).
 */
import type { ShipArtDef } from '../artkit';
import { castle, flag, hune, lateenSail, pennant, rudder, spar, squareSail, stay } from '../artkit';

function profile(): string {
  return '<g>'
    + rudder(-42, -16)
    // Artimon LATIN, grand mât carré avec hune, misaine, beaupré.
    + spar(-26, -22, -26, -70, 2.2)
    + lateenSail([-16, -66], [-40, -34], [-19, -25], [3, 5])
    + spar(-2, -16, -2, -98, 2.8)
    + squareSail(-2, -88, 42, 17, { seams: 2 }) + hune(-2, -94)
    + spar(24, -24, 24, -72, 2.2)
    + squareSail(24, -66, 26, 11, { seams: 1 })
    + spar(38, -28, 52, -38, 2)
    + stay(-2, -98, 24, -26) + stay(-2, -98, -26, -24) + stay(24, -72, 50, -37)
    + pennant(-2, -98, 11) + pennant(24, -72, 8)
    // Coque ventrue à forte tonture, deux préceintes.
    + '<path d="M-42 -22 Q-22 -13.5 0 -13 Q22 -14 42 -24 L37 -1.6 Q0 3 -37 -1.6 Z" fill="@coque" stroke="@coqueO" stroke-width="1.5"/>'
    + '<path d="M-42 -22 Q-22 -13.5 0 -13 Q22 -14 42 -24" fill="none" stroke="@coqueH" stroke-width="1.3"/>'
    + '<path d="M-40 -15.5 Q0 -8 40 -17 M-38.5 -8.5 Q0 -2 38.5 -9.5" fill="none" stroke="@coqueH" stroke-width="1.1" opacity="0.8"/>'
    // Châteaux : gaillard d'AVANT haut en surplomb + château arrière étagé.
    + castle(24, 42, -40, -22.5, 3)
    + '<path d="M28 -22.5 l0 -2 M37 -23.5 l0 -2" stroke="@coqueO" stroke-width="1.1"/>'
    + castle(-42, -22, -32, -20.5, 4)
    + castle(-40, -27, -40, -31.5, 3)
    + flag(-39, -40, 7, 4.5)
    + '</g>';
}

export const hullArt: ShipArtDef = { id: 'caraque', profile };

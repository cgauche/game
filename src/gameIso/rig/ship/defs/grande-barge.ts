/**
 * GRANDE BARGE (LDB 306, ~30 m) — le grand gabarit fluvial : long ponton plat, DEUX mâts courts,
 * rouf arrière + rangée de fret en pontée, timon et avirons de bordée.
 */
import type { ShipArtDef } from '../artkit';
import { oarBank, pennant, spar, squareSail, timon } from '../artkit';

function profile(): string {
  return '<g>'
    + oarBank(-20, -8, 3, -10, 6)
    // Deux mâts courts à voile carrée.
    + spar(-6, -10, -6, -50, 2.2) + squareSail(-6, -46, 22, 9, { seams: 1 }) + pennant(-6, -50, 7)
    + spar(20, -10, 20, -44, 2) + squareSail(20, -40, 18, 7.5, { seams: 1 }) + pennant(20, -44, 6)
    // Long ponton plat.
    + '<path d="M-38 -11 L38 -11 L34.5 -1 L-34.5 -1 Z" fill="@coque" stroke="@coqueO" stroke-width="1.4"/>'
    + '<path d="M-38 -11 L38 -11" stroke="@coqueH" stroke-width="1.5"/>'
    + '<path d="M-36 -7 L36 -7 M-35.5 -4 L35.5 -4" stroke="@coqueO" stroke-width="0.7" opacity="0.5"/>'
    // Rouf arrière + fret en pontée au centre-avant.
    + '<rect x="-32" y="-18.5" width="14" height="7.5" fill="@coque" stroke="@coqueO" stroke-width="1"/>'
    + '<circle cx="-28" cy="-14.5" r="1.1" fill="@voileH"/><circle cx="-23" cy="-14.5" r="1.1" fill="@voileH"/>'
    + '<rect x="4" y="-16.5" width="8" height="5.5" fill="@matO" stroke="@coqueO" stroke-width="0.8"/>'
    + '<rect x="27" y="-15.5" width="6" height="4.5" fill="@mat" stroke="@coqueO" stroke-width="0.8"/>'
    + timon(-34.5, -13)
    + '</g>';
}

export const hullArt: ShipArtDef = { id: 'grande-barge', profile };

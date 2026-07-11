/**
 * BARGE FLUVIALE (MSLRC 33, ~15 m) — péniche du Reik : ponton plat plus court que la barge LDB,
 * ROUF d'habitation dominant (cabine à hublots), petit mât à livarde, timon.
 */
import type { ShipArtDef } from '../artkit';
import { pennant, spar, squareSail, timon } from '../artkit';

function profile(): string {
  return '<g>'
    // Petit gréement avancé.
    + spar(13, -8, 13, -40, 2)
    + squareSail(13, -36, 17, 7, { seams: 1 })
    + pennant(13, -40, 6)
    // Ponton plat.
    + '<path d="M-25 -9 L25 -9 L22.5 -1 L-22.5 -1 Z" fill="@coque" stroke="@coqueO" stroke-width="1.3"/>'
    + '<path d="M-25 -9 L25 -9" stroke="@coqueH" stroke-width="1.3"/>'
    + '<path d="M-23.5 -5 L23.5 -5" stroke="@coqueO" stroke-width="0.7" opacity="0.5"/>'
    // Rouf d'habitation (cabine longue, toit débordant, hublots).
    + '<rect x="-16" y="-17.5" width="20" height="8.5" fill="@coque" stroke="@coqueO" stroke-width="1.1"/>'
    + '<path d="M-17.5 -17.5 L5.5 -17.5" stroke="@matO" stroke-width="1.8" stroke-linecap="round"/>'
    + '<circle cx="-11" cy="-13" r="1.2" fill="@voileH"/><circle cx="-5" cy="-13" r="1.2" fill="@voileH"/><circle cx="1" cy="-13" r="1.2" fill="@voileH"/>'
    // Timon.
    + timon(-22.5, -11)
    + '</g>';
}

export const hullArt: ShipArtDef = { id: 'barge-fluviale', profile };

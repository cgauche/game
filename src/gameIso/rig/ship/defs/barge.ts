/**
 * BARGE (LDB 306, ~20 m) — fluvial à FOND PLAT : ponton rectangulaire bas, fret en pontée,
 * mât court à voile carrée, long timon de gouverne, avirons de bordée.
 */
import type { ShipArtDef } from '../artkit';
import { oarBank, pennant, spar, squareSail, timon } from '../artkit';

function profile(): string {
  return '<g>'
    + oarBank(-14, 0, 3, -9, 6)
    // Gréement court (mât de halage/voile d'appoint).
    + spar(6, -9, 6, -46, 2.2)
    + squareSail(6, -42, 22, 9, { seams: 1 })
    + pennant(6, -46, 7)
    // Ponton plat : flancs droits, léger brion aux extrémités.
    + '<path d="M-30 -10 L30 -10 L27 -1 L-27 -1 Z" fill="@coque" stroke="@coqueO" stroke-width="1.4"/>'
    + '<path d="M-30 -10 L30 -10" stroke="@coqueH" stroke-width="1.4"/>'
    + '<path d="M-28 -6.5 L28 -6.5 M-27.5 -3.5 L27.5 -3.5" stroke="@coqueO" stroke-width="0.7" opacity="0.5"/>'
    // Fret en pontée (caisses) vers l'avant.
    + '<rect x="12" y="-15.5" width="7" height="5.5" fill="@matO" stroke="@coqueO" stroke-width="0.8"/>'
    + '<rect x="20" y="-14.5" width="5.5" height="4.5" fill="@mat" stroke="@coqueO" stroke-width="0.8"/>'
    // Timon de gouverne à l'arrière.
    + timon(-27, -12)
    + '</g>';
}

export const hullArt: ShipArtDef = { id: 'barge', profile };

/**
 * GALÈRE DE GUERRE (MDG, ~35 m, mixte) — long vaisseau de rame : ÉPERON de bronze, batterie
 * d'avirons sur apostis, plage arrière surélevée sous dais, grand mât carré + trinquet incliné.
 */
import type { ShipArtDef } from '../artkit';
import { oarBank, pennant, spar, squareSail, stay } from '../artkit';

function profile(): string {
  return '<g>'
    + oarBank(-36, 28, 11, -7.5, 7)
    // Grand mât + trinquet (mât avant incliné sur l'éperon).
    + spar(-2, -8, -2, -78, 2.6)
    + squareSail(-2, -70, 36, 17, { seams: 2 })
    + spar(24, -8, 28, -56, 2.2)
    + squareSail(27, -51, 22, 10, { seams: 1 })
    + stay(-2, -78, -40, -18) + stay(-2, -78, 24, -14) + stay(28, -56, 44, -8)
    + pennant(-2, -78, 11) + pennant(28, -56, 8)
    // Coque longue très basse ; apostis (caisson de nage) en surlonge.
    + '<path d="M-44 -14 Q-24 -8 0 -7.4 Q24 -8 44 -12 L41 -1 Q0 2.4 -40 -1 Z" fill="@coque" stroke="@coqueO" stroke-width="1.4"/>'
    + '<path d="M-42 -9.6 L42 -8.4" stroke="@coqueH" stroke-width="1.8" opacity="0.9"/>' // apostis
    + '<path d="M-40.5 -4.5 Q0 -0.6 40.5 -4" fill="none" stroke="@coqueO" stroke-width="0.7" opacity="0.5"/>'
    // ÉPERON de bronze à la flottaison.
    + '<path d="M44 -7 L56 -2.6 L43.5 0 Z" fill="@matO" stroke="@coqueO" stroke-width="1"/>'
    + '<path d="M44.5 -5.6 L53.5 -3" stroke="@coqueH" stroke-width="0.9" opacity="0.8"/>'
    // Plage arrière surélevée sous DAIS (capitaine/timoniers).
    + '<path d="M-44 -14 L-30 -14 L-30 -19 L-44 -19 Z" fill="@coque" stroke="@coqueO" stroke-width="1"/>'
    + '<path d="M-43 -19 l0 -6 M-31 -19 l0 -6" stroke="@matO" stroke-width="1.2"/>'
    + '<path d="M-45.5 -25 Q-37 -28.5 -28.5 -25" fill="@voile" stroke="@voileO" stroke-width="1"/>'
    // Rame de gouverne latérale.
    + spar(-42, -12, -50, 0, 1.8)
    + '</g>';
}

export const hullArt: ShipArtDef = { id: 'galere-de-guerre', profile };

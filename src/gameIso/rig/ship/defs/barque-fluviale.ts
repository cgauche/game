/**
 * BARQUE (fluviale, MSLRC 33, ~5 m) — canot ouvert à fond plat : étrave pointue, tableau arrière
 * droit, deux avirons. Réf : le petit bateau du port fluvial MDG p.022.
 */
import type { ShipArtDef } from '../artkit';

function profile(): string {
  return '<g>'
    // Avirons (derrière la coque).
    + '<g stroke="@mat" stroke-width="1.2" stroke-linecap="round"><line x1="-3" y1="-5" x2="-8" y2="1"/><line x1="5" y1="-5" x2="0.5" y2="1"/></g>'
    // Coque ouverte : tableau à gauche, étrave relevée à droite, tonture creusée au milieu.
    + '<path d="M-14 -8 L-11.5 -0.8 Q0 1.8 9 -0.6 L15 -8.5 Q7 -5.6 0 -5.4 Q-7 -5.4 -14 -8 Z" fill="@coque" stroke="@coqueO" stroke-width="1.2"/>'
    // Plat-bord éclairé + virure.
    + '<path d="M-14 -8 Q-7 -5.4 0 -5.4 Q7 -5.6 15 -8.5" fill="none" stroke="@coqueH" stroke-width="1.1"/>'
    + '<path d="M-11 -3 Q0 -1.2 10 -3.2" fill="none" stroke="@coqueO" stroke-width="0.7" opacity="0.5"/>'
    // Bancs de nage (nervures verticales au-dessus du plat-bord).
    + '<path d="M-4 -5.4 l0 -1.8 M4 -5.5 l0 -1.8" stroke="@matO" stroke-width="1.2"/>'
    + '</g>';
}

export const hullArt: ShipArtDef = { id: 'barque-fluviale', profile };

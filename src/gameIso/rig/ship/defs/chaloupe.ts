/**
 * CHALOUPE (LDB 306, ~10 m) — grand canot ouvert de bord : trois bancs de nage, trois avirons,
 * étrave franche et safran de tableau. Plus long et plus armé que la barque.
 */
import type { ShipArtDef } from '../artkit';
import { oarBank, rudder } from '../artkit';

function profile(): string {
  return '<g>'
    + oarBank(-10, 10, 3, -5.6, 5)
    // Coque ouverte allongée, étrave droite légèrement élancée.
    + '<path d="M-19 -9 L-16.5 -1 Q0 2.2 13 -0.8 L20 -9.5 Q9 -6 0 -5.8 Q-10 -5.8 -19 -9 Z" fill="@coque" stroke="@coqueO" stroke-width="1.3"/>'
    + '<path d="M-19 -9 Q-10 -5.8 0 -5.8 Q9 -6 20 -9.5" fill="none" stroke="@coqueH" stroke-width="1.2"/>'
    + '<path d="M-15.5 -3.4 Q0 -0.6 14 -3.6" fill="none" stroke="@coqueO" stroke-width="0.7" opacity="0.5"/>'
    // Trois bancs de nage.
    + '<path d="M-8 -5.8 l0 -2 M0 -5.8 l0 -2 M8 -5.9 l0 -2" stroke="@matO" stroke-width="1.3"/>'
    + rudder(-19, -8)
    + '</g>';
}

export const hullArt: ShipArtDef = { id: 'chaloupe', profile };

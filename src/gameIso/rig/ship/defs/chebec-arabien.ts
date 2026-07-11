/**
 * CHÉBEC ARABIEN (MDG, ~40 m, mixte) — corsaire d'Arabie : coque TRÈS basse aux longs élancements
 * (éperon d'étrave effilé, cul en surplomb), trois mâts INCLINÉS à grandes voiles latines,
 * avirons d'appoint, virure d'accent claire.
 */
import type { ShipArtDef } from '../artkit';
import { lateenSail, oarBank, pennant, stay } from '../artkit';

function profile(): string {
  return '<g>'
    + oarBank(-30, 18, 7, -6, 6)
    // Trois latines sur mâts en quête (inclinés vers l'avant), pointes hautes vers la proue.
    + lateenSail([-8, -60], [-34, -14], [-13, -7], [3, 6])
    + lateenSail([22, -72], [-8, -18], [15, -8], [3, 6])
    + lateenSail([46, -56], [22, -14], [39, -7.5], [2, 5])
    + stay(14, -70, -12, -12) + stay(40, -54, 20, -10)
    + pennant(22, -72, 10) + pennant(-8, -60, 7)
    // Coque basse effilée, longs surplombs avant/arrière.
    + '<path d="M-46 -17 Q-36 -8.5 -14 -7 Q10 -6.4 28 -8 Q40 -9.5 50 -15 L34 -1.4 Q0 2.2 -32 -1.4 Z" fill="@coque" stroke="@coqueO" stroke-width="1.4"/>'
    + '<path d="M-46 -17 Q-36 -8.5 -14 -7 Q10 -6.4 28 -8 Q40 -9.5 50 -15" fill="none" stroke="@coqueH" stroke-width="1.2"/>'
    // Éperon d'étrave effilé + plage arrière en surplomb (grille de poupe).
    + '<path d="M50 -15 L58 -17.6 L47 -11.5" fill="none" stroke="@coque" stroke-width="2.4" stroke-linecap="round"/>'
    + '<path d="M-46 -17 L-53 -18.4 L-44 -13" fill="none" stroke="@coque" stroke-width="2.2" stroke-linecap="round"/>'
    + '<path d="M-51 -17.6 l1 3 m2.6 -3.4 l1 3.4 m2.6 -3.6 l0.8 3.4" stroke="@coqueO" stroke-width="0.8" opacity="0.8"/>' // grille
    // Virure d'accent claire (livrée corsaire).
    + '<path d="M-42 -10.5 Q0 -3.4 46 -11" fill="none" stroke="@coqueH" stroke-width="1.8" opacity="0.95"/>'
    + '</g>';
}

export const hullArt: ShipArtDef = { id: 'chebec-arabien', profile };

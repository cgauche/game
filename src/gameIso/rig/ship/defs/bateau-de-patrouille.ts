/**
 * BATEAU DE PATROUILLE (MDG, ~25 m, mixte) — garde-côte impérial : coque basse et effilée,
 * éperon de flottaison, plateforme crénelée de proue, rang d'avirons, voile carrée de route.
 */
import type { ShipArtDef } from '../artkit';
import { castle, oarBank, pennant, rudder, spar, squareSail, stay } from '../artkit';

function profile(): string {
  return '<g>'
    + oarBank(-26, 14, 6, -6, 6)
    + rudder(-34, -12)
    // Gréement : mât central, voile de route frappée d'une bande impériale.
    + spar(-4, -6, -4, -66, 2.4)
    + squareSail(-4, -60, 32, 14, { seams: 1 })
    + '<path d="M-8.5 -58 Q-5 -44 -7.5 -29.4 M0.5 -58.6 Q4 -44 1.5 -29" stroke="@pavillon" stroke-width="2.4" opacity="0.7" fill="none"/>'
    + stay(-4, -66, 30, -12) + stay(-4, -66, -32, -13)
    + pennant(-4, -66, 12)
    // Coque longue, basse, tendue — lignes militaires.
    + '<path d="M-34 -13 Q-20 -7 0 -6.4 Q20 -7 34 -12 L31 -1 Q0 2 -30 -1 Z" fill="@coque" stroke="@coqueO" stroke-width="1.4"/>'
    + '<path d="M-34 -13 Q-20 -7 0 -6.4 Q20 -7 34 -12" fill="none" stroke="@coqueH" stroke-width="1.2"/>'
    + '<path d="M-31.5 -7.5 Q0 -2.6 31.5 -7" fill="none" stroke="@coqueO" stroke-width="0.7" opacity="0.5"/>'
    // ÉPERON de flottaison à la proue.
    + '<path d="M34 -5 L44 -1.6 L33.5 0 Z" fill="@matO" stroke="@coqueO" stroke-width="0.9"/>'
    // Plateforme de proue crénelée (poste des arbalétriers de la patrouille).
    + castle(24, 34, -18, -11, 3)
    + '</g>';
}

export const hullArt: ShipArtDef = { id: 'bateau-de-patrouille', profile };

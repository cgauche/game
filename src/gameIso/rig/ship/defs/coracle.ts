/**
 * CORACLE (LDB 306, ~3 m) — coquille ronde en cuir tendu sur cadre d'osier tressé, une seule rame.
 * La plus petite silhouette de la toise navale : un BOL de vannerie, pas une coque à étrave —
 * bord roulé, croisillons d'osier apparents sous le cuir, rame dressée pour la présence verticale.
 * Rond de partout : la face montre la PALE de la rame, le dos son manche seul (ossature accentuée).
 */
import type { ShipArtDef } from '../artkit';
import { spar } from '../artkit';

/** Bol du coracle (silhouette IDENTIQUE sur les 3 vues — l'engin est rond), bord roulé en haut. */
const bowl = (): string =>
  '<path d="M-13 -12 Q-15.5 -3 -6.5 -0.7 Q0 0.5 6.5 -0.7 Q15.5 -3 13 -12 Q0 -16.5 -13 -12 Z" fill="@coque" stroke="@coqueO" stroke-width="1.4"/>'
  // Bord ROULÉ (boudin d'osier ourlant le cuir).
  + '<path d="M-13 -12 Q0 -16.5 13 -12" fill="none" stroke="@coqueH" stroke-width="2.2"/>'
  // Coutures du cuir sous le bord (points de laçage).
  + '<path d="M-9.6 -12.6 l0.5 1.7 M-4.8 -13.6 l0.3 1.7 M0 -14 l0 1.7 M4.8 -13.6 l-0.3 1.7 M9.6 -12.6 l-0.5 1.7" stroke="@coqueH" stroke-width="0.6" opacity="0.8"/>';

/** Croisillons de VANNERIE (membrures verticales × liens horizontaux du cadre, sous le cuir). */
const wicker = (strength: number): string =>
  `<path d="M-9.5 -13.4 Q-11.5 -5 -4.5 -1.1 M-4.6 -14.4 Q-5.4 -6 -1.2 -0.8 M4.6 -14.4 Q5.4 -6 1.2 -0.8 M9.5 -13.4 Q11.5 -5 4.5 -1.1" fill="none" stroke="@coqueO" stroke-width="0.8" opacity="${strength}"/>`
  + `<path d="M-14 -8 Q0 -3.2 14 -8 M-11 -3.6 Q0 0.2 11 -3.6" fill="none" stroke="@coqueO" stroke-width="0.7" opacity="${strength - 0.1}"/>`;

function profile(): string {
  return '<g>'
    // L'unique rame, dressée en appui sur le bord, pale levée vers la proue.
    + spar(1, -9, 11.5, -23, 1.6)
    + '<path d="M11.5 -23 Q16.5 -26.5 15.6 -31.5 Q10.6 -30.5 10 -25.4 Z" fill="@mat" stroke="@matO" stroke-width="0.7"/>'
    + bowl()
    + wicker(0.55)
    + '</g>';
}

function front(): string {
  return '<g>'
    // Rame debout derrière le bord, PALE de face (goutte pleine, nervure centrale).
    + spar(4, -9, 4, -25, 1.6)
    + '<path d="M4 -33.5 Q7.4 -30.5 7 -26 Q5.6 -23.6 4 -23.4 Q2.4 -23.6 1 -26 Q0.6 -30.5 4 -33.5 Z" fill="@mat" stroke="@matO" stroke-width="0.7"/>'
    + '<path d="M4 -32.5 L4 -24.4" stroke="@matO" stroke-width="0.6" opacity="0.7"/>'
    + bowl()
    + wicker(0.55)
    + '</g>';
}

function back(): string {
  return '<g>'
    // Vu de poupe (le rond n'en a pas) : le manche de la rame dépasse SEUL, pale masquée par le bol.
    + spar(-3, -9, -3, -22, 1.6)
    + '<circle cx="-3" cy="-22" r="1.1" fill="@matO"/>'
    + bowl()
    // Ossature d'osier plus MARQUÉE côté dos (le cadre prime sur le cuir à contre-jour).
    + wicker(0.75)
    + '</g>';
}

export const hullArt: ShipArtDef = { id: 'coracle', front, profile, back };

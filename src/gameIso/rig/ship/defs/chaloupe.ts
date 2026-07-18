/**
 * CHALOUPE (MDG 113, ~10 m, avirons) — grand canot de bord OUVERT : quille presque droite à léger
 * rocker, étrave RAKÉE, poupe à TABLEAU (safran de tableau + barre franche), bordé à clins, trois
 * bancs de nage et trois avirons (réf planche MDG 12 p.098, construction du Knarr en plus court).
 */
import type { ShipArtDef } from '../artkit';
import { oarBank, rudder, spar } from '../artkit';

function profile(): string {
  return '<g>'
    // Safran pendu au TABLEAU + barre franche rentrant à bord.
    + rudder(-21.5, -10.5)
    + spar(-20.5, -10.2, -14.5, -8.2, 1.2)
    // Trois avirons au travail, inclinés vers l'arrière.
    + oarBank(-9, 9, 3, -6.8, 6)
    // Coque OUVERTE construite : tableau arrière (gauche) légèrement incliné, quille presque droite
    // à léger rocker, étrave rakée qui MONTE à l'avant — pas un croissant.
    + '<path d="M-21.5 -11 L-19.5 -0.9 Q0 1.6 17.5 -0.7 L22.5 -12 Q10 -7.6 0 -7.3 Q-11 -7.3 -21.5 -11 Z" fill="@coque" stroke="@coqueO" stroke-width="1.3"/>'
    // Tableau + étrave appuyés, semelle de quille.
    + '<path d="M-21.5 -11 L-19.5 -0.9 M22.5 -12 L17.5 -0.7" stroke="@coqueO" stroke-width="1.8"/>'
    + '<path d="M-19.5 -0.9 Q0 1.6 17.5 -0.7" fill="none" stroke="@coqueO" stroke-width="1.5"/>'
    // Plat-bord (tonture) + deux virures de bordé à clins.
    + '<path d="M-21.5 -11 Q-11 -7.3 0 -7.3 Q10 -7.6 22.5 -12" fill="none" stroke="@coqueH" stroke-width="1.2"/>'
    + '<path d="M-20.5 -7.6 Q0 -4 21 -8.4 M-20 -4.4 Q0 -1.2 18.5 -4.6" fill="none" stroke="@coqueO" stroke-width="0.7" opacity="0.5"/>'
    // Trois BANCS DE NAGE (abouts au plat-bord) + tolets.
    + '<path d="M-8.5 -6.9 l2.6 -0.2 M-0.9 -7 l2.6 0 M6.9 -7.2 l2.6 -0.2" stroke="@mat" stroke-width="1.6" stroke-linecap="round"/>'
    + '<path d="M-9 -6.9 l0 -1.8 M0 -7 l0 -1.8 M9 -7.3 l0 -1.8" stroke="@matO" stroke-width="1.2"/>'
    + '</g>';
}

/** Avirons sortis en ciseaux de part et d'autre (vues d'axe). */
const oarsAxial = (): string =>
  '<g stroke="@mat" stroke-width="1.3" stroke-linecap="round">'
  + '<line x1="-6.2" y1="-6" x2="-12.5" y2="1"/><line x1="6.2" y1="-6" x2="12.5" y2="1"/>'
  + '<line x1="-5.4" y1="-5.2" x2="-10" y2="1.4"/><line x1="5.4" y1="-5.2" x2="10" y2="1.4"/></g>';

function front(): string {
  return '<g>'
    + oarsAxial()
    // Coque vue de PROUE : étrave axiale montant au brion, sections évasées, clins emboîtés.
    + '<path d="M0 -13 Q-5.6 -10.6 -7 -6.6 Q-7.4 -2 0 0.8 Q7.4 -2 7 -6.6 Q5.6 -10.6 0 -13 Z" fill="@coque" stroke="@coqueO" stroke-width="1.3"/>'
    + '<path d="M0 -13 L0 0.4" stroke="@coqueO" stroke-width="1.8"/>'
    + '<path d="M0 -13 Q-5.6 -10.6 -7 -6.6 M0 -13 Q5.6 -10.6 7 -6.6" fill="none" stroke="@coqueH" stroke-width="1.1"/>'
    + '<path d="M-6.2 -4.8 Q0 -7.8 6.2 -4.8 M-4.8 -1.8 Q0 -4.4 4.8 -1.8" fill="none" stroke="@coqueO" stroke-width="0.7" opacity="0.5"/>'
    // Banc de nage AVANT visible par-dessus le plat-bord.
    + '<path d="M-5.8 -7.6 L5.8 -7.6" stroke="@mat" stroke-width="1.6" stroke-linecap="round"/>'
    + '</g>';
}

function back(): string {
  return '<g>'
    + oarsAxial()
    // Poupe = TABLEAU plat (trapèze) légèrement plus large en tête, virures horizontales.
    + '<path d="M-6.6 -10.5 L6.6 -10.5 L5.2 -0.6 Q0 1 -5.2 -0.6 Z" fill="@coque" stroke="@coqueO" stroke-width="1.3"/>'
    + '<path d="M-6.6 -10.5 L6.6 -10.5" stroke="@coqueH" stroke-width="1.4"/>'
    + '<path d="M-6.2 -7.4 L6.2 -7.4 M-5.8 -4.2 L5.8 -4.2" stroke="@coqueO" stroke-width="0.7" opacity="0.5"/>'
    // SAFRAN axial pendu au tableau + barre franche vers bâbord.
    + '<path d="M-1.2 -10 L1.2 -10 L1.6 1.6 L-1.6 1.6 Z" fill="@coque" stroke="@coqueO" stroke-width="1"/>'
    + spar(0, -10, -6.5, -12.6, 1.4)
    + '</g>';
}

export const hullArt: ShipArtDef = { id: 'chaloupe', profile, front, back };

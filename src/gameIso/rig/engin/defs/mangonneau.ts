/**
 * MANGONNEAU (`mangonneau`) — catapulte à torsion : châssis bas trapu à roues, gros écheveau de corde
 * transversal, bras unique dressé contre un butoir matelassé, godet-cuiller chargé d'une pierre.
 * Art de l'engin (3 vues), routé par l'id d'espèce `mangonneau`.
 */
import { type EnginArtDef, wheelFace, wheelEdge } from '../artkit';

function profile(): string {
  // Vue de CÔTÉ (tir vers la DROITE) : ce qui signe l'engin est le BRAS oblique qui jaillit de
  // l'écheveau (rouleau de corde vu de bout) et se dresse contre le butoir, godet + pierre en tête.
  return '<g>'
    // Châssis bas trapu (longeron plein au sol).
    + '<path d="M-38 -2 L36 -2 L32 -13 L-34 -13 Z" fill="@bois" stroke="@boisO" stroke-width="1.5"/>'
    + '<path d="M-28 -7 L28 -7" stroke="@boisO" stroke-width="1" opacity="0.6"/>' // joint de madriers
    // Montant avant (A-frame vu de chant : deux jambes convergentes) portant le butoir.
    + '<path d="M10 -12 L20 -46 M30 -12 L22 -46" stroke="@bois" stroke-width="6" stroke-linecap="round"/>'
    // Butoir matelassé (traverse d'arrêt du bras).
    + '<rect x="13" y="-53" width="16" height="9" rx="4.5" fill="@corde" stroke="@cordeO" stroke-width="1.5"/>'
    // Treuil arrière (bandage du bras) — tambour + manivelle.
    + '<circle cx="-31" cy="-17" r="5" fill="@fonte" stroke="@fer" stroke-width="1.5"/>'
    + '<path d="M-31 -17 l6 4" stroke="@fer" stroke-width="2.5" stroke-linecap="round"/>'
    // Écheveau de torsion TRANSVERSAL vu de bout : gros rouleau de corde à la base, axe ferré.
    + '<circle cx="-4" cy="-17" r="8.5" fill="@corde" stroke="@cordeO" stroke-width="1.5"/>'
    + '<circle cx="-4" cy="-17" r="4.5" fill="none" stroke="@cordeO" stroke-width="1"/>'
    + '<circle cx="-4" cy="-17" r="2" fill="@fer"/>'
    // BRAS unique planté dans l'écheveau, dressé en oblique contre le butoir, prolongé en tête.
    + '<path d="M-4 -17 L21 -50" stroke="@bois" stroke-width="5.5" stroke-linecap="round"/>'
    + '<path d="M21 -50 L28 -60" stroke="@bois" stroke-width="4" stroke-linecap="round"/>'
    // Godet-cuiller (bol ouvert vers le haut) + pierre calée dedans.
    + '<path d="M22 -62 A8 8 0 0 0 38 -62 Z" fill="@bois" stroke="@boisO" stroke-width="1.5"/>'
    + '<circle cx="30" cy="-64" r="5" fill="#8b8578" stroke="#5d594f" stroke-width="1.2"/>' // boulet de pierre
    + '<path d="M27 -66 l3 2" stroke="#a39e90" stroke-width="1.2" stroke-linecap="round"/>' // éclat
    // Roues au sol (côté proche), petites : l'engin reste BAS et trapu.
    + `<g transform="translate(-25,-14)">${wheelFace(12)}</g>`
    + `<g transform="translate(23,-14)">${wheelFace(12)}</g>`
    + '</g>';
}

function front(): string {
  // Vue de FACE (le tir vient vers le spectateur) : cadre bas et LARGE, écheveau transversal,
  // godet plein cadre au-dessus du butoir avec la pierre pointée sur le spectateur.
  return '<g>'
    + `<g transform="translate(-29,-13)">${wheelEdge(26)}</g>` // roues de bout (flanquantes)
    + `<g transform="translate(29,-13)">${wheelEdge(26)}</g>`
    // Châssis : traverse au sol + deux montants convergents.
    + '<path d="M-26 -4 L26 -4" stroke="@bois" stroke-width="7" stroke-linecap="round"/>'
    + '<path d="M-22 -4 L-15 -46 M22 -4 L15 -46" stroke="@bois" stroke-width="7" stroke-linecap="round"/>'
    // Écheveau de torsion transversal (rouleau de corde qui traverse le bâti), spires marquées.
    + '<rect x="-20" y="-24" width="40" height="11" rx="5.5" fill="@corde" stroke="@cordeO" stroke-width="1.5"/>'
    + '<path d="M-11 -24 L-11 -13 M0 -24 L0 -13 M11 -24 L11 -13" stroke="@cordeO" stroke-width="1.2"/>'
    // Fût du bras dressé vers le spectateur (foreshorten : court segment vertical derrière le godet).
    + '<path d="M0 -24 L0 -50" stroke="@bois" stroke-width="5" stroke-linecap="round"/>'
    // Butoir matelassé en tête de cadre.
    + '<rect x="-18" y="-51" width="36" height="8" rx="4" fill="@corde" stroke="@cordeO" stroke-width="1.5"/>'
    // Godet vu de face (disque de bois cerclé) + pierre au centre, face au spectateur.
    + '<circle cx="0" cy="-59" r="9" fill="@bois" stroke="@boisO" stroke-width="2"/>'
    + '<circle cx="0" cy="-59" r="9" fill="none" stroke="@ferH" stroke-width="1"/>' // cerclage
    + '<circle cx="0" cy="-59" r="5.5" fill="#8b8578" stroke="#5d594f" stroke-width="1.2"/>' // boulet
    + '<circle cx="-1.8" cy="-60.8" r="1.6" fill="#a39e90"/>' // reflet du boulet
    + '</g>';
}

function back(): string {
  // Vue de DOS : le cadre en tons ombrés, treuil à deux manivelles vers le spectateur (« on bande
  // l'engin »), le bras fuit vers le haut/loin — dos du godet plein, PAS de pierre visible.
  return '<g>'
    + `<g transform="translate(-29,-13)">${wheelEdge(26)}</g>`
    + `<g transform="translate(29,-13)">${wheelEdge(26)}</g>`
    + '<path d="M-26 -4 L26 -4" stroke="@boisO" stroke-width="7" stroke-linecap="round"/>'
    + '<path d="M-22 -4 L-15 -46 M22 -4 L15 -46" stroke="@boisO" stroke-width="7" stroke-linecap="round"/>'
    // Écheveau transversal, comme la face.
    + '<rect x="-20" y="-24" width="40" height="11" rx="5.5" fill="@corde" stroke="@cordeO" stroke-width="1.5"/>'
    + '<path d="M-11 -24 L-11 -13 M0 -24 L0 -13 M11 -24 L11 -13" stroke="@cordeO" stroke-width="1.2"/>'
    // Treuil transversal + deux manivelles vers le spectateur.
    + '<rect x="-14" y="-36" width="28" height="8" rx="3.5" fill="@bois" stroke="@fer" stroke-width="1.5"/>'
    + '<path d="M-14 -32 l-8 6 l5 4" fill="none" stroke="@fer" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'
    + '<path d="M14 -32 l8 6 l-5 4" fill="none" stroke="@fer" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'
    // Butoir matelassé en tête.
    + '<rect x="-18" y="-51" width="36" height="8" rx="4" fill="@corde" stroke="@cordeO" stroke-width="1.5"/>'
    // Fût du bras qui fuit, puis DOS du godet : disque de bois plein, lattes rayonnantes.
    + '<path d="M0 -36 L0 -52" stroke="@boisO" stroke-width="5" stroke-linecap="round"/>'
    + '<circle cx="0" cy="-58" r="8" fill="@boisO" stroke="@bois" stroke-width="2"/>'
    + '<path d="M0 -58 L0 -65 M0 -58 L-6 -62 M0 -58 L6 -62" stroke="@bois" stroke-width="1.6" stroke-linecap="round"/>'
    + '</g>';
}

export const enginArt: EnginArtDef = { id: 'mangonneau', front, profile, back };

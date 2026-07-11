/**
 * TRÉBUCHET (`trebuchet`) — grande machine à contrepoids : cadre en A sur traîneau, longue verge
 * basculante, caisse de contrepoids suspendue, fronde à pierre. Art de l'engin (3 vues), routé par
 * l'id d'espèce `trebuchet`. (Aucune illustration dédiée dans art-ref/aa-siege — silhouette canonique.)
 */
import { type EnginArtDef } from '../artkit';

function profile(): string {
  // Vue de CÔTÉ (tir vers la DROITE) : c'est LA vue signature — verge en diagonale (tip haut à
  // gauche, fronde pendante), contrepoids massif bas à droite du pivot, cadre en A + traîneau.
  return '<g>'
    // Traîneau au sol (longues poutres d'assise).
    + '<path d="M-36 -1 L36 -1 L31 -8 L-31 -8 Z" fill="@bois" stroke="@boisO" stroke-width="1.5"/>'
    // Cadre en A vu de chant : montant avant plein + jambe arrière, réunis au pivot.
    + '<path d="M-15 -8 L-5 -8 L4 -50 L-3 -50 Z" fill="@bois" stroke="@boisO" stroke-width="1.5"/>'
    + '<path d="M20 -8 L4 -50" stroke="@boisO" stroke-width="5" stroke-linecap="round"/>'
    + '<path d="M-8 -28 L13 -28" stroke="@bois" stroke-width="4" stroke-linecap="round"/>' // entretoise
    // VERGE basculante (position tirée) : longue vers le haut-gauche, courte vers le bas-droite.
    + '<path d="M26 -36 L-33 -73 L-36 -68 L24 -41 Z" fill="@bois" stroke="@boisO" stroke-width="1.5"/>'
    + '<circle cx="4" cy="-51" r="4" fill="@fer" stroke="@ferH" stroke-width="1"/>' // axe du pivot
    // CONTREPOIDS : caisse massive articulée sous le bras court, ferrures de suspension.
    + '<path d="M25 -38 L28 -33 M30 -36 L30 -33" stroke="@fer" stroke-width="2"/>'
    + '<path d="M20 -33 L38 -33 L35 -12 L23 -12 Z" fill="@boisO" stroke="@fer" stroke-width="1.5"/>'
    + '<line x1="21.5" y1="-27" x2="36.5" y2="-27" stroke="@fer" stroke-width="1.5"/>' // cerclage
    + '<line x1="22.5" y1="-18" x2="35.5" y2="-18" stroke="@fer" stroke-width="1.5"/>'
    // FRONDE : deux brins pendant du bout de la verge, poche + pierre.
    + '<path d="M-34 -70 q-2 -8 4 -14 M-34 -70 q-8 -6 -4 -14" fill="none" stroke="@cordeH" stroke-width="1.6"/>'
    + '<ellipse cx="-33" cy="-53" rx="5.5" ry="4" fill="@corde" stroke="@cordeO" stroke-width="1.5"/>'
    + '<circle cx="-33" cy="-54" r="2.8" fill="@fonteO"/>' // pierre dans la poche
    // Treuil d'armement à l'arrière du traîneau + corde de rappel vers la verge.
    + '<circle cx="-24" cy="-11" r="4.5" fill="@fonte" stroke="@fer" stroke-width="1.5"/>'
    + '<path d="M-24 -11 l6 4" stroke="@fer" stroke-width="2.5" stroke-linecap="round"/>'
    + '<path d="M-26 -14 L-32 -64" stroke="@cordeH" stroke-width="1.4" opacity="0.8"/>'
    + '</g>';
}

function front(): string {
  // De FACE (côté du tir) : deux pieds écartés, essieu haut, caisse de contrepoids suspendue au
  // centre ; la verge fuit vers le haut (fine, vue presque de bout), fronde au sommet.
  return '<g>'
    + '<path d="M-30 -1 L-6 -52 M30 -1 L6 -52" stroke="@bois" stroke-width="8" stroke-linecap="round"/>'
    + '<path d="M-20 -24 L20 -24" stroke="@bois" stroke-width="5" stroke-linecap="round"/>' // entretoise
    + '<path d="M-9 -52 L9 -52" stroke="@fer" stroke-width="4" stroke-linecap="round"/>' // essieu du pivot
    // Caisse de contrepoids suspendue entre les pieds (masse frontale dominante).
    + '<path d="M-7 -50 L-9 -44 M7 -50 L9 -44" stroke="@fer" stroke-width="2"/>'
    + '<path d="M-13 -44 L13 -44 L15 -18 L-15 -18 Z" fill="@bois" stroke="@boisO" stroke-width="1.5"/>'
    + '<line x1="-13.5" y1="-36" x2="13.5" y2="-36" stroke="@fer" stroke-width="1.5"/>' // cerclages
    + '<line x1="-14.5" y1="-25" x2="14.5" y2="-25" stroke="@fer" stroke-width="1.5"/>'
    // Verge dressée (quasi de bout) au-dessus de l'essieu + brins de fronde.
    + '<path d="M0 -52 L-3 -74" stroke="@boisO" stroke-width="5" stroke-linecap="round"/>'
    + '<path d="M-3 -74 L-8 -66 M-3 -74 L2 -66" stroke="@cordeH" stroke-width="1.5"/>'
    + '<ellipse cx="-3" cy="-64" rx="4" ry="3" fill="@corde" stroke="@cordeO" stroke-width="1.2"/>'
    + '</g>';
}

function back(): string {
  // De DOS (machine ARMÉE) : contrepoids levé au-dessus de l'essieu, verge plaquée vers le sol
  // côté spectateur (poche + pierre au ras du sol), treuil à manivelles — la vue « on charge ».
  return '<g>'
    + '<path d="M-30 -1 L-6 -52 M30 -1 L6 -52" stroke="@boisO" stroke-width="8" stroke-linecap="round"/>'
    + '<path d="M-20 -24 L20 -24" stroke="@boisO" stroke-width="5" stroke-linecap="round"/>'
    + '<path d="M-9 -52 L9 -52" stroke="@fer" stroke-width="4" stroke-linecap="round"/>' // essieu
    // Contrepoids basculé HAUT, dépassant derrière l'essieu.
    + '<path d="M-10 -74 L10 -74 L12 -55 L-12 -55 Z" fill="@boisO" stroke="@fer" stroke-width="1.5"/>'
    + '<line x1="-10.5" y1="-68" x2="10.5" y2="-68" stroke="@fer" stroke-width="1.5"/>'
    // Verge abaissée vers le spectateur : planche qui s'élargit en descendant (perspective).
    + '<path d="M-2 -52 L2 -52 L5 -12 L-5 -12 Z" fill="@bois" stroke="@boisO" stroke-width="1.5"/>'
    // Fronde étalée au sol : poche + pierre calée, brins vers le bout de verge.
    + '<path d="M-4 -12 l-4 5 M4 -12 l4 5" stroke="@cordeH" stroke-width="1.5"/>'
    + '<ellipse cx="0" cy="-6" rx="6" ry="3.5" fill="@corde" stroke="@cordeO" stroke-width="1.5"/>'
    + '<circle cx="0" cy="-7" r="3" fill="@fonteO" stroke="@fonte" stroke-width="1"/>'
    // Treuil transversal + deux manivelles vers le spectateur (armement).
    + '<rect x="-15" y="-34" width="30" height="8" rx="3" fill="@bois" stroke="@fer" stroke-width="1.5"/>'
    + '<path d="M-15 -30 l-8 6 l5 4" fill="none" stroke="@fer" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'
    + '<path d="M15 -30 l8 6 l-5 4" fill="none" stroke="@fer" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'
    + '</g>';
}

export const enginArt: EnginArtDef = { id: 'trebuchet', front, profile, back };

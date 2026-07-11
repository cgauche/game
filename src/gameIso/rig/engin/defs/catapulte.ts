/**
 * CATAPULTE (`catapulte`) — engin à bras de jet sur châssis de bois à roues : écheveau de torsion au
 * pivot, bras levé contre une traverse matelassée, godet chargé d'un boulet, treuil de bandage à
 * l'arrière. Art de l'engin (3 vues), routé par l'id d'espèce `catapulte` (sert petite/moyenne/grande
 * par l'échelle). Aucune illustration d'engin correspondante dans art-ref → silhouette canonique,
 * trait de la famille (cf. baliste/belier/canon-petit).
 */
import { type EnginArtDef, wheelFace, wheelEdge } from '../artkit';

function profile(): string {
  // Vue de CÔTÉ : LA vue signifiante — long châssis bas à roues, bras de jet en diagonale montante
  // vers l'avant (droite), arrêté par la traverse matelassée, godet + boulet à la pointe, treuil arrière.
  return '<g>'
    // Châssis : poutre latérale horizontale posée sur les essieux.
    + '<path d="M-42 -20 L34 -20 L34 -28 L-42 -28 Z" fill="@bois" stroke="@boisO" stroke-width="1.5"/>'
    + '<line x1="-30" y1="-20" x2="-30" y2="-28" stroke="@boisO" stroke-width="2" opacity="0.7"/>' // cerclage
    + '<line x1="6" y1="-20" x2="6" y2="-28" stroke="@boisO" stroke-width="2" opacity="0.7"/>'
    // Montant avant + jambe de force portant la traverse d'arrêt.
    + '<path d="M14 -28 L16 -52" stroke="@bois" stroke-width="6" stroke-linecap="round"/>'
    + '<path d="M28 -28 L18 -50" stroke="@boisO" stroke-width="4" stroke-linecap="round"/>'
    // Traverse matelassée vue de bout (le butoir du bras) : tampon de cordage.
    + '<ellipse cx="16" cy="-53" rx="6" ry="4.5" fill="@corde" stroke="@cordeO" stroke-width="1.5"/>'
    + '<path d="M11 -55 L21 -55 M10.5 -52 L21.5 -52" stroke="@cordeO" stroke-width="1"/>'
    // Écheveau de torsion au pivot, vu de bout (axe transverse → disque bobiné).
    + '<ellipse cx="-6" cy="-31" rx="6" ry="7" fill="@corde" stroke="@cordeO" stroke-width="1.5"/>'
    + '<path d="M-11 -34 L-1 -34 M-11.5 -31 L-0.5 -31 M-11 -28 L-1 -28" stroke="@cordeO" stroke-width="1"/>'
    // BRAS DE JET : diagonale du pivot vers l'avant-haut, appuyé sur la traverse.
    + '<path d="M-6 -31 L32 -59" stroke="@bois" stroke-width="6" stroke-linecap="round"/>'
    + '<path d="M-6 -31 L32 -59" stroke="@boisH" stroke-width="1.5" opacity="0.6"/>' // arête éclairée
    // Godet à la pointe + BOULET (la signature de l'engin).
    + '<path d="M26 -60 q6 6 12 1" fill="none" stroke="@fer" stroke-width="2.5" stroke-linecap="round"/>'
    + '<circle cx="32" cy="-63" r="4.5" fill="@fonte" stroke="@fer" stroke-width="1.5"/>'
    + '<circle cx="30.5" cy="-64.5" r="1.3" fill="@fonteH"/>' // reflet du boulet
    // Treuil de bandage à l'arrière : tambour + manivelle, corde courant jusqu'au bras.
    + '<circle cx="-34" cy="-33" r="5" fill="@fonte" stroke="@fer" stroke-width="1.5"/>'
    + '<path d="M-34 -33 l6 -4" stroke="@fer" stroke-width="2.5" stroke-linecap="round"/>'
    + '<path d="M-30 -36 L10 -43" stroke="@cordeH" stroke-width="1.6"/>'
    // Roues au sol (paire visible de côté, châssis de chariot).
    + `<g transform="translate(-22,-15)">${wheelFace(14)}</g>`
    + `<g transform="translate(18,-15)">${wheelFace(14)}</g>`
    + '</g>';
}

function front(): string {
  // Vue de FACE (côté jet) : cadre trapézoïdal entre deux roues de bout, écheveau transversal,
  // bras central vertical coiffé du boulet au-dessus de la traverse matelassée.
  return '<g>'
    + `<g transform="translate(-27,-17)">${wheelEdge(34)}</g>`
    + `<g transform="translate(27,-17)">${wheelEdge(34)}</g>`
    // Corps du châssis (trapèze) + entretoise.
    + '<path d="M-20 -4 L20 -4 L14 -32 L-14 -32 Z" fill="@bois" stroke="@boisO" stroke-width="1.5"/>'
    + '<path d="M-17 -14 L17 -14" stroke="@boisO" stroke-width="2"/>'
    // Écheveau de torsion TRANSVERSAL au pivot (bobinage horizontal traversé par le bras).
    + '<ellipse cx="0" cy="-33" rx="13" ry="5" fill="@corde" stroke="@cordeO" stroke-width="1.5"/>'
    + '<path d="M-7 -37.5 L-7 -28.5 M0 -38 L0 -28 M7 -37.5 L7 -28.5" stroke="@cordeO" stroke-width="1"/>'
    // Deux montants vers la traverse matelassée.
    + '<path d="M-14 -32 L-10 -55 M14 -32 L10 -55" stroke="@bois" stroke-width="6" stroke-linecap="round"/>'
    + '<rect x="-15" y="-59" width="30" height="7" rx="3.5" fill="@bois" stroke="@boisO" stroke-width="1.5"/>'
    + '<path d="M-9 -59 L-9 -52 M-2 -59 L-2 -52 M5 -59 L5 -52 M12 -59 L12 -52" stroke="@cordeO" stroke-width="1.5"/>' // matelassage cordé
    // Bras central montant derrière la traverse, godet + BOULET au sommet face au spectateur.
    + '<path d="M0 -33 L0 -58" stroke="@bois" stroke-width="6" stroke-linecap="round"/>'
    + '<circle cx="0" cy="-63" r="5.5" fill="@fonte" stroke="@fer" stroke-width="1.5"/>'
    + '<circle cx="-1.8" cy="-64.8" r="1.5" fill="@fonteH"/>'
    + '<path d="M-6 -61 q6 4 12 0" fill="none" stroke="@fer" stroke-width="2" stroke-linecap="round"/>' // lèvre du godet
    + '</g>';
}

function back(): string {
  // Vue de DOS : même cadre en contre-jour, TREUIL transversal à deux manivelles (on bande l'engin),
  // bras qui fuit vers le haut, dos du godet et boulet dépassant au sommet.
  return '<g>'
    + `<g transform="translate(-27,-17)">${wheelEdge(34)}</g>`
    + `<g transform="translate(27,-17)">${wheelEdge(34)}</g>`
    + '<path d="M-20 -4 L20 -4 L14 -32 L-14 -32 Z" fill="@boisO" stroke="@bois" stroke-width="1.5"/>'
    + '<path d="M-14 -32 L-10 -55 M14 -32 L10 -55" stroke="@boisO" stroke-width="6" stroke-linecap="round"/>'
    // Treuil transversal + deux manivelles vers le spectateur (comme la baliste vue de dos).
    + '<rect x="-16" y="-24" width="32" height="8" rx="3.5" fill="@bois" stroke="@fer" stroke-width="1.5"/>'
    + '<path d="M-16 -20 l-8 6 l6 4" fill="none" stroke="@fer" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'
    + '<path d="M16 -20 l8 6 l-6 4" fill="none" stroke="@fer" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'
    + '<path d="M0 -24 L0 -32" stroke="@cordeH" stroke-width="1.6"/>' // corde de bandage vers le pivot
    // Bras fuyant vers le haut (dos), dos du godet + boulet dépassant.
    + '<path d="M0 -32 L0 -57" stroke="@boisO" stroke-width="6" stroke-linecap="round"/>'
    + '<path d="M-6 -58 q6 -5 12 0" fill="none" stroke="@fer" stroke-width="2.5" stroke-linecap="round"/>' // dos du godet
    + '<circle cx="0" cy="-62" r="4.5" fill="@fonteO" stroke="@fer" stroke-width="1.5"/>'
    + '</g>';
}

export const enginArt: EnginArtDef = { id: 'catapulte', front, profile, back };

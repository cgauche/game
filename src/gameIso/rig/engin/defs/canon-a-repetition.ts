/**
 * CANON À RÉPÉTITION (`canon-a-repetition`) — orgue à canons : batterie de tubes de fonte parallèles
 * (3 rangées) sur affût à roues, manivelle de mise à feu à la culasse. Art de l'engin (3 vues),
 * routé par l'id d'espèce `canon-a-repetition`.
 */
import { type EnginArtDef, wheelFace, wheelEdge } from '../artkit';

function profile(): string {
  return '<g>'
    // Affût : flasque de bois haute sous la batterie, descendant en flèche au sol (arrière) — même
    // gabarit que l'affût de campagne, mais le berceau porte un BLOC de tubes, pas un tube seul.
    + '<path d="M16 -40 L30 -38 L30 -18 L-46 -2 L-50 -9 L10 -40 Z" fill="@bois" stroke="@boisO" stroke-width="1.5"/>'
    + '<path d="M-50 -9 L-46 -2" stroke="@fer" stroke-width="2"/>' // sabot de crosse ferré
    // SIGNATURE : trois tubes ÉTAGÉS (rangées de la batterie vues de chant), bouches en avant (droite).
    + '<path d="M-24 -60 L44 -62 L44 -56 L-24 -54 Z" fill="@fonte" stroke="@fer" stroke-width="1.2"/>' // tube haut
    + '<path d="M-24 -52 L46 -54 L46 -48 L-24 -46 Z" fill="@fonte" stroke="@fer" stroke-width="1.2"/>' // tube médian
    + '<path d="M-24 -44 L44 -46 L44 -40 L-24 -38 Z" fill="@fonte" stroke="@fer" stroke-width="1.2"/>' // tube bas
    + '<ellipse cx="44" cy="-59" rx="1.6" ry="3" fill="#0c0c10"/>' // âmes (bouches) — l'orgue se lit ici
    + '<ellipse cx="46" cy="-51" rx="1.6" ry="3" fill="#0c0c10"/>'
    + '<ellipse cx="44" cy="-43" rx="1.6" ry="3" fill="#0c0c10"/>'
    // Cerclages de fer qui SOLIDARISENT le faisceau (≠ astragales d'un tube unique).
    + '<path d="M-8 -61 L-8 -38 M20 -62 L20 -39" stroke="@ferH" stroke-width="3"/>'
    // Coffre de culasse (bloc de fonte fermant les trois tubes) + MANIVELLE de répétition à l'arrière.
    + '<path d="M-34 -63 L-24 -63 L-24 -36 L-34 -37 Z" fill="@fonteO" stroke="@fer" stroke-width="1.5"/>'
    + '<circle cx="-37" cy="-49" r="5" fill="@fonte" stroke="@fer" stroke-width="1.5"/>' // tambour du mécanisme
    + '<path d="M-37 -49 l-6 -6 l5 -3" fill="none" stroke="@fer" stroke-width="2.5" stroke-linecap="round"/>' // manivelle
    + '<circle cx="9" cy="-38" r="3.5" fill="@fonteO" stroke="@fer" stroke-width="1"/>' // tourillon
    + `<g transform="translate(10,-21)">${wheelFace(21)}</g>` // grande roue (côté proche), au sol
    + '</g>';
}

function front(): string {
  return '<g>'
    + `<g transform="translate(-33,-20)">${wheelEdge(40)}</g>` // roues de bout (flanquantes)
    + `<g transform="translate(33,-20)">${wheelEdge(40)}</g>`
    + '<path d="M-22 -4 L22 -4 L16 -36 L-16 -36 Z" fill="@bois" stroke="@boisO" stroke-width="1.5"/>' // corps d'affût (trapèze)
    + '<path d="M-19 -15 L19 -15" stroke="@boisO" stroke-width="2"/>'
    // SIGNATURE : plaque de volée carrée + GRILLE 3×3 de bouches (l'orgue à canons se nomme d'un coup d'œil).
    + '<rect x="-19" y="-63" width="38" height="30" rx="4" fill="@fonte" stroke="@fer" stroke-width="2"/>'
    + '<rect x="-19" y="-63" width="38" height="30" rx="4" fill="none" stroke="@fonteH" stroke-width="1.2"/>'
    + '<circle cx="-11" cy="-56" r="4" fill="#0c0c10" stroke="@fonteH" stroke-width="1"/><circle cx="0" cy="-56" r="4" fill="#0c0c10" stroke="@fonteH" stroke-width="1"/><circle cx="11" cy="-56" r="4" fill="#0c0c10" stroke="@fonteH" stroke-width="1"/>'
    + '<circle cx="-11" cy="-48" r="4" fill="#0c0c10" stroke="@fonteH" stroke-width="1"/><circle cx="0" cy="-48" r="4" fill="#0c0c10" stroke="@fonteH" stroke-width="1"/><circle cx="11" cy="-48" r="4" fill="#0c0c10" stroke="@fonteH" stroke-width="1"/>'
    + '<circle cx="-11" cy="-40" r="4" fill="#0c0c10" stroke="@fonteH" stroke-width="1"/><circle cx="0" cy="-40" r="4" fill="#0c0c10" stroke="@fonteH" stroke-width="1"/><circle cx="11" cy="-40" r="4" fill="#0c0c10" stroke="@fonteH" stroke-width="1"/>'
    + '<circle cx="-13" cy="-58" r="1.4" fill="#26242a"/>' // reflet d'âme (coin haut-gauche)
    + '</g>';
}

function back(): string {
  return '<g>'
    + `<g transform="translate(-33,-20)">${wheelEdge(40)}</g>`
    + `<g transform="translate(33,-20)">${wheelEdge(40)}</g>`
    + '<path d="M-7 -6 L7 -6 L4 -46 L-4 -46 Z" fill="@bois" stroke="@boisO" stroke-width="1.5"/>' // flèche d'affût fuyante
    + '<path d="M-20 -6 L20 -6 L15 -34 L-15 -34 Z" fill="@boisO" stroke="@fer" stroke-width="1.5"/>' // corps d'affût (dos)
    // Coffre de culasse (dos de la batterie) : plaque carrée + grille des 9 obturateurs (boutons).
    + '<rect x="-17" y="-60" width="34" height="27" rx="4" fill="@fonteO" stroke="@fer" stroke-width="2"/>'
    + '<circle cx="-10" cy="-54" r="2.6" fill="@fonteH"/><circle cx="0" cy="-54" r="2.6" fill="@fonteH"/><circle cx="10" cy="-54" r="2.6" fill="@fonteH"/>'
    + '<circle cx="-10" cy="-46" r="2.6" fill="@fonteH"/><circle cx="0" cy="-46" r="2.6" fill="@fonteH"/><circle cx="10" cy="-46" r="2.6" fill="@fonteH"/>'
    + '<circle cx="-10" cy="-38" r="2.6" fill="@fonteH"/><circle cx="0" cy="-38" r="2.6" fill="@fonteH"/><circle cx="10" cy="-38" r="2.6" fill="@fonteH"/>'
    // MANIVELLE de répétition vers le spectateur (côté droit du coffre) — la vue « on tourne, ça tire ».
    + '<circle cx="21" cy="-46" r="4.5" fill="@fonte" stroke="@fer" stroke-width="1.5"/>'
    + '<path d="M21 -46 l8 6 l-5 4" fill="none" stroke="@fer" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'
    + '</g>';
}

export const enginArt: EnginArtDef = { id: 'canon-a-repetition', front, profile, back };

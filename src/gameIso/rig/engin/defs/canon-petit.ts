/**
 * CANON DE REMPART (`canon-petit`) — tube de fonte sur affût à roues. Art de l'engin (3 vues), routé par
 * l'id d'espèce `canon-petit` (les canons moyen/grand & autres affûts à roues sans art propre y retombent).
 */
import { type EnginArtDef, wheelFace, wheelEdge } from '../artkit';

function profile(): string {
  return '<g>'
    // Affût : flasque de bois (planche latérale), haut sous le tube, descendant en flèche au sol (arrière).
    + '<path d="M14 -44 L28 -42 L28 -20 L-48 -2 L-52 -9 L8 -44 Z" fill="@bois" stroke="@boisO" stroke-width="1.5"/>'
    + '<path d="M-52 -9 L-48 -2" stroke="@fer" stroke-width="2"/>' // sabot de crosse ferré
    // Tube de fonte (culasse à gauche / bouche à droite), légère élévation.
    + '<path d="M-30 -40 Q-36 -40 -36 -46 Q-36 -52 -30 -52 L46 -56 L52 -56 L52 -44 L46 -44 Z" fill="@fonte" stroke="@fer" stroke-width="1.5"/>'
    + '<line x1="-6" y1="-52.5" x2="-6" y2="-40.5" stroke="@fonteH" stroke-width="3"/>' // astragale (renfort)
    + '<line x1="22" y1="-54.5" x2="22" y2="-42.5" stroke="@fonteH" stroke-width="3"/>'
    + '<ellipse cx="52" cy="-50" rx="2" ry="5.5" fill="#0c0c10"/>' // âme (bouche)
    + '<circle cx="-39" cy="-46" r="4.5" fill="@fonte" stroke="@fer" stroke-width="1.5"/>' // bouton de culasse
    + '<circle cx="9" cy="-43" r="3.5" fill="@fonteO" stroke="@fer" stroke-width="1"/>' // tourillon
    + `<g transform="translate(12,-22)">${wheelFace(22)}</g>` // grande roue (côté proche), au sol
    + '</g>';
}

function front(): string {
  return '<g>'
    + `<g transform="translate(-34,-21)">${wheelEdge(42)}</g>` // roues de bout (flanquantes)
    + `<g transform="translate(34,-21)">${wheelEdge(42)}</g>`
    + '<path d="M-22 -4 L22 -4 L15 -42 L-15 -42 Z" fill="@bois" stroke="@boisO" stroke-width="1.5"/>' // corps d'affût (trapèze)
    + '<path d="M-18 -16 L18 -16" stroke="@boisO" stroke-width="2"/>'
    + '<circle cx="0" cy="-44" r="16" fill="@fonte" stroke="@fer" stroke-width="2"/>' // volée vue de bouche
    + '<circle cx="0" cy="-44" r="16" fill="none" stroke="@fonteH" stroke-width="2"/>'
    + '<circle cx="0" cy="-44" r="8.5" fill="#0c0c10"/>' // âme
    + '<circle cx="-4.5" cy="-48" r="3" fill="#26242a"/>' // reflet d'âme
    + '</g>';
}

function back(): string {
  return '<g>'
    + `<g transform="translate(-34,-21)">${wheelEdge(42)}</g>`
    + `<g transform="translate(34,-21)">${wheelEdge(42)}</g>`
    + '<path d="M-7 -6 L7 -6 L4 -50 L-4 -50 Z" fill="@bois" stroke="@boisO" stroke-width="1.5"/>' // flèche d'affût fuyante
    + '<path d="M-20 -6 L20 -6 L14 -38 L-14 -38 Z" fill="@boisO" stroke="@fer" stroke-width="1.5"/>' // corps d'affût (dos)
    + '<circle cx="0" cy="-40" r="14" fill="@fonte" stroke="@fer" stroke-width="2"/>' // culasse (dos du tube)
    + '<circle cx="0" cy="-40" r="6" fill="@fonteH" stroke="@fer" stroke-width="1.5"/>' // bouton de culasse
    + '<circle cx="0" cy="-52" r="2" fill="#0c0c10"/>' // lumière (mise à feu)
    + '</g>';
}

export const enginArt: EnginArtDef = { id: 'canon-petit', front, profile, back };

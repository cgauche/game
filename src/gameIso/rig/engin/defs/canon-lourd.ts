/**
 * CANON LOURD (`canon-lourd`) — grande pièce d'artillerie impériale : tube long à bouche en tulipe et
 * dauphins de levage, sur affût massif à deux grandes roues cerclées, crosse longue au sol. Art de
 * l'engin (3 vues), routé par l'id d'espèce `canon-lourd`.
 */
import { type EnginArtDef, wheelFace, wheelEdge } from '../artkit';

function profile(): string {
  return '<g>'
    // Affût : flasque de bois massive, haute sous le tube, longue crosse descendant au sol (arrière).
    + '<path d="M18 -50 L34 -47 L34 -22 L-58 -2 L-63 -10 L10 -50 Z" fill="@bois" stroke="@boisO" stroke-width="1.5"/>'
    + '<path d="M-63 -10 L-58 -2" stroke="@fer" stroke-width="2.5"/>' // sabot de crosse ferré
    // Pile de boulets au pied de la crosse (marqueur « grosse artillerie »).
    + '<circle cx="-49" cy="-5" r="4.5" fill="@fonte" stroke="@fer" stroke-width="1"/>'
    + '<circle cx="-40" cy="-5" r="4.5" fill="@fonte" stroke="@fer" stroke-width="1"/>'
    + '<circle cx="-44.5" cy="-12" r="4.5" fill="@fonteO" stroke="@fer" stroke-width="1"/>'
    // Tube LONG (culasse à gauche / bouche à droite), volée en tulipe à la bouche.
    + '<path d="M-32 -45 Q-40 -45 -40 -53 Q-40 -61 -32 -61 L52 -59.5 L56 -63 L68 -62 L68 -44 L56 -43 L52 -46.5 Z" fill="@fonte" stroke="@fer" stroke-width="1.5"/>'
    + '<line x1="-8" y1="-60.5" x2="-8" y2="-45.5" stroke="@fonteH" stroke-width="3.5"/>' // astragales (renforts)
    + '<line x1="20" y1="-60" x2="20" y2="-46" stroke="@fonteH" stroke-width="3.5"/>'
    + '<line x1="40" y1="-59.5" x2="40" y2="-46.5" stroke="@fonteH" stroke-width="3"/>'
    // Dauphins de levage sur le dessus du tube (signature des grosses pièces).
    + '<path d="M-16 -61 q5 -7 10 0 M0 -61 q5 -7 10 0" fill="none" stroke="@fonte" stroke-width="3" stroke-linecap="round"/>'
    + '<ellipse cx="68" cy="-53" rx="2.5" ry="6.5" fill="#0c0c10"/>' // âme (bouche)
    + '<circle cx="-44" cy="-53" r="5.5" fill="@fonte" stroke="@fer" stroke-width="1.5"/>' // bouton de culasse
    + '<circle cx="12" cy="-47" r="4" fill="@fonteO" stroke="@fer" stroke-width="1"/>' // tourillon
    + `<g transform="translate(14,-28)">${wheelFace(28)}</g>` // très grande roue (côté proche), au sol
    + '</g>';
}

function front(): string {
  return '<g>'
    + `<g transform="translate(-40,-26)">${wheelEdge(52)}</g>` // grandes roues de bout (flanquantes)
    + `<g transform="translate(40,-26)">${wheelEdge(52)}</g>`
    + '<path d="M-26 -4 L26 -4 L18 -48 L-18 -48 Z" fill="@bois" stroke="@boisO" stroke-width="1.5"/>' // corps d'affût (trapèze)
    + '<path d="M-22 -18 L22 -18" stroke="@boisO" stroke-width="2.5"/>'
    // Volée en tulipe vue de bouche : gueule LARGE.
    + '<circle cx="0" cy="-52" r="20" fill="@fonte" stroke="@fer" stroke-width="2.5"/>'
    + '<circle cx="0" cy="-52" r="20" fill="none" stroke="@fonteH" stroke-width="2.5"/>'
    + '<circle cx="0" cy="-52" r="11" fill="#0c0c10"/>' // âme béante
    + '<circle cx="-5.5" cy="-57" r="3.5" fill="#26242a"/>' // reflet d'âme
    + '<path d="M-7 -71 q7 -5 14 0" fill="none" stroke="@fonte" stroke-width="3" stroke-linecap="round"/>' // dauphin en crête
    + '</g>';
}

function back(): string {
  return '<g>'
    + `<g transform="translate(-40,-26)">${wheelEdge(52)}</g>`
    + `<g transform="translate(40,-26)">${wheelEdge(52)}</g>`
    + '<path d="M-8 -6 L8 -6 L5 -56 L-5 -56 Z" fill="@bois" stroke="@boisO" stroke-width="1.5"/>' // flèche d'affût fuyante
    + '<path d="M-24 -6 L24 -6 L17 -44 L-17 -44 Z" fill="@boisO" stroke="@fer" stroke-width="1.5"/>' // corps d'affût (dos)
    + '<circle cx="0" cy="-46" r="17" fill="@fonte" stroke="@fer" stroke-width="2.5"/>' // culasse (dos du tube)
    + '<circle cx="0" cy="-46" r="7" fill="@fonteH" stroke="@fer" stroke-width="1.5"/>' // bouton de culasse
    + '<circle cx="0" cy="-61" r="2.5" fill="#0c0c10"/>' // lumière (mise à feu)
    + '<path d="M-13 -58 q6 -6 13 -3" fill="none" stroke="@fonte" stroke-width="2.5" stroke-linecap="round"/>' // dauphin visible de dos
    + '</g>';
}

export const enginArt: EnginArtDef = { id: 'canon-lourd', front, profile, back };

/**
 * CANON À FLAMMES NAIN (`canon-a-flammes`) — chaudière de fonte rivetée sous pression sur affût à roues,
 * tube-lance évasé en trompette crachant une flamme-pilote, pompe de mise en pression à l'arrière.
 * Art de l'engin (3 vues), routé par l'id d'espèce `canon-a-flammes`.
 */
import { type EnginArtDef, wheelFace, wheelEdge } from '../artkit';

/** Flamme-pilote (accent NON-jeton : le feu ne se teinte pas à la palette de l'engin). */
const FLAME_OUT = '#d96a1a';
const FLAME_IN = '#f2b53a';

function profile(): string {
  return '<g>'
    // Affût bas : sommier de bois massif portant la chaudière, sabot ferré à l'arrière.
    + '<path d="M-46 -14 L34 -14 L34 -26 L-42 -26 L-48 -6 Z" fill="@bois" stroke="@boisO" stroke-width="1.5"/>'
    + '<path d="M-48 -6 L-42 -26" stroke="@fer" stroke-width="2"/>'
    // CHAUDIÈRE : gros cylindre horizontal riveté (la masse qui dit « nain »), calée à l'arrière.
    + '<rect x="-42" y="-56" width="42" height="30" rx="7" fill="@fonte" stroke="@fer" stroke-width="1.5"/>'
    + '<ellipse cx="-40" cy="-41" rx="5" ry="15" fill="@fonteO" stroke="@fer" stroke-width="1.5"/>' // fond bombé arrière
    + '<line x1="-28" y1="-55" x2="-28" y2="-27" stroke="@fonteH" stroke-width="2"/>' // cerclages rivetés
    + '<line x1="-12" y1="-55" x2="-12" y2="-27" stroke="@fonteH" stroke-width="2"/>'
    + '<circle cx="-28" cy="-52" r="1.2" fill="@ferH"/><circle cx="-28" cy="-41" r="1.2" fill="@ferH"/><circle cx="-28" cy="-30" r="1.2" fill="@ferH"/>' // rivets
    + '<circle cx="-12" cy="-52" r="1.2" fill="@ferH"/><circle cx="-12" cy="-41" r="1.2" fill="@ferH"/><circle cx="-12" cy="-30" r="1.2" fill="@ferH"/>'
    // Dôme de pression + soupape sur le dessus de la chaudière.
    + '<path d="M-26 -56 Q-26 -63 -20 -63 Q-14 -63 -14 -56 Z" fill="@fonte" stroke="@fer" stroke-width="1.5"/>'
    + '<line x1="-20" y1="-63" x2="-20" y2="-67" stroke="@fer" stroke-width="2"/>'
    + '<circle cx="-20" cy="-68" r="2.2" fill="@ferH" stroke="@fer" stroke-width="1"/>' // soupape
    // POMPE de mise en pression : levier incliné vers l'arrière + poignée.
    + '<path d="M-38 -56 L-52 -70" stroke="@fer" stroke-width="2.5" stroke-linecap="round"/>'
    + '<path d="M-56 -66 L-48 -74" stroke="@bois" stroke-width="3.5" stroke-linecap="round"/>' // poignée en T
    // TUBE-LANCE : fin (≠ volée de canon), jaillit du front de la chaudière, évasé en trompette.
    + '<path d="M0 -50 L36 -51 L36 -43 L0 -42 Z" fill="@fonte" stroke="@fer" stroke-width="1.5"/>'
    + '<line x1="14" y1="-50.5" x2="14" y2="-42.5" stroke="@fonteH" stroke-width="2"/>' // bague
    + '<path d="M36 -51 L48 -56 L48 -38 L36 -43 Z" fill="@fonte" stroke="@fer" stroke-width="1.5"/>' // pavillon évasé
    + '<ellipse cx="48" cy="-47" rx="2.2" ry="9" fill="#0c0c10"/>' // gueule
    + '<path d="M12 -42 L18 -26" stroke="@fer" stroke-width="2.5"/>' // béquille du tube
    // FLAMME-PILOTE à la gueule : la signature de l'engin.
    + `<path d="M49 -47 q6 -5 11 -1 q-4 1 -3 4 q-5 2 -8 -3 Z" fill="${FLAME_OUT}"/>`
    + `<path d="M50 -47 q4 -2 6 0 q-3 1 -2 3 q-3 0 -4 -3 Z" fill="${FLAME_IN}"/>`
    + `<g transform="translate(6,-20)">${wheelFace(19)}</g>` // roue au sol (côté proche)
    + '</g>';
}

function front(): string {
  return '<g>'
    + `<g transform="translate(-30,-20)">${wheelEdge(38)}</g>` // roues de bout (flanquantes)
    + `<g transform="translate(30,-20)">${wheelEdge(38)}</g>`
    + '<path d="M-22 -4 L22 -4 L16 -30 L-16 -30 Z" fill="@bois" stroke="@boisO" stroke-width="1.5"/>' // corps d'affût
    // Chaudière derrière : disque massif débordant largement autour du tube.
    + '<circle cx="0" cy="-44" r="19" fill="@fonteO" stroke="@fer" stroke-width="2"/>'
    + '<circle cx="0" cy="-44" r="19" fill="none" stroke="@fonteH" stroke-width="1.2" stroke-dasharray="2.5 4"/>' // couronne de rivets
    + '<path d="M-6 -62 Q-6 -68 0 -68 Q6 -68 6 -62 Z" fill="@fonte" stroke="@fer" stroke-width="1.5"/>' // dôme au sommet
    + '<line x1="0" y1="-68" x2="0" y2="-71" stroke="@fer" stroke-width="2"/>'
    // Pavillon en trompette face au spectateur (≠ volée circulaire du canon : cône évasé + gueule fine).
    + '<circle cx="0" cy="-44" r="11" fill="@fonte" stroke="@fer" stroke-width="2"/>'
    + '<circle cx="0" cy="-44" r="11" fill="none" stroke="@fonteH" stroke-width="1.5"/>'
    + '<circle cx="0" cy="-44" r="5" fill="#0c0c10"/>' // gueule étroite
    // Langues de la flamme-pilote léchant le bord de la gueule.
    + `<path d="M-3 -46 q-3 -6 1 -9 q0 4 3 5 q3 -4 6 -1 q-4 2 -3 6 q-4 2 -7 -1 Z" fill="${FLAME_OUT}"/>`
    + `<path d="M-1 -45 q-1 -4 2 -6 q0 3 2 4 q-1 3 -4 2 Z" fill="${FLAME_IN}"/>`
    + '</g>';
}

function back(): string {
  return '<g>'
    + `<g transform="translate(-30,-20)">${wheelEdge(38)}</g>`
    + `<g transform="translate(30,-20)">${wheelEdge(38)}</g>`
    + '<path d="M-22 -4 L22 -4 L16 -30 L-16 -30 Z" fill="@boisO" stroke="@fer" stroke-width="1.5"/>' // corps d'affût (dos)
    // Fond de chaudière : gros disque riveté (aucune gueule — tout est plein, vu de dos).
    + '<circle cx="0" cy="-42" r="20" fill="@fonte" stroke="@fer" stroke-width="2"/>'
    + '<circle cx="0" cy="-42" r="15" fill="none" stroke="@fonteH" stroke-width="1.2" stroke-dasharray="2.5 4"/>' // couronne de rivets
    // Volant de purge central (roue à croisillon).
    + '<circle cx="0" cy="-42" r="6.5" fill="@fonteO" stroke="@ferH" stroke-width="1.5"/>'
    + '<path d="M-6 -42 L6 -42 M0 -48 L0 -36" stroke="@ferH" stroke-width="1.5"/>'
    // Dôme + soupape dépassant au sommet.
    + '<path d="M-6 -61 Q-6 -67 0 -67 Q6 -67 6 -61 Z" fill="@fonte" stroke="@fer" stroke-width="1.5"/>'
    + '<circle cx="0" cy="-69" r="2" fill="@ferH" stroke="@fer" stroke-width="1"/>'
    // Levier de pompe vers le spectateur (la vue « on met en pression ») : bras + poignée en T.
    + '<path d="M14 -56 L26 -66" stroke="@fer" stroke-width="2.5" stroke-linecap="round"/>'
    + '<path d="M22 -70 L30 -62" stroke="@bois" stroke-width="3.5" stroke-linecap="round"/>'
    + '</g>';
}

export const enginArt: EnginArtDef = { id: 'canon-a-flammes', front, profile, back };

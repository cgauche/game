/**
 * BÉLIER DE SIÈGE (`belier`) — tronc d'arbre massif suspendu par des chaînes à un portique en bois à
 * roues (ADE II ch.08 l.258). Art de l'engin (3 vues), routé par l'id d'espèce `belier`.
 */
import { type EnginArtDef, wheelFace, wheelEdge } from '../artkit';

function profile(): string {
  return '<g>'
    // Portique : deux montants inclinés (A-frame vu de côté, les deux pieds se confondent) + traverse haute.
    + '<path d="M-30 -1 L-8 -58 M22 -1 L2 -58" stroke="@bois" stroke-width="7" stroke-linecap="round"/>'
    + '<path d="M-14 -50 L8 -52" stroke="@bois" stroke-width="6" stroke-linecap="round"/>' // traverse (linteau)
    // Chaînes de suspension (deux brins) du linteau au tronc.
    + '<path d="M-9 -49 L-6 -30 M2 -50 L4 -30" stroke="@fer" stroke-width="2"/>'
    + '<circle cx="-9" cy="-49" r="2" fill="@fer"/><circle cx="2" cy="-50" r="2" fill="@fer"/>'
    // Tronc massif suspendu, horizontal, tête ferrée pointue vers l'avant (droite).
    + '<path d="M-34 -32 L38 -28 L38 -20 L-34 -24 Z" fill="@bois" stroke="@boisO" stroke-width="1.5"/>'
    + '<path d="M38 -28 L48 -24 L38 -20 Z" fill="@fer" stroke="@ferH" stroke-width="1"/>' // pointe/tête ferrée
    + '<line x1="-20" y1="-31" x2="-20" y2="-25" stroke="@boisO" stroke-width="2" opacity="0.7"/>' // cerclage
    + '<line x1="0" y1="-30" x2="0" y2="-24" stroke="@boisO" stroke-width="2" opacity="0.7"/>'
    // Roue au sol (côté proche).
    + `<g transform="translate(-4,-22)">${wheelFace(20)}</g>`
    + '</g>';
}

function front(): string {
  return '<g>'
    // Portique : deux pieds écartés + linteau, comme les affûts à roues existants.
    + '<path d="M-30 -1 L-6 -56 M30 -1 L6 -56" stroke="@bois" stroke-width="8" stroke-linecap="round"/>'
    + '<path d="M-18 -44 L18 -44" stroke="@bois" stroke-width="6" stroke-linecap="round"/>' // entretoise basse
    + '<path d="M-8 -55 L8 -55" stroke="@bois" stroke-width="7" stroke-linecap="round"/>' // linteau haut
    // Chaînes vers le tronc (vu de bout : cercle massif, tête ferrée face au spectateur).
    + '<path d="M-6 -54 L-6 -30 M6 -54 L6 -30" stroke="@fer" stroke-width="2"/>'
    + '<circle cx="0" cy="-28" r="17" fill="@bois" stroke="@boisO" stroke-width="2"/>'
    + '<circle cx="0" cy="-28" r="9" fill="@fer" stroke="@ferH" stroke-width="1.5"/>' // tête ferrée
    + `<g transform="translate(-22,-21)">${wheelEdge(40)}</g>`
    + `<g transform="translate(22,-21)">${wheelEdge(40)}</g>`
    + '</g>';
}

function back(): string {
  return '<g>'
    + '<path d="M-30 -1 L-6 -56 M30 -1 L6 -56" stroke="@boisO" stroke-width="8" stroke-linecap="round"/>'
    + '<path d="M-18 -44 L18 -44" stroke="@boisO" stroke-width="6" stroke-linecap="round"/>'
    + '<path d="M-8 -55 L8 -55" stroke="@boisO" stroke-width="7" stroke-linecap="round"/>'
    + '<path d="M-6 -54 L-6 -30 M6 -54 L6 -30" stroke="@fer" stroke-width="2"/>'
    // Vu de dos : le tronc plein, pas de tête ferrée visible (à l'arrière).
    + '<circle cx="0" cy="-28" r="17" fill="@boisO" stroke="@bois" stroke-width="2"/>'
    + '<line x1="-9" y1="-33" x2="9" y2="-33" stroke="@bois" stroke-width="2" opacity="0.6"/>'
    + `<g transform="translate(-22,-21)">${wheelEdge(40)}</g>`
    + `<g transform="translate(22,-21)">${wheelEdge(40)}</g>`
    + '</g>';
}

export const enginArt: EnginArtDef = { id: 'belier', front, profile, back };

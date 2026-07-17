/**
 * BÉLIER DE SIÈGE (`belier`) — tronc d'arbre massif suspendu par des chaînes à un portique en bois à
 * roues (ADE II 8 l.258). Silhouette canonique : galerie roulante à toit de protection (planches
 * + peaux clouées), tronc ferré battant sous la faîtière, roues PLEINES. Tête ferrée hérissée de
 * pointes d'après l'illustration AA (art-ref/aa-siege/page146_img1_448x496.png, « tête de bélier »).
 * Art de l'engin (3 vues), routé par l'id d'espèce `belier`.
 */
import { type EnginArtDef, wheelEdge } from '../artkit';

/** Roue PLEINE (disque de madriers cerclé de fer), vue de face — signature « engin », pas chariot. */
const solidWheel = (r: number): string =>
  `<g><circle r="${r}" fill="@bois" stroke="@fer" stroke-width="${r * 0.24}"/>`
  + `<circle r="${r}" fill="none" stroke="@ferH" stroke-width="1.2"/>`
  + `<path d="M${-r * 0.38} ${-r * 0.85} L${-r * 0.38} ${r * 0.85} M${r * 0.38} ${-r * 0.85} L${r * 0.38} ${r * 0.85}" stroke="@boisO" stroke-width="2"/>`
  + `<circle r="${r * 0.26}" fill="@fer"/><circle r="${r * 0.1}" fill="@ferH"/></g>`;

/** Brin de CHAÎNE (maillons suggérés par le pointillé) entre deux points. */
const chain = (x1: number, y1: number, x2: number, y2: number): string =>
  `<path d="M${x1} ${y1} L${x2} ${y2}" stroke="@fer" stroke-width="2" stroke-dasharray="2.6 1.6"/>`
  + `<circle cx="${x1}" cy="${y1}" r="1.8" fill="@fer"/>`;

function profile(): string {
  // Vue de CÔTÉ (tête vers la DROITE) : LA vue maîtresse — longue galerie couverte, toit de planches
  // rapiécé de peaux, tronc horizontal suspendu qui déborde du toit, tête de fer à pointes.
  return '<g>'
    // Semelle du châssis : longue poutre d'assise posée sur les essieux.
    + '<path d="M-44 -18 L38 -18 L38 -25 L-44 -25 Z" fill="@bois" stroke="@boisO" stroke-width="1.5"/>'
    // Montants du portique (avant/arrière) + jambes de force en croix (contreventement).
    + '<path d="M-36 -25 L-33 -47 M28 -25 L25 -47" stroke="@bois" stroke-width="6" stroke-linecap="round"/>'
    + '<path d="M-33 -27 L24 -45 M25 -27 L-32 -45" stroke="@boisO" stroke-width="3" stroke-linecap="round"/>'
    // TOIT de protection : pan de planches (trapèze, faîtière en haut), débords aux deux bouts.
    + '<path d="M-48 -46 L46 -46 L41 -58 L-43 -58 Z" fill="@bois" stroke="@boisO" stroke-width="1.5"/>'
    + '<path d="M-34 -46.5 L-36 -57.5 M-18 -46.5 L-20 -57.5 M-2 -46.5 L-4 -57.5 M14 -46.5 L12 -57.5 M30 -46.5 L28 -57.5" stroke="@boisO" stroke-width="1.5" opacity="0.8"/>' // joints de planches
    // Peaux clouées sur le toit (protection contre le feu) : deux pièces irrégulières + clous.
    + '<path d="M-30 -47.5 Q-24 -56 -12 -55.5 Q-8 -50 -14 -47.5 Z" fill="@corde" stroke="@cordeO" stroke-width="1.2"/>'
    + '<path d="M8 -48 Q12 -56.5 24 -56 Q28 -51 20 -47.8 Z" fill="@corde" stroke="@cordeO" stroke-width="1.2"/>'
    + '<circle cx="-27" cy="-49" r="0.9" fill="@fer"/><circle cx="-14" cy="-53" r="0.9" fill="@fer"/><circle cx="11" cy="-50" r="0.9" fill="@fer"/><circle cx="23" cy="-54" r="0.9" fill="@fer"/>'
    // Chaînes de suspension (trois brins) tombant de la sablière au tronc.
    + chain(-24, -46, -22, -36) + chain(-2, -46, 0, -35.5) + chain(20, -46, 22, -35)
    // TRONC massif horizontal, cerclé de fer, cul rond à l'arrière (prise d'élan des servants).
    + '<path d="M-40 -37.5 L36 -35.5 L36 -28 L-40 -30 Z" fill="@bois" stroke="@boisO" stroke-width="1.5"/>'
    + '<path d="M-40 -37.5 Q-44 -34 -40 -30" fill="@bois" stroke="@boisO" stroke-width="1.5"/>' // cul arrondi
    + '<line x1="-22" y1="-36.8" x2="-22" y2="-29.6" stroke="@fer" stroke-width="2"/>' // cerclages ferrés
    + '<line x1="0" y1="-36.2" x2="0" y2="-29" stroke="@fer" stroke-width="2"/>'
    + '<line x1="22" y1="-35.7" x2="22" y2="-28.4" stroke="@fer" stroke-width="2"/>'
    + '<path d="M-33 -36 L-30 -30.5 M-30 -36.4 L-27 -30.7" stroke="@corde" stroke-width="1.6"/>' // poignées de corde
    // TÊTE DE FER à pointes (réf AA) : coiffe ferrée débordant du toit, hérissée, rivetée.
    + '<path d="M36 -36.5 L48 -35 L52 -32 L48 -28.5 L36 -27 Z" fill="@fer" stroke="@ferH" stroke-width="1.2"/>'
    + '<path d="M41 -35.9 l1.6 -4.6 l2.4 4.2 M52 -32 l6 0 l-5.6 2.4 M42 -27.6 l1.6 4.6 l2.4 -4.2" fill="@fer" stroke="@ferH" stroke-width="1"/>' // pointes haut/avant/bas
    + '<circle cx="39" cy="-32" r="1.2" fill="@ferH"/><circle cx="45" cy="-31.8" r="1.2" fill="@ferH"/>' // rivets
    // Roues PLEINES au sol (paire visible du côté proche).
    + `<g transform="translate(-28,-12)">${solidWheel(12)}</g>`
    + `<g transform="translate(22,-12)">${solidWheel(12)}</g>`
    + '</g>';
}

function front(): string {
  // Vue de FACE : le pignon du toit en triangle, et au centre la TÊTE ferrée hérissée qui regarde
  // le spectateur — le disque à pointes radiales (réf AA), lecture « bélier » immédiate.
  return '<g>'
    + `<g transform="translate(-27,-15)">${wheelEdge(30)}</g>`
    + `<g transform="translate(27,-15)">${wheelEdge(30)}</g>`
    // Pieds du portique + semelle transversale.
    + '<path d="M-26 -2 L-15 -44 M26 -2 L15 -44" stroke="@bois" stroke-width="7" stroke-linecap="round"/>'
    + '<path d="M-20 -16 L20 -16" stroke="@bois" stroke-width="5" stroke-linecap="round"/>'
    // Pignon du toit : deux versants en triangle + remplissage de planches sous les débords.
    + '<path d="M-30 -42 L0 -62 L30 -42 L26 -39 L0 -57 L-26 -39 Z" fill="@bois" stroke="@boisO" stroke-width="1.5"/>'
    + '<path d="M-23 -41 L0 -56 L23 -41 Z" fill="@boisO" stroke="@bois" stroke-width="1"/>'
    + '<path d="M-12 -43 L-12 -49.5 M0 -42.5 L0 -55 M12 -43 L12 -49.5" stroke="@bois" stroke-width="1.5" opacity="0.8"/>' // planches du pignon
    // Chaînes de part et d'autre de la tête, tombant du pignon.
    + chain(-9, -44, -11, -33) + chain(9, -44, 11, -33)
    // TÊTE ferrée de bout : disque de fer riveté hérissé de pointes radiales (sphère à piques AA).
    + '<path d="M0 -48 l3 6 l-6 0 Z M13.5 -39 l6.5 -3 l-3.5 6.2 Z M16 -26.5 l7 1.5 l-5.5 4.5 Z M0 -12.5 l3.2 -6 l-6.4 0 Z M-13.5 -39 l-6.5 -3 l3.5 6.2 Z M-16 -26.5 l-7 1.5 l5.5 4.5 Z" fill="@fer" stroke="@ferH" stroke-width="0.8"/>'
    + '<circle cx="0" cy="-30" r="15" fill="@fer" stroke="@ferH" stroke-width="1.5"/>'
    + '<path d="M-14 -35 A15 15 0 0 1 14 -35 M-14 -25 A15 15 0 0 0 14 -25" fill="none" stroke="@ferH" stroke-width="1.8"/>' // bandes de renfort croisées
    + '<circle cx="0" cy="-30" r="4.5" fill="@ferH" stroke="@fer" stroke-width="1"/>' // bossage central
    + '<circle cx="-8" cy="-33" r="1.1" fill="@ferH"/><circle cx="8" cy="-33" r="1.1" fill="@ferH"/><circle cx="-8" cy="-26" r="1.1" fill="@ferH"/><circle cx="8" cy="-26" r="1.1" fill="@ferH"/>' // rivets
    + '</g>';
}

function back(): string {
  // Vue de DOS : même pignon en contre-jour, cul de tronc en bois nu cordé — c'est ici que poussent
  // les servants (barres de manœuvre transversales), aucune ferrure de tête visible.
  return '<g>'
    + `<g transform="translate(-27,-15)">${wheelEdge(30)}</g>`
    + `<g transform="translate(27,-15)">${wheelEdge(30)}</g>`
    + '<path d="M-26 -2 L-15 -44 M26 -2 L15 -44" stroke="@boisO" stroke-width="7" stroke-linecap="round"/>'
    + '<path d="M-20 -16 L20 -16" stroke="@boisO" stroke-width="5" stroke-linecap="round"/>'
    + '<path d="M-30 -42 L0 -62 L30 -42 L26 -39 L0 -57 L-26 -39 Z" fill="@boisO" stroke="@bois" stroke-width="1.5"/>'
    + '<path d="M-23 -41 L0 -56 L23 -41 Z" fill="@bois" stroke="@boisO" stroke-width="1"/>'
    + chain(-9, -44, -11, -33) + chain(9, -44, 11, -33)
    // Barres de manœuvre transversales (prises des servants), traversant le tronc.
    + '<path d="M-24 -36 L24 -36 M-21 -25 L21 -25" stroke="@bois" stroke-width="3.5" stroke-linecap="round"/>'
    // Cul du tronc : bois de bout (cernes) + frette de corde anti-éclatement.
    + '<circle cx="0" cy="-30" r="14" fill="@boisO" stroke="@bois" stroke-width="2"/>'
    + '<circle cx="0" cy="-30" r="8.5" fill="none" stroke="@bois" stroke-width="1.2" opacity="0.7"/>' // cernes
    + '<circle cx="0" cy="-30" r="3.5" fill="none" stroke="@bois" stroke-width="1" opacity="0.7"/>'
    + '<path d="M-14 -33 A14 14 0 0 1 14 -33" fill="none" stroke="@corde" stroke-width="2.2"/>' // frette cordée
    + '<path d="M-13.4 -26 A14 14 0 0 0 13.4 -26" fill="none" stroke="@cordeO" stroke-width="2.2"/>'
    + '</g>';
}

export const enginArt: EnginArtDef = { id: 'belier', front, profile, back };

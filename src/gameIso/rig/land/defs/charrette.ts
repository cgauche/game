/**
 * CHARRETTE (`charrette`, `vehicles.json` — LDB p.306) — charrette paysanne DÉCOUVERTE : plateau bas à ridelles en
 * claire-voie, DEUX grandes roues (un seul essieu), timon double (brancards) pour une bête, posé au sol
 * à l'arrêt. Aucune bâche ni caisse fermée : c'est ce qui la distingue au premier regard du chariot
 * (bâché, 4 roues) et de la diligence (caisse fermée à fenêtres). Art terrestre 3 vues, routé par l'id
 * de `vehicles.json`.
 */
import type { LandArtDef } from '../artkit';
import { wheelFace, wheelEdge } from '../artkit';

/** Ridelle en claire-voie (montants espacés sous une lisse haute) — motif partagé par les 3 vues.
 *  `x0..x1` = emprise, `yBed` = niveau du plateau, `yTop` = lisse haute, `n` = nombre de barreaux. */
function claireVoie(x0: number, x1: number, yBed: number, yTop: number, n: number, tone = '@bois'): string {
  const posts: string[] = [];
  for (let i = 0; i < n; i++) {
    const x = x0 + ((x1 - x0) * (i + 0.5)) / n;
    posts.push(`<line x1="${x.toFixed(1)}" y1="${yBed}" x2="${x.toFixed(1)}" y2="${yTop}" stroke="${tone}" stroke-width="2.4"/>`);
  }
  return posts.join('')
    + `<path d="M${x0} ${yTop} L${x1} ${yTop}" stroke="${tone}" stroke-width="3.5" stroke-linecap="round"/>`;
}

/** PROFIL (regarde à DROITE) : une grande roue, plateau bas, ridelle ajourée, brancards plongeant au
 *  sol vers l'avant (charrette dételée). Coords locales base-au-sol (y négatif vers le haut). */
function profile(): string {
  return '<g>'
    // Brancards (timon double pour une bête) : deux limons parallèles du plateau au sol, vers l'avant.
    + '<path d="M24 -25 L60 -2 L60 -5.5 L24 -28 Z" fill="@bois" stroke="@boisO" stroke-width="1.4"/>'
    + '<path d="M20 -28 L56 -8" stroke="@boisO" stroke-width="2.6" stroke-linecap="round"/>' // 2e limon (côté loin)
    // Plateau : plancher épais posé sur l'essieu, débordant à l'arrière.
    + '<path d="M-32 -22 L28 -22 L28 -27 L-32 -27 Z" fill="@bois" stroke="@boisO" stroke-width="1.5"/>'
    + '<line x1="-32" y1="-24.5" x2="28" y2="-24.5" stroke="@boisO" stroke-width="1" opacity="0.5"/>'
    // Ridelle basse en claire-voie (on voit le jour entre les barreaux — pas de caisse pleine).
    + '<path d="M-30 -27 L-30 -42 M26 -27 L26 -42" stroke="@bois" stroke-width="3.2" stroke-linecap="round"/>'
    + claireVoie(-26, 22, -27, -41, 5)
    // Grande roue UNIQUE en profil (essieu central) — signature « 2 roues » vs les 4 du chariot.
    + `<g transform="translate(-3,-17)">${wheelFace(17)}</g>`
    + '</g>';
}

/** FACE (l'avant vers le spectateur) : deux grandes roues de bout, plateau étroit entre elles,
 *  panneau avant ajouré, brancards fuyant vers le spectateur (bouts au sol). */
function front(): string {
  return '<g>'
    // Deux grandes roues de bout, DERRIÈRE la caisse et débordant de part et d'autre (essieu unique).
    + `<g transform="translate(-25,-17)">${wheelEdge(34)}</g>`
    + `<g transform="translate(25,-17)">${wheelEdge(34)}</g>`
    // Essieu unique traversant jusqu'aux moyeux.
    + '<path d="M-25 -17 L25 -17" stroke="@fer" stroke-width="3"/>'
    // Brancards vus de bout : deux bras divergents qui plongent au sol devant la charrette.
    + '<path d="M-8 -24 L-12 -2 M8 -24 L12 -2" stroke="@bois" stroke-width="3.4" stroke-linecap="round"/>'
    + '<circle cx="-12" cy="-2" r="2.2" fill="@boisO"/><circle cx="12" cy="-2" r="2.2" fill="@boisO"/>'
    // Plateau (chant avant).
    + '<path d="M-16 -22 L16 -22 L16 -27 L-16 -27 Z" fill="@bois" stroke="@boisO" stroke-width="1.5"/>'
    // Panneau avant en claire-voie, bas (on voit par-dessus : charrette DÉCOUVERTE).
    + '<path d="M-15 -27 L-15 -42 M15 -27 L15 -42" stroke="@bois" stroke-width="3" stroke-linecap="round"/>'
    + claireVoie(-12, 12, -27, -41, 3)
    // Lisses des ridelles latérales en fuite (amorce de perspective).
    + '<path d="M-15 -41 L-19 -39 M15 -41 L19 -39" stroke="@boisO" stroke-width="2.6" stroke-linecap="round"/>'
    + '</g>';
}

/** DOS : même volume que la face, tons ombrés, hayon ajouré et PAS de brancards (cachés devant) —
 *  l'intérieur du plateau affleure au-dessus du hayon bas. */
function back(): string {
  return '<g>'
    // Deux grandes roues de bout, DERRIÈRE le hayon et débordant de part et d'autre (même essieu qu'en face).
    + `<g transform="translate(-25,-17)">${wheelEdge(34)}</g>`
    + `<g transform="translate(25,-17)">${wheelEdge(34)}</g>`
    // Essieu unique traversant jusqu'aux moyeux + chant arrière du plateau (tons ombrés côté dos, comme le bélier).
    + '<path d="M-25 -17 L25 -17" stroke="@fer" stroke-width="3"/>'
    + '<path d="M-16 -22 L16 -22 L16 -27 L-16 -27 Z" fill="@boisO" stroke="@bois" stroke-width="1.5"/>'
    // Fond du plateau visible par-dessus le hayon bas (benne ouverte).
    + '<path d="M-13 -41 L13 -41 L11 -45 L-11 -45 Z" fill="@boisO" stroke="@bois" stroke-width="1" opacity="0.8"/>'
    // Hayon arrière en claire-voie.
    + '<path d="M-15 -27 L-15 -42 M15 -27 L15 -42" stroke="@boisO" stroke-width="3" stroke-linecap="round"/>'
    + claireVoie(-12, 12, -27, -41, 3, '@boisO')
    + '<path d="M-15 -41 L-19 -39 M15 -41 L19 -39" stroke="@bois" stroke-width="2.6" stroke-linecap="round"/>'
    + '</g>';
}

export const landArt: LandArtDef = { id: 'charrette', front, profile, back };

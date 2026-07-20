/**
 * Formes SVG PARTAGÉES du chariot (`chariot-leger`/`chariot-moyen`/`chariot-lourd`, `vehicles.json`)
 * — trois variantes de TAILLE du MÊME véhicule (icon `travel/cart` + desc identiques, EDOC 07
 * « Chargement ») : grand chariot de fret à QUATRE roues (petites à l'avant, grandes à l'arrière),
 * caisse profonde à planches BÂCHÉE sur arceaux, timon en flèche pour attelage double. Le TRAIT
 * VISUEL qui distingue les 3 tailles n'est pas modélisé ici (art PARTAGÉ, #642) ; la géométrie
 * ci-dessous décrit le chariot moyen. Préfixe `_` : exclu du registre auto-chargé
 * (`scripts/gen-registry.mjs` ignore les fichiers `_*` dans `defs/`) — ce module n'exporte AUCUN
 * `landArt`, seulement les 3 fonctions de rendu, importées par chaque def `chariot-*.ts`.
 */
import { wheelFace, wheelEdge } from '../artkit';

/** PROFIL (avant à DROITE) : 4 roues — petite avant / grande arrière —, caisse profonde, bâche sur
 *  arceaux (coutures visibles), timon en flèche vers l'avant. Coords locales base-au-sol. */
export function chariotProfile(): string {
  return '<g>'
    // Timon (flèche d'attelage double) : part du dessous avant, descend vers l'avant-droit au sol.
    + '<path d="M30 -14 L64 -3 L64 -7 L30 -18 Z" fill="@bois" stroke="@boisO" stroke-width="1.4"/>'
    + '<line x1="58" y1="-4" x2="58" y2="-11" stroke="@fer" stroke-width="2"/>' // cheville d'attelage
    // Châssis : longeron reliant les deux essieux.
    + '<path d="M-36 -15 L34 -15 L34 -21 L-36 -21 Z" fill="@boisO" stroke="@fer" stroke-width="1.2"/>'
    // Caisse PROFONDE : ridelle évasée (plus large en haut), planches horizontales + montants ferrés.
    + '<path d="M-36 -21 L36 -21 L40 -52 L-40 -52 Z" fill="@bois" stroke="@boisO" stroke-width="1.8"/>'
    + '<line x1="-37" y1="-31" x2="37" y2="-31" stroke="@boisO" stroke-width="1.4" opacity="0.6"/>'
    + '<line x1="-38" y1="-41" x2="38" y2="-41" stroke="@boisO" stroke-width="1.4" opacity="0.6"/>'
    + '<line x1="-16" y1="-22" x2="-17" y2="-51" stroke="@fer" stroke-width="1.6" opacity="0.7"/>' // montant ferré
    + '<line x1="14" y1="-22" x2="15" y2="-51" stroke="@fer" stroke-width="1.6" opacity="0.7"/>'
    // Bâche bombée sur arceaux, débordant la caisse aux deux bouts.
    + '<path d="M-42 -52 Q-44 -70 -30 -76 Q0 -84 30 -76 Q44 -70 42 -52 Z" fill="@bache" stroke="@boisO" stroke-width="1.4"/>'
    + '<path d="M-24 -53 Q-25 -73 -18 -77 M-6 -53 Q-7 -76 -3 -80 M12 -53 Q11 -76 8 -79 M28 -53 Q29 -72 24 -76" stroke="@boisO" stroke-width="1.2" fill="none" opacity="0.55"/>' // coutures des arceaux
    + '<path d="M-40 -55 Q0 -66 40 -55" stroke="@bacheH" stroke-width="3" fill="none" opacity="0.7"/>' // ourlet bas de bâche
    // Roues (côté proche) : GRANDE à l'arrière, PETITE à l'avant — signature du chariot de fret.
    + `<g transform="translate(-24,-19)">${wheelFace(19)}</g>`
    + `<g transform="translate(26,-13)">${wheelFace(13)}</g>`
    + '</g>';
}

/** FACE (avant) : petites roues flanquantes, planche de conducteur, timon central au sol avec palonnier,
 *  bâche en arche OUVERTE sur l'intérieur sombre. */
export function chariotFront(): string {
  return '<g>'
    + `<g transform="translate(-21,-13)">${wheelEdge(26)}</g>` // petites roues AVANT (de bout)
    + `<g transform="translate(21,-13)">${wheelEdge(26)}</g>`
    // Timon central pointant vers le spectateur (raccourci) + palonnier d'attelage double au sol.
    + '<path d="M-2.5 -12 L2.5 -12 L4.5 -2 L-4.5 -2 Z" fill="@bois" stroke="@boisO" stroke-width="1.2"/>'
    + '<line x1="-15" y1="-3" x2="15" y2="-3" stroke="@bois" stroke-width="3.5" stroke-linecap="round"/>'
    + '<circle cx="0" cy="-3" r="2" fill="@fer"/>'
    // Caisse vue de face : panneau évasé + planche de conducteur en surplomb.
    + '<path d="M-24 -8 L24 -8 L27 -38 L-27 -38 Z" fill="@bois" stroke="@boisO" stroke-width="1.8"/>'
    + '<line x1="-25" y1="-20" x2="25" y2="-20" stroke="@boisO" stroke-width="1.4" opacity="0.6"/>'
    + '<path d="M-29 -38 L29 -38 L29 -43 L-29 -43 Z" fill="@boisO" stroke="@fer" stroke-width="1.2"/>' // planche de conducteur
    // Bâche en arche au-dessus, gueule ouverte sur l'intérieur sombre.
    + '<path d="M-28 -43 Q-33 -70 -14 -78 Q0 -82 14 -78 Q33 -70 28 -43 Z" fill="@bache" stroke="@boisO" stroke-width="1.4"/>'
    + '<path d="M-20 -44 Q-23 -66 -8 -73 Q0 -76 8 -73 Q23 -66 20 -44 Z" fill="#1d1712"/>' // intérieur béant
    + '<path d="M-20 -44 Q-23 -66 -8 -73 Q0 -76 8 -73 Q23 -66 20 -44" stroke="@bacheH" stroke-width="2.5" fill="none" opacity="0.8"/>' // ourlet roulé de l'ouverture
    + '</g>';
}

/** DOS : grandes roues arrière, hayon à planches, bâche fermée en bourse (fronces). */
export function chariotBack(): string {
  return '<g>'
    + `<g transform="translate(-26,-21)">${wheelEdge(42)}</g>` // GRANDES roues ARRIÈRE (de bout)
    + `<g transform="translate(26,-21)">${wheelEdge(42)}</g>`
    // Hayon : panneau évasé à planches horizontales, ferrures d'angle.
    + '<path d="M-24 -8 L24 -8 L27 -42 L-27 -42 Z" fill="@bois" stroke="@boisO" stroke-width="1.8"/>'
    + '<line x1="-25" y1="-19" x2="25" y2="-19" stroke="@boisO" stroke-width="1.4" opacity="0.6"/>'
    + '<line x1="-26" y1="-30" x2="26" y2="-30" stroke="@boisO" stroke-width="1.4" opacity="0.6"/>'
    + '<path d="M-25 -10 L-25 -40 M25 -10 L25 -40" stroke="@fer" stroke-width="1.8" opacity="0.7"/>' // ferrures latérales
    // Bâche en arche, FERMÉE en bourse : fronces rayonnant vers le nœud central.
    + '<path d="M-28 -42 Q-33 -70 -14 -78 Q0 -82 14 -78 Q33 -70 28 -42 Z" fill="@bache" stroke="@boisO" stroke-width="1.4"/>'
    + '<circle cx="0" cy="-60" r="4.5" fill="#1d1712" stroke="@boisO" stroke-width="1.2"/>' // bourse nouée
    + '<path d="M0 -60 L-18 -72 M0 -60 L18 -72 M0 -60 L-22 -56 M0 -60 L22 -56 M0 -60 L-12 -46 M0 -60 L12 -46 M0 -60 L0 -78" stroke="@boisO" stroke-width="1.1" fill="none" opacity="0.5"/>' // fronces
    + '<path d="M0 -55 q2 5 5 6" stroke="@corde" stroke-width="1.6" fill="none"/>' // cordelette pendante
    + '</g>';
}

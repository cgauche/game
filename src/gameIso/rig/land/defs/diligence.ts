/**
 * DILIGENCE (`diligence`) — coche de voyage FERMÉ (EDOC 07 « Chargement ») : caisse suspendue à portes
 * et fenêtres, banc de cocher surélevé, galerie à bagages sur le toit, lanternes — 4 roues cerclées.
 * Art 3 vues routé par l'id de véhicule (`vehicles.json`), patron `engin/defs/belier.ts`. Signature vs
 * les autres attelages : caisse CLOSE à fenêtres (la charrette est découverte à 2 roues, le chariot est
 * bâché en arceaux) ; aucune bête attelée — le timon seul pointe vers l'avant.
 */
import type { LandArtDef } from '../artkit';
import { wheelFace, wheelEdge } from '../artkit';

/** Fenêtre vitrée sombre (caisse fermée) — le vitrage prend le jeton @fonte, l'encadrement @boisO. */
const fenetre = (x: number, y: number, w: number, h: number): string =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="@fonte" stroke="@boisO" stroke-width="1.4"/>`;

/** Lanterne de coche : boîtier de fer + lueur chaude. */
const lanterne = (x: number, y: number): string =>
  `<g transform="translate(${x},${y})">`
  + '<rect x="-2.5" y="-4" width="5" height="8" fill="@fer" stroke="@ferH" stroke-width="0.8"/>'
  + '<circle r="1.8" fill="@corde"/>'
  + '</g>';

/** Profil (regarde à DROITE) : caisse fermée suspendue entre les essieux, banc de cocher sur l'avant,
 *  galerie + malle sur le toit, timon en flèche. Coords LOCALES base-au-sol (cf. `groundedBody`). */
function profile(): string {
  return '<g>'
    // Timon (flèche) partant du châssis vers l'avant-droit, au sol.
    + '<path d="M30 -12 L58 -3 L58 -7 L30 -16 Z" fill="@bois" stroke="@boisO" stroke-width="1.4"/>'
    // Châssis : longeron reliant les deux essieux.
    + '<path d="M-30 -12 L32 -12 L32 -17 L-30 -17 Z" fill="@boisO" stroke="@fer" stroke-width="1.2"/>'
    // Suspension à courroies : deux jambettes de fer entre châssis et caisse.
    + '<path d="M-24 -17 L-24 -23 M18 -17 L18 -23" stroke="@fer" stroke-width="2.5"/>'
    // Caisse FERMÉE suspendue (berline) : panneau plein du plancher au toit.
    + '<path d="M-28 -22 L16 -22 L18 -52 L-30 -52 Z" fill="@bois" stroke="@boisO" stroke-width="1.6"/>'
    + '<line x1="-29" y1="-34" x2="17" y2="-34" stroke="@boisO" stroke-width="1.4" opacity="0.6"/>' // moulure de ceinture
    // Porte centrale (montants + poignée) et sa fenêtre.
    + '<path d="M-9 -23 L-9 -50 M5 -23 L5 -50" stroke="@boisO" stroke-width="1.4" opacity="0.8"/>'
    + fenetre(-6, -48, 8, 12)
    + '<circle cx="3" cy="-36" r="1.3" fill="@fer"/>' // poignée
    // Fenêtres avant et arrière de la caisse.
    + fenetre(8, -48, 7, 11)
    + fenetre(-24, -48, 7, 11)
    // Toit débordant + galerie à bagages (montants + lisse) et malle sanglée.
    + '<path d="M-32 -52 L20 -52 L20 -55 L-32 -55 Z" fill="@boisO" stroke="@fer" stroke-width="1"/>'
    + '<path d="M-26 -55 L-26 -60 M-4 -55 L-4 -60 M12 -55 L12 -60" stroke="@fer" stroke-width="1.2"/>'
    + '<line x1="-28" y1="-60" x2="14" y2="-60" stroke="@fer" stroke-width="1.4"/>'
    + '<path d="M-22 -60 L6 -60 L5 -67 L-21 -67 Z" fill="@bache" stroke="@boisO" stroke-width="1.2"/>' // malle bâchée
    + '<path d="M-15 -60 L-15 -67 M-1 -60 L-1 -67" stroke="@boisO" stroke-width="1" opacity="0.7"/>' // sangles
    // Banc de cocher surélevé sur l'avant + dossier + marchepied incliné.
    + '<path d="M20 -44 L36 -44 L36 -49 L20 -49 Z" fill="@bois" stroke="@boisO" stroke-width="1.4"/>'
    + '<path d="M20 -49 L20 -56 L24 -56 L24 -49 Z" fill="@boisO"/>' // dossier côté caisse
    + '<path d="M36 -44 L44 -28 L41 -27 L33 -43 Z" fill="@boisO" stroke="@fer" stroke-width="1"/>' // marchepied
    + lanterne(38, -46)
    // Roues cerclées : grande à l'arrière, petite sous le banc à l'avant.
    + `<g transform="translate(-20,-14)">${wheelFace(14)}</g>`
    + `<g transform="translate(26,-11)">${wheelFace(11)}</g>`
    + '</g>';
}

/** Face (l'avant vient vers le spectateur) : tablier + banc de cocher dominé par le toit en galerie,
 *  deux lanternes, timon en bout, petites roues avant de chant. */
function front(): string {
  return '<g>'
    // Toit + galerie de la caisse, en arrière-plan au-dessus du banc.
    + '<path d="M-22 -56 L22 -56 L22 -59 L-22 -59 Z" fill="@boisO" stroke="@fer" stroke-width="1"/>'
    + '<path d="M-16 -59 L-16 -63 M0 -59 L0 -63 M16 -59 L16 -63" stroke="@fer" stroke-width="1.2"/>'
    + '<line x1="-18" y1="-63" x2="18" y2="-63" stroke="@fer" stroke-width="1.4"/>'
    + '<path d="M-12 -63 L12 -63 L11 -69 L-11 -69 Z" fill="@bache" stroke="@boisO" stroke-width="1.2"/>' // malle bâchée
    // Dossier du banc adossé à la caisse, puis banc et tablier (garde-crotte).
    + '<path d="M-18 -50 L18 -50 L18 -56 L-18 -56 Z" fill="@boisO" stroke="@bois" stroke-width="1"/>'
    + '<path d="M-18 -44 L18 -44 L18 -50 L-18 -50 Z" fill="@bois" stroke="@boisO" stroke-width="1.4"/>' // banc
    + '<path d="M-16 -28 L16 -28 L18 -44 L-18 -44 Z" fill="@bois" stroke="@boisO" stroke-width="1.6"/>' // tablier
    + '<line x1="-15" y1="-36" x2="15" y2="-36" stroke="@boisO" stroke-width="1.2" opacity="0.6"/>'
    // Essieu + timon pointé vers le spectateur (bout de flèche).
    + '<path d="M-20 -11 L20 -11" stroke="@fer" stroke-width="2.5"/>'
    + '<ellipse cx="0" cy="-8" rx="4" ry="2.5" fill="@bois" stroke="@boisO" stroke-width="1.2"/>'
    // Lanternes aux montants du tablier.
    + lanterne(-20, -42) + lanterne(20, -42)
    // Roues AVANT (petites) de chant.
    + `<g transform="translate(-20,-11)">${wheelEdge(22)}</g>`
    + `<g transform="translate(20,-11)">${wheelEdge(22)}</g>`
    + '</g>';
}

/** Dos : panneau arrière plein à lucarne, malle de coffre sanglée sous la ceinture, grandes roues
 *  arrière de chant, galerie visible au-dessus. */
function back(): string {
  return '<g>'
    // Caisse vue de dos : panneau plein, plus sombre (contre-jour), du plancher au toit.
    + '<path d="M-19 -22 L19 -22 L21 -54 L-21 -54 Z" fill="@boisO" stroke="@bois" stroke-width="1.6"/>'
    + '<line x1="-20" y1="-36" x2="20" y2="-36" stroke="@bois" stroke-width="1.2" opacity="0.6"/>' // moulure
    // Lucarne arrière (petite fenêtre haute).
    + fenetre(-5, -50, 10, 8)
    // Coffre arrière : malle bâchée sanglée sous la ceinture.
    + '<path d="M-14 -22 L14 -22 L14 -35 L-14 -35 Z" fill="@bache" stroke="@bois" stroke-width="1.2"/>'
    + '<path d="M-7 -22 L-7 -35 M7 -22 L7 -35" stroke="@bois" stroke-width="1.2" opacity="0.8"/>' // sangles
    // Toit + galerie et malle de toit dépassant.
    + '<path d="M-23 -54 L23 -54 L23 -57 L-23 -57 Z" fill="@bois" stroke="@fer" stroke-width="1"/>'
    + '<path d="M-16 -57 L-16 -61 M16 -57 L16 -61" stroke="@fer" stroke-width="1.2"/>'
    + '<line x1="-18" y1="-61" x2="18" y2="-61" stroke="@fer" stroke-width="1.4"/>'
    + '<path d="M-10 -61 L10 -61 L9 -66 L-9 -66 Z" fill="@bache" stroke="@boisO" stroke-width="1.2"/>'
    // Essieu + grandes roues ARRIÈRE de chant.
    + '<path d="M-20 -14 L20 -14" stroke="@fer" stroke-width="2.5"/>'
    + `<g transform="translate(-20,-14)">${wheelEdge(28)}</g>`
    + `<g transform="translate(20,-14)">${wheelEdge(28)}</g>`
    + '</g>';
}

export const landArt: LandArtDef = { id: 'diligence', front, profile, back };

/**
 * BALISTE DE REMPART (`baliste`) — grande arbalète à tour, écheveaux de torsion, sur bâti de bois.
 * Art de l'engin (3 vues), routé par l'id d'espèce `baliste`.
 */
import { type EnginArtDef } from '../artkit';

function profile(): string {
  // Vue de CÔTÉ (90° de la face) : l'arc est EDGE-ON → une barre VERTICALE étroite (l'écheveau/montant),
  // PAS un arc large ; ce qui domine est le long STOCK + CARREAU horizontal projeté vers l'avant (droite).
  return '<g>'
    // Traîneau bas + bâti (A-frame vu de chant = montant incliné, les 2 pieds se confondent).
    + '<path d="M-26 -1 L26 -1 L21 -9 L-21 -9 Z" fill="@bois" stroke="@boisO" stroke-width="1.5"/>'
    + '<path d="M-13 -8 L-3 -8 L3 -44 L-5 -44 Z" fill="@bois" stroke="@boisO" stroke-width="1.5"/>' // montant avant de l'A
    + '<path d="M15 -8 L3 -44" stroke="@boisO" stroke-width="4.5" stroke-linecap="round"/>' // jambe arrière de l'A
    // Stock LONG (glissière) projeté vers l'avant (droite), porté par le pivot.
    + '<path d="M-22 -39 L40 -49 L40 -55 L-22 -45 Z" fill="@bois" stroke="@boisO" stroke-width="1.5"/>'
    + '<path d="M-18 -46 L38 -52" stroke="@boisO" stroke-width="1" opacity="0.6"/>' // rainure
    // Cadre d'avant : ARC VU DE CHANT = barre VERTICALE étroite + écheveau de torsion bobiné (≠ arc large).
    + '<path d="M33 -63 L36 -36" stroke="@bois" stroke-width="6" stroke-linecap="round"/>'
    + '<g transform="translate(35,-49)"><ellipse rx="5.5" ry="13" fill="@corde" stroke="@cordeO" stroke-width="1.5"/>'
    + '<line x1="-5.5" y1="-6" x2="5.5" y2="-6" stroke="@cordeO" stroke-width="1"/><line x1="-6" y1="0" x2="6" y2="0" stroke="@cordeO" stroke-width="1"/><line x1="-5.5" y1="6" x2="5.5" y2="6" stroke="@cordeO" stroke-width="1"/></g>'
    + '<path d="M35 -49 q9 -1 12 6" fill="none" stroke="@boisO" stroke-width="4" stroke-linecap="round"/>' // bras d'arc edge-on (court nub)
    // Corde tendue vers l'arrière le long du stock (du haut/bas du cadre au talon du carreau).
    + '<path d="M35 -60 L-15 -45 M35 -38 L-15 -45" stroke="@cordeH" stroke-width="1.6"/>'
    // CARREAU long dans la rainure : empennage à l'arrière (gauche), fer en avant (droite, au-delà du cadre).
    + '<path d="M-16 -45 L48 -52" stroke="@boisH" stroke-width="3.5"/>'
    + '<path d="M48 -52 L55 -53 L48 -48 Z" fill="@fer"/>' // fer du carreau
    + '<path d="M-16 -45 L-24 -41 M-16 -45 L-24 -49 M-16 -45 L-24 -45" stroke="@corde" stroke-width="2"/>' // empennage
    // Treuil/cabestan arrière (manivelle) — le mécanisme de bandage.
    + '<circle cx="-17" cy="-43" r="5" fill="@fonte" stroke="@fer" stroke-width="1.5"/>'
    + '<path d="M-17 -43 l6 4" stroke="@fer" stroke-width="2.5" stroke-linecap="round"/>'
    + '</g>';
}

function front(): string {
  return '<g>'
    // Bâti : deux pieds écartés + entretoise + axe central.
    + '<path d="M-30 -1 L-4 -50 M30 -1 L4 -50" stroke="@bois" stroke-width="9" stroke-linecap="round"/>'
    + '<path d="M-22 -26 L22 -26" stroke="@bois" stroke-width="6" stroke-linecap="round"/>'
    // Écheveaux de torsion (cordage) de part et d'autre du centre.
    + '<ellipse cx="-13" cy="-54" rx="6.5" ry="13" fill="@corde" stroke="@cordeO" stroke-width="1.5"/>'
    + '<ellipse cx="13" cy="-54" rx="6.5" ry="13" fill="@corde" stroke="@cordeO" stroke-width="1.5"/>'
    // Arc horizontal (deux bras recourbés) — large.
    + '<path d="M0 -57 Q-30 -62 -52 -50" fill="none" stroke="@bois" stroke-width="7" stroke-linecap="round"/>'
    + '<path d="M0 -57 Q30 -62 52 -50" fill="none" stroke="@bois" stroke-width="7" stroke-linecap="round"/>'
    // Corde tendue vers le tireur (V peu profond) jusqu'au talon du carreau.
    + '<path d="M-52 -50 L0 -45 L52 -50" fill="none" stroke="@cordeH" stroke-width="2"/>'
    // Carreau pointé sur le spectateur : pointe + empennage rayonnant.
    + '<path d="M0 -45 L-7 -37 M0 -45 L7 -37 M0 -45 L0 -33" stroke="@corde" stroke-width="2.5" stroke-linecap="round"/>'
    + '<circle cx="0" cy="-46" r="3.5" fill="@fer" stroke="#15130f" stroke-width="1"/>'
    + '</g>';
}

function back(): string {
  return '<g>'
    // Bâti (pieds + entretoise), comme la face.
    + '<path d="M-30 -1 L-4 -50 M30 -1 L4 -50" stroke="@bois" stroke-width="9" stroke-linecap="round"/>'
    + '<path d="M-22 -26 L22 -26" stroke="@bois" stroke-width="6" stroke-linecap="round"/>'
    // Bras d'arc qui fuient vers le haut/loin, derrière le stock.
    + '<path d="M0 -56 Q-26 -64 -44 -60" fill="none" stroke="@boisO" stroke-width="6" stroke-linecap="round"/>'
    + '<path d="M0 -56 Q26 -64 44 -60" fill="none" stroke="@boisO" stroke-width="6" stroke-linecap="round"/>'
    // Treuil/cabestan transversal + deux manivelles vers le spectateur (la vue « on bande l'arme »).
    + '<rect x="-17" y="-36" width="34" height="9" rx="3.5" fill="@bois" stroke="@fer" stroke-width="1.5"/>'
    + '<path d="M-17 -31 l-9 7 l6 4" fill="none" stroke="@fer" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'
    + '<path d="M17 -31 l9 7 l-6 4" fill="none" stroke="@fer" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'
    // CORDE D'ARC bandée : des pointes des deux bras jusqu'au talon central (le carreau encoché, vu de dos).
    + '<path d="M-44 -60 L0 -46 L44 -60" fill="none" stroke="@cordeH" stroke-width="2"/>'
    // Talon du carreau (fer) + empennage en plumes courtes RAYONNANTES (≠ flèche « monter »).
    + '<circle cx="0" cy="-46" r="3" fill="@fer" stroke="#15130f" stroke-width="1"/>'
    + '<path d="M0 -46 L-4 -52 M0 -46 L4 -52 M0 -46 L-5 -41 M0 -46 L5 -41" stroke="@corde" stroke-width="1.6" stroke-linecap="round"/>'
    + '</g>';
}

export const enginArt: EnginArtDef = { id: 'baliste', front, profile, back };

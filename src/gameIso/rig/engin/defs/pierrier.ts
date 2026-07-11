/**
 * PIERRIER (`pierrier`) — petit canon PIVOTANT à fourche : long tube fin posé dans un lyre-pivot de fer
 * au sommet d'un poteau, boîte de culasse amovible et queue de manœuvre en champignon (réf art AA
 * page020_img6 : tube à cerclages, pommeau, chaîne de retenue). Art de l'engin (3 vues), routé par l'id
 * d'espèce `pierrier`. Signature de silhouette vs `canon-petit` : PAS de roues ni d'affût — un poteau
 * vertical + fourche en U, tube mince, queue plongeante vers l'arrière.
 */
import { type EnginArtDef } from '../artkit';

function profile(): string {
  // Vue de CÔTÉ, bouche vers la DROITE : le poteau + la fourche + la queue en champignon dominent.
  return '<g>'
    // Socle bas (semelle de bois clouée au bastingage/rempart).
    + '<path d="M-14 -1 L14 -1 L11 -7 L-11 -7 Z" fill="@bois" stroke="@boisO" stroke-width="1.5"/>'
    // Poteau de pivot vertical, épais, cerclé de fer.
    + '<path d="M-4 -6 L4 -6 L3 -40 L-3 -40 Z" fill="@bois" stroke="@boisO" stroke-width="1.5"/>'
    + '<line x1="-3.6" y1="-14" x2="3.6" y2="-14" stroke="@fer" stroke-width="2.5"/>' // frette basse
    + '<line x1="-3.2" y1="-30" x2="3.2" y2="-30" stroke="@fer" stroke-width="2.5"/>' // frette haute
    // Fourche de fer (lyre) vue de chant : montant + tourillon saisi.
    + '<path d="M0 -40 L0 -47" stroke="@fer" stroke-width="4" stroke-linecap="round"/>'
    + '<circle cx="0" cy="-48" r="4" fill="@fonte" stroke="@ferH" stroke-width="1.5"/>' // tourillon dans la fourche
    // TUBE long et FIN, légère hausse vers la droite ; volée renflée à la bouche.
    + '<path d="M-16 -46 L40 -52 L46 -52.5 L46 -46.5 L40 -47 L-16 -41 Z" fill="@fonte" stroke="@fer" stroke-width="1.2"/>'
    + '<line x1="12" y1="-50" x2="12" y2="-44.5" stroke="@fonteH" stroke-width="2.5"/>' // astragale
    + '<line x1="30" y1="-51.5" x2="30" y2="-46" stroke="@fonteH" stroke-width="2.5"/>'
    + '<path d="M44 -53.5 L48 -54 L48 -45 L44 -45.5 Z" fill="@fonte" stroke="@ferH" stroke-width="1.2"/>' // renfort de bouche
    + '<ellipse cx="48" cy="-49.5" rx="1.6" ry="4" fill="#0c0c10"/>' // âme (bouche)
    // Boîte de culasse amovible (chambre) posée derrière le tube.
    + '<path d="M-16 -47 L-24 -46 L-24 -40 L-16 -41 Z" fill="@fonteO" stroke="@fer" stroke-width="1.2"/>'
    + '<line x1="-20" y1="-46.4" x2="-20" y2="-40.6" stroke="@fonteH" stroke-width="2"/>' // cerclage de boîte
    // QUEUE DE MANŒUVRE plongeante vers l'arrière, pommeau en champignon (la signature du pierrier).
    + '<path d="M-24 -43 L-38 -32" stroke="@fer" stroke-width="3" stroke-linecap="round"/>'
    + '<ellipse cx="-40" cy="-30.5" rx="4.5" ry="3" fill="@fonte" stroke="@ferH" stroke-width="1.2" transform="rotate(38 -40 -30.5)"/>' // champignon
    // Chaîne de retenue de la boîte, pendante du tourillon au poteau.
    + '<path d="M-2 -44 q-6 8 -3 16" fill="none" stroke="@fer" stroke-width="1.4" stroke-dasharray="2.2 1.6"/>'
    + '</g>';
}

function front(): string {
  // De FACE : la bouche (petit cercle) entre les deux cornes de la fourche, sur le poteau.
  return '<g>'
    + '<path d="M-14 -1 L14 -1 L11 -7 L-11 -7 Z" fill="@bois" stroke="@boisO" stroke-width="1.5"/>' // socle
    + '<path d="M-4 -6 L4 -6 L3 -40 L-3 -40 Z" fill="@bois" stroke="@boisO" stroke-width="1.5"/>' // poteau
    + '<line x1="-3.4" y1="-22" x2="3.4" y2="-22" stroke="@fer" stroke-width="2.5"/>' // frette
    // Fourche en U de face : deux cornes de fer écartées qui montent de part et d'autre du tube.
    + '<path d="M-8 -40 Q-9 -50 -7 -56" fill="none" stroke="@fer" stroke-width="3.5" stroke-linecap="round"/>'
    + '<path d="M8 -40 Q9 -50 7 -56" fill="none" stroke="@fer" stroke-width="3.5" stroke-linecap="round"/>'
    // Volée pointée sur le spectateur : petit cercle (tube FIN, ≠ grosse gueule du canon-petit).
    + '<circle cx="0" cy="-49" r="7.5" fill="@fonte" stroke="@fer" stroke-width="1.5"/>'
    + '<circle cx="0" cy="-49" r="7.5" fill="none" stroke="@fonteH" stroke-width="1.2"/>'
    + '<circle cx="0" cy="-49" r="3.8" fill="#0c0c10"/>' // âme
    // Champignon de la queue qui dépasse au-dessus, derrière la bouche.
    + '<circle cx="0" cy="-60" r="3" fill="@fonteO" stroke="@ferH" stroke-width="1"/>'
    + '<path d="M0 -57 L0 -52" stroke="@fer" stroke-width="2"/>'
    + '</g>';
}

function back(): string {
  // De DOS : la boîte de culasse + la queue en champignon plongeant vers le spectateur.
  return '<g>'
    + '<path d="M-14 -1 L14 -1 L11 -7 L-11 -7 Z" fill="@boisO" stroke="@bois" stroke-width="1.5"/>' // socle
    + '<path d="M-4 -6 L4 -6 L3 -40 L-3 -40 Z" fill="@boisO" stroke="@bois" stroke-width="1.5"/>' // poteau
    + '<line x1="-3.4" y1="-22" x2="3.4" y2="-22" stroke="@fer" stroke-width="2.5"/>'
    // Cornes de la fourche, comme la face.
    + '<path d="M-8 -40 Q-9 -50 -7 -56" fill="none" stroke="@fer" stroke-width="3.5" stroke-linecap="round"/>'
    + '<path d="M8 -40 Q9 -50 7 -56" fill="none" stroke="@fer" stroke-width="3.5" stroke-linecap="round"/>'
    // Boîte de culasse vue de dos (cercle plein, cerclée) — le tube fuit derrière.
    + '<circle cx="0" cy="-48" r="8" fill="@fonteO" stroke="@fer" stroke-width="1.5"/>'
    + '<circle cx="0" cy="-48" r="4" fill="@fonte" stroke="@fonteH" stroke-width="1.2"/>' // cul de la boîte
    + '<circle cx="2.5" cy="-53" r="1.5" fill="#0c0c10"/>' // lumière (mise à feu)
    // Queue de manœuvre vers le spectateur-bas + champignon (raccourci de perspective).
    + '<path d="M0 -44 L-6 -30" stroke="@fer" stroke-width="3.5" stroke-linecap="round"/>'
    + '<circle cx="-7" cy="-27.5" r="4" fill="@fonte" stroke="@ferH" stroke-width="1.2"/>' // champignon
    + '<circle cx="-7" cy="-27.5" r="1.6" fill="@fonteH"/>'
    + '</g>';
}

export const enginArt: EnginArtDef = { id: 'pierrier', front, profile, back };

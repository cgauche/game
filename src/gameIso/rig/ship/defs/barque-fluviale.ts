/**
 * BARQUE (fluviale, MSLRC 33, ~5 m, avirons) — canot ouvert à FOND PLAT, construction réelle :
 * sole droite posée à la flottaison (quille à y=0), étrave franche inclinée à droite, tableau
 * arrière droit à gauche, tonture DOUCE (pas de croissant), deux virures à clins, deux bancs
 * de nage, deux avirons. Réf : le petit bateau du port fluvial MDG p.022. Trois vues (contrat
 * `ViewArt`) : profil (proue à droite), face = étrave de bout, dos = tableau arrière.
 */
import type { ShipArtDef } from '../artkit';

function profile(): string {
  return '<g>'
    // Avirons (derrière la coque), pelles dans l'eau.
    + '<g stroke="@mat" stroke-width="1.2" stroke-linecap="round"><line x1="-3" y1="-7.9" x2="-9" y2="0.8"/><line x1="5" y1="-8" x2="-0.5" y2="0.8"/></g>'
    + '<path d="M-9 0.8 q-2.4 0.6 -2 3 q2.6 0.2 3.4 -2 Z" fill="@mat"/>'
    + '<path d="M-0.5 0.8 q-2.4 0.6 -2 3 q2.6 0.2 3.4 -2 Z" fill="@mat"/>'
    // Coque : tableau incliné (gauche), SOLE PLATE au contact, étrave franche (droite), tonture douce.
    + '<path d="M-13.5 -9 L-11.5 -0.6 L9 -0.6 L15 -9.5 Q7.5 -7.6 0 -7.4 Q-7 -7.4 -13.5 -9 Z" fill="@coque" stroke="@coqueO" stroke-width="1.2"/>'
    // Petit aileron de sole (skeg) sous le tableau.
    + '<path d="M-11.3 -0.6 l3.2 0 l-0.6 1.7 l-2.4 -0.4 Z" fill="@coque" stroke="@coqueO" stroke-width="0.8"/>'
    // Étrave et bordé du tableau soulignés (charpente, pas un aplat).
    + '<path d="M9.6 -0.9 L15 -9.5" stroke="@coqueO" stroke-width="1.5"/>'
    + '<path d="M-12.5 -8.2 L-10.8 -1.2" stroke="@coqueO" stroke-width="0.9" opacity="0.7"/>'
    // Plat-bord éclairé + deux virures à clins suivant la tonture.
    + '<path d="M-13.5 -9 Q-7 -7.4 0 -7.4 Q7.5 -7.6 15 -9.5" fill="none" stroke="@coqueH" stroke-width="1.1"/>'
    + '<path d="M-12.4 -6 Q0 -4.4 12.4 -6.4 M-11.8 -3.2 Q0 -1.8 10.6 -3.5" fill="none" stroke="@coqueO" stroke-width="0.7" opacity="0.5"/>'
    // Bancs de nage + tolets au plat-bord.
    + '<path d="M-4 -7.4 l0 -1.8 M4 -7.5 l0 -1.8" stroke="@matO" stroke-width="1.2"/>'
    + '</g>';
}

function front(): string {
  return '<g>'
    // Avirons sortis aux tolets, pelles à l'eau de part et d'autre.
    + '<g stroke="@mat" stroke-width="1.2" stroke-linecap="round"><line x1="-6.4" y1="-8.4" x2="-11.5" y2="0.4"/><line x1="6.4" y1="-8.4" x2="11.5" y2="0.4"/></g>'
    + '<path d="M-11.5 0.4 q-2.2 0.8 -1.6 3 q2.5 0 3.2 -2.2 Z" fill="@mat"/>'
    + '<path d="M11.5 0.4 q2.2 0.8 1.6 3 q-2.5 0 -3.2 -2.2 Z" fill="@mat"/>'
    // Coque de bout : sole plate étroite, flancs évasés, plat-bord montant vers la tête d'étrave.
    + '<path d="M-4.2 -0.6 L-6.8 -8.6 Q0 -10.6 6.8 -8.6 L4.2 -0.6 Q0 0.2 -4.2 -0.6 Z" fill="@coque" stroke="@coqueO" stroke-width="1.2"/>'
    // Virures à clins vues de face.
    + '<path d="M-6 -6.4 Q0 -7.8 6 -6.4 M-5.2 -3.6 Q0 -4.8 5.2 -3.6" fill="none" stroke="@coqueO" stroke-width="0.7" opacity="0.5"/>'
    // ÉTRAVE : pièce axiale pleine, de la sole à la tête d'étrave.
    + '<path d="M0 -10.8 L0 -0.7" stroke="@coqueO" stroke-width="1.6" stroke-linecap="round"/>'
    // Plat-bord éclairé.
    + '<path d="M-6.8 -8.6 Q0 -10.6 6.8 -8.6" fill="none" stroke="@coqueH" stroke-width="1.1"/>'
    + '</g>';
}

function back(): string {
  return '<g>'
    // Avirons vus de poupe.
    + '<g stroke="@mat" stroke-width="1.2" stroke-linecap="round"><line x1="-6.4" y1="-8.2" x2="-11.5" y2="0.4"/><line x1="6.4" y1="-8.2" x2="11.5" y2="0.4"/></g>'
    + '<path d="M-11.5 0.4 q-2.2 0.8 -1.6 3 q2.5 0 3.2 -2.2 Z" fill="@mat"/>'
    + '<path d="M11.5 0.4 q2.2 0.8 1.6 3 q-2.5 0 -3.2 -2.2 Z" fill="@mat"/>'
    // TABLEAU ARRIÈRE : planche droite quasi rectangulaire, plus large en haut, sole plate au contact.
    + '<path d="M-4.4 -0.6 L-6.4 -8.8 L6.4 -8.8 L4.4 -0.6 Q0 0.2 -4.4 -0.6 Z" fill="@coque" stroke="@coqueO" stroke-width="1.2"/>'
    // Ombre de poupe (face opposée au soleil de proue) + joints VERTICAUX des planches du tableau.
    + '<path d="M-4.4 -0.6 L-6.4 -8.8 L6.4 -8.8 L4.4 -0.6 Q0 0.2 -4.4 -0.6 Z" fill="@coqueO" opacity="0.22"/>'
    + '<path d="M-2.1 -8.8 L-1.5 -0.4 M2.1 -8.8 L1.5 -0.4" stroke="@coqueO" stroke-width="0.8" opacity="0.65"/>'
    // Barrot du tableau (lisse haute) éclairé + skeg dépassant sous la sole.
    + '<path d="M-6.4 -8.8 L6.4 -8.8" stroke="@coqueH" stroke-width="1.1"/>'
    + '<path d="M-1.2 -0.4 l2.4 0 l-0.5 1.7 l-1.4 0 Z" fill="@coque" stroke="@coqueO" stroke-width="0.8"/>'
    + '</g>';
}

export const hullArt: ShipArtDef = { id: 'barque-fluviale', profile, front, back };

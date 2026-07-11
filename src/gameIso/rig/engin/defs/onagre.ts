/**
 * ONAGRE (`onagre`) — catapulte à torsion : bras de jet UNIQUE à fronde, dressé contre un butoir
 * matelassé, sur cadre-poutre bas posé au sol (pas de roues — c'est ce qui le distingue des affûts).
 * Art de l'engin (3 vues), routé par l'id d'espèce `onagre`.
 */
import { type EnginArtDef } from '../artkit';

function profile(): string {
  // Vue de CÔTÉ, tir vers l'avant (droite) : la signature de l'onagre = le BRAS unique incliné
  // plaqué au butoir, fronde et pierre au bout, écheveau de torsion au pivot, treuil à l'arrière.
  return '<g>'
    // Cadre-poutre BAS posé au sol (traîneau massif, sans roues).
    + '<path d="M-42 -1 L36 -1 L36 -9 L-42 -9 Z" fill="@bois" stroke="@boisO" stroke-width="1.5"/>'
    + '<path d="M-38 -5 L32 -5" stroke="@boisO" stroke-width="1" opacity="0.6"/>' // longeron intérieur
    // Cadre court au-dessus du traîneau (porte l'écheveau).
    + '<path d="M-30 -9 L-27 -19 M14 -9 L11 -19" stroke="@bois" stroke-width="5" stroke-linecap="round"/>'
    + '<path d="M-27 -19 L11 -19" stroke="@boisO" stroke-width="3"/>'
    // ÉCHEVEAU DE TORSION vu de bout (le moteur), au pivot du bras.
    + '<circle cx="4" cy="-16" r="7" fill="@corde" stroke="@cordeO" stroke-width="1.5"/>'
    + '<path d="M-2 -19 L10 -19 M-3 -16 L11 -16 M-2 -13 L10 -13" stroke="@cordeO" stroke-width="1"/>'
    // Butoir AVANT : montant + jambe de force, coussin de corde au sommet (le bras frappe là).
    + '<path d="M22 -9 L28 -45" stroke="@bois" stroke-width="6" stroke-linecap="round"/>'
    + '<path d="M34 -9 L28 -45" stroke="@boisO" stroke-width="4" stroke-linecap="round"/>'
    + '<ellipse cx="28" cy="-47" rx="7" ry="4.5" fill="@corde" stroke="@cordeO" stroke-width="1.5"/>'
    // BRAS DE JET unique, du pivot jusqu'au-dessus du butoir (position haute, vient de claquer).
    + '<path d="M4 -16 L29 -57" stroke="@bois" stroke-width="7" stroke-linecap="round"/>'
    + '<path d="M7 -19 L28 -54" stroke="@boisH" stroke-width="1.5" opacity="0.7"/>' // arête éclairée
    // FRONDE au bout du bras : deux brins retombant vers l'avant + pierre.
    + '<path d="M29 -57 Q39 -56 41 -48 M29 -57 Q34 -51 41 -48" fill="none" stroke="@cordeH" stroke-width="1.6"/>'
    + '<circle cx="41" cy="-48" r="4.5" fill="@fonte" stroke="@fer" stroke-width="1"/>'
    + '<circle cx="39.5" cy="-49.5" r="1.4" fill="@fonteH"/>' // reflet de la pierre
    // Treuil ARRIÈRE (manivelle) + corde de bandage courant vers le bras.
    + '<circle cx="-34" cy="-13" r="5" fill="@fonte" stroke="@fer" stroke-width="1.5"/>'
    + '<path d="M-34 -13 l6 5" stroke="@fer" stroke-width="2.5" stroke-linecap="round"/>'
    + '<path d="M-30 -16 Q-8 -30 15 -34" fill="none" stroke="@cordeH" stroke-width="1.6"/>'
    + '</g>';
}

function front(): string {
  // Face au spectateur = côté du tir : butoir en travers, bras dressé derrière, pierre en fronde au sommet.
  return '<g>'
    // Longerons du traîneau vus de bout + sole transversale.
    + '<path d="M-26 -1 L-14 -1 L-14 -9 L-26 -9 Z" fill="@bois" stroke="@boisO" stroke-width="1.5"/>'
    + '<path d="M14 -1 L26 -1 L26 -9 L14 -9 Z" fill="@bois" stroke="@boisO" stroke-width="1.5"/>'
    + '<path d="M-24 -5 L24 -5" stroke="@boisO" stroke-width="3"/>'
    // Flasques latéraux courts portant l'écheveau.
    + '<path d="M-19 -9 L-19 -20 M19 -9 L19 -20" stroke="@bois" stroke-width="6" stroke-linecap="round"/>'
    // ÉCHEVEAU DE TORSION transversal (boudin de corde, toute la largeur du cadre).
    + '<rect x="-19" y="-26" width="38" height="10" rx="5" fill="@corde" stroke="@cordeO" stroke-width="1.5"/>'
    + '<path d="M-12 -26 L-12 -16 M-4 -26 L-4 -16 M4 -26 L4 -16 M12 -26 L12 -16" stroke="@cordeO" stroke-width="1"/>'
    // Bras dressé vers le spectateur (raccourci) — derrière le butoir.
    + '<path d="M0 -22 L0 -52" stroke="@bois" stroke-width="8" stroke-linecap="round"/>'
    // Butoir : deux montants + traverse matelassée de corde.
    + '<path d="M-15 -9 L-11 -45 M15 -9 L11 -45" stroke="@bois" stroke-width="6" stroke-linecap="round"/>'
    + '<path d="M-13 -45 L13 -45" stroke="@bois" stroke-width="6" stroke-linecap="round"/>'
    + '<rect x="-13" y="-51" width="26" height="7" rx="3.5" fill="@corde" stroke="@cordeO" stroke-width="1.5"/>'
    // Pierre en fronde au sommet, pointée sur le spectateur + brins rayonnants.
    + '<path d="M0 -55 L-6 -49 M0 -55 L6 -49" stroke="@corde" stroke-width="2" stroke-linecap="round"/>'
    + '<circle cx="0" cy="-56" r="5.5" fill="@fonte" stroke="@fer" stroke-width="1.5"/>'
    + '<circle cx="-1.8" cy="-57.8" r="1.6" fill="@fonteH"/>'
    + '</g>';
}

function back(): string {
  // Vue de DOS = côté des servants : treuil transversal à manivelles, bras fuyant vers le haut/loin.
  return '<g>'
    // Longerons vus de bout + sole (bois à l'ombre, comme les dos existants).
    + '<path d="M-26 -1 L-14 -1 L-14 -9 L-26 -9 Z" fill="@boisO" stroke="@bois" stroke-width="1.5"/>'
    + '<path d="M14 -1 L26 -1 L26 -9 L14 -9 Z" fill="@boisO" stroke="@bois" stroke-width="1.5"/>'
    + '<path d="M-24 -5 L24 -5" stroke="@bois" stroke-width="3"/>'
    + '<path d="M-19 -9 L-19 -20 M19 -9 L19 -20" stroke="@boisO" stroke-width="6" stroke-linecap="round"/>'
    // Écheveau transversal, à l'ombre.
    + '<rect x="-19" y="-26" width="38" height="10" rx="5" fill="@corde" stroke="@cordeO" stroke-width="1.5"/>'
    + '<path d="M-10 -26 L-10 -16 M0 -26 L0 -16 M10 -26 L10 -16" stroke="@cordeO" stroke-width="1"/>'
    // Bras fuyant vers le haut/loin (dos), butoir aperçu derrière au sommet.
    + '<path d="M0 -22 L0 -50" stroke="@boisO" stroke-width="7" stroke-linecap="round"/>'
    + '<path d="M-11 -44 L11 -44" stroke="@boisO" stroke-width="5" stroke-linecap="round"/>' // traverse du butoir, au loin
    + '<circle cx="0" cy="-52" r="4" fill="@boisO" stroke="@bois" stroke-width="1.5"/>' // bout du bras (pierre cachée)
    // TREUIL transversal + deux manivelles vers le spectateur (la vue « on bande l'engin »).
    + '<rect x="-16" y="-14" width="32" height="8" rx="3.5" fill="@bois" stroke="@fer" stroke-width="1.5"/>'
    + '<path d="M-16 -10 l-8 6 l6 4" fill="none" stroke="@fer" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'
    + '<path d="M16 -10 l8 6 l-6 4" fill="none" stroke="@fer" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'
    + '<path d="M0 -14 Q0 -18 0 -22" fill="none" stroke="@cordeH" stroke-width="1.6"/>' // corde treuil→bras
    + '</g>';
}

export const enginArt: EnginArtDef = { id: 'onagre', front, profile, back };

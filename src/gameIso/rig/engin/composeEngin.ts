/**
 * Gabarit ENGIN DE SIÈGE (ADE II ch.08 « Le théâtre de la guerre ») — pièce d'artillerie INERTE
 * servie par un équipage, rendue par le système de plans (comme la coque de navire) : une silhouette
 * statique recoloriée par la palette à jetons, ANCRÉE BASE-AU-SOL via `groundedBody` (pas de lévitation).
 *
 * RÉUTILISE entièrement `staticBody` (ancrage + palette) — aucune machinerie nouvelle. Le TYPE d'engin
 * (passé en `species`, id de la def : `baliste` / `canon-petit`) choisit la silhouette ; les 3 vues
 * (face / profil / dos) sont des arts dédiés, dessinés en coords LOCALES (origine = contact sol au centre,
 * l'objet monte en y NÉGATIF). Données : 1 def `creatures/defs/<Engin>.ts` route l'apparence par espèce.
 */
import type { ResolvedBone } from '../composeRig';
import type { BodyPlan } from '../bodyPlan';
import type { View } from '../facing';
import type { Palette, StoredPalette } from '../palette';
import { groundedBody } from '../staticBody';

// Jetons d'engin : bois de charpente, fonte/bronze du tube, ferrures, corde (cordage des écheveaux de
// torsion / corde d'arc). Bases CUSTOM (≠ slots créature) → `buildTokenMap` en dérive les ombres/reflets.
const ENGIN_DEFAULT: StoredPalette = { bois: '#6e4a28', fonte: '#3e3a35', fer: '#2c2822', corde: '#c2a86e' };

// ————————————————————————————————————————————————————————————————————————————————————————————————
// CANON DE REMPART (`canon-petit`) — tube de fonte sur affût à roues.
// ————————————————————————————————————————————————————————————————————————————————————————————————

/** Roue à rayons vue de FACE (cercle), centrée à l'origine locale. */
const wheelFace = (r: number): string =>
  `<g><circle r="${r}" fill="@bois" stroke="@fer" stroke-width="${r * 0.22}"/>`
  + `<circle r="${r}" fill="none" stroke="@ferH" stroke-width="1.5"/>`
  + `<path d="M0 ${-r + 2} L0 ${r - 2} M${-r + 2} 0 L${r - 2} 0 M${-(r - 3) * 0.7} ${-(r - 3) * 0.7} L${(r - 3) * 0.7} ${(r - 3) * 0.7} M${-(r - 3) * 0.7} ${(r - 3) * 0.7} L${(r - 3) * 0.7} ${-(r - 3) * 0.7}" stroke="@boisO" stroke-width="2.5"/>`
  + `<circle r="${r * 0.24}" fill="@fer"/></g>`;

/** Roue vue de PROFIL/DOS (de bout, fine) — bandage de fer épais. */
const wheelEdge = (h: number): string =>
  `<g><ellipse rx="${h * 0.27}" ry="${h * 0.5}" fill="@bois" stroke="@fer" stroke-width="3"/>`
  + `<ellipse rx="${h * 0.27}" ry="${h * 0.5}" fill="none" stroke="@ferH" stroke-width="1"/>`
  + `<circle r="3" fill="@fer"/></g>`;

function cannonProfile(): string {
  return '<g>'
    // Affût : flasque de bois (planche latérale), haut sous le tube, descendant en flèche au sol (arrière).
    + '<path d="M14 -44 L28 -42 L28 -20 L-48 -2 L-52 -9 L8 -44 Z" fill="@bois" stroke="@boisO" stroke-width="1.5"/>'
    + '<path d="M-52 -9 L-48 -2" stroke="@fer" stroke-width="2"/>' // sabot de crosse ferré
    // Tube de fonte (culasse à gauche / bouche à droite), légère élévation.
    + '<path d="M-30 -40 Q-36 -40 -36 -46 Q-36 -52 -30 -52 L46 -56 L52 -56 L52 -44 L46 -44 Z" fill="@fonte" stroke="@fer" stroke-width="1.5"/>'
    + '<line x1="-6" y1="-52.5" x2="-6" y2="-40.5" stroke="@fonteH" stroke-width="3"/>' // astragale (renfort)
    + '<line x1="22" y1="-54.5" x2="22" y2="-42.5" stroke="@fonteH" stroke-width="3"/>'
    + '<ellipse cx="52" cy="-50" rx="2" ry="5.5" fill="#0c0c10"/>' // âme (bouche)
    + '<circle cx="-39" cy="-46" r="4.5" fill="@fonte" stroke="@fer" stroke-width="1.5"/>' // bouton de culasse
    + '<circle cx="9" cy="-43" r="3.5" fill="@fonteO" stroke="@fer" stroke-width="1"/>' // tourillon
    + `<g transform="translate(12,-22)">${wheelFace(22)}</g>` // grande roue (côté proche), au sol
    + '</g>';
}

function cannonFront(): string {
  return '<g>'
    + `<g transform="translate(-34,-21)">${wheelEdge(42)}</g>` // roues de bout (flanquantes)
    + `<g transform="translate(34,-21)">${wheelEdge(42)}</g>`
    + '<path d="M-22 -4 L22 -4 L15 -42 L-15 -42 Z" fill="@bois" stroke="@boisO" stroke-width="1.5"/>' // corps d'affût (trapèze)
    + '<path d="M-18 -16 L18 -16" stroke="@boisO" stroke-width="2"/>'
    + '<circle cx="0" cy="-44" r="16" fill="@fonte" stroke="@fer" stroke-width="2"/>' // volée vue de bouche
    + '<circle cx="0" cy="-44" r="16" fill="none" stroke="@fonteH" stroke-width="2"/>'
    + '<circle cx="0" cy="-44" r="8.5" fill="#0c0c10"/>' // âme
    + '<circle cx="-4.5" cy="-48" r="3" fill="#26242a"/>' // reflet d'âme
    + '</g>';
}

function cannonBack(): string {
  return '<g>'
    + `<g transform="translate(-34,-21)">${wheelEdge(42)}</g>`
    + `<g transform="translate(34,-21)">${wheelEdge(42)}</g>`
    + '<path d="M-7 -6 L7 -6 L4 -50 L-4 -50 Z" fill="@bois" stroke="@boisO" stroke-width="1.5"/>' // flèche d'affût fuyante
    + '<path d="M-20 -6 L20 -6 L14 -38 L-14 -38 Z" fill="@boisO" stroke="@fer" stroke-width="1.5"/>' // corps d'affût (dos)
    + '<circle cx="0" cy="-40" r="14" fill="@fonte" stroke="@fer" stroke-width="2"/>' // culasse (dos du tube)
    + '<circle cx="0" cy="-40" r="6" fill="@fonteH" stroke="@fer" stroke-width="1.5"/>' // bouton de culasse
    + '<circle cx="0" cy="-52" r="2" fill="#0c0c10"/>' // lumière (mise à feu)
    + '</g>';
}

// ————————————————————————————————————————————————————————————————————————————————————————————————
// BALISTE DE REMPART (`baliste`) — grande arbalète à tour, écheveaux de torsion, sur bâti de bois.
// ————————————————————————————————————————————————————————————————————————————————————————————————

function balisteProfile(): string {
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

function balisteFront(): string {
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

function balisteBack(): string {
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

// ————————————————————————————————————————————————————————————————————————————————————————————————

const isBaliste = (species: string): boolean => /balist/.test(species);

function art(species: string, view: View): string {
  if (isBaliste(species)) return view === 'profile' ? balisteProfile() : view === 'back' ? balisteBack() : balisteFront();
  return view === 'profile' ? cannonProfile() : view === 'back' ? cannonBack() : cannonFront();
}

/** (espèce, vue, pose, couleurs) → un os statique ancré au sol. `pose.recul` = recul (tir) / bascule (mort). */
function resolveEngin(species: string, view: View, pose: Record<string, number> = {}, colors?: Palette): ResolvedBone[] {
  return groundedBody(art(species, view), ENGIN_DEFAULT, colors, { id: 'engin', tilt: pose.recul ?? 0 });
}

export const enginPlan: BodyPlan = {
  id: 'engin',
  resolve: (sp, view, pose, opts) => resolveEngin(sp, view, pose, opts?.colors),
  speciesNames: () => [], // les espèces d'engin sont listées par le registre de créatures (creatureSpeciesOptions)
  // L'engin est ANCRÉ AU SOL (bas de la boîte) → le portrait cadre ce bas (x centré, y 80→150), sinon le
  // cadre haut-avant générique ne montrerait que du vide (disque noir).
  portraitBox: '25 80 70 70',
  restPose: () => ({}),
  walkPose: () => ({}), // un engin ne marche pas (servi sur place)
  attackPose: (phase) => ({ recul: -Math.sin(Math.min(1, phase) * Math.PI) * 5 }), // léger recul au tir
  deathPose: () => ({ recul: 16 }), // affût démonté/basculé
  hasView: () => true,
};

/**
 * Parts du gabarit QUADRUPÈDE — repère LOCAL de chaque os, tokenisées (@corps/@corpsO/@corpsH
 * = robe/pelage ; @cheveux = crinière/queue ; @cuir = sabot/coussinet). Trois vues dédiées
 * (profile = côté droit ; front = face, tête à 2 yeux ; back = croupe + queue). Cible de
 * silhouette : les sprites monolithiques officiels (Loup/Chien/Ours/Rat géant/Sanglier).
 */
import type { View } from '../facing';
import type { QuadBoneId, QuadProps, QuadFoot, QuadMane } from './quadSkeleton';
import { scalesPatch, plumeFan } from '../parts/textures';

const maneOf = (p: QuadProps): QuadMane => p.mane;

// ============================ helpers ============================
// Segment CONIQUE (membre qui s'effile : cuisse→genou, canon→boulet) — la capsule droite à
// épaisseur constante lisait « pied de table ». Le contour ne démarre qu'à 30 % de la hauteur :
// le HAUT du membre (recouvert par/fondu dans le corps) n'imprime AUCUNE couture sur la robe.
const taper = (len: number, thTop: number, thBot: number, fill: string, line = '@corpsO'): string => {
  const r1 = thTop / 2, r2 = thBot / 2;
  const e = (t: number) => (r1 + (r2 * 0.92 - r1) * t).toFixed(2); // bord à la fraction t
  const y0 = (len * 0.3).toFixed(1);
  return `<path d="M${-r1} 0 Q${-r1} ${-r1 * 0.6} 0 ${-r1 * 0.6} Q${r1} ${-r1 * 0.6} ${r1} 0 L${r2 * 0.92} ${len} Q0 ${len + r2 * 0.7} ${-r2 * 0.92} ${len} Z" fill="${fill}"/>` +
    `<path d="M${-e(0.3)} ${y0} L${-r2 * 0.92} ${len} Q0 ${len + r2 * 0.7} ${r2 * 0.92} ${len} L${e(0.3)} ${y0}" fill="none" stroke="${line}" stroke-width="0.5"/>`;
};
function hoof(foot: QuadFoot, far: boolean, leather = '@cuir'): string {
  const c = far ? `${leather}O` : leather;
  const body = far ? '@corpsO' : '@corps';
  if (foot === 'sabot') // sabot net : bloc trapézoïdal compact (PAS une « botte ») + pince + couronne claire
    return `<path d="M-2.8 -1 Q-3 4 -3.4 7 Q0 9.4 3.4 7 Q3 4 2.8 -1 Q0 -2 -2.8 -1 Z" fill="${c}" stroke="#0e0b07" stroke-width="0.5"/>` +
      `<path d="M-2.9 -0.6 Q0 -2 2.9 -0.6 L2.6 1 Q0 -0.2 -2.6 1 Z" fill="@corpsH" opacity="0.3"/>` + // couronne claire (raccord poil/corne)
      `<path d="M0 1 L0 7.5" stroke="#0e0b07" stroke-width="0.4" opacity="0.5"/>`;
  if (foot === 'serre') // serre : tarse + 3 DOIGTS PLEINS posés au sol, griffes courbes — plus le râteau filaire
    return `<g><path d="M-2.8 -3 L2.8 -3 Q3.2 2 2 4 L-2 4 Q-3.2 2 -2.8 -3 Z" fill="${c}" stroke="#0e0b07" stroke-width="0.5"/>` +
      `<path d="M-2 3 Q-5.5 4 -7 8.5 Q-6.6 10 -5 9.8 Q-3 8 -1 5 Z" fill="${c}" stroke="#0e0b07" stroke-width="0.5"/>` +
      `<path d="M-1 4 Q-1.4 7 -1 9.6 Q0.4 10.6 1.6 9.6 Q2 6.5 1.4 4 Z" fill="${c}" stroke="#0e0b07" stroke-width="0.5"/>` +
      `<path d="M2 3 Q5.5 4.6 6.6 8.8 Q6 10.2 4.6 9.8 Q3 7.6 1.6 5 Z" fill="${c}" stroke="#0e0b07" stroke-width="0.5"/>` +
      `<path d="M-7 8.5 q-2 0.8 -2.4 2.8 M0.3 9.9 q0 2 -0.3 3 M6.6 8.8 q2 0.8 2.4 2.8" stroke="#0e0b07" stroke-width="1.5" fill="none" stroke-linecap="round"/></g>`;
  // patte : extrémité du MEMBRE (couleur du corps, plus le godet sombre), doigts ronds + griffes
  return `<g><path d="M-4 -3 Q-5 5 -3 8.5 Q0 10.5 3.4 8.8 Q5.6 5 4.6 -3 Z" fill="${body}" stroke="@corpsO" stroke-width="0.5"/>` +
    `<path d="M-3.4 8 Q-2.4 10.4 -1 10.6 Q0 9 -0.6 7.4 Z M-0.2 8.2 Q0.8 10.8 2.2 10.6 Q3 9 2.2 7.4 Z M2.8 7.6 Q4 9.8 5 9.2 Q5.4 7.6 4.4 6.4 Z" fill="${c}" stroke="#0e0b07" stroke-width="0.4"/>` +
    `<path d="M-1 10.6 l-0.3 2.6 M2.2 10.6 l0.2 2.6 M5 9.2 l0.8 2.2" stroke="#15110c" stroke-width="1.3" stroke-linecap="round"/></g>`;
}
function footFront(foot: QuadFoot, far: boolean, leather = '@cuir'): string {
  const c = far ? `${leather}O` : leather;
  const body = far ? '@corpsO' : '@corps';
  if (foot === 'sabot') return `<ellipse cx="0" cy="3" rx="3.4" ry="3" fill="${c}" stroke="#0e0b07" stroke-width="0.5"/>`;
  if (foot === 'serre') // 3 doigts pleins écartés (pas des fils)
    return `<g><path d="M-0.8 -1 Q-4.4 2.5 -5.2 7.5 Q-4.4 9 -3 8.4 Q-1.6 5 -0.4 2 Z" fill="${c}" stroke="#0e0b07" stroke-width="0.4"/>` +
      `<path d="M-0.8 0 Q-1.2 4 -0.8 8.6 Q0.2 9.6 1.2 8.6 Q1.4 4 1 0 Z" fill="${c}" stroke="#0e0b07" stroke-width="0.4"/>` +
      `<path d="M0.8 -1 Q4.4 2.5 5.2 7.5 Q4.4 9 3 8.4 Q1.6 5 0.4 2 Z" fill="${c}" stroke="#0e0b07" stroke-width="0.4"/>` +
      `<path d="M-5.2 7.5 l-1 2 M0.2 8.9 l0 2.2 M5.2 7.5 l1 2" stroke="#0e0b07" stroke-width="1.1" stroke-linecap="round"/></g>`;
  return `<g><path d="M-3.6 -1 Q-4.2 5 0 6.6 Q4.2 5 3.6 -1 Z" fill="${body}" stroke="@corpsO" stroke-width="0.45"/>` +
    `<ellipse cx="-2" cy="5.8" rx="1.2" ry="1.5" fill="${c}"/><ellipse cx="0.1" cy="6.5" rx="1.2" ry="1.5" fill="${c}"/><ellipse cx="2.2" cy="5.8" rx="1.2" ry="1.5" fill="${c}"/>` +
    `<path d="M-2 7.2 l0 2 M0.1 7.9 l0 2 M2.2 7.2 l0 2" stroke="#15110c" stroke-width="1" stroke-linecap="round"/></g>`;
}
// Articulation (épaule/genou/boulet) : pastille de la couleur du membre qui BOUCHE le trou
// entre deux segments capsulés (défaut « segments empilés avec gaps »).
const joint = (body: string, cy: number, r: number, line = '@corpsO') =>
  `<circle cx="0" cy="${cy.toFixed(1)}" r="${r}" fill="${body}" stroke="${line}" stroke-width="0.3"/>`;

// Morphologie des MEMBRES par carrure (anti « jouet de bois » : pattes-cylindres identiques) :
// masse de cuisse/épaule fondue dans le corps en haut, canon plus fin en bas, jarret marqué.
//   mass = largeur de la masse musculaire haute (demi-épaisseur), taper = épaisseur du canon.
const LEG_BUILD: Record<string, { mass: number; haut: number; bas: number }> = {
  equine: { mass: 6.2, haut: 8.5, bas: 5.2 }, // cheval : cuisse pleine, canons FINS
  canine: { mass: 5.2, haut: 7.5, bas: 4.8 }, // loup/chien : svelte, jarret net
  suid: { mass: 5.5, haut: 8, bas: 5.5 }, // sanglier : courtes et fortes
  rodent: { mass: 4.5, haut: 7, bas: 4.5 },
  ursine: { mass: 8.5, haut: 12, bas: 9 }, // ours : poteaux massifs
  feline: { mass: 6.8, haut: 9, bas: 5.5 }, // lion : haunches musclées, canon fin
  draconic: { mass: 8, haut: 11, bas: 7.5 },
  batracien: { mass: 7.5, haut: 10, bas: 7 },
};
// Masse musculaire HAUTE (cuisse/épaule) : goutte qui s'effile dans le membre — SANS contour
// (elle FOND dans la robe du corps, sinon elle lit comme une plaque collée), juste une ombre
// interne courbe pour le galbe. Courte (≤ 0.36 du membre) : le canon reste fin dessous.
const muscle = (body: string, m: number, len: number) =>
  `<path d="M${-m} -3 Q${-m - 0.8} ${len * 0.2} ${-m * 0.4} ${len * 0.36} Q0 ${len * 0.46} ${m * 0.4} ${len * 0.36} Q${m + 0.8} ${len * 0.2} ${m} -3 Q0 ${-m * 0.9} ${-m} -3 Z" fill="${body}"/>`;

// Balzane (markings==='balzanes') : « chaussette » claire au bas du canon, au-dessus du sabot.
const balzane = (p: QuadProps, ll: number, w: number, far: boolean): string =>
  p.markings === 'balzanes'
    ? `<path data-marking="balzanes" d="M${-w * 0.46} ${22 * ll - 7} L${w * 0.46} ${22 * ll - 7} L${w * 0.45} ${22 * ll} Q0 ${22 * ll + 3} ${-w * 0.45} ${22 * ll} Z" fill="#e9e4d6" opacity="${far ? 0.55 : 0.9}"/>`
    : '';

// Membre AVANT de rapace (`fore` vrai + foreCoat) : cuisse dans la robe des AILES (@aile —
// l'avant-train rapace porte le même plumage), culotte de plumes retombant sur un canon-TARSE
// écailleux (famille custom @cuirAv) fin, serres de la même famille.
function legParts(p: QuadProps, far: boolean, foot: QuadFoot, fore = false) {
  const ll = p.legLen;
  const plumed = fore && !!p.foreCoat;
  const body = plumed ? (far ? '@aileO' : '@aile') : (far ? '@corpsO' : '@corps');
  const leather = plumed ? '@cuirAv' : '@cuir';
  const L = LEG_BUILD[p.build] ?? LEG_BUILD.equine;
  // canon : plus FIN que la cuisse, s'effile vers le boulet ; jarret/genou bouché à la jointure.
  const bas = plumed
    ? joint(body, 0, (L.bas + 1.4) * 0.52, '@aileO') + taper(22 * ll, L.bas + 0.2, L.bas * 0.72, leather, '@cuirAvO') +
      scalesPatch(-L.bas * 0.34, L.bas * 0.34, 7, 22 * ll - 2, 2.4, 'cuirAv') +
      // culotte de plumes sur le haut du tarse (pointes dentelées)
      `<path d="M${(-(L.bas / 2 + 1.8)).toFixed(1)} -1.5 q-0.8 4.6 0.4 7.2 l1.9 -3.6 l1 4.2 l2 -3.8 l1.3 4 l1.9 -3.4 q1.3 -2.8 0.7 -5 Q0 ${(-L.bas * 0.5).toFixed(1)} ${(-(L.bas / 2 + 1.8)).toFixed(1)} -1.5 Z" fill="${body}" stroke="@aileO" stroke-width="0.4"/>` +
      joint(leather, 22 * ll, L.bas * 0.38, '@cuirAvO')
    : joint(body, 0, (L.bas + 1.4) * 0.52) + taper(22 * ll, L.bas + 0.6, L.bas * 0.78, body) + joint(body, 22 * ll, L.bas * 0.4) + balzane(p, ll, L.bas + 0.6, far);
  return {
    haut: muscle(body, L.mass, 30 * ll) + taper(30 * ll, L.haut, L.bas + 1.4, body, plumed ? '@aileO' : '@corpsO'), // cuisse → genou
    bas,
    pied: hoof(foot, far, leather), // sabot À l'os du pied (bas de la jambe) — PAS 22·ll plus bas (sinon détaché)
  };
}
function legPartsFront(p: QuadProps, far: boolean, foot: QuadFoot, fore = false) {
  const ll = p.legLen;
  const plumed = fore && !!p.foreCoat;
  const body = plumed ? (far ? '@aileO' : '@aile') : (far ? '@corpsO' : '@corps');
  const leather = plumed ? '@cuirAv' : '@cuir';
  const L = LEG_BUILD[p.build] ?? LEG_BUILD.equine;
  const k = far ? 0.84 : 1;
  // Membre FRONTAL = colonne d'aplomb, plus PLEINE qu'en profil (le canon ne s'effile presque
  // pas, sinon « patte d'insecte »). Cuisse haute fondue dans le corps, canon trapu jusqu'au pied.
  const shin = plumed ? leather : body;
  const lineB = plumed ? '@cuirAvO' : '@corpsO';
  return {
    haut: muscle(body, L.mass * 0.5 * k, 26 * ll) + taper(30 * ll, L.haut * 0.95 * k, (L.bas + 1.8) * k, body, plumed ? '@aileO' : '@corpsO'),
    bas: joint(body, 0, (L.bas + 1.8) * k * 0.5, plumed ? '@aileO' : '@corpsO') + taper(22 * ll, (L.bas + 1.2) * k, L.bas * 0.95 * k, shin, lineB) +
      (plumed ? scalesPatch(-L.bas * 0.4 * k, L.bas * 0.4 * k, 6, 22 * ll - 2, 2.4, 'cuirAv') : '') +
      joint(shin, 22 * ll, L.bas * 0.46, lineB) + (plumed ? '' : balzane(p, ll, (L.bas + 1.2) * k, far)),
    pied: footFront(foot, far, leather), // pied à l'os (bas de la jambe), pas 22·ll plus bas
  };
}
// Œil CALME d'animal : iris sombre + petit reflet (pas le glow jaune g_eye, qui faisait
// « yeux démoniaques/globuleux » sur cheval/ours/rat). ANCRÉ `data-eye`/`data-ec` (même
// convention que les visages bipèdes, cf. parts/eyes.ts) → yeux custom branchables.
const eyeF = (x: number, y = -3, r = 1.7) =>
  `<g data-eye="${x < 0 ? 'G' : 'D'}" data-ec="${x} ${y}"><ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r + 0.3}" fill="#15100a"/><circle cx="${(x + 0.4).toFixed(1)}" cy="${(y - 0.4).toFixed(1)}" r="${(r * 0.34).toFixed(2)}" fill="#fff" opacity="0.7"/></g>`;

// ============================ PROFIL ============================
// CORPS ENTIER en UNE SEULE silhouette continue (poitrail → garrot → dos → croupe → cuisse →
// ventre), dessinée dans le tronc — l'ex-assemblage barrique + croupe-bulle détourées
// séparément lisait « deux pièces mal soudées / croupe-ballon » (retour utilisateur + juges).
// +x = avant. La croupe (os) ne porte plus que pattes arrière/queue ; l'arrière-train vit ici
// (la croupe ne tourne que de quelques degrés en anim — perte négligeable, couture supprimée).
// La profondeur est encore étirée par girth (scale vertical au rendu).
function barrel(p: QuadProps): string {
  const bl = p.bodyLen;
  const X = (n: number) => (n * bl).toFixed(1);
  let path: string, hi: string, lo: string;
  switch (p.build) {
    case 'suid': // bosse d'épaule HAUTE à l'avant, dos qui DÉVALE vers un arrière fin et bas + soies
      path = `M${X(31)} -16 Q${X(34)} -8 ${X(33)} 1 Q${X(31)} 12 ${X(22)} 16 Q${X(4)} 19 ${X(-18)} 16 Q${X(-32)} 17 ${X(-38)} 12 Q${X(-44)} 6 ${X(-43)} -2 Q${X(-42)} -9 ${X(-36)} -11 Q${X(-20)} -14 ${X(-6)} -20 Q${X(4)} -29 ${X(14)} -27 Q${X(26)} -24 ${X(31)} -16 Z`;
      hi = `<path d="M${X(-4)} -23 Q${X(6)} -30 ${X(16)} -26" fill="none" stroke="@cheveux" stroke-width="2.4" opacity="0.85" stroke-linecap="round"/><path d="M${X(-2)} -23 l-1 4 M${X(4)} -26 l-1 4 M${X(10)} -27.5 l0 4 M${X(15)} -26 l1 4" stroke="@cheveux" stroke-width="1" opacity="0.7"/>`;
      lo = `<path d="M${X(-40)} 8 Q${X(-10)} 18 ${X(24)} 13 L${X(26)} 8 Q${X(-8)} 14 ${X(-39)} 4 Z" fill="@corpsO" opacity="0.8"/>`;
      break;
    case 'rodent': // dos ARQUÉ culminant à l'arrière-milieu, avant bas, grosses hanches
      path = `M${X(30)} -6 Q${X(33)} 0 ${X(31)} 6 Q${X(27)} 12 ${X(18)} 13 Q${X(2)} 15 ${X(-16)} 13 Q${X(-32)} 14 ${X(-40)} 9 Q${X(-46)} 3 ${X(-45)} -5 Q${X(-44)} -14 ${X(-34)} -18 Q${X(-18)} -23 ${X(-2)} -20 Q${X(16)} -16 ${X(30)} -6 Z`;
      hi = `<path d="M${X(-34)} -16 Q${X(-14)} -22 ${X(4)} -18 L${X(3)} -14 Q${X(-14)} -18 ${X(-32)} -12 Z" fill="@corpsH" opacity="0.5"/>`;
      lo = `<path d="M${X(-42)} 7 Q${X(-10)} 14 ${X(22)} 10 L${X(24)} 5 Q${X(-8)} 11 ${X(-41)} 3 Z" fill="@corpsO" opacity="0.8"/>`;
      break;
    case 'ursine': // MASSIF : bosse d'épaule, tout en profondeur, arrière rond et lourd
      path = `M${X(30)} -12 Q${X(34)} -4 ${X(33)} 6 Q${X(30)} 17 ${X(20)} 20 Q${X(2)} 24 ${X(-16)} 21 Q${X(-34)} 22 ${X(-42)} 14 Q${X(-48)} 6 ${X(-46)} -4 Q${X(-44)} -14 ${X(-34)} -18 Q${X(-20)} -22 ${X(-6)} -24 Q${X(6)} -28 ${X(16)} -24 Q${X(26)} -20 ${X(30)} -12 Z`;
      hi = `<path d="M${X(-16)} -21 Q${X(2)} -27 ${X(16)} -23 L${X(15)} -18 Q${X(2)} -22 ${X(-15)} -16 Z" fill="@corpsH" opacity="0.55"/>`;
      lo = `<path d="M${X(-42)} 12 Q${X(-8)} 22 ${X(24)} 14 L${X(26)} 8 Q${X(-6)} 18 ${X(-41)} 6 Z" fill="@corpsO" opacity="0.85"/>`;
      if (p.head === 'ours') // bosse d'épaule saillante + pelage en touffes COUCHÉES (pas de piquants
        // dressés — ils lisaient « échine à pics ») + balafres de griffes à l'épaule (artwork LDB 78 p.317)
        hi += `<path d="M${X(-2)} -25 Q${X(6)} -29.5 ${X(14)} -26.5 Q${X(20)} -24 ${X(22)} -20 Q${X(15)} -23.5 ${X(6)} -24 Q${X(0)} -24.5 ${X(-4)} -23 Z" fill="@corpsH" opacity="0.5"/>` + // bosse dorsale d'épaule
          `<path d="M${X(-30)} -16.5 q-3 0.6 -4.6 2.4 M${X(-22)} -19 q-3 0.4 -4.8 2 M${X(-14)} -20.5 q-3 0.3 -5 1.8 M${X(-6)} -22.5 q-3 0.2 -5 1.6 M${X(2)} -25.5 q-3 0.2 -5.2 1.4 M${X(10)} -25 q-3.2 0 -5.4 1.2 M${X(18)} -23 q-3 -0.2 -5.2 1" stroke="@corpsO" stroke-width="0.9" fill="none" opacity="0.5" stroke-linecap="round"/>` + // touffes couchées le long du dos
          `<path d="M${X(-38)} 6 l-2.2 2.6 M${X(-30)} 12 l-1.8 3 M${X(-20)} 16 l-1.2 3.2 M${X(-8)} 19 l-0.8 3.4 M${X(4)} 20 l-0.4 3.4 M${X(16)} 18 l0.2 3.2" stroke="@corpsO" stroke-width="1" stroke-linecap="round" opacity="0.55"/>` + // franges du ventre
          `<path d="M${X(-14)} -10 q3 5 2.4 11 M${X(-4)} -12 q3 5 2.4 11 M${X(6)} -13 q2.8 5 2.2 10 M${X(15)} -11 q2.6 4.6 2 9" stroke="@corpsO" stroke-width="0.8" fill="none" opacity="0.35"/>` + // mèches de flanc
          `<path d="M${X(2)} -18 l7 9 M${X(7)} -19 l7 9 M${X(13)} -18 l6 8" stroke="#6e3226" stroke-width="1.1" stroke-linecap="round" opacity="0.8"/>`; // balafres de griffes
      break;
    case 'canine': // loup/chien : garrot haut, DOS qui plonge vers la croupe, poitrail PROFOND
      // descendu au coude, fort RELEVÉ de ventre (flanc creusé) au niveau du rein — silhouette
      // lévrier/lupin, pas un tube. +x = avant.
      path = `M${X(30)} 2 Q${X(33)} -8 ${X(31)} -12 Q${X(28)} -17 ${X(22)} -17 Q${X(4)} -16 ${X(-12)} -14 Q${X(-30)} -12 ${X(-40)} -7 Q${X(-45)} -2 ${X(-43)} 3 Q${X(-40)} 6 ${X(-33)} 6 Q${X(-24)} 6 ${X(-18)} 3 Q${X(-8)} 7 ${X(4)} 11 Q${X(16)} 14 ${X(25)} 13 Q${X(31)} 8 ${X(30)} 2 Z`;
      hi = `<path d="M${X(-28)} -13 Q${X(-4)} -16 ${X(18)} -16 L${X(17)} -12 Q${X(-4)} -13 ${X(-27)} -9 Z" fill="@corpsH" opacity="0.5"/>`;
      lo = `<path d="M${X(-33)} 5 Q${X(-22)} 5 ${X(-16)} 2.5 Q${X(-6)} 6 ${X(6)} 10 Q${X(18)} 13 ${X(24)} 11 L${X(22)} 7 Q${X(14)} 9 ${X(4)} 6 Q${X(-8)} 3 ${X(-18)} 0 Q${X(-26)} 1.5 ${X(-32)} 1 Z" fill="@corpsO" opacity="0.7"/>`;
      if (p.head === 'loup-feroce') // pelage MÊLÉ du loup (artwork LDB p.317) : POITRAIL beige,
        // bande claire du bas de flanc/ventre au-dessus de l'ombre, mèches sombres du dos
        hi += `<path d="M${X(24)} -8 Q${X(30)} -4 ${X(30)} 3 Q${X(29)} 9 ${X(25)} 12 Q${X(22)} 9 ${X(22)} 2 Q${X(22)} -4 ${X(24)} -8 Z" fill="@corpsH" opacity="0.45"/>` +
          `<path d="M${X(-16)} 1 Q${X(-6)} 4.5 ${X(4)} 8 Q${X(12)} 10.3 ${X(19)} 11 L${X(18)} 8.6 Q${X(10)} 7.6 ${X(2)} 5.2 Q${X(-8)} 2 ${X(-15)} -1 Z" fill="@corpsH" opacity="0.35"/>` +
          `<path d="M${X(-24)} -9.5 q2.6 3.4 2 7.6 M${X(-14)} -11.5 q2.6 3.6 2 8 M${X(-4)} -13 q2.6 3.6 2 8 M${X(6)} -13.8 q2.4 3.4 1.8 7.6 M${X(15)} -14.5 q2.2 3.2 1.6 7" stroke="@corpsO" stroke-width="0.8" fill="none" opacity="0.4"/>`;
      break;
    case 'feline': // poitrail profond + TAILLE creusée + haunches arrière rondes et musclées
      path = `M${X(30)} -15 Q${X(34)} -8 ${X(33)} 0 Q${X(31)} 8 ${X(23)} 10 Q${X(10)} 11 ${X(0)} 8 Q${X(-12)} 5 ${X(-22)} 8 Q${X(-36)} 12 ${X(-43)} 6 Q${X(-48)} -1 ${X(-45)} -9 Q${X(-42)} -16 ${X(-32)} -17 Q${X(-16)} -19 ${X(-2)} -20 Q${X(12)} -23 ${X(23)} -20 Q${X(29)} -18 ${X(30)} -15 Z`;
      hi = `<path d="M${X(-28)} -15 Q${X(-4)} -20 ${X(20)} -19 L${X(19)} -15 Q${X(-4)} -16 ${X(-27)} -11 Z" fill="@corpsH" opacity="0.55"/>`;
      lo = `<path d="M${X(-40)} 4 Q${X(-20)} 10 ${X(-2)} 5 Q${X(14)} 8 ${X(25)} 3 L${X(23)} -1 Q${X(12)} 5 ${X(-2)} 2 Q${X(-20)} 7 ${X(-39)} 0 Z" fill="@corpsO" opacity="0.8"/>`;
      break;
    case 'draconic': { // LONG et profond, ventre lourd qui ondule, arrière qui file vers la queue
      path = `M${X(30)} -14 Q${X(35)} -6 ${X(34)} 4 Q${X(32)} 17 ${X(20)} 22 Q${X(2)} 26 ${X(-14)} 22 Q${X(-32)} 24 ${X(-42)} 16 Q${X(-50)} 9 ${X(-48)} -1 Q${X(-46)} -11 ${X(-36)} -15 Q${X(-20)} -19 ${X(-4)} -20 Q${X(12)} -23 ${X(22)} -20 Q${X(28)} -18 ${X(30)} -14 Z`;
      hi = `<path d="M${X(-32)} -14 Q${X(-6)} -20 ${X(20)} -19 L${X(19)} -15 Q${X(-6)} -16 ${X(-31)} -10 Z" fill="@corpsH" opacity="0.5"/>`;
      lo = `<path d="M${X(-44)} 12 Q${X(-8)} 25 ${X(24)} 16 L${X(26)} 9 Q${X(-6)} 20 ${X(-43)} 6 Z" fill="@corpsO" opacity="0.85"/>` +
        // cuir d'écailles imbriquées (textures.ts) sur le flanc — le ventre lourd reste lisse
        scalesPatch(-40 * bl, 26 * bl, -12, 9, 4.6, 'corps');
      break;
    }
    case 'batracien': { // sac TRÈS large, bas et rond (pas de dos défini), dos verruqueux
      path = `M${X(26)} -14 Q${X(33)} -8 ${X(33)} 2 Q${X(32)} 17 ${X(18)} 21 Q${X(0)} 24 ${X(-20)} 21 Q${X(-36)} 18 ${X(-38)} 6 Q${X(-39)} -8 ${X(-28)} -16 Q${X(-12)} -23 ${X(4)} -23 Q${X(18)} -22 ${X(26)} -14 Z`;
      hi = `<path d="M${X(-22)} -16 Q${X(-4)} -22 ${X(14)} -19 L${X(13)} -14 Q${X(-4)} -18 ${X(-21)} -11 Z" fill="@corpsH" opacity="0.5"/>`;
      lo = `<path d="M${X(-34)} 10 Q${X(-4)} 21 ${X(22)} 13 L${X(24)} 6 Q${X(-4)} 17 ${X(-33)} 4 Z" fill="@corpsO" opacity="0.85"/>` +
        `<circle cx="${X(-16)}" cy="-13" r="1.7" fill="@corpsO"/><circle cx="${X(-4)}" cy="-17" r="2" fill="@corpsO"/><circle cx="${X(7)}" cy="-16" r="1.6" fill="@corpsO"/><circle cx="${X(15)}" cy="-12" r="1.5" fill="@corpsO"/><circle cx="${X(-9)}" cy="-8" r="1.3" fill="@corpsO"/><circle cx="${X(2)}" cy="-6" r="1.4" fill="@corpsO"/>`;
      break;
    }
    default: // equine : poitrail profond, GARROT marqué, dos level, croupe arrondie qui descend en cuisse
      path = `M${X(30)} -15 Q${X(34)} -7 ${X(33)} 2 Q${X(30)} 13 ${X(20)} 16 Q${X(2)} 19 ${X(-16)} 16 Q${X(-32)} 18 ${X(-40)} 12 Q${X(-47)} 5 ${X(-45)} -5 Q${X(-43)} -15 ${X(-32)} -17 Q${X(-14)} -19 ${X(0)} -19 Q${X(12)} -23 ${X(23)} -20 Q${X(29)} -18 ${X(30)} -15 Z`;
      hi = `<path d="M${X(-30)} -15 Q${X(-6)} -18 ${X(20)} -19 L${X(19)} -15 Q${X(-6)} -15 ${X(-29)} -11 Z" fill="@corpsH" opacity="0.6"/>`;
      lo = `<path d="M${X(-40)} 9 Q${X(-6)} 18 ${X(24)} 12 L${X(26)} 6 Q${X(-4)} 14 ${X(-39)} 4 Z" fill="@corpsO" opacity="0.85"/>`;
  }
  // Volumes internes SANS contour : ombre de flanc + creux de cuisse (l'arrière-train se lit
  // par l'ombrage, plus par une bulle détourée).
  const flank = `<ellipse cx="${X(0)}" cy="4" rx="${X(13)}" ry="5.5" fill="@corpsO" opacity="0.22"/>`;
  const thigh = `<path d="M${X(-26)} -8 Q${X(-38)} -4 ${X(-38)} 5 Q${X(-37)} 12 ${X(-29)} 13 Q${X(-22)} 12 ${X(-21)} 3 Q${X(-21)} -5 ${X(-26)} -8 Z" fill="@corpsO" opacity="0.16"/>` +
    `<path d="M${X(-24)} -10 Q${X(-34)} -7 ${X(-36)} 2" fill="none" stroke="@corpsO" stroke-width="0.8" opacity="0.4"/>`;
  return `<g><path d="${path}" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>${lo}${flank}${thigh}${hi}${ridgeArt(p)}${markingsArt(p)}${foreCoatArt(p)}</g>`;
}
// ---- Avant-train EMPLUMÉ (prop `foreCoat`) : manteau de plumes sur garrot/épaule/poitrail dans
// la robe des AILES (@aile — la moitié rapace est d'un seul plumage), bord arrière FESTONNÉ
// (pointes de couvertures), hampes + mouchetures claires @aileH — le contraste mi-aigle /
// mi-cheval de l'hippogriffe (artwork LDB 79 p.323) vit ici, la moitié ARRIÈRE du tronc garde la
// robe @corps. Dessiné PAR-DESSUS la silhouette continue de barrel().
function foreCoatArt(p: QuadProps): string {
  if (!p.foreCoat) return '';
  const bl = p.bodyLen;
  const X = (n: number) => (n * bl).toFixed(1);
  // bord arrière : remonte du brisket (x≈21·bl) au garrot en dents de plumes — chaque dent
  // descend PUIS remonte, x strictement décroissant (un contour simple, jamais croisé :
  // la 1re version en Q non monotones s'auto-croisait et annulait son propre remplissage)
  const edge = Array.from({ length: 6 }, () => `l${X(-1)} 3.4 l${X(-1.8)} -9.3 `).join('');
  const coat = `<path d="M${X(4)} -20 Q${X(18)} -23 ${X(27)} -18.5 Q${X(33.8)} -9 ${X(32.8)} 1 Q${X(30)} 12 ${X(21)} 15.6 ${edge}Z" fill="@aile" stroke="@aileO" stroke-width="0.6"/>`;
  // ombre du bord de poitrail (rondeur) + hampes de plumes + mouchetures claires
  const shade = `<path d="M${X(30)} -12 Q${X(33)} -4 ${X(31.6)} 3 Q${X(29.4)} 11 ${X(21)} 14.4 L${X(20)} 11 Q${X(27.4)} 8 ${X(29)} 0 Q${X(29.8)} -7 ${X(27)} -12 Z" fill="@aileO" opacity="0.5"/>`;
  const quills = `<path d="M${X(8)} -14 q-3 5 -3.4 10 M${X(14)} -12 q-3 6 -3.2 12 M${X(20)} -9 q-2.6 6 -2.6 12 M${X(25)} -5 q-2.2 5 -2 10" stroke="@aileO" stroke-width="0.8" fill="none" opacity="0.6"/>`;
  const dots = ([[9, -8], [13, -2], [17, 4], [22, -1], [26, 5], [11, 6], [20, 10], [27, -8], [15, -14], [24, -12]] as const)
    .map(([x, y]) => `<circle cx="${X(x)}" cy="${y}" r="0.9" fill="@aileH"/>`).join('');
  return `<g data-fore="plumes">${coat}${shade}${quills}<g opacity="0.75">${dots}</g></g>`;
}
// Plastron de FACE du manteau : épaules + haut de poitrail @aile, bord bas festonné, mouchetures.
function foreCoatFront(p: QuadProps): string {
  if (!p.foreCoat) return '';
  const teeth = 'l-1.4 4.6 l-4 -4.6 '.repeat(5);
  const coat = `<path d="M-16.4 -8 Q-17.4 -22.6 -7.8 -27.4 Q0 -29.4 7.8 -27.4 Q17.4 -22.6 16.4 -8 Q16 1 13.6 8 ${teeth}Q-16 1 -16.4 -8 Z" fill="@aile" stroke="@aileO" stroke-width="0.6"/>`;
  const sheen = `<path d="M-5.6 -24 Q0 -26.6 5.6 -24 Q6.4 -8 4 6 Q0 9 -4 6 Q-6.4 -8 -5.6 -24 Z" fill="@aileH" opacity="0.32"/>`;
  const groove = `<path d="M0 -25 Q0.4 -6 0 8" fill="none" stroke="@aileO" stroke-width="0.7" opacity="0.4"/>`;
  const dots = ([[-9, -14], [9, -14], [-11, -4], [11, -4], [-6, 0], [6, 0], [-3, -8], [3, -8], [0, 3]] as const)
    .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="0.85" fill="@aileH"/>`).join('');
  return `<g data-fore="plumes">${coat}${sheen}${groove}<g opacity="0.75">${dots}</g></g>`;
}
// Dorsale (prop `ridge`, défaut 'epines' pour draconic) : ÉPINES pointues / CRÊTE-voile
// ondulée / PLAQUES rondes, le long du haut du dos. Coordonnées calées sur le dos draconic —
// les autres builds varient de quelques px (acceptable : la dorsale vit sur les reptiliens).
function ridgeArt(p: QuadProps): string {
  const r = p.ridge ?? (p.build === 'draconic' ? 'epines' : 'sans');
  if (r === 'sans') return '';
  const bl = p.bodyLen;
  if (p.head === 'hydre') { // crête de FLAMMES rouge-orangé (@cheveux) le long du dos — signature artwork LDB p.323
    const fl = (x: number, y: number, h: number) =>
      `M${(x * bl).toFixed(1)} ${y} Q${(x * bl - 2).toFixed(1)} ${y - h * 0.7} ${(x * bl - 3.6).toFixed(1)} ${y - h} Q${(x * bl - 1).toFixed(1)} ${y - h * 0.4} ${(x * bl + 3).toFixed(1)} ${y} Z`;
    return `<g data-ridge="crete-hydre"><path d="${fl(-34, -9, 6)}${fl(-26, -12, 7)}${fl(-18, -14.5, 8)}${fl(-10, -16.5, 8.5)}${fl(-2, -17.5, 8)}${fl(6, -18, 7.5)}${fl(14, -17, 6.5)}" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.5"/></g>`;
  }
  if (p.head === 'dechiqueteur') { // haie de PIQUANTS noirs garrot→croupe (artwork ZI p.58 :
    // dos hérissé de longues épines sombres — bien plus proéminentes que les 'epines' génériques)
    const q = (x: number, y: number, h: number) =>
      `M${(x * bl).toFixed(1)} ${y} Q${(x * bl - 1.6).toFixed(1)} ${(y - h * 0.7).toFixed(1)} ${(x * bl - 3.2).toFixed(1)} ${y - h} Q${(x * bl - 0.4).toFixed(1)} ${(y - h * 0.3).toFixed(1)} ${(x * bl + 2.4).toFixed(1)} ${y + 0.4} Z`;
    return `<g data-ridge="piquants"><path d="${q(20, -18, 8)}${q(14, -19.5, 10)}${q(8, -20.5, 11)}${q(2, -21, 11.5)}${q(-4, -20.5, 11)}${q(-10, -19.5, 10)}${q(-16, -18, 9)}${q(-22, -16.5, 8)}${q(-28, -15, 6.5)}" fill="@corpsO" stroke="#14161c" stroke-width="0.45"/></g>`;
  }
  if (r === 'epines')
    return `<g data-ridge="epines"><path d="M${-20 * bl} -14 l-1 -5 l3 4 M${-8 * bl} -19 l0 -6 l3 5 M${6 * bl} -21 l1 -6 l2 5 M${18 * bl} -18 l1 -5 l2 4" fill="@corpsO" stroke="@corpsO" stroke-width="0.5"/></g>`;
  if (r === 'epines-continues') { // rangée SERRÉE d'épines coniques (@cheveux) garrot→croupe sur voile
    // orangée — signature artwork du Basilic (LDB 79 p.319) ; la continuité tête→queue s'obtient avec la
    // crête de la tête 'basilic' + mane 'hirsute' (encolure) + la crête de queue 'reptile'.
    const ep = (x: number, y: number, h: number) =>
      `M${(x * bl).toFixed(1)} ${y} Q${(x * bl - 1.8).toFixed(1)} ${(y - h * 0.72).toFixed(1)} ${(x * bl - 3).toFixed(1)} ${y - h} Q${(x * bl - 0.6).toFixed(1)} ${(y - h * 0.32).toFixed(1)} ${(x * bl + 2.8).toFixed(1)} ${y + 0.4} Z`;
    return `<g data-ridge="epines-continues">` +
      `<path d="M${(24 * bl).toFixed(1)} -17.5 Q${(14 * bl).toFixed(1)} -25 ${(2 * bl).toFixed(1)} -25.5 Q${(-12 * bl).toFixed(1)} -24 ${(-26 * bl).toFixed(1)} -18.5 L${(-26 * bl).toFixed(1)} -14 Q${(-12 * bl).toFixed(1)} -19 ${(24 * bl).toFixed(1)} -14 Z" fill="#c07b32" opacity="0.55"/>` +
      `<path d="${ep(22, -19.5, 6)}${ep(16, -20.5, 7.5)}${ep(10, -21, 8.5)}${ep(4, -21, 9)}${ep(-2, -20, 8.5)}${ep(-8, -19, 8)}${ep(-14, -17.5, 7)}${ep(-20, -16, 6)}${ep(-26, -14.5, 5)}" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.5"/></g>`;
  }
  if (r === 'crete') // voile continue ondulée
    return `<g data-ridge="crete"><path d="M${-21 * bl} -12 Q${-17 * bl} -23 ${-11 * bl} -16 Q${-5 * bl} -26 ${1 * bl} -18 Q${7 * bl} -27 ${13 * bl} -18 Q${18 * bl} -24 ${22 * bl} -15 L${21 * bl} -12 Q0 -19 ${-20 * bl} -10 Z" fill="@corpsO" opacity="0.92" stroke="@cheveuxO" stroke-width="0.5"/></g>`;
  // plaques rondes (stégo-like)
  return `<g data-ridge="plaques"><ellipse cx="${-15 * bl}" cy="-15" rx="3.4" ry="4.4" fill="@corpsO" stroke="@cheveuxO" stroke-width="0.5"/><ellipse cx="${-5 * bl}" cy="-19" rx="3.8" ry="5" fill="@corpsO" stroke="@cheveuxO" stroke-width="0.5"/><ellipse cx="${6 * bl}" cy="-20" rx="3.8" ry="5" fill="@corpsO" stroke="@cheveuxO" stroke-width="0.5"/><ellipse cx="${16 * bl}" cy="-16" rx="3.2" ry="4.2" fill="@corpsO" stroke="@cheveuxO" stroke-width="0.5"/></g>`;
}
// Marquages de ROBE (prop `markings`) : taches/rayures sur le flanc (les balzanes vivent sur
// les MEMBRES, cf. legParts). Sombre sur robe claire (op. soutenue), discret sinon.
function markingsArt(p: QuadProps): string {
  const m = p.markings ?? 'sans';
  if (m !== 'taches' && m !== 'rayures') return '';
  const bl = p.bodyLen;
  if (m === 'taches')
    return `<g data-marking="taches" opacity="0.5"><ellipse cx="${-14 * bl}" cy="-4" rx="4.6" ry="3.4" fill="@corpsO"/><ellipse cx="${-2 * bl}" cy="3" rx="3.6" ry="2.8" fill="@corpsO"/><ellipse cx="${12 * bl}" cy="-7" rx="4" ry="3" fill="@corpsO"/><ellipse cx="${18 * bl}" cy="2" rx="2.8" ry="2.2" fill="@corpsO"/></g>`;
  return `<g data-marking="rayures" opacity="0.45"><path d="M${-16 * bl} -16 q-2 12 -1 22 M${-8 * bl} -19 q-2 13 -1 25 M${0 * bl} -20 q-2 13 -1 26 M${8 * bl} -20 q-1 13 0 25 M${15 * bl} -18 q-1 12 0 22" stroke="@corpsO" stroke-width="2.6" fill="none" stroke-linecap="round"/></g>`;
}
// (L'ex-art de croupe — la « bulle » détourée — a été DISSOUS dans la silhouette continue du
// tronc, cf. barrel(). L'os `croupe` ne porte plus que les pattes arrière et la queue.)
// --- Hydre : cluster de cous/têtes dessiné dans UN os (encolure) → ondule d'un bloc, pas
// besoin d'os supplémentaires. Tête reptilienne à GUEULE BÉANTE rouge sang (artwork LDB 79 p.323) :
// mâchoires ouvertes + crocs, œil fendu doré, petite crête d'épines @cheveux derrière le crâne.
// `far` = tête/cou du rang LOINTAIN (robe @corpsO, plus sombre → profondeur de l'entrelacs).
function hydraHeadlet(tx: number, ty: number, rot: number, s: number, far = false): string {
  const c = far ? '@corpsO' : '@corps';
  const o = far ? '#141c0c' : '@corpsO';
  const maw = far ? '#5a100c' : '#7e1410';
  return `<g transform="translate(${tx},${ty}) rotate(${rot}) scale(${s})">` +
    `<path d="M-3.6 -2.6 q-2.8 -3.2 -6 -3.6 q2.6 1.8 3.4 4 q-2.6 -1.4 -4.8 -1 q2.4 1.4 3.4 3 Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.35"/>` +
    `<path d="M0 2.6 Q2.6 7.4 7 9.6 Q10.6 11 11.8 9.4 Q9.4 7.6 7 5.6 Q3.8 3.2 1.2 2.4 Z" fill="${c}" stroke="${o}" stroke-width="0.5"/>` +
    `<path d="M0.8 2.8 Q5.4 4.6 10.6 8.2 Q12.4 4.4 13.2 0.6 Q7.4 2.4 0.8 2.8 Z" fill="${maw}"/>` +
    `<path d="M-4.6 -2.4 Q-6 1 -2.6 2.6 Q2 3.6 7.6 2.4 Q11.8 1.4 13.8 -0.8 Q14.6 -1.8 13.2 -2.6 Q8 -3.8 3 -3.4 Q-1.6 -3.4 -4.6 -2.4 Z" fill="${c}" stroke="${o}" stroke-width="0.55"/>` +
    `<path d="M4.6 2.8 l0.5 2 l1 -1.7 M7.8 2.2 l0.5 1.9 l1 -1.7 M10.8 1.2 l0.4 1.7 l0.9 -1.5 M4.2 4.4 l-0.2 -1.7 M6.8 6 l0.3 -1.9 M9.2 7.6 l0.5 -1.8" stroke="#e8e0c8" stroke-width="0.5" fill="none"/>` +
    `<ellipse cx="1.6" cy="-1" rx="1.25" ry="1.45" fill="#d8b020"/><ellipse cx="1.6" cy="-1" rx="0.4" ry="1.3" fill="#0a0603"/>` +
    `<path d="M-0.4 -2.4 Q1.8 -3.2 3.8 -2.2" stroke="${o}" stroke-width="0.7" fill="none"/>` +
    `</g>`;
}
function hydraNeck(x1: number, y1: number, cx: number, cy: number, x2: number, y2: number, far = false): string {
  const c = far ? '@corpsO' : '@corps';
  const d = `M${x1} ${y1} Q${cx} ${cy} ${x2} ${y2}`;
  return `<path d="${d}" fill="none" stroke="${c}" stroke-width="${far ? 4.6 : 5.5}" stroke-linecap="round"/>` +
    `<path d="${d}" fill="none" stroke="${far ? '#141c0c' : '@corpsO'}" stroke-width="1.3" opacity="0.45" stroke-linecap="round"/>` +
    // bandes d'écailles en reflet métallique (rang proche seulement)
    (far ? '' : `<path d="${d}" fill="none" stroke="@corpsH" stroke-width="1.4" opacity="0.4" stroke-linecap="round" stroke-dasharray="1.6 2.8"/>`);
}
// --- Déchiqueteur de Cadavres : MÊME mécanisme de cluster que l'hydre, mais 5 têtes ROUGE VIF
// sur cous gris-bleu (artwork ZI 5 p.58 : têtes serpentines écarlates contrastées, dents
// proéminentes, regard perçant clair, piquants sombres derrière chaque crâne). Repère local :
// museau vers +x, comme hydraHeadlet. `far` = rang lointain (rouge sombre @cheveuxO).
function shredderHeadlet(tx: number, ty: number, rot: number, s: number, far = false): string {
  const c = far ? '@cheveuxO' : '@cheveux';
  const o = far ? '#2a0c08' : '@cheveuxO';
  const maw = far ? '#1c0d0b' : '#30110d';
  return `<g transform="translate(${tx},${ty}) rotate(${rot}) scale(${s})">` +
    `<path d="M-3.6 -2.6 q-2.4 -3.6 -5.6 -4.2 q2.2 2 3 4.2 q-2.8 -1.6 -5 -1.2 q2.4 1.5 3.4 3.1 Z" fill="@corpsO" stroke="#14161c" stroke-width="0.35"/>` + // piquants sombres de nuque
    `<path d="M0 2.6 Q2.6 7.4 7 9.6 Q10.6 11 11.8 9.4 Q9.4 7.6 7 5.6 Q3.8 3.2 1.2 2.4 Z" fill="${c}" stroke="${o}" stroke-width="0.5"/>` + // mâchoire inférieure décrochée
    `<path d="M0.8 2.8 Q5.4 4.6 10.6 8.2 Q12.4 4.4 13.2 0.6 Q7.4 2.4 0.8 2.8 Z" fill="${maw}"/>` + // gueule béante
    `<path d="M-4.6 -2.4 Q-6 1 -2.6 2.6 Q2 3.6 7.6 2.4 Q11.8 1.4 13.8 -0.8 Q14.6 -1.8 13.2 -2.6 Q8 -3.8 3 -3.4 Q-1.6 -3.4 -4.6 -2.4 Z" fill="${c}" stroke="${o}" stroke-width="0.55"/>` + // crâne + long museau
    `<path d="M4.2 2.9 l0.6 2.5 l1.3 -2.1 M7.4 2.3 l0.6 2.4 l1.2 -2.1 M10.6 1.3 l0.5 2.1 l1 -1.9 M3.9 4.6 l-0.3 -2 M6.6 6.2 l0.4 -2.3 M9.2 7.7 l0.6 -2.1" stroke="#e9e2cd" stroke-width="0.65" fill="none"/>` + // dents PROÉMINENTES
    `<ellipse cx="1.6" cy="-1" rx="1.25" ry="1.45" fill="#cfd4da"/><ellipse cx="1.6" cy="-1" rx="0.4" ry="1.3" fill="#0a0603"/>` + // œil perçant gris pâle fendu
    `<path d="M-0.4 -2.4 Q1.8 -3.2 3.8 -2.2" stroke="${o}" stroke-width="0.7" fill="none"/>` +
    `</g>`;
}
// --- Chimère : MÊME mécanisme de cluster que l'hydre, mais 3 têtes DISTINCTES (ZI 66 :
// « l'une est léonine, une autre est celle d'un grand rapace et la troisième celle d'un dragon »).
// Repère local : museau vers +x, comme hydraHeadlet.
// Tête LÉONINE : crinière RAYONNANTE en couronne (le tell félin, cf. face 'felin'), crâne rond,
// museau COURT à gueule ouverte et crocs de sabre (artwork ZI 6 p.66 : mufle de lion, pas de loup).
function lionHeadlet(tx: number, ty: number, rot: number, s: number): string {
  return `<g transform="translate(${tx},${ty}) rotate(${rot}) scale(${s})">` +
    `<path d="M-1 -11 L-3.6 -8.2 L-7.6 -10 L-7 -6.2 L-11.4 -6.6 L-8.8 -3.4 L-12.6 -1.4 L-8.6 0.6 L-11 4 L-6.8 3.6 L-7.6 7.8 L-3.8 5.6 L-3.4 10 L-0.2 6.6 L2.6 10 L3.6 5.8 L7.6 7.4 L6 3.4 L9.6 2.4 L6.4 -0.2 L9.2 -3.2 L5.2 -3.6 L6.4 -7.6 L2.6 -5.8 L1.8 -9.8 Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.5"/>` + // crinière rayonnante
    `<circle cx="-1.2" cy="-0.6" r="6.6" fill="@cheveuxO" opacity="0.3"/>` +
    `<path d="M-4.2 -4.2 Q-6.6 -0.6 -4.6 2.4 Q-2.4 4.8 1.4 4.9 Q5 5 7.4 3.4 Q9.6 2 9.8 0 Q9.9 -1.8 7.6 -3 Q2.2 -5.5 -4.2 -4.2 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>` + // crâne rond + museau court
    `<path d="M4 -1 Q7.4 -1.8 9.5 -0.4 Q9.4 1.8 7.2 3.2 Q4.8 2.4 4 -1 Z" fill="@corpsH" opacity="0.5"/>` + // mufle clair
    `<path d="M3.2 4.4 Q5.2 8 9 8.6 Q10.8 8.2 10.2 6.6 Q7 6.2 5 4.4 Z" fill="@corps" stroke="@corpsO" stroke-width="0.5"/>` + // mâchoire tombée
    `<path d="M4.6 4.6 Q7 5.6 9.6 6.4 Q9.9 4.8 9.8 3.2 Q7 4.2 4.6 4.6 Z" fill="#5c0f0c"/>` + // gueule
    `<path d="M6 4.4 l0.5 3.2 l1.1 -2.7 Z M8.6 3.4 l0.5 2.6 l1 -2.2 Z" fill="#e8e0c8" stroke="#8a8060" stroke-width="0.3"/>` + // crocs de sabre
    `<path d="M9.1 1.2 l1.5 0.8 l-1.3 1 Z" fill="#1a0f08"/>` + // truffe
    `<path d="M-0.6 -3.2 Q1.6 -4 3.8 -2.8" stroke="@corpsO" stroke-width="0.8" fill="none"/>` + // sourcil
    `<ellipse cx="1.6" cy="-1.4" rx="1.3" ry="1.4" fill="#d8a020"/><circle cx="1.8" cy="-1.4" r="0.55" fill="#0a0603"/></g>`;
}
// Tête de DRAGON-crocodile : long museau bas bardé de dents débordantes, cornes balayées en
// arrière, œil fendu doré — distincte de la gueule de loup d'hydraHeadlet (artwork ZI 6 p.66).
function dragonHeadlet(tx: number, ty: number, rot: number, s: number): string {
  return `<g transform="translate(${tx},${ty}) rotate(${rot}) scale(${s})">` +
    `<path d="M-2.6 -3 Q-7.4 -6.4 -10.6 -6 Q-7.4 -4 -5.4 -1.6 Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.4"/>` + // corne basse
    `<path d="M-0.6 -3.8 Q-4.6 -8.2 -8 -8.6 Q-5.2 -5.8 -3.2 -2.8 Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.4"/>` + // corne haute
    `<path d="M1 2.8 Q4.6 5.8 9.6 6.6 Q12.6 6.6 13.2 5.2 Q9.4 4.6 5.6 3.2 Q3 2.4 1 2.8 Z" fill="@corps" stroke="@corpsO" stroke-width="0.5"/>` + // mâchoire inférieure
    `<path d="M1.6 2.9 Q7 4.6 12.6 5 Q13.6 3.4 14 1.4 Q7.6 2.6 1.6 2.9 Z" fill="#6e1410"/>` + // gueule entrouverte
    `<path d="M-4.6 -3 Q-6.4 0.4 -3.6 2.2 Q0.6 3.6 6 3.2 Q11 2.8 14.4 1 Q15.6 0.2 14.6 -1 Q10 -2.6 5 -2.8 Q-0.6 -3.4 -4.6 -3 Z" fill="@corps" stroke="@corpsO" stroke-width="0.55"/>` + // crâne bas + LONG museau
    `<path d="M4 3 l0.4 1.8 l1 -1.5 M7.2 3.2 l0.4 1.7 l0.9 -1.4 M10 2.8 l0.4 1.6 l0.9 -1.4 M12.4 2.2 l0.3 1.5 l0.8 -1.3 M5.6 4.9 l-0.2 -1.5 M8.6 5.6 l0.2 -1.7" stroke="#e8e0c8" stroke-width="0.45" fill="none"/>` + // dents débordantes
    `<path d="M-1 -2.6 Q6 -2.4 13 -0.8" stroke="@corpsO" stroke-width="0.7" fill="none" opacity="0.7"/>` + // arête écailleuse du museau
    `<ellipse cx="13" cy="-0.2" rx="0.5" ry="0.35" fill="#1a0e08"/>` + // naseau
    `<ellipse cx="0.8" cy="-1" rx="1.2" ry="1.4" fill="#d8b020"/><ellipse cx="0.8" cy="-1" rx="0.4" ry="1.25" fill="#0a0603"/>` + // œil fendu
    `<path d="M-1.4 -2.6 Q0.8 -3.4 3 -2.4" stroke="@corpsO" stroke-width="0.7" fill="none"/></g>`;
}
// Tête de RAPACE : bec crochu jaune + œil féroce sous sourcil saillant + plumes de nuque.
function raptorHeadlet(tx: number, ty: number, rot: number, s: number): string {
  return `<g transform="translate(${tx},${ty}) rotate(${rot}) scale(${s})">` +
    `<path d="M-5 -3.5 Q-6.5 2.5 -1.5 4.5 Q3 6 7.5 4.8 Q10 3.8 9.5 1.5 Q5.5 1 2 -0.5 Q-1 -2 -2 -4.5 Q-3.5 -6 -5 -3.5 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>` +
    `<path d="M-4.5 -3 l-2.6 -2.4 l0.6 3 M-2.8 -4.6 l-1.8 -3 l0 3.2" stroke="@corpsO" stroke-width="0.9" fill="none" stroke-linecap="round"/>` + // plumes de nuque
    `<path d="M7 1.2 Q12.5 0.8 14 3.4 Q12.6 5 9.8 5 Q8 6.6 7 4.6 Z" fill="#d4a82e" stroke="#7a5a18" stroke-width="0.4"/>` +
    `<path d="M12.8 3.6 Q14.4 4.4 13.2 6.4 Q11.4 6.2 10.4 4.8 Z" fill="#c79a26" stroke="#7a5a18" stroke-width="0.35"/>` + // crochet du bec
    `<ellipse cx="2.2" cy="-0.8" rx="1.4" ry="1.5" fill="#e8b820"/><circle cx="2.5" cy="-0.8" r="0.65" fill="#0a0603"/>` +
    `<path d="M-0.5 -2.8 Q2.5 -4 5.4 -2.2" stroke="@corpsO" stroke-width="0.9" fill="none"/></g>`;
}
function neck(p: QuadProps): string {
  if (p.head === 'chimere') { // 3 cous en éventail : dragon (arrière, dressé), lion (centre, dominant), rapace (avant)
    const L = 30 * p.neckLen;
    return `<g>` +
      hydraNeck(-3, 2, -14, -L * 0.6, -19, -L * 1.04) +
      hydraNeck(3, 2, 10, -L * 0.52, 14, -L * 0.88) +
      hydraNeck(0, 2, 1, -L * 0.72, 1, -L * 1.18) +
      dragonHeadlet(-19, -L * 1.04, -28, 1.0) +
      raptorHeadlet(14, -L * 0.88, -6, 0.95) +
      lionHeadlet(1, -L * 1.18, -8, 1.12) + `</g>`;
  }
  if (p.head === 'dechiqueteur') { // 5 cous serpentins étagés (artwork ZI p.58) : 2 têtes au rang
    // LOINTAIN (rouge sombre) + 3 au rang PROCHE (rouge vif) — chaque cou ÉMERGE du garrot/poitrail
    // en un point PROPRE (racines étalées, jamais une tige commune) et ondule à sa façon
    const L = 30 * p.neckLen;
    return `<g>` +
      hydraNeck(-11, 4, -25, -L * 0.48, -20, -L * 0.95, true) +
      hydraNeck(-2, 1, 17, -L * 0.58, 13, -L * 1.05, true) +
      shredderHeadlet(-20, -L * 0.95, -30, 0.9, true) +
      shredderHeadlet(13, -L * 1.05, 8, 0.92, true) +
      hydraNeck(-7, 6, -20, -L * 0.3, -15, -L * 0.62) +
      hydraNeck(1, 3, 8, -L * 0.55, 4, -L * 0.9) +
      hydraNeck(7, 4, 18, -L * 0.26, 20, -L * 0.58) +
      shredderHeadlet(-15, -L * 0.62, -26, 1.02) +
      shredderHeadlet(4, -L * 0.9, -4, 1.1) +
      shredderHeadlet(20, -L * 0.58, 24, 1.0) + `</g>`;
  }
  if (p.head === 'hydre') { // 6 cous serpentins étagés (artwork LDB p.323) : rang LOINTAIN sombre
    // derrière (3 têtes hautes) + rang PROCHE devant (3 têtes basses) → entrelacs, pas un éventail plat
    const L = 30 * p.neckLen;
    return `<g>` +
      hydraNeck(-4, 2, -16, -L * 0.5, -22, -L * 0.82, true) +
      hydraNeck(-1, 2, -2, -L * 0.72, -5, -L * 1.16, true) +
      hydraNeck(2, 2, 10, -L * 0.6, 15, -L * 1.0, true) +
      hydraHeadlet(-22, -L * 0.82, -32, 0.92, true) +
      hydraHeadlet(-5, -L * 1.16, -6, 0.95, true) +
      hydraHeadlet(15, -L * 1.0, 14, 0.92, true) +
      hydraNeck(-3, 3, -11, -L * 0.42, -14, -L * 0.6) +
      hydraNeck(0, 3, 3, -L * 0.55, 5, -L * 0.9) +
      hydraNeck(3, 3, 13, -L * 0.38, 21, -L * 0.62) +
      hydraHeadlet(-14, -L * 0.6, -24, 1.06) +
      hydraHeadlet(5, -L * 0.9, 0, 1.12) +
      hydraHeadlet(21, -L * 0.62, 26, 1.02) + `</g>`;
  }
  const L = 30 * p.neckLen;
  // Encolure SCULPTÉE : large à la base (fond dans le poitrail), gorge incurvée — plus un tube.
  // La base PLONGE profondément dans le corps (jusqu'à +18, évasée) ; le CONTOUR n'est tracé que
  // sur les bords HAUTS (crête de l'encolure + gorge) — le bas FOND dans le corps SANS trait
  // (un liseré sur tout le pourtour ferait « plaque rapportée » sur l'épaule).
  const base = `<path d="M-14 18 Q-13 6 -9 0 Q-11 ${-L * 0.5} -5 ${-L} L6 ${-L} Q10 ${-L * 0.55} 10 0 Q12 9 15 18 Q0 21 -14 18 Z" fill="@corps"/>` +
    // crête (dessus de l'encolure) tracée du milieu du corps vers la nuque
    `<path d="M-12.5 9 Q-11 ${-L * 0.5} -5 ${-L}" fill="none" stroke="@corpsO" stroke-width="0.7"/>` +
    // gorge (devant de l'encolure) + pli de gorge interne
    `<path d="M13.5 11 Q11 1 10 0 Q10 ${-L * 0.55} 6 ${-L}" fill="none" stroke="@corpsO" stroke-width="0.7"/>` +
    `<path d="M9 4 Q9.5 ${-L * 0.5} 5 ${-L * 0.94}" fill="none" stroke="@corpsO" stroke-width="0.7" opacity="0.45"/>`;
  const m = maneOf(p);
  let crin = `<path d="M-5 ${-L} Q-9 ${-L * 0.6} -8 2" fill="none" stroke="@cheveux" stroke-width="2.4" opacity="0.8"/>`; // 'sans' : ligne de dos discrète
  if (m === 'crin') // crin COUCHÉ retombant sur l'encolure : masse + mèches
    crin = `<path d="M-4 ${-L - 2} Q-14 ${-L * 0.78} -13 ${-L * 0.34} Q-12.5 ${-L * 0.06} -10 4 Q-9 4.5 -7.5 4 Q-9.5 ${-L * 0.36} -2 ${-L * 0.9} Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.5"/>` +
      `<path d="M-11.5 ${-L * 0.62} Q-10.5 ${-L * 0.4} -10.6 ${-L * 0.18} M-9.4 ${-L * 0.78} Q-8.6 ${-L * 0.5} -9 ${-L * 0.26} M-7 ${-L * 0.9} Q-6.4 ${-L * 0.6} -7.2 ${-L * 0.4}" fill="none" stroke="@cheveuxO" stroke-width="0.7" opacity="0.7"/>`;
  else if (m === 'hirsute') // fourrure DRESSÉE en dents le long du dos + touffe de gorge
    crin = `<path d="M-6 ${-L} l-4 -4 l1 5 l-4.5 -2.5 l1.8 4.4 l-4 -1 l2.2 3.8 l-3.4 0 l2.6 3.4 Q-9.5 ${-L * 0.4} -8.4 0 L-6.6 0 Q-8 ${-L * 0.45} -4.5 ${-L * 0.92} Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.45"/>` +
      `<path d="M8 ${-L * 0.3} q4 1.4 5 5 q-3.6 -0.4 -5.4 -2.2 M8.6 ${-L * 0.14} q3.4 1.6 4 4.6 q-3.2 -0.8 -4.6 -2.4" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.4"/>`;
  // Avant-train emplumé (foreCoat) : la BASE de l'encolure — qui plonge dans le poitrail et le
  // recouvre au rendu — porte le manteau @aile, transition DENTELÉE plumes du cou → plumage du
  // poitrail + mouchetures claires (sinon le manteau du tronc reste caché derrière ce panneau).
  const bib = p.foreCoat
    ? `<path d="M-13.2 15.6 Q-12.4 8 -10.2 2.6 l2.6 2.8 l1.2 -4.2 l2.8 3.2 l1.4 -4.4 l3 3 l1.4 -4 l2.7 2.4 Q10.4 4.4 10.6 1.4 Q11.8 9 14.4 16.6 Q0 20 -13.2 15.6 Z" fill="@aile" stroke="@aileO" stroke-width="0.5"/>` +
      `<g fill="@aileH" opacity="0.75"><circle cx="-7" cy="10" r="0.8"/><circle cx="-1" cy="8" r="0.8"/><circle cx="5" cy="10" r="0.8"/><circle cx="-4" cy="14" r="0.8"/><circle cx="9" cy="13" r="0.8"/><circle cx="2" cy="13" r="0.8"/></g>`
    : '';
  return `<g>${base}${crin}${bib}</g>`;
}
function earProfile(p: QuadProps, x: number, s: number): string {
  if (p.ears === 'pointues')
    return `<path d="M${x} -6 l${2 * s} -10 l${3 * s} 7 z" fill="@corps" stroke="@corpsO" stroke-width="0.5"/><path d="M${x + 1 * s} -7 l${1.5 * s} -6 l${1.5 * s} 4 z" fill="@corpsO"/>`;
  if (p.ears === 'rondes')
    return `<circle cx="${x + 2 * s}" cy="-7" r="3.2" fill="@corps" stroke="@corpsO" stroke-width="0.5"/><circle cx="${x + 2 * s}" cy="-7" r="1.4" fill="@corpsO"/>`;
  return `<path d="M${x} -5 q${3 * s} -8 ${6 * s} -6 q${-1 * s} 5 ${-3 * s} 7 z" fill="@corps" stroke="@corpsO" stroke-width="0.5"/>`;
}
/** Coiffe de crâne (bois ramifiés du cerf / cornes courbées) attachée au sommet-arrière de l'os tete.
 *  '' si la créature n'en porte pas. Teinte os/corne = @cheveux (secondaire de la robe). */
function headgear(p: QuadProps, view: 'front' | 'profile' | 'back'): string {
  if (!p.headgear) return '';
  const C = '@cheveux', O = '@cheveuxO';
  if (p.headgear === 'cornes') {
    if (view === 'profile')
      return `<path d="M-1 -5 Q-8 -11 -7 -21 Q-2 -13 -2 -7 Z" fill="${C}" stroke="${O}" stroke-width="0.5"/>` +
        `<path d="M2 -5 Q-5 -12 -3 -23 Q3 -14 1 -7 Z" fill="${C}" stroke="${O}" stroke-width="0.5"/>`;
    return `<path d="M-3 -10 Q-11 -16 -9 -26 Q-4 -18 -4 -12 Z" fill="${C}" stroke="${O}" stroke-width="0.5"/>` +
      `<path d="M3 -10 Q11 -16 9 -26 Q4 -18 4 -12 Z" fill="${C}" stroke="${O}" stroke-width="0.5"/>`;
  }
  // bois (ramure de cerf) : perche incurvée qui s'élève PUIS balaie vers l'arrière + andouillers (tines)
  const beam = (sx: number, near: boolean): string => {
    const o = near ? 1 : 0.6, sw = near ? 2.8 : 2.1;
    const perche = `M${sx * 2} -5 Q${sx * 10} -15 ${sx * 12} -26 Q${sx * 13} -33 ${sx * 8} -38`;
    const tines = `M${sx * 6} -11 Q${sx * 13} -12 ${sx * 16} -19 M${sx * 9} -18 Q${sx * 16} -20 ${sx * 18} -27 M${sx * 11} -25 Q${sx * 16} -28 ${sx * 16} -34 M${sx * 9} -36 Q${sx * 5} -39 ${sx * 2} -39`;
    return `<g opacity="${o}" stroke="${C}" stroke-linecap="round" fill="none">` +
      `<path d="${perche}" stroke-width="${sw}"/>` +
      `<path d="${tines}" stroke-width="${(sw * 0.78).toFixed(1)}"/>` +
      `<path d="${perche}" stroke="${O}" stroke-width="0.6" opacity="0.5"/></g>`;
  };
  if (view === 'profile') return beam(-1.12, false) + beam(-1, true); // les deux perches vers l'arrière, décalées
  return beam(-1, true) + beam(1, true); // ramure symétrique (face/dos)
}
function headProfile(p: QuadProps): string {
  if (p.head === 'hydre' || p.head === 'chimere' || p.head === 'dechiqueteur') return ''; // têtes dessinées dans l'os encolure (cluster)
  const eye = `<g data-eye="D" data-ec="6 2"><ellipse cx="6" cy="2" rx="1.6" ry="1.9" fill="#15100a"/><circle cx="6.4" cy="1.4" r="0.6" fill="#fff" opacity="0.7"/></g>`;
  if (p.head === 'aigle') // tête emplumée + bec crochu jaune + œil féroce + sourcil saillant
    return `<g transform="rotate(5)"><path d="M-7 -6 Q-9 6 -2 10 Q4 13 11 11 Q15 9 14 4 Q9 4 4 2 Q-1 0 -2 -6 Q-3 -9 -7 -6 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>` +
      `<path d="M10 4 Q19 3 21 7 Q19 9 15 9 Q12 12 10 9 Z" fill="#d4a82e" stroke="#7a5a18" stroke-width="0.5"/><path d="M19 7 Q21.5 8 20 11 Q17.5 11 16 8.5 Z" fill="#c79a26" stroke="#7a5a18" stroke-width="0.4"/>` +
      `<path d="M10 9 Q14 10 17 9" stroke="#7a5a18" stroke-width="0.5" fill="none"/>` +
      `<ellipse cx="6" cy="1.6" rx="2" ry="2.1" fill="#e8b820"/><circle cx="6.5" cy="1.6" r="0.95" fill="#0a0603"/><circle cx="6.9" cy="1" r="0.3" fill="#fff" opacity="0.8"/>` +
      `<path d="M2 -1.4 Q6 -2.8 9.4 -0.6" stroke="@corpsO" stroke-width="1.3" fill="none"/>` +
      `<path d="M-7 -4 q-3 2 -4 6 M-6 -1 q-3 3 -3 7 M-4 2 q-3 3 -2 7" stroke="@corpsO" stroke-width="1.2" fill="none" stroke-linecap="round" opacity="0.7"/>` +
      // collerette emplumée à la base du cou (textures.ts) — le tell « rapace » du griffon
      plumeFan(-6.5, 9, { n: 3, k: 0.8, baseRot: -125, colors: ['@corps', '@corpsO'] }) + `</g>`;
  if (p.head === 'dragon') // long museau écailleux + cornes en arrière + crête + dents + œil fendu
    return `<g transform="rotate(8)"><path d="M-8 -6 Q-10 7 -2 11 Q4 14 16 13 Q24 12 26 8 Q22 7 14 6 Q3 4 1 -4 Q0 -9 -8 -6 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
      `<path d="M-6 -5 q-4 -8 -11 -10 q4 6 6 12 z" fill="@corpsO" stroke="#1a140e" stroke-width="0.4"/><path d="M-2 -6 q-3 -9 -9 -12 q3 7 5 13 z" fill="@corpsO" stroke="#1a140e" stroke-width="0.4"/>` +
      `<ellipse cx="23" cy="9.4" rx="1.3" ry="1" fill="#1a0e08"/>` +
      `<path d="M13 12 l0.8 2.2 M17 12 l0.8 2.2 M21 11 l0.6 1.8" stroke="#e8e0c8" stroke-width="0.7"/>` +
      `<ellipse cx="4" cy="1.6" rx="1.8" ry="2.1" fill="#d8b820"/><ellipse cx="4" cy="1.6" rx="0.5" ry="1.9" fill="#0a0603"/>` +
      `<path d="M-8 -6 l-2 -4 M-3.5 -6.6 l-1 -4 M1 -5.6 l-0.4 -4" stroke="@corpsO" stroke-width="1.5" stroke-linecap="round"/></g>`;
  if (p.head === 'basilic') // GUEULE BÉANTE de saurien (mâchoire inférieure décrochée, crocs haut+bas,
    // gueule rouge), museau à plaque cornée en bec, œil ROUGE incandescent (regard mortel), crête de
    // pointes @cheveux sur le crâne balayées vers la nuque — artwork LDB 79 p.319.
    return `<g transform="rotate(6)">` +
      // crête de crâne (3 pointes vers l'arrière) + membrane orangée, DERRIÈRE le crâne
      `<path d="M-1.5 -8.2 Q-4.4 -14.8 -6.4 -16.2 Q-5.6 -11.2 -5 -8.6 Z M-4.8 -7.6 Q-8.4 -13 -10.2 -14 Q-9 -9.4 -8.2 -6.8 Z M-7.8 -5.8 Q-11.6 -9.6 -13 -10.2 Q-11.8 -6.4 -10.6 -4.4 Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.4"/>` +
      `<path d="M-5.6 -12.2 Q-7.6 -11.4 -9 -10.2 M-9.2 -9.4 Q-11 -8.2 -11.9 -6.6" stroke="#c07b32" stroke-width="1" opacity="0.75" fill="none"/>` +
      // crâne + museau (dessus) : plaque cornée qui se termine en bec busqué
      `<path d="M-8 -4.5 Q-9.5 2.5 -4 5 Q-0.5 6 3 5.2 Q12 4.6 21 3.4 Q26 2.6 27 1 Q26.5 -1.6 21 -2.2 Q11 -3.2 5 -4.6 Q2 -8.4 -2.5 -8.8 Q-7 -8.2 -8 -4.5 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
      `<path d="M4 -4.2 Q14 -3 24 -1.6" stroke="@corpsH" stroke-width="1.4" fill="none" opacity="0.6"/>` + // arête cornée claire du museau
      `<path d="M23.5 -0.6 l1.7 0.8" stroke="#1a0e08" stroke-width="0.8" stroke-linecap="round"/>` + // naseau en fente
      // gueule rouge (gape) + langue, SOUS la mâchoire sup, puis mâchoire inf DÉCROCHÉE vers l'avant-bas
      `<path d="M4 4.8 Q13 4.2 24 2.2 Q20 8.8 13 11.6 Q7 12.6 3.6 8.4 Z" fill="#6e1414"/>` +
      `<path d="M5 8.8 Q10 10.6 15 9.4" stroke="#b03a3a" stroke-width="1.6" fill="none" stroke-linecap="round"/>` +
      `<path d="M2.5 5.5 Q3 10 7 13 Q13 16.6 20 16.2 Q23 15.6 22.6 13.8 Q17 13.4 12 11.2 Q7 9 4.8 5.2 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
      // crocs : rangée sup (pendante) + rangée inf (dressée sur la mâchoire décrochée)
      `<path d="M7 4.9 l1 3.6 l1.3 -3.1 Z M11.5 4.5 l1 3.9 l1.3 -3.5 Z M16 4.1 l0.9 3.6 l1.2 -3.2 Z M20.5 3.4 l0.8 3.2 l1.1 -2.9 Z" fill="#efe6cf" stroke="#b8a888" stroke-width="0.3"/>` +
      `<path d="M8 12.6 l0.5 -3.4 l1.5 2.9 Z M12.5 14 l0.5 -3.5 l1.6 3 Z M17 14.8 l0.4 -3.2 l1.5 2.8 Z" fill="#efe6cf" stroke="#b8a888" stroke-width="0.3"/>` +
      // œil ROUGE incandescent fendu + arcade saillante ; écailles de joue
      `<ellipse cx="1.5" cy="-3.4" rx="2" ry="2.2" fill="#e35b22"/><ellipse cx="1.5" cy="-3.4" rx="0.55" ry="2" fill="#160a06"/><circle cx="2.2" cy="-4.2" r="0.4" fill="#ffd9a0" opacity="0.8"/>` +
      `<path d="M-1.6 -6.2 Q2 -7.2 4.8 -5.2" stroke="@corpsO" stroke-width="1.2" fill="none"/>` +
      `<path d="M-4 0 q1.6 1 3.2 0.8 M-5 2.4 q1.6 1 3.2 0.8" stroke="@corpsO" stroke-width="0.6" fill="none" opacity="0.5"/></g>`;
  if (p.head === 'crapaud') // tête large et plate, GROS œil bombé doré sur le dessus, large bouche
    return `<g transform="rotate(2)"><path d="M-7 -2 Q-9 6 -1 9 Q8 12 16 9 Q20 7 19 1 Q12 -1 5 -2 Q-2 -3 -7 -2 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
      `<ellipse cx="-1" cy="-3.5" rx="4.2" ry="4" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>` +
      `<circle cx="-0.5" cy="-4" r="2.3" fill="#caa024"/><ellipse cx="-0.5" cy="-4" rx="0.7" ry="2.1" fill="#0a0603"/><circle cx="0.2" cy="-5" r="0.5" fill="#fff" opacity="0.7"/>` +
      `<path d="M3 7.5 Q10 10 17 7.5" stroke="@corpsO" stroke-width="1" fill="none"/>` +
      `<circle cx="7" cy="2" r="0.9" fill="@corpsO"/><circle cx="12" cy="4" r="0.8" fill="@corpsO"/><circle cx="4" cy="5" r="0.7" fill="@corpsO"/></g>`;
  if (p.head === 'cheval')
    return `<g transform="rotate(8)"><path d="M-7 -6 Q-9 6 -3 12 Q4 20 12 22 Q18 22 19 17 Q18 12 12 10 Q4 6 2 -4 Q0 -9 -7 -6 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/><path d="M12 10 Q18 12 19 17 Q18 20 14 20 Q10 18 11 12 Z" fill="@corpsO"/><ellipse cx="16" cy="17" rx="2" ry="1.5" fill="#1a0f08"/>${earProfile(p, -5, -1)}${earProfile(p, 0, 1)}<path d="M-6 -4 Q-2 -7 1 -3" fill="none" stroke="@cheveux" stroke-width="2" opacity="0.8"/>${eye}</g>`;
  if (p.head === 'loup-feroce') // tête de LOUP GRONDANT (artwork LDB p.317) : même crâne bombé/museau
    // cunéiforme que 'loup', mais gueule GRANDE OUVERTE — babines retroussées plissées, rangées de
    // crocs haut+bas, mâchoire inférieure décrochée, œil ambre froncé. Tête DÉDIÉE au Loup (les
    // félins qui empruntent 'loup' gardent leur gueule fermée).
    return `<g transform="rotate(4)">` +
      // crâne + museau : la LÈVRE SUP s'arrête haut (y≈3.4), retroussée sur les crocs
      `<path d="M-8 -3 Q-9 -8.5 -2.5 -8 Q1.5 -7.6 3 -3.8 Q5.5 -2.6 9.5 -1.8 Q13.2 -1 14.2 1.2 Q14.4 3.2 12.2 3.6 Q9.6 3.8 7.6 3.3 Q6 3.9 4.6 3.4 L3.4 5.8 Q-0.5 8.8 -4.5 7.4 Q-9.2 5.2 -8 -3 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
      `<path d="M3 -3.4 Q8.5 -2.4 12.6 0.4" fill="none" stroke="@corpsH" stroke-width="1.5" opacity="0.5"/>` + // chanfrein clair
      `<path d="M-7 -4 Q-3 -1 -5.5 6" fill="none" stroke="@corpsH" stroke-width="1.6" opacity="0.4"/>` + // bajoue claire
      `<path d="M5.4 0 q2 -1 4 -0.6 M5 1.8 q2.4 -1 4.8 -0.5" stroke="@corpsO" stroke-width="0.6" fill="none" opacity="0.75"/>` + // plis de rage (babine retroussée)
      `<ellipse cx="13.4" cy="1.4" rx="1.6" ry="1.3" fill="#120a06"/>` + // truffe
      // gueule BÉANTE rouge sombre + langue, entre les deux mâchoires
      `<path d="M4.4 3.6 Q8.5 4 12.4 3.8 Q11 8.6 7.6 10.4 Q4.6 10.4 3.4 7.6 Z" fill="#6e1410"/>` +
      `<path d="M4.6 7.6 Q7 9.2 9.6 8.4" stroke="#b03a3a" stroke-width="1.2" fill="none" stroke-linecap="round"/>` + // langue
      // mâchoire inférieure DÉCROCHÉE vers l'avant-bas, soudée à la bajoue
      `<path d="M-1.6 6.4 Q0.4 11.2 5 12.8 Q9.4 14 11.6 12.4 Q8.6 11.6 6.4 10.2 Q3 8.2 1.6 4.8 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
      // crocs : rangée SUP pendante (4, canines longues) + rangée INF dressée (3)
      `<path d="M5.2 3.5 l0.7 2.9 l1.1 -2.6 Z M7.9 3.7 l0.8 3.2 l1.2 -2.9 Z M10.6 3.8 l0.6 2.7 l1 -2.4 Z M12.7 3.6 l0.5 2.2 l0.9 -2 Z" fill="#e8e0c8" stroke="#8a8060" stroke-width="0.3"/>` +
      `<path d="M4.4 9.6 l0.3 -2.6 l1.3 2.2 Z M6.9 10.9 l0.3 -2.7 l1.4 2.3 Z M9.4 11.7 l0.3 -2.4 l1.3 2.1 Z" fill="#e8e0c8" stroke="#8a8060" stroke-width="0.3"/>` +
      earProfile(p, -5.5, -1) + earProfile(p, -0.5, 1) +
      `<path d="M-1.6 -4.6 Q0.8 -5.8 3 -4.2" stroke="@corpsO" stroke-width="1.1" fill="none"/>` + // sourcil froncé
      `<g data-eye="D" data-ec="0.6 -2.2"><ellipse cx="0.6" cy="-2.2" rx="1.7" ry="1.6" fill="#c47b1e"/><circle cx="0.9" cy="-2.2" r="0.7" fill="#15100a"/><circle cx="1.2" cy="-2.7" r="0.3" fill="#fff" opacity="0.7"/></g></g>`;
  if (p.head === 'loup') // crâne BOMBÉ court + stop marqué + museau effilé MODÉRÉ (≠ « banane »)
    return `<g transform="rotate(4)">` +
      `<path d="M-8 -3 Q-9 -8.5 -2.5 -8 Q1.5 -7.6 3 -3.8 Q5 -1.8 9 -1 Q12.5 -0.2 13.6 2.6 Q14 5 11.6 5.6 Q9 6 6 5.6 L4.2 7.8 Q0 10.6 -4.5 8.4 Q-9.2 5.6 -8 -3 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
      `<path d="M3 -3.4 Q8 -2.2 12 1.4" fill="none" stroke="@corpsH" stroke-width="1.5" opacity="0.5"/>` + // chanfrein clair (dessus du museau)
      `<path d="M-7 -4 Q-3 -1 -5.5 6" fill="none" stroke="@corpsH" stroke-width="1.6" opacity="0.4"/>` + // bajoue claire
      `<ellipse cx="12.8" cy="3.6" rx="1.7" ry="1.4" fill="#120a06"/>` + // truffe
      `<path d="M6 5.6 Q9 6.8 12.2 4.8" stroke="@corpsO" stroke-width="0.6" fill="none"/>` + // ligne de gueule
      `<path d="M10.4 5.4 l0.35 1.4 l0.7 -1.2 Z" fill="#d8d0bc" opacity="0.85"/>` + // petit croc discret au coin de la gueule
      earProfile(p, -5.5, -1) + earProfile(p, -0.5, 1) +
      `<g data-eye="D" data-ec="0.6 -2"><ellipse cx="0.6" cy="-2" rx="1.7" ry="1.9" fill="#15100a"/><circle cx="1.1" cy="-2.6" r="0.6" fill="#fff" opacity="0.7"/></g></g>`;
  if (p.head === 'felin') // gueule FÉLINE à CRINIÈRE (@cheveux) hérissée en couronne autour du crâne +
    // museau court retroussé + GRANDS CROCS débordants (manticore LDB 79 p.324, même langage que lionHeadlet)
    return `<g transform="rotate(6)">` +
      `<path d="M2 -9 L4.5 -15 L-1 -12.5 L-2 -18.5 L-6 -13.5 L-9.5 -18.5 L-10.5 -13 L-16 -15.5 L-14.5 -10 L-20 -10 L-16.5 -5.5 L-21.5 -2.5 L-16 -0.5 L-19.5 4 L-14 3.5 L-15.5 9.5 L-10.5 7 L-10 13 L-5.5 8.5 L-2.5 14 L0.5 8.5 L4 12 L4.5 6.5 Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.55"/>` + // crinière en couronne
      `<circle cx="-4" cy="-2" r="7.5" fill="@cheveuxO" opacity="0.32"/>` +
      `<path d="M-7 -6.5 Q-10.5 -1 -8.5 4.5 Q-6.5 8.5 -1.5 9 L1.5 8.2 Q3.5 9.8 7 9.4 Q10.5 9 11.5 6.8 Q13.4 6 13.2 3.8 Q13.6 1.6 11.8 0.6 Q8 -1 4.6 -1.6 Q2 -5.6 -1.8 -7.2 Q-4.8 -8.2 -7 -6.5 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
      `<path d="M2.5 -2.5 Q7.5 -1.5 11.5 1.5" stroke="@corpsH" stroke-width="1.5" fill="none" opacity="0.5"/>` + // chanfrein clair
      `<path d="M5 1.4 q2.6 -0.6 5 0.6 M5.4 3.2 q2.8 -0.6 5.4 0.6" stroke="@corpsO" stroke-width="0.6" fill="none" opacity="0.7"/>` + // babines retroussées
      `<ellipse cx="12.4" cy="3" rx="1.4" ry="1.1" fill="#120a06"/>` + // truffe
      `<path d="M3.5 7.5 Q7 12.5 12 11.6 Q13.8 10.4 12.8 8.8 Q8.5 9.6 5.6 7.6 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>` + // mâchoire ouverte
      `<path d="M4 5.8 Q8 5 12.6 6.2 Q12.4 8.4 10.4 9.2 Q7 9.6 4.6 7.8 Z" fill="#5c0f0c"/>` +
      `<path d="M10.6 6.4 l0.9 4.6 l1.5 -4 Z M6.8 6.6 l0.8 3.6 l1.3 -3.1 Z" fill="#e8e0c8" stroke="#8a8060" stroke-width="0.3"/>` + // crocs de sabre
      `<path d="M6 8.2 l0.3 -2.2 l0.9 2 M9.2 8.8 l0.3 -2.4 l1 2.1" stroke="#e8e0c8" stroke-width="0.6" fill="none"/>` + // crocs inférieurs
      `<circle cx="-5" cy="-8.5" r="2.8" fill="@corps" stroke="@corpsO" stroke-width="0.5"/><circle cx="-5" cy="-8.5" r="1.2" fill="@corpsO"/>` + // oreille ronde sur la crinière
      `<path d="M0.6 -5.6 Q3.4 -7 6 -5" stroke="@corpsO" stroke-width="1.2" fill="none"/>` + // sourcil froncé
      `<g data-eye="D" data-ec="3 -3"><ellipse cx="3" cy="-3" rx="1.8" ry="1.9" fill="#d8a020"/><ellipse cx="3.1" cy="-3" rx="0.6" ry="1.7" fill="#0a0603"/></g></g>`;
  if (p.head === 'rat')
    return `<g transform="rotate(16)"><path d="M-6 -4 Q-8 5 -1 8 Q5 11 16 12 Q21 11 21 9 Q18 8 12 7 Q3 5 1 -3 Q0 -7 -6 -4 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/><ellipse cx="20" cy="10" rx="1.5" ry="1.2" fill="#d8a0a0"/><ellipse cx="14" cy="6" rx="1.4" ry="1.7" fill="#1a0808"/><path d="M14 13 q-2 4 -4 2" fill="none" stroke="#e8e0c8" stroke-width="0.9"/>${earProfile(p, -4, -1)}${earProfile(p, 1, 1)}</g>`;
  if (p.head === 'ours') // tête d'OURS rugissant (artwork LDB p.317) : FRONT BOMBÉ, museau COURT et
    // large (truffe ramenée sous l'œil, fini le groin pointu), petites oreilles rondes, bajoues en
    // lobes de fourrure ARRONDIS (pas de mèches-piquants), gueule béante à 4 canines.
    return `<g transform="rotate(6)">` +
      `<path d="M-8.4 -4.6 q-3.6 -0.6 -5.2 1.6 q1.9 0.3 3.1 1.3 q-3 0.3 -4.4 2.3 q2.1 0.1 3.3 1.1 q-2.3 0.9 -3.1 2.9 q2.5 -0.3 4 0.7 Z" fill="@corps" stroke="@corpsO" stroke-width="0.5"/>` + // bajoue arrière en lobes ronds
      `<circle cx="0.4" cy="-9.4" r="2.2" fill="@corpsO"/>` + // oreille ronde lointaine
      `<path d="M-9.6 -3.6 Q-11.6 -7.6 -8.2 -9.6 Q-4.6 -11.4 0.6 -10.6 Q4.8 -10 7.6 -7.6 Q10.8 -5.2 12.8 -2.6 Q14.4 -0.8 13.6 0.4 Q12.4 1.6 9.4 1.7 Q6.4 1.8 4.2 2.5 Q0.6 3.6 -2.6 5.6 Q-6.2 7.6 -9 6.6 Q-11.4 5.4 -11.4 1.4 Q-11.4 -1.4 -9.6 -3.6 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` + // front bombé + museau court et large
      `<circle cx="-5.4" cy="-9" r="2.9" fill="@corps" stroke="@corpsO" stroke-width="0.5"/><circle cx="-5.4" cy="-8.8" r="1.3" fill="@corpsO"/>` + // petite oreille ronde plantée dans le crâne
      `<path d="M8.6 -2.8 q2 -0.7 3.7 -0.1 M7.8 -1.2 q2.3 -0.9 4.3 -0.2" stroke="@corpsO" stroke-width="0.6" fill="none" opacity="0.7"/>` + // plis de rage sur le mufle
      `<path d="M-1 -10 Q4 -9.2 7.6 -6.9 Q10.8 -4.6 12.6 -2.2" stroke="@corpsH" stroke-width="1.6" fill="none" opacity="0.5"/>` + // chanfrein clair
      `<ellipse cx="13" cy="-1" rx="1.6" ry="1.4" fill="#120a06"/>` + // truffe large
      `<path d="M4.2 2.2 Q8.6 1.8 13.2 0.6 Q12.6 5.2 9.2 8 Q5.8 10 2.8 9 Q1.6 5.4 4.2 2.2 Z" fill="#6e120e"/>` + // gueule béante rouge sombre
      `<path d="M11.2 1 l0.8 3.2 l1.4 -2.9 Z M5.6 2.3 l0.7 2.8 l1.2 -2.5 Z" fill="#e8e0c8" stroke="#8a8060" stroke-width="0.3"/>` + // 2 canines supérieures
      `<path d="M8.4 1.9 l0.3 1.4 M9.8 1.6 l0.3 1.3" stroke="#e8e0c8" stroke-width="0.6"/>` + // molaires discrètes
      `<path d="M-2 4.6 Q-0.2 10.4 5.4 12.4 Q10 13.8 12 11.8 Q8.6 11.2 6.2 9.8 Q2.6 7.6 0.8 3.4 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` + // mâchoire inférieure tombée, soudée à la bajoue
      `<path d="M6.8 10 l0.3 -2.4 l1.3 2 Z M9.8 11 l0.3 -2.3 l1.3 2 Z" fill="#e8e0c8" stroke="#8a8060" stroke-width="0.3"/>` + // 2 canines inférieures
      `<path d="M3.4 11.4 q-0.7 1.5 -0.3 2.9 M6.2 12.8 q-0.3 1.5 0.3 2.7" stroke="@cheveux" stroke-width="1.1" stroke-linecap="round" opacity="0.8"/>` + // barbe de gorge
      `<path d="M1.6 -6.8 Q4.2 -8 6.6 -6.2" stroke="@corpsO" stroke-width="1.2" fill="none"/>` + // sourcil froncé
      `<g data-eye="D" data-ec="3.8 -4.8"><ellipse cx="3.8" cy="-4.8" rx="1.4" ry="1.6" fill="#15100a"/><circle cx="4.2" cy="-5.3" r="0.5" fill="#fff" opacity="0.7"/></g></g>`;
  // sanglier
  return `<g transform="rotate(10)"><path d="M-7 -4 Q-9 6 0 10 Q9 13 15 11 Q19 9 17 5 Q12 4 8 3 Q1 2 0 -4 Q-1 -8 -7 -4 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/><ellipse cx="15" cy="8" rx="3" ry="3.4" fill="@corpsO"/><ellipse cx="15" cy="8" rx="1" ry="1.4" fill="#140a06"/><path d="M12 11 q-2 5 -5 3" fill="none" stroke="#e8e0c8" stroke-width="1.6" stroke-linecap="round"/>${earProfile(p, -5, -1)}${earProfile(p, 0.5, 1)}${eye}</g>`;
}
function tail(p: QuadProps): string {
  if (p.tail === 'sans') return ''; // batracien : pas de queue
  if (p.head === 'chimere') { // LONGUE queue fine dressée en S au-dessus de la croupe, pointe
    // osseuse (ZI 66 l. « longue queue ») — une queue traînante sortirait du gabarit 120×150
    // (le corps massif touche déjà le bord arrière) ; même compensation d'os que 'reptile'.
    const d = 'M0 0 Q-9 -6 -10.5 -20 Q-11.5 -34 -6 -45 Q-2.5 -52 3 -57';
    return `<g transform="rotate(-42)">` +
      `<path d="${d}" fill="none" stroke="@corps" stroke-width="4.6" stroke-linecap="round"/>` +
      `<path d="M-8.5 -30 Q-9 -42 -3.5 -50 Q-0.5 -54 3 -57" fill="none" stroke="@corps" stroke-width="2.4" stroke-linecap="round"/>` +
      `<path d="${d}" fill="none" stroke="@corpsO" stroke-width="0.9" opacity="0.5"/>` +
      `<path d="M-12.4 -14 l-2.4 -1.6 l2.2 -1.2 M-13 -26 l-2.4 -0.8 l2 -1.8 M-11 -38 l-2 -2 l2.4 -1.2 M-6.2 -47 l-1.2 -2.6 l2.4 -0.6" stroke="@corpsO" stroke-width="0.8" fill="none" stroke-linecap="round"/>` + // épines du fouet
      `<path d="M3 -57 l5 -3.6 l-1.8 5.6 Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.4"/>` + // pointe osseuse
      `</g>`;
  }
  if (p.tail === 'reptile') { // longue queue écailleuse qui TRAÎNE derrière au ras du sol — l'os
    // `queue` penche à 42° (queues pendantes) : on compense dans l'art (miroir + rotate -34
    // ⇒ ~8° de chute vers l'arrière). Avant, elle pendait sous le ventre vers l'avant (!).
    // Hydre / dorsale 'epines-continues' (basilic) : la crête @cheveux se PROLONGE sur la queue
    // jusqu'à la pointe (artwork).
    const crest = p.head === 'hydre' || p.ridge === 'epines-continues'
      ? `<path d="M4 0 Q2.6 -5 0.8 -6.8 Q3.6 -5.2 6.6 -0.6 Z M12 0.4 Q10.6 -5.4 8.6 -7.2 Q11.6 -5.4 14.6 -0.2 Z M20 0.8 Q18.8 -4.6 16.8 -6.4 Q19.8 -4.8 22.6 0.4 Z M28 1.4 Q27 -3.8 25 -5.4 Q28 -4 30.6 1 Z M36 2.4 Q35.2 -2.4 33.4 -4 Q36.2 -2.6 38.6 2 Z M44 4.6 Q44 -0.8 42.6 -2.8 Q45.4 -0.6 47.2 5 Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.4"/>`
      : '';
    return `<g transform="rotate(-34) scale(-1,1)"><path d="M0 -2 Q16 4 28 2 Q40 0 50 9 Q41 5 30 7 Q16 11 0 6 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/><path d="M6 1 l1.5 -3 M14 1 l1.5 -3 M22 0.6 l1.5 -3 M30 1 l1.4 -2.6 M38 2.4 l1.2 -2.4" stroke="@corpsO" stroke-width="1" stroke-linecap="round"/>${crest}</g>`;
  }
  if (p.tail === 'enroulee') { // très longue queue qui s'ENROULE autour de la bête (dragon, artwork
    // LDB 79 p.321) : plonge derrière la croupe puis balaie le sol vers l'AVANT sous le corps, pointe
    // retroussée devant le poitrail — la 'reptile' qui traîne derrière sortait de la boîte 120×150.
    // rotate(-42) annule l'angle de l'os `queue` : l'art est authoré en axes MONDE (+x avant, +y sol).
    return `<g transform="rotate(-42)">` +
      `<path d="M-2 -8 C-16 8 -18 30 -10 47 C-4 59 14 65 34 65 C54 65 68 61 76 53 L83 43 Q74 47 68 51 C58 57 40 58 26 56 C12 54 2 45 1 34 C0.4 22 4 8 10 0 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
      `<path d="M-9 12 C-14 26 -13 40 -6 49" fill="none" stroke="@corpsO" stroke-width="1.1" opacity="0.5"/>` + // ombre du fouet descendant
      `<path d="M10 60 C34 63.5 58 61 72 53" fill="none" stroke="@corpsH" stroke-width="1.1" opacity="0.5"/>` + // reflet du dessus de l'anneau
      `<path d="M-11 20 l1.6 -3 M-12 30 l1.8 -2.8 M-9 40 l2 -2.6 M2 52 l1.8 -2.6 M16 59 l1.4 -2.8 M32 61 l1 -3 M48 60.5 l0.8 -3 M62 57 l0.6 -3" stroke="@corpsO" stroke-width="0.9" stroke-linecap="round"/>` + // anneaux d'écailles
      `<path d="M-14 14 l-5 -2.8 l4.4 -1.6 Z M-16 28 l-5.4 -0.6 l4.2 -2.6 Z M-12.5 42 l-4.6 2.2 l2.4 -4.4 Z M-4 54 l-3.2 3.8 l0.6 -5 Z M14 63 l-1.6 3.6 l-2.2 -4.4 Z M32 65.5 l-0.6 3.4 l-2.8 -3.8 Z M50 64 l0.2 3.4 l-3.2 -3 Z M66 58.5 l1.4 3 l-3.6 -1.4 Z" fill="@corpsO" stroke="#1a140e" stroke-width="0.35"/>` + // crête d'épines le long du bord externe
      `<path d="M83 43 L89 36 L81.5 38.5 Z" fill="@corpsO" stroke="#1a140e" stroke-width="0.4"/>` + // pointe en fer de lance retroussée
      `</g>`;
  }
  if (p.tail === 'leonine') // queue de lion : fouet fin + GROS toupet terminal (tell de l'arrière félin)
    return `<path d="M0 0 Q13 7 17 18 Q19 28 14 33 Q16 24 10 15 Q3 8 0 5 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/><path d="M14 30 Q9 33 10 38 Q13 41 16 38 Q20 40 21 35 Q24 33 21 29 Q19 26 14 30 Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.5"/>`;
  if (p.tail === 'dard') // queue de SCORPION (manticore) : fouet SEGMENTÉ qui s'ARQUE à la
    // VERTICALE derrière la croupe puis crochète vers les ailes, bulbe terminal + DARD courbe.
    // rotate(-42) compense l'os queue (angle 42) → coordonnées en axes MONDE, -y = vers le haut ;
    // filé vers -x le fouet sortait du cadre 120×150 (pivot x≈10) → queue lue « lisse » en QC.
    return `<g transform="rotate(-42)">` +
      `<path d="M0 0 Q-3 -10 -2 -20 Q-1 -30 5 -36.5 Q8.5 -39.5 12 -39.5" fill="none" stroke="@corps" stroke-width="6" stroke-linecap="round"/>` +
      `<path d="M0 0 Q-3 -10 -2 -20 Q-1 -30 5 -36.5 Q8.5 -39.5 12 -39.5" fill="none" stroke="@corpsO" stroke-width="1.1" opacity="0.5" stroke-linecap="round"/>` +
      `<path d="M-4.8 -6 q3.2 1.2 6 0.6 M-5.6 -13 q3.4 1.2 6.2 0.5 M-5 -20 q3.3 1.1 6.2 0.4 M-4 -26.6 q3.2 1.2 6 0.6 M-1 -32.4 q2.8 1.6 5.4 1.2 M4 -36.8 q2 2 4.6 2.2" stroke="@corpsO" stroke-width="0.9" fill="none"/>` + // anneaux de segments
      `<circle cx="13" cy="-39.5" r="4.4" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` + // bulbe à venin
      `<path d="M15.8 -42.6 Q21.6 -47.8 23.4 -54.4 Q17.6 -50.8 14.4 -47.4 Q12.8 -44.6 15.8 -42.6 Z" fill="@cuir" stroke="#1a140e" stroke-width="0.5"/>` + // le dard
      `</g>`;
  if (p.tail === 'crin') return `<path d="M0 0 Q10 6 10 18 Q9 30 4 34 Q7 24 3 14 Q1 6 0 4 Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.5"/>`;
  if (p.tail === 'touffe') return `<path d="M0 0 Q10 6 13 18 Q15 28 9 31 Q12 22 6 14 Q2 7 0 5 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/><path d="M11 16 Q16 24 10 30 Q12 22 8 16 Z" fill="@cheveux"/>`;
  if (p.tail === 'touffe-basse') // queue de loup (artwork LDB p.317) : TOMBANTE derrière le corps
    // (pas le crochet dressé de 'touffe'), FOURNIE sur toute la longueur (bords en touffes),
    // pointe sombre — l'os `queue` penche à 42°, on redresse dans l'art (rotate -30 ⇒ ~12° de
    // chute vers l'arrière).
    return `<g transform="rotate(-30)">` +
      `<path d="M-2.6 0 Q-4.6 7 -4 14 l1.8 -2.4 l-0.4 4.6 Q-2.4 22 -1 27 l1.4 -3 l0.8 4.6 Q3.4 26 5.6 21.4 l-1.8 0.4 l3 -5.2 Q7.6 12 6.4 6.4 Q5 1.4 2.6 -1 Q0 -2 -2.6 0 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>` +
      `<path d="M-3.2 6 Q-2 14 1.4 20" fill="none" stroke="@corpsH" stroke-width="1.4" opacity="0.45"/>` + // reflet clair du dessus
      `<path d="M0 24 Q1.2 27.6 3.4 28.6 Q5.6 26.4 6 22.6 l-2.2 1.4 l0.2 -3 Q2 22.6 0 24 Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.4"/>` + // pointe sombre
      `</g>`;
  if (p.tail === 'nue') return `<path d="M0 0 Q14 6 20 18 Q24 28 22 34" fill="none" stroke="#caa" stroke-width="2.4" stroke-linecap="round" opacity="0.9"/>`;
  if (p.tail === 'courte') return `<path d="M0 0 Q6 4 6 9 Q5 12 1 12 Q3 8 0 4 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>`;
  return `<path d="M0 0 Q6 8 5 18 Q4 22 6 24" fill="none" stroke="@corps" stroke-width="2.2" stroke-linecap="round"/><circle cx="6" cy="24" r="1.6" fill="@cheveux"/>`;
}

// ============================ FACE (front) ============================
function earsFront(p: QuadProps): string {
  if (p.ears === 'pointues') // oreilles dressées INCLINÉES VERS L'EXTÉRIEUR + intérieur clair → lues
    // comme des oreilles (canin/félin), PAS des cornes verticales. Base large attachée au crâne.
    return `<path d="M-6 -12 Q-13 -19 -12.5 -13 Q-11 -10 -5 -11 Z" fill="@corps" stroke="@corpsO" stroke-width="0.5"/><path d="M-7 -12 Q-11 -16 -11 -12.6 Q-10 -10.8 -6 -11.4 Z" fill="@peauO" opacity="0.55"/>` +
      `<path d="M6 -12 Q13 -19 12.5 -13 Q11 -10 5 -11 Z" fill="@corps" stroke="@corpsO" stroke-width="0.5"/><path d="M7 -12 Q11 -16 11 -12.6 Q10 -10.8 6 -11.4 Z" fill="@peauO" opacity="0.55"/>`;
  if (p.ears === 'rondes') { // rat = grandes oreilles rondes (intérieur rose) ; ours = petites, hautes
    const big = p.head === 'rat';
    const r = big ? 4.6 : 2.8, dx = big ? 9 : 8, dy = big ? -13 : -13.5, inr = big ? 2.4 : 1.2, inf = big ? '#d8a0a0' : '@peauO';
    return `<circle cx="${-dx}" cy="${dy}" r="${r}" fill="@corps" stroke="@corpsO" stroke-width="0.5"/><circle cx="${-dx}" cy="${dy + 0.4}" r="${inr}" fill="${inf}"/>` +
      `<circle cx="${dx}" cy="${dy}" r="${r}" fill="@corps" stroke="@corpsO" stroke-width="0.5"/><circle cx="${dx}" cy="${dy + 0.4}" r="${inr}" fill="${inf}"/>`;
  }
  // courtes (cheval) : oreilles fines incurvées vers l'extérieur (pas droites)
  return `<path d="M-5 -12 Q-9 -20 -4 -19 Q-3 -15 -2 -13 Z" fill="@corps" stroke="@corpsO" stroke-width="0.5"/><path d="M-5 -13 Q-7 -18 -4.5 -17.6 Q-4 -15 -3 -13.6 Z" fill="@peauO" opacity="0.5"/>` +
    `<path d="M5 -12 Q9 -20 4 -19 Q3 -15 2 -13 Z" fill="@corps" stroke="@corpsO" stroke-width="0.5"/><path d="M5 -13 Q7 -18 4.5 -17.6 Q4 -15 3 -13.6 Z" fill="@peauO" opacity="0.5"/>`;
}
function headFront(p: QuadProps): string {
  if (p.head === 'chimere') // 3 têtes en éventail : dragon à gauche, lion (crinière) au centre, rapace à droite
    return `<g>` +
      hydraNeck(-4, 8, -9, -4, -12, -13) + hydraNeck(4, 8, 9, -4, 12, -13) + hydraNeck(0, 8, 0, -6, 0, -17) +
      dragonHeadlet(-12, -13, -125, 0.9) + raptorHeadlet(12, -13, -55, 0.9) + lionHeadlet(0, -17, -90, 1.0) + `</g>`;
  if (p.head === 'dechiqueteur') // 5 têtes rouges dressées : 2 lointaines hautes + 3 proches basses
    return `<g>` +
      hydraNeck(-5, 7, -10, -7, -11, -19, true) + hydraNeck(5, 7, 10, -7, 11, -19, true) +
      shredderHeadlet(-11, -19, -115, 0.85, true) + shredderHeadlet(11, -19, -65, 0.85, true) +
      hydraNeck(-8, 9, -12, -2, -11, -9) + hydraNeck(0, 10, 1, -3, 0, -12) + hydraNeck(8, 9, 12, -2, 11, -9) +
      shredderHeadlet(-11, -9, -120, 0.95) + shredderHeadlet(0, -12, -90, 1.0) + shredderHeadlet(11, -9, -60, 0.95) + `</g>`;
  if (p.head === 'hydre') // 6 têtes dressées au-dessus du corps : rang lointain sombre haut + rang proche bas
    return `<g>` +
      hydraNeck(-3, 8, -10, -6, -14, -18, true) + hydraNeck(0, 8, 0, -9, 0, -21, true) + hydraNeck(3, 8, 10, -6, 14, -18, true) +
      hydraHeadlet(-14, -18, -125, 0.85, true) + hydraHeadlet(0, -21, -90, 0.88, true) + hydraHeadlet(14, -18, -55, 0.85, true) +
      hydraNeck(-4, 8, -8, -2, -11, -9) + hydraNeck(0, 8, 0, -3, 0, -12) + hydraNeck(4, 8, 8, -2, 11, -9) +
      hydraHeadlet(-11, -9, -120, 0.95) + hydraHeadlet(0, -12, -90, 1.0) + hydraHeadlet(11, -9, -60, 0.95) + `</g>`;
  const ears = earsFront(p);
  if (p.head === 'aigle') // face emplumée + bec crochu central + 2 yeux féroces jaunes
    return `<g><path d="M-8 -12 Q-10 4 -3 12 Q0 15 3 12 Q10 4 8 -12 Q0 -15 -8 -12 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
      `<path d="M-2.4 8 L2.4 8 L1 15 Q0 17.2 -1 15 Z" fill="#d4a82e" stroke="#7a5a18" stroke-width="0.5"/><path d="M-1 14.6 Q0 17.2 1 14.6 L0.6 13 L-0.6 13 Z" fill="#9a7a28"/>` +
      `<ellipse cx="-4.4" cy="-0.4" rx="1.9" ry="2.1" fill="#e8b820"/><circle cx="-4.4" cy="-0.2" r="0.95" fill="#0a0603"/>` +
      `<ellipse cx="4.4" cy="-0.4" rx="1.9" ry="2.1" fill="#e8b820"/><circle cx="4.4" cy="-0.2" r="0.95" fill="#0a0603"/>` +
      `<path d="M-7.4 -3.4 Q-4.4 -5.4 -1.6 -3.2 M7.4 -3.4 Q4.4 -5.4 1.6 -3.2" stroke="@corpsO" stroke-width="1.3" fill="none"/>` +
      `<path d="M-8 -10 l-2.6 -3 M8 -10 l2.6 -3 M-6 -13 l-1.2 -3.4 M6 -13 l1.2 -3.4 M0 -14 l0 -3.4" stroke="@corpsO" stroke-width="1.1" stroke-linecap="round" opacity="0.8"/></g>`;
  if (p.head === 'dragon') // face reptilienne : cornes FINES balayées (les larges lisaient « oreilles
    // d'âne ») + MUSEAU ALLONGÉ à dents débordantes et naseaux en fente (fini le groin de cochon) —
    // raccord avec le profil (même gueule longue, mêmes dents, même œil fendu).
    return `<g><path d="M-5.5 -11 q-1.6 -8.5 -7 -12.5 q1.2 7 3.2 13.5 z" fill="@corpsO" stroke="#1a140e" stroke-width="0.4"/><path d="M5.5 -11 q1.6 -8.5 7 -12.5 q-1.2 7 -3.2 13.5 z" fill="@corpsO" stroke="#1a140e" stroke-width="0.4"/>` +
      `<path d="M-9 -10 Q-11 3 -5 9 Q0 12 5 9 Q11 3 9 -10 Q0 -14 -9 -10 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
      `<path d="M-4.6 7 Q-5.4 15 -3 19.5 Q0 21.6 3 19.5 Q5.4 15 4.6 7 Q0 9.5 -4.6 7 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` + // museau long
      `<path d="M-4.6 10.5 l1.1 2 l1.2 -1.8 M4.6 10.5 l-1.1 2 l-1.2 -1.8 M-3.8 14.5 l1 1.9 l1.1 -1.7 M3.8 14.5 l-1 1.9 l-1.1 -1.7" stroke="#e8e0c8" stroke-width="0.7" fill="none"/>` + // dents débordantes
      `<path d="M-2.2 18.6 l1.1 -1.8 M2.2 18.6 l-1.1 -1.8" stroke="#1a0e08" stroke-width="0.8" stroke-linecap="round"/>` + // naseaux en fente
      `<ellipse cx="-5" cy="-2" rx="1.8" ry="2.3" fill="#d8b820"/><ellipse cx="-5" cy="-2" rx="0.5" ry="2.1" fill="#0a0603"/>` +
      `<ellipse cx="5" cy="-2" rx="1.8" ry="2.3" fill="#d8b820"/><ellipse cx="5" cy="-2" rx="0.5" ry="2.1" fill="#0a0603"/>` +
      `<path d="M0 -13 l0 -3.4 M-3 -12 l-0.6 -3.4 M3 -12 l0.6 -3.4" stroke="@corpsO" stroke-width="1.3" stroke-linecap="round"/></g>`;
  if (p.head === 'basilic') // face de saurien : crête de pointes au sommet, 2 yeux ROUGES, museau corné
    // court, GUEULE OUVERTE (rouge) à crocs — raccord avec le profil (mêmes crocs, même œil incandescent).
    return `<g>` +
      `<path d="M-0.6 -13.4 Q-1.2 -20.6 -0.2 -22.8 Q1.6 -18.2 1.2 -13.6 Z M-4.2 -12.6 Q-6.8 -18.6 -8.2 -19.8 Q-6.8 -14.4 -5.4 -11.8 Z M4 -12.6 Q6.6 -18.6 8 -19.8 Q6.6 -14.4 5.2 -11.8 Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.4"/>` + // crête (3 pointes)
      `<path d="M-5.2 -16.4 Q-3 -18 -1 -18.6 M1.4 -18.6 Q3.6 -18 5.4 -16.4" stroke="#c07b32" stroke-width="1" opacity="0.75" fill="none"/>` + // membrane orangée
      `<path d="M-9 -10 Q-11 3 -5 9 Q0 12 5 9 Q11 3 9 -10 Q0 -14 -9 -10 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` + // crâne
      `<path d="M-4.4 7.5 Q-5.2 12.5 -3.2 15.5 Q0 17.4 3.2 15.5 Q5.2 12.5 4.4 7.5 Q0 10 -4.4 7.5 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` + // museau court
      `<path d="M-1.6 8.8 Q0 8.2 1.6 8.8 L1 14.8 Q0 15.6 -1 14.8 Z" fill="@corpsH" opacity="0.5"/>` + // plaque cornée
      `<path d="M-1.4 15.2 l0.9 1.2 M1.4 15.2 l-0.9 1.2" stroke="#1a0e08" stroke-width="0.7" stroke-linecap="round"/>` + // naseaux
      `<path d="M-4.4 16.8 Q0 15.6 4.4 16.8 Q3.4 22 0 22.8 Q-3.4 22 -4.4 16.8 Z" fill="#6e1414" stroke="@corpsO" stroke-width="0.5"/>` + // gueule béante
      `<path d="M-3.2 16.9 l0.7 2.1 l1 -1.9 M-0.4 16.5 l0.7 2.2 l1 -2 M2.4 16.7 l0.6 2 l0.9 -1.8" stroke="#efe6cf" stroke-width="0.7" fill="none"/>` + // crocs sup
      `<path d="M-1.9 22 l0.5 -1.9 l1 1.7 M1 21.9 l0.5 -1.8 l0.9 1.6" stroke="#efe6cf" stroke-width="0.7" fill="none"/>` + // crocs inf
      `<ellipse cx="-4.8" cy="-3" rx="1.9" ry="2.2" fill="#e35b22"/><ellipse cx="-4.8" cy="-3" rx="0.5" ry="2" fill="#160a06"/>` +
      `<ellipse cx="4.8" cy="-3" rx="1.9" ry="2.2" fill="#e35b22"/><ellipse cx="4.8" cy="-3" rx="0.5" ry="2" fill="#160a06"/>` + // yeux ROUGES
      `<path d="M-7.4 -5.4 Q-4.8 -7 -2 -5.2 M7.4 -5.4 Q4.8 -7 2 -5.2" stroke="@corpsO" stroke-width="1.2" fill="none"/></g>`; // arcades
  if (p.head === 'crapaud') // face TRÈS large, 2 gros yeux bombés écartés en haut, bouche très large
    return `<g><path d="M-12 -6 Q-13 6 -6 13 Q0 16 6 13 Q13 6 12 -6 Q0 -10 -12 -6 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
      `<ellipse cx="-7" cy="-7" rx="4.4" ry="4.2" fill="@corps" stroke="@corpsO" stroke-width="0.6"/><ellipse cx="7" cy="-7" rx="4.4" ry="4.2" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>` +
      `<circle cx="-7" cy="-7.5" r="2.4" fill="#caa024"/><circle cx="-7" cy="-7.5" r="1" fill="#0a0603"/><circle cx="7" cy="-7.5" r="2.4" fill="#caa024"/><circle cx="7" cy="-7.5" r="1" fill="#0a0603"/>` +
      `<path d="M-9 8 Q0 13 9 8" stroke="@corpsO" stroke-width="1.1" fill="none"/>` +
      `<circle cx="-3" cy="2" r="1" fill="@corpsO"/><circle cx="3" cy="3" r="0.9" fill="@corpsO"/><circle cx="0" cy="-1" r="0.8" fill="@corpsO"/></g>`;
  if (p.head === 'cheval')
    return `<g>${ears}<path d="M-7 -14 Q-9 6 -4 16 Q0 19 4 16 Q9 6 7 -14 Q0 -17 -7 -14 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/><path d="M-2 -15 Q0 -17 2 -15 L1.5 12 Q0 14 -1.5 12 Z" fill="@cheveux" opacity="0.6"/><ellipse cx="0" cy="13" rx="4.2" ry="3.2" fill="@corpsO"/><ellipse cx="-1.6" cy="13" rx="0.9" ry="1.3" fill="#140a06"/><ellipse cx="1.6" cy="13" rx="0.9" ry="1.3" fill="#140a06"/>${eyeF(-5, -2)}${eyeF(5, -2)}</g>`;
  if (p.head === 'loup-feroce') // face du loup GRONDANT : même crâne/bajoues que 'loup', truffe
    // remontée et gueule BÉANTE dessous (mâchoire tombée sous le menton + crocs), yeux ambre froncés.
    return `<g>${ears}<path d="M-9 -13 Q-11 0 -6 8 Q-2 13 0 14 Q2 13 6 8 Q11 0 9 -13 Q0 -16 -9 -13 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
      `<path d="M-8.6 -2 l-3.6 1.4 l3.2 1.8 l-3 1.6 l3.6 1 M8.6 -2 l3.6 1.4 l-3.2 1.8 l3 1.6 l-3.6 1" stroke="@corps" stroke-width="1.6" fill="none" stroke-linejoin="round"/>` + // bajoues hirsutes
      `<path d="M-4 -1 Q0 -2.5 4 -1 L2.8 9 Q0 11.5 -2.8 9 Z" fill="@corpsH" opacity="0.45"/>` + // chanfrein clair
      `<path d="M-3 6.6 q1.4 -0.8 2.8 -0.3 M0.2 6.3 q1.4 -0.5 2.8 0.3" stroke="@corpsO" stroke-width="0.5" fill="none" opacity="0.7"/>` + // plis de babine
      `<ellipse cx="0" cy="10.6" rx="2.4" ry="1.9" fill="#120a06"/>` + // truffe
      `<path d="M-3.4 12.4 Q0 11.2 3.4 12.4 Q2.6 17.4 0 18.2 Q-2.6 17.4 -3.4 12.4 Z" fill="#6e1410" stroke="@corpsO" stroke-width="0.4"/>` + // gueule béante
      `<path d="M-2.5 12.7 l0.6 2.2 l0.9 -2 M0.6 12.5 l0.6 2.2 l0.9 -1.9" stroke="#e8e0c8" stroke-width="0.7" fill="none"/>` + // crocs sup
      `<path d="M-1.3 17.6 l0.4 -1.8 l0.9 1.6 M1.2 17.5 l0.4 -1.7 l0.8 1.5" stroke="#e8e0c8" stroke-width="0.6" fill="none"/>` + // crocs inf
      `<path d="M-7.4 -6.4 Q-4.8 -7.8 -2.2 -6.2 M7.4 -6.4 Q4.8 -7.8 2.2 -6.2" stroke="@corpsO" stroke-width="1.1" fill="none"/>` + // sourcils froncés
      `<g data-eye="G" data-ec="-5 -4"><ellipse cx="-5" cy="-4" rx="1.6" ry="1.5" fill="#c47b1e"/><circle cx="-5" cy="-4" r="0.65" fill="#15100a"/></g>` +
      `<g data-eye="D" data-ec="5 -4"><ellipse cx="5" cy="-4" rx="1.6" ry="1.5" fill="#c47b1e"/><circle cx="5" cy="-4" r="0.65" fill="#15100a"/></g></g>`;
  if (p.head === 'loup') // bajoues de fourrure + museau CUNÉIFORME long + crocs — raccord avec le
    // profil (le crâne rond sans museau lisait « ours/rat » de face).
    return `<g>${ears}<path d="M-9 -13 Q-11 0 -6 8 Q-2 13 0 14 Q2 13 6 8 Q11 0 9 -13 Q0 -16 -9 -13 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
      `<path d="M-8.6 -2 l-3.6 1.4 l3.2 1.8 l-3 1.6 l3.6 1 M8.6 -2 l3.6 1.4 l-3.2 1.8 l3 1.6 l-3.6 1" stroke="@corps" stroke-width="1.6" fill="none" stroke-linejoin="round"/>` + // bajoues hirsutes
      `<path d="M-4 -1 Q0 -2.5 4 -1 L2.8 11.5 Q0 14.5 -2.8 11.5 Z" fill="@corpsH" opacity="0.45"/>` +
      `<ellipse cx="0" cy="13.5" rx="2.5" ry="2" fill="#120a06"/>` +
      `<path d="M-2.4 15 l0.7 2.6 l1.1 -2.3 M2.4 15 l-0.7 2.6 l-1.1 -2.3" stroke="#e8e0c8" stroke-width="0.7" fill="none"/>` + // crocs
      `${eyeF(-5, -4, 1.5)}${eyeF(5, -4, 1.5)}</g>`;
  if (p.head === 'felin') // face féline : CRINIÈRE en couronne hérissée tout autour + museau court,
    // gueule ouverte à crocs pendants (raccord avec le profil felin)
    return `<g>` +
      `<path d="M0 -17 L-3.4 -13.2 L-8 -15.6 L-7.6 -10.8 L-13.4 -11 L-10.8 -6.8 L-16.4 -4.6 L-11.6 -1.8 L-15.8 2.6 L-10.4 3 L-12.4 8.6 L-7.4 6.6 L-7.2 12.6 L-3.2 9 L-0.2 14.4 L2.8 9 L6.8 12.8 L7 6.8 L12 8.8 L10.2 3.2 L15.6 2.8 L11.4 -1.6 L16.2 -4.4 L10.6 -6.6 L13.2 -11 L7.4 -10.6 L7.8 -15.6 L3.4 -13.2 Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.55"/>` + // crinière rayonnante
      `<circle cx="0" cy="-1" r="9.5" fill="@cheveuxO" opacity="0.3"/>` +
      `${ears}<path d="M-8 -9 Q-10.5 -1 -7 5.5 Q-3.5 10.5 0 10.5 Q3.5 10.5 7 5.5 Q10.5 -1 8 -9 Q0 -12.5 -8 -9 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
      `<ellipse cx="0" cy="6" rx="4.8" ry="3.8" fill="@corpsH" opacity="0.5"/>` + // museau clair
      `<path d="M-3 2.4 q3 -1.2 6 0 M-2.4 0.6 q2.4 -1 4.8 0" stroke="@corpsO" stroke-width="0.5" fill="none" opacity="0.6"/>` + // babines froncées
      `<path d="M-1.7 4.6 L1.7 4.6 L0 7 Z" fill="#120a06"/>` + // truffe
      `<path d="M-3.6 8 Q0 10 3.6 8 Q2.6 13.6 0 14.2 Q-2.6 13.6 -3.6 8 Z" fill="#5c0f0c" stroke="@corpsO" stroke-width="0.4"/>` + // gueule ouverte
      `<path d="M-2.8 8.8 l0.7 3.6 l1.2 -3 Z M2.8 8.8 l-0.7 3.6 l-1.2 -3 Z" fill="#e8e0c8" stroke="#8a8060" stroke-width="0.3"/>` + // crocs de sabre
      `<path d="M-7 -6 Q-4.4 -7.6 -1.8 -5.8 M7 -6 Q4.4 -7.6 1.8 -5.8" stroke="@corpsO" stroke-width="1.1" fill="none"/>` + // sourcils froncés
      `<g data-eye="G" data-ec="-4.4 -3.4"><ellipse cx="-4.4" cy="-3.4" rx="1.8" ry="1.9" fill="#d8a020"/><ellipse cx="-4.4" cy="-3.3" rx="0.6" ry="1.7" fill="#0a0603"/></g>` +
      `<g data-eye="D" data-ec="4.4 -3.4"><ellipse cx="4.4" cy="-3.4" rx="1.8" ry="1.9" fill="#d8a020"/><ellipse cx="4.4" cy="-3.3" rx="0.6" ry="1.7" fill="#0a0603"/></g></g>`;
  if (p.head === 'rat')
    return `<g>${ears}<path d="M-7 -11 Q-9 2 -3 11 Q0 16 3 11 Q9 2 7 -11 Q0 -14 -7 -11 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/><ellipse cx="0" cy="13" rx="1.8" ry="1.5" fill="#d8a0a0"/><path d="M-2 13 q-5 1 -7 -1 M2 13 q5 1 7 -1 M-2 14 q-5 2 -8 1 M2 14 q5 2 8 1" stroke="#cfc8b8" stroke-width="0.4" opacity="0.55"/>${eyeF(-4, -3, 1.4)}${eyeF(4, -3, 1.4)}</g>`;
  if (p.head === 'ours') // face d'OURS rugissant (artwork LDB p.317) : crâne large, bajoues hirsutes,
    // gueule OUVERTE sous la truffe (mâchoire tombée + crocs) — fini la bouche fermée neutre.
    return `<g>${ears}` +
      `<path d="M-11 -10 Q-13 4 -5 11 Q-2 13.4 0 13.4 Q2 13.4 5 11 Q13 4 11 -10 Q0 -14 -11 -10 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
      `<path d="M-10.6 -2 l-3.4 1 l3 1.8 l-2.9 1.7 l3.4 1.1 M10.6 -2 l3.4 1 l-3 1.8 l2.9 1.7 l-3.4 1.1" stroke="@corps" stroke-width="1.7" fill="none" stroke-linejoin="round"/>` + // bajoues hérissées
      `<path d="M-6.2 -11.6 Q-4.6 -14 -2.4 -13 Q-1 -14.6 1 -14 Q2.6 -14.6 4 -13.2 Q5.4 -13.6 6.2 -11.6" stroke="@cheveux" stroke-width="1.2" fill="none" opacity="0.8" stroke-linecap="round"/>` + // couronne de fourrure arrondie
      `<path d="M-3.2 0 Q0 -1.4 3.2 0 L2.4 6 Q0 7.4 -2.4 6 Z" fill="@corpsH" opacity="0.4"/>` + // chanfrein clair
      `<ellipse cx="0" cy="6.4" rx="2.5" ry="1.8" fill="#120a06"/>` + // truffe
      `<path d="M-4.4 8.2 Q0 9.8 4.4 8.2 Q3.6 13.8 0 14.8 Q-3.6 13.8 -4.4 8.2 Z" fill="#6e120e" stroke="@corpsO" stroke-width="0.5"/>` + // gueule béante
      `<path d="M-3.3 8.9 l0.6 2.4 l1 -2.1 M3.3 8.9 l-0.6 2.4 l-1 -2.1" stroke="#e8e0c8" stroke-width="0.7" fill="none"/>` + // crocs supérieurs
      `<path d="M-1.5 14 l0.3 -2.1 l0.9 1.9 M1.5 14 l-0.3 -2.1 l-0.9 1.9" stroke="#e8e0c8" stroke-width="0.6" fill="none"/>` + // crocs inférieurs
      `<path d="M-7.2 -6 Q-4.6 -7.6 -2.2 -6 M2.2 -6 Q4.6 -7.6 7.2 -6" stroke="@corpsO" stroke-width="1.2" fill="none"/>` + // sourcils froncés
      `${eyeF(-4.6, -3.6, 1.5)}${eyeF(4.6, -3.6, 1.5)}</g>`;
  // sanglier : groin large + défenses
  return `<g>${ears}<path d="M-10 -10 Q-12 5 -5 12 Q0 16 5 12 Q12 5 10 -10 Q0 -13 -10 -10 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/><ellipse cx="0" cy="12" rx="5.2" ry="3.6" fill="@corpsO"/><ellipse cx="-2" cy="12" rx="1" ry="1.4" fill="#140a06"/><ellipse cx="2" cy="12" rx="1" ry="1.4" fill="#140a06"/><path d="M-4 14 Q-6 19 -3 19" fill="none" stroke="#e8e0c8" stroke-width="1.5" stroke-linecap="round"/><path d="M4 14 Q6 19 3 19" fill="none" stroke="#e8e0c8" stroke-width="1.5" stroke-linecap="round"/>${eyeF(-6, -3, 1.4)}${eyeF(6, -3, 1.4)}</g>`;
}
// Poitrail FACE des CANIDÉS/FÉLINS : étroit et PROFOND (quille au bréchet) + fraise de fourrure
// au garrot (loup d'hiver) — pas le barillet rond des ongulés/ursidés (qui faisait « tonneau »).
function bodyFrontCanine(p: QuadProps): string {
  const w = p.build === 'feline' ? 14 : 13; // épaule étroite
  const body = `<path d="M${-w} -4 Q${-w} -20 -6 -26 Q0 -28 6 -26 Q${w} -20 ${w} -4 Q${w - 1} 11 5 21 Q0 25 -5 21 Q${-(w - 1)} 11 ${-w} -4 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>`;
  // ombres de flanc (poitrail bombé) + quille claire centrale (poils du bréchet).
  const flanks = `<path d="M${-w} -4 Q${-w} 11 -5 21 L-6 18 Q${-(w - 2)} 9 ${-(w - 2)} -3 Z" fill="@corpsO" opacity="0.42"/>` +
    `<path d="M${w} -4 Q${w} 11 5 21 L6 18 Q${w - 2} 9 ${w - 2} -3 Z" fill="@corpsO" opacity="0.5"/>`;
  const bib = `<path d="M-3.6 -18 Q0 -21 3.6 -18 Q4.4 -2 2 15 Q0 18 -2 15 Q-4.4 -2 -3.6 -18 Z" fill="@corpsH" opacity="0.3"/>`;
  // fraise hirsute (loup) : lobes de fourrure dentelés débordant le haut du poitrail.
  const ruff = maneOf(p) === 'hirsute'
    ? `<path d="M-3 -19 Q-13 -16 -16 -3 Q-17 5 -13 12 Q-12.5 4 -9 -2 l-3.5 5.5 Q-9.5 -5 -5.5 -11 l-3 4.5 Q-6 -10 -2.5 -16 Z" fill="@corps" stroke="@corpsO" stroke-width="0.5"/>` +
      `<path d="M3 -19 Q13 -16 16 -3 Q17 5 13 12 Q12.5 4 9 -2 l3.5 5.5 Q9.5 -5 5.5 -11 l3 4.5 Q6 -10 2.5 -16 Z" fill="@corps" stroke="@corpsO" stroke-width="0.5"/>`
    : '';
  return `<g>${body}${flanks}${ruff}${bib}</g>`;
}
function bodyFront(p: QuadProps): string {
  if (p.build === 'canine' || p.build === 'feline') return bodyFrontCanine(p);
  if (p.build === 'batracien') { // crapaud : corps LARGE et BAS (la carrure↑ ne l'étire pas en colonne)
    const W = 26;
    return `<g><path d="M${-W} -8 Q${-W} -14 ${-W * 0.5} -15 Q0 -16 ${W * 0.5} -15 Q${W} -14 ${W} -8 L${W - 3} 8 Q${W - 8} 14 0 15 Q${-(W - 8)} 14 ${-(W - 3)} 8 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
      `<path d="M-5 -14 Q0 -16 5 -14 L4 12 Q0 14 -4 12 Z" fill="@corpsH" opacity="0.4"/>` +
      `<circle cx="-11" cy="-3" r="1.6" fill="@corpsO"/><circle cx="10" cy="-1" r="1.8" fill="@corpsO"/><circle cx="-3" cy="5" r="1.4" fill="@corpsO"/><circle cx="7" cy="7" r="1.3" fill="@corpsO"/><circle cx="0" cy="-9" r="1.2" fill="@corpsO"/></g>`;
  }
  // Poitrail vu de FACE : masse RONDE (épaules larges en haut → bréchet resserré entre les
  // antérieurs), modelée en BARILLET (reflet central bombé + ombres de flanc) pour qu'elle
  // lise « volume » et pas « planche plate ». w = demi-largeur d'épaule, br = demi-bréchet.
  const w = p.head === 'ours' ? 22 : p.head === 'rat' ? 14 : p.head === 'sanglier' ? 19 : 17;
  const br = w * 0.46; // bréchet (sortie des antérieurs) — les pattes émergent de là
  const crest = p.head === 'sanglier' ? `<path d="M-3 -26 Q0 -33 3 -26 M-6 -24 Q-3 -30 0 -25 M0 -25 Q3 -30 6 -24" stroke="@cheveux" stroke-width="1.3" fill="none" opacity="0.8"/>` : '';
  // silhouette : épaules rondes (±w à mi-hauteur), poitrail qui se referme en V doux sur le bréchet.
  const body = `<path d="M${-w} -8 Q${-w - 1} -23 ${-w * 0.46} -28 Q0 -30 ${w * 0.46} -28 Q${w + 1} -23 ${w} -8 Q${w - 1} 9 ${br + 2} 18 Q0 24 ${-(br + 2)} 18 Q${-(w - 1)} 9 ${-w} -8 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>`;
  // ombres de flanc (les deux bords s'enroulent en arrière) — donnent la rondeur du barillet.
  const flanks =
    `<path d="M${-w} -8 Q${-w - 1} -23 ${-w * 0.46} -28 L${-w * 0.5} -23 Q${-w * 0.84} -16 ${-(w - 1.5)} -6 Q${-(w - 1)} 8 ${-(br + 1)} 17 L${-(br + 2)} 18 Q${-(w - 1)} 9 ${-w} -8 Z" fill="@corpsO" opacity="0.42"/>` +
    `<path d="M${w} -8 Q${w + 1} -23 ${w * 0.46} -28 L${w * 0.5} -23 Q${w * 0.84} -16 ${w - 1.5} -6 Q${w - 1} 8 ${br + 1} 17 L${br + 2} 18 Q${w - 1} 9 ${w} -8 Z" fill="@corpsO" opacity="0.5"/>`;
  // reflet bombé central (sternum/pectoraux face au spectateur) + léger sillon médian.
  const sheen = `<path d="M-${w * 0.34} -22 Q0 -27 ${w * 0.34} -22 Q${w * 0.4} -4 ${br * 0.7} 14 Q0 19 ${-br * 0.7} 14 Q-${w * 0.4} -4 -${w * 0.34} -22 Z" fill="@corpsH" opacity="0.4"/>`;
  const groove = `<path d="M0 -24 Q0.4 -4 0 16" fill="none" stroke="@corpsO" stroke-width="0.7" opacity="0.35"/>`;
  return `<g>${body}${flanks}${sheen}${groove}${crest}${foreCoatFront(p)}</g>`;
}

// ============================ DOS (back) ============================
function napeBack(p: QuadProps): string {
  if (p.head === 'chimere') // dos des 3 cous : nuques dragon/rapace (ovales) + couronne de crinière du lion au centre
    return `<g>` +
      hydraNeck(-4, 6, -8, -4, -11, -12) + hydraNeck(4, 6, 8, -4, 11, -12) + hydraNeck(0, 6, 0, -6, 0, -15) +
      `<ellipse cx="-11" cy="-12" rx="2.8" ry="3.2" fill="@corps" stroke="@corpsO" stroke-width="0.5"/>` +
      `<path d="M-11 -14.4 l-1.4 -2.6 l0.4 2.4 l-1.8 -1.6 l0.9 2.2" stroke="@cheveux" stroke-width="0.7" fill="none"/>` + // crête du dragon
      `<ellipse cx="11" cy="-12" rx="2.6" ry="3" fill="@corps" stroke="@corpsO" stroke-width="0.5"/>` +
      `<path d="M11 -14.2 l-1.6 -2.2 l0.2 2.2 M12 -14.2 l0.8 -2.6 l0.6 2.4" stroke="@corpsO" stroke-width="0.7" fill="none" stroke-linecap="round"/>` + // plumes du rapace
      `<path d="M0 -19 l-2.6 -3 l0.6 3.2 l-3 -1.6 l1.4 3.2 l-3.2 0.6 l2.4 2.6 l-2.6 1.8 l3.2 1 l-1.2 3 l3.4 -1 l1 3 l2 -2.6 l2.4 2.2 l0.6 -3.2 l3.2 0.6 l-1.8 -3 l3 -1.4 l-3 -1.6 l1.8 -2.8 l-3.4 0 l0.8 -3.2 Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.4"/>` + // couronne de crinière
      `<ellipse cx="0" cy="-15" rx="3.1" ry="3.4" fill="@corps" stroke="@corpsO" stroke-width="0.5"/></g>`;
  if (p.head === 'dechiqueteur') { // dos des 5 cous : ovales rouge sombre/vif + piquants @corpsO
    const spikes = (x: number, y: number) =>
      `<path d="M${x} ${y} l-1.4 -2.6 l0.4 2.4 l-1.8 -1.6 l0.9 2.2" stroke="@corpsO" stroke-width="0.7" fill="none"/>`;
    return `<g>` +
      hydraNeck(-5, 5, -10, -9, -11, -20, true) + hydraNeck(5, 5, 10, -9, 11, -20, true) +
      `<ellipse cx="-11" cy="-20" rx="2.6" ry="3" fill="@cheveuxO"/><ellipse cx="11" cy="-20" rx="2.6" ry="3" fill="@cheveuxO"/>` +
      hydraNeck(-8, 7, -12, -4, -11, -12) + hydraNeck(0, 8, 1, -6, 0, -14) + hydraNeck(8, 7, 12, -4, 11, -12) +
      `<ellipse cx="-11" cy="-12" rx="2.8" ry="3.2" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.5"/><ellipse cx="0" cy="-14" rx="3" ry="3.4" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.5"/><ellipse cx="11" cy="-12" rx="2.8" ry="3.2" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.5"/>` +
      spikes(-11, -14.6) + spikes(0, -16.8) + spikes(11, -14.6) + `</g>`;
  }
  if (p.head === 'hydre') { // dos des 6 cous + arrière des têtes (ovales, crête @cheveux sur le rang proche)
    const spikes = (x: number, y: number) =>
      `<path d="M${x} ${y} l-1.4 -2.6 l0.4 2.4 l-1.8 -1.6 l0.9 2.2" stroke="@cheveux" stroke-width="0.7" fill="none"/>`;
    return `<g>` +
      hydraNeck(-3, 6, -9, -8, -13, -19, true) + hydraNeck(0, 6, 0, -10, 0, -22, true) + hydraNeck(3, 6, 9, -8, 13, -19, true) +
      `<ellipse cx="-13" cy="-19" rx="2.6" ry="3" fill="@corpsO"/><ellipse cx="0" cy="-22" rx="2.8" ry="3.2" fill="@corpsO"/><ellipse cx="13" cy="-19" rx="2.6" ry="3" fill="@corpsO"/>` +
      hydraNeck(-4, 6, -8, -4, -11, -12) + hydraNeck(0, 6, 0, -6, 0, -14) + hydraNeck(4, 6, 8, -4, 11, -12) +
      `<ellipse cx="-11" cy="-12" rx="2.8" ry="3.2" fill="@corps" stroke="@corpsO" stroke-width="0.5"/><ellipse cx="0" cy="-14" rx="3" ry="3.4" fill="@corps" stroke="@corpsO" stroke-width="0.5"/><ellipse cx="11" cy="-12" rx="2.8" ry="3.2" fill="@corps" stroke="@corpsO" stroke-width="0.5"/>` +
      spikes(-11, -14.6) + spikes(0, -16.8) + spikes(11, -14.6) + `</g>`;
  }
  if (p.head === 'basilic') // dos du crâne : PAS d'oreilles, la crête @cheveux descend du sommet à la nuque
    return `<g><path d="M-8.5 -12 Q-10 0 -5 9 Q0 13 5 9 Q10 0 8.5 -12 Q0 -16 -8.5 -12 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
      `<path d="M0 -15 Q-1 -21.4 -0.2 -23.6 Q1.4 -19 1 -15 Z M0 -8 Q-0.9 -13.6 -0.1 -15.6 Q1.4 -11.6 1 -8 Z M0 -1 Q-0.8 -6.2 0 -8.2 Q1.3 -4.6 1 -1 Z M0 6 Q-0.7 1.4 0 -0.4 Q1.2 3 0.9 6 Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.4"/></g>`;
  // Arrière de la tête à la MÊME échelle que la face (de dos on voit le crâne + la nuque + le
  // dos des oreilles — pas de museau, normal) : crâne rond clair (@corps, pas @corpsO « ombre »),
  // oreilles dressées, épi/crinière sur la nuque. Plus une « petite bosse sombre ».
  const earBack = p.ears === 'rondes'
    ? (() => { const big = p.head === 'rat' || p.head === 'ours'; const r = big ? 4.4 : 3.4, dx = big ? 8 : 7; const inf = p.head === 'rat' ? '#b88' : '@corpsO';
        return `<circle cx="${-dx}" cy="-13" r="${r}" fill="@corps" stroke="@corpsO" stroke-width="0.5"/><circle cx="${-dx}" cy="-13" r="${r * 0.5}" fill="${inf}" opacity="0.6"/>` +
          `<circle cx="${dx}" cy="-13" r="${r}" fill="@corps" stroke="@corpsO" stroke-width="0.5"/><circle cx="${dx}" cy="-13" r="${r * 0.5}" fill="${inf}" opacity="0.6"/>`; })()
    : p.ears === 'pointues'
      ? `<path d="M-5 -11 Q-12 -22 -10.5 -13 Q-9.5 -10 -4 -11 Z" fill="@corps" stroke="@corpsO" stroke-width="0.5"/><path d="M-6 -12 Q-10 -18 -9.5 -13 Q-8.5 -11.4 -5 -12 Z" fill="@corpsO" opacity="0.6"/>` +
        `<path d="M5 -11 Q12 -22 10.5 -13 Q9.5 -10 4 -11 Z" fill="@corps" stroke="@corpsO" stroke-width="0.5"/><path d="M6 -12 Q10 -18 9.5 -13 Q8.5 -11.4 5 -12 Z" fill="@corpsO" opacity="0.6"/>`
      : `<path d="M-4 -12 Q-8 -21 -3 -20 Q-2 -16 -1 -13 Z" fill="@corps" stroke="@corpsO" stroke-width="0.5"/><path d="M4 -12 Q8 -21 3 -20 Q2 -16 1 -13 Z" fill="@corps" stroke="@corpsO" stroke-width="0.5"/>`;
  // crâne/nuque : ovale large (≈ la face de front) qui se prolonge en nuque vers les épaules.
  const skull = `<path d="M-8.5 -12 Q-10 0 -5 9 Q0 13 5 9 Q10 0 8.5 -12 Q0 -16 -8.5 -12 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>`;
  const shade = `<path d="M-6.5 -11 Q-2 -14 1 -13 Q-1 -2 0 8 Q-3 5 -5.5 -4 Z" fill="@corpsH" opacity="0.22"/>` +
    `<path d="M0 -13 Q1 -1 0 10" fill="none" stroke="@corpsO" stroke-width="0.7" opacity="0.4"/>`;
  // épi de crinière sur la nuque (équin couché / loup hirsute) — tell de l'arrière de l'encolure.
  const m = maneOf(p);
  const mane = m === 'crin' ? `<path d="M-2.4 -13 Q-3 -1 -2 10 L2 10 Q3 -1 2.4 -13 Q0 -15 -2.4 -13 Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.4" opacity="0.85"/>`
    : m === 'hirsute' ? `<path d="M0 -14 l-2.5 -3 l0.6 3.4 l-3 -1.6 l1.4 3.4 Q-2 0 -1.4 9 L1.4 9 Q2 0 1.4 -8 l3 -2 l-2.6 -0.4 l1.6 -3 Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.4"/>` : '';
  // felin : la crinière en couronne fait le tour du crâne, aussi de dos (manticore).
  const ruffFelin = p.head === 'felin'
    ? `<path d="M0 -16 l-3.4 -3.4 l0.6 4 l-4.4 -2.4 l1.8 4 l-4.8 -0.6 l3 3.4 l-4.6 1.4 l4 2.2 l-3.2 3.4 l4.6 0 l-1.6 4.4 l4.2 -2.2 l0.6 4.6 l3.2 -3.6 l3.2 3.6 l0.6 -4.6 l4.2 2.2 l-1.6 -4.4 l4.6 0 l-3.2 -3.4 l4 -2.2 l-4.6 -1.4 l3 -3.4 l-4.8 0.6 l1.8 -4 l-4.4 2.4 l0.6 -4 Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.5" transform="translate(0,-2)"/>`
    : '';
  return `<g>${ruffFelin}${earBack}${skull}${shade}${mane}</g>`;
}
// Arrière-train DOS des CANIDÉS/FÉLINS : SVELTE et HAUT (cuisses musclées mais pas de grosses
// « fesses » d'ongulé), queue touffue tombante au centre, jarrets qui se devinent. ≠ croupe large.
function bodyBackCanine(p: QuadProps): string {
  const w = p.build === 'feline' ? 16 : 15;
  const body = `<path d="M${-w} -6 Q${-w} -19 -6 -23 Q0 -25 6 -23 Q${w} -19 ${w} -6 Q${w - 1} 9 7 19 Q0 23 -7 19 Q${-(w - 1)} 9 ${-w} -6 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>`;
  // deux cuisses fuselées (reflet vertical) + sillon central + ombres de flanc.
  const haunch = `<ellipse cx="${-w * 0.42}" cy="-3" rx="${w * 0.4}" ry="13" fill="@corpsH" opacity="0.28"/>` +
    `<ellipse cx="${w * 0.42}" cy="-3" rx="${w * 0.4}" ry="13" fill="@corpsH" opacity="0.2"/>`;
  const cleft = `<path d="M0 -20 Q1.4 -2 0 19" fill="none" stroke="@corpsO" stroke-width="1" opacity="0.55"/>`;
  const shade = `<path d="M${w} -6 Q${w - 1} 9 7 19 L8 16 Q${w - 2} 8 ${w - 2} -4 Z" fill="@corpsO" opacity="0.42"/>`;
  // fourrure dorsale dressée (loup hirsute) au sommet de la croupe.
  const ridge = maneOf(p) === 'hirsute' ? `<path d="M0 -23 l-2 -3 l0.5 3.2 l-2.4 -1.4 l1.1 3 Q-1.4 -8 -1 -2 L1 -2 Q1.4 -8 1 -5 l2.4 -1.6 l-2.1 -0.4 l1.3 -2.6 Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.4" opacity="0.8"/>` : '';
  return `<g>${body}${haunch}${cleft}${shade}${ridge}</g>`;
}
function bodyBack(p: QuadProps): string {
  if (p.build === 'canine' || p.build === 'feline') return bodyBackCanine(p);
  // Arrière-train vu de DOS : DEUX FESSES rondes séparées par un sillon central profond,
  // masse LARGE et BASSE (plus large que haute) → lit comme une croupe de quadrupède, pas une
  // colonne « debout ». Chaque hanche prend un reflet bombé ; le sillon est creusé (ombre).
  const w = p.head === 'ours' ? 26 : p.head === 'rat' ? 16 : p.head === 'sanglier' ? 23 : 22;
  // silhouette : dôme du dos en haut, hanches larges au milieu, bas qui se referme (sortie des
  // postérieurs). Léger renflement à mi-flanc (les fesses débordent la taille).
  const body = `<path d="M${-w} -5 Q${-w - 1} -17 ${-w * 0.46} -21 Q0 -23 ${w * 0.46} -21 Q${w + 1} -17 ${w} -5 Q${w} 12 ${w * 0.5} 22 Q0 26 ${-w * 0.5} 22 Q${-w} 12 ${-w} -5 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>`;
  // deux hanches bombées (reflet) — la droite un peu moins éclairée (volume).
  const cheeks =
    `<ellipse cx="${-w * 0.44}" cy="-1" rx="${w * 0.42}" ry="13.5" fill="@corpsH" opacity="0.34"/>` +
    `<ellipse cx="${w * 0.44}" cy="-1" rx="${w * 0.42}" ry="13.5" fill="@corpsH" opacity="0.24"/>`;
  // sillon central profond (raie des fesses) — large ombre douce + trait sombre net.
  const cleft = `<path d="M0 -19 Q2 1 0 22 Q-2 1 0 -19 Z" fill="@corpsO" opacity="0.4"/>` +
    `<path d="M0 -18 Q1.4 2 0 21" fill="none" stroke="@corpsO" stroke-width="1.1" opacity="0.6"/>`;
  // bords de flanc qui s'enroulent en arrière (rondeur) + ombre sous-fessière.
  const shade =
    `<path d="M${w} -5 Q${w} 12 ${w * 0.5} 22 L${w * 0.6} 20 Q${w - 2} 10 ${w - 2} -3 Z" fill="@corpsO" opacity="0.42"/>` +
    `<path d="M${-w} -5 Q${-w} 12 ${-w * 0.5} 22 L${-w * 0.6} 20 Q${-(w - 2)} 10 ${-(w - 2)} -3 Z" fill="@corpsO" opacity="0.3"/>` +
    `<ellipse cx="0" cy="20" rx="${w * 0.62}" ry="5" fill="@corpsO" opacity="0.22"/>`;
  return `<g>${body}${cheeks}${cleft}${shade}</g>`;
}
function tailBack(p: QuadProps): string {
  // queue vue de dos : pend au centre, sous la croupe.
  if (p.tail === 'sans') return ''; // batracien : pas de queue
  if (p.tail === 'reptile' || p.tail === 'enroulee') return `<path d="M-2.4 0 Q-3 18 -1 32 Q0 40 0 46 Q0 40 1 32 Q3 18 2.4 0 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>`;
  if (p.tail === 'leonine') return `<path d="M-2 0 Q-2 14 0 22 Q2 14 2 0 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/><circle cx="0" cy="25" r="2.6" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.4"/>`;
  if (p.tail === 'dard') return `<path d="M-2.6 0 Q-3.4 12 -1.6 24 Q0 28 1.6 24 Q3.4 12 2.6 0 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/><path d="M-2.1 6 l4.2 0 M-2.3 12 l4.6 0 M-1.8 18 l3.6 0" stroke="@corpsO" stroke-width="0.7"/><circle cx="0" cy="27" r="3.2" fill="@corps" stroke="@corpsO" stroke-width="0.6"/><path d="M-1 29.6 Q-1.4 35 0 38.4 Q1.4 35 1 29.6 Z" fill="@cuir" stroke="#1a140e" stroke-width="0.4"/>`;
  if (p.tail === 'crin') return `<path d="M-2 0 Q-3 16 -2 30 Q0 33 2 30 Q3 16 2 0 Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.5"/>`;
  if (p.tail === 'touffe') return `<path d="M-3 0 Q-4 12 -2 24 Q0 28 2 24 Q4 12 3 0 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/><path d="M-2 14 Q0 26 2 14 Z" fill="@cheveux"/>`;
  if (p.tail === 'touffe-basse') // pend au centre, fournie (bords en touffes), pointe sombre
    return `<path d="M-3.2 0 Q-4.4 10 -3 20 l1.2 -1.8 l0.4 4.4 Q0 25 1.6 22.4 l0.6 -3 l1.2 2 Q4.4 11 3.2 0 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/><path d="M-1.4 20 Q0 26.4 1.8 20.6 Q0.4 19 -1.4 20 Z" fill="@cheveux"/>`;
  if (p.tail === 'nue') return `<path d="M0 0 Q-1 16 0 30 Q1 34 1 36" fill="none" stroke="#caa" stroke-width="2.2" stroke-linecap="round" opacity="0.9"/>`;
  if (p.tail === 'courte') return `<path d="M-2 0 Q-2 6 0 8 Q2 6 2 0 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>`;
  return `<path d="M0 0 Q-1 9 0 18 Q1 22 0 24" fill="none" stroke="@corps" stroke-width="2.2" stroke-linecap="round"/><circle cx="0" cy="24" r="1.6" fill="@cheveux"/>`;
}

// ============================ AILES (gabarit ailé) ============================
// Repère LOCAL = garrot. DEUX ÉTATS d'art (cf. WingState) : REPLIÉES le long du dos (repos —
// les lames dressées en permanence lisaient « feuilles plantées ») / DÉPLOYÉES (vol/attaque).
// PROFIL replié : l'aile se couche vers l'arrière (-x), couvre le haut du flanc, pointe au-delà
// de la croupe. FACE/DOS : déployée vers +x (aile gauche miroitée scale(-1,1) au dispatch).
// Couleur d'AILE : famille de jetons dédiée `@aile*`, repliée sur la ROBE (`@corps*`) quand la
// def ne stocke pas de base `aile` (cf. resolveQuadFromProps) — permet une aile d'une AUTRE
// teinte que le corps (pégase : robe blanche, ailes brun/doré, artwork LDB 79 p.325).
function wingFoldedProfile(p: QuadProps, far: boolean): string {
  const c = far ? '@aileO' : '@aile';
  const L = 46 * p.bodyLen; // longueur du pli (suit l'allongement du corps)
  if (p.wings === 'membrane') { // membrane pliée : doigts rabattus en faisceau le long du dos + griffe au poignet
    if (p.wingPose === 'deployees') // PAIRE demi-ouverte DÉPLOYÉE (dragon, artwork LDB p.321) : même voile
      // dressée que 'dressees' mais lisible en aile MEMBRANEUSE — panneaux pâles translucides (@aileH)
      // entre les doigts côté proche, aile lointaine basculée vers la queue montrant son ENVERS clair
      return `<g data-wing="folded" transform="rotate(${far ? -24 : 0})" opacity="${far ? 0.92 : 1}">` +
        `<path d="M0 0 Q-3 -20 -13 -44 L-28 -12 Q-24 -9 -20 -4 Q-16 -9 -11 -2 Q-6 -6 0 2 Z" fill="${far ? '@aileH' : '@aile'}" stroke="@aileO" stroke-width="0.7"/>` +
        (far ? '' :
          `<path d="M-13 -44 Q-22 -28 -28 -12 Q-24 -9 -20 -4 Q-19 -26 -13 -44 Z" fill="@aileH" opacity="0.4"/>` +
          `<path d="M-13 -44 Q-19 -26 -20 -4 Q-16 -9 -11 -2 Q-13 -24 -13 -44 Z" fill="@aileH" opacity="0.24"/>`) +
        `<path d="M0 0 Q-7 -24 -13 -44" fill="none" stroke="@aileO" stroke-width="2.6" stroke-linecap="round"/>` +
        `<path d="M-13 -44 Q-22 -28 -28 -12 M-13 -44 Q-19 -26 -20 -4 M-13 -44 Q-13 -24 -11 -2" fill="none" stroke="@aileO" stroke-width="1.4" stroke-linecap="round"/>` +
        `<path d="M-13 -44 l-2.6 -4.6 l4 1.8 Z" fill="${far ? '@aileH' : '@aile'}" stroke="@aileO" stroke-width="0.6"/>` + // griffe de poignet au sommet
        `</g>`;
    if (p.wingPose === 'dressees') // repliées DRESSÉES : membrane à demi-ouverte POINTÉE vers le haut,
      // poignet griffu au sommet (manticore/chauve-souris au repos — pas couchée façon planeur)
      return `<g data-wing="folded" opacity="${far ? 0.9 : 1}">` +
        `<path d="M0 0 Q-3 -20 -13 -44 L-28 -12 Q-24 -9 -20 -4 Q-16 -9 -11 -2 Q-6 -6 0 2 Z" fill="${c}" stroke="@aileO" stroke-width="0.7"/>` +
        `<path d="M0 0 Q-7 -24 -13 -44" fill="none" stroke="@aileO" stroke-width="2.6" stroke-linecap="round"/>` +
        `<path d="M-13 -44 Q-22 -28 -28 -12 M-13 -44 Q-19 -26 -20 -4 M-13 -44 Q-13 -24 -11 -2" fill="none" stroke="@aileO" stroke-width="1.4" stroke-linecap="round"/>` +
        `<path d="M-13 -44 l-2.6 -4.6 l4 1.8 Z" fill="${c}" stroke="@aileO" stroke-width="0.6"/>` + // griffe de poignet au sommet
        `</g>`;
    return `<g data-wing="folded">` +
      `<path d="M2 -2 Q-6 -7 ${-L * 0.45} -6 Q${-L} -3 ${-L - 7} 4 Q${-L * 0.6} 3 ${-L * 0.3} 4 Q-4 5 3 3 Z" fill="${c}" stroke="@aileO" stroke-width="0.7"/>` +
      `<path d="M1 -1 Q${-L * 0.4} -5 ${-L - 5} 3 M0 1 Q${-L * 0.4} -2 ${-L * 0.72} 2" fill="none" stroke="@aileO" stroke-width="1.1" stroke-linecap="round" opacity="0.8"/>` +
      `<path d="M3 -2 l3 -3 l1.4 3.4" fill="${c}" stroke="@aileO" stroke-width="0.6"/>` + // griffe de poignet
      `</g>`;
  }
  // plumes DRESSÉES (wingPose 'dressees' — pégase, artwork LDB 79 p.325) : paire de GRANDES ailes
  // LEVÉES vers le haut/arrière, lame emplumée large à rémiges digitées au sommet. L'aile
  // lointaine (far) est plus couchée en arrière que la proche → deux silhouettes distinctes en V.
  // Même vocabulaire wingPose que la membrane (manticore) ; défaut plumes = couchées ci-dessous.
  if (p.wingPose === 'dressees') {
    const rot = (far ? -26 : -4) + (p.wingLift ?? 0);
    return `<g data-wing="folded" transform="rotate(${rot})" opacity="${far ? 0.92 : 1}">` +
      // lame LARGE : bord d'attaque (avant) → pointe DIGITÉE au sommet → bord de fuite vers l'épaule
      `<path d="M4 0 Q0 -6 -3 -14 Q-6 -23 -12 -30 Q-17 -36 -24 -40 l-1 3.6 -3.8 -1 1 3.8 -3.8 -0.2 1.1 3.6 -3.7 0.7 Q-30 -21 -24 -14 Q-17 -5 -10 1 Q-3 6 5 4 Z" fill="${c}" stroke="@aileO" stroke-width="0.7"/>` +
      // panneau interne clair (volume) + longues rémiges + couvertures festonnées à la base
      `<path d="M2 -1 Q-2 -8 -5 -16 Q-8 -24 -13 -30 Q-17 -25 -14 -17 Q-10 -7 -4 0 Z" fill="@aileH" opacity="0.28"/>` +
      `<path d="M-24 -38 Q-17 -26 -10 -9 M-28 -34 Q-21 -23 -13 -6 M-31 -30 Q-24 -20 -16 -4" fill="none" stroke="@aileO" stroke-width="0.8" opacity="0.65"/>` +
      `<path d="M-4 -6 q-4.6 3 -9.6 2.2 M-9 -13 q-4.6 3 -9.6 2.2 M-1 -1 q-4.6 3 -9.6 2.2" fill="none" stroke="@aileO" stroke-width="0.7" opacity="0.7"/>` +
      // arête d'attaque claire
      `<path d="M3 -1 Q-2 -10 -7 -20 Q-13 -31 -22 -38" fill="none" stroke="@aileH" stroke-width="1.1" opacity="0.6"/>` +
      `</g>`;
  }
  // plumes REPLIÉES : vraie aile de rapace couchée — épaule pleine, rangées de COUVERTURES
  // festonnées, RÉMIGES sombres dont les pointes dépassent la croupe, arête d'aile claire —
  // les 3 hachures plates lisaient « lignes sur le dos », pas une aile.
  const prim = (sx: number, sy: number, tx: number, ty: number, w: number) =>
    `M${sx} ${sy} Q${((sx + tx) / 2).toFixed(1)} ${(Math.min(sy, ty) - 3).toFixed(1)} ${tx.toFixed(1)} ${ty} q-1.8 ${w} -5 ${(w * 0.75).toFixed(1)} Q${((sx + tx) / 2).toFixed(1)} ${(sy + w * 0.9).toFixed(1)} ${sx} ${sy + w} Z`;
  const scallop = (x: number, y: number) => `M${x.toFixed(1)} ${y} q-4.8 3.8 -10.4 3.3`;
  return `<g data-wing="folded">` +
    `<path d="${prim(-8, 0, -L - 8, -4, 3.4)} ${prim(-10, 2, -L - 4, 1, 3.2)} ${prim(-12, 4, -L + 2, 6, 3)}" fill="@aileO" stroke="#171008" stroke-width="0.4"/>` +
    `<path d="M6 -5 Q-3 -10.5 ${(-L * 0.34).toFixed(1)} -10.4 Q${(-L * 0.72).toFixed(1)} -8.6 ${(-L - 5).toFixed(1)} -4 Q${(-L * 0.66).toFixed(1)} 2.6 ${(-L * 0.28).toFixed(1)} 4.6 Q-3 5.6 6 0.6 Z" fill="${c}" stroke="@aileO" stroke-width="0.7"/>` +
    `<path d="${scallop(-2, -2)} ${scallop(-L * 0.24, -2.6)} ${scallop(-L * 0.46, -3)} ${scallop(-L * 0.68, -3.2)} ${scallop(-L * 0.12, 2)} ${scallop(-L * 0.36, 1.6)} ${scallop(-L * 0.58, 1)} ${scallop(-L * 0.78, 0.4)}" fill="none" stroke="@aileO" stroke-width="0.75" opacity="0.75"/>` +
    `<path d="M4 -5.4 Q${(-L * 0.4).toFixed(1)} -10.8 ${(-L - 4).toFixed(1)} -4.6" fill="none" stroke="@aileH" stroke-width="1.1" opacity="0.6"/>` +

    `</g>`;
}
function wingProfile(p: QuadProps, far: boolean): string {
  const c = far ? '@aileO' : '@aile';
  if (p.wings === 'membrane') { // dragon : grande membrane à doigts dressée haut au-dessus du dos
    return `<g opacity="${far ? 0.9 : 1}">` +
      `<path d="M0 0 Q-4 -30 -16 -52 L-34 -8 Q-29 -5 -25 -1 Q-20 -5 -14 1 Q-7 -3 0 2 Z" fill="${c}" stroke="@aileO" stroke-width="0.7"/>` +
      `<path d="M0 0 Q-8 -26 -16 -52" fill="none" stroke="@aileO" stroke-width="2.8" stroke-linecap="round"/>` +
      `<path d="M-16 -52 Q-26 -30 -34 -8 M-16 -52 Q-24 -28 -25 -1 M-16 -52 Q-16 -26 -14 1" fill="none" stroke="@aileO" stroke-width="1.6" stroke-linecap="round"/>` +
      `</g>`;
  }
  // plumes DÉPLOYÉES (profil) : grande aile de rapace portée À L'HORIZONTALE vers l'arrière —
  // bras qui monte au poignet puis RÉMIGES DIGITÉES séparées par des encoches (l'ex-éventail de
  // lames quasi verticales lisait « planches dressées », pas une envergure de rapace).
  return `<g>` +
    `<path d="M0 0 Q-8 -10 -20 -17 Q-31 -22 -45 -18 Q-37 -13 -36 -12 Q-44 -11 -42 -9 Q-34 -6 -32 -6 Q-39 -2 -37 0 Q-29 1 -28 1 Q-34 5 -32 6.6 Q-22 6 -18 4.4 Q-8 5.6 -2 3.6 Z" fill="${c}" stroke="@aileO" stroke-width="0.7"/>` +
    `<path d="M-18 -15 Q-28 -18 -39 -15 M-17 -11 Q-27 -11 -35 -7 M-14 -7 Q-22 -5 -31 -1 M-11 -3 Q-19 0 -27 4" stroke="@aileO" stroke-width="0.7" fill="none" opacity="0.6"/>` +
    `<path d="M-4 -4 q-3.6 2.4 -8 2.2 M-11 -8 q-3.6 2.4 -8 2.2 M-9 -0.6 q-3.6 2.4 -8 2.2" stroke="@aileO" stroke-width="0.7" fill="none" opacity="0.6"/>` +
    `<path d="M0 -1.4 Q-10 -11 -21 -17" stroke="@aileH" stroke-width="1.2" fill="none" opacity="0.6"/>` +
    `</g>`;
}
// Déployée (face/dos) — vers +x : grande aile qui s'élève ET s'étend (silhouette de rapace
// déployant). Bras + surface + rémiges/doigts. (Aile G = miroir scale(-1,1) au dispatch.)
function wingSpread(p: QuadProps): string {
  if (p.wings === 'membrane') { // dragon : grande membrane à doigts, montant haut
    return `<g>` +
      `<path d="M0 0 Q18 -22 38 -22 Q54 -21 62 -10 L54 -7 Q50 -12 42 -4 Q38 -13 30 -2 Q24 -12 16 0 Q8 -6 0 3 Z" fill="@aile" stroke="@aileO" stroke-width="0.7"/>` +
      `<path d="M0 0 Q28 -20 60 -11" fill="none" stroke="@aileO" stroke-width="2.4" stroke-linecap="round"/>` +
      `<path d="M38 -21 Q41 -12 42 -4 M30 -19 Q30 -11 30 -2 M16 -12 Q16 -6 16 0" fill="none" stroke="@aileO" stroke-width="1.5" stroke-linecap="round"/>` +
      `</g>`;
  }
  return `<g>` + // rapace : aile qui monte en arc + 4 rémiges digitées au bout
    `<path d="M0 1 Q16 -16 34 -17 Q52 -18 62 -8 Q50 -4 34 -4 Q16 -2 3 6 Z" fill="@aile" stroke="@aileO" stroke-width="0.7"/>` +
    `<path d="M54 -9 Q62 -9 64 -3 L58 -2 Q52 -5 48 -6 Z M44 -14 Q52 -14 55 -7 L49 -6 Q44 -10 40 -11 Z M32 -16 Q40 -17 43 -10 L37 -9 Q32 -13 28 -13 Z M20 -16 Q27 -16 30 -10 L24 -9 Q20 -13 16 -12 Z" fill="@aile" stroke="@aileO" stroke-width="0.4"/>` +
    `<path d="M8 -4 Q24 -11 44 -10 M10 0 Q26 -5 42 -5" stroke="@aileO" stroke-width="0.6" fill="none" opacity="0.5"/>` +
    `</g>`;
}

// Aile PLIÉE vue de bout (face/dos) : panneau replié qui ÉPOUSE LE FLANC vers le bas (épaule
// modeste + pan qui descend le long du corps) — l'ex-bosse dressée au garrot lisait comme de
// grandes « oreilles d'âne » près de la tête (verdict unanime des juges aveugles, lot 4).
function wingFoldedEnd(p: QuadProps): string {
  const c = p.wings === 'membrane' ? '@aileO' : '@aile';
  if (p.wingPose === 'dressees' || p.wingPose === 'deployees') // pliées DRESSÉES vues de bout : panneau qui MONTE en pointe
    // au-dessus de l'épaule (silhouette de chauve-souris au repos), griffe au sommet
    return `<g data-wing="folded">` +
      `<path d="M0 -2 Q4 -10 6.5 -19 Q8 -23.5 9.6 -21.5 Q10 -8 8 6 Q5.5 12 2.6 9 Q1 4 0 0 Z" fill="${c}" stroke="@aileO" stroke-width="0.6"/>` +
      `<path d="M4 -6 Q6.4 -14 8.6 -19 M3 -1 Q5.6 -9 7.6 -14" fill="none" stroke="@aileO" stroke-width="0.7" opacity="0.6"/>` +
      `<path d="M8.4 -21.5 l1 -3 l1.6 2.4 Z" fill="${c}" stroke="@aileO" stroke-width="0.5"/>` +
      `</g>`;
  return `<g data-wing="folded">` +
    `<path d="M0 -2 Q5 -7 8 -4 Q10 1 9.5 8 Q9 15 6 19 Q3.6 20.5 2.4 18 Q1 9 0 0 Z" fill="${c}" stroke="@aileO" stroke-width="0.6"/>` +
    `<path d="M3.4 -1 Q5.6 6 5 16 M6.4 -2 Q8.2 5 7.6 13" fill="none" stroke="@aileO" stroke-width="0.7" opacity="0.6"/>` +
    (p.wings === 'membrane' ? `<path d="M7.4 -4.6 l2 -2 l0.8 2.6" fill="${c}" stroke="@aileO" stroke-width="0.5"/>` : '') +
    `</g>`;
}

// ============================ dispatch ============================
export function quadParts(p: QuadProps, view: View = 'profile', wings: 'folded' | 'spread' = 'folded'): Partial<Record<QuadBoneId, string>> {
  const frontFoot: QuadFoot = p.frontFoot ?? p.foot;
  // Envergure : × sur l'art d'aile (déployée ET pliée). Idem tête (headScale) et queue (tailLen).
  const span = (svg: string) => (p.wingSpan && p.wingSpan !== 1 ? `<g transform="scale(${p.wingSpan})">${svg}</g>` : svg);
  const headW = (svg: string) => (p.headScale && p.headScale !== 1 ? `<g transform="scale(${p.headScale})">${svg}</g>` : svg);
  const tailW = (svg: string) => (p.tailLen && p.tailLen !== 1 ? `<g transform="scale(${p.tailLen})">${svg}</g>` : svg);
  // Décor PAR-OS propre à la créature (prop `deco` — précédent : épave du crabe, CrabProps.deco) :
  // SVG local à l'os, APPOSÉ après l'art du gabarit, uniquement là où l'os porte déjà un art dans
  // la vue courante (un os sans art dans cette vue n'affiche pas de décor flottant).
  // Clé `os#vue` = décor limité à cette vue (cf. QuadProps.deco) ; clé nue = toutes les vues.
  const withDeco = (r: Partial<Record<QuadBoneId, string>>): Partial<Record<QuadBoneId, string>> => {
    if (p.deco) for (const [key, svg] of Object.entries(p.deco) as [string, string][]) {
      const [id, vue] = key.split('#') as [QuadBoneId, View | undefined];
      if (svg && (!vue || vue === view) && r[id]) r[id] += svg;
    }
    return r;
  };
  // Ailes face/dos : déployées vers ±x, ou bosses pliées au garrot (aileG = miroir scale -1).
  const endArt = wings === 'spread' ? wingSpread(p) : wingFoldedEnd(p);
  const spreadWings = p.wings
    ? { aileD: span(endArt), aileG: `<g transform="scale(-1,1)">${span(endArt)}</g>` }
    : {};
  if (view === 'front') {
    const n = legPartsFront(p, false, frontFoot, true), f = legPartsFront(p, true, p.foot);
    return withDeco({
      ...spreadWings,
      tronc: bodyFront(p), tete: headW(headgear(p, 'front') + headFront(p)),
      hautAvD: n.haut, basAvD: n.bas, piedAvD: n.pied, hautAvG: n.haut, basAvG: n.bas, piedAvG: n.pied,
      hautArD: f.haut, basArD: f.bas, piedArD: f.pied, hautArG: f.haut, basArG: f.bas, piedArG: f.pied,
    });
  }
  if (view === 'back') {
    const n = legPartsFront(p, false, p.foot), f = legPartsFront(p, true, frontFoot, true);
    return withDeco({
      ...spreadWings,
      tronc: bodyBack(p), tete: headW(headgear(p, 'back') + napeBack(p)), queue: tailW(tailBack(p)),
      hautArD: n.haut, basArD: n.bas, piedArD: n.pied, hautArG: n.haut, basArG: n.bas, piedArG: n.pied,
      hautAvD: f.haut, basAvD: f.bas, piedAvD: f.pied, hautAvG: f.haut, basAvG: f.bas, piedAvG: f.pied,
    });
  }
  // profil : pattes AVANT (frontFoot) près/loin, pattes ARRIÈRE (p.foot) près/loin.
  const nearAv = legParts(p, false, frontFoot, true), farAv = legParts(p, true, frontFoot, true);

  const nearAr = legParts(p, false, p.foot), farAr = legParts(p, true, p.foot);
  const profArt = (far: boolean) => span(wings === 'spread' ? wingProfile(p, far) : wingFoldedProfile(p, far));
  const profWings = p.wings ? { aileD: profArt(false), aileG: profArt(true) } : {};
  return withDeco({
    ...profWings,
    // Tête de PROFIL agrandie (1.3) : à l'échelle nue elle lisait « minuscule/sombre » au bout
    // de l'encolure. Ancrée à la jonction tête-cou (0,0) → grandit sans se détacher du cou.
    tronc: barrel(p), encolure: neck(p), tete: headW(`<g transform="scale(1.3)">${headgear(p, 'profile')}${headProfile(p)}</g>`), queue: tailW(tail(p)),
    hautAvD: nearAv.haut, basAvD: nearAv.bas, piedAvD: nearAv.pied,
    hautArD: nearAr.haut, basArD: nearAr.bas, piedArD: nearAr.pied,
    hautAvG: farAv.haut, basAvG: farAv.bas, piedAvG: farAv.pied,
    hautArG: farAr.haut, basArG: farAr.bas, piedArG: farAr.pied,
  });
}

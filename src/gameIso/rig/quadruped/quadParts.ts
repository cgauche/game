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
const taper = (len: number, thTop: number, thBot: number, fill: string): string => {
  const r1 = thTop / 2, r2 = thBot / 2;
  const e = (t: number) => (r1 + (r2 * 0.92 - r1) * t).toFixed(2); // bord à la fraction t
  const y0 = (len * 0.3).toFixed(1);
  return `<path d="M${-r1} 0 Q${-r1} ${-r1 * 0.6} 0 ${-r1 * 0.6} Q${r1} ${-r1 * 0.6} ${r1} 0 L${r2 * 0.92} ${len} Q0 ${len + r2 * 0.7} ${-r2 * 0.92} ${len} Z" fill="${fill}"/>` +
    `<path d="M${-e(0.3)} ${y0} L${-r2 * 0.92} ${len} Q0 ${len + r2 * 0.7} ${r2 * 0.92} ${len} L${e(0.3)} ${y0}" fill="none" stroke="@corpsO" stroke-width="0.5"/>`;
};
function hoof(foot: QuadFoot, far: boolean): string {
  const c = far ? '@cuirO' : '@cuir';
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
function footFront(foot: QuadFoot, far: boolean): string {
  const c = far ? '@cuirO' : '@cuir';
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
const joint = (body: string, cy: number, r: number) =>
  `<circle cx="0" cy="${cy.toFixed(1)}" r="${r}" fill="${body}" stroke="@corpsO" stroke-width="0.3"/>`;

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

function legParts(p: QuadProps, far: boolean, foot: QuadFoot) {
  const ll = p.legLen;
  const body = far ? '@corpsO' : '@corps';
  const L = LEG_BUILD[p.build] ?? LEG_BUILD.equine;
  return {
    haut: muscle(body, L.mass, 30 * ll) + taper(30 * ll, L.haut, L.bas + 1.4, body), // cuisse → genou
    // canon : plus FIN que la cuisse, s'effile vers le boulet ; jarret/genou bouché à la jointure.
    bas: joint(body, 0, (L.bas + 1.4) * 0.52) + taper(22 * ll, L.bas + 0.6, L.bas * 0.78, body) + joint(body, 22 * ll, L.bas * 0.4) + balzane(p, ll, L.bas + 0.6, far),
    pied: hoof(foot, far), // sabot À l'os du pied (bas de la jambe) — PAS 22·ll plus bas (sinon détaché)
  };
}
function legPartsFront(p: QuadProps, far: boolean, foot: QuadFoot) {
  const ll = p.legLen;
  const body = far ? '@corpsO' : '@corps';
  const L = LEG_BUILD[p.build] ?? LEG_BUILD.equine;
  const k = far ? 0.84 : 1;
  // Membre FRONTAL = colonne d'aplomb, plus PLEINE qu'en profil (le canon ne s'effile presque
  // pas, sinon « patte d'insecte »). Cuisse haute fondue dans le corps, canon trapu jusqu'au pied.
  return {
    haut: muscle(body, L.mass * 0.5 * k, 26 * ll) + taper(30 * ll, L.haut * 0.95 * k, (L.bas + 1.8) * k, body),
    bas: joint(body, 0, (L.bas + 1.8) * k * 0.5) + taper(22 * ll, (L.bas + 1.2) * k, L.bas * 0.95 * k, body) + joint(body, 22 * ll, L.bas * 0.46) + balzane(p, ll, (L.bas + 1.2) * k, far),
    pied: footFront(foot, far), // pied à l'os (bas de la jambe), pas 22·ll plus bas
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
      break;
    case 'canine': // loup/chien : garrot haut, DOS qui plonge vers la croupe, poitrail PROFOND
      // descendu au coude, fort RELEVÉ de ventre (flanc creusé) au niveau du rein — silhouette
      // lévrier/lupin, pas un tube. +x = avant.
      path = `M${X(30)} 2 Q${X(33)} -8 ${X(31)} -12 Q${X(28)} -17 ${X(22)} -17 Q${X(4)} -16 ${X(-12)} -14 Q${X(-30)} -12 ${X(-40)} -7 Q${X(-45)} -2 ${X(-43)} 3 Q${X(-40)} 6 ${X(-33)} 6 Q${X(-24)} 6 ${X(-18)} 3 Q${X(-8)} 7 ${X(4)} 11 Q${X(16)} 14 ${X(25)} 13 Q${X(31)} 8 ${X(30)} 2 Z`;
      hi = `<path d="M${X(-28)} -13 Q${X(-4)} -16 ${X(18)} -16 L${X(17)} -12 Q${X(-4)} -13 ${X(-27)} -9 Z" fill="@corpsH" opacity="0.5"/>`;
      lo = `<path d="M${X(-33)} 5 Q${X(-22)} 5 ${X(-16)} 2.5 Q${X(-6)} 6 ${X(6)} 10 Q${X(18)} 13 ${X(24)} 11 L${X(22)} 7 Q${X(14)} 9 ${X(4)} 6 Q${X(-8)} 3 ${X(-18)} 0 Q${X(-26)} 1.5 ${X(-32)} 1 Z" fill="@corpsO" opacity="0.7"/>`;
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
  return `<g><path d="${path}" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>${lo}${flank}${thigh}${hi}${ridgeArt(p)}${markingsArt(p)}</g>`;
}
// Dorsale (prop `ridge`, défaut 'epines' pour draconic) : ÉPINES pointues / CRÊTE-voile
// ondulée / PLAQUES rondes, le long du haut du dos. Coordonnées calées sur le dos draconic —
// les autres builds varient de quelques px (acceptable : la dorsale vit sur les reptiliens).
function ridgeArt(p: QuadProps): string {
  const r = p.ridge ?? (p.build === 'draconic' ? 'epines' : 'sans');
  if (r === 'sans') return '';
  const bl = p.bodyLen;
  if (r === 'epines')
    return `<g data-ridge="epines"><path d="M${-20 * bl} -14 l-1 -5 l3 4 M${-8 * bl} -19 l0 -6 l3 5 M${6 * bl} -21 l1 -6 l2 5 M${18 * bl} -18 l1 -5 l2 4" fill="@corpsO" stroke="@corpsO" stroke-width="0.5"/></g>`;
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
// besoin d'os supplémentaires. Tête reptilienne miniature (museau +x, corne, œil fendu, dents).
function hydraHeadlet(tx: number, ty: number, rot: number, s: number): string {
  return `<g transform="translate(${tx},${ty}) rotate(${rot}) scale(${s})">` +
    `<path d="M-4 -3 Q-6 3 -1 5 Q5 7 11 4 Q15 2 13 -1 Q7 -2 2 -2 Q-2 -3 -4 -3 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>` +
    `<path d="M-3 -2.6 l-1.6 -4.5 l3.2 2.4 z" fill="@corpsO" stroke="#1a140e" stroke-width="0.3"/>` +
    `<ellipse cx="2" cy="0.2" rx="1.4" ry="1.7" fill="#d8b020"/><ellipse cx="2" cy="0.2" rx="0.45" ry="1.5" fill="#0a0603"/>` +
    `<path d="M4 4.2 l0.6 1.6 M7 4.4 l0.5 1.5 M10 3.8 l0.4 1.4" stroke="#e8e0c8" stroke-width="0.5"/></g>`;
}
function hydraNeck(x1: number, y1: number, cx: number, cy: number, x2: number, y2: number): string {
  return `<path d="M${x1} ${y1} Q${cx} ${cy} ${x2} ${y2}" fill="none" stroke="@corps" stroke-width="5.5" stroke-linecap="round"/>` +
    `<path d="M${x1} ${y1} Q${cx} ${cy} ${x2} ${y2}" fill="none" stroke="@corpsO" stroke-width="1.4" opacity="0.45" stroke-linecap="round"/>`;
}
function neck(p: QuadProps): string {
  if (p.head === 'hydre') { // 3 cous serpentins en éventail, chacun coiffé d'une tête reptilienne
    const L = 30 * p.neckLen;
    return `<g>` +
      hydraNeck(-3, 2, -12, -L * 0.6, -15, -L * 0.95) +
      hydraNeck(0, 2, 4, -L * 0.7, 6, -L * 1.08) +
      hydraNeck(3, 2, 14, -L * 0.5, 20, -L * 0.8) +
      hydraHeadlet(-15, -L * 0.95, -25, 1.05) +
      hydraHeadlet(6, -L * 1.08, 2, 1.15) +
      hydraHeadlet(20, -L * 0.8, 28, 1.0) + `</g>`;
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
  return `<g>${base}${crin}</g>`;
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
  if (p.head === 'hydre') return ''; // têtes dessinées dans l'os encolure (cluster)
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
  if (p.head === 'crapaud') // tête large et plate, GROS œil bombé doré sur le dessus, large bouche
    return `<g transform="rotate(2)"><path d="M-7 -2 Q-9 6 -1 9 Q8 12 16 9 Q20 7 19 1 Q12 -1 5 -2 Q-2 -3 -7 -2 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
      `<ellipse cx="-1" cy="-3.5" rx="4.2" ry="4" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>` +
      `<circle cx="-0.5" cy="-4" r="2.3" fill="#caa024"/><ellipse cx="-0.5" cy="-4" rx="0.7" ry="2.1" fill="#0a0603"/><circle cx="0.2" cy="-5" r="0.5" fill="#fff" opacity="0.7"/>` +
      `<path d="M3 7.5 Q10 10 17 7.5" stroke="@corpsO" stroke-width="1" fill="none"/>` +
      `<circle cx="7" cy="2" r="0.9" fill="@corpsO"/><circle cx="12" cy="4" r="0.8" fill="@corpsO"/><circle cx="4" cy="5" r="0.7" fill="@corpsO"/></g>`;
  if (p.head === 'cheval')
    return `<g transform="rotate(8)"><path d="M-7 -6 Q-9 6 -3 12 Q4 20 12 22 Q18 22 19 17 Q18 12 12 10 Q4 6 2 -4 Q0 -9 -7 -6 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/><path d="M12 10 Q18 12 19 17 Q18 20 14 20 Q10 18 11 12 Z" fill="@corpsO"/><ellipse cx="16" cy="17" rx="2" ry="1.5" fill="#1a0f08"/>${earProfile(p, -5, -1)}${earProfile(p, 0, 1)}<path d="M-6 -4 Q-2 -7 1 -3" fill="none" stroke="@cheveux" stroke-width="2" opacity="0.8"/>${eye}</g>`;
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
  if (p.head === 'rat')
    return `<g transform="rotate(16)"><path d="M-6 -4 Q-8 5 -1 8 Q5 11 16 12 Q21 11 21 9 Q18 8 12 7 Q3 5 1 -3 Q0 -7 -6 -4 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/><ellipse cx="20" cy="10" rx="1.5" ry="1.2" fill="#d8a0a0"/><ellipse cx="14" cy="6" rx="1.4" ry="1.7" fill="#1a0808"/><path d="M14 13 q-2 4 -4 2" fill="none" stroke="#e8e0c8" stroke-width="0.9"/>${earProfile(p, -4, -1)}${earProfile(p, 1, 1)}</g>`;
  if (p.head === 'ours')
    return `<g transform="rotate(10)"><path d="M-8 -6 Q-10 7 0 11 Q9 14 15 12 Q19 10 17 6 Q12 5 8 4 Q0 2 -1 -5 Q-2 -9 -8 -6 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/><ellipse cx="15" cy="9" rx="2.6" ry="2.8" fill="@corpsO"/><ellipse cx="16" cy="9" rx="1.2" ry="1.4" fill="#120a06"/>${earProfile(p, -6, -1)}${earProfile(p, 1, 1)}${eye}</g>`;
  // sanglier
  return `<g transform="rotate(10)"><path d="M-7 -4 Q-9 6 0 10 Q9 13 15 11 Q19 9 17 5 Q12 4 8 3 Q1 2 0 -4 Q-1 -8 -7 -4 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/><ellipse cx="15" cy="8" rx="3" ry="3.4" fill="@corpsO"/><ellipse cx="15" cy="8" rx="1" ry="1.4" fill="#140a06"/><path d="M12 11 q-2 5 -5 3" fill="none" stroke="#e8e0c8" stroke-width="1.6" stroke-linecap="round"/>${earProfile(p, -5, -1)}${earProfile(p, 0.5, 1)}${eye}</g>`;
}
function tail(p: QuadProps): string {
  if (p.tail === 'sans') return ''; // batracien : pas de queue
  if (p.tail === 'reptile') // longue queue écailleuse qui TRAÎNE derrière au ras du sol — l'os
    // `queue` penche à 42° (queues pendantes) : on compense dans l'art (miroir + rotate -34
    // ⇒ ~8° de chute vers l'arrière). Avant, elle pendait sous le ventre vers l'avant (!).
    return `<g transform="rotate(-34) scale(-1,1)"><path d="M0 -2 Q16 4 28 2 Q40 0 50 9 Q41 5 30 7 Q16 11 0 6 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/><path d="M6 1 l1.5 -3 M14 1 l1.5 -3 M22 0.6 l1.5 -3 M30 1 l1.4 -2.6 M38 2.4 l1.2 -2.4" stroke="@corpsO" stroke-width="1" stroke-linecap="round"/></g>`;
  if (p.tail === 'leonine') // queue de lion : fouet fin + GROS toupet terminal (tell de l'arrière félin)
    return `<path d="M0 0 Q13 7 17 18 Q19 28 14 33 Q16 24 10 15 Q3 8 0 5 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/><path d="M14 30 Q9 33 10 38 Q13 41 16 38 Q20 40 21 35 Q24 33 21 29 Q19 26 14 30 Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.5"/>`;
  if (p.tail === 'crin') return `<path d="M0 0 Q10 6 10 18 Q9 30 4 34 Q7 24 3 14 Q1 6 0 4 Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.5"/>`;
  if (p.tail === 'touffe') return `<path d="M0 0 Q10 6 13 18 Q15 28 9 31 Q12 22 6 14 Q2 7 0 5 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/><path d="M11 16 Q16 24 10 30 Q12 22 8 16 Z" fill="@cheveux"/>`;
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
  if (p.head === 'hydre') // 3 têtes dressées en éventail au-dessus du corps, sur cous courts
    return `<g>` +
      hydraNeck(-4, 8, -9, -4, -12, -13) + hydraNeck(0, 8, 0, -6, 0, -16) + hydraNeck(4, 8, 9, -4, 12, -13) +
      hydraHeadlet(-12, -13, -120, 0.92) + hydraHeadlet(0, -16, -90, 0.98) + hydraHeadlet(12, -13, -60, 0.92) + `</g>`;
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
  if (p.head === 'crapaud') // face TRÈS large, 2 gros yeux bombés écartés en haut, bouche très large
    return `<g><path d="M-12 -6 Q-13 6 -6 13 Q0 16 6 13 Q13 6 12 -6 Q0 -10 -12 -6 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
      `<ellipse cx="-7" cy="-7" rx="4.4" ry="4.2" fill="@corps" stroke="@corpsO" stroke-width="0.6"/><ellipse cx="7" cy="-7" rx="4.4" ry="4.2" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>` +
      `<circle cx="-7" cy="-7.5" r="2.4" fill="#caa024"/><circle cx="-7" cy="-7.5" r="1" fill="#0a0603"/><circle cx="7" cy="-7.5" r="2.4" fill="#caa024"/><circle cx="7" cy="-7.5" r="1" fill="#0a0603"/>` +
      `<path d="M-9 8 Q0 13 9 8" stroke="@corpsO" stroke-width="1.1" fill="none"/>` +
      `<circle cx="-3" cy="2" r="1" fill="@corpsO"/><circle cx="3" cy="3" r="0.9" fill="@corpsO"/><circle cx="0" cy="-1" r="0.8" fill="@corpsO"/></g>`;
  if (p.head === 'cheval')
    return `<g>${ears}<path d="M-7 -14 Q-9 6 -4 16 Q0 19 4 16 Q9 6 7 -14 Q0 -17 -7 -14 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/><path d="M-2 -15 Q0 -17 2 -15 L1.5 12 Q0 14 -1.5 12 Z" fill="@cheveux" opacity="0.6"/><ellipse cx="0" cy="13" rx="4.2" ry="3.2" fill="@corpsO"/><ellipse cx="-1.6" cy="13" rx="0.9" ry="1.3" fill="#140a06"/><ellipse cx="1.6" cy="13" rx="0.9" ry="1.3" fill="#140a06"/>${eyeF(-5, -2)}${eyeF(5, -2)}</g>`;
  if (p.head === 'loup') // bajoues de fourrure + museau CUNÉIFORME long + crocs — raccord avec le
    // profil (le crâne rond sans museau lisait « ours/rat » de face).
    return `<g>${ears}<path d="M-9 -13 Q-11 0 -6 8 Q-2 13 0 14 Q2 13 6 8 Q11 0 9 -13 Q0 -16 -9 -13 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
      `<path d="M-8.6 -2 l-3.6 1.4 l3.2 1.8 l-3 1.6 l3.6 1 M8.6 -2 l3.6 1.4 l-3.2 1.8 l3 1.6 l-3.6 1" stroke="@corps" stroke-width="1.6" fill="none" stroke-linejoin="round"/>` + // bajoues hirsutes
      `<path d="M-4 -1 Q0 -2.5 4 -1 L2.8 11.5 Q0 14.5 -2.8 11.5 Z" fill="@corpsH" opacity="0.45"/>` +
      `<ellipse cx="0" cy="13.5" rx="2.5" ry="2" fill="#120a06"/>` +
      `<path d="M-2.4 15 l0.7 2.6 l1.1 -2.3 M2.4 15 l-0.7 2.6 l-1.1 -2.3" stroke="#e8e0c8" stroke-width="0.7" fill="none"/>` + // crocs
      `${eyeF(-5, -4, 1.5)}${eyeF(5, -4, 1.5)}</g>`;
  if (p.head === 'rat')
    return `<g>${ears}<path d="M-7 -11 Q-9 2 -3 11 Q0 16 3 11 Q9 2 7 -11 Q0 -14 -7 -11 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/><ellipse cx="0" cy="13" rx="1.8" ry="1.5" fill="#d8a0a0"/><path d="M-2 13 q-5 1 -7 -1 M2 13 q5 1 7 -1 M-2 14 q-5 2 -8 1 M2 14 q5 2 8 1" stroke="#cfc8b8" stroke-width="0.4" opacity="0.55"/>${eyeF(-4, -3, 1.4)}${eyeF(4, -3, 1.4)}</g>`;
  if (p.head === 'ours')
    return `<g>${ears}<path d="M-11 -10 Q-13 6 -4 13 Q0 16 4 13 Q13 6 11 -10 Q0 -14 -11 -10 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/><ellipse cx="0" cy="11" rx="4" ry="3.4" fill="@corpsO"/><ellipse cx="0" cy="11.5" rx="1.4" ry="1.6" fill="#120a06"/>${eyeF(-5, -3)}${eyeF(5, -3)}</g>`;
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
  return `<g>${body}${flanks}${sheen}${groove}${crest}</g>`;
}

// ============================ DOS (back) ============================
function napeBack(p: QuadProps): string {
  if (p.head === 'hydre') // dos des 3 cous + arrière des têtes (ovales sombres)
    return `<g>` +
      hydraNeck(-4, 6, -8, -5, -11, -13) + hydraNeck(0, 6, 0, -7, 0, -15) + hydraNeck(4, 6, 8, -5, 11, -13) +
      `<ellipse cx="-11" cy="-13" rx="2.8" ry="3.2" fill="@corpsO"/><ellipse cx="0" cy="-15" rx="3" ry="3.4" fill="@corpsO"/><ellipse cx="11" cy="-13" rx="2.8" ry="3.2" fill="@corpsO"/></g>`;
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
  return `<g>${earBack}${skull}${shade}${mane}</g>`;
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
  if (p.tail === 'reptile') return `<path d="M-2.4 0 Q-3 18 -1 32 Q0 40 0 46 Q0 40 1 32 Q3 18 2.4 0 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>`;
  if (p.tail === 'leonine') return `<path d="M-2 0 Q-2 14 0 22 Q2 14 2 0 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/><circle cx="0" cy="25" r="2.6" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.4"/>`;
  if (p.tail === 'crin') return `<path d="M-2 0 Q-3 16 -2 30 Q0 33 2 30 Q3 16 2 0 Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.5"/>`;
  if (p.tail === 'touffe') return `<path d="M-3 0 Q-4 12 -2 24 Q0 28 2 24 Q4 12 3 0 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/><path d="M-2 14 Q0 26 2 14 Z" fill="@cheveux"/>`;
  if (p.tail === 'nue') return `<path d="M0 0 Q-1 16 0 30 Q1 34 1 36" fill="none" stroke="#caa" stroke-width="2.2" stroke-linecap="round" opacity="0.9"/>`;
  if (p.tail === 'courte') return `<path d="M-2 0 Q-2 6 0 8 Q2 6 2 0 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>`;
  return `<path d="M0 0 Q-1 9 0 18 Q1 22 0 24" fill="none" stroke="@corps" stroke-width="2.2" stroke-linecap="round"/><circle cx="0" cy="24" r="1.6" fill="@cheveux"/>`;
}

// ============================ AILES (gabarit ailé) ============================
// Repère LOCAL = garrot. DEUX ÉTATS d'art (cf. WingState) : REPLIÉES le long du dos (repos —
// les lames dressées en permanence lisaient « feuilles plantées ») / DÉPLOYÉES (vol/attaque).
// PROFIL replié : l'aile se couche vers l'arrière (-x), couvre le haut du flanc, pointe au-delà
// de la croupe. FACE/DOS : déployée vers +x (aile gauche miroitée scale(-1,1) au dispatch).
function wingFoldedProfile(p: QuadProps, far: boolean): string {
  const c = far ? '@corpsO' : '@corps';
  const L = 46 * p.bodyLen; // longueur du pli (suit l'allongement du corps)
  if (p.wings === 'membrane') { // membrane pliée : doigts rabattus en faisceau le long du dos + griffe au poignet
    return `<g data-wing="folded">` +
      `<path d="M2 -2 Q-6 -7 ${-L * 0.45} -6 Q${-L} -3 ${-L - 7} 4 Q${-L * 0.6} 3 ${-L * 0.3} 4 Q-4 5 3 3 Z" fill="${c}" stroke="@corpsO" stroke-width="0.7"/>` +
      `<path d="M1 -1 Q${-L * 0.4} -5 ${-L - 5} 3 M0 1 Q${-L * 0.4} -2 ${-L * 0.72} 2" fill="none" stroke="@corpsO" stroke-width="1.1" stroke-linecap="round" opacity="0.8"/>` +
      `<path d="M3 -2 l3 -3 l1.4 3.4" fill="${c}" stroke="@corpsO" stroke-width="0.6"/>` + // griffe de poignet
      `</g>`;
  }
  // plumes pliées : couvertures + rémiges en 3 bandes couchées, pointe effilée vers la croupe
  return `<g data-wing="folded">` +
    `<path d="M3 -3 Q-8 -8 ${-L * 0.5} -7 Q${-L} -4 ${-L - 9} 3 Q${-L * 0.55} 5 ${-L * 0.25} 5 Q-4 5 3 2 Z" fill="${c}" stroke="@corpsO" stroke-width="0.7"/>` +
    `<path d="M0 -4 Q${-L * 0.5} -6 ${-L - 7} 2" fill="none" stroke="@corpsO" stroke-width="0.9" opacity="0.7"/>` +
    `<path d="M-4 0 q-4 3 -9 3 M${-L * 0.32} 1 q-4 3 -9 2.6 M${-L * 0.58} 0 q-4 3 -8.4 2.4 M${-L * 0.8} -0.6 q-3.4 2.6 -7 2.2" fill="none" stroke="@corpsO" stroke-width="0.7" opacity="0.6"/>` +
    `</g>`;
}
function wingProfile(p: QuadProps, far: boolean): string {
  const c = far ? '@corpsO' : '@corps';
  if (p.wings === 'membrane') { // dragon : grande membrane à doigts dressée haut au-dessus du dos
    return `<g opacity="${far ? 0.9 : 1}">` +
      `<path d="M0 0 Q-4 -30 -16 -52 L-34 -8 Q-29 -5 -25 -1 Q-20 -5 -14 1 Q-7 -3 0 2 Z" fill="${c}" stroke="@corpsO" stroke-width="0.7"/>` +
      `<path d="M0 0 Q-8 -26 -16 -52" fill="none" stroke="@corpsO" stroke-width="2.8" stroke-linecap="round"/>` +
      `<path d="M-16 -52 Q-26 -30 -34 -8 M-16 -52 Q-24 -28 -25 -1 M-16 -52 Q-16 -26 -14 1" fill="none" stroke="@corpsO" stroke-width="1.6" stroke-linecap="round"/>` +
      `</g>`;
  }
  // plumes : grande aile emplumée dressée haut-arrière + rémiges en éventail + couvertures
  return `<g>` +
    `<path d="M0 2 Q-5 -18 -13 -34 Q-18 -44 -13 -49 Q-6 -43 -1 -28 Q2 -12 2 0 Z" fill="${c}" stroke="@corpsO" stroke-width="0.6"/>` +
    `<path d="M-13 -47 Q-27 -30 -32 0 L-26 2 Q-20 -24 -11 -43 Z" fill="${c}" stroke="@corpsO" stroke-width="0.5"/>` +
    `<path d="M-11 -43 Q-23 -22 -25 8 L-19 10 Q-15 -18 -8 -39 Z" fill="${c}" stroke="@corpsO" stroke-width="0.5"/>` +
    `<path d="M-8 -38 Q-17 -16 -17 13 L-11 14 Q-10 -14 -6 -35 Z" fill="${c}" stroke="@corpsO" stroke-width="0.5"/>` +
    `<path d="M-2 -26 Q-8 -28 -11 -38 M0 -18 Q-6 -20 -9 -29 M2 -10 Q-4 -12 -6 -21" stroke="@corpsO" stroke-width="0.7" fill="none" opacity="0.55"/>` +
    `</g>`;
}
// Déployée (face/dos) — vers +x : grande aile qui s'élève ET s'étend (silhouette de rapace
// déployant). Bras + surface + rémiges/doigts. (Aile G = miroir scale(-1,1) au dispatch.)
function wingSpread(p: QuadProps): string {
  if (p.wings === 'membrane') { // dragon : grande membrane à doigts, montant haut
    return `<g>` +
      `<path d="M0 0 Q18 -22 38 -22 Q54 -21 62 -10 L54 -7 Q50 -12 42 -4 Q38 -13 30 -2 Q24 -12 16 0 Q8 -6 0 3 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
      `<path d="M0 0 Q28 -20 60 -11" fill="none" stroke="@corpsO" stroke-width="2.4" stroke-linecap="round"/>` +
      `<path d="M38 -21 Q41 -12 42 -4 M30 -19 Q30 -11 30 -2 M16 -12 Q16 -6 16 0" fill="none" stroke="@corpsO" stroke-width="1.5" stroke-linecap="round"/>` +
      `</g>`;
  }
  return `<g>` + // rapace : aile qui monte en arc + 4 rémiges digitées au bout
    `<path d="M0 1 Q16 -16 34 -17 Q52 -18 62 -8 Q50 -4 34 -4 Q16 -2 3 6 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
    `<path d="M54 -9 Q62 -9 64 -3 L58 -2 Q52 -5 48 -6 Z M44 -14 Q52 -14 55 -7 L49 -6 Q44 -10 40 -11 Z M32 -16 Q40 -17 43 -10 L37 -9 Q32 -13 28 -13 Z M20 -16 Q27 -16 30 -10 L24 -9 Q20 -13 16 -12 Z" fill="@corps" stroke="@corpsO" stroke-width="0.4"/>` +
    `<path d="M8 -4 Q24 -11 44 -10 M10 0 Q26 -5 42 -5" stroke="@corpsO" stroke-width="0.6" fill="none" opacity="0.5"/>` +
    `</g>`;
}

// Aile PLIÉE vue de bout (face/dos) : panneau replié qui ÉPOUSE LE FLANC vers le bas (épaule
// modeste + pan qui descend le long du corps) — l'ex-bosse dressée au garrot lisait comme de
// grandes « oreilles d'âne » près de la tête (verdict unanime des juges aveugles, lot 4).
function wingFoldedEnd(p: QuadProps): string {
  const c = p.wings === 'membrane' ? '@corpsO' : '@corps';
  return `<g data-wing="folded">` +
    `<path d="M0 -2 Q5 -7 8 -4 Q10 1 9.5 8 Q9 15 6 19 Q3.6 20.5 2.4 18 Q1 9 0 0 Z" fill="${c}" stroke="@corpsO" stroke-width="0.6"/>` +
    `<path d="M3.4 -1 Q5.6 6 5 16 M6.4 -2 Q8.2 5 7.6 13" fill="none" stroke="@corpsO" stroke-width="0.7" opacity="0.6"/>` +
    (p.wings === 'membrane' ? `<path d="M7.4 -4.6 l2 -2 l0.8 2.6" fill="${c}" stroke="@corpsO" stroke-width="0.5"/>` : '') +
    `</g>`;
}

// ============================ dispatch ============================
export function quadParts(p: QuadProps, view: View = 'profile', wings: 'folded' | 'spread' = 'folded'): Partial<Record<QuadBoneId, string>> {
  const frontFoot: QuadFoot = p.frontFoot ?? p.foot;
  // Envergure : × sur l'art d'aile (déployée ET pliée). Idem tête (headScale) et queue (tailLen).
  const span = (svg: string) => (p.wingSpan && p.wingSpan !== 1 ? `<g transform="scale(${p.wingSpan})">${svg}</g>` : svg);
  const headW = (svg: string) => (p.headScale && p.headScale !== 1 ? `<g transform="scale(${p.headScale})">${svg}</g>` : svg);
  const tailW = (svg: string) => (p.tailLen && p.tailLen !== 1 ? `<g transform="scale(${p.tailLen})">${svg}</g>` : svg);
  // Ailes face/dos : déployées vers ±x, ou bosses pliées au garrot (aileG = miroir scale -1).
  const endArt = wings === 'spread' ? wingSpread(p) : wingFoldedEnd(p);
  const spreadWings = p.wings
    ? { aileD: span(endArt), aileG: `<g transform="scale(-1,1)">${span(endArt)}</g>` }
    : {};
  if (view === 'front') {
    const n = legPartsFront(p, false, frontFoot), f = legPartsFront(p, true, p.foot);
    return {
      ...spreadWings,
      tronc: bodyFront(p), tete: headW(headgear(p, 'front') + headFront(p)),
      hautAvD: n.haut, basAvD: n.bas, piedAvD: n.pied, hautAvG: n.haut, basAvG: n.bas, piedAvG: n.pied,
      hautArD: f.haut, basArD: f.bas, piedArD: f.pied, hautArG: f.haut, basArG: f.bas, piedArG: f.pied,
    };
  }
  if (view === 'back') {
    const n = legPartsFront(p, false, p.foot), f = legPartsFront(p, true, frontFoot);
    return {
      ...spreadWings,
      tronc: bodyBack(p), tete: headW(headgear(p, 'back') + napeBack(p)), queue: tailW(tailBack(p)),
      hautArD: n.haut, basArD: n.bas, piedArD: n.pied, hautArG: n.haut, basArG: n.bas, piedArG: n.pied,
      hautAvD: f.haut, basAvD: f.bas, piedAvD: f.pied, hautAvG: f.haut, basAvG: f.bas, piedAvG: f.pied,
    };
  }
  // profil : pattes AVANT (frontFoot) près/loin, pattes ARRIÈRE (p.foot) près/loin.
  const nearAv = legParts(p, false, frontFoot), farAv = legParts(p, true, frontFoot);
  const nearAr = legParts(p, false, p.foot), farAr = legParts(p, true, p.foot);
  const profArt = (far: boolean) => span(wings === 'spread' ? wingProfile(p, far) : wingFoldedProfile(p, far));
  const profWings = p.wings ? { aileD: profArt(false), aileG: profArt(true) } : {};
  return {
    ...profWings,
    // Tête de PROFIL agrandie (1.3) : à l'échelle nue elle lisait « minuscule/sombre » au bout
    // de l'encolure. Ancrée à la jonction tête-cou (0,0) → grandit sans se détacher du cou.
    tronc: barrel(p), encolure: neck(p), tete: headW(`<g transform="scale(1.3)">${headgear(p, 'profile')}${headProfile(p)}</g>`), queue: tailW(tail(p)),
    hautAvD: nearAv.haut, basAvD: nearAv.bas, piedAvD: nearAv.pied,
    hautArD: nearAr.haut, basArD: nearAr.bas, piedArD: nearAr.pied,
    hautAvG: farAv.haut, basAvG: farAv.bas, piedAvG: farAv.pied,
    hautArG: farAr.haut, basArG: farAr.bas, piedArG: farAr.pied,
  };
}

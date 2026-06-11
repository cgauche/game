/**
 * Parts du gabarit QUADRUPÈDE — repère LOCAL de chaque os, tokenisées (@corps/@corpsO/@corpsH
 * = robe/pelage ; @cheveux = crinière/queue ; @cuir = sabot/coussinet). Trois vues dédiées
 * (profile = côté droit ; front = face, tête à 2 yeux ; back = croupe + queue). Cible de
 * silhouette : les sprites monolithiques officiels (Loup/Chien/Ours/Rat géant/Sanglier).
 */
import type { View } from '../facing';
import type { QuadBoneId, QuadProps, QuadFoot, QuadMane } from './quadSkeleton';
import { scalesPatch, plumeFan } from '../parts/textures';

/** Crinière effective (rétro-compat : les équins historiques dérivaient de tail==='crin'). */
const maneOf = (p: QuadProps): QuadMane => p.mane ?? (p.tail === 'crin' ? 'crin' : 'sans');

// ============================ helpers ============================
const cap = (len: number, th: number, fill: string, stroke: string): string => {
  const r = th / 2;
  return `<path d="M${-r} 0 Q${-r} ${-r * 0.6} 0 ${-r * 0.6} Q${r} ${-r * 0.6} ${r} 0 L${r * 0.82} ${len} Q0 ${len + r * 0.7} ${-r * 0.82} ${len} Z" fill="${fill}" stroke="${stroke}" stroke-width="0.6"/>`;
};
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
  if (foot === 'sabot') // sabot net : bloc trapézoïdal sombre + pince + couronne
    return `<path d="M-3.8 -2 L3.8 -2 L4.6 9 Q0 11.6 -4.6 9 Z" fill="${c}" stroke="#0e0b07" stroke-width="0.6"/><path d="M-4.3 8.4 Q0 10.8 4.3 8.4 L3.9 11 Q0 12.6 -3.9 11Z" fill="#0e0b07" opacity="0.55"/><path d="M0 0 L0 9" stroke="#0e0b07" stroke-width="0.5" opacity="0.5"/>`;
  if (foot === 'serre') // serre de rapace : tarse écailleux + 3 doigts griffus écartés + ergot arrière
    return `<g><path d="M-2.6 -2 L2.6 -2 L1.8 4 L-1.8 4 Z" fill="${c}" stroke="#0e0b07" stroke-width="0.5"/>` +
      `<path d="M-1.6 3 Q-6 6 -8 12 M0 4 Q0 9 0 13 M1.6 3 Q6 6 8 12 M-1.4 3 Q-4 5 -6 4" stroke="${c}" stroke-width="2.2" fill="none" stroke-linecap="round"/>` +
      `<path d="M-8 12 l-1.6 1.8 M0 13 l0 2 M8 12 l1.6 1.8 M-6 4 l-1.8 0.6" stroke="#0e0b07" stroke-width="1.2" stroke-linecap="round"/></g>`;
  // patte : coussinet large + 3 griffes marquées
  return `<g><path d="M-4.4 -2 Q-5.6 8 -2 10.5 L5.8 10.5 Q7.8 7 5.4 -2 Z" fill="${c}" stroke="#0e0b07" stroke-width="0.6"/>` +
    `<path d="M-1.6 10.5 l-0.7 3.6 M2 10.5 l0 3.8 M5.2 10.5 l1.3 3.2" stroke="#15110c" stroke-width="1.4" stroke-linecap="round"/></g>`;
}
function footFront(foot: QuadFoot, far: boolean): string {
  const c = far ? '@cuirO' : '@cuir';
  if (foot === 'sabot') return `<ellipse cx="0" cy="3" rx="3.4" ry="3" fill="${c}" stroke="#0e0b07" stroke-width="0.5"/>`;
  if (foot === 'serre') return `<path d="M0 0 Q-5 4 -6 9 M0 1 Q0 6 0 10 M0 0 Q5 4 6 9" stroke="${c}" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M-6 9 l-1.2 2 M0 10 l0 2.2 M6 9 l1.2 2" stroke="#0e0b07" stroke-width="1" stroke-linecap="round"/>`;
  return `<path d="M-3.4 0 Q-4 6 0 7 Q4 6 3.4 0 Z" fill="${c}" stroke="#0e0b07" stroke-width="0.5"/><path d="M-1.6 4 l0 3 M0 4 l0 3.4 M1.6 4 l0 3" stroke="#15110c" stroke-width="0.9" stroke-linecap="round"/>`;
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

function legParts(p: QuadProps, far: boolean, foot: QuadFoot) {
  const ll = p.legLen;
  const body = far ? '@corpsO' : '@corps';
  const L = LEG_BUILD[p.build] ?? LEG_BUILD.equine;
  return {
    haut: muscle(body, L.mass, 30 * ll) + taper(30 * ll, L.haut, L.bas + 1.4, body), // cuisse → genou
    // canon : plus FIN que la cuisse, s'effile vers le boulet ; jarret/genou bouché à la jointure.
    bas: joint(body, 0, (L.bas + 1.4) * 0.52) + taper(22 * ll, L.bas + 0.6, L.bas * 0.78, body) + joint(body, 22 * ll, L.bas * 0.4),
    pied: hoof(foot, far), // sabot À l'os du pied (bas de la jambe) — PAS 22·ll plus bas (sinon détaché)
  };
}
function legPartsFront(p: QuadProps, far: boolean, foot: QuadFoot) {
  const ll = p.legLen;
  const body = far ? '@corpsO' : '@corps';
  const L = LEG_BUILD[p.build] ?? LEG_BUILD.equine;
  const k = far ? 0.84 : 1;
  return {
    haut: muscle(body, L.mass * 0.5 * k, 26 * ll) + taper(30 * ll, L.haut * 0.9 * k, (L.bas + 1.2) * k, body),
    bas: joint(body, 0, (L.bas + 1.2) * k * 0.5) + taper(22 * ll, (L.bas + 0.5) * k, L.bas * 0.75 * k, body) + joint(body, 22 * ll, L.bas * 0.4),
    pied: footFront(foot, far), // pied à l'os (bas de la jambe), pas 22·ll plus bas
  };
}
// Œil CALME d'animal : iris sombre + petit reflet (pas le glow jaune g_eye, qui faisait
// « yeux démoniaques/globuleux » sur cheval/ours/rat).
const eyeF = (x: number, y = -3, r = 1.7) =>
  `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r + 0.3}" fill="#15100a"/><circle cx="${(x + 0.4).toFixed(1)}" cy="${(y - 0.4).toFixed(1)}" r="${(r * 0.34).toFixed(2)}" fill="#fff" opacity="0.7"/>`;

// ============================ PROFIL ============================
// Corps (tronc) SCULPTÉ par carrure (+x = avant/poitrail, -x = arrière). La profondeur
// est encore étirée par girth (scale vertical au rendu). Cinq silhouettes distinctes.
function barrel(p: QuadProps): string {
  const bl = p.bodyLen, W = 31 * bl, Wb = 28 * bl;
  let path: string, hi: string, lo: string;
  switch (p.build) {
    case 'suid': // bosse d'épaule HAUTE à l'avant, dos descendant vers un arrière fin + crête de soies
      path = `M${-Wb} 6 Q${-Wb - 1} -5 ${-12 * bl} -9 Q${2 * bl} -30 ${20 * bl} -25 Q${W} -21 ${W + 1} -3 Q${W} 15 ${16 * bl} 18 Q${-6 * bl} 20 ${-Wb} 12 Z`;
      hi = `<path d="M${-2 * bl} -28 Q${9 * bl} -32 ${20 * bl} -25" fill="none" stroke="@cheveux" stroke-width="2.4" opacity="0.85" stroke-linecap="round"/><path d="M${-1 * bl} -26 l-1 4 M${5 * bl} -28 l-1 4 M${11 * bl} -29 l0 4 M${16 * bl} -27 l1 4" stroke="@cheveux" stroke-width="1" opacity="0.7"/>`;
      lo = `<path d="M${-Wb} 9 Q0 18 ${22 * bl} 12 L${24 * bl} 7 Q0 14 ${-Wb} 5 Z" fill="@corpsO" opacity="0.8"/>`;
      break;
    case 'rodent': // dos ARQUÉ (bombé), bas et long, slim
      path = `M${-W} 2 Q${-W} -9 ${-16 * bl} -13 Q0 -25 ${16 * bl} -15 Q${W} -11 ${W} 1 Q${W - 2} 11 ${14 * bl} 13 Q${-10 * bl} 15 ${-W} 8 Z`;
      hi = `<path d="M${-20 * bl} -11 Q0 -24 ${18 * bl} -14 L${18 * bl} -10 Q0 -20 ${-20 * bl} -7 Z" fill="@corpsH" opacity="0.5"/>`;
      lo = `<path d="M${-W + 2} 8 Q0 14 ${18 * bl} 10 L${20 * bl} 5 Q0 11 ${-W + 2} 4 Z" fill="@corpsO" opacity="0.8"/>`;
      break;
    case 'ursine': // MASSIF, épaules hautes arrondies, très profond
      path = `M${-Wb - 2} 4 Q${-Wb - 2} -13 ${-10 * bl} -19 Q${6 * bl} -28 ${22 * bl} -22 Q${W + 2} -16 ${W + 2} 4 Q${W} 19 ${14 * bl} 21 Q${-10 * bl} 23 ${-Wb - 2} 13 Z`;
      hi = `<path d="M${-18 * bl} -17 Q${3 * bl} -27 ${22 * bl} -20 L${22 * bl} -15 Q${3 * bl} -22 ${-18 * bl} -12 Z" fill="@corpsH" opacity="0.55"/>`;
      lo = `<path d="M${-Wb} 11 Q0 21 ${22 * bl} 13 L${24 * bl} 7 Q0 17 ${-Wb} 5 Z" fill="@corpsO" opacity="0.85"/>`;
      break;
    case 'canine': // svelte, ventre RENTRÉ (remonte à l'arrière), poitrail à l'avant
      path = `M${-W} -1 Q${-W} -13 ${-12 * bl} -16 Q${6 * bl} -22 ${22 * bl} -18 Q${W} -14 ${W} -2 Q${W - 2} 7 ${16 * bl} 10 Q${0} 13 ${-12 * bl} 11 Q${-W + 3} 8 ${-W} -1 Z`;
      hi = `<path d="M${-18 * bl} -14 Q${2 * bl} -21 ${20 * bl} -16 L${20 * bl} -12 Q${2 * bl} -18 ${-18 * bl} -10 Z" fill="@corpsH" opacity="0.5"/>`;
      lo = `<path d="M${-W + 4} 5 Q${-2 * bl} 12 ${12 * bl} 10 Q${20 * bl} 8 ${22 * bl} 1 L${20 * bl} -1 Q${12 * bl} 7 ${-2 * bl} 7 Q${-W + 5} 5 ${-W + 4} 5 Z" fill="@corpsO" opacity="0.8"/>`;
      break;
    case 'feline': // lion (griffon) : poitrail profond avant + TAILLE creusée + haunches musclées arrière
      path = `M${-Wb} -3 Q${-Wb - 1} -18 ${-8 * bl} -20 Q${8 * bl} -23 ${24 * bl} -19 Q${W} -15 ${W} -3 Q${W - 1} 7 ${17 * bl} 11 Q${4 * bl} 7 ${-6 * bl} 9 Q${-18 * bl} 11 ${-Wb} 4 Z`;
      hi = `<path d="M${-18 * bl} -16 Q${3 * bl} -22 ${22 * bl} -17 L${22 * bl} -13 Q${3 * bl} -19 ${-18 * bl} -12 Z" fill="@corpsH" opacity="0.55"/>`;
      lo = `<path d="M${-Wb + 2} 3 Q${-6 * bl} 9 ${6 * bl} 8 Q${18 * bl} 6 ${22 * bl} 0 L${20 * bl} -2 Q${10 * bl} 5 ${-4 * bl} 5 Q${-Wb + 3} 2 ${-Wb + 2} 3 Z" fill="@corpsO" opacity="0.8"/>`;
      break;
    case 'draconic': { // dragon : corps LONG, profond, ventre lourd qui descend, dos écailleux
      const Wd = W + 3;
      path = `M${-Wd} 2 Q${-Wd} -14 ${-12 * bl} -18 Q${6 * bl} -23 ${24 * bl} -19 Q${Wd} -15 ${Wd} 0 Q${Wd - 1} 17 ${16 * bl} 22 Q${-8 * bl} 24 ${-Wd} 13 Z`;
      hi = `<path d="M${-22 * bl} -16 Q${2 * bl} -23 ${24 * bl} -18 L${24 * bl} -14 Q${2 * bl} -20 ${-22 * bl} -12 Z" fill="@corpsH" opacity="0.5"/>`;
      lo = `<path d="M${-Wd + 2} 10 Q0 23 ${22 * bl} 14 L${24 * bl} 7 Q0 18 ${-Wd + 2} 5 Z" fill="@corpsO" opacity="0.85"/>` +
        // crête dorsale épineuse (le long du dos)
        `<path d="M${-20 * bl} -14 l-1 -5 l3 4 M${-8 * bl} -19 l0 -6 l3 5 M${6 * bl} -21 l1 -6 l2 5 M${18 * bl} -18 l1 -5 l2 4" fill="@corpsO" stroke="@corpsO" stroke-width="0.5"/>` +
        // cuir d'écailles imbriquées (textures.ts) sur le flanc — le ventre lourd reste lisse
        scalesPatch(-Wd * 0.72, Wd * 0.72, -13, 8, 4.6, 'corps');
      break;
    }
    case 'batracien': { // crapaud : sac TRÈS large, bas et rond (pas de dos défini), dos verruqueux
      const Wt = W - 2;
      path = `M${-Wt} 0 Q${-Wt - 2} -16 ${-10 * bl} -20 Q${4 * bl} -24 ${18 * bl} -20 Q${Wt + 2} -16 ${Wt} 2 Q${Wt - 1} 17 ${12 * bl} 20 Q${-8 * bl} 22 ${-Wt} 12 Z`;
      hi = `<path d="M${-16 * bl} -16 Q${0 * bl} -22 ${18 * bl} -17 L${18 * bl} -12 Q${0 * bl} -18 ${-16 * bl} -11 Z" fill="@corpsH" opacity="0.5"/>`;
      lo = `<path d="M${-Wt} 9 Q0 20 ${18 * bl} 12 L${20 * bl} 5 Q0 16 ${-Wt} 4 Z" fill="@corpsO" opacity="0.85"/>` +
        // pustules dorsales (verrues) — casse l'aplat + tell du crapaud
        `<circle cx="${-12 * bl}" cy="-13" r="1.7" fill="@corpsO"/><circle cx="${-3 * bl}" cy="-17" r="2" fill="@corpsO"/><circle cx="${7 * bl}" cy="-16" r="1.6" fill="@corpsO"/><circle cx="${15 * bl}" cy="-12" r="1.5" fill="@corpsO"/><circle cx="${-8 * bl}" cy="-8" r="1.3" fill="@corpsO"/><circle cx="${2 * bl}" cy="-6" r="1.4" fill="@corpsO"/>`;
      break;
    }
    default: // equine : poitrail profond avant, dos LEVEL, croupe arrondie
      path = `M${-Wb} -2 Q${-Wb - 1} -17 ${-10 * bl} -20 Q${8 * bl} -23 ${24 * bl} -19 Q${W} -15 ${W} -2 Q${W - 1} 11 ${18 * bl} 15 Q${-6 * bl} 18 ${-Wb} 9 Z`;
      hi = `<path d="M${-20 * bl} -17 Q${2 * bl} -23 ${24 * bl} -17 L${24 * bl} -13 Q${2 * bl} -19 ${-20 * bl} -13 Z" fill="@corpsH" opacity="0.6"/>`;
      lo = `<path d="M${-Wb} 7 Q0 17 ${22 * bl} 11 L${24 * bl} 5 Q0 13 ${-Wb} 4 Z" fill="@corpsO" opacity="0.85"/>`;
  }
  // Ombre de flanc douce (volume : casse l'aplat « blob » signalé par la QC).
  const flank = `<ellipse cx="${(2 * bl).toFixed(1)}" cy="5" rx="${(13 * bl).toFixed(1)}" ry="5.5" fill="@corpsO" opacity="0.22"/>`;
  return `<g><path d="${path}" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>${lo}${flank}${hi}</g>`;
}
// Croupe (arrière-train) PROPORTIONNÉE à la carrure : grosse et ronde pour cheval/ours,
// PETITE et fuyante pour sanglier (avant-lourd) et rat, svelte pour canin. Le bord avant
// (+x, vers le tronc) reste ancré pour ne pas décrocher du corps ; seul l'arrière (-x) varie.
function rump(p: QuadProps): string {
  const RS: Record<string, number> = { equine: 1.0, canine: 0.82, suid: 0.66, rodent: 0.7, ursine: 1.16, feline: 1.04, draconic: 1.0, batracien: 0.9 };
  const rs = RS[p.build] ?? 1;
  const x = (n: number) => (n <= 0 ? n * rs : n).toFixed(1); // arrière (-x) mis à l'échelle, avant ancré
  const y = (n: number) => (n * (0.5 + 0.5 * rs)).toFixed(1); // hauteur amortie
  return `<g>
    <path d="M8 ${y(-22)} Q${x(-18)} ${y(-24)} ${x(-24)} ${y(-6)} Q${x(-26)} ${y(8)} ${x(-10)} ${y(16)} Q6 ${y(18)} 12 ${y(6)} Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>
    <path d="M${x(-22)} ${y(-2)} Q${x(-24)} ${y(8)} ${x(-10)} ${y(15)} Q4 ${y(17)} 10 ${y(8)} L6 ${y(4)} Q-6 ${y(12)} ${x(-20)} ${y(4)} Z" fill="@corpsO" opacity="0.8"/>
    <path d="M6 ${y(-20)} Q${x(-14)} ${y(-22)} ${x(-22)} ${y(-8)} L${x(-20)} ${y(-4)} Q-12 ${y(-18)} 6 ${y(-16)} Z" fill="@corpsH" opacity="0.6"/>
  </g>`;
}
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
  const base = `<path d="M-9 4 Q-11 ${-L * 0.5} -5 ${-L} L6 ${-L} Q10 ${-L * 0.55} 10 0 Q10 3 8 4 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>
    <path d="M8 2 Q9 ${-L * 0.5} 5 ${-L * 0.94}" fill="none" stroke="@corpsO" stroke-width="0.8" opacity="0.55"/>`;
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
function headProfile(p: QuadProps): string {
  if (p.head === 'hydre') return ''; // têtes dessinées dans l'os encolure (cluster)
  const eye = `<ellipse cx="6" cy="2" rx="1.6" ry="1.9" fill="#15100a"/><circle cx="6.4" cy="1.4" r="0.6" fill="#fff" opacity="0.7"/>`;
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
  if (p.head === 'loup')
    return `<g transform="rotate(14)"><path d="M-7 -5 Q-9 5 -2 9 Q4 13 13 13 Q18 12 18 9 Q15 7 9 7 Q2 5 0 -3 Q-1 -8 -7 -5 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/><path d="M9 7 Q15 7 18 9 Q16 11 12 10 Q9 9 9 7 Z" fill="@corpsO"/><ellipse cx="16.5" cy="9" rx="1.7" ry="1.3" fill="#120a06"/>${earProfile(p, -5, -1)}${earProfile(p, 0.5, 1)}<path d="M2 4 Q8 5 13 8" fill="none" stroke="@corpsO" stroke-width="0.6" opacity="0.6"/>${eye}</g>`;
  if (p.head === 'rat')
    return `<g transform="rotate(16)"><path d="M-6 -4 Q-8 5 -1 8 Q5 11 16 12 Q21 11 21 9 Q18 8 12 7 Q3 5 1 -3 Q0 -7 -6 -4 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/><ellipse cx="20" cy="10" rx="1.5" ry="1.2" fill="#d8a0a0"/><ellipse cx="14" cy="6" rx="1.4" ry="1.7" fill="#1a0808"/><path d="M14 13 q-2 4 -4 2" fill="none" stroke="#e8e0c8" stroke-width="0.9"/>${earProfile(p, -4, -1)}${earProfile(p, 1, 1)}</g>`;
  if (p.head === 'ours')
    return `<g transform="rotate(10)"><path d="M-8 -6 Q-10 7 0 11 Q9 14 15 12 Q19 10 17 6 Q12 5 8 4 Q0 2 -1 -5 Q-2 -9 -8 -6 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/><ellipse cx="15" cy="9" rx="2.6" ry="2.8" fill="@corpsO"/><ellipse cx="16" cy="9" rx="1.2" ry="1.4" fill="#120a06"/>${earProfile(p, -6, -1)}${earProfile(p, 1, 1)}${eye}</g>`;
  // sanglier
  return `<g transform="rotate(10)"><path d="M-7 -4 Q-9 6 0 10 Q9 13 15 11 Q19 9 17 5 Q12 4 8 3 Q1 2 0 -4 Q-1 -8 -7 -4 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/><ellipse cx="15" cy="8" rx="3" ry="3.4" fill="@corpsO"/><ellipse cx="15" cy="8" rx="1" ry="1.4" fill="#140a06"/><path d="M12 11 q-2 5 -5 3" fill="none" stroke="#e8e0c8" stroke-width="1.6" stroke-linecap="round"/>${earProfile(p, -5, -1)}${earProfile(p, 0.5, 1)}${eye}</g>`;
}
function tail(p: QuadProps): string {
  if (p.tail === 'sans') return ''; // batracien : pas de queue
  if (p.tail === 'reptile') // longue queue écailleuse effilée + épines dorsales
    return `<path d="M0 -2 Q16 4 28 2 Q40 0 48 8 Q40 5 30 7 Q16 11 0 6 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/><path d="M6 1 l1.5 -3 M14 1 l1.5 -3 M22 0.6 l1.5 -3 M30 1 l1.4 -2.6 M38 2 l1.2 -2.4" stroke="@corpsO" stroke-width="1" stroke-linecap="round"/>`;
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
  if (p.head === 'dragon') // face reptilienne large + cornes + 2 yeux fendus + museau à dents
    return `<g><path d="M-7 -10 q-3 -9 -10 -11 q4 6 6 13 z" fill="@corpsO" stroke="#1a140e" stroke-width="0.4"/><path d="M7 -10 q3 -9 10 -11 q-4 6 -6 13 z" fill="@corpsO" stroke="#1a140e" stroke-width="0.4"/>` +
      `<path d="M-9 -10 Q-11 5 -4 13 Q0 16 4 13 Q11 5 9 -10 Q0 -14 -9 -10 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
      `<ellipse cx="0" cy="12" rx="5" ry="3.4" fill="@corpsO"/><ellipse cx="-2" cy="11.4" rx="0.9" ry="0.6" fill="#1a0e08"/><ellipse cx="2" cy="11.4" rx="0.9" ry="0.6" fill="#1a0e08"/>` +
      `<path d="M-4 14.4 l0.6 2 M0 15 l0 2.2 M4 14.4 l-0.6 2" stroke="#e8e0c8" stroke-width="0.7"/>` +
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
  if (p.head === 'loup' )
    return `<g>${ears}<path d="M-9 -13 Q-11 0 -6 8 Q-2 13 0 14 Q2 13 6 8 Q11 0 9 -13 Q0 -16 -9 -13 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/><path d="M-5 -2 Q0 0 5 -2 L4 9 Q0 12 -4 9 Z" fill="@corpsH" opacity="0.45"/><ellipse cx="0" cy="12" rx="2.6" ry="2.1" fill="@corpsO"/><ellipse cx="0" cy="11.5" rx="1.5" ry="1.1" fill="#120a06"/>${eyeF(-5, -3)}${eyeF(5, -3)}</g>`;
  if (p.head === 'rat')
    return `<g>${ears}<path d="M-7 -11 Q-9 2 -3 11 Q0 16 3 11 Q9 2 7 -11 Q0 -14 -7 -11 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/><ellipse cx="0" cy="13" rx="1.8" ry="1.5" fill="#d8a0a0"/><path d="M-2 13 q-5 1 -7 -1 M2 13 q5 1 7 -1 M-2 14 q-5 2 -8 1 M2 14 q5 2 8 1" stroke="#cfc8b8" stroke-width="0.4" opacity="0.55"/>${eyeF(-4, -3, 1.4)}${eyeF(4, -3, 1.4)}</g>`;
  if (p.head === 'ours')
    return `<g>${ears}<path d="M-11 -10 Q-13 6 -4 13 Q0 16 4 13 Q13 6 11 -10 Q0 -14 -11 -10 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/><ellipse cx="0" cy="11" rx="4" ry="3.4" fill="@corpsO"/><ellipse cx="0" cy="11.5" rx="1.4" ry="1.6" fill="#120a06"/>${eyeF(-5, -3)}${eyeF(5, -3)}</g>`;
  // sanglier : groin large + défenses
  return `<g>${ears}<path d="M-10 -10 Q-12 5 -5 12 Q0 16 5 12 Q12 5 10 -10 Q0 -13 -10 -10 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/><ellipse cx="0" cy="12" rx="5.2" ry="3.6" fill="@corpsO"/><ellipse cx="-2" cy="12" rx="1" ry="1.4" fill="#140a06"/><ellipse cx="2" cy="12" rx="1" ry="1.4" fill="#140a06"/><path d="M-4 14 Q-6 19 -3 19" fill="none" stroke="#e8e0c8" stroke-width="1.5" stroke-linecap="round"/><path d="M4 14 Q6 19 3 19" fill="none" stroke="#e8e0c8" stroke-width="1.5" stroke-linecap="round"/>${eyeF(-6, -3, 1.4)}${eyeF(6, -3, 1.4)}</g>`;
}
function bodyFront(p: QuadProps): string {
  if (p.build === 'batracien') { // crapaud : corps LARGE et BAS (la carrure↑ ne l'étire pas en colonne)
    const W = 26;
    return `<g><path d="M${-W} -8 Q${-W} -14 ${-W * 0.5} -15 Q0 -16 ${W * 0.5} -15 Q${W} -14 ${W} -8 L${W - 3} 8 Q${W - 8} 14 0 15 Q${-(W - 8)} 14 ${-(W - 3)} 8 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
      `<path d="M-5 -14 Q0 -16 5 -14 L4 12 Q0 14 -4 12 Z" fill="@corpsH" opacity="0.4"/>` +
      `<circle cx="-11" cy="-3" r="1.6" fill="@corpsO"/><circle cx="10" cy="-1" r="1.8" fill="@corpsO"/><circle cx="-3" cy="5" r="1.4" fill="@corpsO"/><circle cx="7" cy="7" r="1.3" fill="@corpsO"/><circle cx="0" cy="-9" r="1.2" fill="@corpsO"/></g>`;
  }
  const w = p.head === 'ours' ? 20 : p.head === 'rat' ? 15 : 17;
  const crest = p.head === 'sanglier' ? `<path d="M-3 -27 Q0 -34 3 -27 M-6 -25 Q-3 -31 0 -26 M0 -26 Q3 -31 6 -25" stroke="@cheveux" stroke-width="1.3" fill="none" opacity="0.8"/>` : '';
  return `<g>
    <path d="M${-w} -18 Q${-w - 2} -26 ${-w * 0.55} -28 Q0 -30 ${w * 0.55} -28 Q${w + 2} -26 ${w} -18 L${w - 2} 12 Q${w - 5} 21 0 23 Q${-(w - 5)} 21 ${-(w - 2)} 12 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>
    <path d="M-4 -26 Q0 -29 4 -26 L3 20 Q0 22 -3 20 Z" fill="@corpsH" opacity="0.45"/>
    <path d="M${-w} -16 Q${-(w - 3)} 4 ${-(w - 4)} 16 L${-(w - 2)} 12 Q${-(w - 4)} -2 ${-(w - 1)} -15 Z" fill="@corpsO" opacity="0.7"/>
    ${crest}
  </g>`;
}

// ============================ DOS (back) ============================
function napeBack(p: QuadProps): string {
  if (p.head === 'hydre') // dos des 3 cous + arrière des têtes (ovales sombres)
    return `<g>` +
      hydraNeck(-4, 6, -8, -5, -11, -13) + hydraNeck(0, 6, 0, -7, 0, -15) + hydraNeck(4, 6, 8, -5, 11, -13) +
      `<ellipse cx="-11" cy="-13" rx="2.8" ry="3.2" fill="@corpsO"/><ellipse cx="0" cy="-15" rx="3" ry="3.4" fill="@corpsO"/><ellipse cx="11" cy="-13" rx="2.8" ry="3.2" fill="@corpsO"/></g>`;
  // Arrière du crâne, PETIT et bas : dos des oreilles (petits, discrets) + nuque réduite.
  // (Avant : on réutilisait les oreilles de face → grandes/pointues → dos « cornu debout ».)
  const earBack = p.ears === 'rondes'
    ? `<circle cx="-5.5" cy="-8" r="2.4" fill="@corpsO" stroke="@corpsO" stroke-width="0.4"/><circle cx="5.5" cy="-8" r="2.4" fill="@corpsO" stroke="@corpsO" stroke-width="0.4"/>`
    : `<path d="M-5 -7 Q-7.5 -12 -6.5 -6 Q-6 -6 -4.5 -6.5 Z" fill="@corpsO" stroke="@corpsO" stroke-width="0.4"/><path d="M5 -7 Q7.5 -12 6.5 -6 Q6 -6 4.5 -6.5 Z" fill="@corpsO" stroke="@corpsO" stroke-width="0.4"/>`;
  return `<g>${earBack}<path d="M-6 -8 Q-7 3 0 6 Q7 3 6 -8 Q0 -11 -6 -8 Z" fill="@corpsO" stroke="@corpsO" stroke-width="0.6"/><path d="M0 -9 L0 4" stroke="@corps" stroke-width="0.6" opacity="0.4"/></g>`;
}
function bodyBack(p: QuadProps): string {
  // Croupe vue de dos : masse LARGE et BASSE (plus large que haute) + sillon central → lit
  // comme un arrière-train de quadrupède, pas une silhouette verticale « debout ». Le haut
  // s'arrondit en dôme bas (dos qui s'éloigne) plutôt qu'une tête au sommet.
  const w = p.head === 'ours' ? 26 : p.head === 'rat' ? 19 : 23;
  return `<g>
    <path d="M${-w} -8 Q${-w} -19 ${-w * 0.5} -21 Q0 -22.5 ${w * 0.5} -21 Q${w} -19 ${w} -8 L${w - 2} 12 Q${w - 6} 22 0 24 Q${-(w - 6)} 22 ${-(w - 2)} 12 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>
    <path d="M0 -18 L0 21" stroke="@corpsO" stroke-width="1.4" opacity="0.7"/>
    <path d="M${-(w - 3)} -14 Q${-w * 0.4} -20 0 -20.5 L0 -16 Q${-w * 0.4} -16 ${-(w - 5)} -9 Z" fill="@corpsH" opacity="0.5"/>
    <path d="M${w - 3} -14 Q${w * 0.4} -20 0 -20.5 L0 -16 Q${w * 0.4} -16 ${w - 5} -9 Z" fill="@corpsH" opacity="0.4"/>
    <ellipse cx="0" cy="12" rx="${w * 0.7}" ry="6" fill="@corpsO" opacity="0.25"/>
  </g>`;
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
// Repère LOCAL = garrot. PROFIL : aile à demi repliée dressée vers le haut-arrière (-x/-y).
// FACE/DOS : aile DÉPLOYÉE vers +x (l'aile gauche est miroitée scale(-1,1) au dispatch).
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

// ============================ dispatch ============================
export function quadParts(p: QuadProps, view: View = 'profile'): Partial<Record<QuadBoneId, string>> {
  const frontFoot: QuadFoot = p.frontFoot ?? p.foot;
  // Ailes déployées (face/dos) : aileD à droite, aileG = même art miroité (scale -1).
  const spreadWings = p.wings
    ? { aileD: wingSpread(p), aileG: `<g transform="scale(-1,1)">${wingSpread(p)}</g>` }
    : {};
  if (view === 'front') {
    const n = legPartsFront(p, false, frontFoot), f = legPartsFront(p, true, p.foot);
    return {
      ...spreadWings,
      tronc: bodyFront(p), tete: headFront(p),
      hautAvD: n.haut, basAvD: n.bas, piedAvD: n.pied, hautAvG: n.haut, basAvG: n.bas, piedAvG: n.pied,
      hautArD: f.haut, basArD: f.bas, piedArD: f.pied, hautArG: f.haut, basArG: f.bas, piedArG: f.pied,
    };
  }
  if (view === 'back') {
    const n = legPartsFront(p, false, p.foot), f = legPartsFront(p, true, frontFoot);
    return {
      ...spreadWings,
      tronc: bodyBack(p), tete: napeBack(p), queue: tailBack(p),
      hautArD: n.haut, basArD: n.bas, piedArD: n.pied, hautArG: n.haut, basArG: n.bas, piedArG: n.pied,
      hautAvD: f.haut, basAvD: f.bas, piedAvD: f.pied, hautAvG: f.haut, basAvG: f.bas, piedAvG: f.pied,
    };
  }
  // profil : pattes AVANT (frontFoot) près/loin, pattes ARRIÈRE (p.foot) près/loin.
  const nearAv = legParts(p, false, frontFoot), farAv = legParts(p, true, frontFoot);
  const nearAr = legParts(p, false, p.foot), farAr = legParts(p, true, p.foot);
  const profWings = p.wings ? { aileD: wingProfile(p, false), aileG: wingProfile(p, true) } : {};
  return {
    ...profWings,
    tronc: barrel(p), croupe: rump(p), encolure: neck(p), tete: headProfile(p), queue: tail(p),
    hautAvD: nearAv.haut, basAvD: nearAv.bas, piedAvD: nearAv.pied,
    hautArD: nearAr.haut, basArD: nearAr.bas, piedArD: nearAr.pied,
    hautAvG: farAv.haut, basAvG: farAv.bas, piedAvG: farAv.pied,
    hautArG: farAr.haut, basArG: farAr.bas, piedArG: farAr.pied,
  };
}

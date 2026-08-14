/**
 * CONVERSION MONDE : les `Face` du pivot (`builders/types.ts`, GP = tuiles continues + hauteur en
 * MÈTRES) deviennent des triangles en repère three (Y = haut) : `(x, y, h) → (x·mpt, h, y·mpt)`.
 * Module PUR : ni DOM, ni renderer, ni `three`, ni catalogue (des points nus suffisent au maillage).
 *
 * Quatre politiques y vivent, chacune une fonction :
 *  - TRIANGULATION en ÉVENTAIL (les faces du pivot sont planes, convexes, ≤ 4 points) ;
 *  - VOLUME d'une face VERTICALE : une face du pivot est un plan d'épaisseur NULLE (l'affine peint des
 *    quads d'écran) — sans surface à 90° de plongée, sans chant à éclairer. Toute face verticale à qui
 *    l'appelant résout une profondeur (`FaceDepth`, catalogues d'apparence : `faceRelief.ts`) devient
 *    une BOÎTE MINCE centrée sur son plan (`wallBoxPolys`) ;
 *  - MONTANTS à 2 points (`walls.ts:119`, `floors.ts:163`) : deux quads verticaux CROISÉS, dont la
 *    largeur arrive PAR LE MÊME CANAL que les épaisseurs (`FaceDepth` → `uprightCrossM`, authorée en
 *    mètres au catalogue) ; ces quads entrent dans le calcul coplanaire au même titre que les faces
 *    pleines (un bras de la croix est DANS le plan du panneau qu'il décore) ;
 *  - BIAIS COPLANAIRE : l'affine départage les faces empilées d'un même plan par l'ORDRE d'émission ;
 *    au GPU il faut une séparation métrique — rang d'émission × `COPLANAR_BIAS_M` le long de la normale.
 */
import { TW } from '../../../geometry/iso';
import type { Face, GP } from '../../builders/types';

/** Point MÉTRIQUE en repère three : X = est, Y = haut, Z = sud. */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Polygone monde d'une face (≥ 2 points : un montant n'en a que 2). */
export type WorldPoly = Vec3[];
export type Tri = [Vec3, Vec3, Vec3];

/** Pixels ÉCRAN par mètre de la projection affine : une tuile (TW px de large en losange) mesure
 *  `mpt` mètres, sa demi-diagonale projetée vaut `TW·√½` px (`geometry/iso.ts:14`). */
export function pxPerM(mpt: number): number {
  return (TW * Math.SQRT1_2) / mpt;
}

/** Épaisseur (m) d'un volume dont l'appelant n'a rien résolu : AUCUNE. Ce module ne connaît pas les
 *  matériaux — les épaisseurs sont authorées en mètres au catalogue et arrivent par `FaceDepth`
 *  (`faceRelief.ts`). Un appelant sans résolveur obtient donc des PLANS, jamais une épaisseur devinée. */
const SANS_VOLUME = 0;

/** Séparation métrique d'un cran de rang coplanaire. */
export const COPLANAR_BIAS_M = 0.0015;

/** GP (tuiles + mètres) → point métrique three. */
export function gpToWorld(p: GP, mpt: number): Vec3 {
  return { x: p.x * mpt, y: p.h, z: p.y * mpt };
}

/** Polygone monde d'une face. */
export function facePoly(face: Face, mpt: number): WorldPoly {
  return face.poly.map((p) => gpToWorld(p, mpt));
}

/** Normale unitaire d'un polygone (Newell) ; null si < 3 points ou aire nulle. */
export function polyNormal(poly: WorldPoly): Vec3 | null {
  if (poly.length < 3) return null;
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    nx += (a.y - b.y) * (a.z + b.z);
    ny += (a.z - b.z) * (a.x + b.x);
    nz += (a.x - b.x) * (a.y + b.y);
  }
  const len = Math.hypot(nx, ny, nz);
  if (len < 1e-12) return null;
  return { x: nx / len, y: ny / len, z: nz / len };
}

/** Écart maximal (m) des sommets au plan moyen — 0 pour un polygone plan. INSTRUMENT DE GARDE, au même
 *  titre que `coplanarOverlapPairs` : avec `isConvex`, il mesure la PRÉCONDITION de `fanTriangles` sur
 *  les scènes-témoins (`worldTris.test.ts` : 0 face non-plane, 0 non-convexe). Aucun chemin de rendu ne
 *  l'appelle — c'est ce que mesure la garde, pas ce qu'elle décore. */
export function planarity(poly: WorldPoly): number {
  const n = polyNormal(poly);
  if (!n) return 0;
  const d = n.x * poly[0].x + n.y * poly[0].y + n.z * poly[0].z;
  let worst = 0;
  for (const p of poly) worst = Math.max(worst, Math.abs(n.x * p.x + n.y * p.y + n.z * p.z - d));
  return worst;
}

/** Convexe : tous les produits vectoriels d'arêtes consécutives pointent du même côté de la normale.
 *  INSTRUMENT DE GARDE, au même titre que `planarity` : avec lui, il mesure la PRÉCONDITION de
 *  `fanTriangles` sur les scènes-témoins (`worldTris.test.ts:79-99` : 0 face non-plane, 0 non-convexe).
 *  Aucun chemin de rendu ne l'appelle. */
export function isConvex(poly: WorldPoly): boolean {
  const n = polyNormal(poly);
  if (!n) return true;
  let sign = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const c = poly[(i + 2) % poly.length];
    const u = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
    const v = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z };
    const cr = { x: u.y * v.z - u.z * v.y, y: u.z * v.x - u.x * v.z, z: u.x * v.y - u.y * v.x };
    const s = cr.x * n.x + cr.y * n.y + cr.z * n.z;
    if (Math.abs(s) < 1e-9) continue;
    if (sign === 0) sign = Math.sign(s);
    else if (Math.sign(s) !== sign) return false;
  }
  return true;
}

/** Triangulation en ÉVENTAIL depuis le premier sommet. */
export function fanTriangles(poly: WorldPoly): Tri[] {
  const out: Tri[] = [];
  for (let i = 1; i + 1 < poly.length; i++) out.push([poly[0], poly[i], poly[i + 1]]);
  return out;
}

/** Les DEUX quads verticaux CROISÉS (X) centrés sur le segment [a,b], de largeur `wM` — la
 *  représentation volumique d'un montant que l'affine dessine en rectangle d'écran. */
export function crossQuadPolys(a: Vec3, b: Vec3, wM: number): WorldPoly[] {
  const h = wM / 2;
  const arms: Vec3[] = [{ x: h, y: 0, z: 0 }, { x: 0, y: 0, z: h }];
  return arms.map((e) => [
    { x: a.x - e.x, y: a.y - e.y, z: a.z - e.z },
    { x: a.x + e.x, y: a.y + e.y, z: a.z + e.z },
    { x: b.x + e.x, y: b.y + e.y, z: b.z + e.z },
    { x: b.x - e.x, y: b.y - e.y, z: b.z - e.z },
  ]);
}

/** PROFONDEUR MONDE (m) du volume d'une face, résolue par l'appelant depuis les catalogues d'apparence
 *  (`faceRelief.ts`) — ce module ne connaît aucun matériau. Pour un MONTANT (face à 2 points), c'est la
 *  LARGEUR de sa croix. `undefined` = rien de résolu : la face reste un PLAN (et un montant, un trait
 *  sans épaisseur). Une profondeur NULLE laisse elle aussi un plan unique, au plan médian. */
export type FaceDepth = (face: Face) => number | undefined;

/** Polygone DÉPLACÉ de `d` le long de `n`. */
function offsetPoly(poly: WorldPoly, n: Vec3, d: number): WorldPoly {
  return poly.map((p) => ({ x: p.x + n.x * d, y: p.y + n.y * d, z: p.z + n.z * d }));
}

/** Polygone parcouru à l'envers : sa normale (donc le sens du biais coplanaire) s'inverse. */
function reversePoly(poly: WorldPoly): WorldPoly {
  return [...poly].reverse();
}

/** BOÎTE MINCE (`tM`) centrée sur le plan vertical `poly` de normale `n` : les deux joues parallèles,
 *  la coiffe supérieure et les chants d'extrémité — une arête HORIZONTALE au point bas du polygone est
 *  omise (le dessous d'un mur ne se voit jamais). Chaque quad est réorienté vers le DEHORS de la boîte
 *  pour que le biais coplanaire pousse ses piles hors de la matière. */
export function wallBoxPolys(poly: WorldPoly, n: Vec3, tM: number): WorldPoly[] {
  const h = tM / 2;
  const front = offsetPoly(poly, n, h);
  const back = offsetPoly(poly, n, -h);
  const out: WorldPoly[] = [front, back];
  const yLo = Math.min(...poly.map((p) => p.y));
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    if (Math.abs(a.y - yLo) < 1e-9 && Math.abs(b.y - yLo) < 1e-9) continue;
    out.push([
      { x: a.x + n.x * h, y: a.y, z: a.z + n.z * h },
      { x: b.x + n.x * h, y: b.y, z: b.z + n.z * h },
      { x: b.x - n.x * h, y: b.y, z: b.z - n.z * h },
      { x: a.x - n.x * h, y: a.y, z: a.z - n.z * h },
    ]);
  }
  const c = polyBounds(out.flat());
  const mid = { x: (c.lo.x + c.hi.x) / 2, y: (c.lo.y + c.hi.y) / 2, z: (c.lo.z + c.hi.z) / 2 };
  return out.map((q) => {
    const qn = polyNormal(q);
    if (!qn) return q;
    const g = q.reduce((s, p) => ({ x: s.x + p.x / q.length, y: s.y + p.y / q.length, z: s.z + p.z / q.length }), { x: 0, y: 0, z: 0 });
    const dehors = qn.x * (g.x - mid.x) + qn.y * (g.y - mid.y) + qn.z * (g.z - mid.z);
    return dehors >= 0 ? q : reversePoly(q);
  });
}

/** Clé de PLAN arrondie au mm : normale CANONIQUE (première composante non nulle positive) + offset. */
function planeKey(poly: WorldPoly): string | null {
  const n = polyNormal(poly);
  if (!n) return null;
  const comps = [n.x, n.y, n.z];
  const lead = comps.find((c) => Math.abs(c) > 1e-9) ?? 1;
  const s = lead < 0 ? -1 : 1;
  const c = { x: n.x * s, y: n.y * s, z: n.z * s };
  const d = c.x * poly[0].x + c.y * poly[0].y + c.z * poly[0].z;
  const r = (v: number) => Math.round(v * 1000);
  return `${r(c.x)},${r(c.y)},${r(c.z)}|${r(d)}`;
}

/** Rang d'émission de chaque polygone parmi les faces de SON plan qui le RECOUVRENT (0 = rien dessous).
 *  Deux sols voisins partagent leur plan sans se recouvrir : tous deux au rang 0, aucun déplacement —
 *  seules les piles réelles (panneau/moulure/plinthe d'un mur, wedge sur son losange, jonction de deux
 *  éléments) se séparent. Un polygone sans plan (moins de 3 points, aire nulle) reçoit 0. La portée =
 *  la liste fournie, à passer à l'échelle de la SCÈNE (une pile peut enjamber deux éléments). */
export function coplanarRanks(polys: readonly WorldPoly[]): number[] {
  const groups = new Map<string, { box: Bounds; rank: number }[]>();
  return polys.map((poly) => {
    const key = planeKey(poly);
    if (!key) return 0;
    const box = polyBounds(poly);
    const g = groups.get(key) ?? [];
    let rank = 0;
    for (const prev of g) if (boxesOverlap(prev.box, box)) rank = Math.max(rank, prev.rank + 1);
    g.push({ box, rank });
    groups.set(key, g);
    return rank;
  });
}

/** Polygone DÉPLACÉ de `rank × COPLANAR_BIAS_M` le long de SA normale (l'ordre de peinture affine
 *  devient une séparation métrique). Un montant est rendu tel quel. */
export function biasPoly(poly: WorldPoly, rank: number): WorldPoly {
  const n = polyNormal(poly);
  if (!n || rank === 0) return poly;
  const d = rank * COPLANAR_BIAS_M;
  return poly.map((p) => ({ x: p.x + n.x * d, y: p.y + n.y * d, z: p.z + n.z * d }));
}

/** Boîte englobante monde d'un polygone. */
export interface Bounds {
  lo: Vec3;
  hi: Vec3;
}
export function polyBounds(poly: WorldPoly): Bounds {
  const lo = { x: Infinity, y: Infinity, z: Infinity };
  const hi = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const p of poly) {
    lo.x = Math.min(lo.x, p.x); lo.y = Math.min(lo.y, p.y); lo.z = Math.min(lo.z, p.z);
    hi.x = Math.max(hi.x, p.x); hi.y = Math.max(hi.y, p.y); hi.z = Math.max(hi.z, p.z);
  }
  return { lo, hi };
}

/** Deux boîtes se RECOUVRENT si elles s'intersectent sur ≥ 2 axes (dans un plan, le 3ᵉ est dégénéré). */
export function boxesOverlap(a: Bounds, b: Bounds): boolean {
  let axes = 0;
  for (const k of ['x', 'y', 'z'] as const)
    if (Math.min(a.hi[k], b.hi[k]) - Math.max(a.lo[k], b.lo[k]) > 1e-6) axes++;
  return axes >= 2;
}

/** Paires de polygones COPLANAIRES (même plan au mm) dont les boîtes se recouvrent sur ≥ 2 axes :
 *  la mesure du z-fighting. Instrument de la garde autant que du diagnostic. */
export function coplanarOverlapPairs(polys: readonly WorldPoly[]): [number, number][] {
  const groups = new Map<string, number[]>();
  polys.forEach((poly, i) => {
    const key = planeKey(poly);
    if (!key) return;
    const g = groups.get(key);
    if (g) g.push(i);
    else groups.set(key, [i]);
  });
  const pairs: [number, number][] = [];
  for (const idx of groups.values()) {
    const boxes = idx.map((i) => polyBounds(polys[i]));
    for (let a = 0; a < idx.length; a++)
      for (let b = a + 1; b < idx.length; b++)
        if (boxesOverlap(boxes[a], boxes[b])) pairs.push([idx[a], idx[b]]);
  }
  return pairs;
}

/** Géométrie GPU d'une face : ses triangles et leurs DEUX jeux d'UV, sa normale, son rang coplanaire. */
export interface FaceGeom {
  /** UV PLANAIRES MONDE (mètres) des 3 sommets de chaque triangle, dans le plan de SON quad — de quoi
   *  répéter une texture à l'échelle métrique, continue d'un quad à l'autre du même plan. */
  uv: [UV, UV, UV][];
  /** UV NORMALISÉES [0,1]² de la FACE d'origine des 3 sommets de chaque triangle — de quoi cuire un
   *  ornement calé sur la face (colombage, accents), quel que soit le volume qu'elle a engendré. */
  uv1: [UV, UV, UV][];
  tris: Tri[];
  normal: Vec3 | null;
  rank: number;
  /** Le sens de parcours des triangles porte déjà le DEHORS (cf. `faceQuadsOriented`). */
  oriented: boolean;
}

/** Quads d'une face soumis au biais coplanaire : le polygone lui-même, ou les DEUX quads croisés d'un
 *  montant (2 points), ou la BOÎTE MINCE de toute face VERTICALE à qui l'appelant a résolu une
 *  profondeur. Un bras de la croix d'un montant est EXACTEMENT dans le plan du
 *  panneau qu'il décore : il entre donc dans le rang coplanaire comme une face pleine (mesuré sur
 *  `arene` : 388 paires montant↔montant + 2 607 paires montant↔face pleine, invisibles tant que les
 *  montants étaient exclus). */
export function faceQuads(face: Face, mpt: number, depthM?: number): WorldPoly[] {
  return faceQuadsOriented(face, mpt, depthM).quads;
}

/** Quads d'une face + le drapeau `oriented` : `true` quand le sens de parcours des quads PORTE déjà une
 *  information (chaque quad regarde le DEHORS de la boîte qui vient d'être fabriquée), `false` quand la
 *  face est rendue telle que le pivot l'a authorée (aucune convention de sens) et qu'il revient au
 *  consommateur de l'orienter.
 *
 *  UNE forme, deux familles de matière (`catalog/structures` `wallPartRelief`) : une partie POSÉE devant
 *  la matière pleine (panneau, moulure, plinthe…) comme une partie qui BOUCHE une ouverture (vantail,
 *  herse, gravats — le pivot n'émet AUCUNE face derrière elles) deviennent la MÊME boîte centrée sur le
 *  plan médian du mur. Centrée, parce qu'une `Face` de mur ne porte AUCUNE notion de joue intérieure ou
 *  extérieure (`builders/walls.ts` ne renseigne jamais `face.side`) : il n'y a pas de côté à choisir, un
 *  seul volume est visible des deux bords. Profondeur NULLE ⇒ plan unique au médian et `oriented: false`
 *  — un sens de parcours y serait arbitraire, et la carte d'ombre le suivrait. */
export function faceQuadsOriented(face: Face, mpt: number, depthM?: number): { quads: WorldPoly[]; oriented: boolean } {
  const poly = facePoly(face, mpt);
  if (poly.length === 2)
    return { quads: crossQuadPolys(poly[0], poly[1], depthM ?? SANS_VOLUME), oriented: false };
  const n = polyNormal(poly);
  if (!n || Math.abs(n.y) > 1e-6) return { quads: [poly], oriented: false }; // seul un plan VERTICAL a une épaisseur d'arête
  const t = depthM ?? SANS_VOLUME;
  if (t <= 0) return { quads: [poly], oriented: false };
  return { quads: wallBoxPolys(poly, n, t), oriented: true };
}

// ————————————————————————————————————————————————————————————————
// UV — deux jeux : la MAILLE du monde (mètres) et la FACE d'origine ([0,1]²)
// ————————————————————————————————————————————————————————————————

/** Coordonnée de texture d'un sommet. */
export interface UV {
  u: number;
  v: number;
}

/** Repère orthonormé d'un plan. */
export interface PlanarFrame {
  eu: Vec3;
  ev: Vec3;
}

const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});

/** Repère PLANAIRE d'un plan de normale `n`, ancré à l'ORIGINE DU MONDE (jamais au quad) : deux quads
 *  coplanaires — deux dalles de sol voisines, deux tronçons d'un même mur, une face et sa copie de joue —
 *  reçoivent des UV qui se raccordent, sans couture au joint ni motif qui redémarre.
 *  Plan HORIZONTAL (ou normale indéterminée) : u = est, v = sud. Sinon : u = l'horizontale du plan
 *  (`up × n`), v descend (composante y ≤ 0), comme la convention de face des recettes de détail. */
export function planarFrame(n: Vec3 | null): PlanarFrame {
  if (!n || Math.abs(n.y) > 1 - 1e-9) return { eu: { x: 1, y: 0, z: 0 }, ev: { x: 0, y: 0, z: 1 } };
  const len = Math.hypot(n.z, n.x);
  const eu = { x: n.z / len, y: 0, z: -n.x / len };
  const ev = cross(n, eu);
  return { eu, ev: ev.y > 0 ? { x: -ev.x, y: -ev.y, z: -ev.z } : ev };
}

/** UV PLANAIRES MONDE d'un point, en MÈTRES : sa projection sur les deux axes du repère du plan.
 *  L'application est une ISOMÉTRIE du plan — deux sommets distants d'un mètre le sont dans l'UV. Un
 *  déplacement le long de la normale (biais coplanaire, joue de mur) ne la change pas. */
export function planarUV(p: Vec3, f: PlanarFrame): UV {
  return { u: dot(p, f.eu), v: dot(p, f.ev) };
}

/** Cadre d'une FACE dans son propre plan : le repère planaire + l'emprise de la face, de quoi
 *  normaliser un point en [0,1]². Une emprise dégénérée (face à 2 points : montant) vaut 1 — la
 *  division reste finie et l'UV se rabat sur le bord. */
export interface FaceUvFrame extends PlanarFrame {
  u0: number;
  v0: number;
  du: number;
  dv: number;
}

export function faceUvFrame(poly: WorldPoly): FaceUvFrame {
  const f = planarFrame(polyNormal(poly));
  let u0 = Infinity, v0 = Infinity, u1 = -Infinity, v1 = -Infinity;
  for (const p of poly) {
    const uv = planarUV(p, f);
    u0 = Math.min(u0, uv.u); u1 = Math.max(u1, uv.u);
    v0 = Math.min(v0, uv.v); v1 = Math.max(v1, uv.v);
  }
  if (!poly.length) return { ...f, u0: 0, v0: 0, du: 1, dv: 1 };
  return { ...f, u0, v0, du: u1 - u0 > 1e-9 ? u1 - u0 : 1, dv: v1 - v0 > 1e-9 ? v1 - v0 : 1 };
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** UV NORMALISÉES [0,1]² d'un point dans le cadre de la face — u le long de la face, v du HAUT (0) vers
 *  le BAS (1), la convention des `DetailRecipe`. Un point hors de l'emprise (bras d'une croix de
 *  montant, chant d'une boîte de mur qui déborde du plan de face) se rabat sur le bord. */
export function faceUv1(p: Vec3, f: FaceUvFrame): UV {
  const uv = planarUV(p, f);
  return { u: clamp01((uv.u - f.u0) / f.du), v: clamp01((uv.v - f.v0) / f.dv) };
}

/** Faces → triangles monde, biais coplanaire appliqué, montants développés en croix et faces verticales
 *  développées en boîtes minces à la profondeur que `depthOf` leur résout. Le RANG se calcule
 *  sur la liste FOURNIE (cf. `coplanarRanks` : la porter à l'échelle de la scène), quads de montants
 *  compris. Le `rank` rendu pour un montant est le PLUS HAUT de ses deux quads. */
export function facesGeometry(faces: readonly Face[], mpt: number, depthOf?: FaceDepth): FaceGeom[] {
  const parts = faces.map((f) => faceQuadsOriented(f, mpt, depthOf?.(f)));
  const ranks = coplanarRanks(parts.flatMap((p) => p.quads));
  const out: FaceGeom[] = [];
  let k = 0;
  faces.forEach((face, i) => {
    const { quads: qs, oriented } = parts[i];
    const faceFrame = faceUvFrame(facePoly(face, mpt));
    const tris: Tri[] = [];
    const uv: [UV, UV, UV][] = [];
    const uv1: [UV, UV, UV][] = [];
    let rank = 0;
    let normal: Vec3 | null = null;
    for (const q of qs) {
      const r = ranks[k++];
      rank = Math.max(rank, r);
      const biased = biasPoly(q, r);
      if (qs.length === 1) normal = polyNormal(biased); // une croix de montant n'a pas UNE normale
      const quadFrame = planarFrame(polyNormal(biased)); // chaque quad porte SA maille de monde
      for (const tri of fanTriangles(biased)) {
        tris.push(tri);
        uv.push(tri.map((p) => planarUV(p, quadFrame)) as [UV, UV, UV]);
        uv1.push(tri.map((p) => faceUv1(p, faceFrame)) as [UV, UV, UV]);
      }
    }
    out.push({ tris, uv, uv1, normal, rank, oriented });
  });
  return out;
}

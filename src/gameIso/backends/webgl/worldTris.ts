/**
 * SPIKE WebGL — CONVERSION MONDE : les `Face` du pivot (`builders/types.ts`, GP = tuiles continues +
 * hauteur en MÈTRES) deviennent des triangles en repère three (Y = haut) : `(x, y, h) → (x·mpt, h, y·mpt)`.
 * Module PUR et Node-safe : ni DOM, ni renderer, ni `three` (des points nus suffisent au maillage).
 *
 * Quatre politiques y vivent, chacune une fonction :
 *  - TRIANGULATION en ÉVENTAIL (les faces du pivot sont planes, convexes, ≤ 4 points) ;
 *  - ÉPAISSEUR de MUR : une face de structure verticale est un plan d'épaisseur NULLE (l'affine peint
 *    des quads d'écran) — sans surface à 90° de plongée. Les parts PLEINES deviennent une boîte mince
 *    (`wallBoxPolys`), les parts décoratives une copie par joue ;
 *  - MONTANTS à 2 points (`walls.ts:119`, `floors.ts:163`) : deux quads verticaux CROISÉS, largeur MONDE
 *    dérivée de la largeur écran du backend affine, portée au-delà des joues du mur par la SAILLIE
 *    (`montantWidthM`) ; ces quads entrent dans le calcul coplanaire au même
 *    titre que les faces pleines (un bras de la croix est DANS le plan du panneau qu'il décore) ;
 *  - BIAIS COPLANAIRE : l'affine départage les faces empilées d'un même plan par l'ORDRE d'émission ;
 *    au GPU il faut une séparation métrique — rang d'émission × `COPLANAR_BIAS_M` le long de la normale.
 */
import { LEVEL_H, TW } from '../../../geometry/iso';
import { METRES_PER_LEVEL } from '../../../state/relief';
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

/** Pixels ÉCRAN par mètre de HAUTEUR de la projection affine : `LEVEL_H` px d'étage ⇔ `METRES_PER_LEVEL`
 *  mètres (`gameIso/iso.ts`). SOURCE UNIQUE de cette cadence — `cameras.ts` (échelle verticale de la
 *  matrice de projection) et `billboardMath.ts` (taille monde héroïque) la consomment tous deux. */
export const ISO_PX_PER_M = LEVEL_H / METRES_PER_LEVEL;

/** Largeurs ÉCRAN (px) des montants chez le backend affine — `affineWalls.ts:25` (poteau),
 *  `affineWalls.ts:26` (jambage), `affineFloors.ts:33` (pilier de surplomb). Ces constantes ne sont pas
 *  exportées par l'affine : copie LOCALE au spike. */
const UPRIGHT_PX: Record<string, number> = { poteau: 3.8, jambage: 3.6, pillar: 5 };

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

/** Écart maximal (m) des sommets au plan moyen — 0 pour un polygone plan. */
export function planarity(poly: WorldPoly): number {
  const n = polyNormal(poly);
  if (!n) return 0;
  const d = n.x * poly[0].x + n.y * poly[0].y + n.z * poly[0].z;
  let worst = 0;
  for (const p of poly) worst = Math.max(worst, Math.abs(n.x * p.x + n.y * p.y + n.z * p.z - d));
  return worst;
}

/** Convexe : tous les produits vectoriels d'arêtes consécutives pointent du même côté de la normale. */
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

/** Largeur MONDE (m) d'un montant : sa largeur écran affine ramenée à l'échelle métrique de la scène. */
export function uprightWidthM(part: string | undefined, mpt: number): number {
  const px = (part ? UPRIGHT_PX[part] : undefined) ?? UPRIGHT_PX.poteau;
  return px / pxPerM(mpt);
}

/** Saillie (m) d'un montant hors des joues du mur qu'il encadre — 1 px d'écran affine ramené au monde
 *  (`pxPerM`), soit ≈ 0,044 m à 2 m/tuile : le plus petit dépassement que la planche distingue.
 *  Sans elle, la croix d'un montant a EXACTEMENT l'épaisseur de la boîte de mur (`wallThicknessM` est la
 *  largeur du même poteau) et s'y inscrit à ras — mesuré sur `arene` : 340 montants sur 364 entièrement
 *  dans la matière, part noyée moyenne 99,2 %. */
export const MONTANT_SAILLIE_PX = 1;

/** Saillie MONDE d'un montant (m). */
export function montantSaillieM(mpt: number): number {
  return MONTANT_SAILLIE_PX / pxPerM(mpt);
}

/** Largeur MONDE de la croix d'un montant : sa largeur d'écran affine, jamais moins que l'épaisseur du
 *  mur qu'il encadre, plus une saillie de chaque côté. */
export function montantWidthM(part: string | undefined, mpt: number): number {
  return Math.max(uprightWidthM(part, mpt), wallThicknessM(mpt)) + 2 * montantSaillieM(mpt);
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

/** Triangles des deux quads croisés d'un montant. */
export function crossQuadTris(a: Vec3, b: Vec3, wM: number): Tri[] {
  return crossQuadPolys(a, b, wM).flatMap(fanTriangles);
}

/** Parts de mur PLEINES (`builders/walls.ts`) : le corps de la courtine (`face`) et les COURONNEMENTS
 *  (bande haute de bois, parapet dressé, arase, merlons). Toute autre part d'un mur (panneau, moulure,
 *  plinthe, bande, vitre, vantail, herse…) est un DÉCOR posé sur la joue, pas de la matière. */
const SOLID_WALL_PARTS = new Set(['face', 'couronnement', 'parapet', 'arase', 'merlon']);

/** ÉPAISSEUR MONDE (m) d'un mur d'arête. Les faces du pivot sont des plans d'épaisseur NULLE (l'affine
 *  peint des quads d'écran) : à 90° de plongée un mur y a une surface nulle. Épaisseur = la largeur du
 *  POTEAU qui encadre le mur, ramenée au monde comme toute largeur de montant (`uprightWidthM`) :
 *  3.8 px / pxPerM(2) ≈ 0.168 m à 2 m/tuile. */
export function wallThicknessM(mpt: number): number {
  return uprightWidthM('poteau', mpt);
}

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

/** Géométrie GPU d'une face : ses triangles, sa normale, son rang coplanaire. */
export interface FaceGeom {
  tris: Tri[];
  normal: Vec3 | null;
  rank: number;
  /** Le sens de parcours des triangles porte déjà le DEHORS (cf. `faceQuadsOriented`). */
  oriented: boolean;
}

/** Quads d'une face soumis au biais coplanaire : le polygone lui-même, ou les DEUX quads croisés d'un
 *  montant (2 points), ou la BOÎTE MINCE d'une face de mur pleine (+ les deux copies d'une face
 *  décorative de mur, une par joue). Un bras de la croix d'un montant est EXACTEMENT dans le plan du
 *  panneau qu'il décore : il entre donc dans le rang coplanaire comme une face pleine (mesuré sur
 *  `arene` : 388 paires montant↔montant + 2 607 paires montant↔face pleine, invisibles tant que les
 *  montants étaient exclus). */
export function faceQuads(face: Face, mpt: number): WorldPoly[] {
  return faceQuadsOriented(face, mpt).quads;
}

/** Quads d'une face + le drapeau `oriented` : `true` quand le sens de parcours des quads PORTE déjà une
 *  information (chaque quad regarde le DEHORS du volume qui vient d'être fabriqué — boîte de mur, copies
 *  par joue), `false` quand la face est rendue telle que le pivot l'a authorée (aucune convention de
 *  sens) et qu'il revient au consommateur de l'orienter. */
export function faceQuadsOriented(face: Face, mpt: number): { quads: WorldPoly[]; oriented: boolean } {
  const poly = facePoly(face, mpt);
  if (poly.length === 2)
    return { quads: crossQuadPolys(poly[0], poly[1], montantWidthM(face.material.part, mpt)), oriented: false };
  if (face.material.domain !== 'structure') return { quads: [poly], oriented: false };
  const n = polyNormal(poly);
  if (!n || Math.abs(n.y) > 1e-6) return { quads: [poly], oriented: false }; // seul un plan VERTICAL a une épaisseur d'arête
  const t = wallThicknessM(mpt);
  if (SOLID_WALL_PARTS.has(face.material.part ?? '')) return { quads: wallBoxPolys(poly, n, t), oriented: true };
  return { quads: [offsetPoly(poly, n, t / 2), reversePoly(offsetPoly(poly, n, -t / 2))], oriented: true };
}

/** Faces → triangles monde, biais coplanaire appliqué, montants développés en croix et murs en boîtes
 *  minces. Le RANG se calcule
 *  sur la liste FOURNIE (cf. `coplanarRanks` : la porter à l'échelle de la scène), quads de montants
 *  compris. Le `rank` rendu pour un montant est le PLUS HAUT de ses deux quads. */
export function facesGeometry(faces: readonly Face[], mpt: number): FaceGeom[] {
  const parts = faces.map((f) => faceQuadsOriented(f, mpt));
  const ranks = coplanarRanks(parts.flatMap((p) => p.quads));
  const out: FaceGeom[] = [];
  let k = 0;
  for (const { quads: qs, oriented } of parts) {
    const tris: Tri[] = [];
    let rank = 0;
    let normal: Vec3 | null = null;
    for (const q of qs) {
      const r = ranks[k++];
      rank = Math.max(rank, r);
      const biased = biasPoly(q, r);
      if (qs.length === 1) normal = polyNormal(biased); // une croix de montant n'a pas UNE normale
      tris.push(...fanTriangles(biased));
    }
    out.push({ tris, normal, rank, oriented });
  }
  return out;
}

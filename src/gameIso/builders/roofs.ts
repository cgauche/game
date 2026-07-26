/**
 * BUILDER de TOITS — produit les éléments `roof` du pivot (cf. ./types) en PANS CONTINUS, DÉRIVÉS
 * d'une MASSE de bâtiment (#823 : remplace le toit authoré à la main — rectangles+axe+égout+pente
 * écrits par l'auteur). L'auteur ne déclare que l'INTENTION (`BuildingMass` : emprise, niveaux,
 * profil, pente en DEGRÉS, matériau) ; la géométrie entière (pans, faîte, noues, croupes, pignons) se
 * DÉRIVE d'une formule UNIQUE :
 *   `hauteur(case) = hauteurÉgout + distance(case, bord de la masse) × métresParCase × tan(pente)`
 * — `hip` mesure la distance dans TOUTES les directions (BFS 4-connexe depuis le bord de l'emprise
 * RÉELLE, pas sa boîte englobante : noues aux angles rentrants, croupes aux angles sortants,
 * AUTOMATIQUEMENT, y compris sur un corps en L) ; `gable`/`shed` mesurent la distance UNIQUEMENT
 * perpendiculairement à l'axe de faîtage (portée LOCALE par tranche le long du faîtage — une jupe plus
 * étroite qu'une aile voisine obtient sa propre portée, sans pré-groupement en « nappes »).
 *
 * Les cellules coplanaires ADJACENTES fusionnent en UN polygone de pan, et les cellules-SELLES (non
 * planes, aux arêtiers/noues diagonaux) sont SCINDÉES en 2 triangles le long de la diagonale de crête,
 * chaque triangle rejoignant le pan de son côté → arêtiers nets, UNE teinte par pan. Expose aussi les
 * LIGNES sémantiques (faîte, arêtiers, égout, rangs de tuiles espacés le long de la pente) et les
 * VÉRITÉS DE SCÈNE (visible, roofOccupied — cutaway). PUR et projection-agnostique : géométrie en
 * unités de GRILLE + MÈTRES (`GP`).
 */
import { heightAt, type ArchitectureRect, type BuildingMass, type Scene } from '../../state/scene';
import { sceneZoneTiles } from '../../state/zones';
import { roofMaterial } from '../catalog/roofs';
import { WALL_H_M, isoPxToM } from '../iso';
import type { CellSide, Face, GP, RoofEl, RoofLine, RoofLineKind } from './types';

/** Montée de la nappe par CRAN de profondeur d'avant-toit (17 px-iso), en mètres — une seule
 *  vérité px⇔m (`isoPxToM`). Les rangs de tuiles se comptent PAR cran. Reste une constante d'approximation
 *  pour les ornements de faîte (`gameIso/builders/props.ts`), hors de la formule authentique des masses. */
export const ROOF_SLOPE_M = isoPxToM(17);

/** Rangs de tuiles PAR CRAN de montée, dérivés du PAS MÉTRIQUE de la recette du matériau
 *  (`detail.courses.hM` — SOURCE UNIQUE de l'espacement, partagée builder ↔ backend toits) ; un
 *  matériau sans recette d'assises ne porte aucun rang. */
export function roofCoursesPerStep(det?: { courses?: { hM: number } }): number | undefined {
  const hM = det?.courses?.hM;
  return hM ? Math.max(1, Math.round(ROOF_SLOPE_M / hM)) : undefined;
}

const EPS = 1e-9;

/** VOLUME de l'avant-toit (Lot 3) piloté par la DONNÉE matériau (`RoofMaterialDef`) : `overhang` = run du
 *  soffite au-delà de l'égout, en CASES (drop = `overhang × ROOF_SLOPE_M`, coplanaire au pan) ; `fasciaDrop`
 *  = hauteur (m) de la planche de rive verticale (0 ⇒ pas de fascia). Les TONS (soffite/fascia) restent au
 *  backend — le builder ne produit que la GÉOMÉTRIE (faces `part:'soffite'`/`'fascia'`). */
export interface EaveSpec {
  overhang: number;
  fasciaDrop: number;
}

/** Forme RÉSOLUE (jamais l'authoring brut) : `ridge` toujours tranché (défaut = long axe appliqué par
 *  l'appelant), `pitch` toujours en MÈTRES PAR CASE de distance (dérivé de l'angle authoré × échelle de
 *  scène par l'appelant — `roofPans` ne connaît que la géométrie, jamais les degrés). `eaveSide` ne sert
 *  qu'à `shed` (côté d'égout bas déclaré, sans défaut deviné). */
export interface RoofShapeSpec {
  profile: 'gable' | 'hip' | 'shed' | 'flat';
  ridge: 'x' | 'y';
  pitch: number;
  eaveHeightM: number;
  eaveSide?: 'N' | 'E' | 'S' | 'O';
}

type VXY = { x: number; y: number };
const vk = (x: number, y: number) => `${x},${y}`;

/** Cellules d'un rectangle d'emprise (répété pour chaque MASSE de `footprint`). */
function rectCells(foot: ArchitectureRect): { x: number; y: number }[] {
  const cells: { x: number; y: number }[] = [];
  for (let y = foot.y; y < foot.y + foot.h; y++)
    for (let x = foot.x; x < foot.x + foot.w; x++) cells.push({ x, y });
  return cells;
}

/** Union des rectangles d'une masse en un ensemble de cellules (clés « x,y »). */
export function massFootprintCells(footprint: readonly ArchitectureRect[]): Set<string> {
  const out = new Set<string>();
  for (const rect of footprint) for (const c of rectCells(rect)) out.add(vk(c.x, c.y));
  return out;
}

/** Axe de faîtage RÉSOLU : celui authoré, sinon le LONG axe de l'emprise réelle (jamais sa boîte
 *  englobante seule — mais bbox et emprise coïncident sur l'axe qui compte ici). Une masse carrée sans
 *  `ridge` authoré est refusée EN AMONT (`validateBuildingMasses`, `state/mapSpec.ts`) : ce repli 'x' ne
 *  sert qu'à ne jamais planter sur une donnée déjà validée. */
export function resolveMassRidge(mass: Pick<BuildingMass, 'ridge'>, cells: ReadonlySet<string>): 'x' | 'y' {
  if (mass.ridge) return mass.ridge;
  const coords = [...cells].map((k) => k.split(',').map(Number) as [number, number]);
  const w = Math.max(...coords.map(([x]) => x)) - Math.min(...coords.map(([x]) => x));
  const h = Math.max(...coords.map(([, y]) => y)) - Math.min(...coords.map(([, y]) => y));
  return w >= h ? 'x' : 'y';
}

// ── Dérivation de HAUTEUR : une seule formule, trois lectures de « distance au bord » ────────────────
type Dir = readonly [number, number];
const ALL4: Dir[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function vertsOfCells(cells: ReadonlySet<string>) {
  const has = (x: number, y: number) => cells.has(vk(x, y));
  const verts = new Map<string, VXY>();
  for (const k of cells) {
    const [x, y] = k.split(',').map(Number);
    for (const v of [{ x, y }, { x: x + 1, y }, { x, y: y + 1 }, { x: x + 1, y: y + 1 }]) verts.set(vk(v.x, v.y), v);
  }
  const inner = (v: VXY) => has(v.x - 1, v.y - 1) && has(v.x, v.y - 1) && has(v.x - 1, v.y) && has(v.x, v.y);
  return { verts, inner };
}

/** `hip` — profondeur BFS 4-connexe depuis le BORD de `cells` : distance de Manhattan au bord dans
 *  TOUTES les directions. Sur un corps en L, les vertex du coin RENTRANT sont à profondeur 0 comme
 *  ceux du bord — la triangulation par SELLE (plus bas) y ouvre la NOUE toute seule ; les coins
 *  SORTANTS convergent en croupe. Générale, ne suppose AUCUNE forme rectangulaire. */
function bfsDepth(cells: ReadonlySet<string>): Map<string, number> {
  const { verts, inner } = vertsOfCells(cells);
  const dep = new Map<string, number>();
  const queue: VXY[] = [];
  for (const v of verts.values()) if (!inner(v)) { dep.set(vk(v.x, v.y), 0); queue.push(v); }
  for (let i = 0; i < queue.length; i++) {
    const v = queue[i];
    const d = dep.get(vk(v.x, v.y))!;
    for (const [dx, dy] of ALL4) {
      const nx = v.x + dx, ny = v.y + dy, nk = vk(nx, ny);
      if (verts.has(nk) && !dep.has(nk)) { dep.set(nk, d + 1); queue.push({ x: nx, y: ny }); }
    }
  }
  return dep;
}

/** `gable`/`shed` — portée LOCALE (bord à bord de `cells`, PAS la boîte englobante) le long de l'axe
 *  croisé (⊥ `axis`), tranche par tranche le long de `axis` : une tranche = toutes les cellules
 *  partageant la même coordonnée sur `axis`. Une jupe plus étroite qu'une aile voisine (silhouette en
 *  L) reçoit SA portée, jamais celle de la tranche voisine plus large. */
function localSpans(cells: ReadonlySet<string>, axis: 'x' | 'y'): Map<number, { lo: number; hi: number }> {
  const rows = new Map<number, { lo: number; hi: number }>();
  for (const k of cells) {
    const [x, y] = k.split(',').map(Number);
    const along = axis === 'x' ? x : y;
    const cross = axis === 'x' ? y : x;
    const row = rows.get(along);
    if (!row) rows.set(along, { lo: cross, hi: cross + 1 });
    else { row.lo = Math.min(row.lo, cross); row.hi = Math.max(row.hi, cross + 1); }
  }
  return rows;
}

function crossSpanAt(v: VXY, rows: Map<number, { lo: number; hi: number }>, axis: 'x' | 'y'): { lo: number; hi: number } {
  const along = axis === 'x' ? v.x : v.y;
  const cands = [rows.get(along - 1), rows.get(along)].filter((r): r is { lo: number; hi: number } => !!r);
  return { lo: Math.min(...cands.map((r) => r.lo)), hi: Math.max(...cands.map((r) => r.hi)) };
}

/** Montée (m) d'un sommet de grille `v` pour l'emprise `cells` — LA formule (doc de tête), lue selon le
 *  profil : `hip` = BFS toutes directions ; `gable` = portée locale ⊥ `ridge`, DEUX côtés ; `shed` =
 *  portée locale ⊥ à l'axe d'égout déclaré, UN SEUL côté (0 à l'égout, montée vers l'intérieur) ; `flat`
 *  = 0 partout. SOURCE UNIQUE — `roofPans` (pavage), `gableEnds` (pignons) et `walls.ts` (jointures de
 *  toit, #819) y passent tous. */
export function riseAt(v: VXY, cells: ReadonlySet<string>, shape: RoofShapeSpec, cache?: { dep?: Map<string, number>; rows?: Map<number, { lo: number; hi: number }> }): number {
  if (shape.profile === 'flat') return 0;
  if (shape.profile === 'hip') {
    const dep = cache?.dep ?? bfsDepth(cells);
    const key = vk(v.x, v.y);
    if (dep.has(key)) return dep.get(key)! * shape.pitch;
    // Repli CONTINU (coordonnée fractionnaire — sommet inséré du pavage rectangulaire rapide, ex. le
    // point d'arêtier inset RW/RE) : distance de Manhattan à la boîte englobante, EXACTE pour un
    // rectangle (BFS et bbox coïncident aux sommets entiers ; ce repli étend juste la même formule
    // aux points intermédiaires que le pavage rapide interpole).
    const coords = [...cells].map((k) => k.split(',').map(Number) as [number, number]);
    const minX = Math.min(...coords.map(([x]) => x)), maxX = Math.max(...coords.map(([x]) => x)) + 1;
    const minY = Math.min(...coords.map(([, y]) => y)), maxY = Math.max(...coords.map(([, y]) => y)) + 1;
    return Math.min(v.x - minX, maxX - v.x, v.y - minY, maxY - v.y) * shape.pitch;
  }
  if (shape.profile === 'gable') {
    const rows = cache?.rows ?? localSpans(cells, shape.ridge);
    const { lo, hi } = crossSpanAt(v, rows, shape.ridge);
    const cross = shape.ridge === 'x' ? v.y : v.x;
    return Math.min(cross - lo, hi - cross) * shape.pitch;
  }
  // shed : l'axe croisé est celui perpendiculaire au côté d'égout déclaré (N/S ⇒ axe 'x', E/O ⇒ 'y').
  const axis: 'x' | 'y' = shape.eaveSide === 'N' || shape.eaveSide === 'S' ? 'x' : 'y';
  const rows = cache?.rows ?? localSpans(cells, axis);
  const { lo, hi } = crossSpanAt(v, rows, axis);
  const cross = axis === 'x' ? v.y : v.x;
  const lowIsSmallSide = shape.eaveSide === 'N' || shape.eaveSide === 'O';
  return (lowIsSmallSide ? cross - lo : hi - cross) * shape.pitch;
}

/** Hauteur (m) d'un sommet de grille pour l'emprise `cells` — `eaveHeightM` + `riseAt`. */
export function roofHeightAt(v: VXY, cells: ReadonlySet<string>, shape: RoofShapeSpec): number {
  return shape.eaveHeightM + riseAt(v, cells, shape);
}

export interface RoofPanGeometry {
  id: string;
  face: Face;
  faces: Face[];
  lines: RoofLine[];
}

/** Pièce PLANE du pavage (quad de cellule coplanaire, ou triangle issu d'une selle), sommets en ordre
 *  HORAIRE grille + gradient du plan (montée par +x / +y). */
interface Piece {
  pts: VXY[];
  gx: number;
  gy: number;
}

/** Orientation de la pente DESCENDANTE d'un plan (teinte du pan) : gx>0 : monte vers +x ⇒ descend
 *  vers l'ouest ; plat ⇒ 'N'. */
const partOf = (gx: number, gy: number): CellSide =>
  Math.abs(gx) >= Math.abs(gy) ? (gx > EPS ? 'O' : gx < -EPS ? 'E' : 'N') : gy > 0 ? 'N' : 'S';

/** Gradient du plan passant par 3 points (hauteurs comprises) — exact, det ≠ 0 (triangles de grille). */
function grad3(p0: VXY & { h: number }, p1: VXY & { h: number }, p2: VXY & { h: number }): { gx: number; gy: number } {
  const ux = p1.x - p0.x, uy = p1.y - p0.y, uh = p1.h - p0.h;
  const vx = p2.x - p0.x, vy = p2.y - p0.y, vh = p2.h - p0.h;
  const det = ux * vy - uy * vx;
  return { gx: (uh * vy - uy * vh) / det, gy: (ux * vh - uh * vx) / det };
}

/** Retire les sommets intermédiaires COLINÉAIRES d'une boucle (une arête d'égout de 4 crans devient un
 *  seul côté ; `h` suit automatiquement, linéaire sur le plan du pan). */
function simplifyLoop(loop: VXY[]): VXY[] {
  const n = loop.length;
  const out: VXY[] = [];
  for (let i = 0; i < n; i++) {
    const p = loop[(i + n - 1) % n], c = loop[i], q = loop[(i + 1) % n];
    const ax = c.x - p.x, ay = c.y - p.y, bx = q.x - c.x, by = q.y - c.y;
    if (ax * by - ay * bx !== 0 || ax * bx + ay * by <= 0) out.push(c);
  }
  return out;
}

type VXYH = VXY & { h: number };

/** Fusionne les segments COLINÉAIRES 3D CONTIGUS de même nature (sommets de grille entiers) : un faîte
 *  de 3 cellules ou un égout de façade = UNE ligne. La colinéarité se vérifie AUSSI en HAUTEUR (même
 *  pente h le long de la droite porteuse) : deux arêtiers opposés qui se rejoignent à l'apex d'une
 *  pyramide — ou à la noue d'un coin rentrant — partagent la même droite xy mais leur h est en CHEVRON
 *  → ils restent DEUX lignes (coin→apex chacun). */
function mergeSegs(segs: { a: VXYH; b: VXYH; kind: RoofLineKind }[]): { a: VXYH; b: VXYH; kind: RoofLineKind }[] {
  const buckets = new Map<string, { t0: number; t1: number; a: VXYH; b: VXYH; kind: RoofLineKind }[]>();
  for (const s of segs) {
    let { a, b } = s;
    let dx = b.x - a.x, dy = b.y - a.y;
    if (dx < 0 || (dx === 0 && dy < 0)) { [a, b] = [b, a]; dx = -dx; dy = -dy; }
    const g = Math.abs(gcd(dx, dy)) || 1;
    const ux = dx / g, uy = dy / g;
    const key = `${s.kind}|${ux},${uy}|${a.x * uy - a.y * ux}`; // nature + direction + droite porteuse
    const t = (p: VXY) => p.x * ux + p.y * uy;
    (buckets.get(key) ?? buckets.set(key, []).get(key)!).push({ t0: t(a), t1: t(b), a, b, kind: s.kind });
  }
  const slope = (s: { t0: number; t1: number; a: VXYH; b: VXYH }) => (s.b.h - s.a.h) / (s.t1 - s.t0);
  const out: { a: VXYH; b: VXYH; kind: RoofLineKind }[] = [];
  for (const list of buckets.values()) {
    list.sort((p, q) => p.t0 - q.t0);
    let cur = list[0];
    for (let i = 1; i < list.length; i++) {
      const s = list[i];
      if (s.t0 === cur.t1 && Math.abs(slope(s) - slope(cur)) < EPS) cur = { ...cur, t1: s.t1, b: s.b };
      else { out.push(cur); cur = s; }
    }
    out.push(cur);
  }
  return out;
}
const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/** PANS CONTINUS + LIGNES d'un toit couvrant `cells` (clés « x,y », forme quelconque), pour `shape`
 *  (profil/faîtage RÉSOLUS, pente en m/case, hauteur d'égout). CŒUR PUR (testable sur un L) consommé
 *  par `buildAuthoredRoofs`/`buildRoofs` : hauteurs de sommet par `riseAt` (LA formule, doc de tête),
 *  pavage en pièces PLANES (quads coplanaires / selles scindées), fusion des pièces adjacentes de même
 *  plan (annulation d'arêtes internes → polygone de bord), classification des arêtes restantes (égout
 *  au bord, faîte/arêtier entre deux pans), rangs de tuiles en courbes de niveau du plan (`courses`
 *  rangs par cran de montée). */
export function roofPans(
  cells: ReadonlySet<string>,
  matId: string,
  courses: number | undefined,
  eave: EaveSpec | undefined,
  shape: RoofShapeSpec,
): { faces: Face[]; lines: RoofLine[]; pans?: RoofPanGeometry[] } {
  if (!cells.size) return { faces: [], lines: [] };
  const cellCoords = [...cells].map((key) => key.split(',').map(Number) as [number, number]);
  const minCellX = Math.min(...cellCoords.map(([x]) => x));
  const maxCellX = Math.max(...cellCoords.map(([x]) => x)) + 1;
  const minCellY = Math.min(...cellCoords.map(([, y]) => y));
  const maxCellY = Math.max(...cellCoords.map(([, y]) => y)) + 1;

  const rectangular = cells.size === (maxCellX - minCellX) * (maxCellY - minCellY);
  const riseCache = shape.profile === 'hip'
    ? { dep: bfsDepth(cells) }
    : shape.profile === 'gable'
      ? { rows: localSpans(cells, shape.ridge) }
      : shape.profile === 'shed'
        ? { rows: localSpans(cells, shape.eaveSide === 'N' || shape.eaveSide === 'S' ? 'x' : 'y') }
        : undefined;
  const hV = (v: VXY): number => shape.eaveHeightM + riseAt(v, cells, shape, riseCache);
  const withH = (v: VXY) => ({ ...v, h: hV(v) });

  // ── Pavage en pièces PLANES : quad si la cellule est plane (h_TL + h_BR = h_TR + h_BL), sinon
  //    CELLULE-SELLE scindée le long de la diagonale de CRÊTE — celle au plus grand écart de hauteur
  //    (elle relie le coin bas à la pointe haute : l'arêtier/la noue) ; chaque triangle est plan.
  const pieces: Piece[] = [];
  const splitX: number[] = [];
  const splitY: number[] = [];
  // Pré-cut au faîtage GLOBAL réservé au cas RECTANGULAIRE (emprise == boîte englobante : la portée
  // locale coïncide partout avec la bbox, la ligne de faîte est donc unique et globale). Sur une forme
  // irrégulière, imposer une coupe globale désaligne le pavage de la vraie portée LOCALE (`riseAt`) — le
  // pavage par cellule (branche `else` ci-dessous) suit alors `hV` cellule par cellule, sans pré-cut.
  if (rectangular && (shape.profile === 'gable' || shape.profile === 'hip')) {
    if (shape.ridge === 'x') {
      const mid = (minCellY + maxCellY) / 2;
      splitY.push(mid);
      if (shape.profile === 'hip') {
        const inset = Math.min((maxCellY - minCellY) / 2, (maxCellX - minCellX) / 2);
        splitX.push(minCellX + inset, maxCellX - inset);
      }
    } else {
      const mid = (minCellX + maxCellX) / 2;
      splitX.push(mid);
      if (shape.profile === 'hip') {
        const inset = Math.min((maxCellX - minCellX) / 2, (maxCellY - minCellY) / 2);
        splitY.push(minCellY + inset, maxCellY - inset);
      }
    }
  }
  const cuts = (lo: number, hi: number, splits: number[]) =>
    [...new Set([lo, ...splits.filter((value) => value > lo + EPS && value < hi - EPS), hi])]
      .sort((a, b) => a - b);
  const addPiece = (raw: VXY[]) => {
    const pts = raw.filter((point, index) => index === 0 || point.x !== raw[index - 1].x || point.y !== raw[index - 1].y);
    if (pts.length > 2 && pts[0].x === pts[pts.length - 1].x && pts[0].y === pts[pts.length - 1].y) pts.pop();
    const lifted = pts.map(withH);
    for (let i = 1; i + 1 < lifted.length; i++) {
      const det = (lifted[i].x - lifted[0].x) * (lifted[i + 1].y - lifted[0].y)
        - (lifted[i].y - lifted[0].y) * (lifted[i + 1].x - lifted[0].x);
      if (Math.abs(det) < EPS) continue;
      pieces.push({ pts, ...grad3(lifted[0], lifted[i], lifted[i + 1]) });
      return;
    }
  };
  if (rectangular) {
    const TL = { x: minCellX, y: minCellY }, TR = { x: maxCellX, y: minCellY };
    const BR = { x: maxCellX, y: maxCellY }, BL = { x: minCellX, y: maxCellY };
    if (shape.profile === 'flat' || shape.profile === 'shed') addPiece([TL, TR, BR, BL]);
    else if (shape.ridge === 'x') {
      const mid = (minCellY + maxCellY) / 2;
      const inset = shape.profile === 'hip'
        ? Math.min((maxCellY - minCellY) / 2, (maxCellX - minCellX) / 2)
        : 0;
      const RW = { x: minCellX + inset, y: mid }, RE = { x: maxCellX - inset, y: mid };
      addPiece([TL, TR, RE, RW]);
      if (shape.profile === 'hip') addPiece([TR, BR, RE]);
      addPiece([RW, RE, BR, BL]);
      if (shape.profile === 'hip') addPiece([TL, RW, BL]);
    } else {
      const mid = (minCellX + maxCellX) / 2;
      const inset = shape.profile === 'hip'
        ? Math.min((maxCellX - minCellX) / 2, (maxCellY - minCellY) / 2)
        : 0;
      const RN = { x: mid, y: minCellY + inset }, RS = { x: mid, y: maxCellY - inset };
      addPiece([TL, RN, RS, BL]);
      if (shape.profile === 'hip') addPiece([TL, TR, RN]);
      addPiece([RN, TR, BR, RS]);
      if (shape.profile === 'hip') addPiece([BL, RS, BR]);
    }
  } else for (const k of cells) {
      const [x, y] = k.split(',').map(Number);
      const xs = cuts(x, x + 1, splitX);
      const ys = cuts(y, y + 1, splitY);
      for (let yi = 0; yi + 1 < ys.length; yi++)
        for (let xi = 0; xi + 1 < xs.length; xi++) {
          const TL = withH({ x: xs[xi], y: ys[yi] });
          const TR = withH({ x: xs[xi + 1], y: ys[yi] });
          const BR = withH({ x: xs[xi + 1], y: ys[yi + 1] });
          const BL = withH({ x: xs[xi], y: ys[yi + 1] });
          if (Math.abs(TL.h + BR.h - TR.h - BL.h) < EPS) {
            pieces.push({ pts: [TL, TR, BR, BL], gx: (TR.h - TL.h) / (TR.x - TL.x), gy: (BL.h - TL.h) / (BL.y - TL.y) });
          } else {
            const tris = Math.abs(TL.h - BR.h) >= Math.abs(TR.h - BL.h)
              ? [[TL, TR, BR], [TL, BR, BL]]
              : [[TL, TR, BL], [TR, BR, BL]];
            for (const triangle of tris) pieces.push({ pts: triangle, ...grad3(triangle[0], triangle[1], triangle[2]) });
          }
        }
  }

  // ── Fusion en PANS : deux pièces partageant une arête ET de même gradient sont coplanaires (l'arête
  //    commune ancre le plan) → union-find. Les arêtes recensent aussi leurs propriétaires (lignes).
  const parent = pieces.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const ek = (a: VXY, b: VXY) => [vk(a.x, a.y), vk(b.x, b.y)].sort().join('|');
  const edgeOwners = new Map<string, number[]>();
  pieces.forEach((p, i) =>
    p.pts.forEach((a, j) => {
      const key = ek(a, p.pts[(j + 1) % p.pts.length]);
      (edgeOwners.get(key) ?? edgeOwners.set(key, []).get(key)!).push(i);
    }),
  );
  for (const owners of edgeOwners.values())
    if (owners.length === 2) {
      const [a, b] = owners;
      if (Math.abs(pieces[a].gx - pieces[b].gx) < EPS && Math.abs(pieces[a].gy - pieces[b].gy) < EPS) parent[find(a)] = find(b);
    }
  const groups = new Map<number, number[]>();
  pieces.forEach((_, i) => {
    const r = find(i);
    (groups.get(r) ?? groups.set(r, []).get(r)!).push(i);
  });

  // ── Bord de chaque pan : annulation des arêtes internes (parcours horaire cohérent → toute arête
  //    partagée dans le groupe apparaît dans les deux sens), chaînage en boucle(s), simplification.
  const toGP = (v: VXY) => ({ x: v.x - 0.5, y: v.y - 0.5, h: hV(v) });
  const faces: Face[] = [];
  const rangs: { a: VXY; b: VXY; kind: RoofLineKind; h0: number; h1: number }[] = [];
  for (const members of groups.values()) {
    const dirSet = new Map<string, [VXY, VXY]>();
    for (const i of members)
      pieces[i].pts.forEach((a, j) => {
        const b = pieces[i].pts[(j + 1) % pieces[i].pts.length];
        const rev = `${vk(b.x, b.y)}>${vk(a.x, a.y)}`;
        if (dirSet.has(rev)) dirSet.delete(rev);
        else dirSet.set(`${vk(a.x, a.y)}>${vk(b.x, b.y)}`, [a, b]);
      });
    const nextOf = new Map<string, VXY[]>();
    for (const [a, b] of dirSet.values()) {
      const ka = vk(a.x, a.y);
      (nextOf.get(ka) ?? nextOf.set(ka, []).get(ka)!).push(b);
    }
    const { gx, gy } = pieces[members[0]];
    const part = partOf(gx, gy);
    // Boucles (une par pan ; un pan annulaire pathologique — toit en anneau à plat — en émettrait
    // plusieurs, chacune devient sa propre face).
    const loops: VXY[][] = [];
    for (const [start, outs] of nextOf) {
      while (outs.length) {
        const loop: VXY[] = [];
        let cur = outs.pop()!;
        while (vk(cur.x, cur.y) !== start) {
          loop.push(cur);
          cur = nextOf.get(vk(cur.x, cur.y))!.pop()!;
        }
        loop.push(cur);
        loops.push(simplifyLoop(loop));
      }
    }
    for (const loop of loops)
      faces.push({ poly: loop.map(toGP), material: { domain: 'roof', id: matId, part } });

    // RANGS de tuiles : courbes de niveau du plan du pan, `courses` rangs par cran de montée, décalées
    // d'un demi-pas (jamais sur un sommet → intersections franches), clippées au(x) bord(s) du pan.
    if (courses && courses > 0 && (Math.abs(gx) > EPS || Math.abs(gy) > EPS)) {
      let hMin = Infinity, hMax = -Infinity;
      for (const loop of loops) for (const v of loop) { const h = hV(v); hMin = Math.min(hMin, h); hMax = Math.max(hMax, h); }
      const step = shape.pitch / courses;
      for (let lvl = hMin + step / 2; lvl < hMax - EPS; lvl += step) {
        const cross: { x: number; y: number; s: number }[] = [];
        for (const loop of loops)
          for (let i = 0; i < loop.length; i++) {
            const a = withH(loop[i]), b = withH(loop[(i + 1) % loop.length]);
            if (a.h < lvl !== b.h < lvl) {
              const t = (lvl - a.h) / (b.h - a.h);
              const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
              cross.push({ x, y, s: x * -gy + y * gx }); // trié LE LONG de la courbe de niveau (⊥ gradient)
            }
          }
        cross.sort((p, q) => p.s - q.s);
        for (let i = 0; i + 1 < cross.length; i += 2)
          rangs.push({ a: cross[i], b: cross[i + 1], kind: 'rang', h0: lvl, h1: lvl });
      }
    }
  }

  // ── Lignes de STRUCTURE : bord du toit (1 pièce) = égout ; entre deux PANS = faîte (horizontale) ou
  //    arêtier/noue (dénivelée). Fusion des tronçons colinéaires 3D, puis conversion en GP.
  const structSegs: { a: VXYH; b: VXYH; kind: RoofLineKind }[] = [];
  for (const [key, owners] of edgeOwners) {
    const [a, b] = key.split('|').map((k) => { const [x, y] = k.split(',').map(Number); return withH({ x, y }); });
    if (owners.length === 1) structSegs.push({ a, b, kind: 'egout' });
    else if (find(owners[0]) !== find(owners[1]))
      structSegs.push({ a, b, kind: Math.abs(a.h - b.h) < EPS ? 'faite' : 'aretier' });
  }
  const lines: RoofLine[] = mergeSegs(structSegs).map((s) => ({
    a: { x: s.a.x - 0.5, y: s.a.y - 0.5, h: s.a.h },
    b: { x: s.b.x - 0.5, y: s.b.y - 0.5, h: s.b.h },
    kind: s.kind,
  }));

  // ── AVANT-TOIT (VOLUME) : chaque ÉGOUT (jamais un arêtier/faîte) projette un SOFFITE coplanaire au pan
  //    (le débord PROLONGE la nappe vers l'extérieur, en CONTINUANT la pente → son bord extérieur descend
  //    de `overhang × ROOF_SLOPE_M` sous l'égout) + une FASCIA verticale pendant sous ce bord. ADDITIF :
  //    posé APRÈS le pavage/fusion/classification, il ne perturbe NI les pans NI les lignes. Un égout est
  //    axis-aligné (empreinte = union de cellules) et sa normale SORTANTE (⊥ à l'égout, opposée au
  //    centroïde de l'empreinte) coïncide avec la ligne de plus grande pente du pan → soffite COPLANAIRE.
  //    Les bouts sont prolongés d'`overhang` LE LONG de l'égout : aux angles convexes, deux soffites/
  //    fascias voisins se RECOUVRENT (même ton) au lieu de laisser un trou — coin fermé, net à toute vue.
  if (eave && eave.overhang > EPS) {
    const e = eave.overhang;
    let cX = 0, cY = 0;
    for (const k of cells) { const [x, y] = k.split(',').map(Number); cX += x; cY += y; }
    cX /= cells.size; cY /= cells.size; // centroïde d'empreinte (repère GP : centre de cellule = (cx,cy))
    for (const ln of lines) {
      if (ln.kind !== 'egout') continue;
      const { a, b } = ln;
      const dx = b.x - a.x, dy = b.y - a.y;
      const len = Math.hypot(dx, dy);
      if (len < EPS) continue;
      const ux = dx / len, uy = dy / len; // le long de l'égout
      let nx = -uy, ny = ux; // normale
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      if (nx * (mx - cX) + ny * (my - cY) < 0) { nx = -nx; ny = -ny; } // orientée vers l'EXTÉRIEUR
      const plane = pieces.find((piece) => {
        const p0 = piece.pts[0];
        const onPlane = (point: GP) =>
          Math.abs(hV(p0) + piece.gx * (point.x + 0.5 - p0.x) + piece.gy * (point.y + 0.5 - p0.y) - point.h) < EPS;
        return onPlane(a) && onPlane(b);
      });
      const lift = e * ((plane?.gx ?? 0) * nx + (plane?.gy ?? 0) * ny);
      const a2: GP = { x: a.x - ux * e, y: a.y - uy * e, h: a.h }; // bord intérieur, prolongé aux angles
      const b2: GP = { x: b.x + ux * e, y: b.y + uy * e, h: b.h };
      const aO: GP = { x: a2.x + nx * e, y: a2.y + ny * e, h: a2.h + lift };
      const bO: GP = { x: b2.x + nx * e, y: b2.y + ny * e, h: b2.h + lift };
      faces.push({ poly: [a2, b2, bO, aO], material: { domain: 'roof', id: matId, part: 'soffite' } });
      if (eave.fasciaDrop > EPS) {
        const aF: GP = { x: aO.x, y: aO.y, h: aO.h - eave.fasciaDrop };
        const bF: GP = { x: bO.x, y: bO.y, h: bO.h - eave.fasciaDrop };
        faces.push({ poly: [aO, bO, bF, aF], material: { domain: 'roof', id: matId, part: 'fascia' } });
      }
    }
  }

  for (const r of rangs)
    lines.push({ a: { x: r.a.x - 0.5, y: r.a.y - 0.5, h: r.h0 }, b: { x: r.b.x - 0.5, y: r.b.y - 0.5, h: r.h1 }, kind: r.kind });
  const slopeFaces = faces.filter((face) => ['N', 'E', 'S', 'O'].includes(face.material.part!));
  const planeOf = (face: Face) => {
    const [p0, p1] = face.poly;
    for (let i = 2; i < face.poly.length; i++) {
      const p2 = face.poly[i];
      const det = (p1.x - p0.x) * (p2.y - p0.y) - (p1.y - p0.y) * (p2.x - p0.x);
      if (Math.abs(det) < EPS) continue;
      const gx = ((p1.h - p0.h) * (p2.y - p0.y) - (p1.y - p0.y) * (p2.h - p0.h)) / det;
      const gy = ((p1.x - p0.x) * (p2.h - p0.h) - (p1.h - p0.h) * (p2.x - p0.x)) / det;
      return (p: GP) => Math.abs(p0.h + gx * (p.x - p0.x) + gy * (p.y - p0.y) - p.h) < EPS;
    }
    return (p: GP) => Math.abs(p.h - p0.h) < EPS;
  };
  const partCounts = new Map<string, number>();
  const pans = slopeFaces.map((face) => {
    const part = face.material.part!;
    const n = partCounts.get(part) ?? 0;
    partCounts.set(part, n + 1);
    const onPlane = planeOf(face);
    return {
      id: `${part.toLowerCase()}-${n}`,
      face,
      faces: [
        face,
        ...faces.filter((candidate) => candidate !== face
          && (candidate.material.part === 'soffite' || candidate.material.part === 'fascia')
          && candidate.poly.slice(0, 2).every(onPlane)),
      ],
      lines: lines.filter((line) => onPlane(line.a) && onPlane(line.b)),
    };
  });
  return { faces, lines, pans };
}

/** Triangle (`gable`) ou triangle rectangle (`shed`) fermant le PIGNON à une extrémité du faîtage — le
 *  volume que ni les rampants (qui s'arrêtent à l'égout) ni le mur d'étage (qui ne montait que jusqu'à
 *  sa hauteur de base) ne produisaient, laissant voir à travers le comble. Géométrie PURE, déduite du
 *  MÊME champ de hauteur que `roofPans` (`riseAt`) — aucune donnée d'auteur nouvelle : base à la
 *  hauteur d'égout, sommet à la hauteur de faîtage. `hip`/`flat` n'en ont aucun (`[]`). La largeur du
 *  pignon suit l'étendue RÉELLE des cellules qui touchent cette extrémité (pas la bbox globale) — un
 *  corps en L dont l'aile ne couvre pas toute la largeur ferme un pignon à SA largeur, jamais plus large
 *  que le toit qu'il porte. `outside`/`anchor` permettent au builder de MUR (`gableEls`, walls.ts) de
 *  savoir si une AUTRE masse de toiture couvre déjà la case adjacente (jointure : pas de pignon flottant
 *  entre deux volumes contigus). */
export interface GableEnd {
  poly: GP[];
  /** Case (grille) touchant l'INTÉRIEUR de ce pignon, côté toit. */
  anchor: { x: number; y: number };
  /** Case juste au-delà du pignon, côté EXTÉRIEUR (hors de l'empreinte de cette masse). */
  outside: { x: number; y: number };
}

export function gableEnds(cells: ReadonlySet<string>, shape: RoofShapeSpec): GableEnd[] {
  if (shape.profile !== 'gable' && shape.profile !== 'shed') return [];
  const coords = [...cells].map((key) => key.split(',').map(Number) as [number, number]);
  if (!coords.length) return [];
  const minCellX = Math.min(...coords.map(([x]) => x));
  const maxCellX = Math.max(...coords.map(([x]) => x)) + 1;
  const minCellY = Math.min(...coords.map(([, y]) => y));
  const maxCellY = Math.max(...coords.map(([, y]) => y)) + 1;
  const toGP = (x: number, y: number): GP => ({ x: x - 0.5, y: y - 0.5, h: roofHeightAt({ x, y }, cells, shape) });

  const ends = shape.ridge === 'x' ? [minCellX, maxCellX] : [minCellY, maxCellY];
  const out: GableEnd[] = [];
  ends.forEach((along, i) => {
    const isMin = i === 0;
    let lo = Infinity, hi = -Infinity;
    for (const [cx, cy] of coords) {
      const onEnd = shape.ridge === 'x' ? (isMin ? cx === along : cx + 1 === along) : (isMin ? cy === along : cy + 1 === along);
      if (!onEnd) continue;
      const c0 = shape.ridge === 'x' ? cy : cx;
      lo = Math.min(lo, c0);
      hi = Math.max(hi, c0 + 1);
    }
    if (!Number.isFinite(lo) || hi - lo < EPS) return;
    const at = (cross: number): GP => (shape.ridge === 'x' ? toGP(along, cross) : toGP(cross, along));
    const pLo = at(lo), pHi = at(hi);
    const crossCell = Math.min(hi - 1, Math.max(lo, Math.floor((lo + hi - 1) / 2)));
    const inside = shape.ridge === 'x' ? (isMin ? minCellX : maxCellX - 1) : (isMin ? minCellY : maxCellY - 1);
    const beyond = shape.ridge === 'x' ? (isMin ? minCellX - 1 : maxCellX) : (isMin ? minCellY - 1 : maxCellY);
    const anchor = shape.ridge === 'x' ? { x: inside, y: crossCell } : { x: crossCell, y: inside };
    const outside = shape.ridge === 'x' ? { x: beyond, y: crossCell } : { x: crossCell, y: beyond };
    if (shape.profile === 'gable') {
      const apex = at((lo + hi) / 2);
      out.push({ poly: [pLo, apex, pHi], anchor, outside });
    } else {
      const low = pLo.h <= pHi.h ? pLo : pHi;
      const high = pLo.h <= pHi.h ? pHi : pLo;
      out.push({ poly: [low, high, { ...high, h: low.h }], anchor, outside });
    }
  });
  return out;
}

/** Vérité de JEU pilotant le cutaway (PAS une caméra) : positions des ALLIÉS — un toit dont l'empreinte
 *  est occupée est levé (`roofOccupied`). */
export interface RoofView {
  allies?: { x: number; y: number }[];
}

function panCells(face: Face, all: { x: number; y: number }[]): { x: number; y: number }[] {
  const inside = (x: number, y: number) => {
    let hit = false;
    for (let i = 0, j = face.poly.length - 1; i < face.poly.length; j = i++) {
      const a = face.poly[i], b = face.poly[j];
      const cross = (x - a.x) * (b.y - a.y) - (y - a.y) * (b.x - a.x);
      const dot = (x - a.x) * (x - b.x) + (y - a.y) * (y - b.y);
      if (Math.abs(cross) < EPS && dot <= EPS) return true;
      if (a.y > y !== b.y > y && x < a.x + ((b.x - a.x) * (y - a.y)) / (b.y - a.y)) hit = !hit;
    }
    return hit;
  };
  const selected = all.filter((cell) => inside(cell.x, cell.y));
  if (selected.length) return selected;
  const cx = face.poly.reduce((sum, point) => sum + point.x, 0) / face.poly.length;
  const cy = face.poly.reduce((sum, point) => sum + point.y, 0) / face.poly.length;
  return [[...all].sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy))[0]];
}

/** Une masse de toit est l'ENVELOPPE du bâtiment PAR NATURE (jamais une cloison intérieure, cf.
 *  `envelopeEdges` walls.ts) : elle sort du brouillard inconditionnellement — seule `roofOccupied`
 *  (cutaway, allié dans l'empreinte) la fait disparaître. #818. */

const GROUPED_DETAIL_CELL_THRESHOLD = 64;

/** `roomZoneIds` DÉRIVÉS (#823, plus de redistribution manuelle) : les zones INTÉRIEURES de
 *  `scene.effectZones` dont au moins une case tombe dans l'emprise de la masse, à l'un des étages
 *  qu'elle couvre (`z` = plancher sommet, `levels` niveaux DEPUIS `z` en descendant — une masse de 2
 *  niveaux à z=1 couvre z=0 ET z=1, comme l'ancien `RoofSection.roomZoneIds` authoré à la main pour un
 *  toit à étage). */
export function massRoomZoneIds(scene: Scene, mass: BuildingMass, cells: ReadonlySet<string>): string[] {
  const zMin = mass.z - mass.levels + 1;
  const ids = new Set<string>();
  for (const zone of scene.effectZones ?? []) {
    if (zone.presentation !== 'interior') continue;
    const z = zone.z ?? 0;
    if (z < zMin || z > mass.z) continue;
    if (sceneZoneTiles(zone).some((t) => cells.has(vk(t.x, t.y)) && (t.z ?? 0) === z)) ids.add(zone.id);
  }
  return [...ids];
}

/** Forme résolue + emprise + `roomZoneIds` dérivés d'une masse — calcul PARTAGÉ par `buildAuthoredRoofs`
 *  et `walls.ts` (pignons/jointures/enveloppe) : une seule dérivation, jamais deux formules qui
 *  pourraient diverger. */
export function resolveMass(scene: Scene, mass: BuildingMass): { cells: Set<string>; shape: RoofShapeSpec; roomZoneIds: string[] } {
  const cells = massFootprintCells(mass.footprint);
  const ridge = resolveMassRidge(mass, cells);
  const pitch = (scene.metresPerTile ?? 2) * Math.tan((mass.pitchDeg * Math.PI) / 180);
  // Hauteur d'égout ABSOLUE (`GP.h`, cf. `backends/project.projGP`) : le toit repose sur le SOMMET des
  // murs de l'étage `mass.z`, et un mur s'assoit sur le RELIEF de SA case (`buildWalls` : `heightAt`
  // + `WALL_H_M`). L'égout se lit donc sur la MÊME source — la cote métrique du plancher sous
  // l'emprise, jamais une cote déduite de l'index d'étage : un bâtiment sur une butte, une terrasse ou
  // un quai surélevé garde son toit sur ses murs. `levels` ne compte que les niveaux COUVERTS vers le
  // bas (`massRoomZoneIds`) et ne dit RIEN de l'altitude.
  //
  // EMPRISE NON PLANE (cage d'escalier, bâtiment à cheval sur un dénivelé) : l'égout est UNE cote et se
  // prend au point HAUT. C'est le seul choix cohérent avec les murs : au point BAS, la nappe passerait
  // SOUS le sommet des murs des cases hautes — le grief même qu'on corrige — et jusque SOUS leur
  // plancher quand le dénivelé atteint une hauteur de mur. Au point haut, aucun mur porté n'est
  // traversé et le volume coiffé garde au moins un étage de hauteur partout.
  let topFloorM = -Infinity;
  for (const key of cells) {
    const [x, y] = key.split(',').map(Number);
    topFloorM = Math.max(topFloorM, heightAt(scene, x, y, mass.z));
  }
  const eaveHeightM = topFloorM + WALL_H_M;
  const shape: RoofShapeSpec = { profile: mass.profile, ridge, pitch, eaveHeightM, eaveSide: mass.eaveSide };
  return { cells, shape, roomZoneIds: massRoomZoneIds(scene, mass, cells) };
}

/** Éléments `roof` de la scène, DÉRIVÉS des masses authorées (`ArchitectureBody.masses`, #822 — le
 *  legacy `Scene.roofs`/`Roof` a été purgé). Une nappe de toit est TOUJOURS visible (#818, enveloppe
 *  par nature — cf. doc de `buildWalls`) : pas de paramètre `visible` ici, seule `roofOccupied` (allié
 *  dans l'empreinte) régit son cutaway. */
export function buildRoofs(scene: Scene, view?: RoofView): RoofEl[] {
  const out: RoofEl[] = [];
  for (const body of scene.architecture ?? [])
    for (const mass of body.masses) {
      const { cells, shape, roomZoneIds } = resolveMass(scene, mass);
      const simplifiedCourses = cells.size > GROUPED_DETAIL_CELL_THRESHOLD;
      const def = roofMaterial(mass.material);
      const courses = def.detail?.courses?.hM
        ? Math.max(1, Math.round(shape.pitch / def.detail.courses.hM))
        : undefined;
      const eave = { overhang: def.eaveOverhangM ?? 0, fasciaDrop: def.fasciaDropM ?? 0 };
      const sectionCells = [...cells].map((key) => {
        const [x, y] = key.split(',').map(Number);
        return { x, y };
      });
      const geometry = roofPans(cells, mass.material, simplifiedCourses ? 1 : courses, eave, shape);
      for (const pan of geometry.pans ?? []) {
        const panCellsList = panCells(pan.face, sectionCells);
        const minX = Math.min(...panCellsList.map((cell) => cell.x));
        const minY = Math.min(...panCellsList.map((cell) => cell.y));
        const maxX = Math.max(...panCellsList.map((cell) => cell.x));
        const maxY = Math.max(...panCellsList.map((cell) => cell.y));
        out.push({
          kind: 'roof',
          key: `roof:${body.id}:${mass.id}:${pan.id}`,
          bodyId: body.id,
          sectionId: mass.id,
          panId: pan.id,
          roomZoneIds: [...roomZoneIds],
          profile: mass.profile,
          ridge: shape.ridge,
          pitch: shape.pitch,
          eaveHeightM: shape.eaveHeightM,
          ...(simplifiedCourses ? { simplifiedCourses: true } : {}),
          cell: { x: minX, y: minY, z: mass.z },
          span: { w: maxX - minX + 1, h: maxY - minY + 1 },
          cells: panCellsList,
          material: mass.material,
          label: body.label ?? body.style,
          faces: pan.faces,
          lines: pan.lines,
          states: {
            visible: true,
            roofOccupied: !!view?.allies?.some((ally) => panCellsList.some((cell) => cell.x === ally.x && cell.y === ally.y)),
          },
        });
      }
    }
  return out;
}


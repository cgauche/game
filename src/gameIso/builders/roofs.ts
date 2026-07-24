/**
 * BUILDER de TOITS — produit les éléments `roof` du pivot (cf. ./types) en PANS CONTINUS. Le champ de
 * hauteurs par SOMMET de l'ex-`roofFromCells` est conservé (profondeur BFS depuis l'avant-toit × pente,
 * convertie en MÈTRES), mais la nappe n'est plus rendue une quad PAR CELLULE (mosaïque + zigzag de
 * teintes aux faîtes diagonaux — la cause racine identifiée) : les cellules coplanaires ADJACENTES
 * fusionnent en UN polygone de pan, et les cellules-SELLES (non planes, aux arêtiers/noues diagonaux)
 * sont SCINDÉES en 2 triangles le long de la diagonale de crête, chaque triangle rejoignant le pan de
 * son côté → arêtiers nets, UNE teinte par pan. Expose aussi les LIGNES sémantiques (faîte, arêtiers,
 * égout, rangs de tuiles espacés le long de la pente) et les VÉRITÉS DE SCÈNE (visible, roofOccupied —
 * cutaway). PUR et projection-agnostique : géométrie en unités de GRILLE + MÈTRES (`GP`).
 */
import { heightAt, type ArchitectureRect, type Roof, type RoofSection, type Scene } from '../../state/scene';
import { styleRoofMaterial } from '../catalog/buildings';
import { roofMaterial } from '../catalog/roofs';
import { WALL_H_M, isoPxToM } from '../iso';
import type { CellSide, Face, GP, RoofEl, RoofLine, RoofLineKind } from './types';

/** Montée de la nappe par CRAN de profondeur d'avant-toit (17 px-iso), en mètres — une seule
 *  vérité px⇔m (`isoPxToM`). Les rangs de tuiles se comptent PAR cran. */
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

export interface RoofShapeSpec {
  profile: RoofSection['profile'];
  ridge: RoofSection['ridge'];
  pitch: number;
  eaveHeightM: number;
}

export interface RoofPanGeometry {
  id: string;
  face: Face;
  faces: Face[];
  lines: RoofLine[];
}

type VXY = { x: number; y: number };
/** Pièce PLANE du pavage (quad de cellule coplanaire, ou triangle issu d'une selle), sommets en ordre
 *  HORAIRE grille + gradient du plan (montée par +x / +y). */
interface Piece {
  pts: VXY[];
  gx: number;
  gy: number;
}

const vk = (x: number, y: number) => `${x},${y}`;

/** Orientation de la pente DESCENDANTE d'un plan (teinte du pan) — même aiguillage que l'ex-choix
 *  par-cellule (gx>0 : monte vers +x ⇒ descend vers l'ouest ; plat ⇒ 'N', ton historique). */
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

/** PANS CONTINUS + LIGNES d'un toit couvrant `cells` (clés « x,y », forme quelconque), avant-toit à
 *  `base` mètres. CŒUR PUR (testable sur un L) consommé par `buildRoofs` : hauteurs de sommet par BFS
 *  (géométrie historique), pavage en pièces PLANES (quads coplanaires / selles scindées), fusion des
 *  pièces adjacentes de même plan (annulation d'arêtes internes → polygone de bord), classification des
 *  arêtes restantes (égout au bord, faîte/arêtier entre deux pans), rangs de tuiles en courbes de
 *  niveau du plan (`courses` rangs par cran de montée). */
export function roofPans(
  cells: ReadonlySet<string>,
  base: number,
  matId: string,
  courses?: number,
  eave?: EaveSpec,
  shape?: RoofShapeSpec,
): { faces: Face[]; lines: RoofLine[]; pans?: RoofPanGeometry[] } {
  if (!cells.size) return { faces: [], lines: [] };
  const has = (x: number, y: number) => cells.has(vk(x, y));
  const cellCoords = [...cells].map((key) => key.split(',').map(Number) as [number, number]);
  const minCellX = Math.min(...cellCoords.map(([x]) => x));
  const maxCellX = Math.max(...cellCoords.map(([x]) => x)) + 1;
  const minCellY = Math.min(...cellCoords.map(([, y]) => y));
  const maxCellY = Math.max(...cellCoords.map(([, y]) => y)) + 1;

  // ── Hauteur par SOMMET : profondeur BFS depuis l'avant-toit (sommet intérieur = 4 cellules du toit).
  const verts = new Map<string, VXY>();
  for (const k of cells) {
    const [x, y] = k.split(',').map(Number);
    for (const v of [{ x, y }, { x: x + 1, y }, { x, y: y + 1 }, { x: x + 1, y: y + 1 }]) verts.set(vk(v.x, v.y), v);
  }
  const inner = (v: VXY) => has(v.x - 1, v.y - 1) && has(v.x, v.y - 1) && has(v.x - 1, v.y) && has(v.x, v.y);
  const dep = new Map<string, number>();
  const queue: VXY[] = [];
  for (const v of verts.values()) if (!inner(v)) { dep.set(vk(v.x, v.y), 0); queue.push(v); }
  for (let i = 0; i < queue.length; i++) {
    const v = queue[i];
    const d = dep.get(vk(v.x, v.y))!;
    for (const n of [{ x: v.x + 1, y: v.y }, { x: v.x - 1, y: v.y }, { x: v.x, y: v.y + 1 }, { x: v.x, y: v.y - 1 }]) {
      const nk = vk(n.x, n.y);
      if (verts.has(nk) && !dep.has(nk)) { dep.set(nk, d + 1); queue.push(n); }
    }
  }
  const authoredRise = (v: VXY): number => {
    if (!shape || shape.profile === 'flat') return 0;
    if (shape.profile === 'shed')
      return (shape.ridge === 'x' ? maxCellY - v.y : maxCellX - v.x) * shape.pitch;
    const cross = shape.ridge === 'x'
      ? Math.min(v.y - minCellY, maxCellY - v.y)
      : Math.min(v.x - minCellX, maxCellX - v.x);
    if (shape.profile === 'gable') return cross * shape.pitch;
    const along = shape.ridge === 'x'
      ? Math.min(v.x - minCellX, maxCellX - v.x)
      : Math.min(v.y - minCellY, maxCellY - v.y);
    return Math.min(cross, along) * shape.pitch;
  };
  const hV = (v: VXY): number => shape
    ? shape.eaveHeightM + authoredRise(v)
    : base + (dep.get(vk(v.x, v.y)) ?? 0) * ROOF_SLOPE_M;
  const withH = (v: VXY) => ({ ...v, h: hV(v) });

  // ── Pavage en pièces PLANES : quad si la cellule est plane (h_TL + h_BR = h_TR + h_BL), sinon
  //    CELLULE-SELLE scindée le long de la diagonale de CRÊTE — celle au plus grand écart de hauteur
  //    (elle relie le coin bas à la pointe haute : l'arêtier/la noue) ; chaque triangle est plan.
  const pieces: Piece[] = [];
  for (const k of cells) {
    const [x, y] = k.split(',').map(Number);
    const TL = withH({ x, y }), TR = withH({ x: x + 1, y }), BR = withH({ x: x + 1, y: y + 1 }), BL = withH({ x, y: y + 1 });
    if (Math.abs(TL.h + BR.h - TR.h - BL.h) < EPS) {
      pieces.push({ pts: [TL, TR, BR, BL], gx: TR.h - TL.h, gy: BL.h - TL.h });
    } else {
      const tris = Math.abs(TL.h - BR.h) >= Math.abs(TR.h - BL.h)
        ? [[TL, TR, BR], [TL, BR, BL]]
        : [[TL, TR, BL], [TR, BR, BL]];
      for (const t of tris) pieces.push({ pts: t, ...grad3(t[0], t[1], t[2]) });
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
      const step = (shape?.pitch ?? ROOF_SLOPE_M) / courses;
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

/** Vérité de JEU pilotant le cutaway (PAS une caméra) : positions des ALLIÉS — un toit dont l'empreinte
 *  est occupée est levé (`roofOccupied`, ex-`roofHidden` d'IsoStage). */
export interface RoofView {
  allies?: { x: number; y: number }[];
}

function rectCells(foot: ArchitectureRect): { x: number; y: number }[] {
  const cells: { x: number; y: number }[] = [];
  for (let y = foot.y; y < foot.y + foot.h; y++)
    for (let x = foot.x; x < foot.x + foot.w; x++) cells.push({ x, y });
  return cells;
}

function panCells(face: Face, foot: ArchitectureRect): { x: number; y: number }[] {
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
  const all = rectCells(foot);
  const selected = all.filter((cell) => inside(cell.x, cell.y));
  if (selected.length) return selected;
  const cx = face.poly.reduce((sum, point) => sum + point.x, 0) / face.poly.length;
  const cy = face.poly.reduce((sum, point) => sum + point.y, 0) / face.poly.length;
  return [[...all].sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy))[0]];
}

function isVisible(cells: { x: number; y: number }[], z: number, visible?: ReadonlySet<string>): boolean {
  if (!visible) return true;
  for (const cell of cells)
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++)
        if (visible.has(`${cell.x + dx},${cell.y + dy},${z}`)) return true;
  return false;
}

function buildAuthoredRoofs(scene: Scene, visible?: ReadonlySet<string>, view?: RoofView): RoofEl[] {
  const out: RoofEl[] = [];
  for (const body of scene.architecture ?? [])
    for (const section of body.roofs) {
      const sectionCells = rectCells(section.foot);
      const cellSet = new Set(sectionCells.map((cell) => vk(cell.x, cell.y)));
      const def = roofMaterial(section.material);
      const geometry = roofPans(
        cellSet,
        section.eaveHeightM,
        section.material,
        def.detail?.courses?.hM
          ? Math.max(1, Math.round(section.pitch / def.detail.courses.hM))
          : undefined,
        { overhang: def.eaveOverhangM ?? 0, fasciaDrop: def.fasciaDropM ?? 0 },
        section,
      );
      for (const pan of geometry.pans ?? []) {
        const cells = panCells(pan.face, section.foot);
        const minX = Math.min(...cells.map((cell) => cell.x));
        const minY = Math.min(...cells.map((cell) => cell.y));
        const maxX = Math.max(...cells.map((cell) => cell.x));
        const maxY = Math.max(...cells.map((cell) => cell.y));
        out.push({
          kind: 'roof',
          key: `roof:${body.id}:${section.id}:${pan.id}`,
          bodyId: body.id,
          sectionId: section.id,
          panId: pan.id,
          roomZoneIds: [...section.roomZoneIds],
          profile: section.profile,
          ridge: section.ridge,
          pitch: section.pitch,
          eaveHeightM: section.eaveHeightM,
          cell: { x: minX, y: minY, z: section.z },
          span: { w: maxX - minX + 1, h: maxY - minY + 1 },
          cells,
          material: section.material,
          label: body.label ?? body.style,
          faces: pan.faces,
          lines: pan.lines,
          states: {
            visible: isVisible(cells, section.z, visible),
            roofOccupied: !!view?.allies?.some((ally) => cells.some((cell) => cell.x === ally.x && cell.y === ally.y)),
          },
        });
      }
    }
  return out;
}

const GROUPED_DETAIL_CELL_THRESHOLD = 64;

/** Éléments `roof` de la scène : les rectangles compatibles d'un même `groupId` sont réunis puis scindés
 *  en composantes 4-connexes exactes. Sans groupe, un rectangle reste un élément. */
export function buildRoofs(scene: Scene, visible?: ReadonlySet<string>, view?: RoofView): RoofEl[] {
  interface Candidate {
    roof: Roof;
    order: number;
    z: number;
    cells: Set<string>;
    legacyBase: number;
    material: string;
  }
  interface Batch {
    order: number;
    candidates: Candidate[];
  }

  const candidates: Candidate[] = (scene.roofs ?? []).map((roof, order) => {
    const z = roof.z ?? 0;
    const f = roof.foot;
    const cells = new Set<string>();
    const heights: number[] = [];
    for (let dy = 0; dy < f.h; dy++)
      for (let dx = 0; dx < f.w; dx++) {
        cells.add(vk(f.x + dx, f.y + dy));
        heights.push(heightAt(scene, f.x + dx, f.y + dy, z));
      }
    const legacyBase = Math.max(0, ...heights) + WALL_H_M;
    const material = roof.params?.roofMaterial ?? styleRoofMaterial(roof.style);
    return { roof, order, z, cells, legacyBase, material };
  });

  const batches: Batch[] = [];
  const grouped = new Map<string, Batch>();
  for (const candidate of candidates) {
    if (!candidate.roof.groupId) {
      batches.push({ order: candidate.order, candidates: [candidate] });
      continue;
    }
    const key = JSON.stringify([
      candidate.roof.groupId,
      candidate.z,
      candidate.roof.style,
      candidate.material,
    ]);
    let batch = grouped.get(key);
    if (!batch) {
      batch = { order: candidate.order, candidates: [] };
      grouped.set(key, batch);
      batches.push(batch);
    }
    batch.candidates.push(candidate);
  }
  batches.sort((a, b) => a.order - b.order);

  const compareKeys = (a: string, b: string) => {
    const [ax, ay] = a.split(',').map(Number);
    const [bx, by] = b.split(',').map(Number);
    return ay - by || ax - bx;
  };
  const componentsOf = (cells: ReadonlySet<string>): Set<string>[] => {
    const remaining = new Set(cells);
    const components: Set<string>[] = [];
    while (remaining.size) {
      const start = [...remaining].sort(compareKeys)[0];
      remaining.delete(start);
      const component = new Set<string>([start]);
      const queue = [start];
      for (let i = 0; i < queue.length; i++) {
        const [x, y] = queue[i].split(',').map(Number);
        for (const next of [vk(x - 1, y), vk(x + 1, y), vk(x, y - 1), vk(x, y + 1)]) {
          if (!remaining.delete(next)) continue;
          component.add(next);
          queue.push(next);
        }
      }
      components.push(component);
    }
    return components;
  };

  const out: RoofEl[] = buildAuthoredRoofs(scene, visible, view);
  for (const batch of batches) {
    const first = batch.candidates[0];
    const union = new Set(batch.candidates.flatMap((candidate) => [...candidate.cells]));
    const components = first.roof.groupId ? componentsOf(union) : [union];
    for (let componentIndex = 0; componentIndex < components.length; componentIndex++) {
      const component = components[componentIndex];
      const exactCells = [...component].sort(compareKeys).map((key) => {
        const [x, y] = key.split(',').map(Number);
        return { x, y };
      });
      const minX = Math.min(...exactCells.map((cell) => cell.x));
      const minY = Math.min(...exactCells.map((cell) => cell.y));
      const maxX = Math.max(...exactCells.map((cell) => cell.x));
      const maxY = Math.max(...exactCells.map((cell) => cell.y));
      const f = { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
      const { roof, z, material } = first;
      const base = roof.groupId
        ? Math.min(...exactCells.map((cell) => heightAt(scene, cell.x, cell.y, z))) + WALL_H_M
        : first.legacyBase;
      const simplifiedCourses = !!roof.groupId && component.size > GROUPED_DETAIL_CELL_THRESHOLD;
      const def = roofMaterial(material);
      const legacyShape: RoofShapeSpec = {
        profile: 'hip',
        ridge: f.w >= f.h ? 'x' : 'y',
        pitch: ROOF_SLOPE_M,
        eaveHeightM: base,
      };
      const { faces, lines } = roofPans(component, base, material, simplifiedCourses ? 1 : roofCoursesPerStep(def.detail), {
        overhang: def.eaveOverhangM ?? 0,
        fasciaDrop: def.fasciaDropM ?? 0,
      }, legacyShape);
      let vis = !visible;
      if (visible)
        for (const cell of exactCells)
          for (let dy = -1; dy <= 1 && !vis; dy++)
            for (let dx = -1; dx <= 1 && !vis; dx++)
              if (visible.has(`${cell.x + dx},${cell.y + dy},${z}`)) vis = true;
      const occupied = !!view?.allies?.some((ally) => component.has(vk(ally.x, ally.y)));
      const key = roof.groupId
        ? `roof:${roof.groupId}:z${z}:${roof.style}:${material}:h${base}:${componentIndex}`
        : `roof:${roof.id}`;
      out.push({
        kind: 'roof',
        key,
        cell: { x: f.x, y: f.y, z },
        span: { w: f.w, h: f.h },
        cells: exactCells,
        material,
        profile: legacyShape.profile,
        ridge: legacyShape.ridge,
        pitch: legacyShape.pitch,
        eaveHeightM: legacyShape.eaveHeightM,
        ...(simplifiedCourses ? { simplifiedCourses: true } : {}),
        label: roof.label || roof.style || '?',
        faces,
        lines,
        states: { visible: vis, roofOccupied: occupied },
      });
    }
  }
  return out;
}

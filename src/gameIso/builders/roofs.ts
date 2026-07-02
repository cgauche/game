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
import { heightAt, type Scene } from '../../state/scene';
import { roofHidden } from '../../state/buildings';
import { styleRoofMaterial } from '../catalog/buildings';
import { roofMaterial } from '../catalog/roofs';
import { WALL_H_M, isoPxToM } from '../iso';
import type { CellSide, Face, RoofEl, RoofLine, RoofLineKind } from './types';

/** Montée de la nappe par CRAN de profondeur d'avant-toit (ex-SLOPE 17 px-iso), en mètres — une seule
 *  vérité px⇔m (`isoPxToM`). Les rangs de tuiles (`courses` de la def) se comptent PAR cran. */
export const ROOF_SLOPE_M = isoPxToM(17);

const EPS = 1e-9;

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
export function roofPans(cells: ReadonlySet<string>, base: number, matId: string, courses?: number): { faces: Face[]; lines: RoofLine[] } {
  if (!cells.size) return { faces: [], lines: [] };
  const has = (x: number, y: number) => cells.has(vk(x, y));

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
  const hV = (v: VXY): number => base + (dep.get(vk(v.x, v.y)) ?? 0) * ROOF_SLOPE_M;
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
      faces.push({ poly: loop.map(toGP), plane: 'slope', material: { domain: 'roof', id: matId, part } });

    // RANGS de tuiles : courbes de niveau du plan du pan, `courses` rangs par cran de montée, décalées
    // d'un demi-pas (jamais sur un sommet → intersections franches), clippées au(x) bord(s) du pan.
    if (courses && courses > 0 && (Math.abs(gx) > EPS || Math.abs(gy) > EPS)) {
      let hMin = Infinity, hMax = -Infinity;
      for (const loop of loops) for (const v of loop) { const h = hV(v); hMin = Math.min(hMin, h); hMax = Math.max(hMax, h); }
      const step = ROOF_SLOPE_M / courses;
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
  for (const r of rangs)
    lines.push({ a: { x: r.a.x - 0.5, y: r.a.y - 0.5, h: r.h0 }, b: { x: r.b.x - 0.5, y: r.b.y - 0.5, h: r.h1 }, kind: r.kind });
  return { faces, lines };
}

/** Vérité de JEU pilotant le cutaway (PAS une caméra) : positions des ALLIÉS — un toit dont l'empreinte
 *  est occupée est levé (`roofOccupied`, ex-`roofHidden` d'IsoStage). */
export interface RoofView {
  allies?: { x: number; y: number }[];
}

/** Éléments `roof` de la scène : un `Roof` (empreinte rectangulaire) = UN élément en pans continus,
 *  avant-toit calé sur `WALL_H_M` + la hauteur MÉTRIQUE de la case la plus haute de l'empreinte (le
 *  toit repose sur les murs, qui reposent sur le sol). `visible` absent ⇒ tout visible (éditeur/QC) ;
 *  sinon un toit est VISIBLE si UNE case de l'empreinte ÉLARGIE d'1 est en vue (on voit le bâtiment dès
 *  qu'on est à son pied, jamais son intérieur) — l'ex-scan d'IsoStage. */
export function buildRoofs(scene: Scene, visible?: ReadonlySet<string>, view?: RoofView): RoofEl[] {
  const out: RoofEl[] = [];
  for (const roof of scene.roofs ?? []) {
    const z = roof.z ?? 0;
    const f = roof.foot;
    const cells = new Set<string>();
    let base = 0;
    for (let dy = 0; dy < f.h; dy++)
      for (let dx = 0; dx < f.w; dx++) {
        cells.add(vk(f.x + dx, f.y + dy));
        base = Math.max(base, heightAt(scene, f.x + dx, f.y + dy, z));
      }
    base += WALL_H_M;
    const material = roof.params?.roofMaterial ?? styleRoofMaterial(roof.style);
    const { faces, lines } = roofPans(cells, base, material, roofMaterial(material).courses);
    let vis = !visible;
    if (visible)
      for (let dy = -1; dy <= f.h && !vis; dy++)
        for (let dx = -1; dx <= f.w && !vis; dx++)
          if (visible.has(`${f.x + dx},${f.y + dy},${z}`)) vis = true;
    out.push({
      kind: 'roof',
      key: `roof:${roof.id}`,
      cell: { x: f.x, y: f.y, z },
      span: { w: f.w, h: f.h },
      sortClass: 'roof',
      material,
      label: roof.label || roof.style || '?',
      faces,
      lines,
      states: { visible: vis, roofOccupied: !!view?.allies && roofHidden(roof, view.allies) },
    });
  }
  return out;
}

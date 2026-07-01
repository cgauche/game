import { tileCenter, tileEdge, depth, isSquareView, diamondPath, CELL, LEVEL_H, WALL_H, type Dims } from './iso';
import { heightAt, type Scene, type WallSeg } from '../state/scene';
import { wallApp, type StructureAppearanceDef } from './catalog/structures';
import { shade, SIDE_N, SIDE_LIT, POST_CAP, POST_BASE } from './shade';

export { WALL_H } from './iso';

type P = { cx: number; cy: number };

// Facteurs d'ombrage des détails BOIS — dérivés de la couleur de face (JSON), jamais une couleur en dur.
const OUTLINE = 0.4; // liseré d'arête sombre
const EMBRASURE = 0.19; // fond d'embrasure de porte
const JAMBCAP = 1.25; // chapiteau de jambage clair (repli)
const DOOR_FRAC = 0.52; // ouverture d'une porte bois sans config
// Forme de brèche (pas des couleurs) : hauteur du tas + dentelure + hauteur des moignons de poteau.
const BREACH_H = 0.32, BREACH_M1 = 0.34, BREACH_M2 = 0.62, BREACH_POST_A = 0.7, BREACH_POST_B = 0.55;

/** Les 2 extrémités-écran (au sol) de l'arête. Cardinales N/E via `tileEdge` (rotation cohérente) ;
 *  diagonales `\`/`/` de coin à coin opposé. */
function edgeEnds(w: WallSeg, dims: Dims): [P, P] {
  const z = w.z ?? 0;
  if (w.side === 'N' || w.side === 'E') return tileEdge(w.x, w.y, w.side, dims, z);
  const gc = (gx: number, gy: number) => tileCenter(gx - 0.5, gy - 0.5, dims, z);
  return w.side === '\\' ? [gc(w.x, w.y), gc(w.x + 1, w.y + 1)] : [gc(w.x + 1, w.y), gc(w.x, w.y + 1)];
}

/** Profondeur de tri : MAX sur les deux cases bordant l'arête → le mur reste devant son sol proche aux 4 rotations. */
function wallDepth(w: WallSeg, dims: Dims): number {
  const z = w.z ?? 0;
  const cells: [number, number][] =
    w.side === 'E' ? [[w.x, w.y], [w.x + 1, w.y]]
    : w.side === 'N' ? [[w.x, w.y], [w.x, w.y - 1]]
    : [[w.x, w.y]];
  return Math.max(...cells.map(([cx, cy]) => depth(cx, cy, dims, z))) + 0.45;
}

const slab = (a: P, b: P, h0: number, h1: number) => `${a.cx},${a.cy - h0} ${b.cx},${b.cy - h0} ${b.cx},${b.cy - h1} ${a.cx},${a.cy - h1}`;
const lerpP = (A: P, B: P, t: number): P => ({ cx: A.cx + (B.cx - A.cx) * t, cy: A.cy + (B.cy - A.cy) * t });

/** Montant vertical aux extrémités d'arête (coins pleins + jambages gratuits). Chapiteau/socle ombrés. */
function post(p: P, h: number, app: StructureAppearanceDef): string {
  return `<rect x="${p.cx - 1.9}" y="${p.cy - h}" width="3.8" height="${h}" fill="${app.post}"/>` +
    `<rect x="${p.cx - 1.9}" y="${p.cy - h}" width="3.8" height="2.4" fill="${shade(app.post, POST_CAP)}"/>` +
    `<rect x="${p.cx - 1.9}" y="${p.cy - 3}" width="3.8" height="3" fill="${shade(app.post, POST_BASE)}"/>`;
}

/** Herse (grille) barrant l'ouverture a→b : barreaux verticaux + traverses de fer. */
function portcullis(a: P, b: P, H: number, app: StructureAppearanceDef): string {
  const h = app.door!.herse!;
  const top = H * h.topFrac;
  let g = '';
  for (let i = 0; i <= h.bars; i++) { const p = lerpP(a, b, i / h.bars); g += `<line x1="${p.cx}" y1="${p.cy}" x2="${p.cx}" y2="${p.cy - top}" stroke="${app.band}" stroke-width="1.7"/>`; }
  for (const f of h.traverseFracs) g += `<polygon points="${slab(a, b, top * f, top * f + 2)}" fill="${h.traverseColor}"/>`;
  return g;
}

/** Mur ORDINAIRE (bois) en iso : panneau encadré + moulures + plinthe, ou porte ajourée. Ombré par orientation. */
function houseWallIso(w: WallSeg, a: P, b: P, app: StructureAppearanceDef): string {
  const H = WALL_H;
  const wd = app.wood!;
  const t = (base: string) => shade(base, w.side === 'N' ? SIDE_N : SIDE_LIT);
  const face = t(app.face), inset = t(wd.inset), frame = t(wd.frame), cap = t(wd.cap), skirt = t(wd.skirt);
  const outline = shade(app.face, OUTLINE);

  if (w.door) {
    const dc = app.door;
    const op = H * (dc?.openingFrac ?? DOOR_FRAC);
    const jambC = dc?.jamb ?? app.face;
    const jambCapC = dc?.jambCap ?? shade(app.face, JAMBCAP);
    const jamb = (p: P) =>
      `<rect x="${p.cx - 1.8}" y="${p.cy - op}" width="3.6" height="${op}" fill="${jambC}"/>` +
      `<rect x="${p.cx - 1.8}" y="${p.cy - op}" width="3.6" height="1.8" fill="${jambCapC}"/>`;
    return `<g>${post(a, H, app)}` +
      `<polygon points="${slab(a, b, 0, op)}" fill="${shade(app.face, EMBRASURE)}" opacity="0.42"/>` +
      `<polygon points="${slab(a, b, op, H)}" fill="${face}" stroke="${outline}" stroke-width="0.7"/>` +
      `<polygon points="${slab(a, b, op, op + 4)}" fill="${wd.frame}" stroke="${outline}" stroke-width="0.5"/>` +
      `<polygon points="${slab(a, b, H * 0.86, H)}" fill="${cap}"/>` +
      jamb(a) + jamb(b) +
      `${post(b, H, app)}</g>`;
  }

  const pl = lerpP(a, b, 0.2), pr = lerpP(a, b, 0.8);
  const yLo = 0.2, yHi = 0.78;
  const panel = `${pl.cx},${pl.cy - H * yLo} ${pr.cx},${pr.cy - H * yLo} ${pr.cx},${pr.cy - H * yHi} ${pl.cx},${pl.cy - H * yHi}`;
  return `<g>${post(a, H, app)}` +
    `<polygon points="${slab(a, b, 0, H)}" fill="${face}" stroke="${outline}" stroke-width="0.7"/>` +
    `<polygon points="${panel}" fill="${inset}"/>` +
    `<path d="M${pl.cx},${pl.cy - H * yHi} L${pr.cx},${pr.cy - H * yHi}" stroke="${frame}" stroke-width="1.3" fill="none"/>` +
    `<polygon points="${slab(a, b, 0, H * 0.11)}" fill="${skirt}"/>` +
    `<polygon points="${slab(a, b, H * 0.86, H)}" fill="${cap}"/>` +
    `<polygon points="${slab(a, b, H, H + 4)}" fill="${cap}"/>` +
    `${post(b, H, app)}</g>`;
}

/** Mur de bois ABATTU : tas de gravats laissant la brèche ouverte + moignons de poteau. */
function houseBreach(a: P, b: P, app: StructureAppearanceDef): string {
  const H = WALL_H, hr = H * 0.3, wd = app.wood!;
  const m1 = lerpP(a, b, 0.36), m2 = lerpP(a, b, 0.64);
  return `<g><polygon points="${slab(a, b, 0, hr * 0.5)}" fill="${wd.rubble}"/>` +
    `<polygon points="${a.cx},${a.cy} ${m1.cx},${m1.cy - hr} ${m2.cx},${m2.cy - hr * 0.7} ${b.cx},${b.cy}" fill="${wd.rubbleHi}" stroke="${shade(app.face, OUTLINE)}" stroke-width="0.6"/>` +
    post(a, hr * BREACH_POST_A, app) + post(b, hr * 0.5, app) + `</g>`;
}

/** Vue du DESSUS d'un mur bois : trait épais sur l'arête ; porte = ouverture centrale (deux jambages). */
function topWall(w: WallSeg, a: P, b: P, dims: Dims, app: StructureAppearanceDef): { d: number; svg: string } {
  const seg = (p: P, q: P, width: number, col: string) =>
    `<line x1="${p.cx}" y1="${p.cy}" x2="${q.cx}" y2="${q.cy}" stroke="${col}" stroke-width="${width}" stroke-linecap="round"/>`;
  const svg = w.door
    ? seg(a, lerpP(a, b, 0.3), 7, shade(app.post, POST_CAP)) + seg(lerpP(a, b, 0.7), b, 7, shade(app.post, POST_CAP))
    : seg(a, b, 8, shade(app.face, OUTLINE)) + seg(a, b, 5, app.face);
  return { d: wallDepth(w, dims) + 0.6, svg: `<g>${svg}</g>` };
}

/** Fortification de PIERRE (rempart crénelé / corps de garde à herse), intacte ou en brèche. */
function stoneIso(w: WallSeg, a: P, b: P, dims: Dims, down: boolean, app: StructureAppearanceDef): { d: number; svg: string } {
  const d = wallDepth(w, dims);
  const par = app.parapet!;
  const H = WALL_H, P = LEVEL_H * par.heightLevelFrac;
  const merlons = () => {
    let m = '';
    for (let i = 0; i < par.merlonCount; i += par.merlonStep) {
      const p0 = lerpP(a, b, i / par.merlonCount), p1 = lerpP(a, b, (i + 1) / par.merlonCount);
      const y = H + P, yh = y + par.merlonHeightPx;
      m += `<polygon points="${p0.cx},${p0.cy - y} ${p1.cx},${p1.cy - y} ${p1.cx},${p1.cy - yh} ${p0.cx},${p0.cy - yh}" fill="${app.cap}"/>`;
    }
    return m;
  };
  const parapet =
    `<polygon points="${slab(a, b, H, H + P)}" fill="${app.face}" stroke="${app.band}" stroke-width="0.8"/>` +
    `<polygon points="${slab(a, b, H + P * par.parapetBandFrac, H + P * par.parapetBandFrac + par.bandThickPx)}" fill="${app.band}"/>` +
    `<polygon points="${slab(a, b, H + P - par.arasePx, H + P)}" fill="${app.cap}"/>` +
    merlons();

  // CORPS DE GARDE (porte fortifiée) : ouverture béante barrée d'une herse (intacte) ou seuil d'éboulis (abattu).
  if (app.door) {
    const lintel = `<polygon points="${slab(a, b, H - app.door.lintelPx, H)}" fill="${app.face}" stroke="${app.band}" stroke-width="0.8"/>`;
    const bars = down ? `<polygon points="${slab(a, b, 0, H * 0.12)}" fill="${app.rubble}"/>` : portcullis(a, b, H, app);
    return { d, svg: `<g>${bars}${lintel}${parapet}</g>` };
  }
  if (down) {
    const hr = H * BREACH_H;
    const m1 = lerpP(a, b, BREACH_M1), m2 = lerpP(a, b, BREACH_M2);
    return {
      d,
      svg: `<g><polygon points="${slab(a, b, 0, hr * 0.5)}" fill="${app.rubble}"/>` +
        `<polygon points="${a.cx},${a.cy} ${m1.cx},${m1.cy - hr} ${m2.cx},${m2.cy - hr * 0.7} ${b.cx},${b.cy}" fill="${app.rubbleHi}" stroke="${app.band}" stroke-width="0.6"/>` +
        post(a, hr * BREACH_POST_A, app) + post(b, hr * BREACH_POST_B, app) + `</g>`,
    };
  }
  // COURTINE INTACTE : face pierre ferrée + parapet crénelé.
  const bands = par.bands.map((t) => `<polygon points="${slab(a, b, H * t, H * t + par.bandThickPx)}" fill="${app.band}"/>`).join('');
  return {
    d,
    svg: `<g>${post(a, H + P, app)}` +
      `<polygon points="${slab(a, b, 0, H)}" fill="${app.face}" stroke="${app.band}" stroke-width="0.8"/>` +
      bands + parapet + `${post(b, H + P, app)}</g>`,
  };
}

/** Vue du DESSUS d'une fortification : trait de courtine, ou bloc de corps de garde barré. */
function stoneSquare(w: WallSeg, a: P, b: P, dims: Dims, down: boolean, app: StructureAppearanceDef): { d: number; svg: string } {
  const d = wallDepth(w, dims) + 0.6;
  const line = (col: string, width: number, dash?: string) =>
    `<line x1="${a.cx}" y1="${a.cy}" x2="${b.cx}" y2="${b.cy}" stroke="${col}" stroke-width="${width}" stroke-linecap="round"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
  if (down) return { d, svg: `<g>${line(app.rubble!, 6, '3 5')}</g>` };
  if (app.door) {
    const { cx: px, cy: py } = tileCenter(w.x, w.y, dims);
    const h = CELL / 2;
    let glyph = `<rect x="${px - h * 0.46}" y="${py - h}" width="${h * 0.92}" height="${2 * h}" fill="${app.recess}"/>`;
    for (let i = 1; i <= 3; i++) { const ly = py - h + 2 * h * (i / 4); glyph += `<line x1="${px - h * 0.46}" y1="${ly}" x2="${px + h * 0.46}" y2="${ly}" stroke="${app.cap}" stroke-width="1.6"/>`; }
    return { d, svg: `<g><path d="${diamondPath(w.x, w.y, dims)}" fill="${app.face}" stroke="${app.band}" stroke-width="2.5"/>${glyph}</g>` };
  }
  return { d, svg: `<g>${line(app.band!, 11) + line(app.face, 7)}</g>` };
}

/** SVG d'un segment de mur + sa profondeur. Apparence 100 % DONNÉE (`wallApp` : structure, rempart si
 *  surélevé, sinon mur nu) : parapet/porte/matériau routés par les CHAMPS de la def, jamais par un id/type. */
export function wallSeg(w: WallSeg, dims: Dims, structDown: boolean, baseH: number): { d: number; svg: string } {
  const [a, b] = edgeEnds(w, dims);
  const app = wallApp(w, baseH);
  const square = isSquareView(dims.view);
  if (app.parapet) return square ? stoneSquare(w, a, b, dims, structDown, app) : stoneIso(w, a, b, dims, structDown, app);
  if (square) {
    if (structDown) return { d: wallDepth(w, dims) + 0.6, svg: `<g><line x1="${a.cx}" y1="${a.cy}" x2="${b.cx}" y2="${b.cy}" stroke="${app.face}" stroke-width="5" stroke-linecap="round" stroke-dasharray="3 5"/></g>` };
    return topWall(w, a, b, dims, app);
  }
  return { d: wallDepth(w, dims), svg: structDown ? houseBreach(a, b, app) : houseWallIso(w, a, b, app) };
}

/** Tous les segments de mur de la scène, prêts pour le tri de profondeur. */
export function wallSegs(scene: Scene, dims: Dims): { d: number; svg: string }[] {
  return (scene.walls ?? []).map((w) => wallSeg(w, dims, false, heightAt(scene, w.x, w.y, w.z ?? 0)));
}

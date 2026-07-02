/**
 * DÉTAIL de surface des backends ÉCRAN-AFFINES (matériaux v2 « dessiné main ») — consomme les
 * `DetailRecipe` (Lot 0) portées par les defs d'apparence (structure/relief/terrain).
 *
 * Règle structurante « pattern = structure, fill = couleur » : la face pose son FILL plein (teintable
 * nuit/estompe/brume), puis (a) un `<pattern userSpaceOnUse>` par (recette × ORIENTATION d'arête × plan)
 * ne dessine QUE les joints sur fond transparent — en affine, toutes les faces d'une même orientation
 * partagent le même vecteur d'arête écran → `patternTransform` CONSTANT, pattern PARTAGÉ par toute la
 * carte ; (b) des ACCENTS seedés (blocs nuancés alignés sur l'appareillage, mouchetis, touffes) sont
 * fusionnés en UN `<path>` multi-sous-chemins PAR FACE et PAR COULEUR. Anti-périodicité : `N_VARIANTS`
 * motifs pré-seedés par recette, choisis par hash(x,y[,side]) ; le seed d'un accent est TOUJOURS dérivé
 * de l'identité MONDE (`hash32(kind, x, y, z, side?)` selon `seedScope`) — jamais stocké.
 *
 * LOD par zoom : < 0.5 fills plats (rendu historique) ; < 0.7 motifs seuls ; ≥ 0.7 motifs + accents.
 * Toute couleur vient de la recette (donnée) ou dérive du fill par `shade` — aucun littéral ici.
 */
import { hash32, seedStream } from '../detail/hash';
import { expandRecipe } from '../detail/expand';
import type { DetailRecipe } from '../detail/types';
import { shade } from '../shade';
import { LEVEL_H, isSquareView, type Dims } from '../iso';
import { METRES_PER_LEVEL } from '../../state/relief';
import { TERRAIN_DEFS } from '../../state/terrain';
import { structureAppearances, reliefMaterials } from '../../data';
import { projGP, type Pt2 } from './project';
import type { GP } from '../builders/types';

// ── LOD ──────────────────────────────────────────────────────────────────────────────────────────────
export type Lod = 0 | 1 | 2;
/** Palier de détail selon le zoom : 0 = fills plats, 1 = motifs (joints), 2 = motifs + accents. */
export const lodOf = (zoom: number): Lod => (zoom < 0.5 ? 0 : zoom < 0.7 ? 1 : 2);
/** Zoom REPRÉSENTATIF de chaque palier : les memos des stages dépendent du PALIER (pas du zoom
 *  continu) et passent ce zoom-là aux backends — un coup de molette dans le même palier ne rebâtit rien. */
export const LOD_ZOOM: readonly [number, number, number] = [0.4, 0.6, 1];

/** Options de rendu des backends affines : `zoom` pilote le LOD, `mpt` = mètres par case de la scène
 *  (échelle des recettes métriques). Absents ⇒ plein détail à l'échelle RAW (QC, scripts). */
export interface DetailOpts { zoom?: number; mpt?: number }
export const detailOf = (opts?: DetailOpts): { lod: Lod; mpt: number } => ({ lod: lodOf(opts?.zoom ?? 1), mpt: opts?.mpt ?? 2 });

// ── Constantes du motif ──────────────────────────────────────────────────────────────────────────────
/** px écran par MÈTRE d'élévation (vérité partagée : LEVEL_H px ⇔ METRES_PER_LEVEL m). */
const PX_PER_M_V = LEVEL_H / METRES_PER_LEVEL;
/** Variantes pré-seedées par recette (anti-périodicité, choisies par hash du monde). */
const N_VARIANTS = 3;
/** Variantes de dégradé de terrain (variance de teinte par tuile) : étalement des facteurs de shade. */
const TINT_SPREAD = [-1, -0.4, 0.35, 1];
/** Fraction des blocs recevant un accent clair / sombre (~2×18 % de l'appareillage). */
const ACCENT_FRAC = 0.18;
/** Retrait (m) d'un bloc d'accent — laisse respirer les joints du motif dessiné PAR-DESSOUS. */
const BLOCK_INSET_M = 0.05;

const n2 = (v: number) => String(Math.round(v * 100) / 100);
const n3 = (v: number) => String(Math.round(v * 1000) / 1000);

// ── Orientations d'arête (la rotation caméra vit dans dims, résolue par projGP) ─────────────────────
type Axis = 'x' | 'y' | 'd' | 'a';
const AXES: Axis[] = ['x', 'y', 'd', 'a'];
const AXIS_OF: Record<string, Axis> = { N: 'x', S: 'x', E: 'y', O: 'y', '\\': 'd', '/': 'a' };
/** Arête UNITÉ de chaque axe (coins de grille) — son vecteur écran par MÈTRE cale le motif. */
const AXIS_EDGE: Record<Axis, [GP, GP]> = {
  x: [{ x: -0.5, y: -0.5, h: 0 }, { x: 0.5, y: -0.5, h: 0 }],
  y: [{ x: -0.5, y: -0.5, h: 0 }, { x: -0.5, y: 0.5, h: 0 }],
  d: [{ x: -0.5, y: -0.5, h: 0 }, { x: 0.5, y: 0.5, h: 0 }],
  a: [{ x: 0.5, y: -0.5, h: 0 }, { x: -0.5, y: 0.5, h: 0 }],
};

/** Vecteur ÉCRAN d'1 MÈTRE le long d'une arête de l'axe (l'arête diagonale mesure √2 cases). */
function axisMetreVec(axis: Axis, dims: Dims, mpt: number): Pt2 {
  const [A, B] = AXIS_EDGE[axis];
  const a = projGP(A, dims);
  const b = projGP(B, dims);
  const len = (axis === 'd' || axis === 'a' ? Math.SQRT2 : 1) * mpt;
  return [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
}
/** Face de CHANT (arête quasi parallèle à la verticale écran, ex. murs E en edge-on) : motif dégénéré. */
const degenerate = (eu: Pt2): boolean => Math.abs(eu[0]) < 0.5;

// ── Recettes d'appareillage disponibles (structure + relief), dédupliquées par CONTENU ───────────────
type Courses = NonNullable<DetailRecipe['courses']>;
/** Clé de contenu d'une recette d'assises — nomme les motifs partagés (`dt-<clé>-<proj>-<axe><variante>`). */
const coursesKey = (c: Courses): string => hash32(JSON.stringify(c)).toString(36);
/** Étiquette de PROJECTION dans l'id du motif : son `patternTransform` dépend de la rotation/vue —
 *  une planche QC qui juxtapose plusieurs projections dans UN document SVG ne collisionne pas. */
const projTag = (dims: Dims): string => (isSquareView(dims.view) ? 'top' : `${dims.rot ?? 0}${dims.edge ? 'e' : ''}`);
const patternId = (key: string, axis: Axis, variant: number, dims: Dims): string => `dt-${key}-${projTag(dims)}-${axis}${variant}`;

/** Largeur de PÉRIODE du motif (m) : ~4 blocs moyens (assez large pour casser la répétition à l'œil). */
const patternWM = (c: Courses): number => (c.blockWM ? Math.max(1.6, 2 * (c.blockWM[0] + c.blockWM[1])) : 2);

/** Bornes des joints VERTICAUX d'un rang du motif périodique (positions en mètres dans ]0,W[), par
 *  PARITÉ de rang — PARTAGÉES par le motif (joints) et les accents (blocs nuancés ALIGNÉS dessus).
 *  Aucun joint au bord de période (0/W) : le bloc y chevauche la couture → périodicité invisible. */
function rowBoundaries(c: Courses, key: string, variant: number, parity: 0 | 1): number[] {
  if (!c.blockWM) return [];
  const [wMin, wMax] = c.blockWM;
  const mean = (wMin + wMax) / 2;
  const W = patternWM(c);
  const r = seedStream(hash32('dtblocks', key, variant, parity));
  const out: number[] = [];
  let u = parity === 1 ? -(c.stagger ?? 0) * mean : 0;
  for (;;) {
    u += wMin + r() * (wMax - wMin);
    if (u >= W - 0.05) return out;
    if (u > 0.05) out.push(u);
  }
}

/** Un motif d'appareillage pré-seedé : joints horizontaux tremblés (ancrés à 0 aux coutures) + joints
 *  verticaux par parité de rang, en MÈTRES — le `patternTransform` (base [eu | (0, PX_PER_M_V)]) le
 *  projette en écran pour l'orientation donnée. UN SEUL `<path>` par motif. */
function coursesPatternDef(c: Courses, key: string, axis: Axis, eu: Pt2, variant: number, dims: Dims): string {
  const W = patternWM(c);
  const r = seedStream(hash32('dtpat', key, variant));
  const wob = c.edgeWobble ?? 0;
  let d = '';
  for (const y0 of [0, c.hM]) {
    const SEG = 8;
    d += `M0,${n3(y0)}`;
    for (let i = 1; i <= SEG; i++) {
      const dy = i === SEG ? 0 : (r() * 2 - 1) * wob;
      d += `L${n3((W * i) / SEG)},${n3(y0 + dy)}`;
    }
  }
  for (const parity of [0, 1] as const) {
    const y0 = parity * c.hM;
    for (const b of rowBoundaries(c, key, variant, parity)) d += `M${n3(b)},${n3(y0)}L${n3(b)},${n3(y0 + c.hM)}`;
  }
  return (
    `<pattern id="${patternId(key, axis, variant, dims)}" patternUnits="userSpaceOnUse" width="${n3(W)}" height="${n3(2 * c.hM)}"` +
    ` patternTransform="matrix(${n3(eu[0])} ${n3(eu[1])} 0 ${PX_PER_M_V} 0 0)">` +
    `<path d="${d}" fill="none" stroke="${c.joint}" stroke-width="${n3(c.jointW)}" stroke-linecap="round" opacity="0.85"/>` +
    `</pattern>`
  );
}

/** Recettes d'assises à motifs : toutes les defs de STRUCTURE et de RELIEF qui en portent une. */
function coursesRecipes(): Map<string, Courses> {
  const out = new Map<string, Courses>();
  for (const def of [...structureAppearances, ...reliefMaterials]) {
    const c = def.detail?.courses;
    if (c) out.set(coursesKey(c), c);
  }
  return out;
}

/** DEFS des matériaux v2 pour la projection courante : variantes de dégradé de terrain (variance de
 *  teinte par tuile) + motifs d'appareillage par (recette × orientation × variante). À joindre aux
 *  `<defs>` de tout stage/panneau affine dès que le LOD ≥ 1. */
export function detailPatternDefs(dims: Dims, mpt: number): string {
  let out = '';
  const seenG = new Set<string>();
  for (const t of TERRAIN_DEFS) {
    if (!t.detail?.tintVar || seenG.has(t.gradient)) continue;
    seenG.add(t.gradient);
    for (let k = 0; k < TINT_SPREAD.length; k++) {
      const f = 1 + t.detail.tintVar * TINT_SPREAD[k];
      const stops = t.stops.map((s) => `<stop offset="${s.off}" stop-color="${shade(s.color, f)}"/>`).join('');
      out += `<linearGradient id="${t.gradient}-v${k}" x1="0" y1="0" x2="0" y2="1">${stops}</linearGradient>`;
    }
  }
  if (isSquareView(dims.view)) return out; // vue du dessus : aucune face verticale → pas de motifs
  for (const [key, c] of coursesRecipes()) {
    for (const axis of AXES) {
      const eu = axisMetreVec(axis, dims, mpt);
      if (degenerate(eu)) continue;
      for (let v = 0; v < N_VARIANTS; v++) out += coursesPatternDef(c, key, axis, eu, v, dims);
    }
  }
  return out;
}

// ── Sol : variance de teinte par tuile (variante de dégradé choisie au hash du monde) ────────────────
const TERRAIN_BY_ID = new Map(TERRAIN_DEFS.map((t) => [t.id, t]));

/** Id du dégradé de SOL d'une tuile : variante nuancée si la recette du terrain porte `tintVar` (et
 *  LOD ≥ 1), sinon le dégradé de base — le fill reste 1 nœud, la variance est GRATUITE. */
export function terrainFillGradient(terrainId: string, cell: { x: number; y: number; z: number }, lod: Lod): string | null {
  const t = TERRAIN_BY_ID.get(terrainId);
  if (!t) return null;
  if (lod >= 1 && t.detail?.tintVar) return `${t.gradient}-v${hash32('tint', cell.x, cell.y, cell.z) % TINT_SPREAD.length}`;
  return t.gradient;
}

// ── Faces VERTICALES (murs, falaises) : motif partagé + accents alignés ──────────────────────────────
/** Contexte d'une face verticale porteuse de détail. `quad` = [haut-A, haut-B, bas-B, bas-A] écran ;
 *  `base` = fill DÉJÀ teinté de la face (les nuances de bloc en dérivent par `shade`) ; `reservedV` =
 *  intervalles [haut,bas] en MÈTRES depuis le HAUT de la face déjà occupés par un ornement PAR-DESSUS
 *  la maçonnerie (ferrures/bandes) — les accents s'y refusent (une nuance de pierre passe SOUS la ferrure). */
export interface VerticalFaceCtx {
  recipe: DetailRecipe;
  side: string;
  cell: { x: number; y: number; z: number };
  quad: Pt2[];
  faceWM: number;
  faceHM: number;
  base: string;
  seed: number;
  dims: Dims;
  mpt: number;
  reservedV?: [number, number][];
}

/** Soustrait les intervalles réservés d'un segment vertical [v0,v1] (mètres depuis le haut de face). */
function subtractReserved(v0: number, v1: number, reserved: [number, number][]): [number, number][] {
  let spans: [number, number][] = [[v0, v1]];
  for (const [r0, r1] of reserved) {
    const next: [number, number][] = [];
    for (const [a, b] of spans) {
      if (r1 <= a || r0 >= b) { next.push([a, b]); continue; }
      if (r0 > a) next.push([a, r0]);
      if (r1 < b) next.push([r1, b]);
    }
    spans = next;
  }
  return spans.filter(([a, b]) => b - a >= 0.08);
}

/** Variante de motif d'une face — hash de l'identité monde (x, y, côté). */
const variantOf = (cell: { x: number; y: number }, side: string): number => hash32('dtvar', cell.x, cell.y, side) % N_VARIANTS;

/** Surcouche de STRUCTURE d'une face verticale : le polygone de la face rempli du motif de joints
 *  partagé de son orientation. '' si la recette n'a pas d'assises ou si la face est de chant. */
export function coursesOverlaySvg(ctx: Pick<VerticalFaceCtx, 'recipe' | 'side' | 'cell' | 'quad' | 'dims' | 'mpt'>): string {
  const c = ctx.recipe.courses;
  const axis = AXIS_OF[ctx.side];
  if (!c || !axis || isSquareView(ctx.dims.view)) return '';
  if (degenerate(axisMetreVec(axis, ctx.dims, ctx.mpt))) return '';
  const id = patternId(coursesKey(c), axis, variantOf(ctx.cell, ctx.side), ctx.dims);
  return `<polygon points="${ctx.quad.map((p) => `${n2(p[0])},${n2(p[1])}`).join(' ')}" fill="url(#${id})"/>`;
}

/** Interpolation UV → écran d'un parallélogramme [tl,tr,br,bl] (u le long du haut, v vers le bas). */
const uvPoint = (quad: Pt2[], u: number, v: number): Pt2 => {
  const [tl, tr, , bl] = quad;
  return [tl[0] + u * (tr[0] - tl[0]) + v * (bl[0] - tl[0]), tl[1] + u * (tr[1] - tl[1]) + v * (bl[1] - tl[1])];
};

/** Petit losange « caillou » (sous-chemin) centré en `p`, rayon px. */
const dotSub = (p: Pt2, r: number): string =>
  `M${n2(p[0])},${n2(p[1] - r)}L${n2(p[0] + r * 1.2)},${n2(p[1])}L${n2(p[0])},${n2(p[1] + r * 0.8)}L${n2(p[0] - r * 1.1)},${n2(p[1])}Z`;

/** ACCENTS d'une face verticale (LOD 2) : blocs nuancés ALIGNÉS sur l'appareillage du motif (mêmes
 *  bornes de rangs/joints, énumérés en espace MOTIF via la base inverse) + mouchetis d'usure (UV de
 *  l'expansion, tassés au pied par `vBias`). Sortie : UN `<path>` par couleur. */
export function verticalAccentsSvg(ctx: VerticalFaceCtx): string {
  const c = ctx.recipe.courses;
  const axis = AXIS_OF[ctx.side];
  if (!axis || isSquareView(ctx.dims.view)) return '';
  const eu = axisMetreVec(axis, ctx.dims, ctx.mpt);
  if (degenerate(eu)) return '';
  let out = '';

  if (c?.blockWM && c.paletteVar) {
    // Espace MOTIF (mètres) : p_motif = M⁻¹·p_écran avec M = [eu | (0, PX_PER_M_V)] (sans translation).
    const inv = (p: Pt2): Pt2 => [p[0] / eu[0], (p[1] - (eu[1] * p[0]) / eu[0]) / PX_PER_M_V];
    const fwd = (pu: number, pv: number): Pt2 => [eu[0] * pu, eu[1] * pu + PX_PER_M_V * pv];
    const [tl, tr, , bl] = ctx.quad;
    const a = inv(tl), b = inv(tr);
    const pu0 = Math.min(a[0], b[0]), pu1 = Math.max(a[0], b[0]);
    const pv0 = inv(tl)[1], pv1 = inv(bl)[1];
    const key = coursesKey(c);
    const variant = variantOf(ctx.cell, ctx.side);
    const W = patternWM(c);
    const reserved = ctx.reservedV ?? [];
    let light = '', dark = '';
    for (let k = Math.floor(pv0 / c.hM); k * c.hM < pv1; k++) {
      const y0 = Math.max(k * c.hM, pv0) + BLOCK_INSET_M;
      const y1 = Math.min((k + 1) * c.hM, pv1) - BLOCK_INSET_M;
      if (y1 - y0 < 0.08) continue;
      const parity = (((k % 2) + 2) % 2) as 0 | 1;
      const bounds = rowBoundaries(c, key, variant, parity);
      const edges: number[] = [pu0];
      for (let n = Math.floor(pu0 / W); n * W <= pu1; n++)
        for (const bd of bounds) {
          const pos = n * W + bd;
          if (pos > pu0 && pos < pu1) edges.push(pos);
        }
      edges.sort((p, q) => p - q);
      edges.push(pu1);
      // Rang amputé des intervalles réservés (ferrures) : la nuance s'arrête à la ferrure, ne la couvre pas.
      const rowSpans = subtractReserved(y0 - pv0, y1 - pv0, reserved).map(([a, b]) => [a + pv0, b + pv0] as [number, number]);
      for (let i = 0; i + 1 < edges.length; i++) {
        const u0 = edges[i] + BLOCK_INSET_M, u1 = edges[i + 1] - BLOCK_INSET_M;
        if (u1 - u0 < 0.1) continue;
        const rv = seedStream(hash32(ctx.seed, 'blk', k, Math.round(edges[i] * 20)))();
        if (rv >= ACCENT_FRAC && rv <= 1 - ACCENT_FRAC) continue;
        for (const [s0, s1] of rowSpans) {
          const sub =
            `M${n2(fwd(u0, s0)[0])},${n2(fwd(u0, s0)[1])}L${n2(fwd(u1, s0)[0])},${n2(fwd(u1, s0)[1])}` +
            `L${n2(fwd(u1, s1)[0])},${n2(fwd(u1, s1)[1])}L${n2(fwd(u0, s1)[0])},${n2(fwd(u0, s1)[1])}Z`;
          if (rv < ACCENT_FRAC) light += sub;
          else dark += sub;
        }
      }
    }
    if (light) out += `<path d="${light}" fill="${shade(ctx.base, 1 + c.paletteVar * 1.5)}"/>`;
    if (dark) out += `<path d="${dark}" fill="${shade(ctx.base, 1 - c.paletteVar * 1.5)}"/>`;
  }

  if (ctx.recipe.speckle) {
    const e = expandRecipe({ speckle: ctx.recipe.speckle, seedScope: ctx.recipe.seedScope }, ctx.faceWM, ctx.faceHM, ctx.seed);
    const reserved = ctx.reservedV ?? [];
    const byColor = new Map<string, string>();
    for (const s of e.speckles) {
      const vM = s.v * ctx.faceHM; // mètres depuis le haut de la face
      if (reserved.some(([r0, r1]) => vM >= r0 - 0.03 && vM <= r1 + 0.03)) continue; // sous une ferrure
      byColor.set(s.color, (byColor.get(s.color) ?? '') + dotSub(uvPoint(ctx.quad, s.u, s.v), s.rM * PX_PER_M_V));
    }
    for (const [color, d] of byColor) out += `<path d="${d}" fill="${color}" opacity="0.75"/>`;
  }
  return out;
}

// ── Sol : accents (touffes d'herbe, cailloux) ancrés MONDE — stables aux 4 rotations ─────────────────
/** Recette de détail d'un terrain (null si aucune section d'accent). */
export function terrainDetail(terrainId: string): DetailRecipe | null {
  const d = TERRAIN_BY_ID.get(terrainId)?.detail;
  return d && (d.tufts || d.speckle) ? d : null;
}

/** ACCENTS de sol d'une tuile (LOD 2) : touffes (3 brins courbés par touffe, dressés à l'écran) et
 *  mouchetis, positions tirées en UV de TUILE puis projetées en GRILLE continue (`projGP`) → le brin
 *  reste sur le même point du MONDE quelle que soit la rotation caméra. BUDGET sol (≤ 2,5 nœuds/tuile) :
 *  la couleur se tire PAR TUILE dans la palette de la recette (UN `<path>` par section) — la variété
 *  de teinte vit ENTRE les tuiles (+ `tintVar`), pas entre les brins d'une même tuile. */
export function groundAccentsSvg(
  recipe: DetailRecipe,
  cell: { x: number; y: number; z: number },
  h: number,
  dims: Dims,
  mpt: number,
): string {
  const seed = hash32('floor', cell.x, cell.y, cell.z);
  const e = expandRecipe(recipe, mpt, mpt, seed);
  const at = (u: number, v: number): Pt2 => projGP({ x: cell.x - 0.5 + u, y: cell.y - 0.5 + v, h }, dims);
  const tileColor = (colors: string[], part: string) => colors[hash32(seed, part) % colors.length];
  let out = '';
  if (e.tufts.length) {
    const r = seedStream(hash32(seed, 'blades'));
    let d = '';
    for (const t of e.tufts) {
      const p = at(t.u, t.v);
      const hp = t.hM * PX_PER_M_V * (0.8 + r() * 0.5);
      const lean = (r() * 2 - 1) * 1.2;
      d +=
        `M${n2(p[0])},${n2(p[1])}q${n2(lean - 1.2)},${n2(-hp * 0.6)} ${n2(lean - 1.7)},${n2(-hp)}` +
        `M${n2(p[0])},${n2(p[1])}l${n2(lean * 0.4)},${n2(-hp * 1.15)}` +
        `M${n2(p[0])},${n2(p[1])}q${n2(lean + 1.2)},${n2(-hp * 0.6)} ${n2(lean + 1.7)},${n2(-hp * 0.85)}`;
    }
    out += `<path d="${d}" fill="none" stroke="${tileColor(recipe.tufts!.colors, 'tuftcol')}" stroke-width="0.9" stroke-linecap="round" opacity="0.9"/>`;
  }
  if (e.speckles.length) {
    let d = '';
    for (const s of e.speckles) d += dotSub(at(s.u, s.v), s.rM * PX_PER_M_V);
    out += `<path d="${d}" fill="${tileColor(recipe.speckle!.colors, 'dotcol')}" opacity="0.8"/>`;
  }
  return out;
}

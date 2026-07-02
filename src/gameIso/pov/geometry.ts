/**
 * POV — assemblage de la LISTE DE DESSIN (polygones + tracés SVG) d'une scène vue en première personne.
 * PUR.
 *
 * Sols/relief, murs ET toits viennent des BUILDERS partagés du pivot (`buildFloors`/`buildWalls`/
 * `buildRoofs`, les mêmes faces monde que l'iso) ; seuls les plafonds restent dérivés ici (spécifique
 * POV). Chaque surface est prise en MONDE (camera.ts), clippée au plan proche, projetée en pixels,
 * teintée (lumière + brouillard), puis triée du plus LOIN au plus PROCHE (peintre). La visibilité
 * (brouillard de guerre) est fournie par l'appelant (Set de clés « x,y,z ») ; la lumière par un champ
 * structurel `{ at(x,y,z) → 0..1 }`.
 *
 * LOD MATÉRIAUX par bande de DISTANCE (contrat : les deux backends interprètent le même SCHÉMA de
 * données, chacun à sa résolution — pas de parité pixel) : ≤ `LOD_BLOCKS_T` cases, l'appareillage
 * COMPLET en trapèzes perspectives (rangs + joints de blocs + blocs nuancés, expansion PARTAGÉE
 * `expandRecipe`, seed = MÊME identité monde que les accents iso) ; de là à `LOD_JOINTS_T` cases, les
 * lignes de rangs SEULES ; au-delà, rien — la brume (dès `FOG_START_T`) fait le travail.
 * `speckle`/`timber` restent hors POV v1.
 */
import {
  project,
  clipNear,
  clipSegNear,
  tileCornersWorld,
  tint,
  fogAt,
  FAR_TILES,
  FOG_START_T,
  fx,
  VW,
  VH,
  FOG_COLOR,
  type CamPose,
  type Vec3,
} from './camera';
import { sceneMetresPerTile, isIndoor, type Scene } from '../../state/scene';
import { TERRAIN_DEFS } from '../../state/terrain';
import { buildFloors } from '../builders/floors';
import { buildWalls } from '../builders/walls';
import { buildRoofs } from '../builders/roofs';
import { structureAppearance, wallPartColor, type WallPart } from '../catalog/structures';
import { reliefMaterial } from '../catalog/relief';
import { roofMaterial } from '../catalog/roofs';
import { AMBIANCE } from '../catalog/ambiance';
import { COURSED } from '../backends/affineWalls';
import { expandRecipe, ACCENT_FRAC, BLOCK_INSET_M, type DetailExpansion } from '../detail/expand';
import { hash32 } from '../detail/hash';
import { shade } from '../shade';
import type { DetailRecipe } from '../detail/types';
import type { CellSide } from '../builders/types';

/** Une pièce dessinable : polygone plein (points écran + fill) OU tracé multi-sous-chemins (`path`,
 *  joints/blocs du LOD matériaux — `stroke` pour les lignes, `fill` pour les quads nuancés). */
export type DrawItem = {
  points?: [number, number][];
  path?: string;
  fill?: string;
  stroke?: string;
  strokeW?: number;
  depth: number;
  key: string;
  kind: 'floor' | 'wall' | 'ceiling' | 'riser' | 'roof' | 'detail';
};

// Les SOLS suivent le `swatch` du terrain — donnée PARTAGÉE avec l'iso/l'éditeur : recolorer un terrain
// recolore AUSSI le POV (rien de spécifique au POV). Les MURS suivent leur APPARENCE partagée
// (`structureAppearance`, la même def que walls.ts consomme) : face/bandes/arase/merlons/herse viennent
// TOUS de la def — palette pierre UNIFIÉE en hex dans le JSON. Les TOITS suivent `roofMaterials.json`
// (teinte du pan = def[orientation], les mêmes couleurs que l'iso). Tout est ensuite teinté par la
// lumière + la brume de distance (`AMBIANCE.pov`).
export const FLOOR_FALLBACK = reliefMaterial('sol-inconnu').face; // sol sans terrain connu
export const CEIL_BASE = reliefMaterial('plafond').face; // plafond (intérieur / dessous d'un toit)

/** Couleur pleine d'un terrain (`TerrainDef.swatch`, donnée partagée iso ⇄ POV) + sa recette de détail. */
const TERRAIN_BY_ID = new Map(TERRAIN_DEFS.map((t) => [t.id, t]));

/** LOD matériaux : appareillage COMPLET (trapèzes) jusqu'ici (cases)… */
export const LOD_BLOCKS_T = 3;
/** …lignes de rangs seules jusqu'ici (= FOG_START_T : au-delà, la brume prend le relais). */
export const LOD_JOINTS_T = FOG_START_T;
/** Amplification des nuances de bloc (× paletteVar) — même dosage que les accents iso. */
const BLOCK_SHADE_K = 1.5;
/** Seuil |shade| d'un bloc d'ACCENT : les 2×ACCENT_FRAC extrêmes de la nuance uniforme [−pv, pv]. */
const accentThreshold = (paletteVar: number): number => paletteVar * (1 - 2 * ACCENT_FRAC);

/** Biais de profondeur : donne aux sols un cran DERRIÈRE (plus loin) pour qu'ils ne z-fightent pas avec
 *  la base des murs à centroïde égal. */
const FLOOR_BIAS = 0.01;

/** Champ de lumière structurel (0..1). */
type LightField = { at(x: number, y: number, z?: number): number };

/** Centroïde monde d'un polygone (moyenne des sommets). */
function centroid(pts: Vec3[]): Vec3 {
  let x = 0;
  let y = 0;
  let z = 0;
  for (const p of pts) {
    x += p.x;
    y += p.y;
    z += p.z;
  }
  const n = pts.length || 1;
  return { x: x / n, y: y / n, z: z / n };
}

// ── Clip ÉCRAN au viewport élargi ────────────────────────────────────────────────────────────────────
// Le clip near seul laisse des sommets projetés à ±20 000 px (surface frôlant le plan proche). On
// BORNE toute géométrie émise au viewport + marge : vrai cull FOV (horizontal ET vertical), DOM/SVG
// léger, et resvg ne panique plus (un groupe imbriqué mêlant ces géants à un calque d'opacité fait
// déborder le rect de calque — QC headless). La marge reste invisible (`slice` ne révèle jamais
// au-delà du viewBox).
/** Marge (px) du clip écran. */
const VIEW_MARGIN = 60;
const CLIP_X0 = -VIEW_MARGIN;
const CLIP_Y0 = -VIEW_MARGIN;
const CLIP_X1 = VW + VIEW_MARGIN;
const CLIP_Y1 = VH + VIEW_MARGIN;

type Pt = [number, number];

/** Clip Sutherland-Hodgman d'un polygone ÉCRAN contre le viewport élargi. [] si entièrement dehors. */
function clipToViewport(pts: Pt[]): Pt[] {
  // Chaque bord : prédicat « dedans » + interpolation du point de traversée.
  const edges: { in(p: Pt): boolean; cross(a: Pt, b: Pt): Pt }[] = [
    { in: (p) => p[0] >= CLIP_X0, cross: (a, b) => lerpAt(a, b, (CLIP_X0 - a[0]) / (b[0] - a[0])) },
    { in: (p) => p[0] <= CLIP_X1, cross: (a, b) => lerpAt(a, b, (CLIP_X1 - a[0]) / (b[0] - a[0])) },
    { in: (p) => p[1] >= CLIP_Y0, cross: (a, b) => lerpAt(a, b, (CLIP_Y0 - a[1]) / (b[1] - a[1])) },
    { in: (p) => p[1] <= CLIP_Y1, cross: (a, b) => lerpAt(a, b, (CLIP_Y1 - a[1]) / (b[1] - a[1])) },
  ];
  let out = pts;
  for (const e of edges) {
    const cur = out;
    out = [];
    for (let i = 0; i < cur.length; i++) {
      const a = cur[(i + cur.length - 1) % cur.length];
      const b = cur[i];
      const ia = e.in(a);
      const ib = e.in(b);
      if (ia !== ib) out.push(e.cross(a, b));
      if (ib) out.push(b);
    }
    if (out.length < 3) return [];
  }
  return out;
}
const lerpAt = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/** Clip d'un SEGMENT écran au viewport élargi (Liang-Barsky). null si entièrement dehors. */
function clipSegScreen(a: Pt, b: Pt): [Pt, Pt] | null {
  let t0 = 0;
  let t1 = 1;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const checks: [number, number][] = [
    [-dx, a[0] - CLIP_X0],
    [dx, CLIP_X1 - a[0]],
    [-dy, a[1] - CLIP_Y0],
    [dy, CLIP_Y1 - a[1]],
  ];
  for (const [p, q] of checks) {
    if (p === 0) {
      if (q < 0) return null;
      continue;
    }
    const r = q / p;
    if (p < 0) {
      if (r > t1) return null;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return null;
      if (r < t1) t1 = r;
    }
  }
  return [lerpAt(a, b, t0), lerpAt(a, b, t1)];
}

/** Construit un `DrawItem` à partir de coins monde : clip near, cull de portée, projection, clip
 *  ÉCRAN (cull FOV + coordonnées bornées), teinte. Renvoie null si rien à dessiner.
 *  `nearRef` : portée/brume évaluées au point le plus PROCHE au lieu du centroïde — pour les GRANDES
 *  faces (pans de toit) dont le centroïde tombe dans la brume opaque alors que le bord proche est en
 *  pleine vue (sinon : « maison sans toit » au bord de la brume). Le tri peintre reste au centroïde. */
function makeItem(
  cornersWorld: Vec3[],
  cam: CamPose,
  farMetres: number,
  lightVal: number,
  base: string,
  kind: DrawItem['kind'],
  key: string,
  depthBias: number,
  fogColor: string,
  nearRef = false,
): DrawItem | null {
  const clipped = clipNear(cornersWorld, cam);
  if (clipped.length < 3) return null; // entièrement derrière (ou dégénéré)
  const c = centroid(clipped);
  const cp = project(cam, c);
  const refDepth = nearRef ? Math.min(...clipped.map((p) => project(cam, p).depth)) : cp.depth;
  if (refDepth > farMetres) return null; // au-delà de la portée
  const points = clipToViewport(
    clipped.map((p): Pt => {
      const pr = project(cam, p);
      return [pr.sx, pr.sy];
    }),
  );
  if (points.length < 3) return null; // hors du champ
  const fill = tint(base, lightVal, fogAt(refDepth / cam.mpt), fogColor);
  return { points, fill, depth: cp.depth + depthBias, key, kind };
}

/** Sous-chemin `M…L…` d'un SEGMENT monde : clip near + clip écran ('' si rien de visible). */
function segSub(a: Vec3, b: Vec3, cam: CamPose): string {
  const seg = clipSegNear(a, b, cam);
  if (!seg) return '';
  const pa = project(cam, seg[0]);
  const pb = project(cam, seg[1]);
  const scr = clipSegScreen([pa.sx, pa.sy], [pb.sx, pb.sy]);
  if (!scr) return '';
  return `M${scr[0][0].toFixed(1)},${scr[0][1].toFixed(1)}L${scr[1][0].toFixed(1)},${scr[1][1].toFixed(1)}`;
}

/** Sous-chemin fermé d'un QUAD monde : clip near + clip écran ('' si rien de visible). */
function quadSub(corners: Vec3[], cam: CamPose): string {
  const clipped = clipNear(corners, cam);
  if (clipped.length < 3) return '';
  const pts = clipToViewport(
    clipped.map((p): Pt => {
      const pr = project(cam, p);
      return [pr.sx, pr.sy];
    }),
  );
  if (pts.length < 3) return '';
  return pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('') + 'Z';
}

/** Repère d'une FACE porteuse d'appareillage : point monde à l'UV (u le long de l'arête, v haut→bas). */
type FaceFrame = { at(u: number, v: number): Vec3; wM: number; hM: number };

/**
 * Items de DÉTAIL D'APPAREILLAGE d'une face (LOD par distance) — l'expansion est le CŒUR PARTAGÉ
 * `expandRecipe` (seed = identité MONDE, le même `hash32` que les accents iso). Émis :
 *  - lignes de RANGS (toujours, jusqu'à `LOD_JOINTS_T`) en UN tracé stroké au ton du joint ;
 *  - ≤ `LOD_BLOCKS_T` : joints de BLOCS verticaux (même tracé) + blocs d'ACCENT nuancés en trapèzes
 *    (UN tracé rempli clair + UN sombre, dérivés de la couleur de base par `shade` — dosage iso).
 */
function courseDetailItems(
  recipe: DetailRecipe,
  frame: FaceFrame,
  seed: number,
  depth: number,
  depthTiles: number,
  cam: CamPose,
  lightVal: number,
  base: string,
  key: string,
  fogColor: string,
): DrawItem[] {
  const c = recipe.courses;
  if (!c || depthTiles > LOD_JOINTS_T || frame.wM < 0.05 || frame.hM < 0.05) return [];
  const e: DetailExpansion = expandRecipe({ courses: c, seedScope: recipe.seedScope }, frame.wM, frame.hM, seed);
  if (!e.courses) return [];
  const out: DrawItem[] = [];
  const fogT = fogAt(depthTiles);
  const near = depthTiles <= LOD_BLOCKS_T;

  // Joints (rangs + blocs) : épaisseur PERSPECTIVE (m → px à la profondeur de la face), UN seul tracé.
  let d = '';
  for (let r = 1; r < e.courses.rows.length; r++) {
    const v = e.courses.rows[r].v0;
    d += segSub(frame.at(0, v), frame.at(1, v), cam);
  }
  if (near)
    for (const b of e.courses.blocks) if (b.u1 < 0.999) d += segSub(frame.at(b.u1, b.v0), frame.at(b.u1, b.v1), cam);
  // Biais : joints juste DEVANT leur face, blocs devant les joints — plus serrés que le pas intra-mur
  // (0.002) pour que les ornements suivants (bandes/ferrures) se peignent PAR-DESSUS.
  if (d)
    out.push({
      path: d,
      stroke: tint(e.courses.joint, lightVal, fogT, fogColor),
      strokeW: Math.max(0.35, (e.courses.jointWM * fx) / depth),
      depth: depth - 0.0005,
      key: `${key}:joints`,
      kind: 'detail',
    });

  // Blocs d'ACCENT (≤ LOD_BLOCKS_T) : les 2×ACCENT_FRAC extrêmes, trapèzes insérés de BLOCK_INSET_M.
  const pv = c.paletteVar ?? 0;
  if (near && pv > 0) {
    const thr = accentThreshold(pv);
    const iu = BLOCK_INSET_M / frame.wM;
    const iv = BLOCK_INSET_M / frame.hM;
    let light = '';
    let dark = '';
    for (const b of e.courses.blocks) {
      if (Math.abs(b.shade) < thr) continue;
      const u0 = b.u0 + iu;
      const u1 = b.u1 - iu;
      const v0 = b.v0 + iv;
      const v1 = b.v1 - iv;
      if (u1 - u0 < 0.01 || v1 - v0 < 0.01) continue;
      const sub = quadSub([frame.at(u0, v0), frame.at(u1, v0), frame.at(u1, v1), frame.at(u0, v1)], cam);
      if (b.shade > 0) light += sub;
      else dark += sub;
    }
    if (light)
      out.push({ path: light, fill: tint(shade(base, 1 + pv * BLOCK_SHADE_K), lightVal, fogT, fogColor), depth: depth - 0.001, key: `${key}:blocs+`, kind: 'detail' });
    if (dark)
      out.push({ path: dark, fill: tint(shade(base, 1 - pv * BLOCK_SHADE_K), lightVal, fogT, fogColor), depth: depth - 0.001, key: `${key}:blocs-`, kind: 'detail' });
  }
  return out;
}

/** Colonnes (x,y) dont on voit le SOL (brouillard) : voir une case, c'est voir les structures qui s'y
 *  dressent (rempart/étage au-dessus compris). Dérivé du set « x,y,z » en retirant le z. */
function visibleColumns(visible: Set<string>): Set<string> {
  const cols = new Set<string>();
  for (const k of visible) cols.add(k.slice(0, k.lastIndexOf(',')));
  return cols;
}

/** Assemble la liste de dessin POV. Trie du plus LOIN au plus PROCHE. PUR.
 *  SOLS + RELIEF = géométrie PARTAGÉE du pivot (`buildFloors`, les MÊMES faces monde que l'iso) : losange
 *  de terrain (swatch partagé), PAROIS de relief auto-dérivées (falaise/rampe → les ex-risers, désormais
 *  aux matériaux pierre/terre de l'iso), et ce que l'ancien heightfield local IGNORAIT — DALLES FINES de
 *  tablier (`deck` : on voit sous un pont/une loge, parité avec le modèle de surplomb iso) et WEDGES de
 *  raccord de terrain. Les PILIERS de tablier (2 points) restent un ornement d'écran affine, comme les
 *  montants de mur (LOD minimal). Les MURS d'arête s'élèvent depuis la hauteur de leur colonne. On rend
 *  par COLONNE visible (pas par tuile) pour voir aussi ce qui monte au-dessus. Les TOITS ferment les
 *  bâtiments (pans continus du pivot) — sauf quand le groupe est DESSOUS (cutaway → plafond intérieur).
 *  Tout vient de la scène PARTAGÉE (hauteurs, murs, portes, toits) : éditer en iso impacte le POV.
 *  - `visible` : clés « x,y,z » du brouillard ; `light` : champ `{ at(x,y,z) }` (0..1). */
export function buildPovDrawList(
  scene: Scene,
  cam: CamPose,
  visible: Set<string>,
  light: LightField,
): DrawItem[] {
  const mpt = sceneMetresPerTile(scene);
  const farMetres = FAR_TILES * mpt;
  const indoor = isIndoor(scene); // intérieur → plafond + brume sombre ; extérieur → ciel (fond) + brume claire
  const fog = indoor ? FOG_COLOR : AMBIANCE.pov.fogOutdoor;
  const cols = visibleColumns(visible);
  const items: DrawItem[] = [];

  // TOUTES les couches PLEINES (activeZ = couche max → aucun fantôme de surplomb : le POV voit le monde
  // entier, la visibilité est portée par `cols`).
  const maxZ = Math.max(...scene.layers.map((l) => l.z));
  for (const el of buildFloors(scene, undefined, { activeZ: maxZ })) {
    const { x, y, z } = el.cell;
    if (!cols.has(`${x},${y}`)) continue;
    const lv = light.at(x, y, z);
    el.faces.forEach((f, i) => {
      if (f.poly.length < 3) return; // pilier (2 points) : hors POV
      const corners: Vec3[] = f.poly.map((p) => ({ x: p.x * mpt, y: p.y * mpt, z: p.h }));
      if (f.material.domain === 'relief') {
        // Paroi de relief (falaise/rampe/dalle de tablier) : ombrée comme l'ex-riser (×0.82), au ton du
        // matériau du builder (rampe : dessus de pente si la def en a un).
        const m = reliefMaterial(f.material.id);
        const base = (f.material.part === 'ramp' ? m.slopeTop : undefined) ?? m.face;
        const it = makeItem(corners, cam, farMetres, lv * 0.82, base, 'riser', `${el.key}:${i}:${f.material.part}`, 0, fog);
        if (it) items.push(it);
      } else {
        // Losange de terrain (clé historique `floor:x,y,z`) + wedges de raccord (peints PAR-DESSUS leur base).
        const wedge = f.material.part === 'wedge';
        const def = TERRAIN_BY_ID.get(f.material.id);
        const base = def?.swatch ?? FLOOR_FALLBACK;
        const it = makeItem(corners, cam, farMetres, lv, base, 'floor', wedge ? `${el.key}:${i}:wedge` : el.key, wedge ? FLOOR_BIAS - 0.005 : FLOOR_BIAS, fog);
        if (!it) return;
        items.push(it);
        // JOINTS D'APPAREILLAGE du sol (pavé/dalle/planches) ≤ LOD_BLOCKS_T cases : expansion PARTAGÉE
        // sur l'espace TUILE (mpt × mpt), seed = MÊME identité monde que les accents de sol iso.
        const det = def?.detail;
        if (wedge || !det?.courses) return;
        const depthTiles = (it.depth - FLOOR_BIAS) / cam.mpt;
        if (depthTiles > LOD_BLOCKS_T) return;
        const h = f.poly[0].h;
        const frame: FaceFrame = {
          at: (u, v) => ({ x: (x - 0.5 + u) * mpt, y: (y - 0.5 + v) * mpt, z: h }),
          wM: mpt,
          hM: mpt,
        };
        items.push(...courseDetailItems(det, frame, hash32('floor', x, y, z), it.depth, depthTiles, cam, lv, base, el.key, fog));
      }
    });
    // PLAFOND : intérieur, couche du groupe seulement (spécifique POV).
    if (indoor && z === cam.z) {
      const ceil = makeItem(tileCornersWorld(scene, x, y, z, true), cam, farMetres, lv, CEIL_BASE, 'ceiling', `ceil:${x},${y},${z}`, 0, fog);
      if (ceil) items.push(ceil);
    }
  }

  // MURS d'arête — géométrie PARTAGÉE du pivot (`buildWalls`, les MÊMES faces monde que l'iso) : le POV
  // projette chaque face (GP grille+mètres → mètres monde par `mpt`) avec sa caméra + clip + teinte, la
  // couleur de base venant de `wallPartColor` (source unique avec l'affine). Le détail BOIS (panneau/
  // moulure/plinthe/embrasure) devient AUSSI visible en POV (ex-divergence : face/bandes/arase seulement).
  // Colonne visible requise ; PORTE ouverte (state `open`) = passage béant ; structure ABATTUE = faces de
  // brèche (tas de gravats). Les MONTANTS (poteau/jambage, 2 points) restent un ornement d'écran affine.
  for (const el of buildWalls(scene)) {
    if (!cols.has(`${el.cell.x},${el.cell.y}`)) continue;
    if (el.states.open) continue;
    const app = structureAppearance(el.appearance);
    const lv = light.at(el.cell.x, el.cell.y, el.cell.z);
    el.faces.forEach((f, i) => {
      if (f.poly.length < 3) return; // montant 2 points : hors POV (LOD minimal)
      const corners: Vec3[] = f.poly.map((p) => ({ x: p.x * mpt, y: p.y * mpt, z: p.h }));
      const part = f.material.part as WallPart;
      const base = wallPartColor(app, part);
      // Peintre INTRA-mur : les faces s'empilent dans l'ordre du builder (détail PAR-DESSUS le fond) —
      // biais NÉGATIF croissant (plus proche), trop petit pour déclasser deux murs distincts.
      const it = makeItem(corners, cam, farMetres, lv, base, 'wall', `${el.key}:${i}:${part}`, -i * 0.002, fog);
      if (!it) return;
      items.push(it);
      // APPAREILLAGE au LOD de distance (parts maçonnées d'une def à recette — même aiguillage COURSED
      // que l'iso ; nuances de bloc sur la GRANDE face seulement, comme les accents iso).
      const det = app.detail;
      if (!det?.courses || !COURSED.has(part)) return;
      const depthTiles = it.depth / cam.mpt;
      const [P0, P1, , P3] = f.poly; // quad du builder : [A@haut, B@haut, B@bas, A@bas]
      const frame: FaceFrame = {
        at: (u, v) => ({
          x: (P0.x + (P1.x - P0.x) * u) * mpt,
          y: (P0.y + (P1.y - P0.y) * u) * mpt,
          z: P0.h + (P3.h - P0.h) * v,
        }),
        wM: Math.hypot(P1.x - P0.x, P1.y - P0.y) * mpt,
        hM: P0.h - P3.h,
      };
      // MÊME identité monde que le seed des accents iso (`wallAccentsSvg`) — le contrat matériaux v2.
      const seed = hash32('wall', el.cell.x, el.cell.y, el.cell.z, el.side);
      const recipe: DetailRecipe = part === 'face' ? det : { courses: { ...det.courses, paletteVar: 0 }, seedScope: det.seedScope };
      items.push(...courseDetailItems(recipe, frame, seed, it.depth, depthTiles, cam, lv, base, `${el.key}:${i}:${part}`, fog));
    });
  }

  // TOITS — géométrie PARTAGÉE du pivot (`buildRoofs`, les MÊMES pans continus que l'iso). Teinte du
  // pan = def[orientation] du matériau (part N/E/S/O — les mêmes couleurs que l'iso). CUTAWAY POV :
  // le groupe DANS l'empreinte (`roofOccupied`, case de l'œil dérivée de la caméra) est DESSOUS →
  // pas de pans, mais le PLAFOND intérieur de l'empreinte (même convention que l'indoor : surface +
  // WALL_H_M, ton `plafond`) — une scène `interieur` a déjà son plafond tuile à tuile, on ne double pas.
  const eyeCell = { x: Math.round(cam.eye.x / mpt), y: Math.round(cam.eye.y / mpt) };
  for (const el of buildRoofs(scene, visible, { allies: [eyeCell] })) {
    if (!el.states.visible) continue;
    const z = el.cell.z;
    if (el.states.roofOccupied) {
      if (indoor) continue;
      for (let dy = 0; dy < el.span.h; dy++)
        for (let dx = 0; dx < el.span.w; dx++) {
          const x = el.cell.x + dx;
          const y = el.cell.y + dy;
          if (!cols.has(`${x},${y}`)) continue;
          const ceil = makeItem(tileCornersWorld(scene, x, y, z, true), cam, farMetres, light.at(x, y, z), CEIL_BASE, 'ceiling', `roofceil:${x},${y},${z}`, 0, fog);
          if (ceil) items.push(ceil);
        }
      continue;
    }
    const sh = roofMaterial(el.material);
    const lv = light.at(el.cell.x, el.cell.y, z);
    el.faces.forEach((f, i) => {
      const corners: Vec3[] = f.poly.map((p) => ({ x: p.x * mpt, y: p.y * mpt, z: p.h }));
      const base = sh[f.material.part as CellSide] ?? sh.N ?? FLOOR_FALLBACK;
      // `nearRef` : un pan est GRAND (bâtiment entier) — portée/brume à son bord le plus proche.
      const it = makeItem(corners, cam, farMetres, lv, base, 'roof', `${el.key}:${i}`, 0, fog, true);
      if (it) items.push(it);
    });
  }

  // Peintre : loin d'abord (depth DÉCROISSANT).
  items.sort((a, b) => b.depth - a.depth);
  return items;
}

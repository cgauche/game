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
 * LOD MATÉRIAUX en FONDU par la DISTANCE (contrat : les deux backends interprètent le même SCHÉMA de
 * données, chacun à sa résolution — pas de parité pixel). Les bandes se CHEVAUCHENT, aucune coupure
 * visible (paramètres en DONNÉE, `AMBIANCE.pov.depth.lod`) :
 *  - ≤ `blocksT` cases : appareillage COMPLET en trapèzes perspectives (rangs + joints de blocs +
 *    blocs nuancés, expansion PARTAGÉE `expandRecipe`, seed = MÊME identité monde que les accents
 *    iso) ; blocs et joints verticaux s'évanouissent en fondu sur `fadeT` cases (mélange vers la face) ;
 *  - au-delà et JUSQU'À LA PORTÉE MAX : lignes de rangs, qui se fondent vers la face quand leur pas
 *    PROJETÉ passe sous `minJointSpacingPx` (anti-moiré) — la perspective des joints file à l'horizon ;
 *  - MAILLAGE DE TUILES fusionné par ANNEAUX de distance : arêtes N/O de chaque tuile de sol (joint
 *    réel des terrains appareillés, maille subtile fondue à l'entrée pour les autres) — LE repère de
 *    profondeur au sol, jusqu'au bout de la portée, pour un coût d'items en O(anneaux), pas O(tuiles).
 * La brume ATMOSPHÉRIQUE (courbe smoothstep^gamma en donnée) délave le tout progressivement.
 * La géométrie STATIQUE (sols, murs, toits) est TOUJOURS rendue avec sa VRAIE matière, même hors de la
 * vue : une colonne non visible (brouillard de guerre / hors LdV) reçoit une LUMIÈRE D'AMBIANCE
 * (plancher du champ de lumière — jour clair / nuit sombre, × `pov.ambientUnseen`) et la brume de
 * DISTANCE normale (proche = nette, loin = fondue) — jamais un aplat de brume, jamais du noir. Le monde
 * reste CONTINU (plus de trous de ciel) ; seul le DYNAMIQUE (créatures/props billboards,
 * `pov/billboards.tsx`) est CULÉ par le brouillard. Le DÉTAIL FIN (appareillage/joints/accents) reste
 * RÉSERVÉ aux faces VUES (proches) : une structure pas encore explorée montre sa forme + matière de base.
 * DÉTAIL DE TERRAIN au LOD PROCHE (mêmes recettes/seed que l'iso) : variance de teinte par tuile
 * (`tintVar`, miroir du choix de variante iso), TOUFFES d'herbe (`tufts`, brins dressés en monde) et
 * MOUCHETIS (`speckle`, galets/reflets) — fondus par la distance, éteints dès que la brume prend le
 * relais. `timber` (colombage) reste hors POV.
 */
import {
  project,
  clipNear,
  clipSegNear,
  tileCornersWorld,
  tint,
  fogAt,
  fogCurveOf,
  farTilesOf,
  mixHex,
  fx,
  VW,
  VH,
  FOG_COLOR,
  type FogCurve,
  type CamPose,
  type Vec3,
} from './camera';
import { sceneMetresPerTile, isIndoor, tileAt, heightAt, type Scene } from '../../state/scene';
import { TERRAIN_DEFS, terrainSolidHeightM } from '../../state/terrain';
import { buildFloors, SIDES, NEIGHBOURS } from '../builders/floors';
import { buildWalls } from '../builders/walls';
import { buildRoofs } from '../builders/roofs';
import { wallPartColor, windowLit, type WallPart } from '../catalog/structures';
import { facadeStructureAppearance } from '../catalog/facades';
import { reliefMaterial } from '../catalog/relief';
import { roofMaterial } from '../catalog/roofs';
import { AMBIANCE } from '../catalog/ambiance';
import { COURSED } from '../backends/affineWalls';
import { expandRecipe, ACCENT_FRAC, BLOCK_INSET_M, BLOCK_SHADE_K, type DetailExpansion } from '../detail/expand';
import { hash32, seedStream } from '../detail/hash';
import { TINT_SPREAD } from '../backends/affineDetail';
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
  kind: 'floor' | 'wall' | 'ceiling' | 'riser' | 'roof' | 'detail' | 'occl';
  /** Classe CSS d'ambiance (ex. `warm` pour une vitre allumée la nuit) — appliquée au nœud SVG rendu. */
  cls?: string;
  /** Opacité < 1 (ex. VITRE de jour : verre TRANSPARENT → l'intérieur se voit derrière l'ouverture). */
  opacity?: number;
};

// Les SOLS suivent le `swatch` du terrain — donnée PARTAGÉE avec l'iso/l'éditeur : recolorer un terrain
// recolore AUSSI le POV (rien de spécifique au POV). Les MURS suivent leur APPARENCE partagée
// (`structureAppearance`, la même def que walls.ts consomme) : face/bandes/arase/merlons/herse viennent
// TOUS de la def — palette pierre UNIFIÉE en hex dans le JSON. Les TOITS suivent `roofMaterials.json`
// (teinte du pan = def[orientation], les mêmes couleurs que l'iso). Tout est ensuite teinté par la
// lumière + la brume de distance (`AMBIANCE.pov`).
export const FLOOR_FALLBACK = reliefMaterial('sol-inconnu').face; // sol sans terrain connu
export const CEIL_BASE = reliefMaterial('plafond').face; // plafond (intérieur / dessous d'un toit)
const COVER_CEIL_BASE = reliefMaterial('pierre').face; // dessous d'un solide (tunnel/pont/surplomb) — voûte de pierre

/** Hauteur du DESSOUS du solide le PLUS BAS qui COUVRE (x,y,z) — une couche supérieure y a une tuile pleine
 *  (non `vide`) : tunnel de porte, pont, surplomb. null si rien au-dessus (ciel ouvert). RÈGLE GÉNÉRALE,
 *  aucune notion d'élément : si un solide est au-dessus, on en voit le dessous depuis dessous. PUR. */
function coveringHeight(scene: Scene, x: number, y: number, z: number): number | null {
  let best: number | null = null;
  for (const l of scene.layers)
    if (l.z > z && tileAt(scene, x, y, l.z) !== 'vide') {
      const h = heightAt(scene, x, y, l.z);
      if (best == null || h < best) best = h;
    }
  return best;
}

/** Couleur pleine d'un terrain (`TerrainDef.swatch`, donnée partagée iso ⇄ POV) + sa recette de détail. */
const TERRAIN_BY_ID = new Map(TERRAIN_DEFS.map((t) => [t.id, t]));

/** Bandes de LOD matériaux — DONNÉE partagée (`ambiance.json`), cf. en-tête de fichier. */
const LOD = AMBIANCE.pov.depth.lod;
/** Seuil |shade| d'un bloc d'ACCENT : les 2×ACCENT_FRAC extrêmes de la nuance uniforme [−pv, pv]. */
const accentThreshold = (paletteVar: number): number => paletteVar * (1 - 2 * ACCENT_FRAC);
/** Éventail d'une touffe : décalage horizontal MONDE d'un brin latéral, en fraction de sa hauteur. */
const TUFT_FAN = 0.3;
/** Épaisseur métrique d'un brin d'herbe (m) — projetée en perspective comme un joint. */
const TUFT_BLADE_WM = 0.01;

/** Biais de profondeur : donne aux sols un cran DERRIÈRE (plus loin) pour qu'ils ne z-fightent pas avec
 *  la base des murs à centroïde égal. */
const FLOOR_BIAS = 0.01;
/** Un sol d'ÉTAGE le REMONTE d'un cran DEVANT (par `z`) : une dalle z1 COIFFE un bloc plein z0 (chemin de
 *  ronde sur le mur) — à centroïde ~égal, `FLOOR_BIAS` l'enterrait SOUS le flanc du mur. `> FLOOR_BIAS` +
 *  bruit de centroïde, `≪` l'écart inter-tuile → ne départage QUE les ex æquo, jamais la vraie distance. */
const FLOOR_ZLIFT = 0.04;

/** Champ de lumière structurel (0..1). */
type LightField = { at(x: number, y: number, z?: number): number };

/** Facteur POV de la lumière d'AMBIANCE d'une surface STATIQUE non encore VUE (brouillard de guerre) —
 *  DONNÉE (`ambiance.json`). */
const AMBIENT_UNSEEN = AMBIANCE.pov.ambientUnseen;

/** Lumière effective d'une case pour la géométrie STATIQUE (sol/mur/toit) : `light.at` si la case est
 *  VUE, sinon la lumière d'AMBIANCE de la scène en retrait (× `AMBIENT_UNSEEN`) — jamais le noir de la
 *  lumière-viewer 0. `light.at` a pour PLANCHER l'ambiant jour/nuit de la scène (cf. `computeLightField`)
 *  → un mur lointain est clair-hazé de jour, sombre-hazé de nuit, jamais noir plat ni bleu-ciel plat. */
const staticLight = (light: LightField, seen: boolean, x: number, y: number, z: number): number =>
  seen ? light.at(x, y, z) : light.at(x, y, z) * AMBIENT_UNSEEN;

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
 *  pleine vue (sinon : « maison sans toit » au bord de la brume). Le tri peintre reste au centroïde.
 *  La brume est TOUJOURS celle de la DISTANCE (`fogAt`) : la géométrie statique non vue se fond au loin,
 *  jamais en aplat forcé — c'est sa LUMIÈRE (ambiante) qui dit « pas encore explorée », pas la brume. */
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
  curve: FogCurve,
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
  const fill = tint(base, lightVal, fogAt(refDepth / cam.mpt, curve), fogColor);
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
 * Items de DÉTAIL D'APPAREILLAGE d'une face (LOD en FONDU par la distance) — l'expansion est le CŒUR
 * PARTAGÉ `expandRecipe` (seed = identité MONDE, le même `hash32` que les accents iso). Émis :
 *  - lignes de RANGS jusqu'à la PORTÉE MAX, fondues vers la teinte de face quand leur pas PROJETÉ
 *    approche `minJointSpacingPx` (anti-moiré, fondu adaptatif à la résolution) — la perspective
 *    des joints porte la profondeur jusqu'au bout ;
 *  - joints de BLOCS verticaux (tracé séparé) + blocs d'ACCENT nuancés en trapèzes (UN tracé rempli
 *    clair + UN sombre, `shade` — dosage iso), fondus sur `fadeT` cases après `blocksT` (chevauchement
 *    de bandes : aucune ligne de coupure).
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
  curve: FogCurve,
): DrawItem[] {
  const c = recipe.courses;
  if (!c || frame.wM < 0.05 || frame.hM < 0.05) return [];
  const n = Math.max(1, Math.round(frame.hM / c.hM));
  // Pas PROJETÉ d'un rang (px) : hauteur écran de la face ÷ nombre de rangs. Une face qui frôle le
  // plan proche projette des px géants → traitée comme « très proche » (poids plein).
  const pa = project(cam, frame.at(0.5, 0));
  const pb = project(cam, frame.at(0.5, 1));
  const spacingPx = pa.behind || pb.behind ? Number.POSITIVE_INFINITY : Math.hypot(pa.sx - pb.sx, pa.sy - pb.sy) / n;
  // Poids des RANGS ∈ [0,1] : plein à 2× le pas minimal, nul en-dessous du pas minimal (fondu doux).
  const wRows = Math.min(1, Math.max(0, spacingPx / LOD.minJointSpacingPx - 1));
  if (wRows <= 0) return [];
  const e: DetailExpansion = expandRecipe({ courses: c, seedScope: recipe.seedScope }, frame.wM, frame.hM, seed);
  if (!e.courses) return [];
  const out: DrawItem[] = [];
  const fogT = fogAt(depthTiles, curve);
  // Poids de la bande PROCHE (blocs nuancés + joints verticaux) : plein ≤ blocksT, fondu sur fadeT.
  const wNear = 1 - Math.min(1, Math.max(0, (depthTiles - LOD.blocksT) / LOD.fadeT));
  const strokeW = Math.max(0.3, (e.courses.jointWM * fx) / depth);

  // Lignes de RANGS : épaisseur PERSPECTIVE (m → px à la profondeur de la face), UN seul tracé,
  // couleur fondue vers la face selon wRows (le fondu de LOD), puis délavée par la brume.
  let d = '';
  for (let r = 1; r < e.courses.rows.length; r++) {
    const v = e.courses.rows[r].v0;
    d += segSub(frame.at(0, v), frame.at(1, v), cam);
  }
  // Biais : joints juste DEVANT leur face, blocs devant les joints — plus serrés que le pas intra-mur
  // (0.002) pour que les ornements suivants (bandes/ferrures) se peignent PAR-DESSUS.
  if (d)
    out.push({
      path: d,
      stroke: tint(mixHex(base, e.courses.joint, wRows), lightVal, fogT, fogColor),
      strokeW,
      depth: depth - 0.0005,
      key: `${key}:joints`,
      kind: 'detail',
    });

  // Joints de BLOCS verticaux (bande proche, tracé SÉPARÉ pour un fondu indépendant des rangs).
  if (wNear > 0) {
    let dv = '';
    for (const b of e.courses.blocks) if (b.u1 < 0.999) dv += segSub(frame.at(b.u1, b.v0), frame.at(b.u1, b.v1), cam);
    if (dv)
      out.push({
        path: dv,
        stroke: tint(mixHex(base, e.courses.joint, Math.min(wRows, wNear)), lightVal, fogT, fogColor),
        strokeW,
        depth: depth - 0.0006,
        key: `${key}:jointsv`,
        kind: 'detail',
      });
  }

  // Blocs d'ACCENT (bande proche) : les 2×ACCENT_FRAC extrêmes, trapèzes insérés de BLOCK_INSET_M,
  // amplitude de nuance × wNear (le fondu — les accents se dissolvent dans la face, jamais de coupure).
  const pv = c.paletteVar ?? 0;
  if (wNear > 0 && pv > 0) {
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
      out.push({ path: light, fill: tint(shade(base, 1 + pv * BLOCK_SHADE_K * wNear), lightVal, fogT, fogColor), depth: depth - 0.001, key: `${key}:blocs+`, kind: 'detail' });
    if (dark)
      out.push({ path: dark, fill: tint(shade(base, 1 - pv * BLOCK_SHADE_K * wNear), lightVal, fogT, fogColor), depth: depth - 0.001, key: `${key}:blocs-`, kind: 'detail' });
  }
  return out;
}

/**
 * ACCENTS de SOL d'une tuile au LOD PROCHE — touffes d'herbe (`tufts`) et mouchetis (`speckle`), le même
 * cœur d'expansion PARTAGÉ (`expandRecipe`, seed = identité MONDE `hash32('floor', …)`, le même que les
 * accents iso `groundAccentsSvg`). Les positions sont tirées en UV de TUILE puis ANCRÉES EN MONDE (via le
 * `frame` de la tuile) → stables aux 4 rotations. Fondu par la distance comme l'appareillage : au-delà de
 * la bande proche (`blocksT`+`fadeT`) les accents se dissolvent vers la teinte de sol (le maillage prend
 * le relais). Budget : UN tracé par tuile et par section (brins concaténés / losanges concaténés).
 */
function groundAccentItems(
  recipe: DetailRecipe,
  frame: FaceFrame,
  seed: number,
  depth: number,
  depthTiles: number,
  cam: CamPose,
  lightVal: number,
  base: string,
  cellKey: string,
  fogColor: string,
  curve: FogCurve,
): DrawItem[] {
  // Poids PROCHE ∈ [0,1] : plein ≤ blocksT, fondu sur fadeT (même bande que les blocs nuancés).
  const wNear = 1 - Math.min(1, Math.max(0, (depthTiles - LOD.blocksT) / LOD.fadeT));
  if (wNear <= 0) return [];
  const e = expandRecipe({ tufts: recipe.tufts, speckle: recipe.speckle, seedScope: recipe.seedScope }, frame.wM, frame.hM, seed);
  if (!e.tufts.length && !e.speckles.length) return [];
  const out: DrawItem[] = [];
  const fogT = fogAt(depthTiles, curve);

  // TOUFFES : quelques brins dressés en MONDE depuis le pied (hauteur = z + hM), éventail dans une
  // direction monde tirée au seed (per touffe) — le fondu vers la teinte de sol (`mixHex`) les éteint au
  // loin, comme un joint. UN tracé stroké par tuile (couleur de tuile, dosage iso).
  if (e.tufts.length && recipe.tufts) {
    const r = seedStream(hash32(seed, 'blades'));
    let d = '';
    for (const t of e.tufts) {
      const pied = frame.at(t.u, t.v);
      const hp = t.hM * (0.8 + r() * 0.5); // hauteur monde du brin (m)
      const ang = r() * Math.PI * 2;
      const dx = Math.cos(ang) * TUFT_FAN * hp;
      const dy = Math.sin(ang) * TUFT_FAN * hp;
      d += segSub(pied, { x: pied.x, y: pied.y, z: pied.z + hp }, cam); // brin central
      d += segSub(pied, { x: pied.x + dx, y: pied.y + dy, z: pied.z + hp * 0.9 }, cam); // brin gauche
      d += segSub(pied, { x: pied.x - dx, y: pied.y - dy, z: pied.z + hp * 0.85 }, cam); // brin droit
    }
    if (d) {
      const col = recipe.tufts.colors[hash32(seed, 'tuftcol') % recipe.tufts.colors.length];
      const strokeW = Math.max(0.4, (TUFT_BLADE_WM * fx) / depth);
      out.push({ path: d, stroke: tint(mixHex(base, col, wNear), lightVal, fogT, fogColor), strokeW, depth: depth - 0.006, key: `tuft:${cellKey}`, kind: 'detail' });
    }
  }

  // MOUCHETIS : petits losanges au sol (galets/reflets), taille en PERSPECTIVE (rM·fx/depth), un tracé
  // rempli par tuile. Losange écran centré sur le point de sol projeté (culé au viewport).
  if (e.speckles.length && recipe.speckle) {
    let d = '';
    for (const s of e.speckles) {
      const p = project(cam, frame.at(s.u, s.v));
      if (p.behind || p.sx < CLIP_X0 || p.sx > CLIP_X1 || p.sy < CLIP_Y0 || p.sy > CLIP_Y1) continue;
      const rad = Math.max(0.4, (s.rM * fx) / depth);
      d +=
        `M${p.sx.toFixed(1)},${(p.sy - rad).toFixed(1)}L${(p.sx + rad * 1.2).toFixed(1)},${p.sy.toFixed(1)}` +
        `L${p.sx.toFixed(1)},${(p.sy + rad * 0.8).toFixed(1)}L${(p.sx - rad * 1.1).toFixed(1)},${p.sy.toFixed(1)}Z`;
    }
    if (d) {
      const col = recipe.speckle.colors[hash32(seed, 'dotcol') % recipe.speckle.colors.length];
      out.push({ path: d, fill: tint(mixHex(base, col, wNear), lightVal, fogT, fogColor), depth: depth - 0.007, key: `speckle:${cellKey}`, kind: 'detail' });
    }
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
 *  de terrain (swatch partagé), PAROIS de relief auto-dérivées (falaise/rampe, aux matériaux
 *  pierre/terre de l'iso), DALLES FINES de
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
  night = false,
): DrawItem[] {
  const mpt = sceneMetresPerTile(scene);
  const indoor = isIndoor(scene); // intérieur → plafond + brume sombre COURTE ; extérieur → ciel + perspective atmosphérique LONGUE
  const curve = fogCurveOf(indoor);
  const farMetres = farTilesOf(indoor) * mpt;
  const fog = indoor ? FOG_COLOR : AMBIANCE.pov.fogOutdoorSurface;
  const cols = visibleColumns(visible);
  const items: DrawItem[] = [];

  // TOUTES les couches PLEINES (activeZ = couche max → aucun fantôme de surplomb : le POV voit le monde
  // entier). Une colonne NON VISIBLE (brouillard de guerre / hors LdV) est rendue avec sa VRAIE matière
  // sous une LUMIÈRE D'AMBIANCE (`staticLight`) + la brume de DISTANCE — pas un aplat de brume : le monde
  // reste continu, sans détail fin (réservé au vu).
  const maxZ = Math.max(...scene.layers.map((l) => l.z));
  for (const el of buildFloors(scene, undefined, { activeZ: maxZ })) {
    const { x, y, z } = el.cell;
    // Un BLOC SOLIDE (mur : terrain à `solidHeightM`) est OPAQUE → `computeVisible` ne le marque JAMAIS
    // « vu » (la lumière n'atteint pas l'intérieur d'un mur, le rayon vers lui est bloqué par lui-même).
    // Comme un WallSeg (posé sur une arête bordant une tuile ouverte), chacune de ses faces s'éclaire et
    // se voit depuis la tuile OUVERTE qu'elle borde, PAS depuis la tuile-bloc elle-même. Les valeurs par
    // défaut (`seen`/`lv`, de la tuile) restent celles de tout autre sol/relief ; on ne les SURCHARGE par
    // face que pour un bloc solide (`fSeen`/`fLv`, ci-dessous).
    const solid = terrainSolidHeightM(tileAt(scene, x, y, z)) > 0;
    const seen = cols.has(`${x},${y}`);
    const lv = staticLight(light, seen, x, y, z);
    el.faces.forEach((f, i) => {
      if (f.poly.length < 3) return; // pilier (2 points) : hors POV
      const corners: Vec3[] = f.poly.map((p) => ({ x: p.x * mpt, y: p.y * mpt, z: p.h }));
      // Vue/lumière EFFECTIVES de CETTE face. Bloc solide : un FLANC (relief) prend celles du voisin
      // ouvert que son arête borde ; le DESSUS (losange terrain) celles du MEILLEUR voisin ouvert vu
      // (max sur les 4 — un voisin vu éclaire le sommet ; sinon lumière d'AMBIANCE). Sinon : la tuile.
      let fSeen = seen;
      let fLv = lv;
      if (solid) {
        if (f.side && f.material.domain === 'relief') {
          const [dx, dy] = NEIGHBOURS[f.side];
          fSeen = cols.has(`${x + dx},${y + dy}`);
          fLv = staticLight(light, fSeen, x + dx, y + dy, z);
        } else if (f.material.domain === 'terrain' && !f.material.part) {
          fSeen = false;
          fLv = 0;
          for (const s of SIDES) {
            const [dx, dy] = NEIGHBOURS[s];
            if (cols.has(`${x + dx},${y + dy}`)) { fSeen = true; fLv = Math.max(fLv, light.at(x + dx, y + dy, z)); }
          }
          if (!fSeen) fLv = light.at(x, y, z) * AMBIENT_UNSEEN; // aucun voisin vu : ambiance de la scène (jamais noir)
        }
      }
      if (f.material.domain === 'relief') {
        // Paroi de relief (falaise/rampe/dalle de tablier) : ombrée à ×0.82, au ton du
        // matériau du builder (rampe : dessus de pente si la def en a un).
        const m = reliefMaterial(f.material.id);
        const base = (f.material.part === 'ramp' ? m.slopeTop : undefined) ?? m.face;
        const it = makeItem(corners, cam, farMetres, fLv * 0.82, base, 'riser', `${el.key}:${i}:${f.material.part}`, 0, fog, curve);
        if (!it) return;
        items.push(it);
        // APPAREILLAGE d'un FLANC de FALAISE vu : si le MATÉRIAU porte une recette (`reliefMaterial.detail`
        // — pierre appareillée d'un mur/rempart, strates d'une falaise de terre), la face reçoit ses assises
        // via le MÊME `courseDetailItems` que les murs d'arête et l'iso → une PAROI matiérée, jamais un aplat
        // nu. Clé = le MATÉRIAU, PAS le terrain-bloc `solidHeightM` : une zone rempart (sommet marchable en
        // `pierre`, donc `solid` faux) est appareillée comme la courtine, exactement comme l'iso/edge la rendent.
        if (fSeen && f.side && f.material.part === 'cliff' && m.detail?.courses) {
          const [P0, P1, , P3] = f.poly; // quad du builder : [A@haut, B@haut, B@bas, A@bas]
          const frame: FaceFrame = {
            at: (u, v) => ({ x: (P0.x + (P1.x - P0.x) * u) * mpt, y: (P0.y + (P1.y - P0.y) * u) * mpt, z: P0.h + (P3.h - P0.h) * v }),
            wM: Math.hypot(P1.x - P0.x, P1.y - P0.y) * mpt,
            hM: P0.h - P3.h,
          };
          const seed = hash32('floor', x, y, z, f.side); // MÊME identité monde que l'appareillage iso (`floorAccentsSvg`)
          const depthTiles = it.depth / cam.mpt;
          items.push(...courseDetailItems(m.detail, frame, seed, it.depth, depthTiles, cam, fLv * 0.82, base, `${el.key}:${i}:${f.material.part}`, fog, curve));
        }
      } else {
        // Losange de terrain (clé historique `floor:x,y,z`) + wedges de raccord (peints PAR-DESSUS leur base).
        const wedge = f.material.part === 'wedge';
        const def = TERRAIN_BY_ID.get(f.material.id);
        const base = def?.swatch ?? FLOOR_FALLBACK;
        const it = makeItem(corners, cam, farMetres, fLv, base, 'floor', wedge ? `${el.key}:${i}:wedge` : el.key, (wedge ? FLOOR_BIAS - 0.005 : FLOOR_BIAS) - z * FLOOR_ZLIFT, fog, curve);
        if (!it) return;
        items.push(it);
        // OCCLUSION intra-tuile : dégradé NEUTRE (`pov-floor-shade`, objectBoundingBox) posé sur le losange —
        // « creusé » vertical miroir de l'iso, indépendant de la couleur du sol. Sous les joints/détails (biais
        // plus proche pour eux). Un seul overlay par tuile (géométrie mémoïsée : coût au pas, pas par frame).
        if (!wedge && AMBIANCE.pov.floorOcclusion > 0)
          items.push({ points: it.points, fill: 'url(#pov-floor-shade)', depth: it.depth - 0.0002, key: `${el.key}:occl`, kind: 'occl' });
        if (!fSeen || wedge) return; // non vu (forme + matière seules) / wedge : pas de détail fin
        const depthTiles = (it.depth - FLOOR_BIAS) / cam.mpt;
        const h = f.poly[0].h;
        const det = def?.detail;
        const seed = hash32('floor', x, y, z); // identité MONDE — le MÊME seed que les accents de sol iso
        // VARIANCE DE TEINTE par tuile (`tintVar`) : miroir EXACT du choix de variante iso
        // (`terrainFillGradient` : `hash32('tint',x,y,z) % TINT_SPREAD.length`, même amplitude `TINT_SPREAD`).
        // Coût nul (une nuance du fill de base déjà posé) ; fondu au proche/moyen — au loin la brume
        // écrase tout et le maillage prend le relais.
        if (det?.tintVar) {
          const wTint = 1 - Math.min(1, Math.max(0, (depthTiles - LOD.blocksT) / LOD.fadeT));
          if (wTint > 0) {
            const spread = TINT_SPREAD[hash32('tint', x, y, z) % TINT_SPREAD.length];
            it.fill = tint(shade(base, 1 + det.tintVar * spread * wTint), fLv, fogAt(depthTiles, curve), fog);
          }
        }
        // DÉTAIL DE SURFACE sur l'espace TUILE (mpt × mpt) : RANGS d'appareillage (pavé/dalle/planches),
        // TOUFFES d'herbe et MOUCHETIS — expansion PARTAGÉE, seed = MÊME identité monde que l'iso ; chaque
        // section s'éteint toute seule au loin (pas projeté / bande proche).
        if (det && (det.courses || det.tufts || det.speckle)) {
          const frame: FaceFrame = {
            at: (u, v) => ({ x: (x - 0.5 + u) * mpt, y: (y - 0.5 + v) * mpt, z: h }),
            wM: mpt,
            hM: mpt,
          };
          if (det.courses) items.push(...courseDetailItems(det, frame, seed, it.depth, depthTiles, cam, fLv, base, el.key, fog, curve));
          if (det.tufts || det.speckle) items.push(...groundAccentItems(det, frame, seed, it.depth, depthTiles, cam, fLv, base, `${x},${y},${z}`, fog, curve));
        }
        // MAILLAGE DE TUILES — LE repère de profondeur au sol, jusqu'à la portée max. Terrain
        // appareillé → son joint (vraie ligne d'appareillage, dès la 1re case) ; terrain nu MARCHABLE
        // (un sol façonné/foulé — l'eau ou la lave n'ont pas de tuiles) → maille subtile (shade de la
        // teinte) fondue à l'entrée [meshStartT, +meshFadeT], que la brume évanouit au loin.
        // Les 4 arêtes de la tuile : les doublons d'arête partagée sont opaques (recouvrement
        // invisible) et la copie de la tuile la plus PROCHE survit toujours au peintre — aucune arête
        // mangée par le remplissage d'une voisine, quel que soit le cap. Chaque PAIRE d'arêtes opposées
        // se fond quand son écrasement PROJETÉ passe sous le pas minimal (anti-empilement : au loin,
        // les transversales s'éteignent, les CONVERGENTES filent seules vers le point de fuite).
        let strokeBase: string | undefined;
        let wMj = LOD.meshJointWM;
        if (det?.courses) {
          strokeBase = det.courses.joint;
          wMj = det.courses.jointW;
        } else if (def?.walkable) {
          const wIn = Math.min(1, Math.max(0, (depthTiles - LOD.meshStartT) / LOD.meshFadeT));
          if (wIn > 0) strokeBase = mixHex(base, shade(base, LOD.meshShade), wIn);
        }
        if (strokeBase) {
          const NO = { x: (x - 0.5) * mpt, y: (y - 0.5) * mpt, z: h };
          const NE = { x: (x + 0.5) * mpt, y: (y - 0.5) * mpt, z: h };
          const SE = { x: (x + 0.5) * mpt, y: (y + 0.5) * mpt, z: h };
          const SO = { x: (x - 0.5) * mpt, y: (y + 0.5) * mpt, z: h };
          // Écrasement projeté de chaque paire : distance écran entre les MILIEUX des arêtes opposées.
          const gap = (a: Vec3, b: Vec3): number => {
            const pa = project(cam, a);
            const pb = project(cam, b);
            return pa.behind || pb.behind ? Number.POSITIVE_INFINITY : Math.hypot(pa.sx - pb.sx, pa.sy - pb.sy);
          };
          const midN = { x: x * mpt, y: (y - 0.5) * mpt, z: h };
          const midS = { x: x * mpt, y: (y + 0.5) * mpt, z: h };
          const midE = { x: (x + 0.5) * mpt, y: y * mpt, z: h };
          const midO = { x: (x - 0.5) * mpt, y: y * mpt, z: h };
          const wNS = Math.min(1, Math.max(0, gap(midN, midS) / LOD.minJointSpacingPx - 1));
          const wEO = Math.min(1, Math.max(0, gap(midE, midO) / LOD.minJointSpacingPx - 1));
          const fogT = fogAt(depthTiles, curve);
          const strokeW = Math.max(0.3, (wMj * fx) / it.depth);
          const meshDepth = it.depth - FLOOR_BIAS + 0.005; // entre SON remplissage (peint avant) et les rangs
          const push = (d: string, w: number, suffix: string): void => {
            if (!d || w <= 0) return;
            items.push({
              path: d,
              stroke: tint(mixHex(base, strokeBase!, w), fLv, fogT, fog),
              strokeW,
              depth: meshDepth,
              key: `mesh:${x},${y},${z}${suffix}`,
              kind: 'detail',
            });
          };
          if (Math.abs(wNS - wEO) < 0.05) {
            // Poids équivalents (cas proche) : UN seul tracé pour les 4 arêtes.
            push(segSub(NO, NE, cam) + segSub(SE, SO, cam) + segSub(NE, SE, cam) + segSub(SO, NO, cam), wNS, '');
          } else {
            push(segSub(NO, NE, cam) + segSub(SE, SO, cam), wNS, ':ns'); // arêtes N + S
            push(segSub(NE, SE, cam) + segSub(SO, NO, cam), wEO, ':eo'); // arêtes E + O
          }
        }
      }
    });
    // PLAFOND : intérieur, couche du groupe, colonne VUE seulement (une silhouette de plafond serait
    // invisible sur le fond de brume intérieure — on économise l'item).
    if (indoor && z === cam.z && seen) {
      const ceil = makeItem(tileCornersWorld(scene, x, y, z, true), cam, farMetres, lv, CEIL_BASE, 'ceiling', `ceil:${x},${y},${z}`, 0, fog, curve);
      if (ceil) items.push(ceil);
    }
    // PLAFOND GÉNÉRAL : une tuile COUVERTE par un solide au-dessus (tunnel de porte, pont, surplomb) montre
    // son DESSOUS depuis dessous — l'iso occlut par le haut, le POV a besoin de la voûte. Aucune notion
    // d'élément : c'est vrai pour tout ce qui est couvert. À la couche de l'œil (extérieur ; l'intérieur
    // est déjà traité ci-dessus). Voûte de PIERRE à la hauteur du dessous du solide couvrant.
    if (!indoor && z === cam.z && seen) {
      const coverH = coveringHeight(scene, x, y, z);
      if (coverH != null) {
        const cc: Vec3[] = [
          { x: (x - 0.5) * mpt, y: (y - 0.5) * mpt, z: coverH },
          { x: (x + 0.5) * mpt, y: (y - 0.5) * mpt, z: coverH },
          { x: (x + 0.5) * mpt, y: (y + 0.5) * mpt, z: coverH },
          { x: (x - 0.5) * mpt, y: (y + 0.5) * mpt, z: coverH },
        ];
        const ceil = makeItem(cc, cam, farMetres, lv, COVER_CEIL_BASE, 'ceiling', `coverceil:${x},${y},${z}`, 0, fog, curve);
        if (ceil) items.push(ceil);
      }
    }
  }

  // MURS d'arête — géométrie PARTAGÉE du pivot (`buildWalls`, les MÊMES faces monde que l'iso) : le POV
  // projette chaque face (GP grille+mètres → mètres monde par `mpt`) avec sa caméra + clip + teinte, la
  // couleur de base venant de `wallPartColor` (source unique avec l'affine). Le détail BOIS (panneau/
  // moulure/plinthe/embrasure) est visible en POV comme en iso, sans divergence de niveau de détail.
  // Colonne NON VISIBLE = matière réelle sous lumière d'AMBIANCE + brume de distance (un rempart lointain
  // se fond, ne se troue pas), SANS appareillage fin ; PORTE ouverte (state `open`) = passage béant ;
  // structure ABATTUE = faces de brèche (tas de gravats). Les MONTANTS (poteau/jambage, 2 points)
  // restent un ornement d'écran affine.
  for (const el of buildWalls(scene)) {
    const seen = cols.has(`${el.cell.x},${el.cell.y}`);
    const lv = staticLight(light, seen, el.cell.x, el.cell.y, el.cell.z);
    el.faces.forEach((f, i) => {
      if (el.states.open && !f.architectureFeatureId) return;
      if (f.poly.length < 3) return; // montant 2 points : hors POV (LOD minimal)
      const app = facadeStructureAppearance(f.material.id);
      const corners: Vec3[] = f.poly.map((p) => ({ x: p.x * mpt, y: p.y * mpt, z: p.h }));
      const part = f.material.part as WallPart;
      // VITRE de fenêtre allumée la NUIT : ambre ÉMISSIF (lumière ~pleine, non assombrie par la nuit) +
      // classe `warm` (scintillement) → une fenêtre éclairée dans le noir = signal de bâtiment fort.
      const lit = part === 'vitre' && night;
      const base = lit ? windowLit(app) : wallPartColor(app, part);
      // Peintre INTRA-mur : les faces s'empilent dans l'ordre du builder (détail PAR-DESSUS le fond) —
      // biais NÉGATIF croissant (plus proche), trop petit pour déclasser deux murs distincts.
      const faceKey = f.architectureFeatureId
        ? `${el.key}:feature:${f.architectureFeatureId}:${i}:${part}`
        : `${el.key}:${i}:${part}`;
      const it = makeItem(corners, cam, farMetres, lit ? Math.max(lv, 0.95) : lv, base, 'wall', faceKey, -i * 0.002, fog, curve);
      if (!it) return;
      if (lit) it.cls = 'warm';
      // VITRE de JOUR : verre QUASI-INVISIBLE (opacity 0.1) → la fenêtre est une vraie OUVERTURE, on voit
      // la géométrie DERRIÈRE (l'intérieur depuis dehors, l'extérieur depuis dedans). AUCUNE dalle opaque
      // derrière (elle bloquerait la vue). La nuit : vitre ambrée PLEINE (fenêtre éclairée, pas d'ouverture).
      if (part === 'vitre' && !lit) it.opacity = 0.1;
      items.push(it);
      if (!seen) return; // non vu : forme + matière, pas d'appareillage fin (réservé au vu)
      // APPAREILLAGE au LOD de distance en FONDU (parts maçonnées d'une def à recette — même aiguillage
      // COURSED que l'iso ; nuances de bloc sur la GRANDE face seulement, comme les accents iso).
      const det = app.detail;
      if (!det?.courses || !COURSED.has(part) || f.poly.length !== 4) return;
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
      items.push(...courseDetailItems(recipe, frame, seed, it.depth, depthTiles, cam, lv, base, `${el.key}:${i}:${part}`, fog, curve));
    });
  }

  // TOITS — géométrie PARTAGÉE du pivot (`buildRoofs`, les MÊMES pans continus que l'iso). Teinte du
  // pan = def[orientation] du matériau (part N/E/S/O — les mêmes couleurs que l'iso). CUTAWAY POV :
  // le groupe DANS l'empreinte (`roofOccupied`, case de l'œil dérivée de la caméra) est DESSOUS →
  // pas de pans, mais le PLAFOND intérieur de l'empreinte (même convention que l'indoor : surface +
  // WALL_H_M, ton `plafond`) — une scène `interieur` a déjà son plafond tuile à tuile, on ne double pas.
  const eyeCell = { x: Math.round(cam.eye.x / mpt), y: Math.round(cam.eye.y / mpt) };
  // TOUS les toits (pas de gate `visible` du builder) : un toit dont AUCUNE case de l'empreinte élargie
  // d'1 n'est en colonne vue est rendu avec sa VRAIE tuile sous lumière d'AMBIANCE + brume de distance —
  // au lieu de disparaître (trou de ciel) ou de blanchir en brume, le bâtiment se fond au loin.
  for (const el of buildRoofs(scene, { allies: [eyeCell] })) {
    const z = el.cell.z;
    let seen = false;
    for (let dy = -1; dy <= el.span.h && !seen; dy++)
      for (let dx = -1; dx <= el.span.w && !seen; dx++) if (cols.has(`${el.cell.x + dx},${el.cell.y + dy}`)) seen = true;
    if (el.states.roofOccupied) {
      if (indoor) continue;
      for (let dy = 0; dy < el.span.h; dy++)
        for (let dx = 0; dx < el.span.w; dx++) {
          const x = el.cell.x + dx;
          const y = el.cell.y + dy;
          if (!cols.has(`${x},${y}`)) continue;
          const ceil = makeItem(tileCornersWorld(scene, x, y, z, true), cam, farMetres, light.at(x, y, z), CEIL_BASE, 'ceiling', `roofceil:${x},${y},${z}`, 0, fog, curve);
          if (ceil) items.push(ceil);
        }
      continue;
    }
    const sh = roofMaterial(el.material);
    const lv = staticLight(light, seen, el.cell.x, el.cell.y, z);
    el.faces.forEach((f, i) => {
      const corners: Vec3[] = f.poly.map((p) => ({ x: p.x * mpt, y: p.y * mpt, z: p.h }));
      // VOLUME d'avant-toit : le SOFFITE débordant (dessous ombré) et la FASCIA (planche de rive sombre)
      // ont leur ton DÉDIÉ de la def → l'ombre sous l'égout se voit en première personne ; un pan ordinaire
      // suit son orientation N/E/S/O (les mêmes couleurs que l'iso).
      const part = f.material.part;
      const base =
        part === 'soffite' ? sh.soffite ?? sh.S ?? sh.N ?? FLOOR_FALLBACK
        : part === 'fascia' ? sh.fascia ?? sh.line ?? sh.S ?? sh.N ?? FLOOR_FALLBACK
        : sh[part as CellSide] ?? sh.N ?? FLOOR_FALLBACK;
      // `nearRef` : un pan est GRAND (bâtiment entier) — portée/brume à son bord le plus proche.
      const it = makeItem(corners, cam, farMetres, lv, base, 'roof', `${el.key}:${i}`, 0, fog, curve, true);
      if (it) items.push(it);
    });
  }

  // Peintre : loin d'abord (depth DÉCROISSANT).
  items.sort((a, b) => b.depth - a.depth);
  return items;
}

/**
 * POV — assemblage de la LISTE DE DESSIN (polygones SVG) d'une scène vue en première personne. PUR.
 *
 * Sols/relief et murs viennent des BUILDERS partagés du pivot (`buildFloors`/`buildWalls`, les mêmes
 * faces monde que l'iso) ; seuls les plafonds restent dérivés ici (spécifique POV). Chaque surface est
 * prise en MONDE (camera.ts), clippée au plan proche, projetée en pixels, teintée (lumière + brouillard),
 * puis triée du plus LOIN au plus PROCHE (peintre). La visibilité (brouillard de guerre) est fournie par
 * l'appelant (Set de clés « x,y,z ») ; la lumière par un champ structurel `{ at(x,y,z) → 0..1 }`.
 */
import {
  project,
  clipNear,
  tileCornersWorld,
  tint,
  fogAt,
  FAR_TILES,
  fx,
  VW,
  FOG_COLOR,
  type CamPose,
  type Vec3,
} from './camera';
import { sceneMetresPerTile, isIndoor, type Scene } from '../../state/scene';
import { TERRAIN_DEFS } from '../../state/terrain';
import { buildFloors } from '../builders/floors';
import { buildWalls } from '../builders/walls';
import { structureAppearance, wallPartColor, type WallPart } from '../catalog/structures';
import { reliefMaterial } from '../catalog/relief';
import { AMBIANCE } from '../catalog/ambiance';

/** Une pièce dessinable : polygone écran (points), couleur, profondeur de tri, clé stable, nature. */
export type DrawItem = {
  points: [number, number][];
  fill: string;
  depth: number;
  key: string;
  kind: 'floor' | 'wall' | 'ceiling' | 'riser';
};

// Les SOLS suivent le `swatch` du terrain — donnée PARTAGÉE avec l'iso/l'éditeur : recolorer un terrain
// recolore AUSSI le POV (rien de spécifique au POV). Les MURS suivent leur APPARENCE partagée
// (`structureAppearance`, la même def que walls.ts consomme) : face/bandes/arase/merlons/herse viennent
// TOUS de la def — palette pierre UNIFIÉE en hex dans le JSON (plus de `var(--struct-*)` à résoudre).
// Tout est ensuite teinté par la lumière + la brume de distance (`AMBIANCE.pov`).
export const FLOOR_FALLBACK = reliefMaterial('sol-inconnu').face; // sol sans terrain connu
export const CEIL_BASE = reliefMaterial('plafond').face; // plafond (INTÉRIEUR uniquement)

/** Couleur pleine d'un terrain (`TerrainDef.swatch`, donnée partagée iso ⇄ POV). */
const TERRAIN_SWATCH: Map<string, string> = new Map(TERRAIN_DEFS.map((t) => [t.id, t.swatch]));

/** LOD minimaliste des ASSISES en POV : joints simples dessinés jusqu'à cette profondeur (cases). */
const COURSES_MAX_TILES = 6;
/** Demi-épaisseur MONDE (m) d'une ligne de joint POV. */
const JOINT_HALF_M = 0.02;

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

/** Le polygone est-il ENTIÈREMENT hors du FOV horizontal (tous les sommets au-delà de ±(1+marge) NDC,
 *  du MÊME côté) ? Rejet conservateur (garde ce qui traverse le bord). Sommets déjà clippés (Zc ≥ NEAR). */
function outsideFov(cornersWorld: Vec3[], cam: CamPose): boolean {
  const margin = 0.15;
  let allLeft = true;
  let allRight = true;
  for (const p of cornersWorld) {
    const pr = project(cam, p);
    const ndc = (pr.sx - VW / 2) / (fx || 1); // = Xc/Zc, NDC horizontal (avant le ×fx)
    if (ndc > -(1 + margin)) allLeft = false;
    if (ndc < 1 + margin) allRight = false;
  }
  return allLeft || allRight;
}

/** Construit un `DrawItem` à partir de coins monde : clippe, cull (derrière / au-delà de FAR / hors FOV),
 *  projette, teinte. Renvoie null si rien à dessiner. `lightVal` = lumière de la surface. */
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
): DrawItem | null {
  const clipped = clipNear(cornersWorld, cam);
  if (clipped.length < 3) return null; // entièrement derrière (ou dégénéré)
  const c = centroid(clipped);
  const cp = project(cam, c);
  if (cp.depth > farMetres) return null; // au-delà de la portée
  if (outsideFov(clipped, cam)) return null; // hors du champ horizontal
  const points: [number, number][] = clipped.map((p) => {
    const pr = project(cam, p);
    return [pr.sx, pr.sy];
  });
  const depthTiles = cp.depth / cam.mpt;
  const fill = tint(base, lightVal, fogAt(depthTiles), fogColor);
  return { points, fill, depth: cp.depth + depthBias, key, kind };
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
 *  par COLONNE visible (pas par tuile) pour voir aussi ce qui monte au-dessus.
 *  Tout vient de la scène PARTAGÉE (hauteurs, murs, portes) : éditer en iso impacte le POV.
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
        const base = TERRAIN_SWATCH.get(f.material.id) ?? FLOOR_FALLBACK;
        const it = makeItem(corners, cam, farMetres, lv, base, 'floor', wedge ? `${el.key}:${i}:wedge` : el.key, wedge ? FLOOR_BIAS - 0.005 : FLOOR_BIAS, fog);
        if (it) items.push(it);
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
      // Peintre INTRA-mur : les faces s'empilent dans l'ordre du builder (détail PAR-DESSUS le fond) —
      // biais NÉGATIF croissant (plus proche), trop petit pour déclasser deux murs distincts.
      const it = makeItem(corners, cam, farMetres, lv, wallPartColor(app, f.material.part as WallPart), 'wall', `${el.key}:${i}:${f.material.part}`, -i * 0.002, fog);
      if (!it) return;
      items.push(it);
      // ASSISES au LOD minimaliste POV : sur la GRANDE face d'une def à recette, joints HORIZONTAUX
      // simples (rangs droits, sans blocs ni tremblé) jusqu'à COURSES_MAX_TILES — au-delà, la brume
      // fait le travail. Quads MONDE minces au ton du joint, empilés juste devant leur face.
      const c = app.detail?.courses;
      if (!c || f.material.part !== 'face' || it.depth / cam.mpt > COURSES_MAX_TILES) return;
      const hTop = f.poly[0].h, hBot = f.poly[3].h;
      const n = Math.max(1, Math.round((hTop - hBot) / c.hM));
      const [A, B] = [f.poly[0], f.poly[1]];
      for (let k = 1; k < n; k++) {
        const h = hBot + (hTop - hBot) * (k / n);
        const quad: Vec3[] = [
          { x: A.x * mpt, y: A.y * mpt, z: h + JOINT_HALF_M },
          { x: B.x * mpt, y: B.y * mpt, z: h + JOINT_HALF_M },
          { x: B.x * mpt, y: B.y * mpt, z: h - JOINT_HALF_M },
          { x: A.x * mpt, y: A.y * mpt, z: h - JOINT_HALF_M },
        ];
        const jt = makeItem(quad, cam, farMetres, lv, c.joint, 'wall', `${el.key}:${i}:joint${k}`, -i * 0.002 - 0.001, fog);
        if (jt) items.push(jt);
      }
    });
  }

  // Peintre : loin d'abord (depth DÉCROISSANT).
  items.sort((a, b) => b.depth - a.depth);
  return items;
}

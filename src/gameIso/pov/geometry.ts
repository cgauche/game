/**
 * POV — assemblage de la LISTE DE DESSIN (polygones SVG) d'une scène vue en première personne. PUR.
 *
 * v1 = couche COURANTE du groupe seule (`cam.z`) : sols + plafonds + cloisons d'arête. Chaque surface
 * est prise en MONDE (camera.ts), clippée au plan proche, projetée en pixels, teintée (lumière + brouillard),
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
import { sceneMetresPerTile, tileAt, heightAt, isIndoor, type Scene } from '../../state/scene';
import { TERRAIN_DEFS } from '../../state/terrain';
import { buildWalls } from '../builders/walls';
import { structureAppearance, wallPartColor, type WallPart } from '../catalog/structures';
import { reliefMaterial } from '../catalog/relief';

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
// TOUS de la def — plus AUCUNE couleur de mur en dur ni regex ici. Tout est ensuite teinté par la lumière
// + la brume de distance.
export const FLOOR_FALLBACK = reliefMaterial('sol-inconnu').face; // sol sans terrain connu
export const CEIL_BASE = reliefMaterial('plafond').face; // plafond (INTÉRIEUR uniquement)
const RISER_ROCK = reliefMaterial('riser').face; // face verticale (falaise/marche/rampe/rempart) : roche/maçonnerie, PAS la couleur du sol
export const FOG_OUTDOOR = '#9fb2c6'; // brume claire (ciel) en extérieur ; intérieur = FOG_COLOR sombre (PovStage cale l'horizon du ciel dessus)

/** Couleur pleine d'un terrain (`TerrainDef.swatch`, donnée partagée iso ⇄ POV). */
const TERRAIN_SWATCH: Map<string, string> = new Map(TERRAIN_DEFS.map((t) => [t.id, t.swatch]));
const floorColor = (scene: Scene, x: number, y: number, z: number): string =>
  TERRAIN_SWATCH.get(tileAt(scene, x, y, z)) ?? FLOOR_FALLBACK;

// ── Résolution de couleur : les defs de pierre portent des couleurs `var(--struct-*)` (partagées avec
//    l'iso, définies dans src/ui/styles/base.css) ; mais `tint` du POV attend un hex `#rrggbb`. On résout
//    donc chaque `var(--x)` vers son hex — via getComputedStyle en navigateur, sinon un repli miroir de
//    base.css (tests hors-DOM). Un hex (bois : couleurs littérales de la def) passe tel quel.
/** Repli hors-DOM (tests) — miroir de src/ui/styles/base.css ; en navigateur on lit la vraie valeur. */
const STRUCT_FALLBACK: Record<string, string> = {
  '--struct-face': '#6b6f76', '--struct-band': '#34373c', '--struct-cap': '#888d95',
  '--struct-rubble': '#463f35', '--struct-rubble-hi': '#6a6253',
};
const cssCache = new Map<string, string>();
/** Résout `var(--x)` → hex (getComputedStyle, sinon repli base.css) ; un hex est renvoyé tel quel. PUR-ish (lecture DOM cachée). */
function resolveCss(c: string): string {
  if (!c.startsWith('var(')) return c;
  const name = c.slice(4, -1).trim(); // --struct-face
  if (cssCache.has(name)) return cssCache.get(name)!;
  let hex = '';
  try { hex = getComputedStyle(document.documentElement).getPropertyValue(name).trim(); } catch { /* pas de DOM */ }
  const out = hex.startsWith('#') ? hex : (STRUCT_FALLBACK[name] ?? '#808080');
  cssCache.set(name, out); return out;
}

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

/** Hauteur du DESSUS de la colonne voisine (surface la PLUS HAUTE, toutes couches ; hors-carte/vide → 0).
 *  Une face verticale n'est dessinée QUE si la case dépasse ce dessus (marche/falaise RÉELLE) — deux cases
 *  coplanaires (ex. un chemin de ronde plat) ne produisent AUCUN riser. PUR. */
function neighborTop(scene: Scene, nx: number, ny: number): number {
  let best = -Infinity;
  for (const L of scene.layers) {
    if (tileAt(scene, nx, ny, L.z) === 'vide') continue;
    const hz = heightAt(scene, nx, ny, L.z);
    if (hz > best) best = hz;
  }
  return best === -Infinity ? 0 : best;
}

const SIDES = ['N', 'E', 'S', 'O'] as const;
const SIDE_DELTA: Record<(typeof SIDES)[number], [number, number]> = { N: [0, -1], E: [1, 0], S: [0, 1], O: [-1, 0] };

/** Coins MONDE d'une FACE VERTICALE (falaise/marche/rampe) sur l'arête cardinale d'une case, de `hBas` à
 *  `hHaut`. Mêmes extrémités A,B par côté que `wallCornersWorld` → géométrie d'arête cohérente. PUR. */
function riserCornersWorld(mpt: number, x: number, y: number, side: (typeof SIDES)[number], hBas: number, hHaut: number): Vec3[] {
  let A: { x: number; y: number };
  let B: { x: number; y: number };
  switch (side) {
    case 'N': A = { x: x - 0.5, y: y - 0.5 }; B = { x: x + 0.5, y: y - 0.5 }; break;
    case 'E': A = { x: x + 0.5, y: y - 0.5 }; B = { x: x + 0.5, y: y + 0.5 }; break;
    case 'S': A = { x: x + 0.5, y: y + 0.5 }; B = { x: x - 0.5, y: y + 0.5 }; break;
    default:  A = { x: x - 0.5, y: y + 0.5 }; B = { x: x - 0.5, y: y - 0.5 }; break;
  }
  return [
    { x: A.x * mpt, y: A.y * mpt, z: hBas },
    { x: B.x * mpt, y: B.y * mpt, z: hBas },
    { x: B.x * mpt, y: B.y * mpt, z: hHaut },
    { x: A.x * mpt, y: A.y * mpt, z: hHaut },
  ];
}

/** Assemble la liste de dessin POV en HEIGHTFIELD SOLIDE. Trie du plus LOIN au plus PROCHE. PUR.
 *  Pour chaque COLONNE visible (x,y) et chaque couche, rend le SOL à sa hauteur + les FACES VERTICALES
 *  (falaise/marche/rampe) vers les voisins plus bas → le relief (remparts, plateformes, rampes) devient
 *  SOLIDE (fin du « on voit à travers »). Les MURS d'arête s'élèvent depuis la hauteur de leur colonne
 *  (parapet sur plateforme). On rend par COLONNE (pas par tuile) pour voir aussi ce qui monte au-dessus.
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
  const fog = indoor ? FOG_COLOR : FOG_OUTDOOR;
  const { w, h: H } = scene.dimensions;
  const cols = visibleColumns(visible);
  const items: DrawItem[] = [];

  for (const layer of scene.layers) {
    const z = layer.z;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < w; x++) {
        if (!cols.has(`${x},${y}`)) continue;
        if (tileAt(scene, x, y, z) === 'vide') continue; // pas de surface réelle sur cette couche ici
        const hh = heightAt(scene, x, y, z);
        const lv = light.at(x, y, z);
        const base = floorColor(scene, x, y, z); // couleur du terrain (donnée partagée)
        // SOL (dessus de la case, à sa hauteur).
        const floor = makeItem(tileCornersWorld(scene, x, y, z, false), cam, farMetres, lv, base, 'floor', `floor:${x},${y},${z}`, FLOOR_BIAS, fog);
        if (floor) items.push(floor);
        // FACES VERTICALES vers les voisins plus bas (falaise/marche/rampe) → relief solide, ombré.
        for (const side of SIDES) {
          const [dx, dy] = SIDE_DELTA[side];
          const nb = neighborTop(scene, x + dx, y + dy); // dessus du voisin
          if (hh - nb > 0.3) {
            const r = makeItem(riserCornersWorld(mpt, x, y, side, nb, hh), cam, farMetres, lv * 0.82, RISER_ROCK, 'riser', `riser:${x},${y},${z},${side}`, 0, fog);
            if (r) items.push(r);
          }
        }
        // PLAFOND : intérieur, couche du groupe seulement.
        if (indoor && z === cam.z) {
          const ceil = makeItem(tileCornersWorld(scene, x, y, z, true), cam, farMetres, lv, CEIL_BASE, 'ceiling', `ceil:${x},${y},${z}`, 0, fog);
          if (ceil) items.push(ceil);
        }
      }
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
      const it = makeItem(corners, cam, farMetres, lv, resolveCss(wallPartColor(app, f.material.part as WallPart)), 'wall', `${el.key}:${i}:${f.material.part}`, -i * 0.002, fog);
      if (it) items.push(it);
    });
  }

  // Peintre : loin d'abord (depth DÉCROISSANT).
  items.sort((a, b) => b.depth - a.depth);
  return items;
}

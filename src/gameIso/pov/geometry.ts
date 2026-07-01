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
  WALL_H_M,
  type CamPose,
  type Vec3,
} from './camera';
import { sceneMetresPerTile, tileAt, heightAt, isIndoor, doorIsOpen, structureIsDown, type Scene, type WallSeg } from '../../state/scene';
import { TERRAIN_DEFS } from '../../state/terrain';
import { WALL_H, LEVEL_H } from '../iso';
import { structureAppearance, type StructureAppearanceDef } from '../catalog/structures';

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
export const FLOOR_FALLBACK = '#6b6250'; // sol sans terrain connu
export const CEIL_BASE = '#2c2a26'; // plafond (INTÉRIEUR uniquement)
const RISER_ROCK = '#57534c'; // face verticale (falaise/marche/rampe/rempart) : roche/maçonnerie, PAS la couleur du sol
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

/** Convertit une hauteur ISO en px (def : `WALL_H`, `LEVEL_H`, merlonHeightPx…) en mètres MONDE. Une
 *  cloison d'arête vaut `WALL_H` px ⇔ `WALL_H_M` m → toute hauteur px suit le même facteur. PUR. */
const pxToM = (px: number): number => (px / WALL_H) * WALL_H_M;

/** Apparence d'un mur — DONNÉE, ZÉRO regex : un mur qui porte une `structure` prend sa def ; un mur SANS
 *  structure prend `mur-en-pierre` s'il est SURÉLEVÉ (base > 1 m : parapet de rempart, il faut créneaux)
 *  sinon `plain` (colombage du Bourg au sol). */
const wallApp = (seg: WallSeg, baseH: number): StructureAppearanceDef =>
  seg.structure ? structureAppearance(seg.structure) : structureAppearance(baseH > 1 ? 'mur-en-pierre' : 'plain');

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

/** Extrémités A,B (coords de tuile) de l'arête d'un `WallSeg` selon son `side` — MÊME aiguillage que
 *  `wallCornersWorld` (N/E/`\`/`/`) → géométrie d'arête cohérente entre face, parapet, merlons et herse. */
function segEnds(seg: WallSeg): { A: { x: number; y: number }; B: { x: number; y: number } } {
  const { x, y } = seg;
  switch (seg.side) {
    case 'N': return { A: { x: x - 0.5, y: y - 0.5 }, B: { x: x + 0.5, y: y - 0.5 } };
    case 'E': return { A: { x: x + 0.5, y: y - 0.5 }, B: { x: x + 0.5, y: y + 0.5 } };
    case '\\': return { A: { x: x - 0.5, y: y - 0.5 }, B: { x: x + 0.5, y: y + 0.5 } };
    default: return { A: { x: x + 0.5, y: y - 0.5 }, B: { x: x - 0.5, y: y + 0.5 } }; // '/'
  }
}

/** Quad MONDE de la face de l'arête d'un `WallSeg` entre `hBas` et `hHaut` (mètres). Ordre
 *  [A@bas, B@bas, B@haut, A@haut] — comme `wallCornersWorld`, pour un clip convexe cohérent. PUR. */
function edgeFaceWorld(scene: Scene, seg: WallSeg, hBas: number, hHaut: number): Vec3[] {
  const mpt = sceneMetresPerTile(scene);
  const { A, B } = segEnds(seg);
  return [
    { x: A.x * mpt, y: A.y * mpt, z: hBas },
    { x: B.x * mpt, y: B.y * mpt, z: hBas },
    { x: B.x * mpt, y: B.y * mpt, z: hHaut },
    { x: A.x * mpt, y: A.y * mpt, z: hHaut },
  ];
}

/** Quad MONDE d'un TRONÇON de l'arête (interpolé A→B sur `[t0,t1]`) entre `hBas` et `hHaut` (mètres) —
 *  brique des merlons (par pas le long du sommet) et des barreaux de herse (fines bandes verticales). PUR. */
function edgeSpanWorld(scene: Scene, seg: WallSeg, t0: number, t1: number, hBas: number, hHaut: number): Vec3[] {
  const mpt = sceneMetresPerTile(scene);
  const { A, B } = segEnds(seg);
  const px = (t: number) => (A.x + (B.x - A.x) * t) * mpt;
  const py = (t: number) => (A.y + (B.y - A.y) * t) * mpt;
  return [
    { x: px(t0), y: py(t0), z: hBas },
    { x: px(t1), y: py(t1), z: hBas },
    { x: px(t1), y: py(t1), z: hHaut },
    { x: px(t0), y: py(t0), z: hHaut },
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

  // MURS d'arête — géométrie & couleurs TOUTES tirées de l'apparence partagée (`structureAppearance`, la
  // même def que walls.ts). Colonne visible requise ; PORTE ouverte / STRUCTURE abattue (brèche) = passage
  // béant. Chaque mur assemble : face pleine (repli d'une ouverture au-dessus du linteau), parapet crénelé
  // (parapet + ferrure + arase + merlons) et herse (barreaux) — chacun selon les champs présents de la def.
  for (const seg of scene.walls ?? []) {
    if (!cols.has(`${seg.x},${seg.y}`)) continue;
    if ((seg.door && doorIsOpen(scene, seg)) || (seg.structure && structureIsDown(scene, seg))) continue;
    const z = seg.z ?? 0;
    const baseH = heightAt(scene, seg.x, seg.y, z);
    const app = wallApp(seg, baseH);
    const lv = light.at(seg.x, seg.y, z);
    const key = `${seg.x},${seg.y},${seg.side},${z}`;
    const H1 = baseH + WALL_H_M; // sommet de la face pleine (mètres)
    const push = (corners: Vec3[], color: string, k: string, bias: number) => {
      const it = makeItem(corners, cam, farMetres, lv, color, 'wall', k, bias, fog);
      if (it) items.push(it);
    };

    // (a) FACE PLEINE — sauf ouverture BÉANTE (openingFrac ≥ 1 : corps de garde traversant). Une porte
    //     à ouverture partielle ne rend que la portion AU-DESSUS de l'ouverture (linteau → sommet).
    if (!(app.door && app.door.openingFrac >= 1)) {
      const hOpen = app.door ? baseH + pxToM(WALL_H * app.door.openingFrac) : baseH;
      push(edgeFaceWorld(scene, seg, hOpen, H1), resolveCss(app.face), `wall:${key}`, 0);
    }

    // (b) PARAPET (fortification) : dosseret plein + ferrure de fer + arase de couronnement.
    const par = app.parapet;
    if (par) {
      const P = pxToM(LEVEL_H * par.heightLevelFrac); // hauteur dressée du parapet (mètres)
      push(edgeFaceWorld(scene, seg, H1, H1 + P), resolveCss(app.face), `parapet:${key}`, 0.02);
      const bandLo = H1 + P * par.parapetBandFrac;
      push(edgeFaceWorld(scene, seg, bandLo, bandLo + pxToM(par.bandThickPx)), resolveCss(app.band ?? app.face), `parband:${key}`, 0.03);
      push(edgeFaceWorld(scene, seg, H1 + P - pxToM(par.arasePx), H1 + P), resolveCss(app.cap ?? app.face), `arase:${key}`, 0.03);

      // (c) MERLONS — créneaux au sommet : un merlon tous les `merlonStep` tronçons sur `merlonCount`.
      const capC = resolveCss(app.cap ?? app.face);
      const mTop = H1 + P + pxToM(par.merlonHeightPx);
      for (let i = 0; i < par.merlonCount; i += par.merlonStep) {
        push(edgeSpanWorld(scene, seg, i / par.merlonCount, (i + 1) / par.merlonCount, H1 + P, mTop), capC, `merlon:${key},${i}`, 0.04);
      }
    }

    // (d) HERSE — grille de barreaux verticaux pendant du linteau (portail de fort barré).
    const herse = app.door?.herse;
    if (herse) {
      const barC = resolveCss(app.band ?? app.face);
      const hTop = baseH + pxToM(WALL_H * herse.topFrac);
      const eps = 0.02; // demi-largeur d'un barreau (fraction d'arête)
      for (let k = 0; k <= herse.bars; k++) {
        const t = k / herse.bars;
        push(edgeSpanWorld(scene, seg, Math.max(0, t - eps), Math.min(1, t + eps), baseH, hTop), barC, `herse:${key},${k}`, 0.05);
      }
    }
  }

  // Peintre : loin d'abord (depth DÉCROISSANT).
  items.sort((a, b) => b.depth - a.depth);
  return items;
}

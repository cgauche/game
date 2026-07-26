/**
 * Détection PURE des défauts de plan, à partir de la Scène compilée (`buildScene`) — jamais de
 * l'ASCII source. Chiffres validés sur La Diligence (corps principal) : voir `check.test.ts`.
 */
import type { Scene } from '../../src/state/scene';
import { descriptiveZoneIndex, edgeExists, scenesZ, terrainAt, type Edge4 } from './geometry';
import type { MapEntry } from './registry';

export type DefectFamily =
  | 'facade-decalee'
  | 'mur-manquant'
  | 'etage-sur-exterior'
  | 'case-sans-zone'
  | 'etage-sans-appui';

export interface Defect {
  family: DefectFamily;
  /** Étage/case de la GRILLE à corriger (pas forcément l'étage `above` du scan). */
  grid: 'walled';
  z: number;
  x: number;
  y: number;
  side?: Edge4;
  detail: string;
}

export interface ZoneDefect {
  family: 'etage-sur-exterior' | 'case-sans-zone';
  grid: 'walled' | 'zone';
  z: number;
  x: number;
  y: number;
  detail: string;
}

export interface Tremie {
  x: number;
  y: number;
  z: number;
  legitimate: boolean;
  detail: string;
}

const isFloor = (scene: Scene, x: number, y: number, z: number) => terrainAt(scene, x, y, z) !== 'vide';

/** Composante connexe de vide (à l'étage `z`) qui ATTEINT le bord de la grille — donc communique avec le
 *  dehors véritable — par opposition à une poche de vide ENCERCLÉE par la dalle bâtie (trémie/mezzanine,
 *  garde-corps de galerie sur un vide central). Critère GÉOMÉTRIQUE, ne dépend d'aucune zone déclarée :
 *  marche même sans `zoneMap` (#823 défaut 1), et distingue correctement le vide au-dessus d'une annexe de
 *  plain-pied — qui rejoint le dehors, donc EXIGE un mur — d'un puits interne (#823 défaut 2 : l'ancien
 *  critère zonal, basé sur la présentation `interior`/`exterior` du dessous, filtrait aussi ces jonctions
 *  d'annexe puisque leur zone y est souvent `interior`). */
function exteriorVoidCells(scene: Scene, z: number): Set<string> {
  const { w, h } = scene.dimensions;
  const isVide = (x: number, y: number) => terrainAt(scene, x, y, z) === 'vide';
  const visited = new Set<string>();
  const exterior = new Set<string>();
  for (let y0 = 0; y0 < h; y0++) {
    for (let x0 = 0; x0 < w; x0++) {
      const key0 = `${x0},${y0}`;
      if (visited.has(key0) || !isVide(x0, y0)) continue;
      const stack: [number, number][] = [[x0, y0]];
      const comp: [number, number][] = [];
      visited.add(key0);
      let touchesBorder = false;
      while (stack.length) {
        const [cx, cy] = stack.pop()!;
        comp.push([cx, cy]);
        if (cx === 0 || cy === 0 || cx === w - 1 || cy === h - 1) touchesBorder = true;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) { touchesBorder = true; continue; }
          const nk = `${nx},${ny}`;
          if (visited.has(nk) || !isVide(nx, ny)) continue;
          visited.add(nk);
          stack.push([nx, ny]);
        }
      }
      if (touchesBorder) for (const [cx, cy] of comp) exterior.add(`${cx},${cy}`);
    }
  }
  return exterior;
}

const NEIGHBOR_EDGE: Record<Edge4, { x: number; y: number }> = { O: { x: -1, y: 0 }, E: { x: 1, y: 0 }, N: { x: 0, y: -1 }, S: { x: 0, y: 1 } };

const SHIFT: Record<Edge4, [number, number][]> = {
  O: [[-1, 0], [1, 0]],
  E: [[-1, 0], [1, 0]],
  N: [[0, -1], [0, 1]],
  S: [[0, -1], [0, 1]],
};

/** Familles 1 (façade décalée) et 2 (mur manquant) — arêtes du périmètre bâti de `aboveZ` dont le vide de
 *  l'autre côté (au MÊME étage `aboveZ`) communique avec le dehors véritable (`exteriorVoidCells`). Refuse
 *  de rendre un verdict sans AUCUNE zone descriptive déclarée (ceinture, symétrique à `auditZoneCoverage`
 *  ci-dessous) : un heuristique géométrique non corroboré par la moindre donnée d'auteur reste un pari —
 *  un faux positif est pire qu'un défaut raté. `applyFilter=false` reproduit le faux positif mesuré sans
 *  le filtre (garde de non-régression, `check.test.ts`). */
export function auditFacade(scene: Scene, aboveZ: number, belowZ: number, applyFilter = true): Defect[] {
  if (descriptiveZoneIndex(scene).size === 0) return [];
  const exterior = exteriorVoidCells(scene, aboveZ);
  const outside = (x: number, y: number) => {
    const { w, h } = scene.dimensions;
    if (x < 0 || y < 0 || x >= w || y >= h) return true;
    return exterior.has(`${x},${y}`);
  };
  const out: Defect[] = [];
  for (let y = 0; y < scene.dimensions.h; y++) {
    for (let x = 0; x < scene.dimensions.w; x++) {
      if (!isFloor(scene, x, y, aboveZ)) continue;
      for (const side of ['N', 'E', 'S', 'O'] as const) {
        const nb = NEIGHBOR_EDGE[side];
        const ax = x + nb.x;
        const ay = y + nb.y;
        if (isFloor(scene, ax, ay, aboveZ)) continue; // arête interne à la dalle
        if (applyFilter && !outside(ax, ay)) continue; // vide encerclé par la dalle → écarté
        const hasAbove = edgeExists(scene, x, y, side, aboveZ);
        if (!hasAbove) {
          out.push({ family: 'mur-manquant', grid: 'walled', z: aboveZ, x, y, side, detail: `arête ${side} de (${x},${y}) sans mur à l'étage z${aboveZ} (bâti dans le vide)` });
          continue;
        }
        if (edgeExists(scene, x, y, side, belowZ)) continue; // aligné sur le mur du dessous
        const shifted = SHIFT[side].some(([dx, dy]) => edgeExists(scene, x + dx, y + dy, side, belowZ));
        if (shifted) out.push({ family: 'facade-decalee', grid: 'walled', z: aboveZ, x, y, side, detail: `mur ${side} de (${x},${y}) à l'étage z${aboveZ} décalé d'une case par rapport au mur du dessous (z${belowZ})` });
      }
    }
  }
  return out;
}

/** Familles 3 (étage au-dessus d'une zone exterior) et 4 (case sans zone déclarée) — scan des cases de
 *  la dalle d'étage `aboveZ` contre la zone descriptive déclarée à `belowZ`. Vide si la carte n'authore
 *  aucun `zoneMap`/`zoneLegend` (rien à contredire). */
export function auditZoneCoverage(scene: Scene, aboveZ: number, belowZ: number): ZoneDefect[] {
  const zoneIndex = descriptiveZoneIndex(scene);
  if (zoneIndex.size === 0) return [];
  const out: ZoneDefect[] = [];
  for (let y = 0; y < scene.dimensions.h; y++) {
    for (let x = 0; x < scene.dimensions.w; x++) {
      if (!isFloor(scene, x, y, aboveZ)) continue;
      const zone = zoneIndex.get(`${x},${y},${belowZ}`);
      if (!zone) {
        out.push({ family: 'case-sans-zone', grid: 'zone', z: belowZ, x, y, detail: `case (${x},${y}) z${belowZ} recouverte par l'étage z${aboveZ}, sans zone déclarée dans zoneMap` });
      } else if (zone.presentation === 'exterior') {
        out.push({ family: 'etage-sur-exterior', grid: 'walled', z: aboveZ, x, y, detail: `étage z${aboveZ} au-dessus de « ${zone.label} » (exterior) en z${belowZ} (${x},${y})` });
      }
    }
  }
  return out;
}

/** Famille 5 — case d'étage dont le dessous est du sol NU (`groundTerrains`), pas un plancher/pavé. */
export function auditUnsupportedFloor(scene: Scene, aboveZ: number, belowZ: number, groundTerrains: Set<string>): Defect[] {
  const out: Defect[] = [];
  for (let y = 0; y < scene.dimensions.h; y++) {
    for (let x = 0; x < scene.dimensions.w; x++) {
      if (!isFloor(scene, x, y, aboveZ)) continue;
      const below = terrainAt(scene, x, y, belowZ);
      if (groundTerrains.has(below)) out.push({ family: 'etage-sans-appui', grid: 'walled', z: aboveZ, x, y, detail: `étage z${aboveZ} en (${x},${y}) au-dessus de terrain nu « ${below} » en z${belowZ}` });
    }
  }
  return out;
}

/** Famille 6 — trémies (case sans plancher d'étage entourée d'au moins 3/4 voisins bâtis). LÉGITIME
 *  quand le char de la grille `walled` du dessous résout une recette `cells.stair` (`entry.stairChars`) ;
 *  sinon reportée comme trou SUSPECT (à vérifier, jamais un défaut compté des familles 1-5). */
export function auditStairwells(scene: Scene, aboveZ: number, belowZ: number, entry: MapEntry, charAt: (x: number, y: number) => string): Tremie[] {
  const out: Tremie[] = [];
  for (let y = 0; y < scene.dimensions.h; y++) {
    for (let x = 0; x < scene.dimensions.w; x++) {
      if (isFloor(scene, x, y, aboveZ)) continue;
      const below = terrainAt(scene, x, y, belowZ);
      if (below === 'vide') continue; // rien à trouer : pas dans le bâti
      const neighbors: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      const covered = neighbors.filter(([dx, dy]) => isFloor(scene, x + dx, y + dy, aboveZ)).length;
      if (covered < 3) continue;
      const ch = charAt(x, y);
      const legitimate = entry.stairChars?.has(ch) ?? false;
      out.push({ x, y, z: aboveZ, legitimate, detail: legitimate
        ? `trémie d'escalier (z${belowZ}='${ch}' en ${x},${y}) — LÉGITIME, ne pas combler`
        : `trou de plancher NON EXPLIQUÉ en (${x},${y}) (z${belowZ}='${ch}') — à vérifier` });
    }
  }
  return out;
}

/** Étages consécutifs (z, z-1) de la Scène — paires scannées par les audits ci-dessus. */
export function floorPairs(scene: Scene): [number, number][] {
  const zs = scenesZ(scene);
  const pairs: [number, number][] = [];
  for (let i = 1; i < zs.length; i++) pairs.push([zs[i], zs[i - 1]]);
  return pairs;
}

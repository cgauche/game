import { depth, type Dims } from '../../geometry/iso';
import type { WallSide } from '../../state/scene';

export type Cutaway = 'hidden' | 'visible';

/** ESPACE DÉGAGÉ par les alliés — résolu UNE fois par pas par `clearedSpace` (`builders/roofs.ts`,
 *  qui tient les emprises de masse) et lu par la loi `cutawayForSection` : toits, murs et façades
 *  s'effacent sur le MÊME espace. Un espace habité s'identifie par sa PIÈCE quand il en a une
 *  (`zoneIds`, et `zoneCells` = les cases de ces pièces), et par l'EMPRISE du bâtiment qui abrite
 *  l'allié quand aucune pièce n'est déclarée (`roomlessCells`). */
export interface ClearedSpace {
  zoneIds: ReadonlySet<string>;
  zoneCells: ReadonlyMap<string, ReadonlySet<string>>;
  roomlessCells: ReadonlySet<string>;
}

/** Aucun allié posé (scène absente) : rien n'est dégagé. */
export const NO_CLEARED_SPACE: ClearedSpace = { zoneIds: new Set(), zoneCells: new Map(), roomlessCells: new Set() };

export const spaceCellKey = (x: number, y: number, z: number) => `${x},${y},${z}`;

/** L'espace qu'enferme un élément d'architecture : ses pièces (`roomZoneIds` — masse de toit,
 *  panneau de façade) et ses cases `x,y,z` (emprise × niveaux couverts d'une masse, case bordée d'un
 *  panneau). */
export interface EnclosedSpace {
  roomZoneIds?: readonly string[];
  cells: Iterable<string>;
}

/** LOI de dégagement de l'architecture, UNIQUE pour toute la scène : un élément s'efface quand
 *  l'espace qu'il enferme est dégagé — par sa PIÈCE, ou, à défaut de pièce déclarée, par ses CASES.
 *  Les toits (`builders/roofs.ts`) et les façades (`frontFacadeCutaway`) passent tous deux par ici :
 *  un bâti sans zone déclarée se dégage donc toiture ET façade, jamais l'une sans l'autre. */
export function cutawayForSection(section: EnclosedSpace, cleared: ClearedSpace): Cutaway {
  if (section.roomZoneIds?.some((id) => cleared.zoneIds.has(id))) return 'hidden';
  for (const key of section.cells) if (cleared.roomlessCells.has(key)) return 'hidden';
  return 'visible';
}

export function exteriorWallViewZ(activeZ: number, interiorFocused: boolean, layerZs: readonly number[]): number {
  return interiorFocused ? activeZ : Math.max(activeZ, ...layerZs);
}

interface FacadePanel {
  roomZoneIds?: readonly string[];
  x: number;
  y: number;
  z?: number;
  side: WallSide;
}

const adjacent: Record<'N' | 'E', [{ x: number; y: number }, { x: number; y: number }]> = {
  N: [{ x: 0, y: 0 }, { x: 0, y: -1 }],
  E: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
};

/** Un panneau de façade tombe quand il sépare l'espace dégagé du dehors, ET que ce dehors est DEVANT
 *  lui à l'écran — sinon la caméra verrait tomber le mur du fond par-dessus la pièce ouverte. Le
 *  dedans se lit case par case par LA loi (`cutawayForSection`) : la pièce du panneau qui contient
 *  réellement cette case, ou la case elle-même quand aucune pièce n'est déclarée. Une arête
 *  diagonale n'a pas de devant/derrière tranché. */
export function frontFacadeCutaway(panel: FacadePanel, cleared: ClearedSpace, dims: Dims): boolean {
  if (panel.side !== 'N' && panel.side !== 'E') return false;
  const z = panel.z ?? 0;
  const [a, b] = adjacent[panel.side].map((offset) => ({ x: panel.x + offset.x, y: panel.y + offset.y }));
  const isInterior = (cell: { x: number; y: number }) => {
    const key = spaceCellKey(cell.x, cell.y, z);
    const rooms = panel.roomZoneIds?.filter((id) => cleared.zoneCells.get(id)?.has(key));
    return cutawayForSection({ roomZoneIds: rooms, cells: [key] }, cleared) === 'hidden';
  };
  const aInterior = isInterior(a);
  const bInterior = isInterior(b);
  if (aInterior === bInterior) return false;
  const interior = aInterior ? a : b;
  const exterior = aInterior ? b : a;
  return depth(exterior.x, exterior.y, dims, z) > depth(interior.x, interior.y, dims, z);
}

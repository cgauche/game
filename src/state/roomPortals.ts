import {
  doorIsOpen,
  edgeOf,
  isDescriptiveZone,
  isWalkable,
  structureIsDown,
  wallIsOpen,
  type Scene,
  type WallSeg,
} from './scene';
import { tileKey, walkNeighbors, type Pt } from './path';
import { memoByRef } from './sceneMemo';
import { sceneZoneTiles } from './zones';

export type RoomPortalKind = 'passage' | 'door-open' | 'door-closed';

export interface RoomPortal {
  id: string;
  z: number;
  edge: { x: number; y: number; side: 'N' | 'E' };
  fromZoneId: string | null;
  toZoneId: string | null;
  kind: RoomPortalKind;
  exterior: boolean;
  from: Pt;
  to: Pt;
}

interface IndexedTile {
  point: Pt;
  zoneIds: string[];
}

const pointAt = (x: number, y: number, z: number): Pt => (z ? { x, y, z } : { x, y });
/** Clé canonique d'une ARÊTE — UNE seule dans ce module : elle identifie aussi bien un accès (dans
 *  son `id`) qu'un segment de mur dans l'index ci-dessous. */
const edgeKey = (x: number, y: number, side: WallSeg['side'], z: number) => `${z}:${x},${y}:${side}`;

/** Segments de mur indexés PAR ARÊTE — bâti une fois par scène (`memoByRef`, patron canonique) au lieu
 *  d'un balayage linéaire des murs à chaque arête candidate. Premier segment RENCONTRÉ gagné : c'est
 *  exactement ce que rendait la recherche linéaire quand deux segments partagent une arête. */
const wallsByEdge = memoByRef((scene: Scene): ReadonlyMap<string, WallSeg> => {
  const index = new Map<string, WallSeg>();
  for (const wall of scene.walls ?? []) {
    const key = edgeKey(wall.x, wall.y, wall.side, wall.z ?? 0);
    if (!index.has(key)) index.set(key, wall);
  }
  return index;
});

function interiorTiles(scene: Scene): Map<string, IndexedTile> {
  const indexed = new Map<string, IndexedTile>();
  for (const zone of scene.effectZones ?? []) {
    if (!isDescriptiveZone(zone) || zone.presentation !== 'interior') continue;
    for (const tile of sceneZoneTiles(zone)) {
      const z = tile.z ?? zone.z ?? 0;
      const key = tileKey(tile.x, tile.y, z);
      const current = indexed.get(key);
      if (current) current.zoneIds.push(zone.id);
      else indexed.set(key, { point: pointAt(tile.x, tile.y, z), zoneIds: [zone.id] });
    }
  }
  return indexed;
}

function wallAt(scene: Scene, edge: RoomPortal['edge'], z: number): WallSeg | undefined {
  return wallsByEdge(scene).get(edgeKey(edge.x, edge.y, edge.side, z));
}

function portalKind(scene: Scene, wall: WallSeg | undefined): RoomPortalKind | null {
  if (!wall) return 'passage';
  if (wall.structure) return structureIsDown(scene, wall) ? 'passage' : null;
  if (wall.door) return doorIsOpen(scene, wall) ? 'door-open' : 'door-closed';
  return wallIsOpen(scene, wall) ? 'passage' : null;
}

function connected(scene: Scene, from: Pt, to: Pt): boolean {
  return walkNeighbors(scene, from).some((neighbor) =>
    neighbor.x === to.x
    && neighbor.y === to.y
    && (neighbor.z ?? 0) === (to.z ?? 0));
}

function roomPortalsUncached(scene: Scene): RoomPortal[] {
  const indexed = interiorTiles(scene);
  const portals = new Map<string, RoomPortal>();
  const directions = [[1, 0], [0, 1], [-1, 0], [0, -1]] as const;

  for (const { point: from, zoneIds: fromZoneIds } of indexed.values()) {
    const z = from.z ?? 0;
    for (const [dx, dy] of directions) {
      const to = pointAt(from.x + dx, from.y + dy, z);
      const edge = edgeOf(from.x, from.y, to.x, to.y);
      if (!edge) continue;
      const kind = portalKind(scene, wallAt(scene, edge, z));
      if (!kind) continue;
      const toZoneIds = indexed.get(tileKey(to.x, to.y, z))?.zoneIds ?? [];
      if (
        !connected(scene, from, to)
        && (kind !== 'door-closed' || (!toZoneIds.length && !isWalkable(scene, to.x, to.y, z)))
      ) continue;

      for (const fromZoneId of fromZoneIds) {
        const destinations = toZoneIds.filter((zoneId) => zoneId !== fromZoneId);
        if (!destinations.length && toZoneIds.includes(fromZoneId)) continue;
        for (const toZoneId of destinations.length ? destinations : [null]) {
          const id = `${edgeKey(edge.x, edge.y, edge.side, z)}:${fromZoneId}:${toZoneId ?? 'exterior'}`;
          portals.set(id, {
            id,
            z,
            edge,
            fromZoneId,
            toZoneId,
            kind,
            exterior: toZoneId === null,
            from,
            to,
          });
        }
      }
    }
  }

  return [...portals.values()].sort((a, b) => a.id.localeCompare(b.id));
}

/** Accès de pièce d'une SCÈNE — dérivés de ses zones intérieures, de ses murs et de l'état runtime de
 *  ses portes/structures (`scene.flags`), donc fonction de la seule `scene`. Mémoïsé par IDENTITÉ
 *  (`memoByRef`, patron canonique) : keyé sur `scene` et NON sur `scene.walls`, car ouvrir une porte
 *  ne change que `flags` — une clé sur les murs seuls raterait l'invalidation. Un pas qui ne modifie
 *  pas la scène ne réénumère donc rien. Le tableau rendu est PARTAGÉ : d'où le type en lecture seule.
 *  Aucune invalidation manuelle — toute mutation de scène passe par un spread (`setDoorOpen`,
 *  `setStructureDown`) et fournit une réf neuve. */
export const roomPortals = memoByRef((scene: Scene): readonly RoomPortal[] => roomPortalsUncached(scene));

export function portalsFromRooms(
  scene: Scene,
  occupiedZoneIds: ReadonlySet<string>,
): RoomPortal[] {
  return roomPortals(scene).filter((portal) =>
    portal.fromZoneId !== null && occupiedZoneIds.has(portal.fromZoneId));
}

/** Cases atteignables À PIED depuis `from`, sans borne de portée — UNE exploration en largeur sur la
 *  MÊME connectivité que les chemins (`walkNeighbors`, qui bâtit les arêtes murées et n'émet que des
 *  cases marchables). Sert à trancher l'accessibilité de PLUSIEURS destinations depuis un même
 *  départ : une exploration puis N tests d'appartenance, là où un chemin PAR destination refait N
 *  fois le même parcours. `from` appartient toujours au résultat (un départ est joignable de
 *  lui-même), y compris s'il n'est pas marchable — comme un chemin de longueur nulle. */
function reachedOnFoot(scene: Scene, from: Pt): Set<string> {
  const start = { x: from.x, y: from.y, z: from.z ?? 0 };
  const reached = new Set<string>([tileKey(start.x, start.y, start.z)]);
  const queue: Pt[] = [start];
  for (let i = 0; i < queue.length; i++) {
    for (const next of walkNeighbors(scene, queue[i])) {
      const key = tileKey(next.x, next.y, next.z ?? 0);
      if (reached.has(key)) continue;
      reached.add(key);
      queue.push(next);
    }
  }
  return reached;
}

export function portalsForParty(
  scene: Scene,
  partyPos: Pt,
  occupiedZoneIds: ReadonlySet<string>,
): RoomPortal[] {
  if (occupiedZoneIds.size) return portalsFromRooms(scene, occupiedZoneIds);
  // Sorties ACCESSIBLES au groupe. L'environnement de traversée est FIXE ici — aucune case bloquée,
  // empreinte 1×1, aucun saut, aucune capacité de nage/escalade : « il existe un chemin jusqu'à cette
  // porte » se réduit donc exactement à « sa case est dans la composante marchable du groupe ». Une
  // seule exploration répond pour TOUTES les portes, au lieu d'une par porte.
  const reachable = reachedOnFoot(scene, partyPos);
  return roomPortals(scene)
    .filter((portal) =>
      portal.exterior
      && portal.toZoneId === null
      && reachable.has(tileKey(portal.to.x, portal.to.y, portal.to.z ?? 0)))
    .map((portal) => ({
      ...portal,
      id: `${edgeKey(portal.edge.x, portal.edge.y, portal.edge.side, portal.z)}:exterior:${portal.fromZoneId}`,
      fromZoneId: null,
      toZoneId: portal.fromZoneId,
      from: portal.to,
      to: portal.from,
    }));
}

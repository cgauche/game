/**
 * Harnais QC de cartes (#778) — helpers PURS transformant « chaque pièce accessible » (critère flou)
 * en assertions MÉCANIQUES générales, réutilisables par le test de N'IMPORTE QUELLE scène (`buildScene`).
 * Node-safe (ZÉRO import ui/gameIso). RÉFUTE (échoue si une pièce est murée) plutôt que certifier.
 */
import type { Pt } from './path';
import { walkNeighbors } from './path';
import { isDescriptiveZone, isWalkable, type Scene, type SceneEffectZone } from './scene';
import { zoneAreaTiles } from './zones';

const key = (x: number, y: number, z: number) => `${x},${y},${z}`;

/** Toutes les cases atteignables À PIED depuis `start` (BFS via `walkNeighbors`, portée illimitée,
 *  cross-couche). Brique commune du harnais. */
export function reachableCells(scene: Scene, start: { x: number; y: number; z?: number }): Set<string> {
  const startZ = start.z ?? 0;
  const seen = new Set<string>([key(start.x, start.y, startZ)]);
  const queue: Pt[] = [{ x: start.x, y: start.y, z: startZ }];
  while (queue.length) {
    const p = queue.shift()!;
    for (const n of walkNeighbors(scene, p)) {
      const nz = n.z ?? 0;
      const k = key(n.x, n.y, nz);
      if (seen.has(k)) continue;
      seen.add(k);
      queue.push({ x: n.x, y: n.y, z: nz });
    }
  }
  return seen;
}

/** Cases MARCHABLES d'une zone descriptive (`zoneAreaTiles` 2D, filtrées par `isWalkable` à l'étage
 *  `zone.z ?? 0` de la zone). */
export function zoneWalkableCells(scene: Scene, zone: SceneEffectZone): { x: number; y: number; z: number }[] {
  const z = zone.z ?? 0;
  return zoneAreaTiles(zone.area)
    .filter((p) => isWalkable(scene, p.x, p.y, z))
    .map((p) => ({ x: p.x, y: p.y, z }));
}

/** Zones descriptives (pièces nommées, `isDescriptiveZone`) dont AUCUNE case marchable n'est atteignable
 *  depuis `start` — vide = toutes les pièces nommées sont accessibles. Une zone SANS aucune case
 *  marchable (posée sur du vide) est aussi « inatteignable ». */
export function unreachableDescriptiveZones(scene: Scene, start: { x: number; y: number; z?: number }): SceneEffectZone[] {
  const reached = reachableCells(scene, start);
  return (scene.effectZones ?? []).filter(isDescriptiveZone).filter((zone) => {
    const walkable = zoneWalkableCells(scene, zone);
    return !walkable.some((p) => reached.has(key(p.x, p.y, p.z)));
  });
}

/** Étages (`z`) présents dans les cases atteignables depuis `start` — preuve de connexité verticale
 *  (une carte à étages habités z0..zN doit tous les faire apparaître ici). */
export function reachedFloors(scene: Scene, start: { x: number; y: number; z?: number }): Set<number> {
  const out = new Set<number>();
  for (const k of reachableCells(scene, start)) out.add(Number(k.split(',')[2]));
  return out;
}

/** Position du `heroStart` de la scène (départ par défaut du groupe), ou `null` si absent. */
export function startOf(scene: Scene): { x: number; y: number; z: number } | null {
  const e = scene.entities.find((e) => e.kind === 'heroStart');
  if (!e) return null;
  return { x: e.pos.x, y: e.pos.y, z: e.z ?? 0 };
}

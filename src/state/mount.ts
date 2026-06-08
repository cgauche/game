/**
 * Combat monté (LDB 14 l.212-225) — APPAIRAGE cavalier↔monture, DYNAMIQUE (Monter/Descendre en jeu).
 * Un cavalier (`mountId`) et sa monture (`riderId`) sont deux Combattants distincts ; le couple PARTAGE
 * la position et l'empreinte de la MONTURE (souvent Grande → 2×2). Module-feuille pur (aucun import de
 * combatFlow) : mute les combattants, l'appelant (store) re-set la bataille + émet SCENE_DIRTY.
 */
import type { Combatant } from '../engine/types';
import { isOutOfAction } from '../engine/conditions';
import { Scene, isWalkable } from './scene';
import { occupiesTile, sizeFootprint } from './footprint';
import type { Pt } from './path';
import type { BattleState } from './store';

/** Ce combattant chevauche-t-il une monture (= cavalier) ? */
export const isRider = (c: Combatant): boolean => !!c.mountId;
/** Ce combattant porte-t-il un cavalier (= monture) ? */
export const isMount = (c: Combatant): boolean => !!c.riderId;

/** La monture chevauchée par `rider` (ou undefined). */
export const mountOf = (battle: BattleState, rider: Combatant): Combatant | undefined =>
  rider.mountId ? battle.combatants.find((c) => c.id === rider.mountId) : undefined;
/** Le cavalier porté par `mount` (ou undefined). */
export const riderOf = (battle: BattleState, mount: Combatant): Combatant | undefined =>
  mount.riderId ? battle.combatants.find((c) => c.id === mount.riderId) : undefined;

/** Distance de Chebyshev entre une case et l'empreinte d'un combattant (0 = sur l'empreinte). */
function tileToFootprint(c: Combatant, x: number, y: number): number {
  if (!c.pos) return Infinity;
  const n = sizeFootprint(c.size);
  const dx = x < c.pos.x ? c.pos.x - x : x > c.pos.x + n - 1 ? x - (c.pos.x + n - 1) : 0;
  const dy = y < c.pos.y ? c.pos.y - y : y > c.pos.y + n - 1 ? y - (c.pos.y + n - 1) : 0;
  return Math.max(dx, dy);
}

/** `rider` (à pied, libre) peut-il enfourcher `mount` ? Monture vivante, SANS cavalier, à une case de
 *  l'empreinte de la monture (ou dessus), et `rider` n'est pas déjà monté. */
export function canMount(battle: BattleState, rider: Combatant, mount: Combatant): boolean {
  if (rider.id === mount.id || rider.mountId || mount.riderId) return false;
  if (isOutOfAction(rider) || isOutOfAction(mount) || !rider.pos || !mount.pos) return false;
  return tileToFootprint(mount, rider.pos.x, rider.pos.y) <= 1;
}

/** `rider` enfourche `mount` : appairage + le cavalier monte SUR la monture (partage sa position). */
export function mountUp(rider: Combatant, mount: Combatant): void {
  rider.mountId = mount.id;
  mount.riderId = rider.id;
  if (mount.pos) rider.pos = { ...mount.pos };
}

/** Case libre la plus proche pour reposer un cavalier À PIED (1×1) autour de la monture. */
function nearestFreeFoot(battle: BattleState, scene: Scene, mount: Combatant, rider: Combatant): Pt | undefined {
  const p = mount.pos;
  if (!p) return undefined;
  const n = sizeFootprint(mount.size);
  const occupied = (x: number, y: number): boolean =>
    battle.combatants.some((c) => c.id !== rider.id && c.id !== mount.id && !isOutOfAction(c) && c.pos && occupiesTile(c.pos, c.size, x, y));
  let best: Pt | undefined;
  let bestD = Infinity;
  for (let y = p.y - 3; y <= p.y + n + 2; y++)
    for (let x = p.x - 3; x <= p.x + n + 2; x++) {
      if (occupiesTile(p, mount.size, x, y) || !isWalkable(scene, x, y) || occupied(x, y)) continue;
      const d = Math.max(tileToFootprint(mount, x, y), 0);
      if (d > 0 && d < bestD) { bestD = d; best = { x, y }; }
    }
  return best;
}

/** Le cavalier descend : on défait l'appairage et il prend la case libre la plus proche (à pied). */
export function dismount(battle: BattleState, scene: Scene, rider: Combatant): boolean {
  const mount = mountOf(battle, rider);
  rider.mountId = undefined;
  if (mount) {
    mount.riderId = undefined;
    const free = nearestFreeFoot(battle, scene, mount, rider);
    if (free) rider.pos = free;
  }
  return true;
}

/** Mort/retrait de la monture (LDB 14 l.221, la monture est un combattant à part) : son cavalier est
 *  DÉMONTÉ (à pied, case libre adjacente). Pas de dégâts de chute (le RAW ne définit AUCUNE chute liée à
 *  la mort d'une monture — seul existe le cas générique de la Chute, LDB 15 l.117-122 ; on ne l'invente pas). */
export function handleMountDeath(battle: BattleState, scene: Scene, mount: Combatant): Combatant | undefined {
  const rider = riderOf(battle, mount);
  if (!rider) return undefined;
  mount.riderId = undefined;
  rider.mountId = undefined;
  const free = nearestFreeFoot(battle, scene, mount, rider);
  if (free) rider.pos = free;
  return rider;
}

/** Balayage post-résolution : toute monture mise hors de combat désarçonne son cavalier (à pied, strict
 *  RAW). Retourne les lignes de journal des désarçonnements (vide si rien). Appelé depuis checkBattleOver,
 *  donc déclenché quelle que soit la cause de mise hors de combat (touche, sort de zone, mort lente, Nuée). */
export function sweepDismountDeaths(battle: BattleState, scene: Scene): string[] {
  const lines: string[] = [];
  for (const mount of battle.combatants) {
    if (!mount.riderId || !isOutOfAction(mount)) continue;
    const rider = handleMountDeath(battle, scene, mount);
    if (rider) lines.push(`${rider.name} est désarçonné — sa monture (${mount.name}) est hors de combat.`);
  }
  return lines;
}

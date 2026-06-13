/**
 * Géométrie de combat extraite de combatFlow.ts : placement, empreintes/déplacement des
 * combattants (LDB 15/85), poussée Perturbante, traversée de zones, flanc-dos et vision dans
 * l'obscurité. Helpers de BAS NIVEAU (engine + path/footprint/zones/scene) sans dépendance vers
 * le noyau de résolution — combatFlow.ts les ré-exporte (baril) pour ses 61 importeurs.
 * Refacto pure — comportement préservé.
 */
import type { BattleState } from './store';
import type { Get, Set as SetFn } from './flowTypes';
import type { Combatant } from '../engine/types';
import type { Dir8 } from './dir8';
import { Scene, isWalkable } from './scene';
import { Pt } from './path';
import { footprintTiles, sizeFootprint, occupiesTile } from './footprint';
import { sizeGap } from '../engine/size';
import { isOutOfAction } from '../engine/conditions';
import { traitSeesInDark } from '../engine/traits/dispatch';
import { losBlockingTiles, crossZones } from './zones';
import { battleRng } from './battleRng';
import { ev } from './combatLog';
import { bus, EVT } from './bus';

/**
 * Tuiles qui BLOQUENT le déplacement de `mover` : l'empreinte (LDB 15 l.55) de chaque AUTRE
 * combattant, SAUF ceux de Taille STRICTEMENT inférieure au mover — une créature plus grande
 * « dégage les combattants de taille inférieure du chemin, se déplaçant où elle veut » (LDB 85
 * l.308-309). Passer un id (legacy/tests) ⇒ aucun filtrage de Taille (toutes les empreintes bloquent).
 */
export function occupied(battle: BattleState, mover: Combatant | string): Set<string> {
  const exceptId = typeof mover === 'string' ? mover : mover.id;
  const moverSize = typeof mover === 'string' ? undefined : mover.size;
  const s = new Set<string>();
  for (const c of battle.combatants) {
    if (c.id === exceptId || isOutOfAction(c) || !c.pos) continue;
    if (moverSize !== undefined && sizeGap(c.size, moverSize) < 0) continue; // plus petit → dégagé du chemin (85 l.308-309)
    for (const t of footprintTiles(c.pos, c.size)) s.add(`${t.x},${t.y}`);
  }
  return s;
}

/** Perturbante (LDB 62 l.275-276) : repousse `target` d'au plus `tiles` cases dans la direction
 *  opposée à l'attaquant (cases praticables et libres seulement). Renvoie les cases reculées. */
export function pushBackTiles(get: Get, attacker: Combatant, target: Combatant, tiles: number): number {
  const { scene, battle } = get();
  if (!scene || !battle || !attacker.pos || !target.pos || tiles <= 0) return 0;
  let pos = target.pos;
  const dx = Math.sign(pos.x - attacker.pos.x);
  const dy = Math.sign(pos.y - attacker.pos.y);
  if (!dx && !dy) return 0;
  const blocked = occupied(battle, target);
  let moved = 0;
  for (let i = 0; i < tiles; i++) {
    const next = { x: pos.x + dx, y: pos.y + dy };
    const foot = footprintTiles(next, target.size);
    if (!foot.every((t) => isWalkable(scene, t.x, t.y) && !blocked.has(`${t.x},${t.y}`))) break;
    pos = next;
    moved++;
  }
  target.pos = pos;
  if (moved) bus.emit(EVT.ANIM_MOVE, { id: target.id, path: [{ ...target.pos }] });
  return moved;
}

export function findFreeTile(scene: Scene): Pt {
  for (let y = 0; y < scene.dimensions.h; y++)
    for (let x = 0; x < scene.dimensions.w; x++) if (isWalkable(scene, x, y)) return { x, y };
  return { x: 0, y: 0 };
}

/**
 * Après qu'un combattant a bougé, « dégage de son chemin » les combattants de Taille STRICTEMENT
 * inférieure dont la case est désormais SOUS son empreinte (LDB 85 l.308-309 : un plus grand « se
 * déplace où il veut ») : chacun est poussé vers la case libre la plus proche, hors de l'empreinte.
 * Mute les `pos` en place ; l'appelant émet SCENE_DIRTY / re-set la bataille. Renvoie true si déplacé.
 */
export function displaceSmaller(get: Get, mover: Combatant): boolean {
  const battle = get().battle;
  const scene = get().scene;
  if (!battle || !scene || !mover.pos || sizeFootprint(mover.size) <= 1) return false;
  let moved = false;
  for (const c of battle.combatants) {
    if (c.id === mover.id || c.id === mover.riderId || isOutOfAction(c) || !c.pos) continue; // jamais éjecter SON propre cavalier (il chevauche)
    if (sizeGap(c.size, mover.size) >= 0) continue; // pas strictement plus petit → non dégagé
    if (!occupiesTile(mover.pos, mover.size, c.pos.x, c.pos.y)) continue; // pas sous l'empreinte du mover
    const free = nearestFreeOutside(scene, battle, c, mover);
    if (free) { c.pos = free; moved = true; }
  }
  return moved;
}

/** Case walkable la plus proche de `c`, non occupée (toutes empreintes) et HORS de l'empreinte de
 *  `mover` — anneaux croissants (rayon ≤ 6). `undefined` si rien (c reste, co-occupation tolérée). */
function nearestFreeOutside(scene: Scene, battle: BattleState, c: Combatant, mover: Combatant): Pt | undefined {
  const blocked = occupied(battle, c.id); // id (legacy) ⇒ TOUTES les empreintes bloquent (placement)
  for (let r = 1; r <= 6; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; // seulement l'anneau de rayon r
        const x = c.pos!.x + dx, y = c.pos!.y + dy;
        if (occupiesTile(mover.pos!, mover.size, x, y)) continue; // garder hors empreinte du mover
        if (isWalkable(scene, x, y) && !blocked.has(`${x},${y}`)) return { x, y };
      }
  return undefined;
}

export function removeEntity(get: Get, set: SetFn, id: string) {
  const scene = get().scene;
  if (!scene) return;
  scene.entities = scene.entities.filter((e) => e.id !== id);
  set({ scene: { ...scene } });
  bus.emit(EVT.SCENE_DIRTY);
}

export function inRect(p: Pt, r: { x: number; y: number; w: number; h: number }): boolean {
  return p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;
}

/** Cases bloquant la Ligne de Vue (zones opaques : Fumée du Souffle…) — L11 : lues de `battle.zones`. */
export const smokeOf = (battle: BattleState): Pt[] => losBlockingTiles(battle.zones);

/** Traversée de zones persistantes (Mur de feu, LDB 47 — L11) au terme d'un déplacement :
 *  applique l'`onCross` des zones croisées par `path` et journalise. (La Téléportation ne
 *  « traverse » pas — apparition — et n'appelle pas ce helper.) */
export function applyZoneCrossings(get: Get, mover: Combatant, path: Pt[]): void {
  const battle = get().battle;
  if (!battle?.zones?.length || !path.length) return;
  const lines = crossZones(battle.zones, mover, path, (id) => (id ? battle.combatants.find((c) => c.id === id) : undefined), battleRng());
  for (const l of lines) battle.log.push(ev('condition', l, mover.id));
  if (lines.length) bus.emit(EVT.SCENE_DIRTY);
}

const DIR8_RING: Dir8[] = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
/** Flanc/dos (LDB 14 l.91) : l'attaquant frappe-t-il hors du champ de vision avant du défenseur ?
 *  Front = orientation du défenseur ±45° (3 directions avant) ; flanc/dos = les 5 autres (écart ≥ 2 sur l'anneau). */
export function isFlankOrRear(targetFacing: Dir8, dirToAttacker: Dir8): boolean {
  const a = DIR8_RING.indexOf(targetFacing);
  const b = DIR8_RING.indexOf(dirToAttacker);
  return Math.min(Math.abs(a - b), 8 - Math.abs(a - b)) >= 2;
}

/** Voit dans l'obscurité : Trait Vision nocturne / Infravision (LDB 85) ou Talent Vision nocturne (LDB 10). */
export function seesInDark(c: Combatant): boolean {
  return traitSeesInDark(c.traits) || (c.talents ?? []).some((t) => /^vision nocturne/i.test(t.name));
}

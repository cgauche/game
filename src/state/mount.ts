/**
 * Combat monté (LDB 14 l.212-225) — APPAIRAGE cavalier↔monture, DYNAMIQUE (Monter/Descendre en jeu).
 * Un cavalier (`mountId`) et sa monture (`riderId`) sont deux Combattants distincts ; le couple PARTAGE
 * la position et l'empreinte de la MONTURE (souvent Grande → 2×2). Module-feuille pur (aucun import de
 * combatFlow) : mute les combattants, l'appelant (store) re-set la bataille + émet SCENE_DIRTY.
 */
import type { Combatant } from '../engine/types';
import { isOutOfAction } from '../engine/conditions';
import { effectiveMovement } from '../engine/encumbrance';
import { sizeGap } from '../engine/size';
import type { ModLine } from '../engine/combat';
import { Scene, isWalkable } from './scene';
import { occupiesTile, footprintN } from './footprint';
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
  const n = footprintN(c);
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
  const n = footprintN(mount);
  const occupied = (x: number, y: number): boolean =>
    battle.combatants.some((c) => c.id !== rider.id && c.id !== mount.id && !isOutOfAction(c) && c.pos && occupiesTile(c.pos, footprintN(c), x, y));
  let best: Pt | undefined;
  let bestD = Infinity;
  for (let y = p.y - 3; y <= p.y + n + 2; y++)
    for (let x = p.x - 3; x <= p.x + n + 2; x++) {
      if (occupiesTile(p, footprintN(mount), x, y) || !isWalkable(scene, x, y) || occupied(x, y)) continue;
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

// ── Combat monté : Mouvement & modificateurs de combat (LDB 14 l.215-225) ──────────────────────────
/** Acrobaties équestres (LDB 10) : annule la pénalité d'Esquive du cavalier (l.225). */
const hasAcrobatiesEquestres = (c: Combatant): boolean =>
  (c.talents ?? []).some((t) => (t.times ?? 0) > 0 && t.talentId === 'acrobaties-equestres');

/** Mouvement effectif d'un combattant : celui de sa MONTURE s'il est cavalier (LDB 14 l.215), sinon le sien. */
export function mountMovement(battle: BattleState, c: Combatant): number {
  const mount = mountOf(battle, c);
  return effectiveMovement(mount ?? c);
}

/** Cases de Mouvement encore disponibles ce Tour : budget du Tour moins le Mouvement déjà parcouru
 *  (déplacement DÉCOMPOSABLE — règle maison, cf. `BattleState.movementUsed`). Le budget est la Marche
 *  (de la monture si cavalier), ÉTENDU par une Course réussie (`battle.runBudget` = Marche + Course + DR,
 *  LDB 15 l.80 : la distance de Course « vient en plus » du Mouvement du Round — le reliquat reste dépensable). */
export function movementRemaining(battle: BattleState, c: Combatant): number {
  const budget = Math.max(battle.runBudget ?? 0, mountMovement(battle, c));
  return Math.max(0, budget - (battle.movementUsed ?? 0));
}

/** Ce combattant peut-il (encore) se déplacer librement ce Tour ? Mouvement décomposable, mais NON entrelacé
 *  avec l'Action (règle maison) : interdit une fois l'Action prise SI du Mouvement a déjà été parcouru avant
 *  elle (pas de « Mouvement → Action → Mouvement »). Faire « Action puis Mouvement » reste permis. */
export function canMove(battle: BattleState, c: Combatant): boolean {
  if (battle.acted && battle.movedPreAction) return false;
  return movementRemaining(battle, c) > 0;
}

/** Modificateurs d'attaque liés au Combat monté, injectés dans `env` (combat.ts reste pur, ignorant des
 *  montures) :
 *  - +20 si l'attaquant est un CAVALIER frappant une cible plus petite que SA monture (l.217, « toute attaque ») ;
 *  - −10 en MÊLÉE si l'on cible un CAVALIER (la cible chevauche) alors qu'on est plus petit que sa monture (l.219). */
export function mountedAttackMods(battle: BattleState, attacker: Combatant, target: Combatant | null, kind: 'melee' | 'ranged'): ModLine[] {
  const out: ModLine[] = [];
  if (!target) return out;
  const attMount = mountOf(battle, attacker);
  if (attMount && sizeGap(attMount.size, target.size) >= 1) out.push({ label: 'Combat monté (cible plus petite)', value: 20 });
  const tgtMount = mountOf(battle, target); // la cible est-elle un cavalier ? (on frappe alors le cavalier, pas la monture)
  if (kind === 'melee' && tgtMount && sizeGap(attacker.size, tgtMount.size) <= -1) out.push({ label: 'Cibler le cavalier (plus petit que la monture)', value: -10 });
  return out;
}

/** Pénalité d'Esquive d'un cavalier (LDB 14 l.225) : −20, sauf Talent Acrobaties équestres. 0 à pied. */
export function mountedDodgePenalty(defender: Combatant): number {
  return defender.mountId && !hasAcrobatiesEquestres(defender) ? -20 : 0;
}

/** Monture LIBRE la plus proche que `rider` (à pied) peut enfourcher : marquée `mountable`, du MÊME camp
 *  (on n'enfourche pas la monture d'un ennemi), sans cavalier, à une case de son empreinte (LDB 14). */
export function mountableNear(battle: BattleState, rider: Combatant): Combatant | undefined {
  let best: Combatant | undefined;
  let bestD = Infinity;
  for (const m of battle.combatants) {
    if (!m.mountable || m.kind !== rider.kind || !canMount(battle, rider, m)) continue;
    const d = m.pos && rider.pos ? Math.max(Math.abs(m.pos.x - rider.pos.x), Math.abs(m.pos.y - rider.pos.y)) : Infinity;
    if (d < bestD) { bestD = d; best = m; }
  }
  return best;
}

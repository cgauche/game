/** Déplacement sur grille : BFS pour cases atteignables et chemins. */
import { Scene, isWalkable } from './scene';
import { hasTrait } from '../engine/traits/dispatch';
import type { Combatant } from '../engine/types';

export interface Pt {
  x: number;
  y: number;
}

const key = (x: number, y: number) => `${x},${y}`;
const NEIGHBORS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/**
 * L'empreinte N×N ancrée en (x, y) (coin NO) tient-elle ? Toutes ses tuiles doivent être walkable
 * (terrain/bâtiment) ET non bloquées. Pour `foot=1`, vérifie juste la tuile (comportement historique).
 * Permet à une grande créature de NE PAS se faufiler dans un couloir d'1 tuile (LDB 15 l.55).
 */
function footFits(scene: Scene, x: number, y: number, foot: number, blocked: Set<string>): boolean {
  if (foot <= 1) return isWalkable(scene, x, y) && !blocked.has(key(x, y));
  for (let dy = 0; dy < foot; dy++)
    for (let dx = 0; dx < foot; dx++) {
      if (!isWalkable(scene, x + dx, y + dy) || blocked.has(key(x + dx, y + dy))) return false;
    }
  return true;
}

/**
 * Cases atteignables depuis `start` en au plus `range` pas, en évitant les
 * cases occupées par `blocked`. Retourne une map clé→distance.
 */
export function reachable(scene: Scene, start: Pt, range: number, blocked: Set<string>, foot = 1): Map<string, number> {
  const dist = new Map<string, number>();
  dist.set(key(start.x, start.y), 0);
  let frontier: Pt[] = [start];
  for (let step = 0; step < range; step++) {
    const next: Pt[] = [];
    for (const p of frontier) {
      for (const [dx, dy] of NEIGHBORS) {
        const nx = p.x + dx;
        const ny = p.y + dy;
        const k = key(nx, ny);
        if (dist.has(k)) continue;
        if (!footFits(scene, nx, ny, foot, blocked)) continue; // l'empreinte entière doit tenir (LDB 15 l.55)
        dist.set(k, step + 1);
        next.push({ x: nx, y: ny });
      }
    }
    frontier = next;
  }
  return dist;
}

/**
 * Vol (LDB 85 p.343) : destinations en LIGNE DIRECTE jusqu'à `range` cases — « elle ignore tous les
 * terrains, obstacles et personnages qui s'interposent » ; seul l'ATTERRISSAGE exige une empreinte
 * praticable et libre. Coût = distance de Tchebychev (déplacement libre dans les airs).
 */
export function flyReachable(scene: Scene, start: Pt, range: number, blocked: Set<string>, foot = 1): Map<string, number> {
  const dist = new Map<string, number>();
  dist.set(key(start.x, start.y), 0);
  for (let dy = -range; dy <= range; dy++)
    for (let dx = -range; dx <= range; dx++) {
      if (!dx && !dy) continue;
      const nx = start.x + dx;
      const ny = start.y + dy;
      if (!footFits(scene, nx, ny, foot, blocked)) continue; // l'atterrissage doit tenir
      dist.set(key(nx, ny), Math.max(Math.abs(dx), Math.abs(dy)));
    }
  return dist;
}

/**
 * Portée de déplacement d'un combattant : VOL (trait « Vol » — natif OU accordé par un sort,
 * Envol Jalon 2.6) → `flyReachable` (survole murs/obstacles, l'atterrissage doit tenir) ; sinon
 * BFS au sol. C'était réservé à l'IA (ai.ts) — les HÉROS volants passent désormais par ici.
 */
export function moveReachFor(
  mover: Pick<Combatant, 'traits'>,
  scene: Scene, start: Pt, range: number, blocked: Set<string>, foot = 1,
): Map<string, number> {
  return (hasTrait(mover.traits, 'Vol') ? flyReachable : reachable)(scene, start, range, blocked, foot);
}

/** Cases atteignables pour une FUITE (LDB 15-Déplacement l.109 : « dans la direction OPPOSÉE à celle de
 *  votre adversaire ») : la portée de Course (`range`) restreinte aux cases qui n'APPROCHENT PAS `foe` —
 *  leur distance de Tchebychev à l'adversaire doit être ≥ à celle de la case de départ. Pur. */
export function fleeReachable(scene: Scene, from: Pt, foe: Pt, range: number, blocked: Set<string>, foot = 1): Map<string, number> {
  const here = chebyshev(from, foe);
  const out = new Map<string, number>();
  for (const [k, v] of reachable(scene, from, range, blocked, foot)) {
    const [x, y] = k.split(',').map(Number);
    if (chebyshev({ x, y }, foe) >= here) out.set(k, v);
  }
  return out;
}

/** Plus court chemin (BFS) de `start` à `goal`, ou null. */
export function pathTo(scene: Scene, start: Pt, goal: Pt, blocked: Set<string>, foot = 1): Pt[] | null {
  const came = new Map<string, string | null>();
  came.set(key(start.x, start.y), null);
  const queue: Pt[] = [start];
  while (queue.length) {
    const p = queue.shift()!;
    if (p.x === goal.x && p.y === goal.y) {
      const path: Pt[] = [];
      let cur: string | null = key(p.x, p.y);
      while (cur) {
        const [x, y] = cur.split(',').map(Number);
        path.unshift({ x, y });
        cur = came.get(cur) ?? null;
      }
      return path;
    }
    for (const [dx, dy] of NEIGHBORS) {
      const nx = p.x + dx;
      const ny = p.y + dy;
      const k = key(nx, ny);
      if (came.has(k)) continue;
      const isGoal = nx === goal.x && ny === goal.y;
      // Empreinte > 1 : chaque pas (arrivée incluse) doit tenir entièrement. 1×1 : la cible peut être
      // une case occupée (on s'arrête au contact d'un ennemi), comportement historique.
      if (foot > 1) { if (!footFits(scene, nx, ny, foot, blocked)) continue; }
      else if (!isGoal && (!isWalkable(scene, nx, ny) || blocked.has(k))) continue;
      came.set(k, key(p.x, p.y));
      queue.push({ x: nx, y: ny });
    }
  }
  return null;
}

export function manhattan(a: Pt, b: Pt): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/** Distance « roi d'échecs » (Chebyshev) sur la grille carrée : la diagonale vaut 1.
 *  C'est la distance de COMBAT (portée de mêlée, bandes de tir) — un ennemi en diagonale
 *  est à portée de contact. Le déplacement, lui, reste 4-connexe (cf. NEIGHBORS). */
export function chebyshev(a: Pt, b: Pt): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

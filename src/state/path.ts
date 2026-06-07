/** Déplacement sur grille : BFS pour cases atteignables et chemins. */
import { Scene, isWalkable } from './scene';

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
 * Cases atteignables depuis `start` en au plus `range` pas, en évitant les
 * cases occupées par `blocked`. Retourne une map clé→distance.
 */
export function reachable(scene: Scene, start: Pt, range: number, blocked: Set<string>): Map<string, number> {
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
        if (!isWalkable(scene, nx, ny)) continue;
        if (blocked.has(k)) continue;
        dist.set(k, step + 1);
        next.push({ x: nx, y: ny });
      }
    }
    frontier = next;
  }
  return dist;
}

/** Cases atteignables pour une FUITE (LDB 15-Déplacement l.109 : « dans la direction OPPOSÉE à celle de
 *  votre adversaire ») : la portée de Course (`range`) restreinte aux cases qui n'APPROCHENT PAS `foe` —
 *  leur distance de Tchebychev à l'adversaire doit être ≥ à celle de la case de départ. Pur. */
export function fleeReachable(scene: Scene, from: Pt, foe: Pt, range: number, blocked: Set<string>): Map<string, number> {
  const here = chebyshev(from, foe);
  const out = new Map<string, number>();
  for (const [k, v] of reachable(scene, from, range, blocked)) {
    const [x, y] = k.split(',').map(Number);
    if (chebyshev({ x, y }, foe) >= here) out.set(k, v);
  }
  return out;
}

/** Plus court chemin (BFS) de `start` à `goal`, ou null. */
export function pathTo(scene: Scene, start: Pt, goal: Pt, blocked: Set<string>): Pt[] | null {
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
      if (!isGoal && (!isWalkable(scene, nx, ny) || blocked.has(k))) continue;
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

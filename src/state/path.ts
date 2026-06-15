/** Déplacement sur grille : BFS pour cases atteignables et chemins. */
import { Scene, isWalkable } from './scene';
import { hasTrait } from '../engine/traits/dispatch';
import type { Combatant } from '../engine/types';

export interface Pt {
  x: number;
  y: number;
  /** Étage (niveau de scène). Absent = sol (z=0). La traversée verticale passe par les escaliers. */
  z?: number;
}

const pz = (p: Pt) => p.z ?? 0;
/** Construit une position en omettant `z` quand il vaut 0 → un résultat au sol est byte-identique à
 *  l'ancien `{x,y}` (non-régression ; même esprit que la clé z=0 sans suffixe). */
const pt = (x: number, y: number, z = 0): Pt => (z ? { x, y, z } : { x, y });
/** Clé de case. CONVENTION : z=0 omet le suffixe (« x,y ») → byte-identique aux ensembles `blocked`
 *  2D que bâtissent les appelants (occupied(), héros au sol) ; z>0 → « x,y,z » distinct. Une seule
 *  fonction de clé partout (pas de double schéma). */
const key = (x: number, y: number, z = 0) => (z ? `${x},${y},${z}` : `${x},${y}`);
const NEIGHBORS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** Index des escaliers : clé de case → cases reliées (bidirectionnel). Seuls points de franchissement
 *  vertical ; vide si la scène n'a pas de `stairs` (toutes les scènes mono-niveau). */
function stairLinks(scene: Scene): Map<string, Pt[]> {
  const m = new Map<string, Pt[]>();
  const add = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) => {
    const k = key(a.x, a.y, a.z);
    const arr = m.get(k) ?? [];
    arr.push({ x: b.x, y: b.y, z: b.z });
    m.set(k, arr);
  };
  for (const s of scene.stairs ?? []) { add(s.from, s.to); add(s.to, s.from); }
  return m;
}

/** Voisins marchables d'une case : 4-adjacence du MÊME étage + transitions d'escalier vers z±1. */
function neighborsOf(p: Pt, links: Map<string, Pt[]>): Pt[] {
  const z = pz(p);
  const out: Pt[] = NEIGHBORS.map(([dx, dy]) => ({ x: p.x + dx, y: p.y + dy, z }));
  const stairs = links.get(key(p.x, p.y, z));
  if (stairs) out.push(...stairs);
  return out;
}

/** Sauts (Saut, LDB 15 l.114-115) : atterrissages possibles en franchissant un GOUFFRE — des cases
 *  non-marchables au même étage, en ligne droite — jusqu'à `jump` cases de distance. Une case
 *  intermédiaire MARCHABLE interrompt (on s'y poserait au lieu de sauter par-dessus). Les sauts
 *  retournés sont DÉJÀ validés (atterrissage praticable et libre). `foot>1` ne saute pas ; `jump<2`
 *  = aucun saut (un pas d'1 case n'est jamais un saut). La portée libre (M/3 m) vs avec Test se
 *  décide à la couche déplacement — ici on ne fait que l'atteignabilité géométrique. */
function jumpNeighbors(scene: Scene, p: Pt, jump: number, blocked: Set<string>, foot: number): Pt[] {
  if (jump < 2 || foot > 1) return [];
  const z = pz(p);
  const out: Pt[] = [];
  for (const [dx, dy] of NEIGHBORS) {
    for (let d = 2; d <= jump; d++) {
      let overGap = true; // les cases 1..d-1 doivent toutes être un gouffre (non-marchables)
      for (let k = 1; k < d; k++) if (isWalkable(scene, p.x + dx * k, p.y + dy * k, z)) { overGap = false; break; }
      if (!overGap) break; // une case marchable interrompt : pas de saut plus loin dans cette direction
      const lx = p.x + dx * d, ly = p.y + dy * d;
      if (footFits(scene, lx, ly, z, foot, blocked)) out.push(z ? { x: lx, y: ly, z } : { x: lx, y: ly });
    }
  }
  return out;
}

/**
 * L'empreinte N×N ancrée en (x, y, z) (coin NO) tient-elle ? Toutes ses tuiles (au même étage)
 * doivent être walkable (terrain/bâtiment) ET non bloquées. Pour `foot=1`, vérifie juste la tuile.
 * Permet à une grande créature de NE PAS se faufiler dans un couloir d'1 tuile (LDB 15 l.55).
 */
function footFits(scene: Scene, x: number, y: number, z: number, foot: number, blocked: Set<string>): boolean {
  if (foot <= 1) return isWalkable(scene, x, y, z) && !blocked.has(key(x, y, z));
  for (let dy = 0; dy < foot; dy++)
    for (let dx = 0; dx < foot; dx++) {
      if (!isWalkable(scene, x + dx, y + dy, z) || blocked.has(key(x + dx, y + dy, z))) return false;
    }
  return true;
}

/**
 * Cases atteignables depuis `start` en au plus `range` pas, en évitant les
 * cases occupées par `blocked`. Retourne une map clé→distance.
 */
export function reachable(scene: Scene, start: Pt, range: number, blocked: Set<string>, foot = 1): Map<string, number> {
  const links = stairLinks(scene);
  const dist = new Map<string, number>();
  const sz = pz(start);
  dist.set(key(start.x, start.y, sz), 0);
  let frontier: Pt[] = [{ x: start.x, y: start.y, z: sz }];
  for (let step = 0; step < range; step++) {
    const next: Pt[] = [];
    for (const p of frontier) {
      for (const n of neighborsOf(p, links)) {
        const nz = pz(n);
        const k = key(n.x, n.y, nz);
        if (dist.has(k)) continue;
        if (!footFits(scene, n.x, n.y, nz, foot, blocked)) continue; // l'empreinte entière doit tenir (LDB 15 l.55)
        dist.set(k, step + 1);
        next.push(n);
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
  const sz = pz(start); // le vol reste à l'étage du voltigeur (l'atterrissage doit y tenir)
  dist.set(key(start.x, start.y, sz), 0);
  for (let dy = -range; dy <= range; dy++)
    for (let dx = -range; dx <= range; dx++) {
      if (!dx && !dy) continue;
      const nx = start.x + dx;
      const ny = start.y + dy;
      if (!footFits(scene, nx, ny, sz, foot, blocked)) continue; // l'atterrissage doit tenir
      dist.set(key(nx, ny, sz), Math.max(Math.abs(dx), Math.abs(dy)));
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

/**
 * POUSSÉE en ligne (Jalon 2.6 — Poussée, LDB 47 : « repoussées de BFM mètres ») : la cible
 * recule de `tiles` cases dans la direction OPPOSÉE à `from` (pas de Tchebychev — signe de
 * dx/dy), en s'arrêtant devant la première case non franchissable/occupée. Renvoie la case
 * d'arrivée, le nombre de cases parcourues et s'il y a eu COLLISION (cases restantes > 0).
 */
export function pushAway(
  scene: Scene, from: Pt, target: Pt, tiles: number, blocked: Set<string>,
): { dest: Pt; pushed: number; collided: boolean } {
  const sx = Math.sign(target.x - from.x);
  const sy = Math.sign(target.y - from.y);
  const tz = pz(target); // la poussée glisse au même étage que la cible
  if ((!sx && !sy) || tiles <= 0) return { dest: { ...target }, pushed: 0, collided: false };
  let cur = { x: target.x, y: target.y };
  let pushed = 0;
  for (let i = 0; i < tiles; i++) {
    const next = { x: cur.x + sx, y: cur.y + sy };
    if (!isWalkable(scene, next.x, next.y, tz) || blocked.has(key(next.x, next.y, tz))) {
      return { dest: pt(cur.x, cur.y, tz), pushed, collided: true };
    }
    cur = next;
    pushed++;
  }
  return { dest: pt(cur.x, cur.y, tz), pushed, collided: false };
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
export function pathTo(scene: Scene, start: Pt, goal: Pt, blocked: Set<string>, foot = 1, jump = 0): Pt[] | null {
  const links = stairLinks(scene);
  const gz = pz(goal);
  const came = new Map<string, string | null>();
  came.set(key(start.x, start.y, pz(start)), null);
  const queue: Pt[] = [{ x: start.x, y: start.y, z: pz(start) }];
  while (queue.length) {
    const p = queue.shift()!;
    if (p.x === goal.x && p.y === goal.y && pz(p) === gz) {
      const path: Pt[] = [];
      let cur: string | null = key(p.x, p.y, pz(p));
      while (cur) {
        const [x, y, z = 0] = cur.split(',').map(Number);
        path.unshift(pt(x, y, z));
        cur = came.get(cur) ?? null;
      }
      return path;
    }
    for (const n of neighborsOf(p, links)) {
      const nz = pz(n);
      const k = key(n.x, n.y, nz);
      if (came.has(k)) continue;
      const isGoal = n.x === goal.x && n.y === goal.y && nz === gz;
      // Empreinte > 1 : chaque pas (arrivée incluse) doit tenir entièrement. 1×1 : la cible peut être
      // une case occupée (on s'arrête au contact d'un ennemi), comportement historique.
      if (foot > 1) { if (!footFits(scene, n.x, n.y, nz, foot, blocked)) continue; }
      else if (!isGoal && (!isWalkable(scene, n.x, n.y, nz) || blocked.has(k))) continue;
      came.set(k, key(p.x, p.y, pz(p)));
      queue.push(n);
    }
    // Sauts par-dessus un gouffre : atterrissages déjà validés (praticables/libres) — n'altèrent jamais
    // le déplacement à pied (jumpNeighbors=[] sans gouffre), donc gratis quand jump=0.
    for (const n of jumpNeighbors(scene, p, jump, blocked, foot)) {
      const k = key(n.x, n.y, pz(n));
      if (came.has(k)) continue;
      came.set(k, key(p.x, p.y, pz(p)));
      queue.push(n);
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

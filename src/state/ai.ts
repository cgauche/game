/**
 * IA d'ennemi — couche de DÉCISION pure et testable.
 *
 * `chooseEnemyAction` ne mute rien et ne tire aucun dé : elle choisit l'action
 * d'un ennemi à partir de l'état tactique (positions, Blessures, armes, sorts).
 * La RÉSOLUTION (jets, dégâts, animations, timers) reste dans le store.
 *
 * Aucune règle inventée : le déplacement réutilise le BFS de `path.ts`, le choix
 * de cible n'utilise que les Blessures et les distances, et le tir/sort est
 * délégué au moteur via le store. Les bandes de portée et la ligne de vue ne
 * sont PAS encore modélisées — on ne les invente donc pas (toute cible vivante
 * est considérée comme atteignable à distance).
 */
import { Combatant } from '../engine/types';
import { Scene } from './scene';
import { reachable, manhattan, chebyshev, Pt } from './path';

export type EnemyAction =
  | { kind: 'cast'; targetId: string; spell: string } // incantation offensive sur la cible
  | { kind: 'shoot'; targetId: string } // tir depuis la position courante (arme à distance)
  | { kind: 'melee'; targetId: string } // attaque de mêlée (cible adjacente)
  | { kind: 'move'; to: Pt; thenTargetId: string } // approche ; attaque après si adjacent
  | { kind: 'end' }; // rien à faire, passe la main

export interface EnemyTurnInput {
  /** L'ennemi qui agit (doit avoir `pos`). */
  enemy: Combatant;
  /** Héros encore en action (vivants), tous avec `pos`. */
  heroes: Combatant[];
  scene: Scene;
  /** Cases occupées par d'autres combattants (l'ennemi lui-même exclu). */
  blocked: Set<string>;
  /** Mouvement effectif en cases (dérivé de l'Encombrement par l'appelant). */
  movement: number;
  /** Libellé d'un sort offensif prêt, déjà résolu par l'appelant (qui a les données). */
  offensiveSpell?: string;
}

const adjacent = (a: Pt, b: Pt) => chebyshev(a, b) <= 1; // portée de mêlée = Chebyshev (diagonale incluse)

/**
 * Cible préférée : on sécurise les éliminations en visant les Blessures les plus
 * basses ; à Blessures égales, la plus proche. (Tri stable, déterministe.)
 */
function weakestNearest(enemyPos: Pt, heroes: Combatant[]): Combatant {
  return [...heroes].sort((a, b) => {
    if (a.wounds.current !== b.wounds.current) return a.wounds.current - b.wounds.current;
    return manhattan(enemyPos, a.pos!) - manhattan(enemyPos, b.pos!);
  })[0];
}

/** Choisit l'action d'un ennemi pour son tour. Pure et déterministe. */
export function chooseEnemyAction(input: EnemyTurnInput): EnemyAction {
  const { enemy, heroes, scene, blocked, movement, offensiveSpell } = input;
  if (heroes.length === 0) return { kind: 'end' };
  const pos = enemy.pos!;

  const isRanged = offensiveSpell == null && enemy.weapons[0]?.type === 'ranged';
  const hasMeleeWeapon = enemy.weapons.some((w) => w.type === 'melee');

  // Un ennemi sans sort et sans arme ne peut rien faire d'utile.
  if (offensiveSpell == null && enemy.weapons.length === 0) return { kind: 'end' };

  // Cases atteignables ce tour (inclut la case de départ à distance 0).
  const reach = reachable(scene, pos, movement, blocked);

  // Un héros est « frappable ce tour » en mêlée s'il est déjà adjacent OU si une
  // case atteignable lui est adjacente.
  const meleeReachableNow = (h: Combatant): boolean => {
    if (adjacent(pos, h.pos!)) return true;
    for (const k of reach.keys()) {
      const [x, y] = k.split(',').map(Number);
      if (adjacent({ x, y }, h.pos!)) return true;
    }
    return false;
  };

  // --- Choix de la cible ---------------------------------------------------
  // À distance (sort/arme) : toutes les cibles vivantes comptent (portée/LdV non
  // modélisées). En mêlée : on préfère une cible frappable ce tour ; sinon on
  // approche le plus faible.
  let target: Combatant;
  if (offensiveSpell != null || isRanged) {
    target = weakestNearest(pos, heroes);
  } else {
    const here = heroes.filter(meleeReachableNow);
    target = weakestNearest(pos, here.length ? here : heroes);
  }

  // --- Sort offensif : on lance sur la cible (résolu comme un projectile) ---
  if (offensiveSpell != null) return { kind: 'cast', targetId: target.id, spell: offensiveSpell };

  // --- Arme à distance : tenir la position et tirer ------------------------
  if (isRanged) return { kind: 'shoot', targetId: target.id };

  // --- Mêlée ---------------------------------------------------------------
  if (!hasMeleeWeapon) return { kind: 'end' };
  if (adjacent(pos, target.pos!)) return { kind: 'melee', targetId: target.id };

  // Se rapprocher : viser une case atteignable adjacente à la cible si possible,
  // sinon la case atteignable la plus proche de la cible.
  let best: Pt | null = null;
  let bestScore: [number, number] | null = null; // [0 = adjacente à la cible, distance]
  for (const k of reach.keys()) {
    const [x, y] = k.split(',').map(Number);
    if (x === pos.x && y === pos.y) continue; // ne pas « bouger » sur place
    const tile = { x, y };
    const score: [number, number] = [adjacent(tile, target.pos!) ? 0 : 1, manhattan(tile, target.pos!)];
    if (!bestScore || score[0] < bestScore[0] || (score[0] === bestScore[0] && score[1] < bestScore[1])) {
      best = tile;
      bestScore = score;
    }
  }
  if (best) return { kind: 'move', to: best, thenTargetId: target.id };
  return { kind: 'end' };
}

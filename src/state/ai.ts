/**
 * IA d'ennemi — couche de DÉCISION pure et testable.
 *
 * `chooseEnemyAction` ne mute rien et ne tire aucun dé : elle choisit l'action
 * d'un ennemi à partir de l'état tactique (positions, Blessures, armes, sorts).
 * La RÉSOLUTION (jets, dégâts, animations, timers) reste dans le store.
 *
 * Aucune règle inventée : le déplacement réutilise le BFS de `path.ts`, le choix
 * de cible n'utilise que les Blessures et les distances, et le tir/sort est
 * délégué au moteur via le store. La **Ligne de Vue** est respectée (on ne vise pas au tir/sort
 * une cible masquée — LDB 13 l.123) ; les bandes de portée restent appliquées par le moteur au jet.
 */
import { Combatant } from '../engine/types';
import { Scene } from './scene';
import { reachable, manhattan, chebyshev, Pt } from './path';
import { lineOfSightCover } from './lineOfSight';

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

  const hasRanged = offensiveSpell == null && enemy.weapons.some((w) => w.type === 'ranged');
  const hasMeleeWeapon = enemy.weapons.some((w) => w.type === 'melee');

  // Un ennemi sans sort et sans arme ne peut rien faire d'utile.
  if (offensiveSpell == null && enemy.weapons.length === 0) return { kind: 'end' };

  // Adversaires au Combat rapproché (au contact). Avec une arme de mêlée, on les frappe plutôt que
  // de tirer : une arme à distance sans Atout Pistolet ne tire pas en mêlée (LDB Armes l.297-298).
  // C'est ce qui corrige l'arbalétrier qui canardait au loin alors qu'il était Engagé.
  const adjacentFoes = heroes.filter((h) => adjacent(pos, h.pos!));
  // Ligne de Vue (LDB 13 l.123) : on ne vise au tir/sort qu'une cible visible. Occupants ignorés
  // ici (une créature ne BLOQUE pas la vue — elle ne donne qu'un couvert imparfait, géré au jet).
  const visible = (h: Combatant): boolean => !lineOfSightCover(scene, pos, h.pos!, []).blocked;
  const shootableHeroes = heroes.filter(visible);
  const canShoot = hasRanged && !(adjacentFoes.length > 0 && hasMeleeWeapon) && shootableHeroes.length > 0;
  const canCast = offensiveSpell != null && shootableHeroes.length > 0;

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
  // À distance (sort/arme) : on vise le plus faible PARMI les cibles visibles (LdV). En mêlée :
  // on préfère une cible frappable ce tour ; sinon on approche le plus faible.
  let target: Combatant;
  if (canCast || canShoot) {
    target = weakestNearest(pos, shootableHeroes);
  } else {
    // Un tireur RETENU au Combat rapproché (arme à distance + adversaire au contact) frappe
    // l'adversaire à son contact. Sinon, comportement de mêlée habituel (sécuriser le plus faible).
    const heldInMelee = hasRanged && adjacentFoes.length > 0;
    const here = heldInMelee ? adjacentFoes : heroes.filter(meleeReachableNow);
    target = weakestNearest(pos, here.length ? here : heroes);
  }

  // --- Sort offensif : on lance sur la cible visible (résolu comme un projectile) ---
  if (canCast) return { kind: 'cast', targetId: target.id, spell: offensiveSpell! };

  // --- Arme à distance (hors Combat rapproché, cible visible) : tenir la position et tirer ----
  if (canShoot) return { kind: 'shoot', targetId: target.id };

  // --- Mêlée / repositionnement -------------------------------------------
  if (hasMeleeWeapon && adjacent(pos, target.pos!)) return { kind: 'melee', targetId: target.id };

  // Se rapprocher : viser une case atteignable adjacente à la cible si possible, sinon la plus
  // proche. Vaut pour la mêlée ET pour un tireur sans cible visible (se déplacer pour dégager la LdV).
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

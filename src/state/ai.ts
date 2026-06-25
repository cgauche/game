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
import { reachable, flyReachable, manhattan, chebyshev, Pt } from './path';
import { footprintChebyshev, footprintN } from './footprint';
import { losClear, tileSeenByFoe } from './lineOfSight';
import { rangeBandModifier } from '../engine/combat';
import { hasCondition, canTakeAction } from '../engine/conditions';
import { effectiveMovement } from '../engine/encumbrance';
import { isEngaged, meleeReachTiles } from '../engine/engagement';
import { groupMatch } from '../engine/groups';
import { isBestial, isTerritorial } from '../engine/traits/dispatch';
import { isFrenzied } from '../engine/psychology';

export type EnemyAction =
  | { kind: 'cast'; targetId: string; spell: string } // incantation offensive sur la cible
  | { kind: 'shoot'; targetId: string } // tir depuis la position courante (arme à distance)
  | { kind: 'reload' } // recharge une arme à Recharge déchargée (Test étendu de Projectiles, LDB 63 l.28-29)
  | { kind: 'melee'; targetId: string } // attaque de mêlée (cible adjacente)
  | { kind: 'move'; to: Pt; thenTargetId: string } // approche ; attaque après si adjacent
  | { kind: 'recover'; state: 'empetre' | 'en-flammes' } // se libérer / se rouler au sol (LDB 16 l.61/77)
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
  /** Portée du sort offensif en CASES (spellRangeTiles, résolue par l'appelant) ;
   *  null/absent = portée non chiffrable → pas de gate (comportement historique). */
  spellRange?: number | null;
  /** Vol (LDB 85 p.343) : le déplacement ignore terrains/obstacles/personnages traversés. */
  flying?: boolean;
  /** Cases enfumées (Souffle (Fumée)) qui bloquent la Ligne de Vue. */
  smoke?: Pt[];
  /** Vision RÉCIPROQUE : cases (`"x,y,0"`) que CET ennemi perçoit réellement (Ligne de Vue + lumière,
   *  vision nocturne incluse) — calculé par l'appelant via le moteur de vision. L'ennemi ne cible/poursuit
   *  que les héros sur ces cases (furtivité). ABSENT = pas de gate (comportement historique / tests purs). */
  perceived?: Set<string>;
}

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

/** Frénésie (LDB 21 l.34) : le frénétique vise IMPÉRATIVEMENT l'ennemi le plus PROCHE de sa Ligne de
 *  Vue (pas le plus faible) ; à distance égale, le plus blessé (tri stable, déterministe). */
function nearest(enemyPos: Pt, heroes: Combatant[]): Combatant {
  return [...heroes].sort((a, b) => {
    const da = manhattan(enemyPos, a.pos!), db = manhattan(enemyPos, b.pos!);
    if (da !== db) return da - db;
    return a.wounds.current - b.wounds.current;
  })[0];
}

/** Choisit l'action d'un ennemi pour son tour. Pure et déterministe. */
export function chooseEnemyAction(input: EnemyTurnInput): EnemyAction {
  const { enemy, scene, blocked, movement, offensiveSpell, spellRange, smoke, flying } = input;
  // Vision réciproque : l'ennemi ne cible/poursuit que les héros qu'il PERÇOIT (LoS + lumière, comme le
  // groupe). `perceived` absent = aucun gate (comportement historique / tests purs).
  const heroes = input.perceived
    ? input.heroes.filter((h) => h.pos && input.perceived!.has(`${h.pos.x},${h.pos.y},0`))
    : input.heroes;
  if (heroes.length === 0) return { kind: 'end' };
  if (!canTakeAction(enemy) && effectiveMovement(enemy) === 0) return { kind: 'end' }; // ni Action ni Mouvement (Surpris LDB 16 l.132…) → passe la main (gating data-driven, plus de nom en dur)
  // En flammes (LDB 16 l.77) : un ennemi NON frénétique se roule au sol pour éteindre le feu (1d10/Round
  // est mortel). Un frénétique ignore le danger et continue d'attaquer (Frénésie, LDB 21 l.34).
  if (hasCondition(enemy, 'en-flammes') && !isFrenzied(enemy)) return { kind: 'recover', state: 'en-flammes' };
  const pos = enemy.pos!;
  // Portée de mêlée = Allonge de l'arme (RAW-3, LDB 62 l.211/213) ; 1 case par défaut. Diagonale incluse
  // (Chebyshev). Source unique partagée avec le héros et la résolution → symétrie héros/ennemi.
  const mr = meleeReachTiles(enemy.weapons);
  const withinMelee = (a: Pt, b: Pt) => chebyshev(a, b) <= mr;
  // Au CONTACT par empreinte (LDB 15 l.55) : un grand ennemi touche depuis n'importe quelle de ses tuiles.
  const inMelee = (h: Combatant) => footprintChebyshev(pos, footprintN(enemy), h.pos!, footprintN(h)) <= mr;

  const hasRanged = offensiveSpell == null && enemy.weapons.some((w) => w.type === 'ranged');
  const hasMeleeWeapon = enemy.weapons.some((w) => w.type === 'melee');
  // Rechargement (LDB 63 l.28-29) : une arme à Recharge DÉCHARGÉE ne peut pas tirer → il faut recharger
  // d'abord. `loaded` n'est suivi que pour les acteurs concernés (héros ayant tiré) ; un ennemi reste
  // chargé (le décompte de Recharge lui est épargné), donc `!enemy.loaded` ne déclenche que pour qui doit.
  const rangedW = enemy.weapons.find((w) => w.type === 'ranged');
  const reloadNeeded = hasRanged && !!rangedW && (rangedW.reload ?? 0) > 0 && !enemy.loaded;

  // Un ennemi sans sort et sans arme ne peut rien faire d'utile.
  if (offensiveSpell == null && enemy.weapons.length === 0) return { kind: 'end' };

  // Adversaires au Combat rapproché (au contact). Avec une arme de mêlée, on les frappe plutôt que
  // de tirer : une arme à distance sans Atout Pistolet ne tire pas en mêlée (LDB Armes l.297-298).
  // C'est ce qui corrige l'arbalétrier qui canardait au loin alors qu'il était Engagé.
  const adjacentFoes = heroes.filter(inMelee);
  // Ligne de Vue (LDB 13 l.123) : on ne vise au tir/sort qu'une cible visible. Occupants ignorés
  // ici (une créature ne BLOQUE pas la vue — elle ne donne qu'un couvert imparfait, géré au jet).
  const visible = (h: Combatant): boolean => losClear(scene, pos, h.pos!, smoke ?? []);
  const shootableHeroes = heroes.filter(visible);
  // PORTÉE (parité avec le gate pré-clic du héros) : un tireur ne vise pas au-delà de la bande
  // Extrême (Portée ×3 — rangeBandModifier null), un lanceur pas au-delà de la portée du sort.
  // Sans portée chiffrée (arme sans `range`, sort spécial) : pas de gate (stubs/exotiques).
  const fpDist = (h: Combatant) => footprintChebyshev(pos, footprintN(enemy), h.pos!, footprintN(h));
  const maxWeaponRange = enemy.weapons.reduce((m, w) => (w.type === 'ranged' && w.range ? Math.max(m, w.range) : m), 0);
  const shootPool = maxWeaponRange > 0 ? shootableHeroes.filter((h) => rangeBandModifier(fpDist(h), maxWeaponRange) != null) : shootableHeroes;
  const castPool = spellRange != null ? shootableHeroes.filter((h) => fpDist(h) <= spellRange) : shootableHeroes;
  // Frénésie (LDB 21 l.34) : la seule Action est un Test de Capacité de Combat / Athlétisme — ni tir ni sort.
  const frenzied = isFrenzied(enemy);
  const canShoot = !frenzied && hasRanged && !reloadNeeded && !(adjacentFoes.length > 0 && hasMeleeWeapon) && shootPool.length > 0;
  const canCast = !frenzied && offensiveSpell != null && castPool.length > 0;

  // Cases atteignables ce tour (inclut la case de départ à distance 0). Vol (LDB 85 p.343) :
  // ligne directe, seules les cases d'atterrissage doivent être praticables et libres.
  const reach = (flying ? flyReachable : reachable)(scene, pos, movement, blocked, footprintN(enemy));

  // Fuite (Brisé / Bestial blessé). `preferHidden` (Brisé, LDB 16 l.55 « hors de vue de l'ennemi ») :
  // gagner une CACHETTE (case hors de vue de tout héros) prime sur la distance ; sinon, la plus éloignée.
  const fleeMove = (preferHidden = false): EnemyAction => {
    const tiles = [...reach.keys()].map((k) => { const [x, y] = k.split(',').map(Number); return { x, y } as Pt; });
    const distOf = (t: Pt) => Math.min(...heroes.map((h) => chebyshev(t, h.pos!)));
    const hidden = preferHidden ? tiles.filter((t) => !tileSeenByFoe(scene, heroes, t, smoke ?? [])) : [];
    let best = pos;
    let bestDist = distOf(pos);
    // Actuellement à découvert mais une cachette est atteignable → toute cachette vaut mieux que rester vu.
    if (hidden.length && tileSeenByFoe(scene, heroes, pos, smoke ?? [])) { best = hidden[0]; bestDist = -1; }
    for (const t of (hidden.length ? hidden : tiles)) {
      const d = distOf(t);
      if (d > bestDist) { bestDist = d; best = t; }
    }
    return best.x === pos.x && best.y === pos.y ? { kind: 'end' } : { kind: 'move', to: best, thenTargetId: heroes[0].id };
  };
  // Brisé (LDB 16 l.55) : un ennemi Brisé NON Engagé fuit — il gagne la case atteignable la PLUS
  // éloignée des héros et ne peut pas attaquer. (Engagé : il reste — l'IA ne se désengage pas, simplif. assumée.)
  if (hasCondition(enemy, 'brise') && !isEngaged(enemy)) return fleeMove(true); // Brisé : fuir hors de vue (cachette prioritaire)
  // Bestial (LDB 85 p.338) : « Si elle perd plus de la moitié de ses Blessures, elle tente de fuir »
  // — sauf Territorial (combat jusqu'à la mort) ou acculée/Engagée (elle reste — Frénésie gérée par
  // le drapeau frenzied de l'appelant).
  if (isBestial(enemy.traits) && !isTerritorial(enemy.traits) && !isFrenzied(enemy)
      && enemy.wounds.current < enemy.wounds.max / 2 && !isEngaged(enemy)) return fleeMove();

  // Un héros est « frappable ce tour » en mêlée s'il est déjà adjacent OU si une
  // case atteignable lui est adjacente.
  const meleeReachableNow = (h: Combatant): boolean => {
    if (withinMelee(pos, h.pos!)) return true;
    for (const k of reach.keys()) {
      const [x, y] = k.split(',').map(Number);
      if (withinMelee({ x, y }, h.pos!)) return true;
    }
    return false;
  };

  // --- Choix de la cible ---------------------------------------------------
  // À distance (sort/arme) : on vise le plus faible PARMI les cibles visibles (LdV). En mêlée :
  // on préfère une cible frappable ce tour ; sinon on approche le plus faible.
  // Animosité/Haine ACTIVE (LDB 21 l.22/41) : on doit s'en prendre EN PRIORITÉ au groupe haï. Restreint
  // la sélection aux membres du groupe présents dans le vivier considéré (sinon ciblage habituel).
  const hatedCibles = (enemy.psychState ?? [])
    .filter((p) => (p.type === 'animosite' || p.type === 'haine') && p.active && p.cible)
    .map((p) => p.cible!);
  const hatedOf = (pool: Combatant[]) =>
    hatedCibles.length ? pool.filter((h) => hatedCibles.some((cb) => groupMatch(cb, h.groups ?? []))) : [];

  let target: Combatant;
  if (frenzied) {
    // Frénésie : on se rue sur l'ennemi le plus PROCHE en Ligne de Vue (LDB 21 l.34).
    const visibleFoes = shootableHeroes.length ? shootableHeroes : heroes;
    target = nearest(pos, visibleFoes);
  } else if (canCast || canShoot) {
    // Vivier filtré par PORTÉE (le sort prime sur le tir, même priorité que la décision plus bas).
    const vivier = canCast ? castPool : shootPool;
    const pool = hatedOf(vivier);
    target = weakestNearest(pos, pool.length ? pool : vivier);
  } else {
    // Un tireur RETENU au Combat rapproché (arme à distance + adversaire au contact) frappe
    // l'adversaire à son contact. Sinon, comportement de mêlée habituel (sécuriser le plus faible).
    const heldInMelee = hasRanged && adjacentFoes.length > 0;
    const here = heldInMelee ? adjacentFoes : heroes.filter(meleeReachableNow);
    const base = here.length ? here : heroes;
    const pool = hatedOf(base);
    target = weakestNearest(pos, pool.length ? pool : base);
  }

  // --- Sort offensif : on lance sur la cible visible (résolu comme un projectile) ---
  if (canCast) return { kind: 'cast', targetId: target.id, spell: offensiveSpell! };

  // --- Recharger : arme à Recharge déchargée + cible en vue/portée → recharger plutôt que rester inerte
  //     (consomme l'Action) ; sauf si un adversaire au contact justifie une attaque de mêlée. ---
  if (reloadNeeded && shootPool.length > 0 && !(adjacentFoes.length > 0 && hasMeleeWeapon)) return { kind: 'reload' };

  // --- Arme à distance (hors Combat rapproché, cible visible) : tenir la position et tirer ----
  if (canShoot) return { kind: 'shoot', targetId: target.id };

  // --- Mêlée / repositionnement -------------------------------------------
  if (hasMeleeWeapon && inMelee(target)) return { kind: 'melee', targetId: target.id };

  // Se rapprocher : viser une case atteignable adjacente à la cible si possible, sinon la plus
  // proche. Vaut pour la mêlée ET pour un tireur sans cible visible (se déplacer pour dégager la LdV).
  let best: Pt | null = null;
  let bestScore: [number, number] | null = null; // [0 = adjacente à la cible, distance]
  for (const k of reach.keys()) {
    const [x, y] = k.split(',').map(Number);
    if (x === pos.x && y === pos.y) continue; // ne pas « bouger » sur place
    const tile = { x, y };
    const score: [number, number] = [withinMelee(tile, target.pos!) ? 0 : 1, manhattan(tile, target.pos!)];
    if (!bestScore || score[0] < bestScore[0] || (score[0] === bestScore[0] && score[1] < bestScore[1])) {
      best = tile;
      bestScore = score;
    }
  }
  if (best) return { kind: 'move', to: best, thenTargetId: target.id };
  // Aucune attaque possible et nulle part où aller : un Empêtré (Mouvement nul, LDB 16 l.85) se libère
  // plutôt que de perdre son tour (Test opposé de Force contre la source, l.61).
  if (hasCondition(enemy, 'empetre')) return { kind: 'recover', state: 'empetre' };
  return { kind: 'end' };
}

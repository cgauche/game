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
  | { kind: 'castArea'; spell: string; center: Pt } // sort de ZONE (ZdE) auto-posé sur un point couvrant ≥2 héros
  | { kind: 'focus'; spell: string } // Focalisation (LDB 46) d'un sort offensif infaisable en un seul jet
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
  /** Focalisation (LDB 46) — résolu par l'appelant (couche impure, qui a les données de sort) :
   *  un sort offensif DÉJÀ focalisé et PRÊT (`caster.focus.dr >= cn`) → lançable à NI 0 ce tour. */
  readyFocusedSpell?: string;
  /** Meilleur sort offensif FOCALISABLE mais infaisable en un seul jet (`cn > maxSL`, isArcaneSpell,
   *  Compétence de Focalisation possédée) — résolu par l'appelant. L'IA y consacre son tour à FOCALISER
   *  (au lieu de rater un NI hors d'atteinte en boucle), sauf menacée au contact avec un repli. */
  focusableSpell?: string;
  /** Sort de ZONE de dégâts castable (id + géométrie résolue par l'appelant). L'IA le joue (auto-pose
   *  du centre) quand le centre couvre ≥2 héros. `range` null = portée non chiffrable → pas de gate. */
  areaSpell?: { spell: string; radius: number; range: number | null; cn: number };
}

/**
 * Une cible est NEUTRALISÉE (au sol/inconsciente/0 PB encore là) : on n'a aucun intérêt tactique à
 * s'acharner dessus tant qu'une menace DEBOUT existe. Lue en DONNÉE (États + Blessures), sans nom en
 * dur — un combattant À Terre/Inconscient ou à ≤0 PB (encore dans le vivier) est « par terre ».
 */
function isNeutralized(h: Combatant): boolean {
  return hasCondition(h, 'a-terre') || hasCondition(h, 'inconscient') || h.wounds.current <= 0;
}

/**
 * Cible préférée — tri LEXICOGRAPHIQUE déterministe (anti-acharnement, P1 du diagnostic) :
 *  (a) cible NON neutralisée d'abord (tier 0) ; une neutralisée (tier 1) n'est choisie qu'en dernier
 *      recours (elle reste dans le vivier — on peut l'achever si c'est la seule option) ;
 *  (b) à tier égal, Blessures (PB) croissantes (on sécurise l'élimination du plus entamé DEBOUT) ;
 *  (c) puis distance Manhattan croissante. Stable et déterministe (aucun dé).
 */
function bestTarget(enemyPos: Pt, heroes: Combatant[]): Combatant {
  return [...heroes].sort((a, b) => {
    const ta = isNeutralized(a) ? 1 : 0, tb = isNeutralized(b) ? 1 : 0;
    if (ta !== tb) return ta - tb;
    if (a.wounds.current !== b.wounds.current) return a.wounds.current - b.wounds.current;
    return manhattan(enemyPos, a.pos!) - manhattan(enemyPos, b.pos!);
  })[0];
}

/**
 * Meilleur CENTRE d'un sort de ZONE (ZdE, LDB 47 l.44) couvrant le plus de héros : on essaie chaque
 * case occupée par un héros comme centre candidat (déterministe, suffisant pour « un paquet ») et on
 * compte les héros dans le rayon (Chebyshev, comme `castCommitZone`). Un centre VALIDE doit respecter
 * la portée du sort (Chebyshev depuis le lanceur) et la Ligne de Vue (LDB 46 l.170). Renvoie le centre
 * couvrant le plus de héros (≥2) ou null. Tie-break déterministe : couverture ↓, puis coordonnées ↑.
 */
function bestAreaCenter(
  enemyPos: Pt,
  heroes: Combatant[],
  radius: number,
  range: number | null,
  losAt: (pt: Pt) => boolean,
): { center: Pt; covered: number } | null {
  let best: { center: Pt; covered: number } | null = null;
  for (const h of heroes) {
    const center = h.pos!;
    if (range != null && chebyshev(enemyPos, center) > range) continue;
    if (!losAt(center)) continue;
    const covered = heroes.filter((o) => chebyshev(center, o.pos!) <= radius).length;
    if (
      !best || covered > best.covered ||
      (covered === best.covered && (center.x < best.center.x || (center.x === best.center.x && center.y < best.center.y)))
    ) {
      best = { center, covered };
    }
  }
  return best && best.covered >= 2 ? best : null;
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

/**
 * Un CANDIDAT d'action discrétionnaire (Lot 2 — Socle Utility).
 * `tier` = palier de priorité LEXICOGRAPHIQUE (plus PETIT = meilleur) — il REPRODUIT EXACTEMENT la
 * cascade historique : castArea(≥2) < focus < cast < reload < shoot < melee < move(approche).
 * `targetId`/`coord` servent UNIQUEMENT de départage déterministe à palier égal (tie-break stable),
 * ils ne renversent JAMAIS l'ordre des paliers. Les poids sont donc NEUTRES au Lot 2 : le moteur
 * « énumérer → scorer → argmax » recrée trait pour trait la décision précédente. Les heuristiques
 * fines (menace, positionnement) sont réservées au Lot 3 et n'apparaissent pas ici.
 */
interface Candidate {
  action: EnemyAction;
  tier: number;
  /** id de la cible visée (départage secondaire, stable) — vide si l'action n'en a pas. */
  targetId: string;
  /** coordonnées de destination/centre (départage tertiaire) — null si l'action n'en a pas. */
  coord: Pt | null;
}

// Paliers de priorité (cascade historique, du plus prioritaire au moins). Énumérés ici une fois
// pour que `scoreCandidate` et la lecture restent une SOURCE UNIQUE de l'ordre.
const TIER = {
  castArea: 0, // ZdE couvrant ≥2 héros (LDB 47 l.44)
  focus: 1, // Focalisation d'un sort infaisable d'un jet (LDB 46)
  cast: 2, // sort offensif mono-cible
  reload: 3, // recharge d'une arme à Recharge
  shoot: 4, // tir à distance
  melee: 5, // attaque de mêlée
  move: 6, // approche / repositionnement
} as const;

/**
 * Score LEXICOGRAPHIQUE d'un candidat (Lot 2 : neutre — recrée la cascade). Le palier prime ; à
 * palier égal, on départage par id de cible (ordre stable, déterministe) puis par coordonnées (x,y).
 * Renvoie un tuple comparé champ par champ par `argmax`. Plus PETIT = meilleur (comme un tri).
 */
function scoreCandidate(c: Candidate): [number, string, number, number] {
  return [c.tier, c.targetId, c.coord?.x ?? 0, c.coord?.y ?? 0];
}

/** argmax déterministe : meilleur candidat (score lexicographique minimal). Tie-break stable. */
function argmax(cands: Candidate[]): Candidate | null {
  let best: Candidate | null = null;
  let bestScore: [number, number, string, number, number] | null = null;
  for (let i = 0; i < cands.length; i++) {
    const s = scoreCandidate(cands[i]);
    // On adjoint l'index d'énumération en dernier critère : ultime garde-fou de stabilité (deux
    // candidats parfaitement égaux gardent l'ordre d'énumération — ne survient pas en pratique).
    const full: [number, number, string, number, number] = [s[0], i, s[1], s[2], s[3]];
    if (
      bestScore == null ||
      full[0] < bestScore[0] || (full[0] === bestScore[0] && (
        full[2] < bestScore[2] || (full[2] === bestScore[2] && (
          full[3] < bestScore[3] || (full[3] === bestScore[3] && (
            full[4] < bestScore[4] || (full[4] === bestScore[4] && full[1] < bestScore[1])
          ))
        ))
      ))
    ) {
      best = cands[i];
      bestScore = full;
    }
  }
  return best;
}

/** Choisit l'action d'un ennemi pour son tour. Pure et déterministe. */
export function chooseEnemyAction(input: EnemyTurnInput): EnemyAction {
  const { enemy, scene, blocked, movement, offensiveSpell, spellRange, smoke, flying } = input;
  const { readyFocusedSpell, focusableSpell, areaSpell } = input;
  // Vision réciproque : l'ennemi ne cible/poursuit que les héros qu'il PERÇOIT (LoS + lumière, comme le
  // groupe). `perceived` absent = aucun gate (comportement historique / tests purs).
  const heroes = input.perceived
    ? input.heroes.filter((h) => h.pos && input.perceived!.has(`${h.pos.x},${h.pos.y},0`))
    : input.heroes;
  if (input.heroes.length === 0) return { kind: 'end' }; // plus AUCUN adversaire (combat fini) → passe la main
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

  // Un ennemi sans AUCUN moyen d'agir (sort offensif/focalisé/focalisable/ZdE NI sort, ni arme) ne
  // peut rien faire d'utile → il passe la main (les sorts comptent comme une capacité d'action).
  const hasAnyMagic = offensiveSpell != null || readyFocusedSpell != null || focusableSpell != null || areaSpell != null;
  if (!hasAnyMagic && enemy.weapons.length === 0) return { kind: 'end' };

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
  // Sort offensif à lancer ce tour : un sort DÉJÀ focalisé et prêt (lançable à NI 0) prime sur le
  // meilleur missile faisable en un jet (l'appelant a résolu `spellRange` pour CE sort).
  const castSpellId = readyFocusedSpell ?? offensiveSpell;
  const canShoot = !frenzied && hasRanged && !reloadNeeded && !(adjacentFoes.length > 0 && hasMeleeWeapon) && shootPool.length > 0;
  const canCast = !frenzied && castSpellId != null && castPool.length > 0;

  // Cases atteignables ce tour (inclut la case de départ à distance 0). Vol (LDB 85 p.343) :
  // ligne directe, seules les cases d'atterrissage doivent être praticables et libres.
  const reach = (flying ? flyReachable : reachable)(scene, pos, movement, blocked, footprintN(enemy));

  // ANTI-IMMOBILISME (combat ENGAGÉ, fidélité LDB 13 l.123) : si la perception ne montre AUCUNE cible
  // (lumière/Ligne de Vue) mais que des adversaires EXISTENT, l'ennemi avance d'un cran vers le plus
  // proche NON perçu — il ne tire/lance PAS dessus (pas de vue), il se RAPPROCHE seulement (mouvement
  // seul), au lieu de passer son tour planté. Pur : aucune cible non perçue n'est jamais visée.
  if (heroes.length === 0) {
    const closest = [...input.heroes].filter((h) => h.pos).sort((a, b) => manhattan(pos, a.pos!) - manhattan(pos, b.pos!))[0];
    if (!closest) return { kind: 'end' };
    let to: Pt | null = null;
    let bestD: number | null = null;
    for (const k of reach.keys()) {
      const [x, y] = k.split(',').map(Number);
      if (x === pos.x && y === pos.y) continue;
      const d = manhattan({ x, y }, closest.pos!);
      if (bestD == null || d < bestD) { bestD = d; to = { x, y }; }
    }
    return to ? { kind: 'move', to, thenTargetId: closest.id } : { kind: 'end' };
  }

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

  // === CŒUR DISCRÉTIONNAIRE — moteur Utility (Lot 2) =======================
  // Tout ce qui précède (gardes RAW/psychologie : fin de combat, En flammes, Brisé, Bestial, fuite,
  // anti-immobilisme…) reste FORCÉ et n'entre PAS dans le scoring. Ici on ÉNUMÈRE les actions JOUABLES,
  // on les SCORE par paliers neutres (= cascade historique) et on prend l'argmax. Aucune règle inventée :
  // les gardes de validité (portée, LdV, canCast/canShoot/inMelee, ZdE, focalisable) sont IDENTIQUES.

  // Animosité/Haine ACTIVE (LDB 21 l.22/41) : filtre de VIVIER appliqué AVANT le choix de cible — on
  // s'en prend en priorité au groupe haï présent dans le vivier considéré (sinon ciblage habituel).
  const hatedCibles = (enemy.psychState ?? [])
    .filter((p) => (p.type === 'animosite' || p.type === 'haine') && p.active && p.cible)
    .map((p) => p.cible!);
  const hatedOf = (pool: Combatant[]) =>
    hatedCibles.length ? pool.filter((h) => hatedCibles.some((cb) => groupMatch(cb, h.groups ?? []))) : [];
  // Cible préférée d'un vivier filtré : on restreint au groupe haï s'il y en a un, sinon vivier brut ;
  // Frénésie impose `nearest` (le plus proche en LdV, LDB 21 l.34) au lieu du tri lexicographique.
  const chooseTarget = (vivier: Combatant[]): Combatant => {
    if (frenzied) {
      const visibleFoes = shootableHeroes.length ? shootableHeroes : heroes;
      return nearest(pos, visibleFoes);
    }
    const pool = hatedOf(vivier);
    return bestTarget(pos, pool.length ? pool : vivier);
  };

  // Meilleure case d'APPROCHE vers une cible (mêlée OU tireur dégageant la LdV) : adjacente à la
  // cible si possible, sinon la plus proche. Tie-break inchangé : [adjacence, distance Manhattan].
  const approachTowards = (target: Combatant): Pt | null => {
    let best: Pt | null = null;
    let bestScore: [number, number] | null = null;
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
    return best;
  };

  // --- ÉNUMÉRATION des candidats JOUABLES ----------------------------------
  // On ne produit qu'UN candidat par type d'action (Lot 2 : parité stricte — la cible est choisie par
  // le `chooseTarget`/`bestTarget` historique ; l'élargissement à toutes les cibles est pour le Lot 3).
  const candidates: Candidate[] = [];

  // ZdE (LDB 47 l.44) : un sort de ZONE castable dont le centre auto-posé couvre ≥2 héros (portée + LdV).
  if (!frenzied && areaSpell) {
    const ac = bestAreaCenter(pos, shootableHeroes, areaSpell.radius, areaSpell.range, (pt) => losClear(scene, pos, pt, smoke ?? []));
    if (ac) candidates.push({ action: { kind: 'castArea', spell: areaSpell.spell, center: ac.center }, tier: TIER.castArea, targetId: '', coord: ac.center });
  }
  // Focalisation (LDB 46) : sort focalisable + AUCUN sort faisable d'un jet (`!canCast`), sauf menacé au
  // contact avec un repli (arme de mêlée ou tir) — risque d'interruption (l.193).
  if (!frenzied && focusableSpell && !canCast) {
    const contactFallback = adjacentFoes.length > 0 && (hasMeleeWeapon || canShoot);
    if (!contactFallback) candidates.push({ action: { kind: 'focus', spell: focusableSpell }, tier: TIER.focus, targetId: '', coord: null });
  }
  // Sort offensif mono-cible (sur la cible visible/à portée, résolu comme un projectile).
  if (canCast) {
    const t = chooseTarget(castPool);
    candidates.push({ action: { kind: 'cast', targetId: t.id, spell: castSpellId! }, tier: TIER.cast, targetId: t.id, coord: t.pos ?? null });
  }
  // Recharger (LDB 63 l.28-29) : arme à Recharge déchargée + cible en vue/portée, sauf attaque de mêlée justifiée.
  if (reloadNeeded && shootPool.length > 0 && !(adjacentFoes.length > 0 && hasMeleeWeapon)) {
    candidates.push({ action: { kind: 'reload' }, tier: TIER.reload, targetId: '', coord: null });
  }
  // Tir (hors Combat rapproché, cible visible) : tenir la position et tirer.
  if (canShoot) {
    const t = chooseTarget(shootPool);
    candidates.push({ action: { kind: 'shoot', targetId: t.id }, tier: TIER.shoot, targetId: t.id, coord: t.pos ?? null });
  }
  // Mêlée / approche : la cible de contact suit le comportement historique (tireur retenu au contact
  // frappe l'adversaire à son contact ; sinon, cible frappable ce tour, sinon vivier complet).
  if (!canCast && !canShoot) {
    const heldInMelee = hasRanged && adjacentFoes.length > 0;
    const here = heldInMelee ? adjacentFoes : heroes.filter(meleeReachableNow);
    const base = here.length ? here : heroes;
    const t = chooseTarget(base);
    if (hasMeleeWeapon && inMelee(t)) {
      candidates.push({ action: { kind: 'melee', targetId: t.id }, tier: TIER.melee, targetId: t.id, coord: t.pos ?? null });
    } else {
      const to = approachTowards(t);
      if (to) candidates.push({ action: { kind: 'move', to, thenTargetId: t.id }, tier: TIER.move, targetId: t.id, coord: to });
    }
  } else {
    // Avec un sort/tir jouable : la cascade historique ne propose JAMAIS de mêlée/move (cast/shoot
    // priment et retournent toujours). On ne produit donc pas de candidat de contact ici (parité).
  }

  // --- ARGMAX : meilleur candidat (palier + tie-break déterministe) ---------
  const chosen = argmax(candidates);
  if (chosen) return chosen.action;

  // Aucun candidat jouable : un Empêtré (Mouvement nul, LDB 16 l.85) se libère plutôt que perdre son
  // tour (Test opposé de Force contre la source, l.61). Sinon, passe la main.
  if (hasCondition(enemy, 'empetre')) return { kind: 'recover', state: 'empetre' };
  return { kind: 'end' };
}

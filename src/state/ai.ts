/**
 * IA d'ennemi — couche de DÉCISION pure et testable.
 *
 * `chooseEnemyAction` ne mute rien et ne tire aucun dé : elle choisit l'action
 * d'un ennemi à partir de l'état tactique (positions, Blessures, armes, sorts).
 * La RÉSOLUTION (jets, dégâts, animations, timers) reste dans le store.
 *
 * Aucune règle inventée : le déplacement réutilise le BFS de `path.ts`, l'ESPÉRANCE de dégâts
 * (`expectedDamage`) réutilise les fonctions du moteur (`attackModifiers`/`combineMods`/`woundsFromHit`/
 * `missileDamage`), le positionnement réutilise la géométrie (`isFlankOrRear`/`lineOfSightCover`). Les
 * HEURISTIQUES de CHOIX (menace, positionnement) ne sont pas des règles canon (latitude permise), mais
 * chaque chiffre dérive d'une fonction du moteur — pas de constante magique « pifométrique » — et toute
 * action jouée passe par la résolution RAW (LoS LDB 13 l.123, bandes de portée appliquées au jet).
 *
 * Lot 3 — l'IA vise par MENACE (`targetThreat`, plus le « PV le plus bas »), achève proprement
 * (`killSecure`), ne s'acharne pas (`overkillPenalty`), valorise les États infligés (`controlValue`,
 * data-driven), couvre les paquets en ZdE (`aoeCoverage`) et se POSITIONNE (flanc/dos, couvert, portée
 * préférée — `positionValue`). Le contexte d'ESCOUADE (surnombre, feu concentré, danger-map) est réservé
 * au Lot 4 : `ai.ts` ne reçoit pas encore les alliés de l'ennemi.
 */
import { Combatant, Weapon } from '../engine/types';
import { Scene } from './scene';
import { reachable, flyReachable, manhattan, chebyshev, Pt } from './path';
import { footprintChebyshev, footprintN } from './footprint';
import { losClear, tileSeenByFoe, lineOfSightCover } from './lineOfSight';
import { rangeBandModifier, attackModifiers, combineMods, woundsFromHit, combatValue } from '../engine/combat';
import { effectiveWeaponDamage } from '../engine/weaponDamage';
import { missileDamage, type SpellLike } from '../engine/magic';
import { bonus, effectiveChar } from '../engine/characteristics';
import { hasCondition, canTakeAction } from '../engine/conditions';
import { effectiveMovement } from '../engine/encumbrance';
import { isEngaged, meleeReachTiles } from '../engine/engagement';
import { isFlankOrRear } from './combatGeometry';
import { facingToward } from '../gameIso/rig/facing';
import type { Dir8 } from './dir8';
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
  /** Données STRUCTURÉES du sort offensif (`SpellData`) — résolues par l'appelant (couche impure qui a les
   *  données). Servent à SCORER le sort (espérance via `missileDamage`, États via `op:'condition'`). Absent
   *  = scoring neutre du sort (parité historique : on garde son palier sans bonus de menace/contrôle). */
  offensiveSpellData?: SpellLike;
  /** Vol (LDB 85 p.343) : le déplacement ignore terrains/obstacles/personnages traversés. */
  flying?: boolean;
  /** Cases enfumées (Souffle (Fumée)) qui bloquent la Ligne de Vue. */
  smoke?: Pt[];
  /** Vision RÉCIPROQUE : cases (`"x,y,0"`) que CET ennemi perçoit réellement (Ligne de Vue + lumière,
   *  vision nocturne incluse) — calculé par l'appelant via le moteur de vision. L'ennemi ne cible/poursuit
   *  que les héros sur ces cases (furtivité). ABSENT = pas de gate (comportement historique / tests purs). */
  perceived?: Set<string>;
  /** Orientation MONDE (`Dir8`) des combattants, lue de `get().facing` par l'appelant (couche impure :
   *  `ai.ts` est pur, sans store). Sert au bonus de FLANC/DOS du positionnement (`isFlankOrRear`, LDB 14
   *  l.91). ABSENT = aucun bonus de flanc (graceful : tests purs / scène sans orientation). */
  facing?: Record<string, Dir8>;
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

// ════════════════════════════════════════════════════════════════════════════════════════════════
// POIDS DES HEURISTIQUES (Lot 3) — centralisés et commentés pour régler le RESSENTI sans toucher au
// code. Chaque poids module une grandeur dérivée du moteur (Blessures espérées, États, géométrie) ;
// l'utilité finale d'un candidat est une SOMME pondérée (`scoreCandidate`). Plus le score est HAUT,
// meilleur le candidat (argmax = max). Les grandeurs de base sont en « Blessures espérées » (l'unité
// commune : ce qu'on retire de PB) ; les bonus de position/contrôle sont calibrés sur cette échelle.
// ════════════════════════════════════════════════════════════════════════════════════════════════
const W = {
  /** Espérance de Blessures qu'on inflige À la cible ce tour (cœur offensif). Unité native → ×1. */
  damageDealt: 1,
  /** Menace de la cible (dégâts qu'ELLE peut nous infliger × atteignabilité × fragilité). On vise en
   *  priorité ce qui nous menace le plus tout en étant éliminable : pèse autant que nos propres dégâts. */
  threat: 1,
  /** Achever une cible (dégâts attendus ≥ PB restants) : prime forte — un mort ne riposte plus. */
  killSecure: 12,
  /** S'acharner sur une cible NEUTRALISÉE (à terre/inconsciente/0 PB) : malus FORT (anti-acharnement,
   *  Lot 1) — on ne la frappe qu'en dernier recours (aucune menace debout). */
  overkill: 100,
  /** Valeur d'un État infligé (contrôle), pondérée par sa dangerosité (cf. `CONDITION_THREAT`). */
  control: 1,
  /** Héros couvert par une ZdE (au-delà du 1ᵉʳ — un missile mono-cible touche déjà 1). */
  aoePerExtraHero: 6,
  /** Frapper au FLANC/DOS (hors champ de vision avant de la cible, LDB 14 l.91) : gratuit → bonus modéré. */
  flankRear: 4,
  /** Gain de COUVERT pour soi en se déplaçant (par cran de couvert gagné : imparfaite/moyenne/totale). */
  coverGain: 3,
  /** Respect de la portée PRÉFÉRÉE : un tireur/lanceur qui reste à distance de tir+LdV plutôt que d'entrer
   *  en mêlée ; un mêlée qui se met au contact. Bonus quand la case d'arrivée respecte la préférence. */
  preferredRange: 5,
  /** Pénalité de DISTANCE résiduelle à la cible après un `move` (par case) : à utilité égale, on choisit
   *  la case qui réduit le plus la distance (départage des approches, calibré faible). */
  approachDist: 0.2,
} as const;

/**
 * Dangerosité d'un ÉTAT infligé (LDB 16), en « Blessures espérées équivalentes » — pour `controlValue`.
 * LU EN DONNÉE par nom d'État (clé = `name` du `op:'condition'`), pas une liste de sorts : un nouvel État
 * se règle ici. Calibrage : un État qui SUPPRIME l'Action (Étourdi/Inconscient) ou tue à petit feu
 * (En flammes/Empoisonné/Hémorragie) vaut plus qu'un simple malus (Aveuglé/Assourdi/Ensanglanté). Les
 * valeurs sont des poids de RESSENTI (latitude IA), pas des règles. États inconnus → 1 (contrôle mineur).
 */
const CONDITION_THREAT: Record<string, number> = {
  inconscient: 8, // hors de combat
  'a-terre': 3, // vulnérable + perd son prochain mouvement
  etourdi: 6, // ne peut pas agir (LDB 16 l.123)
  'en-flammes': 5, // 1d10/Round, force le « se rouler »
  empoisonne: 4, // dégâts récurrents
  hemorragie: 4, // dégâts récurrents
  empetre: 5, // Mouvement nul + Action perdue à se libérer
  aveugle: 4, // −10 et ne peut viser
  assourdi: 2,
  ensanglante: 2,
  surpris: 4, // pas de réaction (LDB 16 l.132)
};

/**
 * Une cible est NEUTRALISÉE (au sol/inconsciente/0 PB encore là) : on n'a aucun intérêt tactique à
 * s'acharner dessus tant qu'une menace DEBOUT existe. Lue en DONNÉE (États + Blessures), sans nom en
 * dur — un combattant À Terre/Inconscient ou à ≤0 PB (encore dans le vivier) est « par terre ».
 */
function isNeutralized(h: Combatant): boolean {
  // `conditions` peut manquer sur un combattant de test minimal → garde (hasCondition lève sinon).
  const cond = h.conditions ?? [];
  return cond.some((c) => c.name === 'a-terre' || c.name === 'inconscient') || h.wounds.current <= 0;
}

/** Garde NaN : une grandeur dérivée du moteur peut être NaN si les Caractéristiques d'un combattant de
 *  test sont absentes (`{} as never`). On retombe alors sur `fallback` (neutre) → scoring déterministe :
 *  les heuristiques fines s'effacent et le palier d'action + les tie-breaks (cf. plus bas) décident. */
const finite = (n: number, fallback = 0): number => (Number.isFinite(n) ? n : fallback);

/**
 * Probabilité de TOUCHER (0..1) d'une attaque, dérivée de la valeur cible RAW (base + modificateurs
 * plafonnés par `combineMods`, comme la résolution) : `P = clamp(target, 5, 95) / 100` (un d100 réussit
 * si ≤ cible ; bornes 5/95 ≈ l'auto-échec/réussite usuel). PUR, sans dé. Les modificateurs de PORTÉE/
 * Taille/État/Avantage sont ceux du moteur → l'espérance reflète la vraie difficulté du jet.
 */
function hitProbability(attacker: Combatant, target: Combatant, weapon: Weapon, kind: 'melee' | 'ranged', distanceTiles?: number): number {
  const val = combatValue(attacker, kind, weapon);
  const mods = combineMods(attackModifiers(attacker, target, weapon, { kind, distanceTiles }));
  const targetVal = finite(val + mods, NaN);
  if (!Number.isFinite(targetVal)) return NaN;
  return Math.max(5, Math.min(95, targetVal)) / 100;
}

/**
 * Espérance de Blessures d'une attaque d'arme `attacker → target` (PUR, sans dé) : probabilité de
 * toucher × Blessures d'un coup MOYEN. Les Dégâts d'un coup = Dégâts d'arme (`flat` + BF si `plusBF`) +
 * un DR moyen modeste (1) ; les Blessures réelles passent par `woundsFromHit` (BE + PA à la localisation
 * « corps », qualités d'arme) — MÊME résolveur que le combat. `min 1` (Robuste) inclus par `woundsFromHit`.
 */
function expectedDamage(attacker: Combatant, target: Combatant, weapon: Weapon, kind: 'melee' | 'ranged', distanceTiles?: number): number {
  const p = hitProbability(attacker, target, weapon, kind, distanceTiles);
  if (!Number.isFinite(p)) return NaN;
  const bf = bonus(effectiveChar(attacker, 'F'));
  const avgDR = 1; // DR moyen prudent (l'espérance d'un DR ≥ 0 sur une réussite) — calibrage IA, pas une règle
  // Dégâts d'arme (Dégâts d'arme + BF si `plusBF`) résolus par le moteur (gère « Spécial »/literal → 0).
  const totalDamage = finite(effectiveWeaponDamage(weapon, Number.isFinite(bf) ? bf : 0) + avgDR, NaN);
  if (!Number.isFinite(totalDamage)) return NaN;
  return p * safeWounds(weapon, target, totalDamage);
}

/** `woundsFromHit` défensif : un combattant de test minimal peut ne pas porter `armour` (le résolveur
 *  lirait `c.armour[loc]` sur `undefined`). On lui prête une armure NULLE (objet vide) le cas échéant —
 *  l'espérance reste prudente (sous-estime légèrement la mitigation). Renvoie 0 si NaN. */
function safeWounds(weapon: Weapon, target: Combatant, totalDamage: number): number {
  const safe = target.armour ? target : ({ ...target, armour: {} as Combatant['armour'] });
  return finite(woundsFromHit(weapon, safe, 'corps', totalDamage), 0);
}

/** Espérance de Blessures d'un Projectile magique `caster → target` (PUR) : probabilité (≈ tir, via la
 *  CT/valeur du sort approximée par la meilleure arme à distance OU une difficulté neutre) × Dégâts du
 *  missile (`missileDamage` : Dégâts + DR moyen, − BE/PA sauf ignorePA/ignoreBE). Sans données de sort →
 *  NaN (scoring neutre). Approximation assumée : la vraie valeur d'incantation (Langue (Magick)) n'est pas
 *  dans `ai.ts` ; on prend une probabilité de référence (0,6) modulée par l'Avantage de l'attaquant. */
function expectedSpellDamage(caster: Combatant, target: Combatant, spell: SpellLike | undefined): number {
  if (!spell) return NaN;
  const md = missileDamage(spell);
  if (!md) return 0; // sort non-missile (débuff/contrôle) : 0 dégât direct (sa valeur passe par controlValue)
  const bfm = bonus(effectiveChar(caster, 'FM'));
  const avgDR = 1;
  const raw = finite(md.damage + (Number.isFinite(bfm) ? bfm : 0) + avgDR, md.damage + avgDR);
  const tb = bonus(effectiveChar(target, 'E'));
  const ap = 0; // PA non connus finement ici ; l'espérance reste prudente (sous-estime légèrement)
  const mitig = (md.ignoreBE ? 0 : finite(tb, 0)) + (md.ignorePA ? 0 : ap);
  const wounds = Math.max(0, raw - mitig);
  // Probabilité de référence (lanceur) ajustée par l'Avantage (×10 → /100 comme un mod de toucher).
  const p = Math.max(0.1, Math.min(0.95, 0.6 + (caster.advantage ?? 0) * 0.1));
  return p * wounds;
}

/**
 * MENACE d'un héros pour l'ennemi (Lot 3 — REMPLACE le « PV le plus bas » comme critère de cible) :
 *  menace = (dégâts qu'il peut nous infliger) × ATTEIGNABILITÉ (proche = menace immédiate) × FRAGILITÉ
 *  (PB bas = plus facile à éliminer, donc cible prioritaire pour neutraliser sa menace).
 * - dégâts du héros : espérance de son MEILLEUR coup contre l'ennemi (mêlée ou tir) — réutilise
 *   `expectedDamage` (symétrie attaquant/défenseur). Plancher 1 (tout adversaire armé reste une menace).
 * - atteignabilité : décroît avec la distance (1 au contact → ~0,3 au loin) — un archer lointain menace
 *   moins qu'un bretteur au contact.
 * - fragilité : (1 + (PBmax − PBcourant)/PBmax) → un héros entamé est ~2× plus « intéressant » (on
 *   sécurise l'élimination, LDB tactique). PUR. NaN-garde sur les dégâts (Caractéristiques absentes).
 */
function targetThreat(enemy: Combatant, hero: Combatant): number {
  const dist = chebyshev(enemy.pos!, hero.pos!);
  const reachability = 1 / (1 + 0.15 * dist); // 1 au contact, décroissance douce
  const maxW = Math.max(1, hero.wounds.max);
  const fragility = 1 + Math.max(0, maxW - hero.wounds.current) / maxW; // 1 (intact) → 2 (presque mort)
  // Danger brut du héros = meilleure espérance de SON coup contre l'ennemi (réciprocité).
  const meleeW = hero.weapons?.find((w) => w.type === 'melee');
  const rangedW = hero.weapons?.find((w) => w.type === 'ranged');
  const dmgMelee = meleeW ? finite(expectedDamage(hero, enemy, meleeW, 'melee'), NaN) : NaN;
  const dmgRanged = rangedW ? finite(expectedDamage(hero, enemy, rangedW, 'ranged', dist), NaN) : NaN;
  const cand = [dmgMelee, dmgRanged].filter((d) => Number.isFinite(d)) as number[];
  const danger = cand.length ? Math.max(...cand) : 1; // pas de Caractéristiques chiffrables → danger neutre (1)
  return Math.max(1, danger) * reachability * fragility;
}

/** Valeur de CONTRÔLE d'un sort (États qu'il inflige, LUS dans ses `op:'condition'` — data-driven, pas
 *  une liste de noms) : Σ dangerosité (`CONDITION_THREAT`) des États posés. Un sort sans `op:'condition'`
 *  → 0 (pas de contrôle). PUR. La structure d'effets (`Flow`) est lue en profondeur (ops imbriqués). */
function controlValue(spell: SpellLike | undefined): number {
  if (!spell) return 0;
  let total = 0;
  const walk = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { for (const n of node) walk(n); return; }
    const o = node as Record<string, unknown>;
    if (o.op === 'condition' && typeof o.name === 'string') total += CONDITION_THREAT[o.name] ?? 1;
    for (const v of Object.values(o)) walk(v);
  };
  walk((spell as { effects?: unknown }).effects);
  return total;
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
 * Un CANDIDAT d'action discrétionnaire (Lot 3 — moteur Utility à score pondéré).
 * `kind` = type d'action (sert au BIAIS de palier dans le départage : à utilité égale, on garde l'ordre
 * castArea < focus < cast < reload < shoot < melee < move — la cascade historique comme tie-break stable,
 * PAS comme priorité absolue : une utilité supérieure renverse désormais le palier). `utility` = somme
 * pondérée des heuristiques (plus HAUT = mieux). `targetId`/`coord` = départage déterministe final.
 */
interface Candidate {
  action: EnemyAction;
  kind: keyof typeof TIER;
  /** Utilité pondérée (Lot 3) — somme des heuristiques. Plus HAUT = meilleur. */
  utility: number;
  /** id de la cible visée (départage, stable) — vide si l'action n'en a pas. */
  targetId: string;
  /** coordonnées de destination/centre (départage) — null si l'action n'en a pas. */
  coord: Pt | null;
}

// Paliers d'action (cascade historique, du plus prioritaire au moins). Au Lot 3 ils ne servent plus de
// PRIORITÉ absolue (l'utilité prime) mais de BIAIS de départage stable à utilité égale (parité golden).
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
 * argmax déterministe (Lot 3) : meilleur candidat par UTILITÉ décroissante. Tie-break STABLE à utilité
 * égale (départage lexicographique) : palier d'action (cascade historique) ↑, puis id de cible ↑, puis
 * coordonnées (x,y) ↑, puis index d'énumération (ultime garde-fou). Les égalités d'utilité sont gérées
 * proprement par cette chaîne — déterministe, sans dé.
 */
function argmax(cands: Candidate[]): Candidate | null {
  let best: Candidate | null = null;
  let bi = -1;
  for (let i = 0; i < cands.length; i++) {
    const c = cands[i];
    if (best == null) { best = c; bi = i; continue; }
    // Comparaison : utilité DÉCROISSANTE d'abord ; à égalité (à epsilon près), tie-break lexicographique.
    const du = c.utility - best.utility;
    let better: boolean;
    if (Math.abs(du) > 1e-9) better = du > 0;
    else if (TIER[c.kind] !== TIER[best.kind]) better = TIER[c.kind] < TIER[best.kind];
    else if (c.targetId !== best.targetId) better = c.targetId < best.targetId;
    else if ((c.coord?.x ?? 0) !== (best.coord?.x ?? 0)) better = (c.coord?.x ?? 0) < (best.coord?.x ?? 0);
    else if ((c.coord?.y ?? 0) !== (best.coord?.y ?? 0)) better = (c.coord?.y ?? 0) < (best.coord?.y ?? 0);
    else better = i < bi; // parfaitement égaux → ordre d'énumération (ne survient pas en pratique)
    if (better) { best = c; bi = i; }
  }
  return best;
}

/** Choisit l'action d'un ennemi pour son tour. Pure et déterministe. */
export function chooseEnemyAction(input: EnemyTurnInput): EnemyAction {
  const { enemy, scene, blocked, movement, offensiveSpell, spellRange, smoke, flying } = input;
  const { readyFocusedSpell, focusableSpell, areaSpell, offensiveSpellData, facing } = input;
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

  // === CŒUR DISCRÉTIONNAIRE — moteur Utility (Lot 3 : score pondéré) =======================
  // Tout ce qui précède (gardes RAW/psychologie : fin de combat, En flammes, Brisé, Bestial, fuite,
  // anti-immobilisme…) reste FORCÉ et n'entre PAS dans le scoring. Ici on ÉNUMÈRE PLUSIEURS candidats
  // par type (un par cible atteignable, plusieurs cases d'approche), on les SCORE par UTILITÉ pondérée
  // (menace, dégâts attendus, killSecure/overkill, contrôle, couverture, positionnement) et on prend
  // l'argmax. Aucune règle inventée : gardes de validité (portée, LdV, canCast/canShoot/inMelee, ZdE,
  // focalisable) IDENTIQUES ; chaque heuristique dérive d'une fonction du moteur.

  // Animosité/Haine ACTIVE (LDB 21 l.22/41) : filtre de VIVIER appliqué AVANT le choix de cible — on
  // s'en prend en priorité au groupe haï présent dans le vivier considéré (sinon vivier brut).
  const hatedCibles = (enemy.psychState ?? [])
    .filter((p) => (p.type === 'animosite' || p.type === 'haine') && p.active && p.cible)
    .map((p) => p.cible!);
  const hatedOf = (pool: Combatant[]) =>
    hatedCibles.length ? pool.filter((h) => hatedCibles.some((cb) => groupMatch(cb, h.groups ?? []))) : [];
  /** Restreint un vivier au groupe haï s'il y en a un présent, sinon le vivier brut. */
  const restrict = (pool: Combatant[]): Combatant[] => { const hp = hatedOf(pool); return hp.length ? hp : pool; };
  /** En Frénésie, la cible est IMPÉRATIVEMENT le plus proche en LdV (LDB 21 l.34) — on contraint le vivier
   *  d'énumération à ce seul héros (le scoring ne peut donc choisir personne d'autre). */
  const frenzyPick = (): Combatant | null => {
    if (!frenzied) return null;
    const visibleFoes = shootableHeroes.length ? shootableHeroes : heroes;
    return visibleFoes.length ? nearest(pos, visibleFoes) : null;
  };

  // --- HEURISTIQUES de SCORE (Lot 3) ---------------------------------------
  /** Utilité d'une ATTAQUE (mêlée/tir/sort) sur `target` : dégâts qu'on inflige + menace de la cible
   *  + killSecure − overkill + contrôle. `dmgKind`/`weapon`/`spell` sélectionnent le calcul de dégâts. */
  const attackUtility = (
    target: Combatant,
    src: { kind: 'melee'; weapon: Weapon } | { kind: 'ranged'; weapon: Weapon; dist: number } | { kind: 'spell'; spell?: SpellLike },
  ): number => {
    const dmg = src.kind === 'spell'
      ? finite(expectedSpellDamage(enemy, target, src.spell), 0)
      : src.kind === 'ranged'
        ? finite(expectedDamage(enemy, target, src.weapon, 'ranged', src.dist), 0)
        : finite(expectedDamage(enemy, target, src.weapon, 'melee'), 0);
    const threat = finite(targetThreat(enemy, target), 0);
    const control = src.kind === 'spell' ? controlValue(src.spell) : 0;
    const securesKill = dmg >= target.wounds.current && target.wounds.current > 0 ? W.killSecure : 0;
    const overkill = isNeutralized(target) ? W.overkill : 0;
    return W.damageDealt * dmg + W.threat * threat + W.control * control + securesKill - overkill;
  };

  /** Bonus de POSITIONNEMENT d'une case d'arrivée `to` pour attaquer `target` (Lot 3) : flanc/dos +
   *  gain de couvert pour soi + respect de la portée préférée (tireur/lanceur reste à distance+LdV ;
   *  mêlée au contact). PAS de surnombre ni danger-map (Lot 4). PUR. */
  const isShooterOrCaster = (canCast || canShoot) || (offensiveSpell != null) || (hasRanged && !hasMeleeWeapon);
  const positionValue = (to: Pt, target: Combatant): number => {
    let v = 0;
    // Flanc/dos (LDB 14 l.91) : frapper hors du champ de vision avant de la cible (gratuit). Nécessite
    // l'orientation de la cible (lue de `facing`) ; absente → 0 (graceful).
    const tFacing = facing?.[target.id];
    if (tFacing) {
      const dirToAttacker = facingToward(target.pos!, to);
      if (isFlankOrRear(tFacing, dirToAttacker)) v += W.flankRear;
    }
    // Gain de couvert POUR SOI face à la menace la plus proche : un couvert imparfait/moyen/total à
    // l'arrivée réduit les tirs adverses (lineOfSightCover, direction héros→case). Cran gagné vs case actuelle.
    const coverRank = (from: Pt): number => {
      let worst = 0;
      for (const h of heroes) {
        const c = lineOfSightCover(scene, h.pos!, from, [], smoke ?? []);
        const rank = c.cover === 'totale' ? 3 : c.cover === 'moyenne' ? 2 : c.cover === 'imparfaite' ? 1 : 0;
        if (rank > worst) worst = rank;
      }
      return worst;
    };
    const coverDelta = coverRank(to) - coverRank(pos);
    if (coverDelta > 0) v += W.coverGain * coverDelta;
    // Portée préférée : un tireur/lanceur valorise une case d'où il TIRE (cible visible + à portée) sans
    // être au contact ; un combattant de mêlée valorise le contact. Réutilise les gates de portée/LdV.
    const d = chebyshev(to, target.pos!);
    const seesFrom = losClear(scene, to, target.pos!, smoke ?? []);
    if (isShooterOrCaster) {
      const inShootRange = canCast
        ? (spellRange == null || d <= spellRange)
        : (maxWeaponRange === 0 || rangeBandModifier(d, maxWeaponRange) != null);
      if (d > mr && seesFrom && inShootRange) v += W.preferredRange; // garde la distance ET la ligne de tir
    } else if (withinMelee(to, target.pos!)) {
      v += W.preferredRange; // mêlée : au contact
    }
    return v;
  };

  // Meilleure case d'APPROCHE vers une cible — énumère PLUSIEURS cases pertinentes (adjacentes à la
  // cible, et la case qui réduit le plus la distance) plutôt qu'une seule (Lot 3 : laisse le scoring
  // arbitrer position vs distance). Renvoie une liste de candidats `(to, utilité de position)`.
  const approachCandidates = (target: Combatant): { to: Pt; posV: number }[] => {
    const out: { to: Pt; posV: number }[] = [];
    for (const k of reach.keys()) {
      const [x, y] = k.split(',').map(Number);
      if (x === pos.x && y === pos.y) continue; // ne pas « bouger » sur place
      const to = { x, y };
      out.push({ to, posV: positionValue(to, target) });
    }
    return out;
  };

  // --- ÉNUMÉRATION des candidats JOUABLES (Lot 3 : multi-cibles, multi-cases) ----------------
  const candidates: Candidate[] = [];
  const fpick = frenzyPick();

  // ZdE (LDB 47 l.44) : un sort de ZONE castable dont le centre auto-posé couvre ≥2 héros (portée + LdV).
  // Scoré par COUVERTURE (héros touchés) — `aoeCoverage` : bonus par héros au-delà du 1ᵉʳ + contrôle.
  if (!frenzied && areaSpell) {
    const ac = bestAreaCenter(pos, shootableHeroes, areaSpell.radius, areaSpell.range, (pt) => losClear(scene, pos, pt, smoke ?? []));
    if (ac) {
      const aoe = W.aoePerExtraHero * (ac.covered - 1); // « − alliés touchés » : pas d'alliés en entrée (Lot 4)
      candidates.push({ action: { kind: 'castArea', spell: areaSpell.spell, center: ac.center }, kind: 'castArea', utility: aoe, targetId: '', coord: ac.center });
    }
  }
  // Focalisation (LDB 46) : sort focalisable + AUCUN sort faisable d'un jet (`!canCast`), sauf menacé au
  // contact avec un repli (arme de mêlée ou tir) — risque d'interruption (l.193). Utilité neutre (0) :
  // c'est un investissement de tour sans dégât immédiat — il ne « gagne » que faute de mieux.
  // `committingPrep` : une action de PRÉPARATION (Focalisation/Recharge) est CHOISIE → on ne lui oppose
  // pas une approche de mêlée (le lanceur/tireur reste en place, comme la cascade historique reload/focus
  // < move). Sans elle, l'approche `move` (utilité de menace > 0) écraserait la prep neutre (régression).
  let committingPrep = false;
  if (!frenzied && focusableSpell && !canCast) {
    const contactFallback = adjacentFoes.length > 0 && (hasMeleeWeapon || canShoot);
    if (!contactFallback) { candidates.push({ action: { kind: 'focus', spell: focusableSpell }, kind: 'focus', utility: 0, targetId: '', coord: null }); committingPrep = true; }
  }
  // Sort offensif mono-cible : UN candidat PAR cible visible/à portée (Lot 3 — multi-cibles), scoré par
  // menace/dégâts/contrôle. Frénésie → seul `fpick`.
  if (canCast) {
    const pool = restrict(fpick ? [fpick].filter((h) => castPool.includes(h)) : castPool);
    for (const t of pool) {
      candidates.push({ action: { kind: 'cast', targetId: t.id, spell: castSpellId! }, kind: 'cast', utility: attackUtility(t, { kind: 'spell', spell: offensiveSpellData }), targetId: t.id, coord: t.pos ?? null });
    }
  }
  // Recharger (LDB 63 l.28-29) : arme à Recharge déchargée + cible en vue/portée, sauf attaque de mêlée
  // justifiée. Utilité neutre (préparation) — préféré seulement faute de tir/mêlée meilleurs. Un
  // frénétique NE recharge PAS (Frénésie LDB 21 l.34 : seule Action = Test de CC/Athlétisme → mêlée).
  if (!frenzied && reloadNeeded && shootPool.length > 0 && !(adjacentFoes.length > 0 && hasMeleeWeapon)) {
    candidates.push({ action: { kind: 'reload' }, kind: 'reload', utility: 0, targetId: '', coord: null });
    committingPrep = true; // un tireur recharge sur place plutôt que de foncer en mêlée
  }
  // Tir (hors Combat rapproché, cible visible) : UN candidat PAR cible tirable (Lot 3 — multi-cibles).
  if (canShoot && rangedW) {
    const pool = restrict(fpick ? [fpick].filter((h) => shootPool.includes(h)) : shootPool);
    for (const t of pool) {
      candidates.push({ action: { kind: 'shoot', targetId: t.id }, kind: 'shoot', utility: attackUtility(t, { kind: 'ranged', weapon: rangedW, dist: fpDist(t) }), targetId: t.id, coord: t.pos ?? null });
    }
  }
  // Mêlée / approche : énumère un candidat de MÊLÉE par cible déjà au contact ET un candidat d'APPROCHE
  // (move) par cible atteignable ce tour (Lot 3). La cible suit le vivier (tireur retenu au contact frappe
  // l'adversaire à son contact ; sinon vivier complet). Un sort/tir jouable PRIME (parité historique : la
  // cascade ne propose alors jamais de mêlée/move) — on ne produit ces candidats que si `!canCast && !canShoot`.
  const meleeWeapon = enemy.weapons.find((w) => w.type === 'melee') ?? enemy.weapons[0];
  if (!canCast && !canShoot && !committingPrep) {
    const heldInMelee = hasRanged && adjacentFoes.length > 0;
    const here = heldInMelee ? adjacentFoes : heroes.filter(meleeReachableNow);
    const baseVivier = here.length ? here : heroes;
    const vivier = restrict(fpick ? [fpick] : baseVivier);
    // Estimation d'attaque pour scorer une cible (utilité d'arme de mêlée si on en a une, sinon menace
    // seule — un caster hors de portée qui s'approche n'a pas de dégât d'arme mais score la menace/fragilité).
    const targetUtility = (t: Combatant): number =>
      meleeWeapon ? attackUtility(t, { kind: 'melee', weapon: meleeWeapon }) : (W.threat * finite(targetThreat(enemy, t), 0) - (isNeutralized(t) ? W.overkill : 0));
    for (const t of vivier) {
      if (hasMeleeWeapon && meleeWeapon && inMelee(t)) {
        // Cible déjà au contact → frappe (position déjà acquise, pas de bonus de déplacement).
        candidates.push({ action: { kind: 'melee', targetId: t.id }, kind: 'melee', utility: attackUtility(t, { kind: 'melee', weapon: meleeWeapon }), targetId: t.id, coord: t.pos ?? null });
      } else {
        // Cible non au contact (ou sans arme de mêlée — caster qui doit se rapprocher) → candidats
        // d'APPROCHE : utilité = utilité d'attaque de la cible + positionnement de la case − distance résiduelle.
        const atk = targetUtility(t);
        for (const { to, posV } of approachCandidates(t)) {
          const u = atk + posV - W.approachDist * manhattan(to, t.pos!);
          candidates.push({ action: { kind: 'move', to, thenTargetId: t.id }, kind: 'move', utility: u, targetId: t.id, coord: to });
        }
      }
    }
  }

  // --- ARGMAX : meilleur candidat (utilité pondérée + tie-break déterministe) ----------------
  const chosen = argmax(candidates);
  if (chosen) return chosen.action;

  // Aucun candidat jouable : un Empêtré (Mouvement nul, LDB 16 l.85) se libère plutôt que perdre son
  // tour (Test opposé de Force contre la source, l.61). Sinon, passe la main.
  if (hasCondition(enemy, 'empetre')) return { kind: 'recover', state: 'empetre' };
  return { kind: 'end' };
}

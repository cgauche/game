/**
 * MANŒUVRES de créature (attaques naturelles activées — LDB 85) extraites de `combatFlow` pour les
 * rendre RÉUTILISABLES par le flux joueur différé (« un jet = une modale ») ET l'IA, sans dette.
 *
 * Convention « baril » : ce module FEUILLE n'importe RIEN de `combatFlow` (qui le ré-exporte via
 * `export * from './combatManeuvers'`). Tout passe par les feuilles moteur/état (engine/*, ./path,
 * ./footprint, ./battleRng, ./combatLog, ./lineOfSight, ./triggeredEffects).
 *
 * Chaque résolveur de manœuvre est SCINDÉ en deux :
 *  - `rollManeuverAttacker(attacker, stat, rng)` : le JET de l'attaquant (CC/CT) — produit le SEUL
 *    `TestResult` influençable (la Chance/Résilience de la modale joueur agit dessus). Partagé par
 *    le flux joueur ET l'IA.
 *  - `applyMan<X>(get, set, attacker, atk, spent, opts?)` : prend ce jet PRÉ-tiré, choisit la/les
 *    cible(s), roule chaque DÉFENSEUR à neuf, résout l'opposition (`resolveOpposed(atk, def)`, atk
 *    FIGÉ — pas de relance de l'attaquant), applique Dégâts/Type/corrosion/Pétrifié/effets + feed.
 *    NE PPELLE PAS `checkBattleOver` (l'appelant — store ou wrapper IA — le fait).
 *
 * Le défenseur roule SON jet dans l'apply (jet SUBI, montré au feed `evLines`) — ce n'est pas le jet
 * du joueur, donc pas de modale/révélation différée (comportement de feed inchangé vs l'historique).
 * RAW LDB 85 l.251/376 (« un lancer pour chaque cible ») relu en UN effort de souffle influençable :
 * un seul jet d'attaquant opposé à chaque cible (le souffle est UNE action, pas N).
 */
import type { Get, Set as SetFn } from './flowTypes';
import type { BattleState } from './store';
import { Combatant, type Difficulty } from '../engine/types';
import { battleRng } from './battleRng';
import { evLines } from './combatLog';
import { d10 } from '../engine/dice';
import type { RNG } from '../engine/dice';
import { combatValue, defenseValue } from '../engine/combat';
import { rollTest, resolveOpposed, type TestResult } from '../engine/tests';
import { effectiveChar, bonus } from '../engine/characteristics';
import { isOutOfAction, addCondition, loseWounds, applyZeroWounds } from '../engine/conditions';
import { hasTraitKey, isBestial } from '../engine/traits/dispatch';
import { creatureAttacks, ATTACK_LABEL, type CreatureAttack, type AttackKind } from '../engine/creatureAttacks';
import { sizeGap } from '../engine/size';
import { combatDistance } from './footprint';
import { chebyshev, type Pt } from './path';
import { smokeZone } from './lineOfSight';
import { applyTriggeredEffects, maneuverEffectsOf } from './triggeredEffects';
import { canTakeAction } from '../engine/conditions';
import { bus, EVT } from './bus';

// ---------------------------------------------------------------------------
// Émission d'animation + énumération (déplacées de combatFlow)
// ---------------------------------------------------------------------------

/** Émet l'animation d'attaque d'une attaque SPÉCIALE de créature → AnimatedPlanToken joue la pose
 *  dédiée (creatureAttackPoses) ; les biped/spectraux jouent leur clip d'attaque générique. */
export function emitCreatureAttackAnim(attacker: Combatant, kind: string): void {
  bus.emit(EVT.ANIM_ATTACK, { from: attacker.id, to: attacker.id, kind: 'creature', defense: 'none', result: { hit: true }, creatureAttack: kind });
}

/** Cible de Piétinement valide pour `c` (LDB 85 l.320-321) : adversaire ADJACENT, encore actif et
 *  PLUS PETIT (`sizeGap >= 1`). `targetId` borne la recherche à une cible précise (clic du joueur). */
export function trampleTarget(battle: BattleState, c: Combatant, targetId?: string): Combatant | undefined {
  return battle.combatants.find(
    (t) =>
      (targetId ? t.id === targetId : true) &&
      t.kind !== c.kind &&
      !isOutOfAction(t) &&
      !!t.pos &&
      !!c.pos &&
      combatDistance(c, t) <= 1 &&
      sizeGap(c.size, t.size) >= 1,
  );
}

/** Icône FR par type de manœuvre (cosmétique hotbar). */
export const MANEUVER_ICON: Record<AttackKind, string> = {
  arme: '⚔️', morsure: '🦷', caudale: '🦎', cornes: '🐏', souffle: '🐉', vomi: '🤮',
  tentacules: '🐙', etreinte: '❄️', regard: '👁', langue: '👅', hurlement: '📢',
};

/** Manœuvre activable par le héros actif (descripteur uniforme rendu par la hotbar). `mode` dicte
 *  le ciblage : 'target' → on arme `battle.action` puis le clic-entité résout ; 'immediate' →
 *  résolution directe (zone/soi). `dispatch` route vers le store : 'trample'/'tentacle' (flux
 *  dédiés conservés), 'maneuver' (mêlée gratuite de trait, ciblée), 'area' (zone/action immédiate). */
export interface Maneuver {
  id: string;
  /** Type d'attaque de créature (absent pour Piétinement, qui dérive de la Taille). */
  kind?: AttackKind;
  label: string;
  icon: string;
  /** Coût en Avantage (affiché « · N Av »). */
  cost: number;
  mode: 'target' | 'immediate';
  dispatch: 'trample' | 'tentacle' | 'maneuver' | 'area';
}

/** Mêlée ciblée (clic-entité requis) : Morsure / Attaque caudale / Tentacules de trait. */
const TARGET_MANEUVER_KINDS: AttackKind[] = ['morsure', 'caudale', 'tentacules'];

/** Manœuvres que le héros ACTIF peut activer maintenant — agrège (dédupliquées) : (1) ses manœuvres
 *  de trait abordables & légales ; (2) Piétinement (Taille) ; (3) la mutation Tentacule. Aucune
 *  logique par créature en dur : tout vient de `creatureAttacks` (profils) + des prédicats existants. */
export function availableManeuvers(active: Combatant, battle: BattleState): Maneuver[] {
  if (active.kind !== 'hero') return [];
  const out: Maneuver[] = [];
  // (1) Manœuvres de trait. 'arme' = l'attaque-Action normale (pas une manœuvre) ; 'charge' (Cornes) =
  // gratuite uniquement à la Charge (auto) → exclues. Les manœuvres-Action (Étreinte) exigent l'Action.
  for (const a of creatureAttacks(active.traits ?? [])) {
    if (a.kind === 'arme' || a.trigger === 'charge') continue;
    if (a.trigger === 'free' && active.advantage < a.avantage) continue;
    if (a.trigger === 'action' && (battle.acted || !canTakeAction(active))) continue;
    const target = TARGET_MANEUVER_KINDS.includes(a.kind);
    out.push({
      id: a.kind, kind: a.kind, label: ATTACK_LABEL[a.kind], icon: MANEUVER_ICON[a.kind],
      cost: a.avantage, mode: target ? 'target' : 'immediate', dispatch: target ? 'maneuver' : 'area',
    });
  }
  // (2) Piétinement (Taille, LDB 85 l.320-321) : adversaire adjacent plus petit, ≥1 Avantage. Flux dédié.
  if (active.advantage >= 1 && trampleTarget(battle, active))
    out.push({ id: 'pietinement', label: 'Piétiner', icon: '🐾', cost: 1, mode: 'target', dispatch: 'trample' });
  // (3) Mutation Tentacule (arme `nat-tentacule`, LDB 85 l.354) : 1/tour, 0 Avantage, cible adjacente.
  if (
    !active.tentacleUsedThisTurn && active.weapons.some((w) => w.uid === 'nat-tentacule') && !!active.pos &&
    battle.combatants.some((c) => c.kind !== 'hero' && !isOutOfAction(c) && c.pos && combatDistance(active, c) <= 1)
  )
    out.push({ id: 'tentacule', label: 'Tentacule', icon: '🐙', cost: 0, mode: 'target', dispatch: 'tentacle' });
  // Déduplique par id (la mutation Tentacule et le trait Tentacules ne coexistent pas, mais garde-fou).
  return out.filter((m, i) => out.findIndex((n) => n.id === m.id) === i);
}

// ---------------------------------------------------------------------------
// JET de l'attaquant (le SEUL influençable) — partagé flux joueur + IA
// ---------------------------------------------------------------------------

/** Jet d'attaquant d'une manœuvre (LDB 85) : CC (mêlée) ou CT (distance/zone). `difficulty` porte le
 *  bonus d'attaquant propre à la manœuvre (Vomissement : Facile +40 à courte distance, LDB 85 l.376) ;
 *  Intermédiaire par défaut. Hurlement n'a PAS de jet d'attaquant (chaque cible teste sa Résistance)
 *  → `stat` absent : `rollManeuverAttacker` n'est jamais appelé pour lui. */
export function rollManeuverAttacker(attacker: Combatant, stat: 'CC' | 'CT', rng: RNG, difficulty: Difficulty = 'intermediaire'): TestResult {
  return rollTest(combatValue(attacker, stat === 'CC' ? 'melee' : 'ranged'), difficulty, rng);
}

/** Difficulté du jet d'ATTAQUANT propre à une manœuvre (seul le Vomissement dévie du +0 : Facile +40
 *  à courte distance, LDB 85 l.376). Le store/IA passe ce résultat à `rollManeuverAttacker`. */
export function maneuverAttackerDifficulty(kind: AttackKind): Difficulty {
  return kind === 'vomi' ? 'facile' : 'intermediaire';
}

// ---------------------------------------------------------------------------
// APPLIERS (jet d'attaquant figé) — choix de cible + jet de défenseur + effets + feed
// ---------------------------------------------------------------------------

/** Souffle (LDB 85 l.251) / Vomissement (l.376) — attaque de ZONE. `atk` = jet CT FIGÉ de
 *  l'attaquant (un seul effort de souffle), opposé à l'Esquive de CHAQUE cible. Cible visible la plus
 *  proche dans la portée (Souffle BE+20 m ; Vomi BE m), puis tous les ennemis dans la zone (Souffle :
 *  BF de la cible ; Vomi : 2 m). Dégâts (mitigés BE+PA, sauf ignore-PA Feu/Électricité/Poison) +
 *  effet de Type (Enflammé/Sonné/Empoisonné) + corrosion (Armure/Arme −1). Dépense `spent` Avantage.
 *  `centerOverride` : sort « Souffle » (LDB 47, point d'impact imposé). NE consomme PAS l'Action. */
export function applyManArea(get: Get, set: SetFn, attacker: Combatant, a: CreatureAttack, atk: TestResult, spent: number, centerOverride?: Combatant): void {
  const battle = get().battle;
  if (!battle || battle.over || !attacker.pos) return;
  attacker.advantage = Math.max(0, attacker.advantage - spent);
  const isVomi = a.kind === 'vomi';
  const be = bonus(effectiveChar(attacker, 'E'));
  const rangeTiles = Math.max(1, Math.ceil((isVomi ? be : be + 20) / 2)); // 1 case = 2 m
  const foes = battle.combatants.filter((c) => c.kind !== attacker.kind && !isOutOfAction(c) && c.pos && chebyshev(attacker.pos!, c.pos) <= rangeTiles);
  // Centre IMPOSÉ (sort « Souffle », LDB 47 : la cible du sort est le point d'impact) si valide ;
  // sinon comportement trait : cible visible la plus proche.
  const center = centerOverride && centerOverride.pos && !isOutOfAction(centerOverride) && chebyshev(attacker.pos, centerOverride.pos) <= rangeTiles
    ? centerOverride
    : foes.length
      ? foes.reduce((p, c) => (chebyshev(attacker.pos!, p.pos!) <= chebyshev(attacker.pos!, c.pos!) ? p : c))
      : null;
  if (!center) return;
  const blast = isVomi ? 1 : Math.max(1, Math.ceil(bonus(effectiveChar(center, 'F')) / 2)); // Souffle : BF de la cible ; Vomi : 2 m
  const affected = battle.combatants.filter((c) => c.kind !== attacker.kind && !isOutOfAction(c) && c.pos && chebyshev(center.pos!, c.pos) <= blast);
  const type = (a.type ?? '').toLowerCase();
  const ignorePA = !isVomi && /feu|électric|electric|poison/.test(type);
  const corrosif = isVomi || /corros/.test(type);
  const damage = isVomi ? be + 4 : a.bonus; // Vomi = BE+4 ; Souffle = Indice
  const lines: string[] = [`${attacker.name} déclenche ${ATTACK_LABEL[a.kind]}${a.type ? ` (${a.type})` : ''} !`];
  emitCreatureAttackAnim(attacker, a.kind);
  // Flash de la ZONE touchée à l'exécution (R7) : on montre l'empreinte (centre ± blast, clippée à la scène)
  // → on comprend pourquoi plusieurs combattants sont affectés. Émis pour TOUTE attaque de zone (ennemi/joueur).
  const sc2 = get().scene;
  const zone: Pt[] = [];
  for (let dx = -blast; dx <= blast; dx++)
    for (let dy = -blast; dy <= blast; dy++) {
      const x = center.pos!.x + dx, y = center.pos!.y + dy;
      if (sc2 && x >= 0 && y >= 0 && x < sc2.dimensions.w && y < sc2.dimensions.h) zone.push({ x, y });
    }
  bus.emit(EVT.ANIM_AOE, { tiles: zone, kind: a.kind, type: a.type });
  for (const tgt of affected) {
    // Test opposé CT/Esquive : jet d'attaquant FIGÉ (`atk`, Vomi : Facile +40 déjà baked, l.376) vs
    // Esquive de la cible (Intermédiaire, roulée à neuf — jet SUBI montré au feed). `atk` n'est PAS re-tiré.
    const def = rollTest(defenseValue(tgt, 'esquive'), 'intermediaire', battleRng());
    const opp = resolveOpposed(atk, def);
    if (!opp.attackerWins) { lines.push(`${tgt.name} esquive.`); continue; }
    const tb = bonus(effectiveChar(tgt, 'E'));
    const pa = ignorePA ? 0 : Math.max(0, tgt.armour.corps ?? 0);
    const wl = Math.max(0, damage - tb - pa);
    if (wl > 0) { loseWounds(tgt, wl); lines.push(`${tgt.name} subit ${wl} Blessure(s)${ignorePA ? ' (ignore PA)' : ''}.`); }
    if (isVomi || /électric|electric/.test(type)) addCondition(tgt, 'Sonné');
    else if (/froid/.test(type) && wl > 0) for (let i = 0; i < Math.max(1, Math.floor(wl / 5)); i++) addCondition(tgt, 'Sonné'); // 1 Sonné / 5 Blessures
    if (/feu/.test(type)) addCondition(tgt, 'En flammes');
    if (/poison/.test(type)) addCondition(tgt, 'Empoisonné');
    if (corrosif) { // Armure & Arme portées subissent 1 Dégât
      tgt.armour.corps = Math.max(0, (tgt.armour.corps ?? 0) - 1);
      if (tgt.weapons[0]) tgt.weapons[0].damageTaken = (tgt.weapons[0].damageTaken ?? 0) + 1;
    }
    if (tgt.wounds.current <= 0) applyZeroWounds(tgt);
  }
  // Type Fumée : la zone se remplit de fumée et bloque les Lignes de vue pendant BE Rounds (RAW Souffle).
  let zones = get().battle!.zones;
  if (/fum/.test(type)) {
    const dur = Math.max(1, be); // Rounds = Bonus d'Endurance de la créature
    const tiles = smokeZone(attacker.pos!, center.pos!, blast);
    zones = [...(zones ?? []), { label: 'Fumée', tiles, rounds: dur, blocksLoS: true }];
    lines.push(`La zone se remplit de fumée — Lignes de vue bloquées ${dur} Round(s).`);
  }
  set({ battle: { ...get().battle!, zones, log: [...get().battle!.log, ...evLines(lines, 'attack', attacker.id)] } });
  bus.emit(EVT.SCENE_DIRTY);
}

/** Langue préhensile (Jabberslythe, LDB 85 l.185-186) : Attaque gratuite à 1 Avantage, À DISTANCE.
 *  `atk` = jet CT FIGÉ ; cible visible la plus proche, opposé à l'Esquive. Sur une touche : Dégâts =
 *  Indice + effet onHit AUTHORÉ (Langue → Empêtré). NE consomme PAS l'Action. */
export function applyManTongue(get: Get, set: SetFn, attacker: Combatant, a: CreatureAttack, atk: TestResult, spent: number): void {
  const battle = get().battle;
  if (!battle || battle.over || !attacker.pos) return;
  attacker.advantage = Math.max(0, attacker.advantage - spent);
  const foes = battle.combatants.filter((c) => c.kind !== attacker.kind && !isOutOfAction(c) && c.pos);
  if (!foes.length) return;
  const tgt = foes.reduce((p, c) => (chebyshev(attacker.pos!, p.pos!) <= chebyshev(attacker.pos!, c.pos!) ? p : c));
  const def = rollTest(defenseValue(tgt, 'esquive'), 'intermediaire', battleRng());
  const opp = resolveOpposed(atk, def);
  const lines = [`${attacker.name} projette sa Langue préhensile sur ${tgt.name} !`];
  emitCreatureAttackAnim(attacker, a.kind);
  if (opp.attackerWins) {
    const wl = Math.max(0, a.bonus - bonus(effectiveChar(tgt, 'E')) - Math.max(0, tgt.armour.corps ?? 0));
    if (wl > 0) { loseWounds(tgt, wl); lines.push(`${tgt.name} subit ${wl} Blessure(s).`); }
    // Effet onHit AUTHORÉ de la manœuvre (Langue → Empêtré) — donnée éditable `maneuver.effects`.
    lines.push(...applyTriggeredEffects(get, attacker, maneuverEffectsOf(attacker, 'langue'), 'onHit', { victim: tgt, woundsDealt: wl, rng: battleRng() }));
    if (tgt.wounds.current <= 0) applyZeroWounds(tgt);
  } else lines.push(`${tgt.name} esquive la langue.`);
  set({ battle: { ...get().battle!, log: [...get().battle!.log, ...evLines(lines, 'attack', attacker.id, tgt.id)] } });
  bus.emit(EVT.SCENE_DIRTY);
}

/** Hurlement fantomatique (Banshee, LDB 85 l.135-136) : PAS de jet d'attaquant — chaque cible vivante
 *  (non Mort-vivant) à I mètres subit 1d10 (ignore BE et PA) + effets onHit AUTHORÉS (Test de
 *  Résistance ou Brisé, + 3 Assourdi). `spent` Avantage déjà imposé à TOUT par l'appelant (l.135 :
 *  « dépenser tous ses Avantages, minimum 2 »). Attaque gratuite (Action préservée). */
export function applyManWail(get: Get, set: SetFn, attacker: Combatant, spent: number): void {
  const battle = get().battle;
  if (!battle || battle.over || !attacker.pos) return;
  attacker.advantage = Math.max(0, attacker.advantage - spent);
  const radius = Math.max(1, Math.ceil(effectiveChar(attacker, 'I') / 2)); // Initiative mètres → cases (2 m)
  const living = battle.combatants.filter(
    (c) => c.kind !== attacker.kind && !isOutOfAction(c) && c.pos && chebyshev(attacker.pos!, c.pos) <= radius && !hasTraitKey(c.traits, 'Mort-vivant'),
  );
  const lines = [`${attacker.name} pousse un Hurlement fantomatique !`];
  emitCreatureAttackAnim(attacker, 'hurlement');
  // Flash de la zone du Hurlement (R7) : rayon autour du crieur, clippé à la scène.
  const scW = get().scene;
  const zoneW: Pt[] = [];
  for (let dx = -radius; dx <= radius; dx++)
    for (let dy = -radius; dy <= radius; dy++) {
      const x = attacker.pos!.x + dx, y = attacker.pos!.y + dy;
      if (scW && x >= 0 && y >= 0 && x < scW.dimensions.w && y < scW.dimensions.h) zoneW.push({ x, y });
    }
  bus.emit(EVT.ANIM_AOE, { tiles: zoneW, kind: 'hurlement', type: '' });
  for (const tgt of living) {
    const wl = d10(battleRng()); // 1d10, ignore Endurance et PA (jet SUBI par la cible)
    loseWounds(tgt, wl);
    lines.push(`${tgt.name} subit ${wl} Blessure(s) (ignore Endurance et PA).`);
    // Effets onHit AUTHORÉS de la manœuvre (Hurlement → Test de Résistance ou Brisé, + 3 Assourdi) —
    // donnée éditable `maneuver.effects` (op `test` + `condition`).
    lines.push(...applyTriggeredEffects(get, attacker, maneuverEffectsOf(attacker, 'hurlement'), 'onHit', { victim: tgt, woundsDealt: wl, rng: battleRng() }));
    if (tgt.wounds.current <= 0) applyZeroWounds(tgt);
  }
  set({ battle: { ...get().battle!, log: [...get().battle!.log, ...evLines(lines, 'attack', attacker.id)] } });
  bus.emit(EVT.SCENE_DIRTY);
}

/** Regard pétrifiant (Basilic, LDB 85 l.238) : `atk` = jet CT FIGÉ vs Initiative de la cible, marge =
 *  DR attaquant + `spent` (Avantage dépensé, +1 DR/Av) − DR défenseur. Cible visible la plus proche.
 *  La cible reçoit 1 État Sonné par tranche de 2 DR de marge ; pétrifiée (et 0 PB) si la marge atteint
 *  6 DR. Consomme l'Action (le store pose `acted`). */
export function applyManGaze(get: Get, set: SetFn, attacker: Combatant, atk: TestResult, spent: number): void {
  const battle = get().battle;
  if (!battle || battle.over || !attacker.pos) return;
  attacker.advantage = Math.max(0, attacker.advantage - spent);
  const foes = battle.combatants.filter((c) => c.kind !== attacker.kind && !isOutOfAction(c) && c.pos);
  if (!foes.length) return;
  const tgt = foes.reduce((p, c) => (chebyshev(attacker.pos!, p.pos!) <= chebyshev(attacker.pos!, c.pos!) ? p : c));
  const initVal = effectiveChar(tgt, 'I') + (tgt.skills.find((s) => s.name.toLowerCase().startsWith('initiative'))?.advances ?? 0);
  const def = rollTest(initVal, 'intermediaire', battleRng());
  const margin = atk.sl + spent - def.sl; // DR de l'attaquant (+Avantage) − DR du défenseur
  const lines = [`${attacker.name} fixe ${tgt.name} de son Regard pétrifiant (${spent} Avantage) !`];
  emitCreatureAttackAnim(attacker, 'regard');
  // Pétrifié à 6 DR de marge = issue spéciale de RÉSOLUTION (zéro les PB) → reste moteur. Le Sonné
  // échelonné (1 par 2 DR) est un effet onHit AUTHORÉ (donnée `maneuver.effects`, op `condition`
  // `valuePerSL{every:2}` alimenté par `ctx.sl = margin`).
  if (margin >= 6) { addCondition(tgt, 'Pétrifié'); tgt.wounds.current = 0; applyZeroWounds(tgt); lines.push(`${tgt.name} est définitivement changé en PIERRE !`); }
  else if (margin >= 2) lines.push(...applyTriggeredEffects(get, attacker, maneuverEffectsOf(attacker, 'regard'), 'onHit', { victim: tgt, margin, rng: battleRng() }));
  else lines.push(`${tgt.name} soutient le regard.`);
  set({ battle: { ...get().battle!, log: [...get().battle!.log, ...evLines(lines, 'attack', attacker.id, tgt.id)] } });
  bus.emit(EVT.SCENE_DIRTY);
}

/** Étreinte glaciale (Spectre de cairn, LDB 85 l.112) : `atk` = jet CC FIGÉ vs Corps à corps/Esquive
 *  de la cible adjacente. Sur un succès, la cible perd 1d10 + DR Blessures ignorant le Bonus
 *  d'Endurance ET les PA. Attaque magique. Consomme l'Action (le store pose `acted`). */
export function applyManChillGrasp(get: Get, set: SetFn, attacker: Combatant, atk: TestResult, spent: number): void {
  const battle = get().battle;
  if (!battle || battle.over || !attacker.pos) return;
  const tgt = battle.combatants.find((c) => c.kind !== attacker.kind && !isOutOfAction(c) && c.pos && combatDistance(attacker, c) <= 1);
  if (!tgt) return;
  attacker.advantage = Math.max(0, attacker.advantage - spent);
  const def = rollTest(defenseValue(tgt, bestDefenseMode(tgt)), 'intermediaire', battleRng());
  const opp = resolveOpposed(atk, def);
  const lines = [`${attacker.name} étreint ${tgt.name} de son toucher glacial !`];
  emitCreatureAttackAnim(attacker, 'etreinte');
  if (opp.attackerWins) {
    const wl = d10(battleRng()) + opp.netSL; // 1d10 + DR, ignore BE et PA
    loseWounds(tgt, wl);
    lines.push(`${tgt.name} perd ${wl} Blessure(s) (ignore Endurance et PA).`);
    if (tgt.wounds.current <= 0) applyZeroWounds(tgt);
  } else lines.push(`${tgt.name} résiste à l'étreinte.`);
  set({ battle: { ...get().battle!, log: [...get().battle!.log, ...evLines(lines, 'attack', attacker.id, tgt.id)] } });
  bus.emit(EVT.SCENE_DIRTY);
}

/** Le défenseur choisit sa meilleure réaction : Parade (Corps à corps) ou Esquive (Agilité + avances,
 *  pénalité d'Encombrement incluse) — la plus haute valeur. Vit ICI (feuille) et est ré-exporté par
 *  `combatFlow` (baril) : SOURCE UNIQUE, importée par combatFlow/rollFlows sans cycle.
 *  Bestial (LDB 85 l.338) : « En défense, elle peut seulement utiliser la Compétence Esquive. » */
export function bestDefenseMode(defender: Combatant): 'parade' | 'esquive' {
  if (isBestial(defender.traits)) return 'esquive';
  return defenseValue(defender, 'esquive') > defenseValue(defender, 'parade') ? 'esquive' : 'parade';
}

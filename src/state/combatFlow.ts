/**
 * Flux de combat (tour par tour) extrait de store.ts pour le garder navigable.
 * Fonctions (get,set) : combat, magie, IA, desengagement, effets. RNG via ./battleRng.
 * Refacto pure -- comportement preserve.
 */
import type { GameState, BattleState, RevealEntry } from './store';
import { Combatant, ItemInstance, ActiveEffect, CHAR_LABELS, HitLocation, Weapon, DIFFICULTY_MODIFIERS } from '../engine/types';
import { battleRng } from './battleRng';
import { facingToward } from '../gameIso/rig/facing';
import { d10 } from '../engine/dice';
import {
  resolveMelee,
  resolveRanged,
  defenseValue,
  combatValue,
  rollMeleeAttacker,
  rollDisengageAttack,
  attackWeapon,
  hitLocation,
  reverseRoll,
  woundsFromHit,
  rangeBandModifier,
  resolveStrayRangedHit,
  resolveTrample,
  AttackResult,
  ModLine,
} from '../engine/combat';
import { engage, isEngaged, decayEngagement, chargeAdvantage, disengageFrom } from '../engine/engagement';
import { sizeGap } from '../engine/size';
import { isUnbreakable, resolveQualities, hasQuality } from '../engine/qualities/dispatch';
import {
  isMagicMissile,
  parseHeal,
  parseConditionEffect,
  parseCharBuffs,
  buffDurationRounds,
  type CastResult,
  type MissileResult,
} from '../engine/magic';
import { rollMiscast, type MiscastSeverity } from '../engine/miscast';
import { opposedTest, rollTest } from '../engine/tests';
import { effectiveChar, bonus, refreshWounds } from '../engine/characteristics';
import { partyBest } from '../engine/skills';
import { recomputeLoadout, itemFromTrapping, weaponWithAmmo, compatibleAmmo, damageArmour } from '../engine/items';
import { effectiveMovement } from '../engine/encumbrance';
import { isOutOfAction, endOfRound, addCondition, removeCondition, hasCondition, cannotDefend, canTakeAction, applyZeroWounds, tickDeath, usesSuddenDeath, inDeathCondition } from '../engine/conditions';
import { creatureAttacks, venomDifficulty } from '../engine/creatureAttacks';
import { carryOverState } from '../engine/persistence';
import { rollCritical, critLocationRoll } from '../engine/critical';
import { isFumble, rollOups, type OupsResolved } from '../engine/oups';
import { traumaFromKind } from '../engine/trauma';
import { effectiveWeaponDamage, damageWeapon, destroyWeapon, isImprovised, solideSaveThreshold } from '../engine/weaponDamage';
import { findSpell } from '../data/index';
import { Scene, Effect, isWalkable } from './scene';
import { lineOfSightCover, coverModifier } from './lineOfSight';
import { fearSourceFor, resolvePeurTest, resolveTerreurTest, calmeValue, isFrenzyCapable, resolveFrenzyEntry } from '../engine/psychology';
import { sceneCombatModifiers } from './sceneRules';
import { reachable, pathTo, chebyshev, Pt } from './path';
import { chooseEnemyAction } from './ai';
import { bus, EVT } from './bus';


// ---------------------------------------------------------------------------
// Helpers internes
// ---------------------------------------------------------------------------

export function activeCombatant(battle: BattleState): Combatant | undefined {
  return battle.combatants.find((c) => c.id === battle.order[battle.turn]);
}

/** Empile une révélation témoin (montre le dé d'un jet subi/sur table) en queue de file FIFO. */
export function pushReveal(set: any, entry: RevealEntry): void {
  set((s: GameState) => ({ pendingReveals: [...s.pendingReveals, entry] }));
}

export function occupied(battle: BattleState, exceptId: string): Set<string> {
  const s = new Set<string>();
  for (const c of battle.combatants) {
    if (c.id === exceptId || isOutOfAction(c) || !c.pos) continue;
    s.add(`${c.pos.x},${c.pos.y}`);
  }
  return s;
}

export function findFreeTile(scene: Scene): Pt {
  for (let y = 0; y < scene.dimensions.h; y++)
    for (let x = 0; x < scene.dimensions.w; x++) if (isWalkable(scene, x, y)) return { x, y };
  return { x: 0, y: 0 };
}

export function removeEntity(get: () => GameState, set: any, id: string) {
  const scene = get().scene;
  if (!scene) return;
  scene.entities = scene.entities.filter((e) => e.id !== id);
  set({ scene: { ...scene } });
  bus.emit(EVT.SCENE_DIRTY);
}

/** Items ramassables d'une entité `objet` : noms de `loot` + trappings du `search`.
 *  `key` = `loot:<i>` (nom dans inventaire de groupe) ou `trap:<i>` (vrai objet à stats). */
export function entityPickables(ent: { loot?: string[]; search?: Effect[] }): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  (ent.loot ?? []).forEach((name, i) => out.push({ key: `loot:${i}`, label: name }));
  (ent.search ?? []).forEach((e, i) => {
    if (e.type === 'giveTrapping') out.push({ key: `trap:${i}`, label: e.trapping });
  });
  return out;
}

export function checkTriggers(get: () => GameState, set: any) {
  const { scene, partyPos, flags } = get();
  if (!scene) return;
  for (const t of scene.triggers) {
    if (flags[`__trigger_${t.id}`]) continue;
    if (!inRect(partyPos, t.rect)) continue;
    if (t.condition && !condMet(t.condition, flags)) continue;
    if (t.once) flags[`__trigger_${t.id}`] = true;
    applyEffects(get, set, t.effects);
    set({ flags: { ...flags } });
  }
}

export function inRect(p: Pt, r: { x: number; y: number; w: number; h: number }): boolean {
  return p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;
}

export function condMet(cond: string, flags: Record<string, boolean>): boolean {
  if (cond.startsWith('!')) return !flags[cond.slice(1)];
  return !!flags[cond];
}

export function applyEffects(get: () => GameState, set: any, effects: Effect[]) {
  for (const e of effects) {
    switch (e.type) {
      case 'setFlag':
        set((s: GameState) => ({ flags: { ...s.flags, [e.flag]: e.value ?? true } }));
        break;
      case 'journal':
        get().log(e.text);
        break;
      case 'giveItem':
        set((s: GameState) => ({ inventory: [...s.inventory, e.item] }));
        get().log(`Objet obtenu : ${e.item}.`);
        break;
      case 'giveMoney': {
        set((s: GameState) => ({
          money: {
            gold: s.money.gold + (e.gold ?? 0),
            silver: s.money.silver + (e.silver ?? 0),
            brass: s.money.brass + (e.brass ?? 0),
          },
        }));
        const parts = [e.gold && `${e.gold} CO`, e.silver && `${e.silver} SC`, e.brass && `${e.brass} PA`].filter(Boolean);
        if (parts.length) get().log(`Bourse : ${(e.gold ?? 0) < 0 || (e.silver ?? 0) < 0 ? '' : '+'}${parts.join(' ')}.`);
        break;
      }
      case 'giveXp':
        set((s: GameState) => ({
          party: s.party.map((h) => {
            const clone: Combatant = JSON.parse(JSON.stringify(h));
            clone.xp = (clone.xp ?? 0) + e.amount;
            return clone;
          }),
        }));
        get().log(`Groupe : +${e.amount} PX.`);
        break;
      case 'giveTrapping': {
        const it = itemFromTrapping(e.trapping);
        if (!it) {
          get().log(`Objet inconnu : « ${e.trapping} ».`);
          break;
        }
        let who = '';
        set((s: GameState) => {
          if (!s.party.length) return {};
          const idx = e.heroId ? s.party.findIndex((h) => h.id === e.heroId) : 0;
          const target = idx >= 0 ? idx : 0;
          who = s.party[target].name;
          return {
            party: s.party.map((h, i) => {
              if (i !== target) return h;
              const clone: Combatant = JSON.parse(JSON.stringify(h));
              clone.items = [...(clone.items ?? []), it]; // arrive NON équipé
              recomputeLoadout(clone); // met à jour l'encombrement
              return clone;
            }),
          };
        });
        get().log(`${who || 'Le groupe'} récupère : ${it.name}.`);
        break;
      }
      case 'document':
        set({ document: { title: e.title, text: e.text } });
        break;
      case 'startDialogue': {
        const dlg = get().scene?.dialogues.find((d) => d.id === e.dialogue);
        if (dlg) set({ dialogue: { dialogue: dlg, nodeId: dlg.start } });
        break;
      }
      case 'startCombat':
        get().startCombat(e.encounter);
        break;
      case 'transition': {
        const cur = get();
        if (cur.scene) set({ previousScene: { id: cur.scene.id, pos: { ...cur.partyPos } } });
        get().transitionTo(e.scene, e.entry);
        break;
      }
      case 'transitionBack': {
        const prev = get().previousScene;
        if (prev) {
          set({ previousScene: null });
          get().transitionTo(prev.id, undefined, prev.pos);
        }
        break;
      }
      case 'test': {
        // Test de compétence : le meilleur du groupe tente. Le jet attend « Lancer »
        // dans la modale (testRoll), puis une Chance est possible avant l'acquittement.
        const best = partyBest(get().party, e.skill, e.characteristic);
        if (!best) break;
        // Outil utilisé (Phase C2a) : résolu par NOM vers l'uid de l'objet du héros qui agit.
        const tool = e.tool ? best.actor.items?.find((i) => i.name === e.tool && !i.destroyed) : undefined;
        const difficulty = e.difficulty ?? 'intermediaire';
        const label = e.label || e.skill || (e.characteristic ? `Test de ${e.characteristic}` : 'Test');
        const target = Math.max(1, Math.min(99, best.value + DIFFICULTY_MODIFIERS[difficulty]));
        set({
          pendingTest: {
            actorId: best.actor.id,
            actorName: best.actor.name,
            label,
            skillValue: best.value,
            difficulty,
            requireSL: e.requireSL ?? 0,
            target,
            itemUid: tool?.uid,
            isDouble: false,
            roll: null, // pas encore lancé
            success: false,
            sl: 0,
            onSuccess: e.onSuccess,
            onFailure: e.onFailure,
          },
        });
        return; // la suite est portée par la branche (résolue à l'acquittement)
      }
      case 'endDialogue':
        set({ dialogue: null });
        break;
    }
  }
}

/** Le défenseur choisit sa meilleure réaction : Parade (Corps à corps) ou Esquive
 *  (Agilité + avances, pénalité d'Encombrement incluse) — la plus haute valeur. */
export function bestDefenseMode(defender: Combatant): 'parade' | 'esquive' {
  return defenseValue(defender, 'esquive') > defenseValue(defender, 'parade') ? 'esquive' : 'parade';
}

/** Sonné : tout adversaire qui frappe la cible en CORPS À CORPS gagne +1 Avantage
 *  AVANT son attaque (LDB États l.123) — ce +1 profite donc déjà au jet en cours puis
 *  persiste. À appeler une seule fois par attaque (avant le 1er jet ; pas sur une relance). */
export function applySonneMeleeAdvantage(attacker: Combatant, target: Combatant): void {
  if (attacker.weapons[0]?.type === 'melee' && target.conditions.some((c) => c.name === 'Sonné')) {
    attacker.advantage += 1;
    attacker.gainedAdvThisRound = true;
  }
}

/** Munition que le héros tirera : celle sélectionnée (`ammoUid`) si compatible, sinon la 1re compatible. */
export function selectedAmmo(attacker: Combatant, weapon: Weapon): ItemInstance | undefined {
  const compat = compatibleAmmo(attacker, weapon);
  return compat.find((a) => a.uid === attacker.ammoUid) ?? compat[0];
}

/** Arme effectivement tirée : mêlée au contact, distance sinon (Atout Pistolet pour tirer en Combat
 *  rapproché — LDB Armes l.297-298), AUGMENTÉE de la munition pour un héros (Dégâts + Atouts combinés).
 *  Centralisé pour que résolution / Chance / application voient la MÊME arme (munition, Empaleuse, reload). */
export function firedWeapon(attacker: Combatant, target: Combatant): Weapon {
  const adj = chebyshev(attacker.pos!, target.pos!) <= 1;
  const w = attackWeapon(attacker.weapons, adj);
  if (w.type === 'ranged' && attacker.kind === 'hero') {
    const ammo = selectedAmmo(attacker, w);
    if (ammo) return weaponWithAmmo(w, ammo);
  }
  return w;
}

/** Résout une attaque (le JET) SANS l'appliquer — pour le flux par modale (« Lancer »
 *  puis éventuel point de Chance). Retourne null si la cible est hors de portée de mêlée. */
/** Tir dans la mêlée (LDB 14 l.136) : si la pénalité de −20 a transformé une réussite en échec, le
 *  tir touche un allié intercalé de la cible. Retourne l'allié (le 1er Engagé côté tireur, « au
 *  hasard » approximé — le cas courant n'a qu'un allié au contact), ou null si non applicable. */
export function strayShotVictim(res: AttackResult, attacker: Combatant, target: Combatant, battle: BattleState): Combatant | null {
  if (res.hit || !res.attackerDetail) return null;
  if (res.attackerRoll > res.attackerDetail.target + 20) return null; // n'aurait pas touché même sans le −20
  const allies = (target.engagedWith ?? [])
    .map((id) => battle.combatants.find((c) => c.id === id))
    .filter((c): c is Combatant => !!c && c.kind === attacker.kind && !isOutOfAction(c));
  return allies[0] ?? null;
}

export function resolveAttack(
  get: () => GameState,
  attacker: Combatant,
  target: Combatant,
  location?: HitLocation,
): { res: AttackResult; weapon: Weapon; victim?: Combatant } | null {
  const dist = chebyshev(attacker.pos!, target.pos!);
  const weapon = firedWeapon(attacker, target); // arme + munition combinées (héros distance)
  if (dist > 1 && weapon.type === 'melee') return null; // arme de mêlée hors de portée
  const scene = get().scene!;
  const battle = get().battle!;
  const sc = sceneCombatModifiers(scene);
  const env: ModLine[] = [];
  if (weapon.type === 'ranged') {
    const occupants = battle.combatants
      .filter((c) => c.id !== attacker.id && c.id !== target.id && !isOutOfAction(c) && c.pos)
      .map((c) => c.pos!);
    const los = lineOfSightCover(scene, attacker.pos!, target.pos!, occupants);
    if (los.blocked) return null; // pas de Ligne de Vue → pas de tir (LDB 13-Combat l.123)
    if (los.cover !== 'none') env.push({ label: `Couvert (${los.cover})`, value: coverModifier(los.cover) });
    if (sc.concealed) env.push({ label: sc.label || 'Obscurité', value: -20 }); // cible dissimulée (LDB 14 l.107)
    else if (sc.attackMod) env.push({ label: sc.label, value: sc.attackMod }); // tempête/neige (l.108-116)
    if (battle.moved) env.push({ label: 'Tir en bougeant', value: -10 }); // Mouvement + tir au même Round (LDB 14 l.101)
    // Tir dans la mêlée (LDB 14 l.134) : la cible est Engagée avec un allié du tireur.
    const inMelee = (target.engagedWith ?? []).some((id) => {
      const ally = battle.combatants.find((c) => c.id === id);
      return !!ally && ally.kind === attacker.kind;
    });
    if (inMelee) env.push({ label: 'Tir dans la mêlée', value: -20 });
    const res = resolveRanged(attacker, target, weapon, battleRng(), dist, location, env);
    // Tir dans la mêlée (LDB 14 l.136) : si le −20 a transformé une réussite en échec, le tir dévie
    // et frappe un allié intercalé (touche acquise, dégâts recalculés sur l'allié).
    if (inMelee && !res.hit) {
      const ally = strayShotVictim(res, attacker, target, battle);
      if (ally) return { res: resolveStrayRangedHit(attacker, ally, weapon, res.attackerRoll, res.attackerDetail!.target + 20), weapon, victim: ally };
    }
    return { res, weapon };
  }
  // Mêlée : la météo (tempête/neige) pénalise l'attaque ; la neige pénalise aussi l'esquive (dodgeMod).
  if (sc.attackMod) env.push({ label: sc.label, value: sc.attackMod });
  return { res: resolveMelee(attacker, target, weapon, battleRng(), { defense: bestDefenseMode(target), location, env, dodgeMod: sc.dodgeMod }), weapon };
}

/** Applique un résultat d'attaque déjà résolu : Blessures, États, Assommante,
 *  Avantage, animation, journal, fin de combat. */
/** Issue du Test opposé d'Esquive du Désengagement : le mover est l'« attaquant » du test ;
 *  une égalité parfaite (tie) = statu quo (ni fuite, ni avantage à l'adversaire — LDB Tests). */
export function disengageOutcome(winner: 'attacker' | 'defender' | 'tie'): 'success' | 'failure' | 'tie' {
  return winner === 'attacker' ? 'success' : winner === 'tie' ? 'tie' : 'failure';
}

/** Lance le Désengagement d'un combattant Engagé (LDB 15-Dépl l.84-89) : option A
 *  (Avantage > adversaires → résolue direct) ou option B (Test opposé d'Esquive vs le
 *  foe le plus dangereux). No-op « rouvre le mouvement » si plus aucun foe vivant. */
export function startDisengage(get: () => GameState, set: any, mover: Combatant): void {
  const battle = get().battle!;
  const foes = (mover.engagedWith ?? [])
    .map((id) => battle.combatants.find((c) => c.id === id))
    .filter((c): c is Combatant => !!c && !isOutOfAction(c));
  // Désengagement GRATUIT du plus grand (LDB 85 l.308-309) : une créature plus grande que TOUS ses
  // adversaires Engagés les écarte et se déplace librement, sans Test ni sacrifice d'Avantage.
  const freeDisengage = foes.length > 0 && foes.every((f) => sizeGap(mover.size, f.size) >= 1);
  if (!foes.length || freeDisengage) {
    if (freeDisengage) {
      for (const f of foes) disengageFrom(mover, f); // lève les liens Engagé avec les plus petits écartés
      battle.log.push(`${mover.name} écarte les plus petits et se déplace librement.`);
    }
    // Lien d'Engagement périmé (foe mort/parti) OU désengagement gratuit : rouvrir le déplacement normal.
    const blocked = occupied(battle, mover.id);
    set({ battle: { ...battle, action: 'move', reachable: reachable(get().scene!, mover.pos!, effectiveMovement(mover), blocked) } });
    return;
  }
  const maxFoeAdv = Math.max(...foes.map((f) => f.advantage));
  // Ouvre le MENU de choix. L'adversaire de référence (Esquive opposée + cible de la Fuite) =
  // le foe Engagé à la meilleure Compétence de Corps à corps (l.89). Son jet de CC est figé d'avance.
  const foe = foes.reduce((a, b) => (combatValue(b, 'melee') > combatValue(a, 'melee') ? b : a));
  const atk = rollDisengageAttack(foe, battleRng());
  set({
    pendingDisengage: {
      moverId: mover.id,
      foeId: foe.id,
      canSacrifice: mover.advantage > maxFoeAdv, // Avantage strictement supérieur (l.87)
      phase: 'choice',
      atk,
      def: null,
      result: null,
    },
  });
}

/** Case ATTEIGNABLE adjacente à `target` qui coûte le moins de Mouvement (point d'arrivée d'une Charge). */
export function bestAdjacentReachable(reach: Map<string, number>, target: Pt): Pt | null {
  let best: Pt | null = null;
  let bestD = Infinity;
  for (const k of reach.keys()) {
    const [x, y] = k.split(',').map(Number);
    if (chebyshev({ x, y }, target) !== 1) continue;
    const d = reach.get(k)!;
    if (d < bestD) {
      bestD = d;
      best = { x, y };
    }
  }
  return best;
}

/** Mort d'un combattant : pour un héros à Destin, suspend (pendingFateSave) au lieu de mourir
 *  (LDB ch.17 l.31-35) ; sinon finalise la mort. `restoreWounds` = PB d'avant le coup létal. */
export function finalizeHeroDeath(get: () => GameState, set: any, hero: Combatant, source: 'hit' | 'slow', restoreWounds?: number): void {
  if (hero.kind === 'hero' && (hero.fate ?? 0) > 0) {
    set({ pendingFateSave: { heroId: hero.id, source, restoreWounds } });
  } else {
    hero.dead = true;
  }
}

/** Applique une Blessure critique (Coup Critique ou overkill) à `target` : PB (ignore BE+PA,
 *  plancher 0) + États + compteur. Mort Subite pour les figurants en overkill. RETOURNE `true`
 *  si le résultat est létal (le caller finalise via finalizeHeroDeath). Pousse le journal dans `log`. */
export function applyCriticalToTarget(
  target: Combatant,
  location: HitLocation,
  isCoupCritique: boolean,
  overkill: number,
  log: string[],
  set: any,
): boolean {
  if (overkill > 0 && !isCoupCritique && usesSuddenDeath(target)) {
    // Figurant : Mort Subite (LDB 18 l.51-54) — sortie directe.
    target.wounds.current = 0;
    if (!target.conditions.some((c) => c.name === 'Inconscient')) addCondition(target, 'Inconscient');
    log.push(`${target.name} s'effondre, hors de combat.`);
    return false;
  }
  const loc = isCoupCritique ? critLocationRoll(battleRng()) : location; // Coup Critique = localisation fraîche (l.62)
  const crit = rollCritical(target, loc, battleRng(), overkill);
  target.criticalWounds = (target.criticalWounds ?? 0) + 1;
  log.push(crit.log);
  const revealLines = [crit.log];
  if (crit.traumas.length) {
    target.traumas = [...(target.traumas ?? []), ...crit.traumas];
    for (const t of crit.traumas) {
      const line = `  ↳ ${t.label} (${t.location}).`;
      log.push(line);
      revealLines.push(line);
    }
  }
  if (!crit.lethal) {
    target.wounds.current = Math.max(0, target.wounds.current - crit.woundsLoss); // ignore BE+PA, plancher 0
    for (const c of crit.conditions) addCondition(target, c.name, c.value);
    if (crit.note) {
      log.push(`  ↳ ${crit.note}`); // effet long terme journalisé, non simulé
      revealLines.push(`  ↳ ${crit.note}`);
    }
  }
  // « Un jet = une modale » : le joueur voit le dé du Coup Critique (infligé ou subi).
  pushReveal(set, { kind: 'critical', title: 'Coup Critique', dice: crit.roll, lines: revealLines });
  return crit.lethal; // « Mort » instantané → finalisé par le caller (sauvetage par Destin possible)
}

/** Déviation Critique (LDB 63 l.63-66) : sacrifie 1 PA à `loc` pour IGNORER le Critique ; la cible
 *  subit quand même les Blessures normales recalculées avec la PA réduite (probable +1 Blessure). */
function deviateArmour(target: Combatant, weapon: Weapon, res: AttackResult, log: string[]): void {
  damageArmour(target, res.location ?? 'corps');
  const extra = Math.max(0, woundsFromHit(weapon, target, res.location ?? 'corps', res.damage ?? 0) - (res.woundsLost ?? 0));
  if (extra) target.wounds.current = Math.max(0, target.wounds.current - extra);
  log.push(`${target.name} dévie le coup sur son armure (−1 PA, Critique ignoré).`);
}

/** Une armure Bâclée frappée par un Coup Critique à sa localisation casse (LDB 60 l.82) — héros (pièces). */
function breakBacleArmour(target: Combatant, loc: HitLocation, log: string[]): void {
  const piece = (target.items ?? []).find(
    (i) => i.equipped && i.kind === 'armor' && i.locs?.includes(loc) && hasQuality(i, 'Bâclé') && (i.pa ?? 0) - (i.damageTaken ?? 0) > 0,
  );
  if (!piece) return;
  piece.damageTaken = piece.pa ?? 0; // inutilisable
  recomputeLoadout(target);
  log.push(`L'armure Bâclée de ${target.name} (${loc}) se brise sous le Coup Critique.`);
}

export function applyAttackResult(
  get: () => GameState,
  set: any,
  attacker: Combatant,
  target: Combatant,
  weapon: Weapon,
  res: AttackResult,
  deviated?: boolean,
): boolean {
  // Déviation Critique (LDB 63 l.63-66) : un HÉROS subit un Coup Critique à une localisation où il
  // porte de la PA → on SUSPEND pour son choix Dévier/Subir (modale). AUCUN effet de bord ici ; la
  // résolution (deviationApply) rappelle cette fonction avec `deviated` défini (early-return sauté →
  // application UNE seule fois). Les sous-attaques (balayage/Piétinement) passent `deviated` explicite
  // pour résoudre instantanément (pas de modale imbriquée). Les sorts (applyCast) gèrent leurs Critiques
  // à part : ils n'atteignent jamais cette fonction, donc pas de garde « arme » nécessaire.
  const dloc = res.location ?? 'corps';
  if (deviated === undefined && res.hit && res.woundsLost && res.critical && target.kind === 'hero' && (target.armour[dloc] ?? 0) > 0) {
    set({ pendingDeviation: { attackerId: attacker.id, targetId: target.id, weapon, res, resumeAfter: true } });
    return true; // suspendu — le caller NE doit PAS exécuter ses post-étapes (rejouées à la résolution)
  }
  const battle = get().battle!;
  attacker.aiming = false; // l'attaque consomme la visée (tir : +20 déjà appliqué ; mêlée : visée gâchée)
  if (attacker.nextActionPenalty) attacker.nextActionPenalty = undefined; // pénalité de Maladresse consommée par ce Test

  if (weapon.type === 'melee') engage(attacker, target); // Engagé symétrique sur toute attaque de mêlée (LDB 13-Combat l.174-175)
  const critLog: string[] = [];
  if (res.hit && res.woundsLost) {
    const currentBefore = target.wounds.current;
    const overkill = res.woundsLost - currentBefore; // > 0 si le coup dépasse les PB COURANTS (LDB 18 l.30)
    target.wounds.current = Math.max(0, currentBefore - res.woundsLost);
    const loc = res.location ?? 'corps';
    if (res.critical) breakBacleArmour(target, loc, critLog); // armure Bâclée brisée par le Critique (LDB 60 l.82)
    const autoDeviate = res.critical && target.kind === 'enemy' && (target.armour[loc] ?? 0) > 0; // ennemi : dévie toujours (auto)
    if (res.critical && (autoDeviate || deviated === true)) {
      deviateArmour(target, weapon, res, critLog); // Déviation (auto pour l'ennemi ; choix « Dévier » du héros, LDB 63 l.63-66)
    } else if (res.critical || overkill > 0) {
      const lethal = applyCriticalToTarget(target, loc, !!res.critical, Math.max(0, overkill), critLog, set);
      if (lethal) finalizeHeroDeath(get, set, target, 'hit', currentBefore); // mort directe ou pause Destin
    } else if (target.wounds.current <= 0) {
      applyZeroWounds(target); // 0 PB sans critique → À Terre (LDB 18 l.28)
    }
  }
  // Taille (arme) : sur une touche réussie, endommage de 1 PA l'armure frappée (LDB 63 l.8).
  if (res.hit && hasQuality(weapon, 'Taille')) damageArmour(target, res.location ?? 'corps');
  // Munition héros : consommée à l'application ; arme à Recharge → déchargée (Test étendu requis pour recharger).
  if (weapon.type === 'ranged' && attacker.kind === 'hero') {
    const used = selectedAmmo(attacker, weapon);
    if (used && (used.qty ?? 0) > 0) {
      used.qty = (used.qty ?? 0) - 1;
      if (used.qty <= 0) attacker.items = (attacker.items ?? []).filter((i) => i.uid !== used.uid);
    }
    if ((weapon.reload ?? 0) > 0) {
      attacker.loaded = false; // déchargé après le tir
      attacker.reloadProgress = 0;
    }
  }
  // Interruption du rechargement (LDB 63-Armures l.29) : un héros touché en plein rechargement recommence à zéro.
  if (res.hit && res.woundsLost && target.kind === 'hero' && (target.reloadProgress ?? 0) > 0) target.reloadProgress = 0;
  // Qualités à effet « à la touche » (hook `onHit` du registre) : ex. Assommante — touche à la Tête →
  // Test opposé F vs Endurance+Résistance ; si l'attaquant l'emporte, la cible gagne l'État Sonné (LDB Armes l.268).
  let assommanteLog: string | null = null;
  if (res.hit) {
    for (const { def } of resolveQualities(weapon)) {
      const oh = def.onHit;
      if (!oh || (oh.location && res.location !== oh.location)) continue;
      const skillAdv = oh.opposed.defenderSkill
        ? target.skills.find((s) => s.name.toLowerCase().startsWith(oh.opposed.defenderSkill!.toLowerCase()))?.advances ?? 0
        : 0;
      const defVal = effectiveChar(target, oh.opposed.defender) + skillAdv;
      if (opposedTest(effectiveChar(attacker, oh.opposed.attacker), defVal, battleRng()).winner === 'attacker') {
        addCondition(target, oh.condition);
        assommanteLog = `${target.name} est ${oh.condition} (${def.key}).`;
        pushReveal(set, { kind: 'assommante', title: def.key, lines: [assommanteLog] }); // « un jet = une modale » (Test opposé)
      }
    }
  }
  // Avantage (LDB Déplacement l.30-40) : +1 au vainqueur du Test opposé / sur une
  // Blessure infligée sans Test opposé (tir) ; perte de TOUT l'Avantage en échouant
  // un Test opposé ou en perdant une Blessure.
  if (res.advantageTo === 'attacker') {
    attacker.advantage += 1;
    attacker.gainedAdvThisRound = true;
  }
  if (res.advantageTo === 'defender') {
    target.advantage += 1;
    target.gainedAdvThisRound = true;
    attacker.advantage = 0; // l'attaquant a échoué au Test opposé
  }
  if (res.hit && res.woundsLost) target.advantage = 0; // perdre une Blessure → perte de tout Avantage
  const kind = weapon.type === 'ranged' ? 'ranged' : 'melee';
  const defense = weapon.type === 'ranged' ? 'none' : bestDefenseMode(target);
  // Orientation : l'attaquant se tourne vers la cible, le défenseur vers l'attaquant (frappe offensive).
  if (attacker.pos && target.pos) {
    set((s: GameState) => ({ facing: { ...s.facing, [attacker.id]: facingToward(attacker.pos!, target.pos!), [target.id]: facingToward(target.pos!, attacker.pos!) } }));
  }
  bus.emit(EVT.ANIM_ATTACK, { from: attacker.id, to: target.id, result: res, kind, defense, creatureAttack: creatureAttackKind(weapon.name) });
  const log = [...battle.log, res.log];
  log.push(...critLog);
  if (assommanteLog) log.push(assommanteLog);
  if (isOutOfAction(target)) log.push(`${target.name} est mis hors de combat !`);
  set({ battle: { ...battle, acted: true, action: null, log } });
  bus.emit(EVT.SCENE_DIRTY);
  checkBattleOver(get, set);
  resolveEnemyFumble(get, set, attacker, weapon, res); // Maladresse d'un ENNEMI attaquant → résolue instantanément
  // Maladresse d'un ENNEMI défenseur (Test opposé, LDB 14 l.48-51) : sa Parade/Esquive ratée sur un double.
  if (target.kind === 'enemy' && defenderFumbled(res) && !isOutOfAction(target) && target.weapons[0]) {
    applyOups(get, set, target, target.weapons[0], rollOups(target.weapons[0], battleRng()));
  }
  return false; // non suspendu : application complète terminée
}

/** Une Maladresse de l'attaquant dans un résultat d'attaque ? (jet propre raté + double, LDB 14 l.53). */
export function attackerFumbled(res: AttackResult): boolean {
  return !!res.attackerDetail && isFumble(res.attackerDetail.roll, res.attackerDetail.success);
}

/** Une Maladresse du DÉFENSEUR (Test opposé) : sa défense propre ratée sur un double (LDB 14 l.48-51). */
export function defenderFumbled(res: AttackResult): boolean {
  return !!res.defenderDetail && isFumble(res.defenderDetail.roll, res.defenderDetail.success);
}

/** Alliés (même camp) encore actifs, hors `c`, et À PORTÉE de `weapon` (LDB 14 l.42-46 : « à
 *  distance »). Tir → dans la bande de portée ; mêlée/sans portée → adjacent (Allonge ~1 case).
 *  Sans position connue (tests), on ne filtre pas. */
function alliesAtRange(battle: BattleState, c: Combatant, weapon: Weapon): Combatant[] {
  const allies = battle.combatants.filter((x) => x.id !== c.id && x.kind === c.kind && !isOutOfAction(x));
  if (!c.pos) return allies;
  return allies.filter((a) => {
    if (!a.pos) return true;
    const d = chebyshev(c.pos!, a.pos);
    if (weapon.type === 'ranged' && weapon.range) return rangeBandModifier(d, weapon.range) != null;
    return d <= 1;
  });
}

/** Use/détruit l'arme sur l'ItemInstance SOURCE (héros → persiste, `recomputeLoadout` re-dérive),
 *  sinon sur le Weapon actif (ennemi/figurant, transient). Respecte Incassable (LDB 62 l.310). */
function wearActiveWeapon(c: Combatant, weapon: Weapon, destroy: boolean): void {
  const it = (c.items ?? []).find((i) => i.equipped && (i.kind === 'melee' || i.kind === 'ranged') && i.name === weapon.name);
  if (isUnbreakable(it ?? weapon)) return; // Incassable : ni dégât ni destruction (LDB 62 l.310)
  // Sauvegarde Solide(N) contre une cassure instantanée : 1d10 ≥ seuil → l'arme résiste (LDB 60 l.64-67).
  if (destroy) {
    const thr = solideSaveThreshold(weapon);
    if (thr != null && d10(battleRng()) >= thr) return;
  }
  if (it) {
    if (destroy) {
      it.destroyed = true;
    } else {
      // Une Arme improvisée déjà à +0 qui prend un Dégât de plus devient inutilisable (LDB 62 l.178).
      if (isImprovised({ ...weapon, damageTaken: it.damageTaken ?? 0 })) it.destroyed = true;
      it.damageTaken = (it.damageTaken ?? 0) + 1;
    }
    recomputeLoadout(c); // re-dérive c.weapons depuis l'item usé (persiste via carryOverState items)
  } else if (destroy) {
    destroyWeapon(weapon);
  } else {
    damageWeapon(weapon);
  }
}

/**
 * Applique l'effet du Tableau des Oups ! au combattant `c` (mute + journalise). LDB 14 l.14-57.
 * Le chiffre des unités du jet sert de DR pour les touches (l.44).
 */
export function applyOups(get: () => GameState, set: any, c: Combatant, weapon: Weapon, r: OupsResolved): void {
  const battle = get().battle!;
  const log: string[] = [`${c.name} — Maladresse ! ${r.label}`];
  // Bâclé : l'arme casse sur toute Maladresse (Test raté + double, LDB 60 l.82) — sauvegarde Solide possible.
  if (hasQuality(weapon, 'Bâclé')) wearActiveWeapon(c, weapon, true);
  const sb = bonus(effectiveChar(c, 'F'));
  const units = r.roll % 10;
  switch (r.kind) {
    case 'selfWound':
      c.wounds.current = Math.max(0, c.wounds.current - 1); // ignore BE+PA (l.18)
      if (c.wounds.current <= 0) applyZeroWounds(c);
      break;
    case 'weaponDamageActLast':
      wearActiveWeapon(c, weapon, false); // 1 Dégât d'arme, persisté sur l'ItemInstance source
      c.actLastNextRound = true;
      break;
    case 'actionPenalty':
      c.nextActionPenalty = 10;
      break;
    case 'loseMovement':
      c.loseNextMovement = true;
      break;
    case 'loseAction':
      c.loseNextAction = true;
      break;
    case 'trauma': {
      c.criticalWounds = (c.criticalWounds ?? 0) + 1; // « compte comme une Blessure critique » (l.41)
      const leg: HitLocation = battleRng().int(0, 1) === 0 ? 'jambeG' : 'jambeD'; // « se tord la cheville »
      c.traumas = [...(c.traumas ?? []), traumaFromKind('dechirure', 'mineur', leg)];
      log.push(`  ↳ Déchirure musculaire (Mineure) à la ${leg === 'jambeG' ? 'jambe gauche' : 'jambe droite'}.`);
      break;
    }
    case 'hitAlly': {
      const allies = alliesAtRange(battle, c, weapon);
      if (allies.length) {
        const ally = allies[battleRng().int(0, allies.length - 1)];
        const loc = hitLocation(reverseRoll(r.roll));
        const lost = woundsFromHit(weapon, ally, loc, effectiveWeaponDamage(weapon, sb) + units); // plancher 1 (l.165)
        ally.wounds.current = Math.max(0, ally.wounds.current - lost);
        if (ally.wounds.current <= 0) applyZeroWounds(ally);
        log.push(`  ↳ Touche ${ally.name} (${loc}) : ${lost} Blessure(s).`);
      } else {
        addCondition(c, 'Sonné'); // « Si personne n'est à distance, vous vous frappez tout seul → Sonné » (l.45-46)
        log.push(`  ↳ Personne à portée : se frappe seul → Sonné.`);
      }
      break;
    }
    case 'misfire': {
      const lost = woundsFromHit(weapon, c, 'brasD', effectiveWeaponDamage(weapon, sb) + units); // plancher 1
      c.wounds.current = Math.max(0, c.wounds.current - lost);
      if (c.wounds.current <= 0) applyZeroWounds(c);
      wearActiveWeapon(c, weapon, true); // arme détruite, persistée sur l'ItemInstance source
      log.push(`  ↳ Incident de Tir : ${lost} Blessure(s) au Bras principal, arme détruite.`);
      break;
    }
  }
  set({ battle: { ...get().battle!, log: [...get().battle!.log, ...log] } });
  bus.emit(EVT.SCENE_DIRTY);
  checkBattleOver(get, set);
}

/** Maladresse d'un ENNEMI : résolue instantanément (IA abstraite). No-op si pas un ennemi/pas de fumble. */
export function resolveEnemyFumble(get: () => GameState, set: any, enemy: Combatant, weapon: Weapon, res: AttackResult): void {
  if (enemy.kind !== 'enemy' || !attackerFumbled(res)) return;
  applyOups(get, set, enemy, weapon, rollOups(weapon, battleRng()));
}

/** Ouvre la modale de défense réactive si l'attaque est : ennemi → héros, en mêlée,
 *  à portée, cible CAPABLE de se défendre (pas Surpris). Fige le jet d'attaque et
 *  suspend le tour de l'IA. Retourne true si la modale s'est ouverte. */
export function maybeOpenDefense(
  set: any,
  attacker: Combatant,
  target: Combatant,
  weapon: Weapon = attacker.weapons[0],
  free?: { kind: string; prevActed: boolean },
): boolean {
  if (attacker.kind !== 'enemy' || target.kind !== 'hero') return false;
  if (weapon?.type !== 'melee') return false;
  if (chebyshev(attacker.pos!, target.pos!) > 1) return false;
  if (cannotDefend(target)) return false; // Surpris → résolution instantanée (LDB États l.132)
  applySonneMeleeAdvantage(attacker, target); // +1 Avantage si cible Sonnée, AVANT le jet (une seule fois)
  const atk = rollMeleeAttacker(attacker, target, weapon, battleRng()); // jet d'attaque figé
  set({
    pendingDefense: {
      attackerId: attacker.id,
      defenderId: target.id,
      weapon,
      location: null, // l'IA ne vise pas de localisation
      atk,
      mode: bestDefenseMode(target),
      def: null,
      result: null,
      // Attaque GRATUITE de créature (Morsure/Caudale/Piétinement) : portée au resolve pour
      // restaurer l'Action (gratuite), appliquer ses effets RAW et enchaîner la file.
      ...(free ? { free: true, freeKind: free.kind, prevActed: free.prevActed } : {}),
    },
  });
  return true;
}

/** Attaque de l'IA : ouvre la modale de défense (→ true, tour SUSPENDU) si la cible
 *  est un héros qui peut se défendre en mêlée ; sinon résout instantanément (→ false). */
export function doAttack(get: () => GameState, set: any, attacker: Combatant, target: Combatant): boolean {
  if (maybeOpenDefense(set, attacker, target)) return true; // suspendu : reprise via defenseConfirm/Cancel
  applySonneMeleeAdvantage(attacker, target); // +1 Avantage si cible Sonnée (LDB États l.123), avant le jet
  const r = resolveAttack(get, attacker, target);
  if (!r) {
    get().log(firedWeapon(attacker, target).type === 'ranged' ? 'Pas de ligne de vue (cible masquée).' : 'Cible hors de portée de mêlée.');
    return false;
  }
  const suspended = applyAttackResult(get, set, attacker, r.victim ?? target, r.weapon, r.res); // r.victim = allié touché par un tir dévié (LDB 14 l.136)
  if (suspended) return true; // Déviation Critique du héros : la modale reprendra (autoCleave/Piétinement/advance rejoués au resolve)
  autoCleave(get, set, attacker, r.victim ?? target, r.res); // Frappe Mortelle : balayage auto si l'ennemi est plus grand
  return false;
}

// ---------------------------------------------------------------------------
// Frappe Mortelle — balayage (LDB 14 - _GoBack.md l.9-12 + 85 l.299)
// ---------------------------------------------------------------------------

/** Cibles de balayage : adversaires encore actifs, ADJACENTS (Chebyshev ≤ 1 — « à portée de ses
 *  attaques » = adjacence tant que l'Allonge n'est pas modélisée) et non déjà frappés dans ce
 *  balayage. Sans position connue (tests purs), on ne filtre pas sur la distance. */
export function cleaveTargets(battle: BattleState, attacker: Combatant, hitIds: string[]): Combatant[] {
  return battle.combatants.filter((c) => {
    if (c.kind === attacker.kind || isOutOfAction(c) || hitIds.includes(c.id)) return false;
    if (!attacker.pos || !c.pos) return true;
    return chebyshev(attacker.pos, c.pos) <= 1;
  });
}

/** Balayage AUTOMATIQUE d'un ennemi (IA) après une touche de mêlée d'un plus grand (`res.cleave`,
 *  LDB 85 l.299) : enchaîne jusqu'à BCC attaques sur des adversaires adjacents non encore frappés,
 *  se déplaçant sur la case d'une cible tuée (l.10). Résolution instantanée — les enchaînements
 *  n'ouvrent pas de modale de défense interactive (simplification documentée pour l'IA). */
export function autoCleave(get: () => GameState, set: any, attacker: Combatant, primaryTarget: Combatant, res: AttackResult): void {
  if (attacker.kind !== 'enemy' || !res.cleave) return;
  const bcc = bonus(effectiveChar(attacker, 'CC'));
  if (bcc < 1) return;
  const hitIds = [primaryTarget.id];
  // Cible primaire tuée → l'attaquant se déplace sur sa case avant d'enchaîner (l.10).
  if (isOutOfAction(primaryTarget) && primaryTarget.pos) attacker.pos = { ...primaryTarget.pos };
  for (let n = 0; n < bcc; n++) {
    const battle = get().battle;
    if (!battle || battle.over) break;
    const next = cleaveTargets(battle, attacker, hitIds)[0];
    if (!next) break;
    hitIds.push(next.id);
    const r = resolveAttack(get, attacker, next);
    if (!r) continue; // hors de portée (ne devrait pas : déjà filtré adjacent) — borne consommée tout de même
    applyAttackResult(get, set, attacker, r.victim ?? next, r.weapon, r.res, false); // enchaînement : résolution instantanée (pas de modale de déviation imbriquée)
    if (isOutOfAction(next) && next.pos) attacker.pos = { ...next.pos }; // se déplace sur la case libérée
  }
  set({ battle: { ...get().battle! } });
  bus.emit(EVT.SCENE_DIRTY);
}

/** Balayage d'un HÉROS (interactif) : appelé après l'application d'une attaque. Démarre le balayage
 *  sur une touche d'un plus grand (`res.cleave`), ou le poursuit si `wasChain` (un enchaînement vient
 *  d'être résolu). Ouvre/maintient `pendingCleave` tant qu'il reste des cibles adjacentes ET que le
 *  nombre d'enchaînements reste < BCC (LDB 14 l.12) ; sinon le ferme. Déplacement sur la case d'une
 *  cible tuée (l.10). */
export function maybeHeroCleave(get: () => GameState, set: any, attacker: Combatant, target: Combatant, res: AttackResult, wasChain: boolean): void {
  if (attacker.kind !== 'hero') return;
  const pc = get().pendingCleave;
  if (!pc && !res.cleave) return; // ni balayage en cours, ni déclenché par cette touche
  const count = wasChain ? (pc?.count ?? 0) + 1 : pc?.count ?? 0; // un enchaînement résolu consomme une attaque
  const hitIds = pc ? [...new Set([...pc.hitIds, target.id])] : [target.id];
  if (isOutOfAction(target) && target.pos) attacker.pos = { ...target.pos }; // case libérée (l.10)
  const battle = get().battle!;
  const bcc = bonus(effectiveChar(attacker, 'CC'));
  const remaining = cleaveTargets(battle, attacker, hitIds);
  if (!battle.over && count < bcc && remaining.length) {
    set({ pendingCleave: { attackerId: attacker.id, hitIds, count }, battle: { ...battle } });
  } else {
    set({ pendingCleave: null, battle: { ...battle } });
  }
}

// ---------------------------------------------------------------------------
// Piétinement — action gratuite à 1 Avantage (LDB 85 - Traits de créature.md l.320-321)
// ---------------------------------------------------------------------------

/** Arme abstraite du Piétinement : Corps à corps (Bagarre), Dégâts = Bonus de Force (+0). */
export const TRAMPLE_WEAPON: Weapon = { name: 'Piétinement', type: 'melee', damage: '+BF', qualities: [] };

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
      chebyshev(c.pos, t.pos) <= 1 &&
      sizeGap(c.size, t.size) >= 1,
  );
}

/** Résout un Piétinement : dépense 1 Avantage (coût de l'action gratuite) puis applique
 *  `resolveTrample` (BF +0, Corps à corps). Ne consomme PAS l'Action (« action gratuite »). */
export function applyTrample(get: () => GameState, set: any, attacker: Combatant, target: Combatant): void {
  const prevActed = get().battle?.acted ?? false; // « action gratuite » : ne doit pas consommer l'Action
  attacker.advantage = Math.max(0, attacker.advantage - 1); // coût : 1 Avantage (LDB 85 l.320)
  const res = resolveTrample(attacker, target, battleRng());
  applyAttackResult(get, set, attacker, target, TRAMPLE_WEAPON, res, false); // pose acted=true (attaque standard)… ; Piétinement = résolution instantanée (pas de modale)
  set({ battle: { ...get().battle!, acted: prevActed } }); // …qu'on restaure : le Piétinement est gratuit
}

/** L'IA piétine (faible priorité, après l'attaque principale) : action gratuite si l'ennemi a ≥1
 *  Avantage et qu'un adversaire adjacent plus petit est à portée. Instantané (pas de modale IA). */
export function aiMaybeTrample(get: () => GameState, set: any, enemy: Combatant): void {
  if (enemy.kind !== 'enemy' || isOutOfAction(enemy) || enemy.advantage < 1) return;
  const battle = get().battle;
  if (!battle || battle.over) return;
  const target = trampleTarget(battle, enemy);
  if (!target) return;
  applyTrample(get, set, enemy, target);
}

/** Attaque LIBRE de Frénésie (LDB 21 l.34 : « un Test de Capacité de Combat gratuit chaque Round ») :
 *  un ennemi frenzied porte une attaque de mêlée supplémentaire avec son arme contre un adversaire
 *  adjacent. Elle NE consomme ni Avantage ni Action. Résolution instantanée — comme autoCleave /
 *  aiMaybeTrample, l'IA ne déclenche pas de modale de défense (simplification documentée). */
export function aiFrenzyAttack(get: () => GameState, set: any, enemy: Combatant): void {
  if (enemy.kind !== 'enemy' || !enemy.frenzied || isOutOfAction(enemy)) return;
  const battle = get().battle;
  if (!battle || battle.over || !enemy.pos) return;
  if ((enemy.weapons[0]?.type ?? 'melee') !== 'melee') return; // CC Test = corps à corps
  const target = battle.combatants.find(
    (t) => t.kind !== enemy.kind && !isOutOfAction(t) && !!t.pos && chebyshev(enemy.pos!, t.pos) <= 1,
  );
  if (!target) return;
  const prevActed = get().battle?.acted ?? false; // gratuite : on restaure l'état d'Action après coup
  const r = resolveAttack(get, enemy, target);
  if (!r) return;
  applyAttackResult(get, set, enemy, r.victim ?? target, r.weapon, r.res, false); // instantané (pas de modale)
  set({ battle: { ...get().battle!, acted: prevActed } });
}

// ---------------------------------------------------------------------------
// Attaques GRATUITES de créature (Taille & traits) — chacune au prix de 1 Avantage, OPPOSÉE
// (la cible se défend Parade/Esquive, comme une attaque normale) et NE consomme PAS l'Action.
// RAW : Piétinement (LDB 85 l.320-321, BF+0), Morsure/Attaque caudale (l.338/340, Indice) ; priorité
// Morsure/Caudale (Indice) avant Piétinement (BF+0) — cf. exemple Aventures à Ubersreik.
// ---------------------------------------------------------------------------

/** Arme abstraite d'une attaque gratuite : Piétinement = BF+0 ; Morsure/Caudale = +Indice (BF inclus). */
function freeAttackWeapon(kind: string, bonus: number): Weapon {
  if (kind === 'pietinement') return TRAMPLE_WEAPON;
  return { name: kind === 'caudale' ? 'Attaque caudale' : 'Morsure', type: 'melee', damage: `+${bonus}`, qualities: [] };
}

/** Type de pose d'attaque (rendu créature) déduit du NOM de l'arme naturelle, ou undefined (arme
 *  manufacturée → pose générique du gabarit). Sert au tintage de l'animation d'attaque (AnimatedPlanToken). */
export function creatureAttackKind(weaponName: string): string | undefined {
  const n = weaponName.toLowerCase();
  if (n.includes('morsure')) return 'morsure';
  if (n.includes('caudale') || n.includes('queue')) return 'caudale';
  if (n.includes('piétin') || n.includes('pietin')) return 'pietinement';
  if (n.includes('corne')) return 'cornes';
  if (n.includes('griffe') || n === 'arme') return 'arme';
  return undefined;
}

/** Difficulté de Test (clé) depuis le libellé FR de la Difficulté du Venin (défaut Intermédiaire). */
function venomDiffKey(label: string): import('../engine/types').Difficulty {
  const l = label.toLowerCase();
  if (l.includes('très facile')) return 'tresFacile';
  if (l.includes('facile')) return 'facile';
  if (l.includes('accessible')) return 'accessible';
  if (l.includes('très difficile')) return 'tresDifficile';
  if (l.includes('difficile')) return 'difficile';
  if (l.includes('complexe')) return 'complexe';
  return 'intermediaire';
}

/** Effets RAW post-touche d'une attaque gratuite (sur PB infligés) :
 *  - Attaque caudale → cible de Taille INFÉRIEURE → À Terre (LDB 85 l.338) ;
 *  - Atout Venin de la créature → Test de Résistance (Endurance) à la Difficulté du Venin ;
 *    sur un échec, la cible subit l'État Empoisonné (LDB 85 l.326, voir p.168). */
export function applyFreeAttackEffects(get: () => GameState, attacker: Combatant, target: Combatant, kind: string, res: AttackResult): void {
  if (!res.hit || !res.woundsLost) return; // les effets ne se déclenchent que sur Points de Blessure perdus
  if (kind === 'caudale' && sizeGap(attacker.size, target.size) >= 1 && !hasCondition(target, 'À Terre')) {
    addCondition(target, 'À Terre');
    get().log(`${target.name} est mis À Terre (Attaque caudale).`);
  }
  const vd = venomDifficulty(attacker.traits ?? []);
  if (vd && !hasCondition(target, 'Empoisonné')) {
    const resAdv = target.skills.find((s) => s.name.toLowerCase().startsWith('résistance'))?.advances ?? 0;
    const t = rollTest(effectiveChar(target, 'E') + resAdv, venomDiffKey(vd), battleRng());
    if (!t.success) {
      addCondition(target, 'Empoisonné');
      get().log(`${target.name} échoue à résister au Venin et est Empoisonné.`);
    } else get().log(`${target.name} résiste au Venin.`);
  }
}

/** Cible d'une attaque gratuite : adversaire adjacent actif (Piétinement exige une Taille inférieure). */
function freeAttackTarget(battle: BattleState, c: Combatant, kind: string): Combatant | undefined {
  if (kind === 'pietinement') return trampleTarget(battle, c);
  return battle.combatants.find((t) => t.kind !== c.kind && !isOutOfAction(t) && !!t.pos && !!c.pos && chebyshev(c.pos, t.pos) <= 1);
}

/** Résout UNE attaque gratuite de `kind` contre `target`, OPPOSÉE et GRATUITE : ouvre la modale de
 *  défense (héros) → suspendu (true) ; sinon résout instantanément (opposé auto, ou passif si Surpris),
 *  restaure l'Action et applique les effets. Dépense 1 Avantage. */
function applyFreeAttack(get: () => GameState, set: any, attacker: Combatant, target: Combatant, kind: string, bonus: number): boolean {
  const prevActed = get().battle?.acted ?? false;
  attacker.advantage = Math.max(0, attacker.advantage - 1); // coût : 1 Avantage
  const weapon = freeAttackWeapon(kind, bonus);
  if (maybeOpenDefense(set, attacker, target, weapon, { kind, prevActed })) return true; // suspendu : resolve via défense
  const res = resolveMelee(attacker, target, weapon, battleRng(), { defense: cannotDefend(target) ? 'none' : bestDefenseMode(target) });
  applyAttackResult(get, set, attacker, target, weapon, res, false);
  set({ battle: { ...get().battle!, acted: prevActed } }); // gratuite : ne consomme pas l'Action
  applyFreeAttackEffects(get, attacker, target, kind, res);
  return false;
}

/** L'IA enchaîne ses attaques gratuites de créature après l'attaque principale (chacune 1 Avantage,
 *  OPPOSÉE). File initialisée au 1er appel (Morsure/Attaque caudale des traits, PUIS Piétinement de
 *  Taille — les Indices d'abord), puis poursuivie après chaque modale de défense résolue. Retourne
 *  true si une modale s'est ouverte (tour SUSPENDU). */
export function aiCreatureFreeAttacks(get: () => GameState, set: any, enemy: Combatant): boolean {
  if (enemy.kind !== 'enemy' || isOutOfAction(enemy)) { enemy.pendingFreeAttacks = undefined; return false; }
  const battle = get().battle;
  if (!battle || battle.over) { enemy.pendingFreeAttacks = undefined; return false; }
  if (enemy.pendingFreeAttacks === undefined) {
    const traitKinds = creatureAttacks(enemy.traits ?? [])
      .filter((a) => a.trigger === 'free' && a.avantage === 1 && (a.kind === 'morsure' || a.kind === 'caudale'))
      .map((a) => a.kind);
    enemy.pendingFreeAttacks = [...traitKinds, 'pietinement']; // Piétinement (Taille) en dernier
  }
  while (enemy.pendingFreeAttacks.length) {
    if (enemy.advantage < 1) break;
    const b2 = get().battle; if (!b2 || b2.over) break;
    const kind = enemy.pendingFreeAttacks[0];
    const target = freeAttackTarget(b2, enemy, kind);
    if (!target) { enemy.pendingFreeAttacks.shift(); continue; }
    const bonus = kind === 'pietinement' ? 0 : creatureAttacks(enemy.traits ?? []).find((a) => a.kind === kind)?.bonus ?? 0;
    enemy.pendingFreeAttacks.shift();
    if (applyFreeAttack(get, set, enemy, target, kind, bonus)) return true; // modale ouverte → reprise via defenseConfirm
  }
  enemy.pendingFreeAttacks = undefined; // file épuisée
  return false;
}

/** Applique un effet actif sans cumul : un seul bonus (le meilleur) ET une seule
 *  pénalité (la pire) coexistent par caractéristique (Livre de base l.168). */
export function applyActiveEffect(target: Combatant, effect: ActiveEffect) {
  target.activeEffects = target.activeEffects ?? [];
  // On ne dédoublonne qu'entre effets de MÊME signe (bonus vs pénalité séparés) :
  // un bonus et une pénalité sur la même caractéristique s'additionnent (effectiveChar).
  const sameSign = (b: number) => b >= 0 === effect.bonus >= 0;
  const idx = target.activeEffects.findIndex((e) => e.char === effect.char && effect.char != null && sameSign(e.bonus));
  if (idx >= 0) {
    const cur = target.activeEffects[idx].bonus;
    const better = effect.bonus >= 0 ? effect.bonus >= cur : effect.bonus <= cur;
    if (better) target.activeEffects[idx] = effect;
  } else {
    target.activeEffects.push(effect);
  }
  // Les Blessures dérivent de F/E/FM (LDB 85) → un buff de ces caractéristiques recale les PB max + courants.
  if (effect.char === 'F' || effect.char === 'E' || effect.char === 'FM') refreshWounds(target);
}

/** Rounds attribués à un buff dont la durée (minutes/heures/jours) dépasse le combat. */
export const COMBAT_PERSIST = 9999;

/**
 * Tire sur la table d'Incantation Imparfaite / Colère des dieux et applique au
 * LANCEUR les effets mécaniques modélisés (États, Blessures ignorant BE+PA,
 * réduction à 0 + Inconscient). Retourne les lignes de journal.
 */
export function applyMiscast(get: () => GameState, set: any, caster: Combatant, severity: MiscastSeverity, sinPoints = 0): string[] {
  const m = rollMiscast(severity, battleRng(), sinPoints);
  const lines = [m.log];
  for (const op of m.ops) {
    if (op.reduceToZero) {
      caster.wounds.current = 0;
      addCondition(caster, 'Inconscient');
      lines.push(`${caster.name} : Blessures réduites à 0 (Inconscient).`);
    } else if (op.wounds != null) {
      caster.wounds.current = Math.max(0, caster.wounds.current - op.wounds);
      lines.push(`${caster.name} subit ${op.wounds} Blessure(s) (ignorant BE et PA).`);
    } else if (op.condition) {
      addCondition(caster, op.condition.name, op.condition.value);
      lines.push(`${caster.name} reçoit ${op.condition.value} État ${op.condition.name}.`);
    }
  }
  // « Un jet = une modale » : le héros voit le dé de la table (Colère/Imparfaite) en révélation témoin.
  if (caster.kind === 'hero')
    pushReveal(set, { kind: 'miscast', title: severity === 'colere' ? 'Colère des dieux' : 'Incantation Imparfaite', dice: m.rolls[0], lines });
  return lines;
}

/** Incante un sort/prière sur une cible (résolution via src/engine/magic). */
/** Ouvre la modale d'incantation (jet différé, façon attaque) : pose `pendingCast` sans lancer. */
export function castSpell(
  get: () => GameState,
  set: any,
  caster: Combatant,
  target: Combatant,
  label: string,
) {
  const spell = findSpell(label);
  if (!spell) {
    get().log(`Sort « ${label} » introuvable.`);
    return;
  }
  const focusedNI0 = caster.focus?.spell === label && caster.focus.dr >= (spell.cn ?? 0);
  set({
    pendingCast: { casterId: caster.id, targetId: target.id, spellLabel: label, missile: isMagicMissile(spell), focused: focusedNI0, result: null },
  });
}

/** Applique un résultat d'incantation DÉJÀ obtenu (mute caster/cible, consomme l'Action). */
export function applyCast(
  get: () => GameState,
  set: any,
  caster: Combatant,
  target: Combatant,
  spell: NonNullable<ReturnType<typeof findSpell>>,
  res: CastResult & Partial<MissileResult>,
  missile: boolean,
  focusedNI0: boolean,
) {
  const battle = get().battle!;
  const logLines: string[] = [res.log];

  if (missile) {
    if (res.hit && res.woundsLost) {
      const currentBefore = target.wounds.current;
      const overkill = res.woundsLost - currentBefore;
      target.wounds.current = Math.max(0, currentBefore - res.woundsLost);
      if (res.isCritical || overkill > 0) {
        const lethal = applyCriticalToTarget(target, res.location ?? 'corps', !!res.isCritical, Math.max(0, overkill), logLines, set);
        if (lethal) finalizeHeroDeath(get, set, target, 'hit', currentBefore);
      } else if (target.wounds.current <= 0) {
        applyZeroWounds(target);
      }
    }
    // Maladresse d'un Sort → Incantation Imparfaite Mineure ; sort focalisé dont
    // l'incantation échoue → Imparfaite Mineure également (Livre de base l.183).
    if (res.isFumble) logLines.push(...applyMiscast(get, set, caster, 'mineure'));
    else if (focusedNI0 && !res.cast) logLines.push(...applyMiscast(get, set, caster, 'mineure'));
    // Sort offensif : lanceur vers la cible, cible vers le lanceur.
    if (caster.pos && target.pos && caster.id !== target.id) {
      set((s: GameState) => ({ facing: { ...s.facing, [caster.id]: facingToward(caster.pos!, target.pos!), [target.id]: facingToward(target.pos!, caster.pos!) } }));
    }
    bus.emit(EVT.ANIM_ATTACK, { from: caster.id, to: target.id, result: res, kind: 'spell', spell: spell.label, defense: 'none' });
    if (isOutOfAction(target)) logLines.push(`${target.name} est mis hors de combat !`);
  } else {
    if (res.cast) {
      const heal = parseHeal(spell.desc, caster);
      const buffs = parseCharBuffs(spell.desc);
      const condEff = parseConditionEffect(spell.desc);
      if (heal != null) {
        target.wounds.current = Math.min(target.wounds.max, target.wounds.current + heal);
        logLines.push(`${target.name} regagne ${heal} Blessure(s).`);
      } else if (buffs.length) {
        const rounds = buffDurationRounds(spell.duration, caster);
        // Durée hors-rounds (minutes/heures/jours) : elle dépasse l'échelle tactique
        // → l'effet persiste pour ce combat. On n'invente PAS un nombre de rounds.
        const roundsLeft = rounds ?? COMBAT_PERSIST;
        for (const b of buffs) {
          applyActiveEffect(target, { label: spell.label, char: b.char, bonus: b.bonus, roundsLeft });
        }
        const parts = buffs.map((b) => `${b.bonus >= 0 ? '+' : ''}${b.bonus} ${CHAR_LABELS[b.char]}`).join(', ');
        logLines.push(
          `${target.name} : ${spell.label} (${parts}, ${rounds != null ? rounds + ' rounds' : 'durée hors combat'}).`,
        );
      } else if (condEff) {
        if (condEff.op === 'remove') {
          const name = condEff.name ?? target.conditions[0]?.name;
          if (name) {
            removeCondition(target, name, condEff.value);
            logLines.push(`${target.name} retire ${condEff.value} État ${name}.`);
          } else {
            logLines.push(`${target.name} n'a aucun État à retirer.`);
          }
        } else {
          addCondition(target, condEff.name!, condEff.value);
          logLines.push(`${target.name} reçoit ${condEff.value} État ${condEff.name}.`);
        }
      }
      // Sinon : l'effet du sort est purement narratif (déjà journalisé).
    } else if (res.isFumble) {
      // Prière → Colère des dieux ; Sort → Incantation Imparfaite Mineure.
      logLines.push(...applyMiscast(get, set, caster, castInfoIsPrayer(spell.type) ? 'colere' : 'mineure'));
    } else if (focusedNI0) {
      // Sort focalisé dont l'incantation échoue (sans Maladresse) → Imparfaite Mineure.
      logLines.push(...applyMiscast(get, set, caster, 'mineure'));
    }
    // Sort de SOUTIEN (bénédiction/soin/buff) ou prière non-projectile : émet aussi l'event
    // d'incantation → geste de canalisation (RigToken) + halo/aura tinté à l'école (IsoStage).
    // Soutien : le lanceur se tourne vers la cible ; pas de réaction de la cible (ce n'est pas une frappe).
    if (caster.pos && target.pos && caster.id !== target.id) {
      set((s: GameState) => ({ facing: { ...s.facing, [caster.id]: facingToward(caster.pos!, target.pos!) } }));
    }
    bus.emit(EVT.ANIM_ATTACK, { from: caster.id, to: target.id, result: res, kind: 'spell', spell: spell.label, defense: 'none' });
  }

  // Le sort focalisé est consommé après le lancement.
  if (focusedNI0) caster.focus = undefined;
  set({ battle: { ...battle, acted: true, action: null, selectedSpell: null, log: [...battle.log, ...logLines] } });
  bus.emit(EVT.SCENE_DIRTY);
  checkBattleOver(get, set);
}

/** Renvoie vrai si le type de sort relève d'une Prière (Béni/Invocation). */
export function castInfoIsPrayer(type: string): boolean {
  return type === 'Béni' || type === 'Invocation';
}

/** Fin de combat : réécrit l'état persistant de chaque héros (Blessures, critiques, mort, États
 *  persistants) vers `party`. Idempotent ; les champs non persistants du membre party sont conservés. */
export function finalizeBattle(get: () => GameState, set: any): void {
  const { battle, party } = get();
  if (!battle) return;
  const newParty = party.map((h) => {
    const c = battle.combatants.find((x) => x.id === h.id && x.kind === 'hero');
    return c ? { ...h, ...carryOverState(c) } : h;
  });
  set({ party: newParty });
}

export function checkBattleOver(get: () => GameState, set: any): boolean {
  const battle = get().battle;
  if (!battle || battle.over) return true;
  const heroesAlive = battle.combatants.some((c) => c.kind === 'hero' && !isOutOfAction(c));
  const enemiesAlive = battle.combatants.some((c) => c.kind === 'enemy' && !isOutOfAction(c));
  if (!enemiesAlive) {
    finalizeBattle(get, set); // writeback AVANT onVictory (qui ajoute XP/butin au groupe)
    set({ battle: { ...get().battle!, over: 'victory', log: [...battle.log, 'Victoire !'] } });
    if (battle.onVictory) applyEffects(get, set, battle.onVictory);
    return true;
  }
  if (!heroesAlive) {
    finalizeBattle(get, set);
    set({ battle: { ...get().battle!, over: 'defeat', log: [...battle.log, 'Défaite…'] } });
    return true;
  }
  return false;
}

/** Reprend le tour de l'IA suspendu par la modale de défense (= ce qu'aurait fait
 *  attackThenAdvance juste après doAttack). No-op si le combat est terminé. */
export function resumeEnemyTurn(get: () => GameState, set: any): void {
  const b = get().battle;
  if (!b || b.over || get().pendingFateSave || get().pendingFumble || get().pendingDeviation || get().pendingReveals.length) return;
  setTimeout(() => advanceTurn(get, set), 500);
}

export function advanceTurn(get: () => GameState, set: any) {
  const battle = get().battle;
  if (!battle || battle.over || get().pendingFateSave || get().pendingFumble || get().pendingDeviation || get().pendingReveals.length) return;
  let turn = battle.turn;
  for (let i = 0; i < battle.order.length; i++) {
    turn += 1;
    if (turn >= battle.order.length) {
      // Franchissement de Round : upkeep (dégâts périodiques + 0 PB→Inconscient), puis la résolution
      // (morts lentes avec sauvetage par Destin) est déléguée à resolveRoundBoundary — résumable,
      // car elle peut suspendre (pendingFateSave / pendingRoundStart).
      const round = battle.round + 1;
      battle.log.push(`— Round ${round} —`);
      // Ordre du Round : on REPART de l'ordre canonique (baseOrder) — donc tout réordonnancement
      // (Maladresse « agir en dernier » Oups! 21-40, pré-emption Chance) ne dure qu'UN Round (l.22-25).
      const base = battle.baseOrder ?? battle.order;
      const lastIds = battle.combatants.filter((c) => c.actLastNextRound).map((c) => c.id);
      battle.order = [...base.filter((id) => !lastIds.includes(id)), ...base.filter((id) => lastIds.includes(id))];
      for (const c of battle.combatants) if (c.actLastNextRound) { c.actLastNextRound = false; battle.log.push(`${c.name} agira en dernier ce Round (Maladresse).`); }
      const roundLines: string[] = []; // entretien groupé en UNE révélation (pas une modale par tic)
      for (const c of battle.combatants) endOfRound(c, battleRng()).forEach((l) => { battle.log.push(l); roundLines.push(l); });
      for (const c of battle.combatants) refreshWounds(c); // dissipation d'un buff F/E/FM → recale les Blessures (LDB 85)
      for (const c of battle.combatants) tickDeath(c, battleRng()).forEach((l) => { battle.log.push(l); roundLines.push(l); }); // 0 PB→Inconscient (LDB 18 l.28)
      if (roundLines.length) pushReveal(set, { kind: 'round', title: `Fin du Round ${round - 1}`, lines: roundLines }); // « un jet = une modale » (entretien)
      set({ battle: { ...battle, turn: 0, round } });
      resolveRoundBoundary(get, set);
      return;
    }
    const next = battle.combatants.find((c) => c.id === battle.order[turn]);
    if (next && !isOutOfAction(next)) break;
  }
  // Tour suivant dans le MÊME Round. La posture « Sur la défensive » expire (LDB Combat l.118).
  const newActive = battle.combatants.find((c) => c.id === battle.order[turn]);
  let moved = false;
  let acted = false;
  if (newActive) {
    newActive.defensiveStance = false;
    // Maladresse (Oups! 61-80) : perte du Mouvement / de l'Action ce tour-ci.
    if (newActive.loseNextMovement) { moved = true; newActive.loseNextMovement = false; battle.log.push(`${newActive.name} perd son Mouvement (Maladresse).`); }
    if (newActive.loseNextAction) { acted = true; newActive.loseNextAction = false; battle.log.push(`${newActive.name} perd son Action (Maladresse).`); }
  }
  set({ battle: { ...battle, turn, action: null, moved, acted, reachable: new Map() } });
  if (checkBattleOver(get, set)) return;
  bus.emit(EVT.SCENE_DIRTY);
  maybeOpenHeroPsych(get, set); // Test de Calme du héros actif (Peur/Terreur, LDB 21) avant qu'il agisse
  maybeRunEnemyTurn(get, set);
}

/**
 * Fin de Round, RÉSUMABLE : (1) résout les morts lentes une par une — pour un héros à Destin,
 * suspend (pendingFateSave 'slow') ; (2) finalise les morts restantes ; (3) décrément d'Avantage
 * + Engagement (une seule fois, après toutes les morts) ; (4) pré-emption d'initiative (Chance,
 * 3e usage) sinon sélection de l'acteur + IA. Rappelée par fate* après résolution d'une mort lente.
 */
export function resolveRoundBoundary(get: () => GameState, set: any): void {
  const battle = get().battle;
  if (!battle || battle.over) return;
  // (1) Un héros mourant à Destin non résolu → suspend (LDB ch.17 l.31-35).
  const dying = battle.combatants.find((c) => c.kind === 'hero' && (c.fate ?? 0) > 0 && inDeathCondition(c));
  if (dying) {
    set({ pendingFateSave: { heroId: dying.id, source: 'slow' } });
    return;
  }
  // (2) Finaliser les morts lentes restantes (héros sans Destin).
  for (const c of battle.combatants) if (inDeathCondition(c)) c.dead = true;
  // (3) Avantage : -1 si aucun gagné ce Round (LDB Dépl. l.40) ; Engagé périmé (LDB 13-Combat l.175).
  for (const c of battle.combatants) {
    if (!isOutOfAction(c) && c.advantage > 0 && !c.gainedAdvThisRound) c.advantage -= 1;
    c.gainedAdvThisRound = false;
  }
  decayEngagement(battle.combatants);
  // (4) Pré-emption d'initiative (Chance, 3e usage, LDB ch.17 l.27) sinon sélection de l'acteur.
  const enemiesAlive = battle.combatants.some((c) => c.kind === 'enemy' && !isOutOfAction(c));
  const heroCanPreempt = battle.combatants.some((c) => c.kind === 'hero' && !isOutOfAction(c) && (c.fortune ?? 0) > 0);
  if (enemiesAlive && heroCanPreempt) {
    set({ battle: { ...battle, action: null, moved: false, acted: false, reachable: new Map() }, pendingRoundStart: { round: battle.round } });
    return;
  }
  let turn = 0;
  for (let i = 0; i < battle.order.length; i++) {
    const c = battle.combatants.find((x) => x.id === battle.order[i]);
    if (c && !isOutOfAction(c)) {
      turn = i;
      break;
    }
  }
  const active = battle.combatants.find((c) => c.id === battle.order[turn]);
  if (active) active.defensiveStance = false;
  set({ battle: { ...battle, turn, action: null, moved: false, acted: false, reachable: new Map() } });
  if (checkBattleOver(get, set)) return;
  bus.emit(EVT.SCENE_DIRTY);
  maybeOpenHeroPsych(get, set); // Test de Calme du héros actif (Peur/Terreur, LDB 21) avant qu'il agisse
  maybeRunEnemyTurn(get, set);
}

/** IA simple : si le combattant actif est un ennemi, il agit puis passe la main. */
export function maybeRunEnemyTurn(get: () => GameState, set: any) {
  const battle = get().battle;
  if (!battle || battle.over || get().pendingFateSave || get().pendingFumble || get().pendingDeviation || get().pendingReveals.length) return;
  const active = activeCombatant(battle);
  if (!active || active.kind !== 'enemy' || isOutOfAction(active)) return;
  setTimeout(() => runEnemyAI(get, set, active.id), 450);
}

/** Psychologie d'un ENNEMI (IA) au début de son tour (LDB 21) : teste Peur/Terreur des sources
 *  adverses en Ligne de Vue. Terreur ratée → Brisé ; Peur → Test étendu de Calme (cumul). Instantané
 *  et JOURNALISÉ (pas de modale/révélation pour l'IA — le joueur voit l'État Brisé). */
export function resolvePsychAI(get: () => GameState, set: any, enemy: Combatant): void {
  if (enemy.kind !== 'enemy' || enemy.psychImmune || enemy.frenzied || isOutOfAction(enemy)) return; // Frénésie = immunité psy (LDB 21 l.34)
  const battle = get().battle;
  const scene = get().scene;
  if (!battle || !scene || !enemy.pos) return;
  enemy.psychState ??= [];
  const log: string[] = [];
  // Nouvelles sources de peur/terreur en Ligne de Vue (non encore rencontrées).
  for (const foe of battle.combatants) {
    if (foe.kind === enemy.kind || isOutOfAction(foe) || !foe.pos) continue;
    if (lineOfSightCover(scene, enemy.pos, foe.pos, []).blocked) continue;
    const src = fearSourceFor(enemy, foe);
    if (!src || enemy.psychState.some((p) => p.sourceId === foe.id)) continue;
    if (src.kind === 'terreur') {
      const r = resolveTerreurTest(calmeValue(enemy), src.indice, battleRng());
      if (!r.success) {
        addCondition(enemy, 'Brisé', r.brise);
        log.push(`${enemy.name} est terrifié par ${foe.name} : ${r.brise} Brisé.`);
      }
      enemy.psychState.push({ type: 'peur', sourceId: foe.id, indice: r.success ? 0 : r.devientPeur, calmeDR: 0, lastTestRound: battle.round }); // Terreur → Peur
    } else {
      enemy.psychState.push({ type: 'peur', sourceId: foe.id, indice: src.indice, calmeDR: 0, lastTestRound: battle.round });
      log.push(`${enemy.name} a peur de ${foe.name}.`);
    }
  }
  // Test ÉTENDU de Calme des Peur actives (calmeDR < indice) — UNE fois par Round.
  for (const p of enemy.psychState) {
    if (p.type !== 'peur' || (p.calmeDR ?? 0) >= (p.indice ?? 0) || p.lastTestRound === battle.round) continue;
    const r = resolvePeurTest(calmeValue(enemy), p.indice ?? 1, p.calmeDR ?? 0, battleRng());
    p.calmeDR = r.calmeDR;
    p.lastTestRound = battle.round;
    if (r.vaincue) log.push(`${enemy.name} surmonte sa peur.`);
  }
  if (log.length) set({ battle: { ...get().battle!, log: [...get().battle!.log, ...log] } });
}

/** Premier Test de Psychologie DÛ pour un combattant (héros) ce Round : nouvelle source de Peur/Terreur
 *  en Ligne de Vue, ou Peur active non encore testée ce Round. Pur de lecture (ne mute pas). */
export function collectHeroPsych(get: () => GameState, c: Combatant): { kind: 'peur' | 'terreur'; sourceId: string; indice: number; prevDR: number } | null {
  const battle = get().battle;
  const scene = get().scene;
  if (!battle || !scene || !c.pos || c.psychImmune || c.frenzied) return null; // Frénésie = immunité psy
  const state = c.psychState ?? [];
  for (const foe of battle.combatants) {
    if (foe.kind === c.kind || isOutOfAction(foe) || !foe.pos) continue;
    if (lineOfSightCover(scene, c.pos, foe.pos, []).blocked) continue;
    const src = fearSourceFor(c, foe);
    if (!src || state.some((p) => p.sourceId === foe.id)) continue;
    return { kind: src.kind, sourceId: foe.id, indice: src.indice, prevDR: 0 }; // nouvelle source
  }
  for (const p of state) {
    if (p.type === 'peur' && (p.calmeDR ?? 0) < (p.indice ?? 0) && p.lastTestRound !== battle.round)
      return { kind: 'peur', sourceId: p.sourceId!, indice: p.indice ?? 1, prevDR: p.calmeDR ?? 0 }; // Peur active à re-tester
  }
  return null;
}

/** Ouvre la modale de Test de Calme/Psychologie si le combattant ACTIF est un héros qui doit tester
 *  (LDB 21). No-op si une autre modale/révélation est en cours. */
export function maybeOpenHeroPsych(get: () => GameState, set: any): void {
  const battle = get().battle;
  if (!battle || battle.over || get().pendingPsych || get().pendingReveals.length || get().pendingFateSave || get().pendingFumble) return;
  const active = activeCombatant(battle);
  if (!active || active.kind !== 'hero' || isOutOfAction(active)) return;
  endFrenzyIfDone(get, set, active); // une Frénésie finie (plus d'ennemi / Sonné) sort le héros (Exténué) avant tout test
  const t = collectHeroPsych(get, active);
  if (t) set({ pendingPsych: { combatantId: active.id, kind: t.kind, sourceId: t.sourceId, indice: t.indice, prevDR: t.prevDR, result: null } });
}

/** Fin de Frénésie (LDB 21 l.36) : si plus aucun adversaire vivant en Ligne de Vue, ou si Sonné /
 *  Inconscient → quitte la Frénésie et gagne **Exténué**. À appeler au début du tour du combattant. */
export function endFrenzyIfDone(get: () => GameState, set: any, c: Combatant): void {
  if (!c.frenzied) return;
  const battle = get().battle;
  const scene = get().scene;
  if (!battle || !scene || !c.pos) return;
  const stunned = c.conditions.some((x) => x.name === 'Sonné' || x.name === 'Inconscient');
  const foeInLoS = battle.combatants.some(
    (f) => f.kind !== c.kind && !isOutOfAction(f) && f.pos && !lineOfSightCover(scene, c.pos!, f.pos, []).blocked,
  );
  if (stunned || !foeInLoS) {
    c.frenzied = false;
    addCondition(c, 'Exténué');
    set({ battle: { ...get().battle!, log: [...get().battle!.log, `${c.name} sort de Frénésie (Exténué).`] } });
  }
}

/** L'IA tente d'entrer en Frénésie au début de son tour (LDB 21 l.32) : combattant capable, pas déjà
 *  frenzied ni immunisé à la Psychologie, avec un adversaire vivant en Ligne de Vue → Test de Force
 *  Mentale ; sur un succès, il entre en Frénésie (gérée ensuite par les drapeaux). Instantané, journalisé. */
export function aiMaybeFrenzy(get: () => GameState, set: any, enemy: Combatant): void {
  if (enemy.kind !== 'enemy' || enemy.frenzied || enemy.psychImmune || isOutOfAction(enemy) || !isFrenzyCapable(enemy)) return;
  const battle = get().battle;
  const scene = get().scene;
  if (!battle || !scene || !enemy.pos) return;
  const foeInLoS = battle.combatants.some(
    (f) => f.kind !== enemy.kind && !isOutOfAction(f) && f.pos && !lineOfSightCover(scene, enemy.pos!, f.pos, []).blocked,
  );
  if (!foeInLoS) return;
  if (resolveFrenzyEntry(effectiveChar(enemy, 'FM'), battleRng()).success) {
    enemy.frenzied = true;
    set({ battle: { ...get().battle!, log: [...get().battle!.log, `${enemy.name} entre en Frénésie !`] } });
  }
}

export function runEnemyAI(get: () => GameState, set: any, enemyId: string) {
  const { battle, scene } = get();
  if (!battle || !scene || battle.over) return;
  const enemy = battle.combatants.find((c) => c.id === enemyId);
  if (!enemy || isOutOfAction(enemy)) return advanceTurn(get, set);
  endFrenzyIfDone(get, set, enemy); // Frénésie finie → Exténué, avant de tester la psychologie
  aiMaybeFrenzy(get, set, enemy); // l'IA tente d'entrer en Frénésie (LDB 21 l.32) AVANT le test psy (la Frénésie en rend immunisé) et le choix de cible
  resolvePsychAI(get, set, enemy); // Peur/Terreur de l'IA au début de son tour (instantané, journalisé)

  const heroes = battle.combatants.filter((c) => c.kind === 'hero' && !isOutOfAction(c));
  if (heroes.length === 0) {
    checkBattleOver(get, set);
    return;
  }

  const blocked = occupied(battle, enemy.id);
  // Premier Projectile magique connu et prêt : la détection a besoin des données
  // de sort, donc elle reste ici (couche impure), pas dans la décision pure (ai.ts).
  const offensiveSpell = enemy.spells?.find((label) => {
    const sp = findSpell(label);
    return !!sp && isMagicMissile(sp);
  });
  const action = chooseEnemyAction({
    enemy,
    heroes,
    scene,
    blocked,
    movement: effectiveMovement(enemy),
    offensiveSpell,
  });
  const targetOf = (id: string) => battle.combatants.find((c) => c.id === id)!;
  const canAct = canTakeAction(enemy); // Sonné : pas d'Action — déplacement seul (LDB États l.123)

  // Attaque (mêlée ou tir, selon l'arme active) puis fin de tour — cadence préservée.
  const attackThenAdvance = (target: Combatant) => {
    setTimeout(() => {
      const b = get().battle;
      if (!b || b.over) return;
      const suspended = doAttack(get, set, enemy, target);
      // Si la modale de défense s'ouvre, ne PAS armer advanceTurn ici : la reprise
      // est portée par defenseConfirm/defenseCancel → resumeEnemyTurn (anti double-advance).
      if (!suspended) {
        aiFrenzyAttack(get, set, enemy); // Frénésie : Test de CC gratuit après l'attaque principale (instantané, LDB 21 l.34)
        // Attaques gratuites de créature (Morsure/Caudale/Piétinement, OPPOSÉES) après l'attaque
        // principale ; si une modale de défense s'ouvre, ne PAS avancer (reprise via defenseConfirm).
        if (!aiCreatureFreeAttacks(get, set, enemy)) setTimeout(() => advanceTurn(get, set), 500);
      }
    }, 350);
  };

  // Sonné : l'ennemi ne peut pas agir → il renonce à son Action (l'éventuel déplacement
  // a déjà été réduit de moitié via effectiveMovement). Le « move » plus bas garde son
  // déplacement mais n'attaque pas en arrivant.
  switch (action.kind) {
    case 'end':
      return advanceTurn(get, set);
    case 'cast':
      if (!canAct) return advanceTurn(get, set);
      castSpell(get, set, enemy, targetOf(action.targetId), action.spell);
      setTimeout(() => advanceTurn(get, set), 500);
      return;
    case 'shoot':
    case 'melee':
      if (!canAct) return advanceTurn(get, set);
      attackThenAdvance(targetOf(action.targetId));
      return;
    case 'move': {
      // Simplifications IA assumées (sévérité mineure, relevées par la revue de fidélité) :
      //  • l'IA ne fait JAMAIS de Désengagement (option joueur, LDB 15-Dépl l.84-89) : un
      //    ennemi Engagé qui se repositionne ne paie pas l'Esquive/le sacrifice d'Avantage.
      //  • l'IA charge dans la portée de MARCHE (chooseEnemyAction borne le déplacement à M),
      //    pas la portée de Course (2M) ouverte au héros — l'IA charge donc moins loin.
      const wasEngaged = isEngaged(enemy);
      const distBefore = chebyshev(enemy.pos!, targetOf(action.thenTargetId).pos!); // distance de combat AVANT le déplacement
      const path = pathTo(scene, enemy.pos!, action.to, blocked);
      enemy.pos = action.to;
      get().faceFromPath(enemy.id, path);
      bus.emit(EVT.ANIM_MOVE, { id: enemy.id, path });
      set({ battle: { ...battle } });
      bus.emit(EVT.SCENE_DIRTY);
      const tgt = targetOf(action.thenTargetId);
      if (canAct && chebyshev(enemy.pos!, tgt.pos!) <= 1) {
        // Charge de l'IA : se ruer au contact depuis une position non-Engagée donne l'Avantage (LDB 15-Dépl l.74-77).
        if (!wasEngaged) {
          const adv = chargeAdvantage(effectiveMovement(enemy), distBefore);
          if (adv) {
            enemy.advantage += adv;
            enemy.gainedAdvThisRound = true;
          }
        }
        attackThenAdvance(tgt);
      } else setTimeout(() => advanceTurn(get, set), 350);
      return;
    }
  }
}


/**
 * Flux de combat (tour par tour) extrait de store.ts pour le garder navigable.
 * Fonctions (get,set) : combat, magie, IA, desengagement, effets. RNG via ./battleRng.
 * Refacto pure -- comportement preserve.
 */
import type { GameState, BattleState } from './store';
import { Combatant, ItemInstance, ActiveEffect, CHAR_LABELS, HitLocation, Weapon, DIFFICULTY_MODIFIERS } from '../engine/types';
import { battleRng } from './battleRng';
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
  AttackResult,
} from '../engine/combat';
import { engage, isEngaged, decayEngagement, chargeAdvantage } from '../engine/engagement';
import {
  resolveFocus,
  isMagicMissile,
  isArcaneSpell,
  parseHeal,
  parseConditionEffect,
  parseCharBuffs,
  buffDurationRounds,
  type CastResult,
  type MissileResult,
} from '../engine/magic';
import { rollMiscast, type MiscastSeverity } from '../engine/miscast';
import { opposedTest } from '../engine/tests';
import { effectiveChar, bonus } from '../engine/characteristics';
import { partyBest } from '../engine/skills';
import { recomputeLoadout, itemFromTrapping, weaponWithAmmo, compatibleAmmo } from '../engine/items';
import { effectiveMovement } from '../engine/encumbrance';
import { isOutOfAction, endOfRound, addCondition, removeCondition, cannotDefend, canTakeAction, applyZeroWounds, tickDeath, usesSuddenDeath, inDeathCondition } from '../engine/conditions';
import { carryOverState } from '../engine/persistence';
import { rollCritical, critLocationRoll } from '../engine/critical';
import { isFumble, rollOups, type OupsResolved } from '../engine/oups';
import { traumaFromKind } from '../engine/trauma';
import { effectiveWeaponDamage, damageWeapon, destroyWeapon, isImprovised } from '../engine/weaponDamage';
import { findSpell } from '../data/index';
import { Scene, Effect, isWalkable } from './scene';
import { reachable, pathTo, chebyshev, Pt } from './path';
import { chooseEnemyAction } from './ai';
import { bus, EVT } from './bus';


// ---------------------------------------------------------------------------
// Helpers internes
// ---------------------------------------------------------------------------

export function activeCombatant(battle: BattleState): Combatant | undefined {
  return battle.combatants.find((c) => c.id === battle.order[battle.turn]);
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
export function resolveAttack(attacker: Combatant, target: Combatant, location?: HitLocation): { res: AttackResult; weapon: Weapon } | null {
  const adj = chebyshev(attacker.pos!, target.pos!) <= 1;
  const weapon = firedWeapon(attacker, target); // arme + munition combinées (héros distance)
  if (!adj && weapon.type === 'melee') return null; // arme de mêlée hors de portée
  const res =
    weapon.type === 'ranged'
      ? resolveRanged(attacker, target, weapon, battleRng(), chebyshev(attacker.pos!, target.pos!), location)
      : resolveMelee(attacker, target, weapon, battleRng(), { defense: bestDefenseMode(target), location });
  return { res, weapon };
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
  if (!foes.length) {
    // Lien d'Engagement périmé (foe mort/parti) : rouvrir simplement le déplacement normal.
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
  if (crit.traumas.length) {
    target.traumas = [...(target.traumas ?? []), ...crit.traumas];
    for (const t of crit.traumas) log.push(`  ↳ ${t.label} (${t.location}).`);
  }
  if (crit.lethal) return true; // « Mort » instantané — finalisé par le caller (sauvetage par Destin possible)
  target.wounds.current = Math.max(0, target.wounds.current - crit.woundsLoss); // ignore BE+PA, plancher 0
  for (const c of crit.conditions) addCondition(target, c.name, c.value);
  if (crit.note) log.push(`  ↳ ${crit.note}`); // effet long terme journalisé, non simulé
  return false;
}

export function applyAttackResult(
  get: () => GameState,
  set: any,
  attacker: Combatant,
  target: Combatant,
  weapon: Weapon,
  res: AttackResult,
): void {
  const battle = get().battle!;
  attacker.aiming = false; // l'attaque consomme la visée (tir : +20 déjà appliqué ; mêlée : visée gâchée)
  if (attacker.nextActionPenalty) attacker.nextActionPenalty = undefined; // pénalité de Maladresse consommée par ce Test

  if (weapon.type === 'melee') engage(attacker, target); // Engagé symétrique sur toute attaque de mêlée (LDB 13-Combat l.174-175)
  const critLog: string[] = [];
  if (res.hit && res.woundsLost) {
    const currentBefore = target.wounds.current;
    const overkill = res.woundsLost - currentBefore; // > 0 si le coup dépasse les PB COURANTS (LDB 18 l.30)
    target.wounds.current = Math.max(0, currentBefore - res.woundsLost);
    if (res.critical || overkill > 0) {
      const lethal = applyCriticalToTarget(target, res.location ?? 'corps', !!res.critical, Math.max(0, overkill), critLog);
      if (lethal) finalizeHeroDeath(get, set, target, 'hit', currentBefore); // mort directe ou pause Destin
    } else if (target.wounds.current <= 0) {
      applyZeroWounds(target); // 0 PB sans critique → À Terre (LDB 18 l.28)
    }
  }
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
  // Atout Assommante : une touche à la Tête → Test opposé Force/Résistance ; si
  // l'attaquant l'emporte, la cible gagne un État Sonné (LDB Les armes l.268).
  let assommanteLog: string | null = null;
  if (res.hit && res.location === 'tete' && weapon.qualities.some((q) => q.toLowerCase().startsWith('assommante'))) {
    const resist = effectiveChar(target, 'E') + (target.skills.find((s) => s.name.toLowerCase().startsWith('résistance'))?.advances ?? 0);
    if (opposedTest(effectiveChar(attacker, 'F'), resist, battleRng()).winner === 'attacker') {
      addCondition(target, 'Sonné');
      assommanteLog = `${target.name} est Sonné (Assommante).`;
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
  bus.emit(EVT.ANIM_ATTACK, { from: attacker.id, to: target.id, result: res, kind, defense });
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
  if (it) {
    if (it.qualities.some((q) => /incassable/i.test(q))) return;
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
export function maybeOpenDefense(set: any, attacker: Combatant, target: Combatant): boolean {
  const weapon = attacker.weapons[0];
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
    },
  });
  return true;
}

/** Attaque de l'IA : ouvre la modale de défense (→ true, tour SUSPENDU) si la cible
 *  est un héros qui peut se défendre en mêlée ; sinon résout instantanément (→ false). */
export function doAttack(get: () => GameState, set: any, attacker: Combatant, target: Combatant): boolean {
  if (maybeOpenDefense(set, attacker, target)) return true; // suspendu : reprise via defenseConfirm/Cancel
  applySonneMeleeAdvantage(attacker, target); // +1 Avantage si cible Sonnée (LDB États l.123), avant le jet
  const r = resolveAttack(attacker, target);
  if (!r) {
    get().log('Cible hors de portée de mêlée.');
    return false;
  }
  applyAttackResult(get, set, attacker, target, r.weapon, r.res);
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
}

/** Rounds attribués à un buff dont la durée (minutes/heures/jours) dépasse le combat. */
export const COMBAT_PERSIST = 9999;

/**
 * Tire sur la table d'Incantation Imparfaite / Colère des dieux et applique au
 * LANCEUR les effets mécaniques modélisés (États, Blessures ignorant BE+PA,
 * réduction à 0 + Inconscient). Retourne les lignes de journal.
 */
export function applyMiscast(caster: Combatant, severity: MiscastSeverity, sinPoints = 0): string[] {
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
        const lethal = applyCriticalToTarget(target, res.location ?? 'corps', !!res.isCritical, Math.max(0, overkill), logLines);
        if (lethal) finalizeHeroDeath(get, set, target, 'hit', currentBefore);
      } else if (target.wounds.current <= 0) {
        applyZeroWounds(target);
      }
    }
    // Maladresse d'un Sort → Incantation Imparfaite Mineure ; sort focalisé dont
    // l'incantation échoue → Imparfaite Mineure également (Livre de base l.183).
    if (res.isFumble) logLines.push(...applyMiscast(caster, 'mineure'));
    else if (focusedNI0 && !res.cast) logLines.push(...applyMiscast(caster, 'mineure'));
    bus.emit(EVT.ANIM_ATTACK, { from: caster.id, to: target.id, result: res, kind: 'spell', defense: 'none' });
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
      logLines.push(...applyMiscast(caster, castInfoIsPrayer(spell.type) ? 'colere' : 'mineure'));
    } else if (focusedNI0) {
      // Sort focalisé dont l'incantation échoue (sans Maladresse) → Imparfaite Mineure.
      logLines.push(...applyMiscast(caster, 'mineure'));
    }
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

/** Focalise un sort d'Arcane/Domaine : cumule le DR jusqu'à atteindre le NI. */
export function focusSpell(get: () => GameState, set: any, caster: Combatant, label: string) {
  const battle = get().battle!;
  const spell = findSpell(label);
  if (!spell || !isArcaneSpell(spell)) {
    get().log('Ce sort ne peut pas être focalisé.');
    return;
  }
  const res = resolveFocus(caster, spell, battleRng());
  const prev = caster.focus?.spell === label ? caster.focus.dr : 0;
  caster.focus = { spell: label, dr: prev + res.dr };
  const logLines = [res.log];
  const ni = spell.cn ?? 0;
  if (caster.focus.dr >= ni) {
    logLines.push(`${caster.name} a focalisé assez de magie pour lancer ${spell.label} (NI 0).`);
  } else {
    logLines.push(`Focalisation : ${caster.focus.dr}/${ni} DR.`);
  }
  // Maladresse en Focalisation → Incantation Imparfaite Majeure (Livre de base l.191).
  if (res.isFumble) logLines.push(...applyMiscast(caster, 'majeure'));
  set({ battle: { ...battle, acted: true, action: null, selectedSpell: null, log: [...battle.log, ...logLines] } });
  bus.emit(EVT.SCENE_DIRTY);
  checkBattleOver(get, set);
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
  if (!b || b.over || get().pendingFateSave || get().pendingFumble) return;
  setTimeout(() => advanceTurn(get, set), 500);
}

export function advanceTurn(get: () => GameState, set: any) {
  const battle = get().battle;
  if (!battle || battle.over || get().pendingFateSave || get().pendingFumble) return;
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
      for (const c of battle.combatants) endOfRound(c, battleRng()).forEach((l) => battle.log.push(l));
      for (const c of battle.combatants) tickDeath(c, battleRng()).forEach((l) => battle.log.push(l)); // 0 PB→Inconscient (LDB 18 l.28)
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
  maybeRunEnemyTurn(get, set);
}

/** IA simple : si le combattant actif est un ennemi, il agit puis passe la main. */
export function maybeRunEnemyTurn(get: () => GameState, set: any) {
  const battle = get().battle;
  if (!battle || battle.over || get().pendingFateSave || get().pendingFumble) return;
  const active = activeCombatant(battle);
  if (!active || active.kind !== 'enemy' || isOutOfAction(active)) return;
  setTimeout(() => runEnemyAI(get, set, active.id), 450);
}

export function runEnemyAI(get: () => GameState, set: any, enemyId: string) {
  const { battle, scene } = get();
  if (!battle || !scene || battle.over) return;
  const enemy = battle.combatants.find((c) => c.id === enemyId);
  if (!enemy || isOutOfAction(enemy)) return advanceTurn(get, set);

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
      if (!suspended) setTimeout(() => advanceTurn(get, set), 500);
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


/**
 * Store central (Zustand) — relie l'UI React et le rendu (SVG iso).
 * Gère les écrans, le groupe, l'exploration de scène, les dialogues et le
 * combat tactique au tour par tour (règles via src/engine).
 */
import { create } from 'zustand';
import { Combatant, ActiveEffect, CHAR_LABELS } from '../engine/types';
import { makeRNG, RNG } from '../engine/dice';
import { resolveMelee, resolveRanged, initiativeOrder, defenseValue } from '../engine/combat';
import {
  resolveMagicMissile,
  resolveCasting,
  resolveFocus,
  isMagicMissile,
  isArcaneSpell,
  parseHeal,
  parseConditionEffect,
  parseCharBuffs,
  buffDurationRounds,
} from '../engine/magic';
import { rollMiscast, type MiscastSeverity } from '../engine/miscast';
import { rollTest, TestResult } from '../engine/tests';
import { partyBest } from '../engine/skills';
import { recomputeLoadout } from '../engine/items';
import { effectiveMovement } from '../engine/encumbrance';
import { isOutOfAction, endOfRound, addCondition, removeCondition } from '../engine/conditions';
import { findSpell } from '../data/index';
import { Scene, Dialogue, Effect, isWalkable } from './scene';
import { doorAt } from './buildings';
import { spawnEnemy } from './spawn';
import { reachable, pathTo, manhattan, Pt } from './path';
import { chooseEnemyAction } from './ai';
import { bus, EVT } from './bus';
import { campaign } from '../scenes/campaign';

export type Screen = 'menu' | 'party' | 'creator' | 'campaign' | 'editor';

/** Registre des scènes (pour les transitions de campagne). */
const sceneRegistry: Record<string, Scene> = {};
for (const c of campaign) sceneRegistry[c.scene.id] = c.scene;
function registerScene(s: Scene) {
  sceneRegistry[s.id] = s;
}

export interface Money {
  gold: number;
  silver: number;
  brass: number;
}
/** Test de compétence interactif en attente d'acquittement par le joueur. */
export interface PendingTest {
  actorName: string;
  label: string;
  roll: number;
  target: number;
  success: boolean;
  sl: number;
  onSuccess?: Effect[];
  onFailure?: Effect[];
}

export interface BattleState {
  combatants: Combatant[];
  order: string[];
  turn: number;
  round: number;
  action: 'move' | 'attack' | 'cast' | 'focus' | null;
  /** Sort sélectionné pour l'action d'incantation en cours. */
  selectedSpell: string | null;
  reachable: Map<string, number>;
  moved: boolean;
  acted: boolean;
  log: string[];
  over: null | 'victory' | 'defeat';
  onVictory?: Effect[];
}

interface GameState {
  screen: Screen;
  party: Combatant[];
  scene: Scene | null;
  mode: 'exploration' | 'battle';
  partyPos: Pt;
  flags: Record<string, boolean>;
  journal: string[];
  dialogue: { dialogue: Dialogue; nodeId: string } | null;
  battle: BattleState | null;
  campaignSceneId: string | null;
  inventory: string[];
  money: Money;
  pendingTest: PendingTest | null;
  document: { title: string; text: string } | null;
  /** Scène d'où l'on vient (pour `transitionBack` : sortie d'intérieur). */
  previousScene: { id: string; pos: Pt } | null;

  setScreen: (s: Screen) => void;
  setParty: (p: Combatant[]) => void;
  toggleEquip: (heroId: string, uid: string) => void;
  startScene: (scene: Scene) => void;
  /** Enregistre plusieurs scènes (projet multi-scènes) puis démarre l'entrée. */
  loadProject: (scenes: Scene[], entryId: string) => void;
  transitionTo: (sceneId: string, entry?: string, pos?: Pt) => void;
  moveParty: (pt: Pt) => void;
  interactEntity: (entityId: string) => void;
  chooseDialogue: (choiceIndex: number) => void;
  closeDialogue: () => void;
  resolveTest: () => void;
  closeDocument: () => void;

  /** Réensemence le RNG de combat (déterminisme des tests + future coop réseau). */
  seedRng: (seed: number) => void;
  startCombat: (encounterId: string, onVictory?: Effect[]) => void;
  battleSelectAction: (a: 'move' | 'attack' | 'cast' | 'focus' | null) => void;
  battleSelectSpell: (label: string) => void;
  battleFocusSpell: (label: string) => void;
  battleClickTile: (pt: Pt) => void;
  battleClickEntity: (id: string) => void;
  battleEndTurn: () => void;
  log: (msg: string) => void;
}

let battleRng: RNG = makeRNG(Date.now() & 0xffff);

export const useGame = create<GameState>((set, get) => ({
  screen: 'menu',
  party: [],
  scene: null,
  mode: 'exploration',
  partyPos: { x: 0, y: 0 },
  flags: {},
  journal: [],
  dialogue: null,
  battle: null,
  campaignSceneId: null,
  inventory: [],
  money: { gold: 0, silver: 0, brass: 0 },
  pendingTest: null,
  document: null,
  previousScene: null,

  setScreen: (s) => set({ screen: s }),

  /** Équipe/déséquipe un objet d'un héros et recalcule ses armes/armure actives. */
  toggleEquip: (heroId, uid) =>
    set((s) => ({
      party: s.party.map((h) => {
        if (h.id !== heroId) return h;
        const clone: Combatant = JSON.parse(JSON.stringify(h));
        const it = (clone.items ?? []).find((i) => i.uid === uid);
        if (it) {
          it.equipped = !it.equipped;
          recomputeLoadout(clone);
        }
        return clone;
      }),
    })),
  setParty: (p) => set({ party: p }),

  startScene: (scene) => {
    registerScene(scene);
    const start = scene.entities.find((e) => e.kind === 'heroStart');
    const pos = start ? { ...start.pos } : findFreeTile(scene);
    // Démarrage d'une partie : on repart d'un état de campagne neuf.
    set({
      scene: JSON.parse(JSON.stringify(scene)),
      mode: 'exploration',
      partyPos: pos,
      flags: { ...scene.flags },
      dialogue: null,
      battle: null,
      pendingTest: null,
      document: null,
      inventory: [],
      money: { gold: 0, silver: 5, brass: 0 },
      campaignSceneId: scene.id,
      journal: scene.startMessage ? [scene.startMessage] : [],
    });
    bus.emit(EVT.SCENE_DIRTY);
  },

  loadProject: (scenes, entryId) => {
    // Enregistre toutes les scènes du projet (pour que les portes reveal:'door'
    // résolvent leurs intérieurs), puis démarre la scène d'entrée.
    for (const s of scenes) registerScene(s);
    const entry = scenes.find((s) => s.id === entryId) ?? scenes[0];
    if (entry) get().startScene(entry);
  },

  /** Transition vers une autre scène (conserve groupe, flags, inventaire, argent).
   *  `pos` force la case d'arrivée (utilisé par `transitionBack`). */
  transitionTo: (sceneId, entry, pos) => {
    const target = sceneRegistry[sceneId];
    if (!target) {
      get().log(`(Scène « ${sceneId} » introuvable — transition ignorée.)`);
      return;
    }
    const start =
      pos ||
      (entry && target.entryPoints?.[entry]) ||
      target.entities.find((e) => e.kind === 'heroStart')?.pos ||
      findFreeTile(target);
    set((s) => ({
      scene: JSON.parse(JSON.stringify(target)),
      mode: 'exploration',
      partyPos: { ...start },
      // flags persistants : on conserve l'état narratif et on ajoute les
      // valeurs par défaut de la nouvelle scène pour les clés absentes.
      flags: { ...target.flags, ...s.flags },
      dialogue: null,
      battle: null,
      pendingTest: null,
      document: null,
      campaignSceneId: target.id,
      journal: target.startMessage ? [...s.journal.slice(-40), target.startMessage] : s.journal,
    }));
    bus.emit(EVT.SCENE_DIRTY);
  },

  moveParty: (pt) => {
    const { scene, mode, partyPos } = get();
    if (!scene || mode !== 'exploration') return;
    if (!isWalkable(scene, pt.x, pt.y)) return;
    const from = partyPos; // case quittée (sert de retour hors du bâtiment)
    set({ partyPos: pt });
    bus.emit(EVT.SCENE_DIRTY);
    const door = doorAt(scene, pt.x, pt.y);
    if (door && door.reveal === 'door' && door.interiorScene) {
      set({ previousScene: { id: scene.id, pos: from } });
      get().transitionTo(door.interiorScene, door.entry);
      return;
    }
    checkTriggers(get, set);
  },

  interactEntity: (entityId) => {
    const { scene, partyPos } = get();
    if (!scene) return;
    const ent = scene.entities.find((e) => e.id === entityId);
    if (!ent) return;
    if (manhattan(partyPos, ent.pos) > 1) {
      get().log('Trop loin pour interagir.');
      return;
    }
    if (ent.dialogueId) {
      const dlg = scene.dialogues.find((d) => d.id === ent.dialogueId);
      if (dlg) set({ dialogue: { dialogue: dlg, nodeId: dlg.start } });
    } else if (ent.kind === 'objet') {
      const loot = ent.loot ?? [];
      if (loot.length) set((s) => ({ inventory: [...s.inventory, ...loot] }));
      get().log(`Vous récupérez : ${loot.join(', ') || ent.label || 'un objet'}.`);
      removeEntity(get, set, entityId);
    }
  },

  chooseDialogue: (choiceIndex) => {
    const st = get();
    if (!st.dialogue) return;
    const node = st.dialogue.dialogue.nodes.find((n) => n.id === st.dialogue!.nodeId);
    const choice = node?.choices[choiceIndex];
    if (!choice) return;
    if (choice.effects) applyEffects(get, set, choice.effects);
    if (choice.next) set({ dialogue: { dialogue: st.dialogue.dialogue, nodeId: choice.next } });
    else set({ dialogue: null });
  },

  closeDialogue: () => set({ dialogue: null }),

  seedRng: (seed) => {
    battleRng = makeRNG(seed);
  },

  startCombat: (encounterId, onVictory) => {
    const { scene, party, partyPos } = get();
    if (!scene) return;
    const enc = scene.encounters.find((e) => e.id === encounterId);
    if (!enc) return;
    // Placer les héros près de leur position de groupe, les ennemis selon l'encounter.
    const heroes = party.map((h, i) => ({
      ...JSON.parse(JSON.stringify(h)),
      pos: { x: Math.max(0, partyPos.x - 1), y: Math.min(scene.dimensions.h - 1, partyPos.y + i) },
      advantage: 0,
      conditions: [],
      wounds: { ...h.wounds },
    })) as Combatant[];
    const enemies = enc.enemies.map((e, i) => spawnEnemy(e.ref, e.statblock, `enemy-${i}`, { ...e.pos }));
    const all = [...heroes, ...enemies];
    // Initiative : on fixe l'Initiative de chaque combattant (I + 1d10 simplifié).
    for (const c of all) c.initiative = c.characteristics.I + battleRng.int(1, 10);
    const order = initiativeOrder(all).map((c) => c.id);
    const battle: BattleState = {
      combatants: all,
      order,
      turn: 0,
      round: 1,
      action: null,
      selectedSpell: null,
      reachable: new Map(),
      moved: false,
      acted: false,
      log: [`Le combat commence ! (Round 1)`],
      over: null,
      onVictory: onVictory ?? enc.onVictory,
    };
    set({ battle, mode: 'battle' });
    bus.emit(EVT.SCENE_DIRTY);
    maybeRunEnemyTurn(get, set);
  },

  battleSelectAction: (a) => {
    const { battle, scene } = get();
    if (!battle || !scene) return;
    const active = activeCombatant(battle);
    if (!active || active.kind !== 'hero') return;
    let reach = new Map<string, number>();
    if (a === 'move' && !battle.moved) {
      const blocked = occupied(battle, active.id);
      reach = reachable(scene, active.pos!, effectiveMovement(active), blocked);
    }
    // Quitter le mode incantation oublie le sort sélectionné.
    const selectedSpell = a === 'cast' || a === 'focus' ? battle.selectedSpell : null;
    set({ battle: { ...battle, action: a, reachable: reach, selectedSpell } });
    bus.emit(EVT.SCENE_DIRTY);
  },

  /** Sélectionne un sort à incanter ; le clic suivant sur une cible le lance. */
  battleSelectSpell: (label) => {
    const { battle } = get();
    if (!battle || battle.over) return;
    const active = activeCombatant(battle);
    if (!active || active.kind !== 'hero' || battle.acted) return;
    set({ battle: { ...battle, action: 'cast', selectedSpell: label, reachable: new Map() } });
    bus.emit(EVT.SCENE_DIRTY);
  },

  /** Focalise un sort d'Arcane/Domaine (Test étendu de Focalisation). */
  battleFocusSpell: (label) => {
    const { battle } = get();
    if (!battle || battle.over) return;
    const active = activeCombatant(battle);
    if (!active || active.kind !== 'hero' || battle.acted) return;
    focusSpell(get, set, active, label);
  },

  battleClickTile: (pt) => {
    const { battle, scene } = get();
    if (!battle || !scene || battle.over) return;
    const active = activeCombatant(battle);
    if (!active || active.kind !== 'hero') return;
    if (battle.action === 'move' && !battle.moved) {
      const k = `${pt.x},${pt.y}`;
      if (!battle.reachable.has(k)) return;
      const blocked = occupied(battle, active.id);
      const path = pathTo(scene, active.pos!, pt, blocked);
      active.pos = { ...pt };
      bus.emit(EVT.ANIM_MOVE, { id: active.id, path });
      set({ battle: { ...battle, moved: true, action: null, reachable: new Map() } });
      bus.emit(EVT.SCENE_DIRTY);
    }
  },

  battleClickEntity: (id) => {
    const { battle } = get();
    if (!battle || battle.over || battle.acted) return;
    const active = activeCombatant(battle);
    if (!active || active.kind !== 'hero') return;
    const target = battle.combatants.find((c) => c.id === id);
    if (!target) return;
    if (battle.action === 'cast' && battle.selectedSpell) {
      // L'incantation peut viser un allié, un ennemi ou soi-même.
      castSpell(get, set, active, target, battle.selectedSpell);
      return;
    }
    if (battle.action !== 'attack') return;
    if (target.kind === 'hero') return; // l'attaque ne vise que les ennemis
    doAttack(get, set, active, target);
  },

  battleEndTurn: () => advanceTurn(get, set),

  /** Acquitte un test de compétence : applique la branche réussite/échec. */
  resolveTest: () => {
    const pt = get().pendingTest;
    if (!pt) return;
    set({ pendingTest: null });
    const branch = pt.success ? pt.onSuccess : pt.onFailure;
    if (branch && branch.length) applyEffects(get, set, branch);
  },
  closeDocument: () => set({ document: null }),

  log: (msg) => set((s) => ({ journal: [...s.journal.slice(-40), msg] })),
}));

// ---------------------------------------------------------------------------
// Helpers internes
// ---------------------------------------------------------------------------

function activeCombatant(battle: BattleState): Combatant | undefined {
  return battle.combatants.find((c) => c.id === battle.order[battle.turn]);
}

function occupied(battle: BattleState, exceptId: string): Set<string> {
  const s = new Set<string>();
  for (const c of battle.combatants) {
    if (c.id === exceptId || isOutOfAction(c) || !c.pos) continue;
    s.add(`${c.pos.x},${c.pos.y}`);
  }
  return s;
}

function findFreeTile(scene: Scene): Pt {
  for (let y = 0; y < scene.dimensions.h; y++)
    for (let x = 0; x < scene.dimensions.w; x++) if (isWalkable(scene, x, y)) return { x, y };
  return { x: 0, y: 0 };
}

function removeEntity(get: () => GameState, set: any, id: string) {
  const scene = get().scene;
  if (!scene) return;
  scene.entities = scene.entities.filter((e) => e.id !== id);
  set({ scene: { ...scene } });
  bus.emit(EVT.SCENE_DIRTY);
}

function checkTriggers(get: () => GameState, set: any) {
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

function inRect(p: Pt, r: { x: number; y: number; w: number; h: number }): boolean {
  return p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;
}

function condMet(cond: string, flags: Record<string, boolean>): boolean {
  if (cond.startsWith('!')) return !flags[cond.slice(1)];
  return !!flags[cond];
}

function applyEffects(get: () => GameState, set: any, effects: Effect[]) {
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
        // Test de compétence : le meilleur du groupe tente. Branche après acquittement.
        const best = partyBest(get().party, e.skill, e.characteristic);
        if (!best) break;
        const res: TestResult = rollTest(best.value, e.difficulty ?? 'intermediaire');
        const required = e.requireSL ?? 0;
        const success = res.success && res.sl >= required;
        const label = e.label || e.skill || (e.characteristic ? `Test de ${e.characteristic}` : 'Test');
        set({
          pendingTest: {
            actorName: best.actor.name,
            label,
            roll: res.roll,
            target: res.target,
            success,
            sl: res.sl,
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
function bestDefenseMode(defender: Combatant): 'parade' | 'esquive' {
  return defenseValue(defender, 'esquive') > defenseValue(defender, 'parade') ? 'esquive' : 'parade';
}

function doAttack(get: () => GameState, set: any, attacker: Combatant, target: Combatant) {
  const battle = get().battle!;
  if (manhattan(attacker.pos!, target.pos!) > 1 && attacker.weapons[0]?.type === 'melee') {
    get().log('Cible hors de portée de mêlée.');
    return;
  }
  const weapon = attacker.weapons[0];
  const res =
    weapon.type === 'ranged'
      ? resolveRanged(attacker, target, weapon, battleRng, manhattan(attacker.pos!, target.pos!))
      : resolveMelee(attacker, target, weapon, battleRng, { defense: bestDefenseMode(target) });
  if (res.hit && res.woundsLost) {
    target.wounds.current = Math.max(0, target.wounds.current - res.woundsLost);
    if (res.critical && target.wounds.current > 0) addCondition(target, 'À Terre');
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
  if (res.defenderDefeated) log.push(`${target.name} est mis hors de combat !`);
  set({ battle: { ...battle, acted: true, action: null, log } });
  bus.emit(EVT.SCENE_DIRTY);
  checkBattleOver(get, set);
}

/** Applique un effet actif sans cumul : un seul bonus (le meilleur) ET une seule
 *  pénalité (la pire) coexistent par caractéristique (Livre de base l.168). */
function applyActiveEffect(target: Combatant, effect: ActiveEffect) {
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
const COMBAT_PERSIST = 9999;

/**
 * Tire sur la table d'Incantation Imparfaite / Colère des dieux et applique au
 * LANCEUR les effets mécaniques modélisés (États, Blessures ignorant BE+PA,
 * réduction à 0 + Inconscient). Retourne les lignes de journal.
 */
function applyMiscast(caster: Combatant, severity: MiscastSeverity, sinPoints = 0): string[] {
  const m = rollMiscast(severity, battleRng, sinPoints);
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
function castSpell(
  get: () => GameState,
  set: any,
  caster: Combatant,
  target: Combatant,
  label: string,
) {
  const battle = get().battle!;
  const spell = findSpell(label);
  if (!spell) {
    get().log(`Sort « ${label} » introuvable.`);
    return;
  }
  const focusedNI0 = caster.focus?.spell === label && caster.focus.dr >= (spell.cn ?? 0);
  const logLines: string[] = [];

  if (isMagicMissile(spell)) {
    const res = resolveMagicMissile(caster, target, spell, battleRng, focusedNI0);
    logLines.push(res.log);
    if (res.hit && res.woundsLost) {
      target.wounds.current = Math.max(0, target.wounds.current - res.woundsLost);
      if (res.isCritical && target.wounds.current > 0) addCondition(target, 'À Terre');
    }
    // Maladresse d'un Sort → Incantation Imparfaite Mineure ; sort focalisé dont
    // l'incantation échoue → Imparfaite Mineure également (Livre de base l.183).
    if (res.isFumble) logLines.push(...applyMiscast(caster, 'mineure'));
    else if (focusedNI0 && !res.cast) logLines.push(...applyMiscast(caster, 'mineure'));
    bus.emit(EVT.ANIM_ATTACK, { from: caster.id, to: target.id, result: res, kind: 'spell', defense: 'none' });
    if (res.defenderDefeated) logLines.push(`${target.name} est mis hors de combat !`);
  } else {
    const res = resolveCasting(caster, spell, battleRng, 'intermediaire', focusedNI0);
    logLines.push(res.log);
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
function castInfoIsPrayer(type: string): boolean {
  return type === 'Béni' || type === 'Invocation';
}

/** Focalise un sort d'Arcane/Domaine : cumule le DR jusqu'à atteindre le NI. */
function focusSpell(get: () => GameState, set: any, caster: Combatant, label: string) {
  const battle = get().battle!;
  const spell = findSpell(label);
  if (!spell || !isArcaneSpell(spell)) {
    get().log('Ce sort ne peut pas être focalisé.');
    return;
  }
  const res = resolveFocus(caster, spell, battleRng);
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

function checkBattleOver(get: () => GameState, set: any): boolean {
  const battle = get().battle;
  if (!battle || battle.over) return true;
  const heroesAlive = battle.combatants.some((c) => c.kind === 'hero' && !isOutOfAction(c));
  const enemiesAlive = battle.combatants.some((c) => c.kind === 'enemy' && !isOutOfAction(c));
  if (!enemiesAlive) {
    set({ battle: { ...battle, over: 'victory', log: [...battle.log, 'Victoire !'] } });
    if (battle.onVictory) applyEffects(get, set, battle.onVictory);
    return true;
  }
  if (!heroesAlive) {
    set({ battle: { ...battle, over: 'defeat', log: [...battle.log, 'Défaite…'] } });
    return true;
  }
  return false;
}

function advanceTurn(get: () => GameState, set: any) {
  let battle = get().battle;
  if (!battle || battle.over) return;
  let turn = battle.turn;
  let round = battle.round;
  // Fin de tour du combattant courant
  for (let i = 0; i < battle.order.length; i++) {
    turn += 1;
    if (turn >= battle.order.length) {
      turn = 0;
      round += 1;
      battle.log.push(`— Round ${round} —`);
      for (const c of battle.combatants) endOfRound(c, battleRng).forEach((l) => battle!.log.push(l));
      // Avantage : -1 si on n'en a gagné aucun ce Round (LDB Dépl. l.40 ; la perte sur
      // infériorité numérique n'est pas modélisée — l'état Engagé ne l'est pas non plus).
      for (const c of battle.combatants) {
        if (!isOutOfAction(c) && c.advantage > 0 && !c.gainedAdvThisRound) c.advantage -= 1;
        c.gainedAdvThisRound = false;
      }
    }
    const next = battle.combatants.find((c) => c.id === battle!.order[turn]);
    if (next && !isOutOfAction(next)) break;
  }
  battle = { ...battle, turn, round, action: null, moved: false, acted: false, reachable: new Map() };
  set({ battle });
  if (checkBattleOver(get, set)) return;
  bus.emit(EVT.SCENE_DIRTY);
  maybeRunEnemyTurn(get, set);
}

/** IA simple : si le combattant actif est un ennemi, il agit puis passe la main. */
function maybeRunEnemyTurn(get: () => GameState, set: any) {
  const battle = get().battle;
  if (!battle || battle.over) return;
  const active = activeCombatant(battle);
  if (!active || active.kind !== 'enemy' || isOutOfAction(active)) return;
  setTimeout(() => runEnemyAI(get, set, active.id), 450);
}

function runEnemyAI(get: () => GameState, set: any, enemyId: string) {
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

  // Attaque (mêlée ou tir, selon l'arme active) puis fin de tour — cadence préservée.
  const attackThenAdvance = (target: Combatant) => {
    setTimeout(() => {
      const b = get().battle;
      if (!b || b.over) return;
      doAttack(get, set, enemy, target);
      setTimeout(() => advanceTurn(get, set), 500);
    }, 350);
  };

  switch (action.kind) {
    case 'end':
      return advanceTurn(get, set);
    case 'cast':
      castSpell(get, set, enemy, targetOf(action.targetId), action.spell);
      setTimeout(() => advanceTurn(get, set), 500);
      return;
    case 'shoot':
    case 'melee':
      attackThenAdvance(targetOf(action.targetId));
      return;
    case 'move': {
      const path = pathTo(scene, enemy.pos!, action.to, blocked);
      enemy.pos = action.to;
      bus.emit(EVT.ANIM_MOVE, { id: enemy.id, path });
      set({ battle: { ...battle } });
      bus.emit(EVT.SCENE_DIRTY);
      const tgt = targetOf(action.thenTargetId);
      if (manhattan(enemy.pos!, tgt.pos!) <= 1) attackThenAdvance(tgt);
      else setTimeout(() => advanceTurn(get, set), 350);
      return;
    }
  }
}

export { activeCombatant };

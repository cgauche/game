/**
 * Store central (Zustand) — relie l'UI React et le rendu Phaser.
 * Gère les écrans, le groupe, l'exploration de scène, les dialogues et le
 * combat tactique au tour par tour (règles via src/engine).
 */
import { create } from 'zustand';
import { Combatant } from '../engine/types';
import { makeRNG, RNG } from '../engine/dice';
import { resolveMelee, resolveRanged, initiativeOrder, combatValue } from '../engine/combat';
import { rollTest, TestResult } from '../engine/tests';
import { partyBest } from '../engine/skills';
import { recomputeLoadout } from '../engine/items';
import { isOutOfAction, endOfRound, addCondition } from '../engine/conditions';
import { Scene, Dialogue, Effect, Trigger, SceneEntity, tileAt, isWalkable } from './scene';
import { spawnEnemy } from './spawn';
import { reachable, pathTo, manhattan, Pt } from './path';
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
  action: 'move' | 'attack' | null;
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

  setScreen: (s: Screen) => void;
  setParty: (p: Combatant[]) => void;
  toggleEquip: (heroId: string, uid: string) => void;
  startScene: (scene: Scene) => void;
  transitionTo: (sceneId: string, entry?: string) => void;
  moveParty: (pt: Pt) => void;
  interactEntity: (entityId: string) => void;
  chooseDialogue: (choiceIndex: number) => void;
  closeDialogue: () => void;
  resolveTest: () => void;
  closeDocument: () => void;

  startCombat: (encounterId: string, onVictory?: Effect[]) => void;
  battleSelectAction: (a: 'move' | 'attack' | null) => void;
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

  /** Transition vers une autre scène (conserve groupe, flags, inventaire, argent). */
  transitionTo: (sceneId, entry) => {
    const target = sceneRegistry[sceneId];
    if (!target) {
      get().log(`(Scène « ${sceneId} » introuvable — transition ignorée.)`);
      return;
    }
    const start =
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
    const { scene, mode } = get();
    if (!scene || mode !== 'exploration') return;
    if (!isWalkable(scene, pt.x, pt.y)) return;
    set({ partyPos: pt });
    bus.emit(EVT.SCENE_DIRTY);
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
      reach = reachable(scene, active.pos!, active.movement, blocked);
    }
    set({ battle: { ...battle, action: a, reachable: reach } });
    bus.emit(EVT.SCENE_DIRTY);
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
    if (!battle || battle.over) return;
    const active = activeCombatant(battle);
    if (!active || active.kind !== 'hero') return;
    if (battle.action !== 'attack' || battle.acted) return;
    const target = battle.combatants.find((c) => c.id === id);
    if (!target || target.kind === 'hero') return;
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
      case 'transition':
        get().transitionTo(e.scene, e.entry);
        break;
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

function doAttack(get: () => GameState, set: any, attacker: Combatant, target: Combatant) {
  const battle = get().battle!;
  if (manhattan(attacker.pos!, target.pos!) > 1 && attacker.weapons[0]?.type === 'melee') {
    get().log('Cible hors de portée de mêlée.');
    return;
  }
  const weapon = attacker.weapons[0];
  const res =
    weapon.type === 'ranged'
      ? resolveRanged(attacker, target, weapon, battleRng)
      : resolveMelee(attacker, target, weapon, battleRng, { defense: 'parade' });
  if (res.hit && res.woundsLost) {
    target.wounds.current = Math.max(0, target.wounds.current - res.woundsLost);
    if (res.critical && target.wounds.current > 0) addCondition(target, 'À Terre');
  }
  if (res.advantageTo === 'attacker') attacker.advantage += 1;
  if (res.advantageTo === 'defender') target.advantage += 1;
  bus.emit(EVT.ANIM_ATTACK, { from: attacker.id, to: target.id, result: res });
  const log = [...battle.log, res.log];
  if (res.defenderDefeated) log.push(`${target.name} est mis hors de combat !`);
  set({ battle: { ...battle, acted: true, action: null, log } });
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
      for (const c of battle.combatants) endOfRound(c).forEach((l) => battle!.log.push(l));
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

  // Cible : héros vivant le plus proche.
  const targets = battle.combatants.filter((c) => c.kind === 'hero' && !isOutOfAction(c));
  if (targets.length === 0) return checkBattleOver(get, set) as any;
  targets.sort((a, b) => manhattan(enemy.pos!, a.pos!) - manhattan(enemy.pos!, b.pos!));
  const target = targets[0];

  // Se rapprocher si nécessaire.
  if (manhattan(enemy.pos!, target.pos!) > 1) {
    const blocked = occupied(battle, enemy.id);
    const reach = reachable(scene, enemy.pos!, enemy.movement, blocked);
    // Trouver la case atteignable la plus proche de la cible.
    let best: Pt | null = null;
    let bestD = Infinity;
    for (const k of reach.keys()) {
      const [x, y] = k.split(',').map(Number);
      const d = manhattan({ x, y }, target.pos!);
      if (d < bestD) {
        bestD = d;
        best = { x, y };
      }
    }
    if (best) {
      const path = pathTo(scene, enemy.pos!, best, blocked);
      enemy.pos = best;
      bus.emit(EVT.ANIM_MOVE, { id: enemy.id, path });
      set({ battle: { ...battle } });
      bus.emit(EVT.SCENE_DIRTY);
    }
  }

  // Attaquer si adjacent.
  if (manhattan(enemy.pos!, target.pos!) <= 1) {
    setTimeout(() => {
      const b = get().battle;
      if (!b || b.over) return;
      doAttack(get, set, enemy, target);
      setTimeout(() => advanceTurn(get, set), 500);
    }, 350);
  } else {
    setTimeout(() => advanceTurn(get, set), 350);
  }
}

export { activeCombatant };

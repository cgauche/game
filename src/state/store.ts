/**
 * Store central (Zustand) — relie l'UI React et le rendu (SVG iso).
 * Gère les écrans, le groupe, l'exploration de scène, les dialogues et le
 * combat tactique au tour par tour (règles via src/engine).
 */
import { create } from 'zustand';
import { Combatant, ActiveEffect, CharKey, CHAR_LABELS, CHAR_BY_LABEL, HitLocation, Weapon, Difficulty, DIFFICULTY_MODIFIERS } from '../engine/types';
import { makeRNG, RNG } from '../engine/dice';
import {
  resolveMelee,
  resolveRanged,
  initiativeOrder,
  defenseValue,
  combatValue,
  rollMeleeAttacker,
  rollMeleeDefender,
  rollDisengageAttack,
  resolveBackstabAttack,
  finishMelee,
  resolveMeleePassive,
  attackWeapon,
  rederivePassiveAttack,
  AttackResult,
} from '../engine/combat';
import { engage, disengageFrom, isEngaged, decayEngagement, chargeAdvantage } from '../engine/engagement';
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
  rederiveCastSL,
  type CastResult,
  type MissileResult,
} from '../engine/magic';
import { rollMiscast, type MiscastSeverity } from '../engine/miscast';
import { rollTest, TestResult, opposedTest, resolveOpposed } from '../engine/tests';
import { canReroll } from '../engine/fortune';
import { effectiveChar, maxWounds } from '../engine/characteristics';
import {
  buyCharAdvance as engineBuyCharAdvance,
  buySkillAdvance as engineBuySkillAdvance,
  buyTalent as engineBuyTalent,
  changeCareer as engineChangeCareer,
  isCareerLevelComplete,
  inCareerChar,
  inCareerSkill,
  inCareerTalent,
} from '../engine/advancement';
import { partyBest } from '../engine/skills';
import { recomputeLoadout, itemFromTrapping } from '../engine/items';
import { itemUse } from '../engine/consumables';
import { effectiveMovement } from '../engine/encumbrance';
import { isOutOfAction, endOfRound, addCondition, removeCondition, cannotDefend, canTakeAction } from '../engine/conditions';
import { findSpell, levelsForCareer, findSkill, findSpecies } from '../data/index';
import { Scene, Dialogue, Effect, isWalkable } from './scene';
import { doorAt } from './buildings';
import { spawnEnemy } from './spawn';
import { reachable, pathTo, chebyshev, Pt } from './path';
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

/** Données du Niveau de Carrière COURANT d'un héros (depuis careerLevels.json), pour la
 *  détection in-carrière et la complétion. `undefined` si la carrière est hors base. */
function currentCareerLevel(hero: Combatant) {
  return levelsForCareer(hero.career ?? '').find((l) => l.level === (hero.careerLevel ?? 1));
}

/** Recalcule les Blessures max (BF + 2·BE + BFM, LDB Attributs) après une Augmentation de
 *  Caractéristique ; un gain de max augmente aussi le courant d'autant (mute le héros). */
function recomputeWounds(hero: Combatant) {
  const small = findSpecies(hero.species ?? '')?.small ?? false;
  const newMax = maxWounds(hero.characteristics, small);
  const delta = newMax - hero.wounds.max;
  hero.wounds.max = newMax;
  if (delta > 0) hero.wounds.current += delta;
  if (hero.wounds.current > newMax) hero.wounds.current = newMax;
}

export interface Money {
  gold: number;
  silver: number;
  brass: number;
}
/** Test de compétence interactif en attente d'acquittement par le joueur. */
export interface PendingTest {
  actorId: string;
  actorName: string;
  label: string;
  skillValue: number;
  difficulty: Difficulty;
  requireSL: number;
  target: number;
  /** Rempli après « Lancer » ; null tant que le jet n'a pas eu lieu (Chance possible ensuite). */
  roll: number | null;
  success: boolean;
  sl: number;
  /** Relance par Chance déjà effectuée (LDB ch.12 l.56 : 1 relance max par Test). */
  rerolled?: boolean;
  onSuccess?: Effect[];
  onFailure?: Effect[];
}
/** Attaque en attente : la modale affiche « Lancer », puis le résultat + Chance. */
export interface PendingAttack {
  attackerId: string;
  targetId: string;
  location: HitLocation | null;
  result: AttackResult | null; // null = pas encore lancé
  /** Relance par Chance déjà effectuée (1 max/Test, LDB ch.12 l.56). */
  rerolled?: boolean;
  fromCharge?: boolean; // issue d'une Charge → l'attaque est OBLIGATOIRE (LDB 15-Dépl l.75), Annuler interdit
}
/** Défense réactive : un ennemi (IA) a figé son jet d'attaque (`atk`) contre un héros ;
 *  le joueur choisit le mode, lance SA défense (`def`), peut la relancer (Chance = défense
 *  uniquement), puis applique. `atk` est figé et n'est JAMAIS relancé. Le tour de l'IA est
 *  suspendu tant que `pendingDefense` est non-null. */
export interface PendingDefense {
  attackerId: string; // ennemi
  defenderId: string; // héros
  weapon: Weapon; // arme active de l'attaquant, figée
  location: HitLocation | null; // visée par l'IA (aucune pour l'instant → null)
  atk: TestResult; // jet d'attaque figé (rollMeleeAttacker)
  mode: 'parade' | 'esquive'; // réaction choisie (défaut = bestDefenseMode)
  def: TestResult | null; // null = pas encore défendu ; écrasé par Chance
  result: AttackResult | null; // calculé par finishMelee après « Défendre »
  /** Relance par Chance déjà effectuée (1 max/Test, LDB ch.12 l.56). */
  rerolled?: boolean;
}
/** Désengagement en attente (LDB 15-Dépl l.84-109) : un MENU de choix (phase 'choice') —
 *  Sacrifier l'Avantage / Esquiver / Fuir / Renoncer — puis le Test d'Esquive (phase 'esquive'). */
export interface PendingDisengage {
  moverId: string; // héros qui se désengage (actif)
  foeId: string; // adversaire de référence (meilleure CC) pour l'Esquive et la Fuite
  canSacrifice: boolean; // Avantage > tous les foes Engagés → option « Sacrifier l'Avantage » dispo
  phase: 'choice' | 'esquive'; // 'choice' = menu d'options ; 'esquive' = Test d'Esquive en cours
  atk: TestResult | null; // Esquive : jet de Corps à corps du foe, figé (jamais relancé)
  def: TestResult | null; // Esquive : jet d'Esquive du mover
  result: 'success' | 'failure' | 'tie' | null; // 'tie' = égalité parfaite du Test opposé → statu quo
  /** Relance par Chance de l'Esquive déjà effectuée (1 max/Test, LDB ch.12 l.56). */
  rerolled?: boolean;
}

/** Incantation en attente : flux par modale (sélection → « Lancer » jet figé → Chance → appliquer),
 *  comme l'attaque. Tous les jets méritent leur modale. */
export interface PendingCast {
  casterId: string;
  targetId: string;
  spellLabel: string;
  /** Projectile magique (résolution façon attaque) vs autre sort / prière. */
  missile: boolean;
  /** Sort focalisé à NI 0 (consommé à l'application). */
  focused: boolean;
  /** Résultat figé du jet d'incantation (null = pas encore lancé). */
  result: (CastResult & Partial<MissileResult>) | null;
  /** Relance par Chance déjà effectuée (1 max/Test, LDB ch.12 l.56). */
  rerolled?: boolean;
}

export interface BattleState {
  combatants: Combatant[];
  order: string[];
  turn: number;
  round: number;
  action: 'move' | 'attack' | 'cast' | 'focus' | 'charge' | 'use' | null;
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
  pendingAttack: PendingAttack | null;
  pendingDefense: PendingDefense | null;
  pendingDisengage: PendingDisengage | null;
  pendingCast: PendingCast | null;
  document: { title: string; text: string } | null;
  /** Scène d'où l'on vient (pour `transitionBack` : sortie d'intérieur). */
  previousScene: { id: string; pos: Pt } | null;

  setScreen: (s: Screen) => void;
  setParty: (p: Combatant[]) => void;
  toggleEquip: (heroId: string, uid: string) => void;
  // ── Avancement par PX (LDB 07-Carrières) — câblage du moteur testé ──
  /** Octroie des PX à un héros. */
  grantXp: (heroId: string, amount: number) => void;
  /** Achète une Augmentation de Caractéristique (coût in/hors-carrière auto, recalc Blessures). */
  buyCharAdvance: (heroId: string, char: CharKey) => void;
  /** Achète une Augmentation de Compétence ; acquiert la Compétence de carrière non connue à 0. */
  buySkillAdvance: (heroId: string, skillName: string) => void;
  /** Achète/augmente un Talent (refusé hors carrière, LDB l.97). */
  buyTalent: (heroId: string, talentName: string) => void;
  /** Change de Carrière/Niveau (coût 100 si Niveau actuel complété, 200 sinon). */
  changeCareer: (heroId: string, newCareer: string, newLevel: number) => void;
  startScene: (scene: Scene) => void;
  /** Enregistre plusieurs scènes (projet multi-scènes) puis démarre l'entrée. */
  loadProject: (scenes: Scene[], entryId: string) => void;
  transitionTo: (sceneId: string, entry?: string, pos?: Pt) => void;
  moveParty: (pt: Pt) => void;
  interactEntity: (entityId: string) => void;
  chooseDialogue: (choiceIndex: number) => void;
  closeDialogue: () => void;
  testRoll: () => void;
  testReroll: () => void;
  /** Chance « +1 DR » (LDB ch.17 l.26) : ajoute un Degré de Réussite au Test figé, cumulable. */
  testBonusSL: () => void;
  resolveTest: () => void;
  closeDocument: () => void;

  /** Réensemence le RNG de combat (déterminisme des tests + future coop réseau). */
  seedRng: (seed: number) => void;
  startCombat: (encounterId: string, onVictory?: Effect[]) => void;
  battleSelectAction: (a: 'move' | 'attack' | 'cast' | 'focus' | 'charge' | 'use' | null) => void;
  battleSelectSpell: (label: string) => void;
  /** Le combattant actif boit/utilise un consommable de son inventaire (coûte l'Action). */
  battleUseItem: (uid: string) => void;
  /** Incantation par modale : « Lancer » fige le jet, Chance le relance, « Appliquer » résout. */
  castRoll: () => void;
  castReroll: () => void;
  castBonusSL: () => void;
  castConfirm: () => void;
  castCancel: () => void;
  battleFocusSpell: (label: string) => void;
  battleClickTile: (pt: Pt) => void;
  battleClickEntity: (id: string) => void;
  battleEndTurn: () => void;
  /** « Sur la défensive » : utilise l'Action pour +20 en défense jusqu'au prochain tour. */
  battleDefendTotal: () => void;
  /** Flux d'attaque par modale : viser une localisation, lancer, dépenser une Chance, appliquer. */
  attackSetLocation: (loc: HitLocation | null) => void;
  attackRoll: () => void;
  attackReroll: () => void;
  attackBonusSL: () => void;
  attackConfirm: () => void;
  attackCancel: () => void;
  /** Flux de défense réactive (héros attaqué par l'IA) : choisir Parade/Esquive, défendre,
   *  dépenser une Chance, appliquer ; « Subir » = défense passive. */
  defenseSetMode: (mode: 'parade' | 'esquive') => void;
  defenseRoll: () => void;
  defenseReroll: () => void;
  defenseBonusSL: () => void;
  defenseConfirm: () => void;
  defenseCancel: () => void;
  /** Désengagement (LDB 15-Dépl l.84-109) : menu Sacrifier l'Avantage / Esquiver / Fuir / Renoncer. */
  battleDisengage: () => void;
  disengageConfirmA: () => void; // Sacrifier l'Avantage
  disengageRoll: () => void; // Esquiver (lance le Test opposé)
  disengageReroll: () => void;
  disengageBonusSL: () => void;
  disengageConfirm: () => void; // Appliquer l'issue de l'Esquive
  disengageFlee: () => void; // Fuir : attaque dans le dos + Course
  disengageCancel: () => void;
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
  pendingAttack: null,
  pendingDefense: null,
  pendingDisengage: null,
  pendingCast: null,
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
  grantXp: (heroId, amount) => {
    let name = '';
    set((s) => ({
      party: s.party.map((h) => {
        if (h.id !== heroId) return h;
        name = h.name;
        const clone: Combatant = JSON.parse(JSON.stringify(h));
        clone.xp = (clone.xp ?? 0) + amount;
        return clone;
      }),
    }));
    if (name) get().log(`${name} : ${amount >= 0 ? '+' : ''}${amount} PX.`);
  },

  buyCharAdvance: (heroId, char) => {
    let msg = '';
    set((s) => ({
      party: s.party.map((h) => {
        if (h.id !== heroId) return h;
        const clone: Combatant = JSON.parse(JSON.stringify(h));
        const inC = inCareerChar(currentCareerLevel(clone)?.characteristics ?? [], char);
        const r = engineBuyCharAdvance(clone, char, inC);
        if (!r.ok) {
          msg = `${clone.name} : ${CHAR_LABELS[char]} — ${r.reason}.`;
          return h;
        }
        recomputeWounds(clone);
        msg = `${clone.name} : ${CHAR_LABELS[char]} +1 (−${r.cost} PX${inC ? '' : ', hors carrière'}).`;
        return clone;
      }),
    }));
    if (msg) get().log(msg);
  },

  buySkillAdvance: (heroId, skillName) => {
    let msg = '';
    set((s) => ({
      party: s.party.map((h) => {
        if (h.id !== heroId) return h;
        const clone: Combatant = JSON.parse(JSON.stringify(h));
        const known = clone.skills.some((sk) => sk.name === skillName);
        const inC = inCareerSkill(currentCareerLevel(clone)?.skills ?? [], skillName);
        if (!known) {
          if (!inC) {
            msg = `${clone.name} : « ${skillName} » hors carrière, non acquérable.`;
            return h;
          }
          // Acquérir la Compétence de carrière à advances 0, puis l'augmenter (l'Augmentation est payée).
          const characteristic = CHAR_BY_LABEL[findSkill(skillName)?.characteristic ?? ''] ?? 'Int';
          clone.skills.push({ name: skillName, characteristic, advances: 0 });
        }
        const r = engineBuySkillAdvance(clone, skillName, inC);
        if (!r.ok) {
          msg = `${clone.name} : ${skillName} — ${r.reason}.`;
          return h;
        }
        msg = `${clone.name} : ${skillName} +1 (−${r.cost} PX${inC ? '' : ', hors carrière'}).`;
        return clone;
      }),
    }));
    if (msg) get().log(msg);
  },

  buyTalent: (heroId, talentName) => {
    let msg = '';
    set((s) => ({
      party: s.party.map((h) => {
        if (h.id !== heroId) return h;
        const clone: Combatant = JSON.parse(JSON.stringify(h));
        const inC = inCareerTalent(currentCareerLevel(clone)?.talents ?? [], talentName);
        if (!inC) {
          msg = `${clone.name} : Talent « ${talentName} » hors carrière (LDB l.97).`;
          return h;
        }
        const r = engineBuyTalent(clone, talentName);
        if (!r.ok) {
          msg = `${clone.name} : ${talentName} — ${r.reason}.`;
          return h;
        }
        msg = `${clone.name} : Talent ${talentName} (−${r.cost} PX).`;
        return clone;
      }),
    }));
    if (msg) get().log(msg);
  },

  changeCareer: (heroId, newCareer, newLevel) => {
    let msg = '';
    set((s) => ({
      party: s.party.map((h) => {
        if (h.id !== heroId) return h;
        const clone: Combatant = JSON.parse(JSON.stringify(h));
        const lvl = currentCareerLevel(clone);
        const completed = lvl ? isCareerLevelComplete(clone, clone.careerLevel ?? 1, lvl.skills, lvl.talents) : false;
        const r = engineChangeCareer(clone, newCareer, newLevel, completed);
        if (!r.ok) {
          msg = `${clone.name} : changement de carrière refusé (${r.reason}).`;
          return h;
        }
        msg = `${clone.name} : carrière → ${newCareer} (niv. ${newLevel}, −${r.cost} PX).`;
        return clone;
      }),
    }));
    if (msg) get().log(msg);
  },

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
      pendingAttack: null,
      pendingDefense: null,
      pendingDisengage: null,
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
      pendingAttack: null,
      pendingDefense: null,
      pendingDisengage: null,
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
    if (chebyshev(partyPos, ent.pos) > 1) {
      get().log('Trop loin pour interagir.');
      return;
    }
    if (ent.dialogueId) {
      const dlg = scene.dialogues.find((d) => d.id === ent.dialogueId);
      if (dlg) set({ dialogue: { dialogue: dlg, nodeId: dlg.start } });
    } else if (ent.kind === 'objet') {
      // Fouille à Effets (corps, coffre…) : le corps RESTE, marqué « fouillé » une seule fois.
      if (ent.search && ent.search.length) {
        if (get().flags[`__fouille_${entityId}`]) {
          get().log(`${ent.label ?? 'Déjà fouillé'} : rien de plus à trouver.`);
          return;
        }
        get().log(`Vous fouillez ${ent.label ?? 'les lieux'}…`);
        applyEffects(get, set, ent.search);
        set((s) => ({ flags: { ...s.flags, [`__fouille_${entityId}`]: true } }));
        return;
      }
      // Ramassage simple (legacy) : ajout à l'inventaire de groupe, l'objet disparaît.
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
      engagedWith: [], // pas d'Engagement hérité d'un combat précédent
      meleeThisRound: [],
      wounds: { ...h.wounds },
    })) as Combatant[];
    const enemies = enc.enemies.map((e, i) => spawnEnemy(e.ref, e.statblock, `enemy-${i}`, { ...e.pos }, { appearance: e.appearance, weapon: e.weapon }));
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
    // Repart d'aucune modale de jet héritée d'un combat/contexte précédent.
    set({ battle, mode: 'battle', pendingAttack: null, pendingDefense: null, pendingDisengage: null, pendingCast: null });
    bus.emit(EVT.SCENE_DIRTY);
    maybeRunEnemyTurn(get, set);
  },

  battleSelectAction: (a) => {
    const { battle, scene } = get();
    if (!battle || !scene) return;
    const active = activeCombatant(battle);
    if (!active || active.kind !== 'hero') return;
    // Sonné : pas d'Action (attaque/incantation) ; seul le déplacement reste possible (LDB États l.123).
    if (a !== 'move' && a !== null && !canTakeAction(active)) return;
    let reach = new Map<string, number>();
    if (a === 'move' && !battle.moved) {
      // Engagé : déplacement libre interdit (LDB 15-Dépl l.84) → on entre dans le Désengagement.
      if (isEngaged(active)) {
        // Si l'Action est déjà consommée (Esquive de Désengagement ratée/neutre, l.89), on ne
        // peut pas retenter ce tour → no-op (sinon boucle infinie de Tests d'Esquive).
        if (battle.acted) return;
        startDisengage(get, set, active);
        return;
      }
      const blocked = occupied(battle, active.id);
      reach = reachable(scene, active.pos!, effectiveMovement(active), blocked);
    }
    // Charge : seulement si pas déjà Engagé et arme de mêlée prête ; portée = Course (2×Mouvement, LDB 15-Dépl l.61,77).
    if (a === 'charge' && !battle.moved && !isEngaged(active) && active.weapons[0]?.type === 'melee') {
      const blocked = occupied(battle, active.id);
      reach = reachable(scene, active.pos!, effectiveMovement(active) * 2, blocked);
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

  battleUseItem: (uid) => {
    const { battle } = get();
    if (!battle || battle.over) return;
    const active = activeCombatant(battle);
    if (!active || active.kind !== 'hero') return;
    if (battle.acted || !canTakeAction(active)) return; // boire = une Action ; Sonné = pas d'Action
    const it = (active.items ?? []).find((i) => i.uid === uid);
    if (!it) return;
    const eff = itemUse(it, active);
    if (!eff) return;
    const log: string[] = [`${active.name} utilise : ${it.name}.`];
    if (eff.heal != null && eff.heal > 0) {
      const before = active.wounds.current;
      active.wounds.current = Math.min(active.wounds.max, active.wounds.current + eff.heal);
      log.push(`${active.name} regagne ${active.wounds.current - before} Blessure(s).`);
    }
    if (eff.removeCondition) {
      const cond = active.conditions.find((c) => c.name === eff.removeCondition);
      if (cond) {
        removeCondition(active, eff.removeCondition, cond.value); // retire toutes les piles de l'État
        log.push(`${active.name} n'est plus ${eff.removeCondition}.`);
      } else {
        log.push(`${active.name} n'a pas l'État ${eff.removeCondition}.`);
      }
    }
    active.items = (active.items ?? []).filter((i) => i.uid !== uid); // consommé
    set({ battle: { ...battle, acted: true, action: null, log: [...battle.log, ...log] } });
    bus.emit(EVT.SCENE_DIRTY);
  },

  castRoll: () => {
    const { battle, pendingCast: pc } = get();
    if (!battle || !pc || pc.result) return;
    const caster = battle.combatants.find((c) => c.id === pc.casterId);
    const target = battle.combatants.find((c) => c.id === pc.targetId);
    const spell = findSpell(pc.spellLabel);
    if (!caster || !target || !spell) return;
    const res = pc.missile
      ? resolveMagicMissile(caster, target, spell, battleRng, pc.focused)
      : resolveCasting(caster, spell, battleRng, 'intermediaire', pc.focused);
    set({ pendingCast: { ...pc, result: res } });
  },
  castReroll: () => {
    const { battle, pendingCast: pc } = get();
    if (!battle || !pc || !pc.result) return;
    // Échec d'incantation = d100 propre > cible (roll > target), 1× max.
    if (!canReroll(pc.result.roll > pc.result.target, !!pc.rerolled)) return;
    const caster = battle.combatants.find((c) => c.id === pc.casterId);
    const target = battle.combatants.find((c) => c.id === pc.targetId);
    const spell = findSpell(pc.spellLabel);
    if (!caster || !target || !spell || (caster.fortune ?? 0) <= 0) return;
    caster.fortune = (caster.fortune ?? 0) - 1; // Chance : relance le jet d'incantation
    const res = pc.missile
      ? resolveMagicMissile(caster, target, spell, battleRng, pc.focused)
      : resolveCasting(caster, spell, battleRng, 'intermediaire', pc.focused);
    set({ pendingCast: { ...pc, result: res, rerolled: true }, battle: { ...battle } });
  },
  /** Chance « +1 DR » : +1 DR à l'incantation figée (peut franchir le NI), cumulable. */
  castBonusSL: () => {
    const { battle, pendingCast: pc } = get();
    if (!battle || !pc || !pc.result) return;
    const caster = battle.combatants.find((c) => c.id === pc.casterId);
    const target = battle.combatants.find((c) => c.id === pc.targetId);
    const spell = findSpell(pc.spellLabel);
    if (!caster || !target || !spell || (caster.fortune ?? 0) <= 0) return;
    caster.fortune = (caster.fortune ?? 0) - 1;
    const res = rederiveCastSL(caster, target, spell, pc.result, pc.missile, pc.focused, 1);
    set({ pendingCast: { ...pc, result: res }, battle: { ...battle } });
  },
  castConfirm: () => {
    const { battle, pendingCast: pc } = get();
    if (!battle || !pc || !pc.result) return;
    const caster = battle.combatants.find((c) => c.id === pc.casterId);
    const target = battle.combatants.find((c) => c.id === pc.targetId);
    const spell = findSpell(pc.spellLabel);
    set({ pendingCast: null });
    if (caster && target && spell) applyCast(get, set, caster, target, spell, pc.result, pc.missile, pc.focused);
  },
  castCancel: () => set({ pendingCast: null }),

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
    const { battle, scene } = get();
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
    if (battle.action === 'charge') {
      // Charge (LDB 15-Dépl l.74-77) : se ruer au contact d'un ennemi (portée de Course) puis attaquer.
      if (!scene || target.kind === 'hero' || isEngaged(active)) return; // pas de Charge si déjà Engagé (l.74)
      const blocked = occupied(battle, active.id);
      const reach = reachable(scene, active.pos!, effectiveMovement(active) * 2, blocked); // portée de Course
      const dest = bestAdjacentReachable(reach, target.pos!);
      if (!dest) {
        get().log('Cible hors de portée de Charge.');
        return;
      }
      const distFrom = chebyshev(active.pos!, target.pos!); // distance de combat AVANT déplacement (l.77 ; ≤ 2M+1 pour toute charge valide)
      const adv = chargeAdvantage(effectiveMovement(active), distFrom);
      const path = pathTo(scene, active.pos!, dest, blocked);
      active.pos = { ...dest };
      bus.emit(EVT.ANIM_MOVE, { id: active.id, path });
      active.advantage += adv; // +1/+2 « en fonçant » (l.77,102), AVANT le jet (profite au toucher)
      active.gainedAdvThisRound = true;
      set({ battle: { ...battle, moved: true, action: 'attack', log: [...battle.log, `${active.name} charge ${target.name} (+${adv} Avantage).`] } });
      set({ pendingAttack: { attackerId: active.id, targetId: target.id, location: null, result: null, fromCharge: true } });
      return;
    }
    if (battle.action !== 'attack') return;
    if (target.kind === 'hero') return; // l'attaque ne vise que les ennemis
    if (chebyshev(active.pos!, target.pos!) > 1 && active.weapons[0]?.type === 'melee') {
      get().log('Cible hors de portée de mêlée.');
      return;
    }
    // Ouvre la modale d'attaque (le jet se fait après le clic « Lancer »).
    set({ pendingAttack: { attackerId: active.id, targetId: target.id, location: null, result: null } });
  },

  battleEndTurn: () => advanceTurn(get, set),

  battleDefendTotal: () => {
    const battle = get().battle;
    if (!battle || battle.over || battle.acted) return;
    const active = activeCombatant(battle);
    if (!active || active.kind !== 'hero') return;
    if (!canTakeAction(active)) return; // Sonné : pas d'Action (LDB États l.123)
    active.defensiveStance = true;
    set({ battle: { ...battle, acted: true, action: null, log: [...battle.log, `${active.name} se met sur la défensive (+20 en défense).`] } });
    bus.emit(EVT.SCENE_DIRTY);
  },

  attackSetLocation: (loc) => {
    const pa = get().pendingAttack;
    if (!pa || pa.result) return; // la visée ne change plus après le jet
    set({ pendingAttack: { ...pa, location: loc } });
  },
  attackRoll: () => {
    const { battle, pendingAttack: pa } = get();
    if (!battle || !pa || pa.result) return;
    const attacker = battle.combatants.find((c) => c.id === pa.attackerId);
    const target = battle.combatants.find((c) => c.id === pa.targetId);
    if (!attacker || !target) return;
    applySonneMeleeAdvantage(attacker, target); // +1 Avantage si cible Sonnée (LDB États l.123), avant le jet
    const r = resolveAttack(attacker, target, pa.location ?? undefined);
    if (!r) {
      get().log('Cible hors de portée de mêlée.');
      set({ pendingAttack: null });
      return;
    }
    set({ pendingAttack: { ...pa, result: r.res } });
  },
  attackReroll: () => {
    const { battle, pendingAttack: pa } = get();
    if (!battle || !pa || !pa.result) return;
    // Relance si le jet d'attaque propre est raté (succès du d100 de l'attaquant), 1× max.
    if (!canReroll(!pa.result.attackerDetail?.success, !!pa.rerolled)) return;
    const attacker = battle.combatants.find((c) => c.id === pa.attackerId);
    const target = battle.combatants.find((c) => c.id === pa.targetId);
    if (!attacker || !target || (attacker.fortune ?? 0) <= 0) return;
    attacker.fortune = (attacker.fortune ?? 0) - 1; // Dépense d'un point de Chance : relance le jet (LDB ch.17 l.24)
    const r = resolveAttack(attacker, target, pa.location ?? undefined);
    if (r) set({ pendingAttack: { ...pa, result: r.res, rerolled: true }, battle: { ...battle } });
  },
  /** Chance « +1 DR » : +1 DR au jet d'attaque figé, re-dérive l'issue (sans relancer). */
  attackBonusSL: () => {
    const { battle, pendingAttack: pa } = get();
    if (!battle || !pa || !pa.result || !pa.result.attackerDetail) return;
    const attacker = battle.combatants.find((c) => c.id === pa.attackerId);
    const target = battle.combatants.find((c) => c.id === pa.targetId);
    if (!attacker || !target || (attacker.fortune ?? 0) <= 0) return;
    attacker.fortune = (attacker.fortune ?? 0) - 1;
    const r = pa.result;
    const ad = r.attackerDetail!;
    const atk2: TestResult = { roll: ad.roll, target: ad.target, success: ad.success, sl: ad.sl + 1, isDouble: ad.roll === 100 || ad.roll % 11 === 0 };
    const adj = chebyshev(attacker.pos!, target.pos!) <= 1;
    const weapon = attackWeapon(attacker.weapons, adj);
    let res: AttackResult;
    if (r.defenderDetail) {
      const dd = r.defenderDetail;
      const def: TestResult = { roll: dd.roll, target: dd.target, success: dd.success, sl: dd.sl, isDouble: dd.roll === 100 || dd.roll % 11 === 0 };
      res = finishMelee(attacker, target, weapon, atk2, def, bestDefenseMode(target), pa.location ?? undefined);
    } else {
      res = rederivePassiveAttack(attacker, target, weapon, atk2, weapon.type === 'ranged' ? 'ranged' : 'melee', pa.location ?? undefined);
    }
    set({ pendingAttack: { ...pa, result: res }, battle: { ...battle } });
  },
  attackConfirm: () => {
    const { battle, pendingAttack: pa } = get();
    if (!battle || !pa || !pa.result) return;
    const attacker = battle.combatants.find((c) => c.id === pa.attackerId);
    const target = battle.combatants.find((c) => c.id === pa.targetId);
    set({ pendingAttack: null });
    if (attacker && target) applyAttackResult(get, set, attacker, target, attacker.weapons[0], pa.result);
  },
  attackCancel: () => {
    const pa = get().pendingAttack;
    if (pa?.fromCharge) return; // après une Charge, l'attaque est obligatoire (LDB 15-Dépl l.75)
    set({ pendingAttack: null });
  },

  // ── Défense réactive (héros attaqué par l'IA en mêlée) ──
  defenseSetMode: (mode) => {
    const pd = get().pendingDefense;
    if (!pd || pd.result) return; // le mode ne change plus après le jet
    set({ pendingDefense: { ...pd, mode } });
  },
  defenseRoll: () => {
    // « Défendre » : roule la défense du héros et résout le Test opposé (atk figé).
    const { battle, pendingDefense: pd } = get();
    if (!battle || !pd || pd.result) return;
    const attacker = battle.combatants.find((c) => c.id === pd.attackerId);
    const defender = battle.combatants.find((c) => c.id === pd.defenderId);
    if (!attacker || !defender) return;
    const def = rollMeleeDefender(defender, pd.mode, battleRng);
    const res = finishMelee(attacker, defender, pd.weapon, pd.atk, def, pd.mode, pd.location ?? undefined);
    set({ pendingDefense: { ...pd, def, result: res } });
  },
  defenseReroll: () => {
    // Dépense d'un point de Chance du DÉFENSEUR : relance UNIQUEMENT la défense (LDB Destin).
    const { battle, pendingDefense: pd } = get();
    if (!battle || !pd || !pd.result) return;
    if (!canReroll(!pd.def?.success, !!pd.rerolled)) return; // défense propre ratée, 1× max
    const attacker = battle.combatants.find((c) => c.id === pd.attackerId);
    const defender = battle.combatants.find((c) => c.id === pd.defenderId);
    if (!attacker || !defender || (defender.fortune ?? 0) <= 0) return;
    defender.fortune = (defender.fortune ?? 0) - 1; // le jet d'attaque (pd.atk) reste figé
    const def = rollMeleeDefender(defender, pd.mode, battleRng);
    const res = finishMelee(attacker, defender, pd.weapon, pd.atk, def, pd.mode, pd.location ?? undefined);
    set({ pendingDefense: { ...pd, def, result: res, rerolled: true }, battle: { ...battle } });
  },
  /** Chance « +1 DR » du défenseur : +1 DR à SA défense figée (le jet d'attaque reste figé). */
  defenseBonusSL: () => {
    const { battle, pendingDefense: pd } = get();
    if (!battle || !pd || !pd.result || !pd.result.defenderDetail) return;
    const attacker = battle.combatants.find((c) => c.id === pd.attackerId);
    const defender = battle.combatants.find((c) => c.id === pd.defenderId);
    if (!attacker || !defender || (defender.fortune ?? 0) <= 0) return;
    defender.fortune = (defender.fortune ?? 0) - 1;
    const dd = pd.result.defenderDetail!;
    const def2: TestResult = { roll: dd.roll, target: dd.target, success: dd.success, sl: dd.sl + 1, isDouble: dd.roll === 100 || dd.roll % 11 === 0 };
    const res = finishMelee(attacker, defender, pd.weapon, pd.atk, def2, pd.mode, pd.location ?? undefined);
    set({ pendingDefense: { ...pd, def: def2, result: res }, battle: { ...battle } });
  },
  defenseConfirm: () => {
    // « Appliquer » : applique le résultat puis REPREND le tour de l'IA suspendu.
    const { battle, pendingDefense: pd } = get();
    if (!battle || !pd || !pd.result) return;
    const attacker = battle.combatants.find((c) => c.id === pd.attackerId);
    const defender = battle.combatants.find((c) => c.id === pd.defenderId);
    set({ pendingDefense: null }); // null AVANT la reprise → ré-entrance/double-advance impossibles
    if (attacker && defender) applyAttackResult(get, set, attacker, defender, pd.weapon, pd.result);
    resumeEnemyTurn(get, set);
  },
  defenseCancel: () => {
    // « Subir » : défense passive (aucune réaction), puis reprise du tour de l'IA.
    const { battle, pendingDefense: pd } = get();
    if (!pd) return;
    const attacker = battle?.combatants.find((c) => c.id === pd.attackerId);
    const defender = battle?.combatants.find((c) => c.id === pd.defenderId);
    set({ pendingDefense: null });
    if (attacker && defender) {
      const res = resolveMeleePassive(attacker, defender, pd.weapon, pd.atk, pd.location ?? undefined);
      applyAttackResult(get, set, attacker, defender, pd.weapon, res);
    }
    resumeEnemyTurn(get, set);
  },

  // ── Désengagement (héros Engagé qui veut quitter le combat, LDB 15-Dépl l.84-89) ──
  battleDisengage: () => {
    const battle = get().battle;
    if (!battle || battle.over || battle.acted) return;
    const active = activeCombatant(battle);
    if (!active || active.kind !== 'hero' || !isEngaged(active)) return;
    startDisengage(get, set, active);
  },
  // « Sacrifier l'Avantage » (l.87) → ramener l'Avantage à 0, partir libre. L'Action N'EST PAS consommée.
  disengageConfirmA: () => {
    const { battle, scene, pendingDisengage: pd } = get();
    if (!battle || !scene || !pd || !pd.canSacrifice) return;
    const mover = battle.combatants.find((c) => c.id === pd.moverId);
    if (!mover) return set({ pendingDisengage: null });
    const foes = (mover.engagedWith ?? [])
      .map((id) => battle.combatants.find((c) => c.id === id))
      .filter((c): c is Combatant => !!c);
    mover.advantage = 0; // « ramener votre Avantage à 0 » (l.87)
    for (const f of foes) disengageFrom(mover, f); // se place hors de portée de TOUS (l.87)
    const blocked = occupied(battle, mover.id);
    set({
      pendingDisengage: null,
      battle: {
        ...battle,
        action: 'move', // mouvement libre rouvert, sans pénalité (l.87) ; Action préservée
        reachable: reachable(scene, mover.pos!, effectiveMovement(mover), blocked),
        log: [...battle.log, `${mover.name} se désengage en sacrifiant son Avantage.`],
      },
    });
    bus.emit(EVT.SCENE_DIRTY);
  },
  // « Esquiver » → Test opposé Esquive (mover) vs Corps à corps (foe), jet du foe figé. Passe en phase 'esquive'.
  disengageRoll: () => {
    const { battle, pendingDisengage: pd } = get();
    if (!battle || !pd || pd.phase !== 'choice') return;
    const mover = battle.combatants.find((c) => c.id === pd.moverId);
    if (!mover) return;
    const def = rollMeleeDefender(mover, 'esquive', battleRng);
    const opp = resolveOpposed(def, pd.atk!); // mover = « attaquant » du Test opposé
    set({ pendingDisengage: { ...pd, phase: 'esquive', def, result: disengageOutcome(opp.winner) } });
  },
  // Chance du mover : relance UNIQUEMENT son Esquive (le jet du foe reste figé).
  disengageReroll: () => {
    const { battle, pendingDisengage: pd } = get();
    if (!battle || !pd || !pd.result) return;
    if (!canReroll(!pd.def?.success, !!pd.rerolled)) return; // Esquive propre ratée, 1× max
    const mover = battle.combatants.find((c) => c.id === pd.moverId);
    if (!mover || (mover.fortune ?? 0) <= 0) return;
    mover.fortune = (mover.fortune ?? 0) - 1;
    const def = rollMeleeDefender(mover, 'esquive', battleRng);
    const opp = resolveOpposed(def, pd.atk!);
    set({ pendingDisengage: { ...pd, def, result: disengageOutcome(opp.winner), rerolled: true }, battle: { ...battle } });
  },
  /** Chance « +1 DR » du mover : +1 DR à l'Esquive figée (le jet du foe reste figé). */
  disengageBonusSL: () => {
    const { battle, pendingDisengage: pd } = get();
    if (!battle || !pd || !pd.result || !pd.def) return;
    const mover = battle.combatants.find((c) => c.id === pd.moverId);
    if (!mover || (mover.fortune ?? 0) <= 0) return;
    mover.fortune = (mover.fortune ?? 0) - 1;
    const def2: TestResult = { ...pd.def, sl: pd.def.sl + 1 };
    const opp = resolveOpposed(def2, pd.atk!);
    set({ pendingDisengage: { ...pd, def: def2, result: disengageOutcome(opp.winner) }, battle: { ...battle } });
  },
  // « Appliquer » : l'Esquive consomme l'Action dans les DEUX issues (l.89).
  disengageConfirm: () => {
    const { battle, scene, pendingDisengage: pd } = get();
    if (!battle || !scene || !pd || !pd.result) return;
    const mover = battle.combatants.find((c) => c.id === pd.moverId);
    const foe = battle.combatants.find((c) => c.id === pd.foeId);
    set({ pendingDisengage: null });
    if (!mover || !foe) return;
    const log = [...battle.log];
    if (pd.result === 'success') {
      mover.advantage += 1; // +1 Avantage (l.89)
      mover.gainedAdvThisRound = true;
      // Esquive réussie = on s'extrait du corps à corps → libéré de TOUS les Engagements
      // (cohérent avec l'option A, qui libère aussi tous les foes).
      const foes = (mover.engagedWith ?? [])
        .map((id) => battle.combatants.find((c) => c.id === id))
        .filter((c): c is Combatant => !!c);
      for (const f of foes) disengageFrom(mover, f);
      const blocked = occupied(battle, mover.id);
      log.push(`${mover.name} se désengage (Esquive réussie, +1 Avantage).`);
      set({
        battle: { ...battle, acted: true, action: 'move', reachable: reachable(scene, mover.pos!, effectiveMovement(mover), blocked), log },
      });
    } else if (pd.result === 'tie') {
      // Égalité parfaite du Test opposé : statu quo — pas de fuite, mais pas d'avantage à
      // l'adversaire non plus (LDB Tests). L'Action est consommée par la tentative d'Esquive.
      log.push(`${mover.name} : échange neutre, le désengagement échoue (personne ne prend l'avantage).`);
      set({ battle: { ...battle, acted: true, action: null, reachable: new Map(), log } });
    } else {
      foe.advantage += 1; // l'adversaire gagne +1, la fuite échoue (l.89)
      foe.gainedAdvThisRound = true;
      log.push(`${mover.name} échoue à se désengager ; ${foe.name} gagne +1 Avantage.`);
      set({ battle: { ...battle, acted: true, action: null, reachable: new Map(), log } });
    }
    bus.emit(EVT.SCENE_DIRTY);
  },
  // « Fuir » (LDB 15-Dépl l.98-109) : l'adversaire gagne +1 Avantage + une attaque gratuite dans
  // le dos (+20) ; si elle touche, +1 Avantage de plus et Test de Calme ou État Brisé ; puis on
  // se libère de TOUS les Engagements et on peut courir (Mouvement de Course).
  disengageFlee: () => {
    const { battle, scene, pendingDisengage: pd } = get();
    if (!battle || !scene || !pd) return;
    const mover = battle.combatants.find((c) => c.id === pd.moverId);
    const foe = battle.combatants.find((c) => c.id === pd.foeId);
    set({ pendingDisengage: null });
    if (!mover || !foe) return;
    const log = [...battle.log];
    foe.advantage += 1; // l'adversaire gagne immédiatement +1 Avantage (l.101)
    foe.gainedAdvThisRound = true;
    const res = resolveBackstabAttack(foe, mover, battleRng);
    log.push(`${mover.name} fuit — ${foe.name} frappe dans le dos : ${res.log}`);
    if (res.hit && res.woundsLost) {
      mover.wounds.current = Math.max(0, mover.wounds.current - res.woundsLost);
      foe.advantage += 1; // touché → +1 Avantage de plus (l.107)
      // Test de Calme Intermédiaire (+0) ou État Brisé (+1 par DR négatif).
      const calme = effectiveChar(mover, 'FM') + (mover.skills.find((s) => s.name.toLowerCase().startsWith('calme'))?.advances ?? 0);
      const ct = rollTest(calme, 'intermediaire', battleRng);
      if (!ct.success) {
        const broken = 1 + Math.max(0, -ct.sl);
        addCondition(mover, 'Brisé', broken);
        log.push(`${mover.name} panique : ${broken} État(s) Brisé.`);
      }
    }
    const foes = (mover.engagedWith ?? []).map((id) => battle.combatants.find((c) => c.id === id)).filter((c): c is Combatant => !!c);
    for (const f of foes) disengageFrom(mover, f);
    const blocked = occupied(battle, mover.id);
    set({ battle: { ...battle, action: 'move', reachable: reachable(scene, mover.pos!, effectiveMovement(mover) * 2, blocked), log } });
    bus.emit(EVT.SCENE_DIRTY);
    checkBattleOver(get, set);
  },
  disengageCancel: () => set({ pendingDisengage: null }), // renonce avant tout jet : aucun coût

  /** « Lancer » : effectue le jet du test en attente (hors combat). */
  testRoll: () => {
    const pt = get().pendingTest;
    if (!pt || pt.roll != null) return; // déjà lancé
    const res: TestResult = rollTest(pt.skillValue, pt.difficulty);
    set({ pendingTest: { ...pt, roll: res.roll, sl: res.sl, success: res.success && res.sl >= pt.requireSL } });
  },

  /** Dépense un point de Chance du testeur pour relancer le jet (LDB Destin). */
  testReroll: () => {
    const pt = get().pendingTest;
    if (!pt || pt.roll == null) return;
    // Relance réservée à un d100 propre RATÉ (roll > cible), une seule fois (LDB ch.12 l.56 + l.29-31).
    if (!canReroll(pt.roll > pt.target, !!pt.rerolled)) return;
    const party = get().party;
    const actor = party.find((c) => c.id === pt.actorId);
    if (!actor || (actor.fortune ?? 0) <= 0) return;
    actor.fortune = (actor.fortune ?? 0) - 1;
    const res: TestResult = rollTest(pt.skillValue, pt.difficulty);
    set({
      pendingTest: { ...pt, roll: res.roll, sl: res.sl, success: res.success && res.sl >= pt.requireSL, rerolled: true },
      party: [...party],
    });
  },

  /** Chance « +1 DR » (LDB ch.17 l.26) : ajoute un Degré de Réussite au Test figé, cumulable. */
  testBonusSL: () => {
    const pt = get().pendingTest;
    if (!pt || pt.roll == null) return;
    const party = get().party;
    const actor = party.find((c) => c.id === pt.actorId);
    if (!actor || (actor.fortune ?? 0) <= 0) return;
    actor.fortune = (actor.fortune ?? 0) - 1;
    const sl = pt.sl + 1;
    set({ pendingTest: { ...pt, sl, success: pt.roll <= pt.target && sl >= pt.requireSL }, party: [...party] });
  },

  /** Acquitte un test de compétence : applique la branche réussite/échec. */
  resolveTest: () => {
    const pt = get().pendingTest;
    if (!pt || pt.roll == null) return; // pas d'acquittement avant le jet
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
function bestDefenseMode(defender: Combatant): 'parade' | 'esquive' {
  return defenseValue(defender, 'esquive') > defenseValue(defender, 'parade') ? 'esquive' : 'parade';
}

/** Sonné : tout adversaire qui frappe la cible en CORPS À CORPS gagne +1 Avantage
 *  AVANT son attaque (LDB États l.123) — ce +1 profite donc déjà au jet en cours puis
 *  persiste. À appeler une seule fois par attaque (avant le 1er jet ; pas sur une relance). */
function applySonneMeleeAdvantage(attacker: Combatant, target: Combatant): void {
  if (attacker.weapons[0]?.type === 'melee' && target.conditions.some((c) => c.name === 'Sonné')) {
    attacker.advantage += 1;
    attacker.gainedAdvThisRound = true;
  }
}

/** Résout une attaque (le JET) SANS l'appliquer — pour le flux par modale (« Lancer »
 *  puis éventuel point de Chance). Retourne null si la cible est hors de portée de mêlée. */
function resolveAttack(attacker: Combatant, target: Combatant, location?: HitLocation): { res: AttackResult; weapon: Weapon } | null {
  // Arme choisie selon la distance : mêlée au contact, distance sinon (Atout Pistolet pour tirer
  // en Combat rapproché — LDB Armes l.297-298). Évite qu'un Engagé tire son arbalète au contact.
  const adj = chebyshev(attacker.pos!, target.pos!) <= 1;
  const weapon = attackWeapon(attacker.weapons, adj);
  if (!adj && weapon.type === 'melee') return null; // arme de mêlée hors de portée
  const res =
    weapon.type === 'ranged'
      ? resolveRanged(attacker, target, weapon, battleRng, chebyshev(attacker.pos!, target.pos!), location)
      : resolveMelee(attacker, target, weapon, battleRng, { defense: bestDefenseMode(target), location });
  return { res, weapon };
}

/** Applique un résultat d'attaque déjà résolu : Blessures, États, Assommante,
 *  Avantage, animation, journal, fin de combat. */
/** Issue du Test opposé d'Esquive du Désengagement : le mover est l'« attaquant » du test ;
 *  une égalité parfaite (tie) = statu quo (ni fuite, ni avantage à l'adversaire — LDB Tests). */
function disengageOutcome(winner: 'attacker' | 'defender' | 'tie'): 'success' | 'failure' | 'tie' {
  return winner === 'attacker' ? 'success' : winner === 'tie' ? 'tie' : 'failure';
}

/** Lance le Désengagement d'un combattant Engagé (LDB 15-Dépl l.84-89) : option A
 *  (Avantage > adversaires → résolue direct) ou option B (Test opposé d'Esquive vs le
 *  foe le plus dangereux). No-op « rouvre le mouvement » si plus aucun foe vivant. */
function startDisengage(get: () => GameState, set: any, mover: Combatant): void {
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
  const atk = rollDisengageAttack(foe, battleRng);
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
function bestAdjacentReachable(reach: Map<string, number>, target: Pt): Pt | null {
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

function applyAttackResult(
  get: () => GameState,
  set: any,
  attacker: Combatant,
  target: Combatant,
  weapon: Weapon,
  res: AttackResult,
): void {
  const battle = get().battle!;
  if (weapon.type === 'melee') engage(attacker, target); // Engagé symétrique sur toute attaque de mêlée (LDB 13-Combat l.174-175)
  if (res.hit && res.woundsLost) {
    target.wounds.current = Math.max(0, target.wounds.current - res.woundsLost);
    if (res.critical && target.wounds.current > 0) addCondition(target, 'À Terre');
  }
  // Atout Assommante : une touche à la Tête → Test opposé Force/Résistance ; si
  // l'attaquant l'emporte, la cible gagne un État Sonné (LDB Les armes l.268).
  let assommanteLog: string | null = null;
  if (res.hit && res.location === 'tete' && weapon.qualities.some((q) => q.toLowerCase().startsWith('assommante'))) {
    const resist = effectiveChar(target, 'E') + (target.skills.find((s) => s.name.toLowerCase().startsWith('résistance'))?.advances ?? 0);
    if (opposedTest(effectiveChar(attacker, 'F'), resist, battleRng).winner === 'attacker') {
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
  if (assommanteLog) log.push(assommanteLog);
  if (res.defenderDefeated) log.push(`${target.name} est mis hors de combat !`);
  set({ battle: { ...battle, acted: true, action: null, log } });
  bus.emit(EVT.SCENE_DIRTY);
  checkBattleOver(get, set);
}

/** Ouvre la modale de défense réactive si l'attaque est : ennemi → héros, en mêlée,
 *  à portée, cible CAPABLE de se défendre (pas Surpris). Fige le jet d'attaque et
 *  suspend le tour de l'IA. Retourne true si la modale s'est ouverte. */
function maybeOpenDefense(set: any, attacker: Combatant, target: Combatant): boolean {
  const weapon = attacker.weapons[0];
  if (attacker.kind !== 'enemy' || target.kind !== 'hero') return false;
  if (weapon?.type !== 'melee') return false;
  if (chebyshev(attacker.pos!, target.pos!) > 1) return false;
  if (cannotDefend(target)) return false; // Surpris → résolution instantanée (LDB États l.132)
  applySonneMeleeAdvantage(attacker, target); // +1 Avantage si cible Sonnée, AVANT le jet (une seule fois)
  const atk = rollMeleeAttacker(attacker, target, weapon, battleRng); // jet d'attaque figé
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
function doAttack(get: () => GameState, set: any, attacker: Combatant, target: Combatant): boolean {
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
/** Ouvre la modale d'incantation (jet différé, façon attaque) : pose `pendingCast` sans lancer. */
function castSpell(
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
function applyCast(
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

/** Reprend le tour de l'IA suspendu par la modale de défense (= ce qu'aurait fait
 *  attackThenAdvance juste après doAttack). No-op si le combat est terminé. */
function resumeEnemyTurn(get: () => GameState, set: any): void {
  const b = get().battle;
  if (!b || b.over) return;
  setTimeout(() => advanceTurn(get, set), 500);
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
      // infériorité numérique n'est pas modélisée).
      for (const c of battle.combatants) {
        if (!isOutOfAction(c) && c.advantage > 0 && !c.gainedAdvThisRound) c.advantage -= 1;
        c.gainedAdvThisRound = false;
      }
      decayEngagement(battle.combatants); // Engagé tombe si aucun coup échangé ce Round (LDB 13-Combat l.175)
    }
    const next = battle.combatants.find((c) => c.id === battle!.order[turn]);
    if (next && !isOutOfAction(next)) break;
  }
  // La posture « Sur la défensive » expire au début du tour de son porteur (LDB Combat l.118).
  const newActive = battle.combatants.find((c) => c.id === battle!.order[turn]);
  if (newActive) newActive.defensiveStance = false;
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

export { activeCombatant };

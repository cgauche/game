import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame, type BattleState } from './store';
import { buildAdvancementView } from './advancement';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { testScene } from '../scenes/test-fixture';
import { emptyScene } from './scene';
import { makeInteriorScene } from '../scenes/interiors';
import type { BuildingFeature } from './scene';
import type { Combatant, ItemInstance, Weapon } from '../engine/types';
import { isOutOfAction } from '../engine/conditions';
import { applyAttackResult, applyEffects, computeMoveReach } from './combatFlow';
import { mountUp } from './mount';
import { combatValue } from '../engine/combat';
import { seedBattleRng } from './battleRng';
import type { AttackResult } from '../engine/combat';
import { CAMPAIGN_START, MINUTES_PER_DAY } from '../engine/clock';
import { TIME_COST } from '../engine/timeCost';
import { toBrass } from '../engine/money';

function reset() {
  useGame.setState({
    screen: 'menu',
    party: [],
    scene: null,
    mode: 'exploration',
    partyPos: { x: 0, y: 0 },
    flags: {},
    journal: [],
    dialogue: null,
    battle: null,
    pendingTest: null,
    pendingAttack: null,
    pendingDefense: null,
    pendingDeviation: null,
    pendingDisengage: null,
    pendingCast: null,
    pendingHeal: null,
    pendingRoundStart: null,
    pendingFateSave: null,
    pendingReload: null,
    pendingReveals: [],
    document: null,
    merchant: null,
    merchantStocks: {},
  });
}

describe('Boucle de jeu (store)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers(); // purge tout timer fuité d'un test précédent (startCombat arme maybeRunEnemyTurn)
    reset();
  });
  afterEach(() => {
    vi.clearAllTimers(); // les setTimeout d'IA (resumeEnemyTurn, attackThenAdvance) ne fuient pas vers le test suivant
    vi.useRealTimers();
  });

  it('setItemSkin pose le skin sur l’objet ET le propage à l’arme active (recomputeLoadout)', () => {
    const hero = {
      id: 'h1', name: 'Test', kind: 'hero',
      characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
      wounds: { current: 10, max: 10 }, advantage: 0, conditions: [], movement: 4, skills: [], talents: [],
      weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
      items: [{ uid: 'w1', name: 'Épée bâtarde', kind: 'melee', damage: '+BF+5', qualities: [], enc: 1, equipped: true } as ItemInstance],
    } as unknown as Combatant;
    useGame.setState({ party: [hero] });

    useGame.getState().setItemSkin('h1', 'w1', { metal: '#caa64a' });
    let h = useGame.getState().party[0];
    expect(h.items?.find((i) => i.uid === 'w1')?.skin).toEqual({ metal: '#caa64a' });
    expect(h.weapons.find((w) => w.name === 'Épée bâtarde')?.skin).toEqual({ metal: '#caa64a' }); // propagé à l'arme

    useGame.getState().setItemSkin('h1', 'w1', { metal: undefined }); // reset du seul slot → skin retiré
    h = useGame.getState().party[0];
    expect(h.items?.find((i) => i.uid === 'w1')?.skin).toBeUndefined();
    expect(h.weapons.find((w) => w.name === 'Épée bâtarde')?.skin).toBeUndefined();
  });

  it('charge une scène et place le groupe au départ', () => {
    useGame.getState().startScene(testScene);
    const st = useGame.getState();
    expect(st.scene?.id).toBe('test-fixture');
    expect(st.partyPos).toEqual({ x: 6, y: 10 });
    expect(st.mode).toBe('exploration');
  });

  it('persiste Blessures + critiques + États persistants vers le groupe en fin de combat (victoire)', () => {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(1) });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers(); // purge le timer d'IA armé par startCombat — on pilote l'ordre nous-mêmes

    const b = useGame.getState().battle!;
    // Héros blessé + 1 État persistant + 1 transitoire + 1 critique ; tous les ennemis hors de combat.
    const combatants = b.combatants.map((c) =>
      c.kind === 'hero'
        ? { ...c, wounds: { ...c.wounds, current: 4 }, criticalWounds: 1,
            conditions: [{ name: 'Hémorragique', value: 2 }, { name: 'Surpris', value: 1 }] }
        : { ...c, dead: true },
    );
    const heroId = combatants.find((c) => c.kind === 'hero')!.id;
    const enemyIds = combatants.filter((c) => c.kind === 'enemy').map((c) => c.id);
    // Ordre = ennemis puis héros ; on se place juste AVANT le héros pour que le prochain tour soit le sien
    // (évite un franchissement de Round, donc pas de tick Hémorragique pendant le test).
    const order = [...enemyIds, heroId];
    useGame.setState({ battle: { ...b, combatants, order, turn: order.length - 2 }, pendingReveals: [] });

    useGame.getState().battleEndTurn(); // → advanceTurn → prochain acteur = héros → checkBattleOver → victoire → writeback

    const st = useGame.getState();
    expect(st.battle?.over).toBe('victory');
    const h = st.party[0];
    expect(h.wounds.current).toBe(4);                                              // Blessures persistées
    expect(h.criticalWounds).toBe(1);                                             // critiques persistés
    expect(h.conditions.find((x) => x.name === 'Hémorragique')?.value).toBe(2);    // persistant conservé
    expect(h.conditions.some((x) => x.name === 'Surpris')).toBe(false);            // transitoire jeté
  });

  // ── Déviation Critique côté JOUEUR (LDB 63 l.63-66) : suspend re-entrant + choix Dévier/Subir ──
  // Un héros encaisse un Coup Critique à une localisation armurée → applyAttackResult SUSPEND
  // (pendingDeviation, AUCUN effet de bord) ; la décision rejoue l'application UNE seule fois.
  function mkDeviationSetup() {
    seedBattleRng(424242); // table des Critiques déterministe (branche « Subir »)
    const chars = { CC: 40, CT: 30, F: 40, E: 40, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 };
    const enemy = {
      id: 'e1', name: 'Brute', kind: 'enemy', characteristics: chars, wounds: { current: 20, max: 20 },
      advantage: 0, conditions: [], movement: 4, skills: [], talents: [], engagedWith: [], pos: { x: 1, y: 0 },
      size: 'moyenne', weapons: [{ name: 'Gourdin', type: 'melee', damage: '+BF', qualities: [] }],
      armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, items: [],
    } as unknown as Combatant;
    const hero = {
      id: 'h1', name: 'Hardi', kind: 'hero', characteristics: chars, wounds: { current: 15, max: 15 },
      advantage: 0, conditions: [], movement: 4, skills: [], talents: [], engagedWith: [], pos: { x: 0, y: 0 },
      size: 'moyenne', weapons: [], items: [], criticalWounds: 0, fate: 0,
      armour: { tete: 0, brasG: 0, brasD: 0, corps: 3, jambeG: 0, jambeD: 0 },
    } as unknown as Combatant;
    const battle: BattleState = {
      combatants: [enemy, hero], order: [enemy.id, hero.id], baseOrder: [enemy.id, hero.id],
      turn: 0, round: 1, action: null, selectedSpell: null, reachable: new Map(),
      movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
    };
    useGame.setState({ battle, mode: 'battle' });
    const weapon: Weapon = { name: 'Gourdin', type: 'melee', damage: '+BF', qualities: [] };
    const res: AttackResult = {
      hit: true, attackerRoll: 12, netSL: 4, location: 'corps', damage: 8, woundsLost: 3,
      critical: true, advantageTo: null, defenderDefeated: false, log: 'Coup Critique (corps)',
    };
    const suspended = applyAttackResult(useGame.getState, useGame.setState, enemy, hero, weapon, res);
    return { enemy, hero, weapon, res, suspended };
  }

  it('Déviation Critique (héros) : applyAttackResult SUSPEND sans aucun effet de bord', () => {
    const { suspended } = mkDeviationSetup();
    expect(suspended).toBe(true);
    const pdv = useGame.getState().pendingDeviation;
    expect(pdv).not.toBeNull();
    expect(pdv!.targetId).toBe('h1');
    // Avant le choix : ni Blessure, ni Critique, ni PA consommée (early-return propre).
    const h = useGame.getState().battle!.combatants.find((c) => c.id === 'h1')!;
    expect(h.wounds.current).toBe(15);
    expect(h.criticalWounds ?? 0).toBe(0);
    expect(h.armour.corps).toBe(3);
  });

  it('Déviation Critique (héros) : « Dévier » sacrifie 1 PA et IGNORE le Critique', () => {
    mkDeviationSetup();
    useGame.getState().deviationApply(true);
    const h = useGame.getState().battle!.combatants.find((c) => c.id === 'h1')!;
    expect(h.armour.corps).toBe(2);          // 1 PA sacrifiée (LDB 63 l.63-66)
    expect(h.criticalWounds ?? 0).toBe(0);   // Coup Critique ignoré
    expect(useGame.getState().pendingDeviation).toBeNull();
  });

  it('Déviation Critique (héros) : « Subir » encaisse le Critique (criticalWounds +1, PA intacte)', () => {
    mkDeviationSetup();
    useGame.getState().deviationApply(false);
    const h = useGame.getState().battle!.combatants.find((c) => c.id === 'h1')!;
    expect(h.criticalWounds ?? 0).toBe(1);   // Coup Critique appliqué (table 18-Traumatisme)
    expect(h.armour.corps).toBe(3);          // PA intacte (rien dévié)
    expect(useGame.getState().pendingDeviation).toBeNull();
  });

  // ── Phase C2a — qualité d'outil sur les Tests HORS COMBAT (Pratique/Peu Fiable/Bâclé) ──
  it('Effect.test : le nom d’outil est résolu vers pendingTest.itemUid (héros qui agit)', () => {
    const chars = { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 55, Int: 30, FM: 30, Soc: 30 };
    const hero = {
      id: 'h1', name: 'Lest', kind: 'hero', characteristics: chars, wounds: { current: 10, max: 10 },
      advantage: 0, conditions: [], movement: 4, skills: [], talents: [],
      armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
      items: [{ uid: 't1', name: 'Rossignols', kind: 'melee', qualities: ['Pratique'], enc: 0, equipped: false }],
    } as unknown as Combatant;
    useGame.setState({ party: [hero] });
    applyEffects(useGame.getState, useGame.setState, [
      { type: 'test', characteristic: 'Dex', tool: 'Rossignols', requireSL: 0, onSuccess: [], onFailure: [] },
    ]);
    const pt = useGame.getState().pendingTest!;
    expect(pt.itemUid).toBe('t1');
    expect(pt.isDouble).toBe(false); // amorcé à false (pas encore lancé)
  });

  it('testRoll peuple pendingTest.isDouble (booléen, pour la casse Bâclé)', () => {
    const hero = {
      id: 'h1', name: 'Lest', kind: 'hero',
      characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 50, Int: 30, FM: 30, Soc: 30 },
      wounds: { current: 10, max: 10 }, advantage: 0, conditions: [], movement: 4, skills: [], talents: [],
      armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, items: [],
    } as unknown as Combatant;
    useGame.setState({
      party: [hero],
      pendingTest: {
        actorId: 'h1', actorName: 'Lest', label: 'Test', skillValue: 50, difficulty: 'intermediaire',
        requireSL: 0, target: 50, roll: null, success: false, sl: 0, isDouble: undefined,
        onSuccess: [], onFailure: [],
      },
    });
    useGame.getState().testRoll();
    expect(typeof useGame.getState().pendingTest!.isDouble).toBe('boolean');
  });

  // resolveTest avec outil : pendingTest injecté à la main (RNG hors combat non seedable → déterministe).
  function mkToolTest(quality: string, over: Partial<import('./store').PendingTest>): Combatant {
    const hero = {
      id: 'h1', name: 'Lest', kind: 'hero',
      characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 50, Int: 30, FM: 30, Soc: 30 },
      wounds: { current: 10, max: 10 }, advantage: 0, conditions: [], movement: 4, skills: [], talents: [],
      armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
      items: [{ uid: 't1', name: 'Outil', kind: 'melee', qualities: quality ? [quality] : [], enc: 0, equipped: false }],
    } as unknown as Combatant;
    useGame.setState({
      party: [hero], flags: {}, journal: [],
      pendingTest: {
        actorId: 'h1', actorName: 'Lest', label: 'Test', skillValue: 50, difficulty: 'intermediaire',
        requireSL: 1, target: 50, roll: 48, success: false, sl: 0, isDouble: false, itemUid: 't1',
        onSuccess: [{ type: 'setFlag', flag: 'reussi', value: true }],
        onFailure: [{ type: 'setFlag', flag: 'rate', value: true }],
        ...over,
      },
    });
    return hero;
  }

  it('resolveTest : Pratique (+1 DR) repêche un échec qui n’a manqué que le seuil requireSL', () => {
    mkToolTest('Pratique', {}); // roll 48 ≤ 50, sl 0 < requireSL 1 → +1 DR ⇒ sl 1 ≥ 1
    useGame.getState().resolveTest();
    expect(useGame.getState().flags['reussi']).toBe(true);
  });

  it('resolveTest : Pratique ne transforme PAS un d100 raté (roll > cible) en réussite', () => {
    mkToolTest('Pratique', { roll: 60, sl: -1, requireSL: 0 }); // roll 60 > 50 → raté au dé
    useGame.getState().resolveTest();
    expect(useGame.getState().flags['rate']).toBe(true);
  });

  it('resolveTest : Peu Fiable (−1 DR) ne repêche pas (échec aggravé)', () => {
    mkToolTest('Peu Fiable', {}); // sl 0 −1 = −1 < requireSL 1 → reste raté
    useGame.getState().resolveTest();
    expect(useGame.getState().flags['rate']).toBe(true);
  });

  it('resolveTest : outil Bâclé qui Maladresse (échec + double) se brise', () => {
    mkToolTest('Bâclé', { roll: 55, sl: -1, requireSL: 0, isDouble: true });
    useGame.getState().resolveTest();
    const item = useGame.getState().party[0].items!.find((i) => i.uid === 't1')!;
    expect(item.destroyed).toBe(true);
    expect(useGame.getState().journal.some((l) => l.includes('se brise'))).toBe(true);
  });

  it('resolveTest : sans outil, l’issue est inchangée (branche échec)', () => {
    mkToolTest('', { itemUid: undefined });
    useGame.getState().resolveTest();
    expect(useGame.getState().flags['rate']).toBe(true);
  });

  it('ré-importe les États persistants du groupe au lancement du combat (carry-in)', () => {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(1) });
    // Le membre du groupe porte un État persistant (Hémorragique) et un transitoire (À Terre).
    useGame.setState({ party: [{ ...hero, conditions: [{ name: 'Hémorragique', value: 1 }, { name: 'À Terre', value: 1 }] }] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const h = useGame.getState().battle!.combatants.find((c) => c.kind === 'hero')!;
    expect(h.conditions.find((x) => x.name === 'Hémorragique')?.value).toBe(1); // persistant ré-importé
    expect(h.conditions.some((x) => x.name === 'À Terre')).toBe(false);          // transitoire ignoré
  });

  it("n'instancie pas un héros mort/éjecté au combat suivant", () => {
    const a = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(1) });
    const b = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'B', rng: makeRNG(2) });
    useGame.setState({ party: [a, { ...b, dead: true }] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const heroes = useGame.getState().battle!.combatants.filter((c) => c.kind === 'hero');
    expect(heroes.length).toBe(1);
    expect(heroes[0].name).toBe('A');
  });

  it('Maladresse — fumbleConfirm applique l’auto-blessure (Oups! 01-20)', () => {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(1) });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const h = b.combatants.find((c) => c.kind === 'hero')!;
    h.wounds.current = 10;
    useGame.setState({ battle: { ...b }, pendingFumble: { combatantId: h.id, weapon: h.weapons[0], result: { roll: 11, kind: 'selfWound', label: 'x' } } });
    useGame.getState().fumbleConfirm();
    const after = useGame.getState().battle!.combatants.find((c) => c.id === h.id)!;
    expect(after.wounds.current).toBe(9); // -1, ignore BE+PA
    expect(useGame.getState().pendingFumble).toBeNull();
  });

  it('Maladresse — trauma (Oups! 81-90) pose une Déchirure de jambe + 1 Blessure critique', () => {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(1) });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const h = b.combatants.find((c) => c.kind === 'hero')!;
    useGame.setState({ battle: { ...b }, pendingFumble: { combatantId: h.id, weapon: h.weapons[0], result: { roll: 85, kind: 'trauma', label: 'x' } } });
    useGame.getState().fumbleConfirm();
    const after = useGame.getState().battle!.combatants.find((c) => c.id === h.id)!;
    expect(after.criticalWounds).toBe(1);
    expect(after.traumas?.[0]?.movementHalved).toBe(true); // jambe → Mouvement ÷2
  });

  it('Maladresse — perte d’Action (Oups! 71-80) consommée au tour suivant', () => {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(1) });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const h = b.combatants.find((c) => c.kind === 'hero')!;
    h.loseNextAction = true;
    const enemyIds = b.combatants.filter((c) => c.kind === 'enemy').map((c) => c.id);
    const order = [...enemyIds, h.id]; // héros en dernier
    useGame.setState({ battle: { ...b, order, turn: order.length - 2 }, pendingReveals: [] }); // tour juste avant le héros
    useGame.getState().battleEndTurn(); // → advanceTurn → héros : Action perdue consommée
    const st = useGame.getState();
    const after = st.battle!.combatants.find((c) => c.id === h.id)!;
    expect(after.loseNextAction).toBeFalsy();
    expect(st.battle!.acted).toBe(true); // l'Action est consommée d'office
  });

  it('Maladresse — fumble du DÉFENSEUR héros (défense ratée + double) ouvre la modale avec reprise IA', () => {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(1) });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const h = b.combatants.find((c) => c.kind === 'hero')!;
    const e = b.combatants.find((c) => c.kind === 'enemy')!;
    // Résultat d'un Test opposé où la DÉFENSE du héros est ratée sur un double (33).
    const result = {
      hit: false, attackerRoll: 50, netSL: 0, critical: false, advantageTo: null, defenderDefeated: false,
      attackerDetail: { label: 'CC', base: 40, modifier: 0, target: 40, roll: 50, success: false, sl: -1 },
      defenderDetail: { label: 'Parade', base: 40, modifier: 0, target: 40, roll: 33, success: false, sl: 0 },
      log: 'x',
     
    } as any;
    useGame.setState({
      battle: { ...b },
      pendingDefense: {
        attackerId: e.id, defenderId: h.id, weapon: e.weapons[0], location: null,
        atk: { roll: 50, target: 40, success: false, sl: -1, isDouble: false },
        mode: 'parade',
        def: { roll: 33, target: 40, success: false, sl: 0, isDouble: true },
        result,
      },
    });
    useGame.getState().defenseConfirm();
    const st = useGame.getState();
    expect(st.pendingFumble?.combatantId).toBe(h.id);
    expect(st.pendingFumble?.resumeAfter).toBe(true);
  });

  it('Maladresse — « agir en dernier » (21-40) ne dure qu’UN Round (ordre canonique restauré)', () => {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(1) });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    b.combatants.forEach((c) => { c.fortune = 0; }); // neutralise la pré-emption Chance
    const h = b.combatants.find((c) => c.kind === 'hero')!;
    h.actLastNextRound = true;
    const base = [...(b.baseOrder ?? b.order)];
    useGame.setState({ battle: { ...b, turn: b.order.length - 1 }, pendingReveals: [] }); // au dernier tour → prochain endTurn franchit le Round
    useGame.getState().battleEndTurn();
    let st = useGame.getState();
    expect(st.battle!.order[st.battle!.order.length - 1]).toBe(h.id); // héros repoussé en dernier ce Round
    expect(st.battle!.combatants.find((c) => c.id === h.id)!.actLastNextRound).toBeFalsy(); // flag purgé
    // Franchir un 2e Round : « Commencer le round 2 » d'abord (pendant la pause PERSONNE n'est
    // actif et advanceTurn est inerte), puis fin du dernier tour → ordre canonique restauré.
    useGame.getState().confirmRoundStart();
    const b2 = useGame.getState().battle!;
    useGame.setState({ battle: { ...b2, turn: b2.order.length - 1 } });
    useGame.getState().battleEndTurn();
    st = useGame.getState();
    expect(st.battle!.order).toEqual(base);
  });

  it('Maladresse — l’usure d’arme (Oups! 21-40) écrit sur l’ItemInstance et persiste combat→combat', () => {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(1) });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    let b = useGame.getState().battle!;
    const h = b.combatants.find((c) => c.kind === 'hero')!;
    // L'arme tenue = l'ItemInstance source d'un Weapon actif (loadout) — plus de flag `equipped` d'arme.
    const witem = h.items!.find((i) => (i.kind === 'melee' || i.kind === 'ranged') && h.weapons.some((w) => w.uid === i.uid))!;
    const weapon = h.weapons.find((w) => w.uid === witem.uid) ?? h.weapons[0];
    // (1) Maladresse 21-40 → 1 Dégât d'arme, écrit sur l'ItemInstance source.
    useGame.setState({ battle: { ...b }, pendingFumble: { combatantId: h.id, weapon, result: { roll: 25, kind: 'weaponDamageActLast', label: 'x' } } });
    useGame.getState().fumbleConfirm();
    const hMid = useGame.getState().battle!.combatants.find((c) => c.id === h.id)!;
    expect(hMid.items!.find((i) => i.name === witem.name)!.damageTaken).toBe(1);
    // (2) Fin de combat (victoire) → writeback vers le groupe.
    b = useGame.getState().battle!;
    const combatants = b.combatants.map((c) => (c.kind === 'hero' ? c : { ...c, dead: true }));
    const order = [...combatants.filter((c) => c.kind === 'enemy').map((c) => c.id), h.id];
    useGame.setState({ battle: { ...b, combatants, order, turn: order.length - 2 }, pendingReveals: [] });
    useGame.getState().battleEndTurn();
    expect(useGame.getState().battle?.over).toBe('victory');
    expect(useGame.getState().party[0].items!.find((i) => i.name === witem.name)!.damageTaken).toBe(1);
    // (3) Combat suivant : l'usure est ré-importée (carry-in + recomputeLoadout).
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const h2 = useGame.getState().battle!.combatants.find((c) => c.kind === 'hero')!;
    expect(h2.items!.find((i) => i.name === witem.name)!.damageTaken).toBe(1);
  });

  it('marcher sur une tuile-porte (reveal door) déclenche une transition', () => {
    const interior = emptyScene(5, 5);
    interior.id = 'interieur-test';
    interior.entities.push({ id: 'hs', kind: 'heroStart', pos: { x: 1, y: 1 } });
    const exterior = emptyScene(8, 8);
    exterior.id = 'exterieur-test';
    exterior.entities.push({ id: 'hs', kind: 'heroStart', pos: { x: 0, y: 0 } });
    exterior.buildings = [
      {
        id: 'chap',
        type: 'chapelle',
        foot: { x: 2, y: 2, w: 3, h: 3 },
        reveal: 'door',
        door: { x: 3, y: 4 },
        interiorScene: 'interieur-test',
      },
    ];
    useGame.getState().startScene(interior); // enregistre l'intérieur
    useGame.getState().startScene(exterior); // charge l'extérieur (départ 0,0)
    useGame.getState().moveParty({ x: 3, y: 4 }); // sur la porte
    expect(useGame.getState().scene?.id).toBe('interieur-test');
  });

  it('incanter un Projectile magique résout l’incantation et consomme l’action', () => {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Sorcier', name: 'Mage', rng: makeRNG(3) });
    hero.characteristics.Int = 90; // assurer le lancement (NI 0)
    hero.spells = ['Fléchette'];
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    let st = useGame.getState();
    const heroC = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    const enemy = st.battle!.combatants.find((c) => c.kind === 'enemy')!;
    const turn = st.battle!.order.indexOf(heroC.id);
    useGame.setState({ battle: { ...st.battle!, turn, action: 'cast', selectedSpell: 'Fléchette', acted: false } });
    // Flux par modale : cliquer la cible OUVRE l'incantation (jet différé), n'applique rien.
    useGame.getState().battleClickEntity(enemy.id);
    expect(useGame.getState().pendingCast).not.toBeNull();
    expect(useGame.getState().battle!.acted).toBe(false); // pas encore lancé
    useGame.getState().castRoll(); // « Lancer » : fige le jet
    expect(useGame.getState().pendingCast!.result).not.toBeNull();
    useGame.getState().castConfirm(); // « Appliquer » : résout
    st = useGame.getState();
    // L'action est consommée, l'incantation journalisée, et la modale fermée.
    expect(st.battle!.acted).toBe(true);
    expect(st.battle!.action).toBeNull();
    expect(st.battle!.log.some((l) => l.text.includes('Fléchette'))).toBe(true);
    expect(st.pendingCast).toBeNull();
  });

  it('une Bénédiction de bonus pose un effet actif temporisé sur la cible', () => {
    const pretre = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Prêtre', name: 'Prêtre', rng: makeRNG(8) });
    pretre.characteristics.Soc = 95; // assurer la réussite de la Prière
    pretre.spells = ['Bénédiction de Bataille'];
    useGame.setState({ party: [pretre] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    let st = useGame.getState();
    const heroC = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    const turn = st.battle!.order.indexOf(heroC.id);
    useGame.setState({ battle: { ...st.battle!, turn, action: 'cast', selectedSpell: 'Bénédiction de Bataille', acted: false } });
    useGame.getState().battleClickEntity(heroC.id); // se cibler soi-même → ouvre la modale
    useGame.getState().castRoll(); // « Lancer »
    useGame.getState().castConfirm(); // « Appliquer »
    st = useGame.getState();
    const after = st.battle!.combatants.find((c) => c.id === heroC.id)!;
    const failed = st.battle!.log.some((l) => l.text.includes('échoue'));
    if (!failed) {
      expect(after.activeEffects?.some((e) => e.char === 'CC' && e.bonus === 10)).toBe(true);
    }
    expect(st.battle!.acted).toBe(true);
  });

  it('porte → intérieur → retour (transitionBack) : aller-retour complet', () => {
    const interior = makeInteriorScene({ id: 'int-test', nom: 'Intérieur test', w: 6, h: 6 });
    const exterior = emptyScene(8, 8);
    exterior.id = 'ext-test';
    exterior.entities.push({ id: 'hs', kind: 'heroStart', pos: { x: 0, y: 0 } });
    const chapel: BuildingFeature = {
      id: 'chap',
      type: 'chapelle',
      foot: { x: 2, y: 2, w: 3, h: 3 },
      reveal: 'door',
      facing: 'S',
      door: { x: 3, y: 4 },
      interiorScene: 'int-test',
    };
    exterior.buildings = [chapel];
    useGame.getState().startScene(interior); // enregistre l'intérieur
    useGame.getState().startScene(exterior); // charge l'extérieur
    // on se place SOUS la porte puis on entre (pour mémoriser un retour hors du bâtiment)
    useGame.setState({ partyPos: { x: 3, y: 5 } });
    useGame.getState().moveParty({ x: 3, y: 4 }); // sur la porte → intérieur
    expect(useGame.getState().scene?.id).toBe('int-test');
    // sortie : la porte de l'intérieur est en bas-centre (3,5) ; y marcher → retour
    useGame.getState().moveParty({ x: 3, y: 5 });
    expect(useGame.getState().scene?.id).toBe('ext-test');
    expect(useGame.getState().partyPos).toEqual({ x: 3, y: 5 }); // retour à la case d'entrée
  });

  it('une attaque de héros adjacent retire des Blessures', () => {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(3) });
    hero.characteristics.CC = 70; // CC élevée + seed fixe → touche déterministe
    useGame.setState({ party: [hero] });
    useGame.getState().seedRng(2); // RNG de combat contrôlé : seed 2 ⇒ touche avec dégâts (cf. recherche)
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    let st = useGame.getState();
    const heroC = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    const enemy = st.battle!.combatants.find((c) => c.kind === 'enemy')!;
    // Forcer l'adjacence et le tour du héros.
    heroC.pos = { x: enemy.pos!.x - 1, y: enemy.pos!.y };
    const order = st.battle!.order;
    const turn = order.indexOf(heroC.id);
    useGame.setState({ battle: { ...st.battle!, turn, action: null, movementUsed: 99, movedPreAction: false, acted: false } });
    const before = enemy.wounds.current;
    useGame.getState().battleClickEntity(enemy.id, { confirm: true }); // ouvre la modale d'attaque
    useGame.getState().attackRoll(); // lance le jet
    useGame.getState().attackConfirm(); // applique le résultat
    st = useGame.getState();
    const enemyAfter = st.battle!.combatants.find((c) => c.id === enemy.id)!;
    expect(enemyAfter.wounds.current).toBeLessThan(before);
  });

  it('un test de compétence hors combat : Lancer, Chance, puis acquittement', () => {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(3) });
    hero.fortune = 2;
    useGame.setState({
      party: [hero],
      flags: {},
      pendingTest: {
        actorId: hero.id,
        actorName: hero.name,
        label: 'Test de Force',
        skillValue: 95,
        difficulty: 'intermediaire',
        requireSL: 0,
        target: 95,
        roll: null, // pas encore lancé
        success: false,
        sl: 0,
        onSuccess: [{ type: 'setFlag', flag: 'reussi', value: true }],
        onFailure: [],
      },
    });
    // Acquittement bloqué tant que le jet n'a pas eu lieu.
    useGame.getState().resolveTest();
    expect(useGame.getState().pendingTest).not.toBeNull();
    // « Lancer » : le jet se fait.
    useGame.getState().testRoll();
    expect(useGame.getState().pendingTest!.roll).not.toBeNull();
    // Forcer un jet propre RATÉ (cible 95) pour exercer la relance (gate « jet raté », LDB ch.12 l.29-31).
    useGame.setState({ pendingTest: { ...useGame.getState().pendingTest!, roll: 99, success: false } });
    // Chance : relance et consomme un point.
    useGame.getState().testReroll();
    expect(useGame.getState().party[0].fortune).toBe(1);
    expect(useGame.getState().pendingTest!.roll).not.toBeNull();
    // Acquittement : ferme la modale.
    useGame.getState().resolveTest();
    expect(useGame.getState().pendingTest).toBeNull();
  });

  it('attaquer une cible Sonnée en mêlée donne +1 Avantage à l’attaquant (LDB États l.123)', () => {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(3) });
    useGame.setState({ party: [hero] });
    useGame.getState().seedRng(2);
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    let st = useGame.getState();
    const heroC = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    const enemy = st.battle!.combatants.find((c) => c.kind === 'enemy')!;
    enemy.conditions.push({ name: 'Sonné', value: 1 });
    heroC.advantage = 0;
    heroC.pos = { x: enemy.pos!.x - 1, y: enemy.pos!.y }; // adjacent
    const turn = st.battle!.order.indexOf(heroC.id);
    useGame.setState({ battle: { ...st.battle!, turn, action: null, movementUsed: 99, movedPreAction: false, acted: false } });
    useGame.getState().battleClickEntity(enemy.id, { confirm: true }); // ouvre la modale
    useGame.getState().attackRoll(); // le +1 Sonné s'applique AVANT le jet
    st = useGame.getState();
    const heroAfter = st.battle!.combatants.find((c) => c.id === heroC.id)!;
    expect(heroAfter.advantage).toBe(1);
  });

  it('défense réactive : Défendre → résultat ; Chance relance la défense (attaque FIGÉE) ; Appliquer ferme', () => {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(3) });
    useGame.setState({ party: [hero] });
    useGame.getState().seedRng(4);
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    const st = useGame.getState();
    const H = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    const E = st.battle!.combatants.find((c) => c.kind === 'enemy')!;
    H.fortune = 2;
    useGame.setState({
      pendingDefense: {
        attackerId: E.id,
        defenderId: H.id,
        weapon: E.weapons[0],
        location: null,
        atk: { roll: 35, target: 50, success: true, sl: 1, isDouble: false },
        mode: 'parade',
        def: null,
        result: null,
      },
    });
    useGame.getState().defenseRoll(); // « Défendre » : roule la défense + résout
    let pd = useGame.getState().pendingDefense!;
    expect(pd.result).not.toBeNull();
    expect(pd.def).not.toBeNull();
    // Forcer une défense propre RATÉE pour exercer la relance (gate « jet raté », LDB ch.12 l.29-31).
    useGame.setState({ pendingDefense: { ...pd, def: { ...pd.def!, success: false } } });
    const atkRoll = pd.atk.roll;
    useGame.getState().defenseReroll(); // Chance : relance la DÉFENSE
    pd = useGame.getState().pendingDefense!;
    expect(useGame.getState().battle!.combatants.find((c) => c.id === H.id)!.fortune).toBe(1); // 1 point dépensé
    expect(pd.atk.roll).toBe(atkRoll); // l'attaque (pd.atk) n'est JAMAIS relancée
    useGame.getState().defenseConfirm(); // Appliquer → ferme
    expect(useGame.getState().pendingDefense).toBeNull();
  });

  it('un ennemi qui attaque un héros en mêlée OUVRE la modale de défense (tour de l’IA suspendu)', () => {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(3) });
    useGame.setState({ party: [hero] });
    useGame.getState().seedRng(5);
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers(); // purge le timer d'IA armé par startCombat → on pilote nous-mêmes l'ordre du tour
    let st = useGame.getState();
    const H = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    const E = st.battle!.combatants.find((c) => c.kind === 'enemy')!;
    E.pos = { x: H.pos!.x + 1, y: H.pos!.y }; // adjacent au héros
    for (const c of st.battle!.combatants) if (c.kind === 'enemy' && c.id !== E.id) c.wounds.current = 0; // un seul ennemi vivant
    useGame.setState({
      battle: { ...st.battle!, order: [H.id, E.id], turn: 0, action: null, movementUsed: 0, movedPreAction: false, acted: false },
      pendingDefense: null,
      pendingReveals: [],
      pendingRoundStart: null, // on pilote le combat → la pause d'ouverture est levée (sinon l'IA est gelée)
    });
    useGame.getState().battleEndTurn(); // H finit son tour → advanceTurn → E actif → IA
    vi.advanceTimersByTime(2000); // laisse tourner les setTimeout de l'IA (450 + 350)
    st = useGame.getState();
    expect(st.pendingDefense).not.toBeNull();
    expect(st.pendingDefense!.defenderId).toBe(H.id);
    expect(st.pendingDefense!.result).toBeNull(); // figé sur le choix, pas encore défendu
    expect(st.battle!.order[st.battle!.turn]).toBe(E.id); // tour SUSPENDU sur l'attaquant (non avancé)
  });

  it('attaque IA MONTÉE : le jet figé de la modale de défense porte le +20 Combat monté (LDB 14 l.217)', () => {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(3) });
    useGame.setState({ party: [hero] });
    useGame.getState().seedRng(5);
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    let st = useGame.getState();
    const H = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    const E = st.battle!.combatants.find((c) => c.kind === 'enemy')!;
    E.pos = { x: H.pos!.x + 1, y: H.pos!.y };
    for (const c of st.battle!.combatants) if (c.kind === 'enemy' && c.id !== E.id) c.wounds.current = 0;
    // Monture GRANDE sous l'ennemi (Moyenne) : le cavalier frappe le héros (Moyenne < Grande) à +20.
    const horse = {
      id: 'horse-test', name: 'Cheval (test)', kind: 'enemy', size: 'grande', movement: 8,
      characteristics: { ...E.characteristics }, talents: [], items: [], weapons: [],
      wounds: { current: 10, max: 10, base: 10 }, conditions: [], pos: { ...E.pos! },
    } as unknown as Combatant;
    mountUp(E, horse);
    useGame.setState({
      battle: { ...st.battle!, combatants: [...st.battle!.combatants, horse], order: [H.id, E.id], turn: 0, action: null, movementUsed: 0, movedPreAction: false, acted: false },
      facing: { ...useGame.getState().facing, [H.id]: 'E' }, // face à l'attaquant → pas de Flanc/dos parasite
      pendingDefense: null,
      pendingReveals: [],
      pendingRoundStart: null,
    });
    useGame.getState().battleEndTurn(); // H finit → E (cavalier) actif → IA attaque
    vi.advanceTimersByTime(2000);
    st = useGame.getState();
    expect(st.pendingDefense).not.toBeNull();
    // +20 Combat monté (cible plus petite que la monture, l.217) + 20 Surnombre (la monture est un
    // combattant ennemi actif au contact → « 2 contre 1 », LDB 14 l.92 — même décompte que resolveAttack).
    expect(st.pendingDefense!.atk.target).toBe(combatValue(E, 'melee', E.weapons[0]) + 40);
  });

  it('Sonné : un héros actif ne peut PAS attaquer/incanter, mais peut se déplacer (LDB États l.123)', () => {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(3) });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    const st = useGame.getState();
    const H = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    H.conditions.push({ name: 'Sonné', value: 1 });
    const E = st.battle!.combatants.find((c) => c.kind === 'enemy')!;
    E.pos = { x: H.pos!.x + 1, y: H.pos!.y }; // adjacent : seul le Sonné bloque l'attaque
    const turn = st.battle!.order.indexOf(H.id);
    useGame.setState({ battle: { ...st.battle!, turn, action: null, movementUsed: 0, movedPreAction: false, acted: false } });
    useGame.getState().battleClickEntity(E.id, { confirm: true });
    expect(useGame.getState().pendingAttack).toBeNull(); // Action refusée (Sonné)
    expect(computeMoveReach(useGame.getState).size).toBeGreaterThan(0); // le déplacement reste permis (à demi-Mouvement)
  });

  it('Sonné : un ennemi renonce à son Action — pas d’attaque, pas de modale de défense', () => {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(3) });
    useGame.setState({ party: [hero] });
    useGame.getState().seedRng(5);
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers(); // purge le timer d'IA armé par startCombat → on pilote nous-mêmes l'ordre du tour
    let st = useGame.getState();
    const H = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    const E = st.battle!.combatants.find((c) => c.kind === 'enemy')!;
    E.pos = { x: H.pos!.x + 1, y: H.pos!.y }; // adjacent
    E.conditions.push({ name: 'Sonné', value: 1 }); // l'ennemi est Sonné
    for (const c of st.battle!.combatants) if (c.kind === 'enemy' && c.id !== E.id) c.wounds.current = 0;
    const woundsBefore = H.wounds.current;
    useGame.setState({
      battle: { ...st.battle!, order: [H.id, E.id], turn: 0, action: null, movementUsed: 0, movedPreAction: false, acted: false },
      pendingDefense: null,
      pendingReveals: [],
    });
    useGame.getState().battleEndTurn(); // H finit → E actif → IA : Sonné → renonce
    vi.advanceTimersByTime(2000);
    st = useGame.getState();
    expect(st.pendingDefense).toBeNull(); // aucune attaque → aucune modale de défense
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.wounds.current).toBe(woundsBefore); // héros intact
  });

  // ── Couche tactique : Engagé + Charge + Désengagement (LDB 13-Combat / 15-Déplacement) ──
  const mh = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

  it('Engagé : une attaque de mêlée pose le lien des deux côtés (LDB 13-Combat l.174-175)', () => {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(3) });
    hero.characteristics.CC = 70;
    useGame.setState({ party: [hero] });
    useGame.getState().seedRng(2);
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    let st = useGame.getState();
    const H = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    const E = st.battle!.combatants.find((c) => c.kind === 'enemy')!;
    H.pos = { x: E.pos!.x - 1, y: E.pos!.y };
    const turn = st.battle!.order.indexOf(H.id);
    useGame.setState({ battle: { ...st.battle!, turn, action: null, movementUsed: 99, movedPreAction: false, acted: false } });
    useGame.getState().battleClickEntity(E.id, { confirm: true });
    useGame.getState().attackRoll();
    useGame.getState().attackConfirm();
    st = useGame.getState();
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.engagedWith).toContain(E.id);
    expect(st.battle!.combatants.find((c) => c.id === E.id)!.engagedWith).toContain(H.id);
  });

  it('Charge : se ruer au contact depuis 2 cases donne +1 Avantage (strict l.77) et impose l’attaque', () => {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(3) });
    useGame.setState({ party: [hero] });
    useGame.getState().seedRng(7);
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    let st = useGame.getState();
    const H = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    const E = st.battle!.combatants.find((c) => c.kind === 'enemy')!;
    H.pos = { x: 6, y: 10 };
    H.advantage = 0;
    E.pos = { x: 8, y: 10 }; // 2 cases à l'est, couloir libre
    for (const c of st.battle!.combatants) if (c.kind === 'enemy' && c.id !== E.id) c.wounds.current = 0;
    const turn = st.battle!.order.indexOf(H.id);
    useGame.setState({ battle: { ...st.battle!, turn, action: null, movementUsed: 0, movedPreAction: false, acted: false } });
    useGame.getState().battleClickEntity(E.id, { confirm: true }); // Charge implicite (mêlée + non Engagé + Mvt intact)
    st = useGame.getState();
    const Ha = st.battle!.combatants.find((c) => c.id === H.id)!;
    expect(Ha.advantage).toBe(1); // chargé de 2 cases (M4, seuil 2) → +1 (strict l.77)
    expect(mh(Ha.pos!, E.pos!)).toBe(1); // arrivé au contact
    expect(st.pendingAttack?.fromCharge).toBe(true); // l'attaque doit suivre (l.75) — modale non annulable
  });

  it('Charge interdite si déjà Engagé (LDB 15-Dépl l.74)', () => {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(3) });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    let st = useGame.getState();
    const H = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    const E = st.battle!.combatants.find((c) => c.kind === 'enemy')!;
    H.pos = { x: 6, y: 10 };
    H.advantage = 0;
    H.engagedWith = [E.id];
    E.pos = { x: 8, y: 10 };
    const turn = st.battle!.order.indexOf(H.id);
    useGame.setState({ battle: { ...st.battle!, turn, action: null, movementUsed: 0, movedPreAction: false, acted: false } });
    useGame.getState().battleClickEntity(E.id, { confirm: true }); // Engagé → pas de Charge (plan blocked)
    st = useGame.getState();
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.advantage).toBe(0); // pas de charge
    expect(st.pendingAttack).toBeNull();
  });

  it('attackCancel est sans effet après une Charge (attaque obligatoire, LDB 15-Dépl l.75)', () => {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(3) });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    const st = useGame.getState();
    const H = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    const E = st.battle!.combatants.find((c) => c.kind === 'enemy')!;
    useGame.setState({ pendingAttack: { attackerId: H.id, targetId: E.id, location: null, result: null, fromCharge: true } });
    useGame.getState().attackCancel();
    expect(useGame.getState().pendingAttack).not.toBeNull(); // toujours là (charge)
  });

  it('Combat monté — cliquer un couple ouvre le choix cavalier/monture puis cible l’id choisi (LDB 14 l.219)', () => {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(3) });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    let st = useGame.getState();
    const H = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    const enemies = st.battle!.combatants.filter((c) => c.kind === 'enemy');
    const mount = enemies[0];
    const rider = enemies[1];
    H.pos = { x: 6, y: 10 };
    mount.pos = { x: 7, y: 10 };
    mount.riderId = rider.id; // #0 = monture
    rider.pos = { x: 7, y: 10 };
    rider.mountId = mount.id; // #1 = cavalier (sur #0)
    for (const c of enemies.slice(2)) c.wounds.current = 0; // neutralise les autres
    const turn = st.battle!.order.indexOf(H.id);
    useGame.setState({ battle: { ...st.battle!, turn, action: null, movementUsed: 0, movedPreAction: false, acted: false } });
    // Clic confirmé sur la monture → la modale de choix s'ouvre (pas d'attaque encore).
    useGame.getState().battleClickEntity(mount.id, { confirm: true });
    st = useGame.getState();
    expect(st.pendingMountTarget).toEqual({ riderId: rider.id, mountId: mount.id });
    expect(st.pendingAttack).toBeNull();
    // Choisir la monture → modale fermée + attaque ciblée sur la monture.
    useGame.getState().mountTargetSelect(mount.id);
    st = useGame.getState();
    expect(st.pendingMountTarget).toBeNull();
    expect(st.pendingAttack?.targetId).toBe(mount.id);
  });

  it('Désengagement A : Avantage supérieur → partir en le sacrifiant, sans consommer l’Action (LDB 15-Dépl l.87)', () => {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(3) });
    useGame.setState({ party: [hero] });
    useGame.getState().seedRng(3);
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    let st = useGame.getState();
    const H = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    const E = st.battle!.combatants.find((c) => c.kind === 'enemy')!;
    H.engagedWith = [E.id];
    E.engagedWith = [H.id];
    H.advantage = 2;
    E.advantage = 0;
    const turn = st.battle!.order.indexOf(H.id);
    useGame.setState({ battle: { ...st.battle!, turn, action: null, movementUsed: 0, movedPreAction: false, acted: false } });
    useGame.getState().battleDisengage(); // ouvre le menu de choix
    expect(useGame.getState().pendingDisengage!.phase).toBe('choice');
    expect(useGame.getState().pendingDisengage!.canSacrifice).toBe(true); // Avantage supérieur → option dispo
    useGame.getState().disengageConfirmA(); // « Sacrifier l'Avantage »
    st = useGame.getState();
    const Ha = st.battle!.combatants.find((c) => c.id === H.id)!;
    expect(Ha.advantage).toBe(0); // Avantage sacrifié (l.87)
    expect(Ha.engagedWith).toEqual([]); // libéré de tous
    expect(st.battle!.acted).toBe(false); // « Sacrifier » NE consomme PAS l'Action
    expect(st.battle!.action).toBeNull(); expect(st.battle!.reachable.size).toBeGreaterThan(0); // mouvement libre rouvert (budget posé)
    expect(st.pendingDisengage).toBeNull();
  });

  it('Désengagement B échec : l’adversaire gagne +1 Avantage, fuite impossible, Action consommée (LDB 15-Dépl l.89)', () => {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(3) });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    let st = useGame.getState();
    const H = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    const E = st.battle!.combatants.find((c) => c.kind === 'enemy')!;
    H.engagedWith = [E.id];
    E.engagedWith = [H.id];
    const turn = st.battle!.order.indexOf(H.id);
    useGame.setState({
      battle: { ...st.battle!, turn, action: null, movementUsed: 0, movedPreAction: false, acted: false },
      pendingDisengage: {
        moverId: H.id,
        foeId: E.id,
        phase: 'esquive',
        canSacrifice: false,
        atk: { roll: 30, target: 40, success: true, sl: 1, isDouble: false },
        def: { roll: 80, target: 40, success: false, sl: -4, isDouble: false },
        result: 'failure',
      },
    });
    useGame.getState().disengageConfirm();
    st = useGame.getState();
    expect(st.battle!.combatants.find((c) => c.id === E.id)!.advantage).toBe(1); // adversaire +1 (l.89)
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.engagedWith).toContain(E.id); // toujours Engagé
    expect(st.battle!.acted).toBe(true); // l'Esquive consomme l'Action
    expect(st.pendingDisengage).toBeNull();
  });

  it('Désengagement B succès : +1 Avantage, libéré, Mouvement rouvert, Action consommée (LDB 15-Dépl l.89)', () => {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(3) });
    useGame.setState({ party: [hero] });
    useGame.getState().seedRng(3);
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    let st = useGame.getState();
    const H = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    const E = st.battle!.combatants.find((c) => c.kind === 'enemy')!;
    H.engagedWith = [E.id];
    E.engagedWith = [H.id];
    H.advantage = 0;
    const turn = st.battle!.order.indexOf(H.id);
    useGame.setState({
      battle: { ...st.battle!, turn, action: null, movementUsed: 0, movedPreAction: false, acted: false },
      pendingDisengage: {
        moverId: H.id,
        foeId: E.id,
        phase: 'esquive',
        canSacrifice: false,
        atk: { roll: 70, target: 40, success: false, sl: -3, isDouble: false },
        def: { roll: 10, target: 40, success: true, sl: 3, isDouble: false },
        result: 'success',
      },
    });
    useGame.getState().disengageConfirm();
    st = useGame.getState();
    const Ha = st.battle!.combatants.find((c) => c.id === H.id)!;
    expect(Ha.advantage).toBe(1); // +1 Avantage (l.89)
    expect(Ha.engagedWith).not.toContain(E.id); // libéré du foe testé
    expect(st.battle!.acted).toBe(true); // Action consommée
    expect(st.battle!.action).toBeNull(); expect(st.battle!.reachable.size).toBeGreaterThan(0); // Mouvement rouvert (budget posé)
  });

  it('Désengagement B : la Chance relance l’Esquive (le jet du foe reste figé)', () => {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(3) });
    useGame.setState({ party: [hero] });
    useGame.getState().seedRng(4);
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    const st = useGame.getState();
    const H = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    const E = st.battle!.combatants.find((c) => c.kind === 'enemy')!;
    H.fortune = 2;
    useGame.setState({
      pendingDisengage: {
        moverId: H.id,
        foeId: E.id,
        phase: 'esquive',
        canSacrifice: false,
        atk: { roll: 35, target: 45, success: true, sl: 1, isDouble: false },
        def: { roll: 90, target: 40, success: false, sl: -5, isDouble: false },
        result: 'failure',
      },
    });
    useGame.getState().disengageReroll();
    const stx = useGame.getState();
    expect(stx.battle!.combatants.find((c) => c.id === H.id)!.fortune).toBe(1); // 1 point dépensé
    expect(stx.pendingDisengage!.atk!.roll).toBe(35); // jet du foe NON relancé
  });

  it('Engagé : sélectionner « Déplacer » entre dans le Désengagement (LDB 15-Dépl l.84)', () => {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(3) });
    useGame.setState({ party: [hero] });
    useGame.getState().seedRng(6);
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    let st = useGame.getState();
    const H = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    const E = st.battle!.combatants.find((c) => c.kind === 'enemy')!;
    H.engagedWith = [E.id];
    E.engagedWith = [H.id];
    H.advantage = 0;
    E.advantage = 1; // force l'option B (Avantage non supérieur)
    const turn = st.battle!.order.indexOf(H.id);
    useGame.setState({ battle: { ...st.battle!, turn, action: null, movementUsed: 0, movedPreAction: false, acted: false } });
    useGame.getState().battleClickTile({ x: H.pos!.x - 1, y: H.pos!.y }, { confirm: true });
    st = useGame.getState();
    expect(st.pendingDisengage).not.toBeNull(); // routé vers le Désengagement
    expect(st.pendingDisengage!.phase).toBe('choice'); // clic-sol Engagé ouvre le menu de désengagement
  });

  it('Désengagement B égalité parfaite : statu quo — ni fuite, ni Avantage à l’adversaire', () => {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(3) });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    let st = useGame.getState();
    const H = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    const E = st.battle!.combatants.find((c) => c.kind === 'enemy')!;
    H.engagedWith = [E.id];
    E.engagedWith = [H.id];
    const turn = st.battle!.order.indexOf(H.id);
    useGame.setState({
      battle: { ...st.battle!, turn, action: null, movementUsed: 0, movedPreAction: false, acted: false },
      pendingDisengage: {
        moverId: H.id,
        foeId: E.id,
        phase: 'esquive',
        canSacrifice: false,
        atk: { roll: 40, target: 40, success: true, sl: 0, isDouble: false },
        def: { roll: 40, target: 40, success: true, sl: 0, isDouble: false },
        result: 'tie',
      },
    });
    useGame.getState().disengageConfirm();
    st = useGame.getState();
    expect(st.battle!.combatants.find((c) => c.id === E.id)!.advantage).toBe(0); // statu quo : pas de +1 à l'adversaire
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.engagedWith).toContain(E.id); // reste Engagé
    expect(st.battle!.acted).toBe(true); // l'Esquive tentée consomme l'Action
  });

  it('Désengagement B succès en multi-engagement : libère TOUS les adversaires (cohérent avec A)', () => {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(3) });
    useGame.setState({ party: [hero] });
    useGame.getState().seedRng(3);
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    let st = useGame.getState();
    const H = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    const enemies = st.battle!.combatants.filter((c) => c.kind === 'enemy');
    const [E1, E2] = enemies;
    H.engagedWith = [E1.id, E2.id];
    E1.engagedWith = [H.id];
    E2.engagedWith = [H.id];
    const turn = st.battle!.order.indexOf(H.id);
    useGame.setState({
      battle: { ...st.battle!, turn, action: null, movementUsed: 0, movedPreAction: false, acted: false },
      pendingDisengage: {
        moverId: H.id,
        foeId: E1.id, // testé contre E1
        phase: 'esquive',
        canSacrifice: false,
        atk: { roll: 70, target: 40, success: false, sl: -3, isDouble: false },
        def: { roll: 10, target: 40, success: true, sl: 3, isDouble: false },
        result: 'success',
      },
    });
    useGame.getState().disengageConfirm();
    st = useGame.getState();
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.engagedWith).toEqual([]); // libéré de E1 ET E2
  });

  it('Désengagement raté (Action consommée) : re-cliquer « Déplacer » ne relance PAS l’Esquive (anti-boucle)', () => {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(3) });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    let st = useGame.getState();
    const H = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    const E = st.battle!.combatants.find((c) => c.kind === 'enemy')!;
    H.engagedWith = [E.id];
    E.engagedWith = [H.id];
    const turn = st.battle!.order.indexOf(H.id);
    // État après une tentative d'Esquive RATÉE : Action consommée (acted), héros toujours Engagé.
    useGame.setState({ battle: { ...st.battle!, turn, action: null, movementUsed: 0, movedPreAction: false, acted: true }, pendingDisengage: null });
    const posBefore = { ...H.pos! };
    useGame.getState().battleClickTile({ x: posBefore.x - 1, y: posBefore.y }, { confirm: true }); // re-clic sol
    st = useGame.getState();
    expect(st.pendingDisengage).toBeNull(); // pas de NOUVELLE Esquive (l'Action est déjà dépensée)
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.pos).toEqual(posBefore); // ni déplacement libre
  });

  it('Désengagement — Fuir : adversaire +1 Avantage + attaque dans le dos, puis libéré et peut courir (LDB 15-Dépl l.98-109)', () => {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(3) });
    useGame.setState({ party: [hero] });
    useGame.getState().seedRng(5);
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    let st = useGame.getState();
    const H = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    const E = st.battle!.combatants.find((c) => c.kind === 'enemy')!;
    H.engagedWith = [E.id];
    E.engagedWith = [H.id];
    const eAdvBefore = E.advantage;
    const turn = st.battle!.order.indexOf(H.id);
    useGame.setState({
      battle: { ...st.battle!, turn, action: null, movementUsed: 0, movedPreAction: false, acted: false },
      pendingDisengage: { moverId: H.id, foeId: E.id, canSacrifice: false, phase: 'choice', atk: null, def: null, result: null },
    });
    useGame.getState().disengageFlee();
    st = useGame.getState();
    const Ea = st.battle!.combatants.find((c) => c.id === E.id)!;
    const Ha = st.battle!.combatants.find((c) => c.id === H.id)!;
    expect(Ea.advantage).toBeGreaterThanOrEqual(eAdvBefore + 1); // +1 immédiat (l.101), +1 de plus si touché
    expect(Ha.engagedWith).toEqual([]); // libéré de tous les Engagements
    expect(st.battle!.action).toBeNull(); expect(st.battle!.reachable.size).toBeGreaterThan(0); // peut courir (budget de Course posé)
    expect(st.pendingDisengage).toBeNull();
  });

  it('attaque en DIAGONALE : un ennemi diagonalement adjacent est à portée de mêlée (distance Chebyshev)', () => {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(3) });
    hero.characteristics.CC = 70;
    useGame.setState({ party: [hero] });
    useGame.getState().seedRng(2);
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    let st = useGame.getState();
    const H = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    const E = st.battle!.combatants.find((c) => c.kind === 'enemy')!;
    H.pos = { x: E.pos!.x - 1, y: E.pos!.y - 1 }; // DIAGONALE : Chebyshev 1, mais manhattan 2
    const turn = st.battle!.order.indexOf(H.id);
    useGame.setState({ battle: { ...st.battle!, turn, action: null, movementUsed: 99, movedPreAction: false, acted: false } });
    useGame.getState().battleClickEntity(E.id, { confirm: true }); // doit ouvrir la modale (avant : « hors de portée »)
    st = useGame.getState();
    expect(st.pendingAttack).not.toBeNull(); // attaque en diagonale autorisée
    expect(st.pendingAttack!.targetId).toBe(E.id);
  });
});

describe('Avancement par PX (store) — câblage moteur', () => {
  beforeEach(() => reset());

  const mkHero = (over: Partial<Combatant> = {}): Combatant =>
    ({
      id: 'h',
      name: 'H',
      kind: 'hero',
      species: 'Humains (Reiklander)',
      career: 'Agitateur', // Niveau 1 « Pamphlétaire » : caracs CT/Int/Soc, comp. Charme/Ragot, talent Sociable
      careerLevel: 1,
      characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
      wounds: { current: 12, max: 12 },
      advantage: 0,
      conditions: [],
      weapons: [],
      armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
      skills: [
        { name: 'Charme', characteristic: 'Soc', advances: 0 }, // in-carrière
        { name: 'Esquive', characteristic: 'Ag', advances: 0 }, // hors-carrière
      ],
      talents: [],
      movement: 4,
      xp: 0,
      charAdvances: {},
      ...over,
    }) as unknown as Combatant;

  const set1 = (h: Combatant) => useGame.setState({ party: [h] });
  const h0 = () => useGame.getState().party[0];

  it('grantXp : ajoute des PX au héros', () => {
    set1(mkHero({ xp: 0 }));
    useGame.getState().grantXp('h', 150);
    expect(h0().xp).toBe(150);
  });

  it('buyCharAdvance in-carrière (CT) : +1 valeur, +1 augmentation, coût 25', () => {
    set1(mkHero({ xp: 1000 }));
    useGame.getState().buyCharAdvance('h', 'CT');
    expect(h0().characteristics.CT).toBe(31);
    expect(h0().charAdvances!.CT).toBe(1);
    expect(h0().xp).toBe(975);
  });

  it('buyCharAdvance hors-carrière (CC) : coût doublé (50)', () => {
    set1(mkHero({ xp: 1000 }));
    useGame.getState().buyCharAdvance('h', 'CC');
    expect(h0().xp).toBe(950);
  });

  it('buyCharAdvance recalcule les Blessures quand le Bonus d’Endurance monte', () => {
    set1(
      mkHero({
        xp: 1000,
        characteristics: { CC: 30, CT: 30, F: 30, E: 39, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
        wounds: { current: 12, max: 12 },
      }),
    );
    useGame.getState().buyCharAdvance('h', 'E'); // 39→40 : BE 3→4, Blessures = BF + 2·BE + BFM = 3 + 8 + 3 = 14
    expect(h0().characteristics.E).toBe(40);
    expect(h0().wounds.max).toBe(14);
    expect(h0().wounds.current).toBe(14);
  });

  it('buySkillAdvance : Compétence connue in-carrière (Charme) +1, coût 10', () => {
    set1(mkHero({ xp: 1000 }));
    useGame.getState().buySkillAdvance('h', 'Charme');
    expect(h0().skills.find((s) => s.name === 'Charme')!.advances).toBe(1);
    expect(h0().xp).toBe(990);
  });

  it('buySkillAdvance : acquiert une Compétence de carrière non connue (Ragot) à advances 1', () => {
    set1(mkHero({ xp: 1000 }));
    useGame.getState().buySkillAdvance('h', 'Ragot');
    const ragot = h0().skills.find((s) => s.name === 'Ragot');
    expect(ragot).toBeTruthy();
    expect(ragot!.advances).toBe(1);
    expect(h0().xp).toBe(990);
  });

  it('buySkillAdvance : refuse une Compétence hors-carrière non connue', () => {
    set1(mkHero({ xp: 1000 }));
    useGame.getState().buySkillAdvance('h', 'Natation'); // ni connue, ni in-carrière
    expect(h0().skills.find((s) => s.name === 'Natation')).toBeUndefined();
    expect(h0().xp).toBe(1000);
  });

  it('buyTalent in-carrière (Sociable) : créé à times 1, coût 100', () => {
    set1(mkHero({ xp: 1000 }));
    useGame.getState().buyTalent('h', 'Sociable');
    expect(h0().talents.find((t) => t.name === 'Sociable')!.times).toBe(1);
    expect(h0().xp).toBe(900);
  });

  it('buyTalent hors-carrière : refusé (LDB l.97)', () => {
    set1(mkHero({ xp: 1000 }));
    useGame.getState().buyTalent('h', 'Castagneur'); // hors Niveau Agitateur
    expect(h0().talents.find((t) => t.name === 'Castagneur')).toBeUndefined();
    expect(h0().xp).toBe(1000);
  });

  it('changeCareer : 200 (non complété) + 100 (autre Classe, LDB 08 l.9) ; niveau 1 imposé', () => {
    // Agitateur (Citadins) → Érudit (Lettrés) : 200 + 100 PX.
    set1(mkHero({ xp: 350 }));
    useGame.getState().changeCareer('h', 'Érudit', 2); // niveau ≠ 1 → refusé (LDB 08 l.9)
    expect(h0().career).toBe('Agitateur');
    useGame.getState().changeCareer('h', 'Érudit', 1);
    expect(h0().career).toBe('Érudit');
    expect(h0().careerLevel).toBe(1);
    expect(h0().xp).toBe(50);
  });

  it('changeCareer : même Classe = pas de surcoût (Agitateur → Artisan, Citadins)', () => {
    set1(mkHero({ xp: 250 }));
    useGame.getState().changeCareer('h', 'Artisan', 1);
    expect(h0().career).toBe('Artisan');
    expect(h0().xp).toBe(50);
  });

  it('changeCareer : monter au niveau suivant refusé tant que le niveau n\'est pas complété (LDB 07 l.137)', () => {
    set1(mkHero({ xp: 1000 }));
    useGame.getState().changeCareer('h', 'Agitateur', 2);
    expect(h0().careerLevel).toBe(1); // refusé
    expect(h0().xp).toBe(1000);
  });

  it('buyTalent : Maxi 1 respecté (Lire/Écrire ×2 refusé, LDB 10)', () => {
    set1(mkHero({ xp: 1000 })); // Pamphlétaire : Lire/Écrire in-carrière
    useGame.getState().buyTalent('h', 'Lire/Écrire');
    expect(h0().talents.find((t) => t.name === 'Lire/Écrire')!.times).toBe(1);
    useGame.getState().buyTalent('h', 'Lire/Écrire');
    expect(h0().talents.find((t) => t.name === 'Lire/Écrire')!.times).toBe(1); // Maxi atteint
    expect(h0().xp).toBe(900);
  });

  it('buyTalent : « +5 Caractéristique de départ » appliqué à l\'achat (Guerrier né, LDB 10)', () => {
    set1(mkHero({ xp: 1000, career: 'Soldat' })); // Recrue : Guerrier né in-carrière
    useGame.getState().buyTalent('h', 'Guerrier né');
    expect(h0().characteristics.CC).toBe(35);
    expect(h0().charAdvances?.CC ?? 0).toBe(0); // « ne compte pas comme des Augmentations »
    expect(h0().xp).toBe(900);
  });

  it('emplacement « (Au choix) » : désignation gratuite d\'un talent d\'espèce, puis montée ×2 à 200 PX', () => {
    // Conseiller (Niveau 1) : « Savoir-vivre (Au choix) ». Le héros possède déjà
    // Savoir-vivre (Criminels) ×1 (espèce) — cas utilisateur « Sens aiguisé (Goût) ».
    set1(mkHero({ xp: 1000, career: 'Conseiller', talents: [{ name: 'Savoir-vivre (Criminels)', times: 1 }] }));
    const view = buildAdvancementView(h0());
    const slot = view.talents.find((t) => t.entry === 'Savoir-vivre (Au choix)')!;
    expect(slot.options!.some((o) => o.label === 'Savoir-vivre (Criminels)' && o.owned)).toBe(true);
    // Avant désignation : l'achat direct passe par le slot libre (auto-désignation) — ici on
    // teste la DÉSIGNATION explicite (0 PX) puis la montée.
    useGame.getState().designateCareerSlot('h', slot.slotKey, 'Savoir-vivre (Criminels)');
    expect(h0().careerSlotChoices?.['Conseiller']?.[slot.slotKey]).toBe('Savoir-vivre (Criminels)');
    expect(h0().xp).toBe(1000); // gratuit
    useGame.getState().buyTalent('h', 'Savoir-vivre (Criminels)');
    expect(h0().talents.find((t) => t.name === 'Savoir-vivre (Criminels)')!.times).toBe(2);
    expect(h0().xp).toBe(800); // 2ᵉ acquisition = 200 PX (LDB 07 l.102)
    // Le slot étant désigné, une AUTRE spec est hors carrière → refusée (l.97).
    useGame.getState().buyTalent('h', 'Savoir-vivre (Nobles)');
    expect(h0().talents.find((t) => t.name === 'Savoir-vivre (Nobles)')).toBeUndefined();
  });

  it('emplacement « (Au choix) » : l\'achat via un slot libre le DÉSIGNE automatiquement', () => {
    set1(mkHero({ xp: 1000, career: 'Conseiller' }));
    useGame.getState().buyTalent('h', 'Savoir-vivre (Nobles)');
    expect(h0().talents.find((t) => t.name === 'Savoir-vivre (Nobles)')!.times).toBe(1);
    expect(Object.values(h0().careerSlotChoices?.['Conseiller'] ?? {})).toContain('Savoir-vivre (Nobles)');
    // Slot consommé : une autre spec n'est plus achetable dans CETTE carrière.
    useGame.getState().buyTalent('h', 'Savoir-vivre (Criminels)');
    expect(h0().talents.find((t) => t.name === 'Savoir-vivre (Criminels)')).toBeUndefined();
  });

  it('Effet giveXp : octroie les PX à TOUT le groupe (via trigger)', () => {
    const a = mkHero({ id: 'a', xp: 0 });
    const b = mkHero({ id: 'b', xp: 50 });
    const scene = emptyScene(6, 6);
    scene.id = 'xp-scene';
    scene.entities.push({ id: 'hs', kind: 'heroStart', pos: { x: 0, y: 0 } });
    scene.triggers.push({ id: 't-xp', rect: { x: 2, y: 0, w: 1, h: 1 }, once: true, effects: [{ type: 'giveXp', amount: 100 }] });
    useGame.setState({ party: [a, b] });
    useGame.getState().startScene(scene);
    useGame.getState().moveParty({ x: 2, y: 0 }); // entre dans la zone du trigger
    const st = useGame.getState();
    expect(st.party.find((h) => h.id === 'a')!.xp).toBe(100);
    expect(st.party.find((h) => h.id === 'b')!.xp).toBe(150);
  });
});

describe('Fouille / butin par objet cherchable (store)', () => {
  beforeEach(() => reset());

  const looter = (): Combatant => ({ id: 'a', name: 'A', xp: 0, wounds: { current: 12, max: 12 }, conditions: [] }) as unknown as Combatant;

  it('fouiller un prop interactif applique les Effets, laisse le corps en place, et ne se refait pas', () => {
    const scene = emptyScene(6, 6);
    scene.id = 'fouille-scene';
    scene.entities.push({ id: 'hs', kind: 'heroStart', pos: { x: 0, y: 0 } });
    scene.entities.push({
      id: 'cadavre',
      kind: 'prop',
      pos: { x: 1, y: 0 },
      label: 'Cadavre du cocher',
      interact: {
        effects: [
          { type: 'giveMoney', gold: 2 },
          { type: 'giveXp', amount: 10 },
        ],
      },
    });
    useGame.setState({ party: [looter()] });
    useGame.getState().startScene(scene);
    useGame.setState({ partyPos: { x: 0, y: 0 }, money: { gold: 0, silver: 0, brass: 0 } });

    useGame.getState().interactEntity('cadavre');
    let st = useGame.getState();
    expect(st.money.gold).toBe(2);
    expect(st.party[0].xp).toBe(10);
    expect(st.scene!.entities.find((e) => e.id === 'cadavre')).toBeTruthy(); // le corps RESTE

    // Re-fouille : aucun double octroi
    useGame.getState().interactEntity('cadavre');
    st = useGame.getState();
    expect(st.money.gold).toBe(2);
    expect(st.party[0].xp).toBe(10);
  });

  it('prop consommable (butin) : ramassage sur le héros + disparition (consume)', () => {
    const scene = emptyScene(6, 6);
    scene.id = 'loot-scene';
    scene.entities.push({ id: 'hs', kind: 'heroStart', pos: { x: 0, y: 0 } });
    scene.entities.push({ id: 'coffre', kind: 'prop', pos: { x: 1, y: 0 }, label: 'Coffre', interact: { consume: true, effects: [{ type: 'giveTrapping', trapping: 'Fiole' }, { type: 'giveTrapping', trapping: 'Lettre' }] } });
    useGame.setState({ party: [looter()] });
    useGame.getState().startScene(scene);
    useGame.setState({ partyPos: { x: 0, y: 0 } });

    useGame.getState().interactEntity('coffre');
    const st = useGame.getState();
    expect((st.party[0].items ?? []).map((i) => i.name)).toEqual(expect.arrayContaining(['Fiole', 'Lettre'])); // objets custom sur le héros
    expect(st.scene!.entities.find((e) => e.id === 'coffre')).toBeUndefined(); // ramassé → disparaît
  });

  it('Effet giveTrapping : crée un VRAI objet à stats sur le héros (non équipé, depuis trappings.json)', () => {
    const heroWithBag = (): Combatant =>
      ({
        id: 'a',
        name: 'A',
        kind: 'hero',
        characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
        wounds: { current: 12, max: 12 },
        advantage: 0,
        conditions: [],
        weapons: [],
        armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
        items: [],
        skills: [],
        talents: [],
        movement: 4,
      }) as unknown as Combatant;
    const scene = emptyScene(6, 6);
    scene.id = 'gt-scene';
    scene.entities.push({ id: 'hs', kind: 'heroStart', pos: { x: 0, y: 0 } });
    scene.entities.push({
      id: 'cadavre',
      kind: 'prop',
      pos: { x: 1, y: 0 },
      label: 'Cadavre du cocher',
      interact: { effects: [{ type: 'giveTrapping', trapping: 'Dague' }] },
    });
    useGame.setState({ party: [heroWithBag()] });
    useGame.getState().startScene(scene);
    useGame.setState({ partyPos: { x: 0, y: 0 } });

    useGame.getState().interactEntity('cadavre');
    const hero = useGame.getState().party[0];
    const dague = (hero.items ?? []).find((i) => i.name === 'Dague');
    expect(dague).toBeTruthy();
    expect(dague!.kind).toBe('melee'); // objet à stats, pas un simple nom
    expect(dague!.equipped).toBe(false); // ramassé, à équiper soi-même
  });
});

describe('Déplacement-puis-fouille (move-to-interact, P5)', () => {
  beforeEach(() => reset());
  const looter = (): Combatant => ({ id: 'a', name: 'A', xp: 0, wounds: { current: 12, max: 12 }, conditions: [] }) as unknown as Combatant;

  function armedScene() {
    const scene = emptyScene(8, 8);
    scene.id = 'mti-scene';
    scene.entities.push({ id: 'hs', kind: 'heroStart', pos: { x: 0, y: 0 } });
    scene.entities.push({ id: 'cadavre', kind: 'prop', pos: { x: 5, y: 0 }, label: 'Cadavre', interact: { effects: [{ type: 'giveMoney', gold: 3 }] } });
    useGame.setState({ party: [looter()] });
    useGame.getState().startScene(scene);
    useGame.setState({ partyPos: { x: 0, y: 0 }, money: { gold: 0, silver: 0, brass: 0 } });
  }

  it('moveParty arrivant adjacent au décor visé déclenche la fouille et purge pendingInteract', () => {
    armedScene();
    useGame.getState().setPendingInteract('cadavre');
    useGame.getState().moveParty({ x: 1, y: 0 }); // encore loin → pas de fouille
    expect(useGame.getState().pendingInteract).toBe('cadavre');
    expect(useGame.getState().money.gold).toBe(0);

    useGame.getState().moveParty({ x: 4, y: 0 }); // adjacent à (5,0) → fouille auto
    expect(useGame.getState().pendingInteract).toBeNull();
    expect(useGame.getState().money.gold).toBe(3);
  });

  it('annulation : setPendingInteract(null) empêche la fouille à l’arrivée (clic ailleurs)', () => {
    armedScene();
    useGame.getState().setPendingInteract('cadavre');
    useGame.getState().setPendingInteract(null);
    useGame.getState().moveParty({ x: 4, y: 0 });
    expect(useGame.getState().money.gold).toBe(0);
  });
});

describe('Utiliser un consommable en combat (store)', () => {
  beforeEach(() => reset());

  const combatHero = (over: Partial<Combatant> = {}): Combatant =>
    ({
      id: 'h',
      name: 'H',
      kind: 'hero',
      characteristics: { CC: 30, CT: 30, F: 30, E: 35, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 }, // BE = 3
      wounds: { current: 5, max: 12 },
      advantage: 0,
      conditions: [],
      weapons: [],
      armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
      items: [],
      skills: [],
      talents: [],
      movement: 4,
      ...over,
    }) as unknown as Combatant;

  const potion = (uid: string, name: string, desc: string) =>
    ({ uid, name, kind: 'misc', qualities: [], enc: 0, equipped: false, desc }) as ItemInstance;

  const mkBattle = (h: Combatant, over = {}): BattleState => ({
    combatants: [h],
    order: [h.id],
    turn: 0,
    round: 1,
    action: 'use',
    selectedSpell: null,
    reachable: new Map(),
    movementUsed: 0, movedPreAction: false,
    acted: false,
    log: [],
    over: null,
    ...over,
  });

  it('Potion de guérison : soigne du Bonus d’Endurance, consomme l’objet, coûte l’Action', () => {
    const h = combatHero({
      wounds: { current: 5, max: 12 },
      items: [potion('p1', 'Potion de guérison', "récupérez immédiatement un nombre de Points de Blessure égal à votre Bonus d'Endurance.")],
    });
    useGame.setState({ mode: 'battle', battle: mkBattle(h) });
    useGame.getState().battleUseItem('p1');
    const b = useGame.getState().battle!;
    expect(b.combatants[0].wounds.current).toBe(8); // 5 + BE(35) = 8
    expect(b.combatants[0].items!.find((i) => i.uid === 'p1')).toBeUndefined();
    expect(b.acted).toBe(true);
  });

  it('Potion de vitalité : retire l’État Exténué (toutes les piles)', () => {
    const h = combatHero({
      conditions: [{ name: 'Exténué', value: 2 }],
      items: [potion('p2', 'Potion de vitalité', 'Boire cette décoction retire instantanément tout État Exténué.')],
    });
    useGame.setState({ mode: 'battle', battle: mkBattle(h) });
    useGame.getState().battleUseItem('p2');
    const b = useGame.getState().battle!;
    expect(b.combatants[0].conditions.find((c) => c.name === 'Exténué')).toBeUndefined();
    expect(b.acted).toBe(true);
  });

  it('Action déjà consommée : aucune utilisation (objet conservé)', () => {
    const h = combatHero({
      wounds: { current: 5, max: 12 },
      items: [potion('p3', 'Potion de guérison', "récupérez un nombre de Points de Blessure égal à votre Bonus d'Endurance.")],
    });
    useGame.setState({ mode: 'battle', battle: mkBattle(h, { acted: true }) });
    useGame.getState().battleUseItem('p3');
    const b = useGame.getState().battle!;
    expect(b.combatants[0].wounds.current).toBe(5); // inchangé
    expect(b.combatants[0].items!.find((i) => i.uid === 'p3')).toBeTruthy(); // pas consommé
  });
});

describe('Chance : relance 1×/Test et seulement sur jet propre raté (LDB ch.12 l.56 + l.29-31)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    reset();
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('testReroll : refusée si le d100 propre est réussi (roll ≤ cible)', () => {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(3) });
    hero.fortune = 2;
    useGame.setState({
      party: [hero],
      pendingTest: { actorId: hero.id, actorName: 'A', label: 'Test', skillValue: 50, difficulty: 'intermediaire',
        requireSL: 0, target: 50, roll: 20, success: true, sl: 3, rerolled: false, onSuccess: [], onFailure: [] },
    });
    useGame.getState().testReroll();
    expect(useGame.getState().party[0].fortune).toBe(2); // rien dépensé (jet réussi)
    expect(useGame.getState().pendingTest!.roll).toBe(20); // jet inchangé
  });

  it('testReroll : autorisée une seule fois sur un jet raté', () => {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(3) });
    hero.fortune = 2;
    useGame.setState({
      party: [hero],
      pendingTest: { actorId: hero.id, actorName: 'A', label: 'Test', skillValue: 5, difficulty: 'intermediaire',
        requireSL: 0, target: 5, roll: 95, success: false, sl: -9, rerolled: false, onSuccess: [], onFailure: [] },
    });
    useGame.getState().testReroll(); // 1re relance OK (jet raté)
    expect(useGame.getState().party[0].fortune).toBe(1);
    expect(useGame.getState().pendingTest!.rerolled).toBe(true);
    useGame.getState().testReroll(); // 2e relance refusée (déjà relancé)
    expect(useGame.getState().party[0].fortune).toBe(1); // pas de 2e dépense
  });

  it('testBonusSL : +1 DR fait passer un Test à requireSL, et est cumulable', () => {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(3) });
    hero.fortune = 3;
    useGame.setState({
      party: [hero],
      pendingTest: { actorId: hero.id, actorName: 'A', label: 'Test', skillValue: 50, difficulty: 'intermediaire',
        requireSL: 2, target: 50, roll: 45, success: false, sl: 0, rerolled: false, onSuccess: [], onFailure: [] },
    });
    useGame.getState().testBonusSL(); // DR 0 → 1 (< 2)
    expect(useGame.getState().party[0].fortune).toBe(2);
    expect(useGame.getState().pendingTest!.success).toBe(false);
    useGame.getState().testBonusSL(); // DR 1 → 2 (≥ requireSL 2) → succès
    expect(useGame.getState().party[0].fortune).toBe(1);
    expect(useGame.getState().pendingTest!.sl).toBe(2);
    expect(useGame.getState().pendingTest!.success).toBe(true);
  });
});

describe('Détermination (Resolve) — retirer un État (LDB ch.17 l.62-66)', () => {
  beforeEach(() => reset());

  const mkBattle = (h: Combatant, over = {}): BattleState => ({
    combatants: [h], order: [h.id], turn: 0, round: 1, action: null, selectedSpell: null,
    reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null, ...over,
  });

  it('retire un État, ne consomme pas l’Action, décrémente la Détermination', () => {
    const h = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(3) });
    h.resolve = 2;
    h.conditions = [{ name: 'Aveuglé', value: 1 }];
    useGame.setState({ mode: 'battle', battle: mkBattle(h) });
    useGame.getState().battleSpendResolve('Aveuglé');
    const b = useGame.getState().battle!;
    expect(b.combatants[0].conditions.find((c) => c.name === 'Aveuglé')).toBeUndefined();
    expect(b.combatants[0].resolve).toBe(1);
    expect(b.acted).toBe(false); // ne coûte pas l'Action
  });

  it('retirer À Terre fait regagner 1 PB (l.66)', () => {
    const h = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(3) });
    h.resolve = 1;
    h.conditions = [{ name: 'À Terre', value: 1 }];
    h.wounds = { current: 5, max: 12 };
    useGame.setState({ mode: 'battle', battle: mkBattle(h) });
    useGame.getState().battleSpendResolve('À Terre');
    const c0 = useGame.getState().battle!.combatants[0];
    expect(c0.conditions.find((c) => c.name === 'À Terre')).toBeUndefined();
    expect(c0.wounds.current).toBe(6); // +1 PB
  });

  it('sans Détermination : aucun effet', () => {
    const h = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(3) });
    h.resolve = 0;
    h.conditions = [{ name: 'Aveuglé', value: 1 }];
    useGame.setState({ mode: 'battle', battle: mkBattle(h) });
    useGame.getState().battleSpendResolve('Aveuglé');
    expect(useGame.getState().battle!.combatants[0].conditions.find((c) => c.name === 'Aveuglé')).toBeTruthy();
  });
});

describe('Ramasser un objet au sol en combat (un à la fois, LDB ch.13 l.115-116)', () => {
  beforeEach(() => reset());

  function setup() {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(3) });
    hero.items = hero.items ?? [];
    hero.pos = { x: 0, y: 0 };
    const scene = emptyScene(8, 8);
    scene.id = 'pickup-scene';
    scene.entities.push({ id: 'hs', kind: 'heroStart', pos: { x: 0, y: 0 } });
    scene.entities.push({
      id: 'corps', kind: 'prop', pos: { x: 1, y: 0 }, label: 'Cocher',
      interact: {
        effects: [
          { type: 'journal', text: 'Son tromblon repose à côté.' }, // index 0 (non ramassable)
          { type: 'giveTrapping', trapping: 'Dague' }, // index 1
          { type: 'giveTrapping', trapping: 'Tromblon' }, // index 2
        ],
      },
    });
    const bh: Combatant = JSON.parse(JSON.stringify(hero));
    const battle: BattleState = {
      combatants: [bh], order: [bh.id], turn: 0, round: 1, action: 'pickup', selectedSpell: null,
      reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
    };
    useGame.setState({ party: [hero], scene, mode: 'battle', battle, flags: {} });
    return bh;
  }

  it('ramasse UN objet : il arrive dans l’inventaire (battle + party), consomme l’Action, retire du pool', () => {
    const bh = setup();
    useGame.getState().battlePickup('corps', 'eff:2'); // index 2 = Tromblon
    const st = useGame.getState();
    const bH = st.battle!.combatants.find((c) => c.id === bh.id)!;
    expect((bH.items ?? []).some((i) => i.name === 'Tromblon')).toBe(true); // utilisable ce combat
    expect((st.party[0].items ?? []).some((i) => i.name === 'Tromblon')).toBe(true); // persiste
    expect((bH.items ?? []).filter((i) => i.name === 'Tromblon').length).toBe(1); // un SEUL objet ramassé
    expect(st.battle!.acted).toBe(true); // coûte l'Action
    const corps = st.scene!.entities.find((e) => e.id === 'corps')!;
    expect((corps.interact?.effects ?? []).some((e) => e.type === 'giveTrapping' && e.trapping === 'Tromblon')).toBe(false);
    expect((corps.interact?.effects ?? []).some((e) => e.type === 'giveTrapping' && e.trapping === 'Dague')).toBe(true);
  });

  it('refusé si l’Action est déjà consommée', () => {
    const bh = setup();
    useGame.setState({ battle: { ...useGame.getState().battle!, acted: true } });
    useGame.getState().battlePickup('corps', 'eff:2');
    const bH = useGame.getState().battle!.combatants.find((c) => c.id === bh.id)!;
    expect((bH.items ?? []).some((i) => i.name === 'Tromblon')).toBe(false);
  });
});

describe('Chance — 3e usage : pré-emption d’initiative en début de Round (LDB ch.17 l.27)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    reset();
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  function endOfRoundBattle(heroFortune: number) {
    const H = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'H', rng: makeRNG(3) });
    H.fortune = heroFortune;
    H.pos = { x: 0, y: 0 };
    const E: Combatant = JSON.parse(JSON.stringify(H));
    E.id = 'enemy-0';
    E.name = 'Gobelin';
    E.kind = 'enemy';
    E.fortune = 0;
    E.pos = { x: 5, y: 5 };
    const battle: BattleState = {
      combatants: [H, E], order: [E.id, H.id], turn: 1, round: 1, action: null, selectedSpell: null,
      reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
    };
    useGame.setState({ party: [H], mode: 'battle', battle, scene: emptyScene(8, 8) });
    return { H, E };
  }

  it('fin du dernier tour du Round : on suspend (fenêtre d’initiative, pendingRoundStart)', () => {
    endOfRoundBattle(1);
    useGame.getState().battleEndTurn(); // H (dernier de l'ordre) finit → bascule au Round 2
    const st = useGame.getState();
    expect(st.pendingRoundStart).not.toBeNull();
    expect(st.pendingRoundStart!.round).toBe(2);
    expect(st.battle!.round).toBe(2);
  });

  it('même sans Chance : on suspend quand même en début de Round (la fenêtre d’initiative est systématique)', () => {
    endOfRoundBattle(0);
    useGame.getState().battleEndTurn();
    const st = useGame.getState();
    expect(st.pendingRoundStart).not.toBeNull();
    expect(st.pendingRoundStart!.round).toBe(2);
  });

  it('la pause de début de Round GÈLE l’IA ennemie jusqu’à « Commencer le round »', () => {
    endOfRoundBattle(0); // ordre [E, H] : l'ennemi est en tête du Round 2
    useGame.getState().battleEndTurn();
    vi.runOnlyPendingTimers(); // aucun timer d'IA ne doit être en attente pendant la pause
    expect(useGame.getState().pendingRoundStart).not.toBeNull(); // l'ennemi n'a pas joué : on attend la confirmation
    useGame.getState().confirmRoundStart();
    expect(useGame.getState().pendingRoundStart).toBeNull();
  });

  it('roundStartPromote place le héros en tête et dépense 1 Chance', () => {
    const { H } = endOfRoundBattle(2);
    useGame.getState().battleEndTurn();
    useGame.getState().roundStartPromote(H.id);
    const st = useGame.getState();
    expect(st.battle!.order[0]).toBe(H.id);
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.fortune).toBe(1);
  });

  it('confirmRoundStart ferme la modale et active le héros promu en premier', () => {
    const { H } = endOfRoundBattle(1);
    useGame.getState().battleEndTurn();
    useGame.getState().roundStartPromote(H.id);
    useGame.getState().confirmRoundStart();
    const st = useGame.getState();
    expect(st.pendingRoundStart).toBeNull();
    expect(st.battle!.order[st.battle!.turn]).toBe(H.id); // H agit en premier ce Round
  });
});

describe('cancelMove — annuler un déplacement décomposé tant qu’aucune Action (R6/LOT 6)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); reset(); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  function moveSetup() {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(3) });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    const st = useGame.getState();
    const H = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    const turn = st.battle!.order.indexOf(H.id);
    useGame.setState({ battle: { ...st.battle!, turn, action: null, movementUsed: 0, movedPreAction: false, acted: false } });
    return H;
  }

  function firstMoveTarget(fromX: number, fromY: number) {
    const reach = [...computeMoveReach(useGame.getState).keys()].map((k) => {
      const [x, y] = k.split(',').map(Number);
      return { x, y };
    });
    return reach.find((p) => p.x !== fromX || p.y !== fromY)!;
  }

  it('restaure la position et remet le Mouvement à zéro après un segment', () => {
    const H = moveSetup();
    const from = { ...H.pos! };
    const target = firstMoveTarget(from.x, from.y);
    useGame.getState().battleClickTile(target, { confirm: true });
    let st = useGame.getState();
    expect(st.battle!.movementUsed).toBeGreaterThan(0);
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.pos).toEqual(target);
    useGame.getState().cancelMove();
    st = useGame.getState();
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.pos).toEqual(from);
    expect(st.battle!.movementUsed).toBe(0);
    expect(st.battle!.moveSnapshot ?? null).toBeNull();
  });

  it('ne fait RIEN une fois l’Action prise (l’annulation est une aide PRÉ-Action)', () => {
    const H = moveSetup();
    const from = { ...H.pos! };
    const target = firstMoveTarget(from.x, from.y);
    useGame.getState().battleClickTile(target, { confirm: true });
    useGame.setState({ battle: { ...useGame.getState().battle!, acted: true } }); // une Action a été prise
    useGame.getState().cancelMove();
    expect(useGame.getState().battle!.combatants.find((c) => c.id === H.id)!.pos).toEqual(target);
  });
});

describe('Blessures critiques & mort en combat (LDB 18-Traumatisme)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); reset(); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  function combat(heroOver: Partial<Combatant> = {}, enemyOver: Partial<Combatant> = {}) {
    const H = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'H', rng: makeRNG(3) });
    H.fortune = 0; // pas de pré-emption d'initiative dans ces tests
    Object.assign(H, heroOver);
    const E: Combatant = JSON.parse(JSON.stringify(H));
    E.id = 'enemy-0'; E.name = 'Brigand'; E.kind = 'enemy'; E.fortune = 0; Object.assign(E, enemyOver);
    const battle: BattleState = {
      combatants: [H, E], order: [H.id, E.id], turn: 0, round: 1, action: null, selectedSpell: null,
      reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
    };
    useGame.setState({ party: [H], mode: 'battle', battle, scene: emptyScene(8, 8) });
    return { H, E };
  }

  it('overkill sur un HÉROS → Blessure critique (compteur++), tombe à 0 PB', () => {
    const { H, E } = combat({ wounds: { current: 2, max: 12 }, armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 } });
    useGame.getState().seedRng(2);
    // L'IA (E) a frappé H en mêlée : jet d'attaque figé (réussi, fort DR) ; H « Subit ».
    useGame.setState({
      pendingDefense: { attackerId: E.id, defenderId: H.id, weapon: E.weapons[0], location: null,
        atk: { roll: 5, target: 80, success: true, sl: 7, isDouble: false }, mode: 'parade', def: null, result: null },
    });
    useGame.getState().defenseCancel(); // « Subir » → applyAttackResult (overkill car 2 PB < dégâts)
    const h = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(h.criticalWounds).toBe(1); // une Blessure critique encaissée
    expect(h.wounds.current).toBe(0); // tombé à 0 (ne passe jamais négatif)
  });

  it('héros SANS Destin Inconscient + 0 PB + critiques > BE → meurt en fin de Round (LDB 18 l.48-49)', () => {
    const { H, E } = combat({ wounds: { current: 0, max: 12 }, conditions: [{ name: 'Inconscient', value: 1 }], criticalWounds: 4, fate: 0 }); // BE=3, pas de Destin → mort directe
    useGame.setState({ battle: { ...useGame.getState().battle!, order: [E.id, H.id], turn: 1 } }); // H dernier → battleEndTurn franchit le Round
    useGame.getState().seedRng(1);
    useGame.getState().battleEndTurn();
    const h = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(h.dead).toBe(true);
    expect(isOutOfAction(h)).toBe(true);
  });
});

describe('Destin sacrifié (LDB ch.17 l.31-35)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); reset(); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  function combat(heroOver: Partial<Combatant> = {}) {
    const H = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'H', rng: makeRNG(3) });
    H.fortune = 0; H.fate = 1; Object.assign(H, heroOver);
    const E: Combatant = JSON.parse(JSON.stringify(H));
    E.id = 'enemy-0'; E.name = 'Brigand'; E.kind = 'enemy'; E.fortune = 0; E.fate = 0;
    const battle: BattleState = {
      combatants: [H, E], order: [E.id, H.id], turn: 1, round: 1, action: null, selectedSpell: null,
      reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
    };
    useGame.setState({ party: [H], mode: 'battle', battle, scene: emptyScene(8, 8) });
    return { H, E };
  }

  it('mort lente d’un héros à Destin → suspend (pendingFateSave source=slow), pas mort', () => {
    combat({ wounds: { current: 0, max: 12 }, conditions: [{ name: 'Inconscient', value: 1 }], criticalWounds: 4 }); // fate=1, BE=3
    useGame.getState().seedRng(1);
    useGame.getState().battleEndTurn(); // H dernier → franchit le Round
    const st = useGame.getState();
    expect(st.pendingFateSave).not.toBeNull();
    expect(st.pendingFateSave!.source).toBe('slow');
    expect(st.battle!.combatants[0].dead ?? false).toBe(false);
  });

  it('« Meurs un autre jour » : éjecté vivant, Destin −1, le Round reprend', () => {
    const { H } = combat({ wounds: { current: 0, max: 12 }, conditions: [{ name: 'Inconscient', value: 1 }], criticalWounds: 4, fate: 2 });
    useGame.getState().seedRng(1);
    useGame.getState().battleEndTurn();
    useGame.getState().fateSurvive();
    const h = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(h.dead ?? false).toBe(false);
    expect(h.outOfRencontre).toBe(true);
    expect(h.fate).toBe(1);
    expect(useGame.getState().pendingFateSave).toBeNull();
  });

  it('« Accepter le sort » : mort', () => {
    const { H } = combat({ wounds: { current: 0, max: 12 }, conditions: [{ name: 'Inconscient', value: 1 }], criticalWounds: 4 });
    useGame.getState().seedRng(1);
    useGame.getState().battleEndTurn();
    useGame.getState().fateAccept();
    expect(useGame.getState().battle!.combatants.find((c) => c.id === H.id)!.dead).toBe(true);
  });

  it('héros SANS Destin : mort lente directe, pas de pause', () => {
    const { H } = combat({ wounds: { current: 0, max: 12 }, conditions: [{ name: 'Inconscient', value: 1 }], criticalWounds: 4, fate: 0 });
    useGame.getState().seedRng(1);
    useGame.getState().battleEndTurn();
    expect(useGame.getState().pendingFateSave).toBeNull();
    expect(useGame.getState().battle!.combatants.find((c) => c.id === H.id)!.dead).toBe(true);
  });
});

describe('Résilience — « Je ne faillirai pas ! » (LDB ch.17 l.73)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); reset(); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('force un Test hors combat raté en succès, Résilience −1', () => {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(3) });
    hero.resilience = 1;
    useGame.setState({
      party: [hero],
      pendingTest: { actorId: hero.id, actorName: 'A', label: 'Test', skillValue: 30, difficulty: 'intermediaire',
        requireSL: 0, target: 30, roll: 95, success: false, sl: -6, rerolled: false, onSuccess: [], onFailure: [] },
    });
    useGame.getState().testForceSuccess();
    expect(useGame.getState().pendingTest!.success).toBe(true);
    expect(useGame.getState().party[0].resilience).toBe(0);
  });
});

describe('Munitions & rechargement (héros, LDB Armes/Tests)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    reset();
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  function archer() {
    const H = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(3) });
    H.weapons = [{ name: 'Arbalète', type: 'ranged', damage: '+9', range: 60, qualities: ['Recharge 1'], subType: 'Arbalète', reload: 1 }];
    H.items = [{ uid: 'am1', name: 'Carreau', kind: 'ammo', qualities: ['Empaleuse'], enc: 0, equipped: false, subType: 'Arbalète', qty: 2 } as ItemInstance];
    H.loaded = true;
    H.pos = { x: 0, y: 0 };
    const E: Combatant = JSON.parse(JSON.stringify(H));
    E.id = 'enemy-0';
    E.name = 'Cible';
    E.kind = 'enemy';
    E.pos = { x: 4, y: 0 };
    E.items = [];
    E.weapons = [{ name: 'Mains nues', type: 'melee', damage: '+BF', qualities: [] }];
    const battle: BattleState = {
      combatants: [H, E], order: [H.id, E.id], turn: 0, round: 1, action: null, selectedSpell: null,
      reachable: new Map(), movementUsed: 99, movedPreAction: false, acted: false, log: [], over: null,
    };
    useGame.setState({ party: [H], mode: 'battle', battle, scene: emptyScene(8, 8), pendingReload: null, pendingAttack: null });
    return { H, E };
  }

  it('tirer consomme 1 munition et décharge une arme à Recharge', () => {
    const { H, E } = archer();
    useGame.getState().seedRng(2);
    useGame.getState().battleClickEntity(E.id, { confirm: true }); // ouvre la modale d'attaque (chargé + munition OK)
    expect(useGame.getState().pendingAttack).not.toBeNull();
    useGame.getState().attackRoll();
    useGame.getState().attackConfirm();
    const h = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect((h.items ?? []).find((i) => i.uid === 'am1')!.qty).toBe(1); // 2 → 1
    expect(h.loaded).toBe(false); // Recharge 1 → déchargé
  });

  it('arme déchargée : tir refusé (modale non ouverte)', () => {
    const { H, E } = archer();
    H.loaded = false;
    useGame.getState().battleClickEntity(E.id, { confirm: true });
    expect(useGame.getState().pendingAttack).toBeNull();
  });

  it('battleReload OUVRE la modale (Test de Projectiles, Action pas encore consommée)', () => {
    const { H } = archer();
    H.loaded = false;
    H.reloadProgress = 0;
    useGame.getState().battleReload();
    const pr = useGame.getState().pendingReload;
    expect(pr).not.toBeNull();
    expect(pr!.reload).toBe(1); // Indice DR
    expect(pr!.roll).toBeNull(); // pas encore lancé
    expect(useGame.getState().battle!.acted).toBe(false); // l'Action n'est consommée qu'à Appliquer
  });

  it('reloadRoll + reloadConfirm : cumule le DR (Test étendu), recharge à ≥ Indice, consomme l’Action', () => {
    const { H } = archer();
    H.loaded = false;
    H.reloadProgress = 0;
    useGame.getState().seedRng(2);
    useGame.getState().battleReload();
    useGame.getState().reloadRoll();
    const pr = useGame.getState().pendingReload!;
    expect(pr.roll).not.toBeNull();
    const expected = Math.max(0, 0 + pr.sl); // formule du Test étendu (clamp à 0)
    useGame.getState().reloadConfirm();
    const h = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
    if (expected >= 1) {
      expect(h.loaded).toBe(true);
      expect(h.reloadProgress).toBe(0);
    } else {
      expect(h.loaded).toBe(false);
      expect(h.reloadProgress).toBe(expected);
    }
    expect(useGame.getState().battle!.acted).toBe(true);
    expect(useGame.getState().pendingReload).toBeNull();
  });

  it('reloadConfirm : un DR insuffisant (Recharge 2) laisse l’arme déchargée et garde le progrès', () => {
    const { H } = archer();
    H.weapons = [{ name: 'Arbalète lourde', type: 'ranged', damage: '+9', range: 100, qualities: ['Recharge 2'], subType: 'Arbalète', reload: 2 }];
    H.loaded = false;
    H.reloadProgress = 0;
    useGame.getState().seedRng(2);
    useGame.getState().battleReload();
    useGame.getState().reloadRoll();
    const pr = useGame.getState().pendingReload!;
    const expected = Math.max(0, 0 + pr.sl);
    useGame.getState().reloadConfirm();
    const h = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(h.loaded).toBe(expected >= 2);
    expect(h.reloadProgress).toBe(expected >= 2 ? 0 : expected);
  });

  it('battleReload refusé si l’Action est déjà consommée', () => {
    const { H } = archer();
    H.loaded = false;
    useGame.setState({ battle: { ...useGame.getState().battle!, acted: true } });
    useGame.getState().battleReload();
    expect(useGame.getState().pendingReload).toBeNull();
  });

  it('plus de munitions : tir refusé', () => {
    const { H, E } = archer();
    (H.items![0] as ItemInstance).qty = 0;
    useGame.getState().battleClickEntity(E.id, { confirm: true });
    expect(useGame.getState().pendingAttack).toBeNull();
  });

  it('battleSelectAmmo change la munition utilisée', () => {
    const { H } = archer();
    H.items!.push({ uid: 'am2', name: 'Carreau perçant', kind: 'ammo', qualities: ['Perforante'], enc: 0, equipped: false, subType: 'Arbalète', qty: 3 } as ItemInstance);
    useGame.getState().battleSelectAmmo('am2');
    expect(useGame.getState().battle!.combatants.find((c) => c.id === H.id)!.ammoUid).toBe('am2');
  });

  it('héros mixte (mêlée en weapons[0] + arc) peut tirer une cible éloignée (gate via attackWeapon)', () => {
    const { H, E } = archer();
    H.weapons = [
      { name: 'Épée', type: 'melee', damage: '+BF+4', qualities: [] },
      { name: 'Arc', type: 'ranged', damage: '+BF+3', range: 60, qualities: [], subType: 'Arc', reload: 0 },
    ];
    H.items = [{ uid: 'fl1', name: 'Flèche', kind: 'ammo', qualities: ['Empaleuse'], enc: 0, equipped: false, subType: 'Arc', qty: 5 } as ItemInstance];
    H.loaded = true;
    H.ammoUid = 'fl1';
    useGame.getState().battleClickEntity(E.id, { confirm: true }); // E à (4,0) → l'Arc (weapons[1]) doit s'employer, pas « hors de portée de mêlée »
    expect(useGame.getState().pendingAttack).not.toBeNull();
  });

  it('reloadConfirm : cumul sous 0 → reloadProgress revient à 0 (Test étendu « recommence », 12-Tests l.200)', () => {
    const { H } = archer();
    H.loaded = false;
    H.reloadProgress = 1;
    useGame.setState({
      pendingReload: {
        actorId: H.id, actorName: H.name, weaponName: 'Arbalète lourde', reload: 2, progressBefore: 1,
        skillValue: 40, difficulty: 'intermediaire', roll: 95, target: 40, sl: -2, success: false,
      },
    });
    useGame.getState().reloadConfirm();
    const h = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(h.reloadProgress).toBe(0); // 1 + (-2) = -1 → plancher 0
    expect(h.loaded).toBe(false);
  });

  it('action Viser : pose aiming SANS jet, +20 au tir, puis consommée', () => {
    const { H, E } = archer();
    useGame.getState().battleAim();
    const h1 = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(h1.aiming).toBe(true);
    expect(useGame.getState().battle!.acted).toBe(true);
    expect(useGame.getState().pendingReload).toBeNull(); // « pas de Test exigé pour viser »
    // Tirer : le détail du jet inclut « Viser +20 », puis aiming est consommée.
    useGame.setState({ battle: { ...useGame.getState().battle!, acted: false, action: null } });
    useGame.getState().seedRng(2);
    useGame.getState().battleClickEntity(E.id, { confirm: true });
    useGame.getState().attackRoll();
    const pa = useGame.getState().pendingAttack!;
    expect((pa.result!.attackerDetail!.mods ?? []).some((m) => m.label === 'Viser' && m.value === 20)).toBe(true);
    useGame.getState().attackConfirm();
    expect(useGame.getState().battle!.combatants.find((c) => c.id === H.id)!.aiming).toBe(false);
  });

  it('Viser refusé sans arme à distance', () => {
    const { H } = archer();
    H.weapons = [{ name: 'Épée', type: 'melee', damage: '+BF+4', qualities: [] }];
    useGame.getState().battleAim();
    expect(useGame.getState().battle!.combatants.find((c) => c.id === H.id)!.aiming).toBeFalsy();
  });

  it('interruption : un héros touché en plein rechargement repart de zéro (63-Armures l.29)', () => {
    const { H, E } = archer();
    H.reloadProgress = 1;
    H.loaded = false;
    H.pos = { x: 1, y: 0 };
    E.pos = { x: 0, y: 0 }; // adjacents
    E.characteristics.F = 60; // gros frappeur → la touche inflige des Blessures
    const atk = { roll: 5, target: 80, success: true, sl: 7, isDouble: false };
    useGame.setState({
      pendingDefense: {
        attackerId: E.id, defenderId: H.id,
        weapon: { name: 'Épée', type: 'melee', damage: '+BF+4', qualities: [] },
        location: 'corps', atk, mode: 'esquive', def: null, result: null,
      },
    });
    useGame.getState().defenseCancel(); // « Subir » → resolveMeleePassive + applyAttackResult
    const h = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(h.wounds.current).toBeLessThan(h.wounds.max); // a bien encaissé une touche
    expect(h.reloadProgress).toBe(0); // rechargement interrompu
  });
});

describe('camRot (rotation caméra — état de vue)', () => {
  it('démarre à 0, tourne horaire/anti-horaire en bouclant sur 4', () => {
    useGame.setState({ camRot: 0 });
    useGame.getState().rotateCam(1);
    expect(useGame.getState().camRot).toBe(1);
    useGame.getState().rotateCam(1);
    useGame.getState().rotateCam(1);
    useGame.getState().rotateCam(1);
    expect(useGame.getState().camRot).toBe(0); // 4 crans = tour complet
    useGame.getState().rotateCam(-1);
    expect(useGame.getState().camRot).toBe(3); // boucle négative
  });
});

describe('Horloge in-game — gameTime + advanceTime (Phase T1)', () => {
  it('advanceTime fait avancer gameTime (depuis le départ de campagne)', () => {
    useGame.setState({ gameTime: CAMPAIGN_START });
    useGame.getState().advanceTime(90); // +1h30
    expect(useGame.getState().gameTime).toBe(CAMPAIGN_START + 90);
    useGame.getState().advanceTime(MINUTES_PER_DAY); // +1 jour
    expect(useGame.getState().gameTime).toBe(CAMPAIGN_START + 90 + MINUTES_PER_DAY);
  });

  it('advanceTime est un no-op si minutes ≤ 0', () => {
    useGame.setState({ gameTime: CAMPAIGN_START });
    useGame.getState().advanceTime(0);
    useGame.getState().advanceTime(-30);
    expect(useGame.getState().gameTime).toBe(CAMPAIGN_START);
  });
});

describe('« Tout est horodaté » — branchements TIME_COST (Phase T1)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); reset(); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('fouiller (exploration) avance le temps de TIME_COST.search, une seule fois', () => {
    const scene = emptyScene(6, 6);
    scene.id = 'fouille-temps';
    scene.entities.push({ id: 'hs', kind: 'heroStart', pos: { x: 0, y: 0 } });
    scene.entities.push({ id: 'cadavre', kind: 'prop', pos: { x: 1, y: 0 }, label: 'Cadavre', interact: { effects: [{ type: 'giveMoney', gold: 1 }] } });
    useGame.setState({ party: [{ id: 'a', name: 'A', xp: 0, wounds: { current: 12, max: 12 }, conditions: [] } as unknown as Combatant] });
    useGame.getState().startScene(scene);
    useGame.setState({ partyPos: { x: 0, y: 0 }, money: { gold: 0, silver: 0, brass: 0 }, gameTime: CAMPAIGN_START });

    useGame.getState().interactEntity('cadavre');
    expect(useGame.getState().gameTime).toBe(CAMPAIGN_START + TIME_COST.search);
    // Re-fouille : retour anticipé (déjà fouillé) → aucun nouvel avancement.
    useGame.getState().interactEntity('cadavre');
    expect(useGame.getState().gameTime).toBe(CAMPAIGN_START + TIME_COST.search);
  });

  it('clôturer un dialogue avance le temps de TIME_COST.dialogue (idempotent)', () => {
    useGame.setState({
      gameTime: CAMPAIGN_START,
      dialogue: { dialogue: { id: 'd', start: 'n', nodes: [{ id: 'n', text: '…', choices: [] }] }, nodeId: 'n' } as any,
    });
    useGame.getState().closeDialogue();
    expect(useGame.getState().gameTime).toBe(CAMPAIGN_START + TIME_COST.dialogue);
    // Re-clôture (dialogue déjà null) → no-op (garde `if (get().dialogue)`).
    useGame.getState().closeDialogue();
    expect(useGame.getState().gameTime).toBe(CAMPAIGN_START + TIME_COST.dialogue);
  });

  it('franchir un Round de combat avance le temps de TIME_COST.combatRound', () => {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(1) });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    b.combatants.forEach((c) => { c.fortune = 0; }); // neutralise la pré-emption Chance
    useGame.setState({ battle: { ...b, turn: b.order.length - 1 }, gameTime: CAMPAIGN_START, pendingReveals: [] });
    useGame.getState().battleEndTurn(); // dernier tour → advanceTurn franchit le Round
    expect(useGame.getState().gameTime).toBe(CAMPAIGN_START + TIME_COST.combatRound);
  });

  it('sceneTransition reste à 0 (intérieur) — le point d’appel existe (seam #T2), sans avancer le temps', () => {
    expect(TIME_COST.sceneTransition).toBe(0); // advanceTime(0) = no-op ; paramétrable pour l'extérieur/voyage
  });
});

describe('Nouvelle partie / scénario — reset complet de l’état (anti-dérive, zéro-maintenance)', () => {
  beforeEach(() => reset());

  // Champs DÉLIBÉRÉMENT conservés (navigation/vue/groupe) ou dérivés de la scène de départ.
  // Tout le RESTE doit revenir à son défaut de création, automatiquement, sans liste à maintenir.
  const PRESERVED_OR_DERIVED = new Set([
    'screen', 'party', 'camRot', 'zoom', 'inspectEnabled',        // navigation / vue / groupe / préférences
    'scene', 'partyPos', 'flags', 'campaignSceneId', 'journal', 'mode', 'money', 'inventory', // dérivés
  ]);

  it('startScene réinitialise TOUT champ d’état à son défaut de création (garde-fou anti-dérive)', () => {
    // 1) Salir un maximum de champs — simule une partie précédente abandonnée en plein combat.
    useGame.setState({
      gameTime: CAMPAIGN_START + 99_999,
      facing: { fantome: 4 } as any,
      previousScene: { id: 'vieux', pos: { x: 9, y: 9 } },
      document: { title: 'x', text: 'y' },
      dialogue: { dialogue: { id: 'd', start: 'n', nodes: [{ id: 'n', text: '', choices: [] }] }, nodeId: 'n' } as any,
      pendingFateSave: { heroId: 'mort', source: 'slow' } as any,
      pendingFumble: { combatantId: 'mort', weapon: {}, result: {} } as any,
      pendingDeviation: { x: 1 } as any,
      pendingCast: { x: 1 } as any,
      pendingRoundStart: { round: 7 },
      flags: { vieuxFlag: true },
      money: { gold: 99, silver: 99, brass: 99 },
      journal: ['vieille ligne'],
    });

    // 2) Démarrage d’une nouvelle partie/scénario.
    const scene = emptyScene(6, 6);
    scene.id = 'neuve';
    scene.entities.push({ id: 'hs', kind: 'heroStart', pos: { x: 0, y: 0 } });
    useGame.getState().setParty([{ id: 'h', name: 'H', xp: 0 } as unknown as Combatant]);
    useGame.getState().startScene(scene);

    // 3) Garde-fou générique : tout champ DATA non préservé/dérivé == son défaut de création.
    //    Itère sur l’état de création (Zustand) → couvre AUTOMATIQUEMENT tout futur champ ajouté.
    const init = (useGame as unknown as { getInitialState: () => Record<string, unknown> }).getInitialState();
    const st = useGame.getState() as unknown as Record<string, unknown>;
    for (const [k, v] of Object.entries(init)) {
      if (typeof v === 'function' || PRESERVED_OR_DERIVED.has(k)) continue;
      expect({ [k]: st[k] }).toEqual({ [k]: v }); // échec lisible : nomme le champ qui a fui
    }

    // 4) Points névralgiques explicites (les 5 suspensions de combat + horloge + orientation + retour).
    expect(st.gameTime).toBe(CAMPAIGN_START);
    expect(st.facing).toEqual({});
    expect(st.previousScene).toBeNull();
    expect(st.pendingFateSave).toBeNull();
    expect(st.pendingFumble).toBeNull();
    expect(st.pendingDeviation).toBeNull();
    expect(st.pendingCast).toBeNull();
    expect(st.pendingRoundStart).toBeNull();
    // Préservés / dérivés bien appliqués :
    expect((st.party as unknown[])).toHaveLength(1);
    expect((st.scene as { id: string }).id).toBe('neuve');
    expect(st.flags).toEqual({}); // flags de l’ancienne partie effacés
  });

  it('l’option d’inspection est OFF par défaut, se bascule, et SURVIT à une nouvelle partie (préférence)', () => {
    expect(useGame.getState().inspectEnabled).toBe(false); // défaut : immersion préservée
    useGame.getState().toggleInspectEnabled();
    expect(useGame.getState().inspectEnabled).toBe(true);
    const scene = emptyScene(6, 6);
    scene.id = 'neuve2';
    scene.entities.push({ id: 'hs', kind: 'heroStart', pos: { x: 0, y: 0 } });
    useGame.getState().setParty([{ id: 'h', name: 'H', xp: 0 } as unknown as Combatant]);
    useGame.getState().startScene(scene);
    expect(useGame.getState().inspectEnabled).toBe(true); // préférence conservée comme la vue (zoom/caméra)
  });
});

describe('Effet setTime — forcer l’heure du jour (jour/nuit via trigger, #T1c)', () => {
  beforeEach(() => reset());
  const dayAt = (h: number) => CAMPAIGN_START - (CAMPAIGN_START % MINUTES_PER_DAY) + h * 60; // un jour donné, à h:00

  it('setTime phase nuit depuis 14:00 → avance à la prochaine 22:00 (8 h)', () => {
    useGame.setState({ gameTime: dayAt(14) });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'setTime', phase: 'nuit' }]);
    expect(useGame.getState().gameTime).toBe(dayAt(14) + 8 * 60);
  });
  it('setTime heure précise 02:00 depuis 23:00 → saute en avant (3 h, lendemain)', () => {
    useGame.setState({ gameTime: dayAt(23) });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'setTime', hour: 2 }]);
    expect(useGame.getState().gameTime).toBe(dayAt(23) + 3 * 60);
  });
  it('setTime sur la phase déjà courante → no-op (temps ne recule jamais)', () => {
    useGame.setState({ gameTime: dayAt(22) }); // déjà au début de 'nuit'
    applyEffects(useGame.getState, useGame.setState, [{ type: 'setTime', phase: 'nuit' }]);
    expect(useGame.getState().gameTime).toBe(dayAt(22));
  });
});

describe('Marchand — openMerchant / buyItem / sellItem (#2)', () => {
  beforeEach(() => reset());
  const hero = (): Combatant => ({ id: 'h', name: 'H', items: [], characteristics: {}, wounds: { current: 10, max: 10 }, conditions: [], weapons: [], armour: {} } as unknown as Combatant);
  const merchantScene = () => {
    const sc = emptyScene(4, 4); sc.id = 'm';
    sc.entities.push({ id: 'pnj', kind: 'personnage', pos: { x: 0, y: 0 }, merchant: { archetype: 'armurier' } });
    return sc;
  };

  it('openMerchant : crée un stock (Commune toujours présente) + état merchant', () => {
    useGame.setState({ party: [hero()], scene: merchantScene() });
    useGame.getState().openMerchant('pnj');
    const m = useGame.getState().merchant!;
    expect(m.entityId).toBe('pnj');
    expect(m.stock.length).toBeGreaterThan(0); // au moins les Communes de la catégorie
    expect(m.resaleRate).toBe(0.5); // base ½ du prix listé (LDB 60 l.22)
  });

  it('buyItem : débite la Bourse, donne l’objet à stats au héros, décrémente la qty', () => {
    useGame.setState({ party: [hero()], scene: merchantScene(), money: { gold: 5, silver: 0, brass: 0 } });
    useGame.getState().openMerchant('pnj');
    const line = useGame.getState().merchant!.stock[0];
    const before = toBrass(useGame.getState().money);
    useGame.getState().buyItem(line.label, 'h');
    const st = useGame.getState();
    expect(st.party[0].items!.some((i) => i.name === line.label)).toBe(true);
    expect(toBrass(st.money)).toBeLessThan(before);
    expect(st.merchant!.stock.find((l) => l.label === line.label)?.qty ?? 0).toBe(line.qty - 1);
  });

  it('buyItem refuse si Bourse insuffisante (objet inchangé)', () => {
    useGame.setState({ party: [hero()], scene: merchantScene(), money: { gold: 0, silver: 0, brass: 0 } });
    useGame.getState().openMerchant('pnj');
    const line = useGame.getState().merchant!.stock[0];
    useGame.getState().buyItem(line.label, 'h');
    expect(useGame.getState().party[0].items!.length).toBe(0);
  });

  it('panier : addToCart → payCart débite le total + met en attente de répartition → confirm distribue', () => {
    useGame.setState({ party: [hero()], scene: merchantScene(), money: { gold: 50, silver: 0, brass: 0 } });
    useGame.getState().openMerchant('pnj');
    const label = useGame.getState().merchant!.stock.find((l) => l.qty > 0)!.label;
    useGame.getState().addToCart(label);
    useGame.getState().addToCart(label);
    expect(useGame.getState().merchant!.cart).toEqual([{ label, qty: 2 }]);
    const before = toBrass(useGame.getState().money);
    useGame.getState().payCart();
    const st = useGame.getState();
    expect(toBrass(st.money)).toBeLessThan(before); // total débité
    expect(st.merchant!.cart).toEqual([]); // panier vidé
    expect(st.merchant!.pendingDistribution).toHaveLength(2); // 2 objets en attente de répartition
    st.assignDistribution(0, 'h');
    st.assignDistribution(1, 'h');
    st.confirmDistribution();
    const st2 = useGame.getState();
    expect(st2.merchant!.pendingDistribution).toBeNull();
    expect(st2.party[0].items!.filter((i) => i.name === label)).toHaveLength(2);
  });

  it('panier : après Marchandage, AJOUT bloqué mais RETRAIT permis (« j’en prends un de moins »)', () => {
    useGame.setState({ party: [hero()], scene: merchantScene(), money: { gold: 50, silver: 0, brass: 0 } });
    useGame.getState().openMerchant('pnj');
    const label = useGame.getState().merchant!.stock.find((l) => l.qty >= 2)!.label;
    useGame.getState().addToCart(label);
    useGame.getState().addToCart(label); // qty 2
    useGame.setState((s) => ({ merchant: { ...s.merchant!, bargainBuy: { won: true, drNet: 2, negotiator: false } } })); // négocié
    useGame.getState().addToCart(label); // bloqué
    expect(useGame.getState().merchant!.cart.find((c) => c.label === label)!.qty).toBe(2);
    useGame.getState().decFromCart(label); // retrait OK
    expect(useGame.getState().merchant!.cart.find((c) => c.label === label)!.qty).toBe(1);
  });

  it('Marchandage NON conclu : quitter sans payer → bloqué jusqu’au réassort, PERSISTE à la réouverture', () => {
    useGame.setState({ party: [hero()], scene: merchantScene(), money: { gold: 50, silver: 0, brass: 0 } });
    useGame.getState().openMerchant('pnj');
    const label = useGame.getState().merchant!.stock.find((l) => l.qty > 0)!.label;
    useGame.getState().addToCart(label);
    useGame.setState((s) => ({ merchant: { ...s.merchant!, bargainBuy: { won: true, drNet: 2, negotiator: false } } })); // négocié
    useGame.getState().closeMerchant(); // quitte SANS payer
    useGame.getState().openMerchant('pnj'); // réouverture (même réassort)
    expect(useGame.getState().merchant!.bargainLocked).toBe(true); // l'info est gardée
    useGame.getState().startBargain('buy');
    expect(useGame.getState().pendingBargain).toBeNull(); // le marchand refuse de marchander
  });

  it('refuseBargain(\'buy\') : vide le panier, annule la remise, VERROU PARTAGÉ (bloque achat ET vente), persiste', () => {
    useGame.setState({ party: [hero()], scene: merchantScene(), money: { gold: 50, silver: 0, brass: 0 } });
    useGame.getState().openMerchant('pnj');
    const label = useGame.getState().merchant!.stock.find((l) => l.qty > 0)!.label;
    useGame.getState().addToCart(label);
    useGame.setState((s) => ({ merchant: { ...s.merchant!, bargainBuy: { won: true, drNet: 2, negotiator: false } } })); // négocié
    useGame.getState().refuseBargain('buy');
    const st = useGame.getState();
    expect(st.merchant!.cart).toEqual([]);
    expect(st.merchant!.bargainBuy ?? null).toBeNull(); // remise annulée
    expect(st.merchant!.bargainLocked).toBe(true);
    // verrou PARTAGÉ : la VENTE est aussi bloquée
    useGame.getState().startBargain('sell');
    expect(useGame.getState().pendingBargain).toBeNull();
    useGame.getState().closeMerchant();
    useGame.getState().openMerchant('pnj');
    expect(useGame.getState().merchant!.bargainLocked).toBe(true); // persiste
  });

  it('refuseBargain(\'sell\') : annule l’offre + VERROU PARTAGÉ (bloque l’ACHAT aussi)', () => {
    useGame.setState({ party: [hero()], scene: merchantScene(), money: { gold: 50, silver: 0, brass: 0 } });
    useGame.getState().openMerchant('pnj');
    useGame.setState((s) => ({ merchant: { ...s.merchant!, bargainSell: { won: true, drNet: 2, negotiator: false } } })); // vente négociée
    useGame.getState().refuseBargain('sell');
    const st = useGame.getState();
    expect(st.merchant!.bargainSell ?? null).toBeNull();
    expect(st.merchant!.bargainLocked).toBe(true);
    useGame.getState().startBargain('buy'); // achat aussi bloqué
    expect(useGame.getState().pendingBargain).toBeNull();
  });

  it('vente négociée puis quittée SANS rien vendre → bloqué (vente non honorée)', () => {
    useGame.setState({ party: [{ ...hero(), items: [{ uid: 'd', name: 'Dague', kind: 'melee', qualities: [], enc: 0, equipped: false }] } as any], scene: merchantScene(), money: { gold: 0, silver: 0, brass: 0 } });
    useGame.getState().openMerchant('pnj');
    useGame.setState((s) => ({ merchant: { ...s.merchant!, bargainSell: { won: true, drNet: 2, negotiator: false } } }));
    useGame.getState().closeMerchant(); // quitte sans vendre
    useGame.getState().openMerchant('pnj');
    expect(useGame.getState().merchant!.bargainLocked).toBe(true);
  });

  it('Marchandage CONCLU (payé) : pas de blocage à la réouverture', () => {
    useGame.setState({ party: [hero()], scene: merchantScene(), money: { gold: 50, silver: 0, brass: 0 } });
    useGame.getState().openMerchant('pnj');
    const label = useGame.getState().merchant!.stock.find((l) => l.qty > 0)!.label;
    useGame.getState().addToCart(label);
    useGame.setState((s) => ({ merchant: { ...s.merchant!, bargainBuy: { won: true, drNet: 2, negotiator: false } } }));
    useGame.getState().payCart(); // scelle le deal (paie)
    useGame.getState().closeMerchant();
    useGame.getState().openMerchant('pnj');
    expect(useGame.getState().merchant!.bargainLocked).toBe(false); // pas de pénalité
  });

  it('panier : addToCart plafonne à la quantité en stock', () => {
    useGame.setState({ party: [hero()], scene: merchantScene(), money: { gold: 50, silver: 0, brass: 0 } });
    useGame.getState().openMerchant('pnj');
    const line = useGame.getState().merchant!.stock.find((l) => l.qty > 0)!;
    for (let i = 0; i < line.qty + 5; i++) useGame.getState().addToCart(line.label);
    expect(useGame.getState().merchant!.cart.find((c) => c.label === line.label)!.qty).toBe(line.qty);
  });

  it('payCart : refuse si Bourse insuffisante (panier intact, rien en répartition)', () => {
    useGame.setState({ party: [hero()], scene: merchantScene(), money: { gold: 0, silver: 0, brass: 1 } });
    useGame.getState().openMerchant('pnj');
    const label = useGame.getState().merchant!.stock.find((l) => l.qty > 0)!.label;
    useGame.getState().addToCart(label);
    useGame.getState().payCart();
    const st = useGame.getState();
    expect(st.merchant!.pendingDistribution ?? null).toBeNull();
    expect(st.merchant!.cart).toHaveLength(1);
  });

  it('closeMerchant : valide une répartition en attente (objets non perdus, par défaut au 1er héros)', () => {
    useGame.setState({ party: [hero()], scene: merchantScene(), money: { gold: 50, silver: 0, brass: 0 } });
    useGame.getState().openMerchant('pnj');
    const label = useGame.getState().merchant!.stock.find((l) => l.qty > 0)!.label;
    useGame.getState().addToCart(label);
    useGame.getState().payCart();
    useGame.getState().closeMerchant(); // ferme sans confirmer → flush au sac du 1er héros
    expect(useGame.getState().party[0].items!.some((i) => i.name === label)).toBe(true);
  });

  it('sellItem : crédite resaleRate × prix et retire l’objet du héros', () => {
    const h = hero(); h.items = [{ uid: 'x', name: 'Hallebarde', kind: 'melee', qualities: [], enc: 3, equipped: false }] as any;
    useGame.setState({ party: [h], scene: merchantScene(), money: { gold: 0, silver: 0, brass: 0 } });
    useGame.getState().openMerchant('pnj');
    useGame.getState().sellItem('x', 'h');
    const st = useGame.getState();
    expect(st.party[0].items!.find((i) => i.uid === 'x')).toBeUndefined();
    expect(toBrass(st.money)).toBeGreaterThan(0); // Hallebarde 2 CO × 10 %
  });

  it('repairArmour : reset damageTaken contre 10 %/PA, débite la Bourse (#2d)', () => {
    const h = hero(); h.items = [{ uid: 'a', name: 'Chemise de mailles', kind: 'armor', pa: 3, damageTaken: 2, qualities: [], enc: 1, equipped: true } as any];
    useGame.setState({ party: [h], scene: merchantScene(), money: { gold: 5, silver: 0, brass: 0 } });
    useGame.getState().openMerchant('pnj');
    const before = toBrass(useGame.getState().money);
    useGame.getState().repairArmour('a', 'h');
    const st = useGame.getState();
    expect(st.party[0].items!.find((i) => i.uid === 'a')!.damageTaken).toBe(0); // réparé
    expect(toBrass(st.money)).toBeLessThan(before); // débité
  });

  it('repairArmour : ignore une armure intacte (damageTaken 0) — pas de débit', () => {
    const h = hero(); h.items = [{ uid: 'b', name: 'Chemise de mailles', kind: 'armor', pa: 3, damageTaken: 0, qualities: [], enc: 1, equipped: true } as any];
    useGame.setState({ party: [h], scene: merchantScene(), money: { gold: 5, silver: 0, brass: 0 } });
    useGame.getState().openMerchant('pnj');
    const before = toBrass(useGame.getState().money);
    useGame.getState().repairArmour('b', 'h');
    expect(toBrass(useGame.getState().money)).toBe(before); // rien à réparer
  });

  const negotiator = (): Combatant => ({ id: 'h', name: 'H', items: [], characteristics: { Soc: 40 }, skills: [], talents: [], wounds: { current: 10, max: 10 }, conditions: [], weapons: [], armour: {} } as unknown as Combatant);

  it('startBargain : crée un pendingBargain (marchand = bargainSkill de l’archétype) (#2c)', () => {
    useGame.setState({ party: [negotiator()], scene: merchantScene() });
    useGame.getState().openMerchant('pnj');
    useGame.getState().startBargain('buy');
    const pb = useGame.getState().pendingBargain!;
    expect(pb).toBeTruthy();
    expect(pb.playerId).toBe('h');
    expect(pb.merchantValue).toBe(45); // armurier.bargainSkill
  });

  it('bargainConfirm : verrouille le MODE achat ; 2ᵉ achat no-op mais la vente reste possible (B, #2c)', () => {
    useGame.setState({ party: [negotiator()], scene: merchantScene() });
    useGame.getState().openMerchant('pnj');
    useGame.getState().startBargain('buy');
    // force un résultat gagné, sans RNG
    const pb = useGame.getState().pendingBargain!;
    const win = { roll: 10, target: 40, success: true, sl: 3, isDouble: false };
    const lose = { roll: 80, target: 45, success: false, sl: -3, isDouble: false };
    useGame.setState({ pendingBargain: { ...pb, roll: win, merchantRoll: lose, result: { attacker: win, defender: lose, winner: 'attacker', attackerWins: true, netSL: 6 } } });
    useGame.getState().bargainConfirm();
    expect(useGame.getState().pendingBargain).toBeNull();
    expect(useGame.getState().merchant!.bargainBuy).toEqual({ won: true, drNet: 6, negotiator: false });
    expect(useGame.getState().merchant!.soured).toBeFalsy(); // gagné → pas de méfiance
    useGame.getState().startBargain('buy'); // achat déjà négocié → no-op
    expect(useGame.getState().pendingBargain).toBeNull();
    useGame.getState().startBargain('sell'); // la vente est une négociation DISTINCTE → s'ouvre
    expect(useGame.getState().pendingBargain?.mode).toBe('sell');
  });

  it('bargainConfirm : un échec « de beaucoup » (net DR ≥ 6) rend le marchand méfiant → plus de marchandage (C, #2c)', () => {
    useGame.setState({ party: [negotiator()], scene: merchantScene() });
    useGame.getState().openMerchant('pnj');
    useGame.getState().startBargain('buy');
    const pb = useGame.getState().pendingBargain!;
    const lose = { roll: 90, target: 40, success: false, sl: -5, isDouble: false };
    const win = { roll: 10, target: 45, success: true, sl: 3, isDouble: false };
    useGame.setState({ pendingBargain: { ...pb, roll: lose, merchantRoll: win, result: { attacker: lose, defender: win, winner: 'defender', attackerWins: false, netSL: 8 } } });
    useGame.getState().bargainConfirm();
    expect(useGame.getState().merchant!.soured).toBe(true);
    useGame.getState().startBargain('sell'); // marchand méfiant → toute négociation bloquée
    expect(useGame.getState().pendingBargain).toBeNull();
  });

  it('buyItem : applique le facteur de Marchandage verrouillé (−20 % < plein) (#2c)', () => {
    const buyWith = (bargain: { won: boolean; drNet: number; negotiator: boolean } | null): number => {
      reset();
      useGame.setState({ party: [hero()], scene: merchantScene(), money: { gold: 50, silver: 0, brass: 0 } });
      useGame.getState().openMerchant('pnj');
      const m = useGame.getState().merchant!;
      useGame.setState({ merchant: { ...m, bargainBuy: bargain } });
      const label = useGame.getState().merchant!.stock.find((l) => l.qty > 0)!.label;
      const before = toBrass(useGame.getState().money);
      useGame.getState().buyItem(label, 'h');
      return before - toBrass(useGame.getState().money);
    };
    const full = buyWith(null);
    const discounted = buyWith({ won: true, drNet: 6, negotiator: false }); // ×0.8
    expect(full).toBeGreaterThan(0);
    expect(discounted).toBeLessThan(full);
  });

  it('sellItem : Option 2 — défaut/perdu = ¼ (lowball), marchandage de vente GAGNÉ = ½ (#2c)', () => {
    const sellWith = (bargainSell: { won: boolean; drNet: number; negotiator: boolean } | null): number => {
      const h = hero(); h.items = [{ uid: 'x', name: 'Hallebarde', kind: 'melee', qualities: [], enc: 3, equipped: false }] as any;
      reset();
      useGame.setState({ party: [h], scene: merchantScene(), money: { gold: 0, silver: 0, brass: 0 } });
      useGame.getState().openMerchant('pnj');
      const m = useGame.getState().merchant!;
      useGame.setState({ merchant: { ...m, bargainSell } });
      useGame.getState().sellItem('x', 'h');
      return toBrass(useGame.getState().money);
    };
    const lowball = sellWith(null); // ¼ par défaut (le marchand lowballe)
    const won = sellWith({ won: true, drNet: 2, negotiator: false }); // ½ (on a tenu notre prix)
    const lost = sellWith({ won: false, drNet: 0, negotiator: false }); // ¼ (rabaissé)
    expect(won).toBeGreaterThan(lowball); // gagner le marchandage double le gain
    expect(lost).toBe(lowball); // perdre = ne pas négocier = ¼
  });

  it('buyItem : applique la majoration d’achat paramétrable (buyMarkup) — marchand plus cher (#2)', () => {
    const buyAt = (markup: number): number => {
      reset();
      useGame.setState({ party: [hero()], scene: merchantScene(), money: { gold: 50, silver: 0, brass: 0 } });
      useGame.getState().openMerchant('pnj');
      const m = useGame.getState().merchant!;
      useGame.setState({ merchant: { ...m, buyMarkup: markup } });
      const label = useGame.getState().merchant!.stock.find((l) => l.qty > 0)!.label;
      const before = toBrass(useGame.getState().money);
      useGame.getState().buyItem(label, 'h');
      return before - toBrass(useGame.getState().money);
    };
    expect(buyAt(1.5)).toBeGreaterThan(buyAt(1)); // +50 % → coûte plus cher
  });

  const appraiser = (): Combatant => ({ id: 'h', name: 'H', characteristics: { Int: 40 }, skills: [], talents: [], items: [{ uid: 'm', name: 'Épée', kind: 'melee', qualities: ['De plaies atroces'], enc: 1, equipped: false, identified: false }], wounds: { current: 10, max: 10 }, conditions: [], weapons: [], armour: {} } as unknown as Combatant);

  it('appraiseItem : crée un pendingAppraise sur l’objet non identifié (#2e)', () => {
    useGame.setState({ party: [appraiser()], scene: merchantScene() });
    useGame.getState().openMerchant('pnj');
    useGame.getState().appraiseItem('m', 'h');
    const pa = useGame.getState().pendingAppraise!;
    expect(pa).toBeTruthy();
    expect(pa.itemUid).toBe('m');
    expect(pa.target).toBe(40); // Int 40, Intermédiaire +0
  });

  it('resolveAppraise : succès → identified=true (révèle l’objet) (#2e)', () => {
    useGame.setState({ party: [appraiser()], scene: merchantScene() });
    useGame.getState().openMerchant('pnj');
    useGame.getState().appraiseItem('m', 'h');
    const pa = useGame.getState().pendingAppraise!;
    useGame.setState({ pendingAppraise: { ...pa, roll: 10, success: true, sl: 2 } });
    useGame.getState().resolveAppraise();
    expect(useGame.getState().party[0].items!.find((i) => i.uid === 'm')!.identified).toBe(true);
    expect(useGame.getState().pendingAppraise).toBeNull();
  });

  it('resolveAppraise : échec → l’objet reste non identifié (#2e)', () => {
    useGame.setState({ party: [appraiser()], scene: merchantScene() });
    useGame.getState().openMerchant('pnj');
    useGame.getState().appraiseItem('m', 'h');
    const pa = useGame.getState().pendingAppraise!;
    useGame.setState({ pendingAppraise: { ...pa, roll: 90, success: false, sl: -3 } });
    useGame.getState().resolveAppraise();
    expect(useGame.getState().party[0].items!.find((i) => i.uid === 'm')!.identified).toBe(false);
  });

  it('Effet openMerchant : ouvre la boutique d’une entité depuis un dialogue (#2)', () => {
    useGame.setState({ party: [hero()], scene: merchantScene() });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'openMerchant', entityId: 'pnj' }]);
    expect(useGame.getState().merchant?.entityId).toBe('pnj');
  });

  it('re-stock : la déplétion PERSISTE entre visites sans temps écoulé (#T3)', () => {
    useGame.setState({ party: [hero()], scene: merchantScene(), money: { gold: 5, silver: 0, brass: 0 } });
    useGame.getState().openMerchant('pnj');
    const label = useGame.getState().merchant!.stock.find((l) => l.qty > 0)!.label;
    const q0 = useGame.getState().merchant!.stock.find((l) => l.label === label)!.qty;
    useGame.getState().buyItem(label, 'h');
    useGame.getState().closeMerchant();
    useGame.getState().openMerchant('pnj'); // ré-ouverture immédiate → stock déplété conservé
    expect(useGame.getState().merchant!.stock.find((l) => l.label === label)!.qty).toBe(q0 - 1);
  });

  it('re-stock : après ≥ restockDays (1 j), le stock est re-tiré frais (#T3)', () => {
    const t0 = useGame.getState().gameTime;
    useGame.setState({ party: [hero()], scene: merchantScene(), money: { gold: 5, silver: 0, brass: 0 } });
    useGame.getState().openMerchant('pnj');
    const rolled0 = useGame.getState().merchantStocks['pnj'].rolledAt;
    const label = useGame.getState().merchant!.stock.find((l) => l.qty > 0)!.label;
    useGame.getState().buyItem(label, 'h');
    useGame.getState().closeMerchant();
    useGame.setState({ gameTime: t0 + 2 * 24 * 60 }); // +2 jours (≥ restockDays défaut 1)
    useGame.getState().openMerchant('pnj');
    const rolled1 = useGame.getState().merchantStocks['pnj'].rolledAt;
    expect(rolled1).toBeGreaterThan(rolled0); // re-tiré au nouveau temps (stock frais)
    expect(rolled1).toBe(t0 + 2 * 24 * 60);
  });
});

describe('transferItem — donner un objet à un autre héros', () => {
  const h = (id: string, items: unknown[] = []): Combatant =>
    ({ id, name: id.toUpperCase(), items, characteristics: {}, wounds: { current: 10, max: 10 }, conditions: [], weapons: [], armour: {} } as unknown as Combatant);

  it('déplace l’objet (retiré de la source, ajouté NON équipé chez la cible)', () => {
    const a = h('a', [{ uid: 'x', name: 'Épée bâtarde', kind: 'melee', qualities: [], enc: 2, equipped: true }]);
    useGame.setState({ party: [a, h('b')] });
    useGame.getState().transferItem('x', 'a', 'b');
    const st = useGame.getState();
    expect(st.party.find((c) => c.id === 'a')!.items!.find((i) => i.uid === 'x')).toBeUndefined();
    const moved = st.party.find((c) => c.id === 'b')!.items!.find((i) => i.uid === 'x');
    expect(moved).toBeTruthy();
    expect(moved!.equipped).toBe(false); // arrive non équipé chez le destinataire
  });
  it('no-op si même héros ou objet absent', () => {
    const a = h('a', [{ uid: 'x', name: 'Dague', kind: 'melee', qualities: [], enc: 0, equipped: false }]);
    useGame.setState({ party: [a, h('b')] });
    useGame.getState().transferItem('x', 'a', 'a'); // même héros
    useGame.getState().transferItem('zzz', 'a', 'b'); // objet inexistant
    expect(useGame.getState().party.find((c) => c.id === 'a')!.items!.length).toBe(1);
    expect(useGame.getState().party.find((c) => c.id === 'b')!.items!.length).toBe(0);
  });
});

describe('viewMode (vue du dessus)', () => {
  beforeEach(() => reset());

  it('toggleViewMode bascule iso ⇄ top', () => {
    useGame.setState({ viewMode: 'iso' });
    useGame.getState().toggleViewMode();
    expect(useGame.getState().viewMode).toBe('top');
    useGame.getState().toggleViewMode();
    expect(useGame.getState().viewMode).toBe('iso');
  });

  it('startScene PRÉSERVE viewMode (préférence de vue, comme zoom/camRot)', () => {
    useGame.setState({ viewMode: 'top' });
    useGame.getState().startScene(emptyScene());
    expect(useGame.getState().viewMode).toBe('top');
  });
});

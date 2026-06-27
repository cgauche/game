import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGame, type BattleState } from './store';
import { applyAttackResult, resolveDeviation } from './combatFlow';
import { seedBattleRng } from './battleRng';
import { resetRule } from '../engine/policy';
import { deviatableArmourAt } from '../engine/items';
import { nonDeviatableMutationAP } from '../engine/corruption';
import { mutationById } from '../data/mutations';
import type { Combatant, Weapon, ItemInstance } from '../engine/types';
import type { AttackResult } from '../engine/combat';
import { emptyScene } from './scene';

// « Écailles épineuses » (EDO App.2 l.196 : « Ce PA ne peut pas être utilisé pour la Déviation Critique »)
// — la DONNÉE réelle de mutations.json, pour que ce test casse si le drapeau `noDeviation` disparaît.
const ecailles = mutationById('ecailles-epineuses')!;

const CHARS = { CC: 45, CT: 45, F: 40, E: 40, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 };

const hero = (p: Partial<Combatant>): Combatant =>
  ({
    id: 'h1', name: 'Hardi', kind: 'hero', characteristics: CHARS,
    wounds: { current: 15, max: 15 }, advantage: 0, conditions: [], movement: 4, skills: [], talents: [],
    engagedWith: [], pos: { x: 0, y: 0 }, size: 'moyenne', weapons: [], items: [], fate: 0,
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    ...p,
  } as unknown as Combatant);

const enemy = (p: Partial<Combatant>): Combatant =>
  ({
    id: 'e1', name: 'Brute', kind: 'enemy', characteristics: CHARS,
    wounds: { current: 20, max: 20 }, advantage: 0, conditions: [], movement: 4, skills: [], talents: [],
    engagedWith: [], pos: { x: 1, y: 0 }, size: 'moyenne',
    weapons: [{ name: 'Gourdin', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [] } as Weapon], items: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    ...p,
  } as unknown as Combatant);

function setBattle(combatants: Combatant[]): BattleState {
  const battle: BattleState = {
    combatants, order: combatants.map((c) => c.id), baseOrder: combatants.map((c) => c.id),
    turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
  } as unknown as BattleState;
  useGame.setState({ battle, mode: 'battle', scene: emptyScene(), gameTime: 12 * 60, pendingReveals: [], pendingCascade: null, pendingFateSave: null });
  return battle;
}

const critWeapon: Weapon = { name: 'Gourdin', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [] };
const critRes = (): AttackResult => ({
  hit: true, attackerRoll: 12, netSL: 4, location: 'corps', damage: 8, woundsLost: 3,
  critical: true, advantageTo: null, defenderDefeated: false, log: 'Coup Critique (corps)',
});

// Une pièce d'armure PORTÉE (héros) — `wornArmourPoints` la lit (equipped + kind:'armor' + pa + locs).
const wornPiece = (pa: number): ItemInstance =>
  ({ uid: 'arm1', name: 'Plastron', kind: 'armor', equipped: true, pa, locs: ['corps'], qualities: [] } as unknown as ItemInstance);

// ── PA déviatable (LDB 63 l.30) : pur, sans flux ──────────────────────────────
describe('deviatableArmourAt / nonDeviatableMutationAP — PA sacrifiable (LDB 63 l.30 + EDO App.2 l.196)', () => {
  it('Écailles épineuses (EDO App.2 l.196) : son PA est marqué hors-Déviation', () => {
    const c = hero({ mutations: [ecailles] });
    expect(nonDeviatableMutationAP(c, 'corps')).toBe(1);
  });

  it('sans mutation : aucun PA hors-Déviation', () => {
    expect(nonDeviatableMutationAP(hero({}), 'corps')).toBe(0);
  });

  it('armure portée seule → PA entièrement déviatable', () => {
    const c = hero({ armour: { tete: 0, brasG: 0, brasD: 0, corps: 3, jambeG: 0, jambeD: 0 } });
    expect(deviatableArmourAt(c, 'corps')).toBe(3);
  });

  it('Trait créature Armure (PA de statbloc, LDB 85) → reste DÉVIATABLE (non barré)', () => {
    // PA de profil créature, sans pièce portée ni mutation marquée : aucune exclusion (LDB 85 l.37-39).
    const c = enemy({ armour: { tete: 0, brasG: 0, brasD: 0, corps: 3, jambeG: 0, jambeD: 0 } });
    expect(nonDeviatableMutationAP(c, 'corps')).toBe(0);
    expect(deviatableArmourAt(c, 'corps')).toBe(3);
  });

  it('Écailles seule (PA = 1, noDeviation) → PA déviatable NUL (EDO App.2 l.196)', () => {
    const c = hero({ armour: { tete: 0, brasG: 0, brasD: 0, corps: 1, jambeG: 0, jambeD: 0 }, mutations: [ecailles] });
    expect(deviatableArmourAt(c, 'corps')).toBe(0);
  });

  it('armure portée (3) + Écailles (1) → seul le PA porté (3) est déviatable', () => {
    const c = hero({ armour: { tete: 0, brasG: 0, brasD: 0, corps: 4, jambeG: 0, jambeD: 0 }, mutations: [ecailles] });
    expect(deviatableArmourAt(c, 'corps')).toBe(3);
  });
});

// ── Flux de Déviation Critique (intégration légère) ───────────────────────────
describe('Déviation Critique — flux (LDB 63 l.30/63 + EDO App.2 l.196)', () => {
  beforeEach(() => { seedBattleRng(424242); });
  afterEach(() => resetRule('combat-critical-deflect'));

  it('héros SANS armure à la localisation → AUCUNE offre de déviation, le Critique s’applique (bug LDB 63 l.30)', () => {
    const e = enemy({});
    const h = hero({ armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, criticalWounds: 0 });
    setBattle([e, h]);
    const suspended = applyAttackResult(useGame.getState, useGame.setState, e, h, critWeapon, critRes());
    expect(suspended).toBe(false); // pas de suspension : rien à sacrifier
    expect(useGame.getState().pendingCascade?.participants.some((s) => s.kind === 'deviation')).toBeFalsy();
    const hh = useGame.getState().battle!.combatants.find((c) => c.id === 'h1')!;
    expect(hh.criticalWounds ?? 0).toBe(1); // Critique subi
  });

  it('héros avec une PIÈCE portée → Déviation offerte ; sur « Dévier », la pièce perd 1 PA, Critique ignoré', () => {
    const e = enemy({});
    const h = hero({ armour: { tete: 0, brasG: 0, brasD: 0, corps: 3, jambeG: 0, jambeD: 0 }, items: [wornPiece(3)], criticalWounds: 0 });
    setBattle([e, h]);
    const suspended = applyAttackResult(useGame.getState, useGame.setState, e, h, critWeapon, critRes());
    expect(suspended).toBe(true);
    const step = useGame.getState().pendingCascade!.participants.find((s) => s.kind === 'deviation')!;
    expect(step).toBeTruthy();
    resolveDeviation(useGame.getState, useGame.setState, step.deviation!, true); // « Dévier »
    const hh = useGame.getState().battle!.combatants.find((c) => c.id === 'h1')!;
    expect(hh.items!.find((i) => i.uid === 'arm1')!.damageTaken).toBe(1); // pièce endommagée (−1 PA)
    expect(hh.armour.corps).toBe(2);                                       // PA re-dérivée
    expect(hh.criticalWounds ?? 0).toBe(0);                               // Critique ignoré
  });

  it('ennemi avec le Trait créature Armure (PA statbloc) → auto-Déviation ÉLIGIBLE (LDB 85)', () => {
    const h = hero({});
    const e = enemy({ armour: { tete: 0, brasG: 0, brasD: 0, corps: 3, jambeG: 0, jambeD: 0 }, criticalWounds: 0 });
    setBattle([h, e]);
    applyAttackResult(useGame.getState, useGame.setState, h, e, critWeapon, critRes());
    const ee = useGame.getState().battle!.combatants.find((c) => c.id === 'e1')!;
    expect(ee.armour.corps).toBe(2);        // auto-dévie : −1 PA de statbloc
    expect(ee.criticalWounds ?? 0).toBe(0); // Critique ignoré
  });

  it('PA uniquement issu d’Écailles (noDeviation) → PAS de Déviation, le Critique s’applique (EDO App.2 l.196)', () => {
    const h = hero({});
    const e = enemy({ armour: { tete: 0, brasG: 0, brasD: 0, corps: 1, jambeG: 0, jambeD: 0 }, mutations: [ecailles], criticalWounds: 0 });
    setBattle([h, e]);
    applyAttackResult(useGame.getState, useGame.setState, h, e, critWeapon, critRes());
    const ee = useGame.getState().battle!.combatants.find((c) => c.id === 'e1')!;
    expect(ee.armour.corps).toBe(1);        // PA d'Écailles INTACT (non sacrifiable)
    expect(ee.criticalWounds ?? 0).toBe(1); // Critique subi
  });

  it('héros : armure portée + Écailles → « Dévier » sacrifie la PIÈCE, le PA d’Écailles reste intact', () => {
    const e = enemy({});
    const h = hero({ armour: { tete: 0, brasG: 0, brasD: 0, corps: 4, jambeG: 0, jambeD: 0 }, items: [wornPiece(3)], mutations: [ecailles], criticalWounds: 0 });
    setBattle([e, h]);
    const suspended = applyAttackResult(useGame.getState, useGame.setState, e, h, critWeapon, critRes());
    expect(suspended).toBe(true);
    const step = useGame.getState().pendingCascade!.participants.find((s) => s.kind === 'deviation')!;
    resolveDeviation(useGame.getState, useGame.setState, step.deviation!, true);
    const hh = useGame.getState().battle!.combatants.find((c) => c.id === 'h1')!;
    expect(hh.items!.find((i) => i.uid === 'arm1')!.damageTaken).toBe(1); // pièce portée endommagée
    expect(hh.armour.corps).toBe(3);                                      // (3−1) porté + 1 Écailles
    expect(hh.criticalWounds ?? 0).toBe(0);
  });
});

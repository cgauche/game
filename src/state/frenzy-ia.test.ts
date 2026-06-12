import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { chooseEnemyAction, EnemyTurnInput } from './ai';
import { emptyScene } from './scene';
import { useGame } from './store';
import { aiMaybeFrenzy, aiFrenzyAttack } from './combatFlow';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { testScene } from '../scenes/test-fixture';
import type { Combatant, Weapon } from '../engine/types';

const MELEE: Weapon = { name: 'Épée', type: 'melee', damage: '+BF+4', qualities: [] };

function mk(id: string, kind: 'hero' | 'enemy', pos: { x: number; y: number }, opts: Partial<Combatant> = {}): Combatant {
  return {
    id, name: id, kind, pos,
    wounds: { current: 10, max: 10 },
    weapons: [MELEE],
    characteristics: {} as never,
    advantage: 0, conditions: [], armour: {} as never,
    skills: [], talents: [], movement: 4,
    ...opts,
  } as Combatant;
}

const scene = emptyScene(12, 12);
function input(enemy: Combatant, heroes: Combatant[], extra: Partial<EnemyTurnInput> = {}): EnemyTurnInput {
  return { enemy, heroes, scene, blocked: new Set(heroes.map((h) => `${h.pos!.x},${h.pos!.y}`)), movement: enemy.movement, ...extra };
}

describe('Frénésie IA — cible la plus proche (chooseEnemyAction, pur, LDB 21 l.34)', () => {
  it('frenzied : vise le plus PROCHE en Ligne de Vue (pas le plus faible distant)', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { frenzied: true, movement: 4 });
    const near = mk('near', 'hero', { x: 5, y: 6 }, { wounds: { current: 10, max: 10 } }); // proche, costaud
    const far = mk('far', 'hero', { x: 5, y: 9 }, { wounds: { current: 2, max: 10 } }); // faible, atteignable MAIS plus loin
    const action = chooseEnemyAction(input(e, [near, far]));
    const tid = (action as { targetId?: string; thenTargetId?: string }).targetId ?? (action as { thenTargetId?: string }).thenTargetId;
    expect(tid).toBe('near');
  });

  it('non frenzied : conserve le ciblage du plus faible (régression)', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 });
    const near = mk('near', 'hero', { x: 5, y: 6 }, { wounds: { current: 10, max: 10 } });
    const far = mk('far', 'hero', { x: 5, y: 7 }, { wounds: { current: 2, max: 10 } }); // faible, atteignable
    const action = chooseEnemyAction(input(e, [near, far]));
    const tid = (action as { targetId?: string; thenTargetId?: string }).targetId ?? (action as { thenTargetId?: string }).thenTargetId;
    expect(tid).toBe('far');
  });
});

describe('Frénésie IA — entrée auto & attaque libre', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    useGame.setState({ battle: null });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  function setupBattle() {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'H', rng: makeRNG(1) });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const E = b.combatants.find((c) => c.kind === 'enemy')!;
    b.combatants.filter((c) => c.kind === 'enemy' && c.id !== E.id).forEach((e) => (e.dead = true));
    H.pos = { x: 10, y: 10 };
    E.pos = { x: 11, y: 10 }; // adjacent + Ligne de Vue dégagée
    useGame.setState({ battle: { ...b }, pendingReveals: [] });
    return { H, E };
  }

  it('aiMaybeFrenzy : ennemi capable + adversaire en LdV → entre en Frénésie (Test de FM réussi)', () => {
    useGame.getState().seedRng(5);
    const { E } = setupBattle();
    E.traits = ['Frénésie'];
    E.characteristics.FM = 99; // réussite quasi certaine
    aiMaybeFrenzy(useGame.getState, useGame.setState, E);
    expect(useGame.getState().battle!.combatants.find((c) => c.id === E.id)!.frenzied).toBe(true);
  });

  it('aiMaybeFrenzy : aucun adversaire vivant en LdV → pas de Frénésie', () => {
    const { H, E } = setupBattle();
    E.traits = ['Frénésie'];
    E.characteristics.FM = 99;
    (H as Combatant).dead = true;
    aiMaybeFrenzy(useGame.getState, useGame.setState, E);
    expect(!!useGame.getState().battle!.combatants.find((c) => c.id === E.id)!.frenzied).toBe(false);
  });

  it('aiMaybeFrenzy : ennemi NON capable → pas de Frénésie', () => {
    const { E } = setupBattle();
    E.characteristics.FM = 99; // mais aucun trait/talent « Frénésie »
    aiMaybeFrenzy(useGame.getState, useGame.setState, E);
    expect(!!useGame.getState().battle!.combatants.find((c) => c.id === E.id)!.frenzied).toBe(false);
  });

  it('aiFrenzyAttack : attaque de mêlée LIBRE (ne consomme pas l’Action) contre un adversaire adjacent', () => {
    useGame.getState().seedRng(4);
    const { E } = setupBattle();
    E.frenzied = true;
    E.weapons = [MELEE];
    useGame.setState({ battle: { ...useGame.getState().battle!, acted: false } });
    const logBefore = useGame.getState().battle!.log.length;
    aiFrenzyAttack(useGame.getState, useGame.setState, E);
    const st = useGame.getState();
    expect(st.battle!.log.length).toBeGreaterThan(logBefore); // une attaque a bien été résolue
    expect(st.battle!.acted).toBe(false); // gratuite : l'Action n'est pas consommée
  });

  it('aiFrenzyAttack : aucun adversaire adjacent → no-op', () => {
    const { E } = setupBattle();
    E.frenzied = true;
    E.pos = { x: 1, y: 1 }; // loin du héros (10,10)
    E.weapons = [MELEE];
    useGame.setState({ battle: { ...useGame.getState().battle!, acted: false } });
    const logBefore = useGame.getState().battle!.log.length;
    aiFrenzyAttack(useGame.getState, useGame.setState, E);
    expect(useGame.getState().battle!.log.length).toBe(logBefore);
  });
});

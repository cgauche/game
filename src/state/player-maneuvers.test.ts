/**
 * Manœuvres JOUEUR (« Manœuvre ▾ ») — un héros qui possède un trait d'attaque de créature
 * (mutation/polymorphie) peut l'activer. Couvre la SOURCE UNIQUE `availableManeuvers` (énumération
 * dédupliquée : traits abordables/légaux + Piétinement + mutation Tentacule) et le câblage store
 * (manœuvre de ZONE résolue directement ; manœuvre de mêlée CIBLÉE → pendingAttack avec freeKind).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { availableManeuvers } from './combatFlow';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { testScene } from '../scenes/test-fixture';
import type { Combatant } from '../engine/types';
import type { BattleState } from './store';

const at = (kind: 'hero' | 'enemy', id: string, x: number, y: number, over: Partial<Combatant> = {}): Combatant =>
  ({
    id, name: id, kind,
    characteristics: { CC: 40, CT: 30, F: 30, E: 35, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
    wounds: { current: 20, max: 20 }, advantage: 0, conditions: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], items: [], movement: 4, pos: { x, y }, ...over,
  }) as unknown as Combatant;

const mkBattle = (combatants: Combatant[], over: Partial<BattleState> = {}): BattleState =>
  ({ combatants, acted: false, ...over }) as unknown as BattleState;

describe('availableManeuvers — énumération (pur)', () => {
  it('Morsure +10 : manœuvre CIBLÉE présente avec Avantage ≥ 1, absente à 0', () => {
    const enemy = at('enemy', 'E', 5, 6);
    const heroAdv = at('hero', 'H', 5, 5, { traits: [{ id: 'morsure', value: 10 }], advantage: 1 });
    const m = availableManeuvers(heroAdv, mkBattle([heroAdv, enemy]));
    const morsure = m.find((x) => x.kind === 'morsure');
    expect(morsure).toBeTruthy();
    expect(morsure!.mode).toBe('target'); // mêlée → clic-cible requis
    expect(morsure!.dispatch).toBe('maneuver');
    expect(morsure!.cost).toBe(1);

    const heroNoAdv = at('hero', 'H', 5, 5, { traits: [{ id: 'morsure', value: 10 }], advantage: 0 });
    expect(availableManeuvers(heroNoAdv, mkBattle([heroNoAdv, enemy])).some((x) => x.kind === 'morsure')).toBe(false);
  });

  it('Souffle +15 (Feu) : manœuvre CIBLÉE (zone, clic = point d’impact) présente avec Avantage ≥ 2', () => {
    const enemy = at('enemy', 'E', 5, 6);
    const hero = at('hero', 'H', 5, 5, { traits: [{ id: 'souffle', value: 15, arg: 'Feu' }], advantage: 2 });
    const souffle = availableManeuvers(hero, mkBattle([hero, enemy])).find((x) => x.kind === 'souffle');
    expect(souffle).toBeTruthy();
    expect(souffle!.mode).toBe('target'); // zone CIBLÉE : le clic désigne le point d’impact (LDB 85 « cible visible »)
    expect(souffle!.dispatch).toBe('maneuver');
    expect(souffle!.cost).toBe(2);

    const heroLow = at('hero', 'H', 5, 5, { traits: [{ id: 'souffle', value: 15, arg: 'Feu' }], advantage: 1 });
    expect(availableManeuvers(heroLow, mkBattle([heroLow, enemy])).some((x) => x.kind === 'souffle')).toBe(false);
  });

  it('Piétinement : présent si un adversaire adjacent PLUS PETIT existe et Avantage ≥ 1', () => {
    const small = at('enemy', 'E', 5, 6, { size: 'petite' });
    const hero = at('hero', 'H', 5, 5, { size: 'grande', advantage: 1 });
    const m = availableManeuvers(hero, mkBattle([hero, small]));
    const piet = m.find((x) => x.id === 'pietinement');
    expect(piet).toBeTruthy();
    expect(piet!.dispatch).toBe('trample');
    expect(piet!.mode).toBe('target');

    const heroNoAdv = at('hero', 'H', 5, 5, { size: 'grande', advantage: 0 });
    expect(availableManeuvers(heroNoAdv, mkBattle([heroNoAdv, small])).some((x) => x.id === 'pietinement')).toBe(false);
  });

  it('mutation Tentacule : présente avec l’arme nat-tentacule + cible adjacente + pas encore utilisée', () => {
    const enemy = at('enemy', 'E', 5, 6);
    const hero = at('hero', 'H', 5, 5, {
      weapons: [{ name: 'Tentacule', type: 'melee', damage: '+BF', qualities: [], uid: 'nat-tentacule' }] as Combatant['weapons'],
    });
    const t = availableManeuvers(hero, mkBattle([hero, enemy])).find((x) => x.id === 'tentacule');
    expect(t).toBeTruthy();
    expect(t!.dispatch).toBe('tentacle');
    expect(t!.cost).toBe(0);

    const used = at('hero', 'H', 5, 5, {
      weapons: [{ name: 'Tentacule', type: 'melee', damage: '+BF', qualities: [], uid: 'nat-tentacule' }] as Combatant['weapons'],
      tentacleUsedThisTurn: true,
    });
    expect(availableManeuvers(used, mkBattle([used, enemy])).some((x) => x.id === 'tentacule')).toBe(false);
  });

  it('exclut l’attaque-Action normale (kind arme) et les manœuvres de Charge (Cornes)', () => {
    const enemy = at('enemy', 'E', 5, 6);
    const hero = at('hero', 'H', 5, 5, { traits: [{ id: 'cornes', value: 8 }], advantage: 5 });
    const m = availableManeuvers(hero, mkBattle([hero, enemy]));
    expect(m.some((x) => x.kind === 'cornes')).toBe(false); // déclenchement charge → exclu de la liste
    expect(m.some((x) => x.kind === 'arme')).toBe(false);
  });
});

describe('manœuvres en combat (store)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    useGame.setState({ battle: null, pendingAttack: null });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  function setup() {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'H', rng: makeRNG(1) });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const enemies = b.combatants.filter((c) => c.kind === 'enemy');
    enemies.slice(1).forEach((e) => (e.dead = true));
    const E = enemies[0];
    H.pos = { x: 10, y: 10 };
    E.pos = { x: 11, y: 10 };
    E.wounds = { current: 30, max: 30, base: 30 } as Combatant['wounds'];
    E.armour = { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 };
    const turn = b.order.indexOf(H.id);
    useGame.setState({ battle: { ...b, turn, movementUsed: 0, acted: false } });
    return { H, E };
  }

  it('Souffle CIBLÉ : battle.action=maneuver + clic = point d’impact → pendingManeuver{targetId} (jet différé)', () => {
    useGame.getState().seedRng(2);
    const { H, E } = setup();
    H.traits = [{ id: 'souffle', value: 15, arg: 'Feu' }];
    H.characteristics.CT = 90; // Test opposé CT/Esquive → touche déterministe
    H.advantage = 3;
    // La hotbar arme `battle.action='maneuver'` (mode-cible) ; le clic-entité désigne le point d’impact.
    useGame.setState({ battle: { ...useGame.getState().battle!, action: 'maneuver', maneuverKind: 'souffle' } });
    useGame.getState().battleClickEntity(E.id);
    const pm = useGame.getState().pendingManeuver;
    expect(pm).toBeTruthy(); // « un jet = une modale » : le Souffle ouvre la modale de jet d’attaquant
    expect(pm!.kind).toBe('souffle');
    expect(pm!.targetId).toBe(E.id); // point d’impact = entité cliquée
    expect(pm!.result).toBeNull(); // rien n’est tiré avant Lancer
    expect(pm!.avantageSpent).toBe(2); // coût RAW affiché (dépensé à l’application)
    expect(useGame.getState().battle!.acted).toBe(false); // gratuite : l’Action reste
    // (résolution complète Lancer→Appliquer couverte par maneuver-flow.test.ts)
  });

  it('manœuvre de mêlée ciblée : battle.action=maneuver + clic-cible → pendingAttack freeKind=morsure', () => {
    const { H, E } = setup();
    H.traits = [{ id: 'morsure', value: 10 }];
    H.advantage = 2;
    useGame.setState({ battle: { ...useGame.getState().battle!, action: 'maneuver', maneuverKind: 'morsure' } });
    useGame.getState().battleClickEntity(E.id);
    const pa = useGame.getState().pendingAttack;
    expect(pa).toBeTruthy();
    expect(pa!.freeKind).toBe('morsure');
    expect(pa!.targetId).toBe(E.id);
    expect(pa!.result).toBeNull(); // « un jet = une modale » : rien n’est tiré avant Lancer
    // L’Avantage est dépensé à l’armement de l’attaque (coût RAW 1).
    expect(useGame.getState().battle!.combatants.find((c) => c.id === H.id)!.advantage).toBe(1);
  });
});

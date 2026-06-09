import { describe, it, expect } from 'vitest';
import { hasMeaningfulOption } from './turnEconomy';
import type { Combatant } from '../engine/types';
import type { BattleState } from './store';

const hero = (over: Partial<Combatant> = {}): Combatant =>
  ({
    id: 'H', name: 'H', kind: 'hero',
    characteristics: { CC: 40, CT: 40, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
    wounds: { current: 10, max: 10 }, advantage: 0, conditions: [],
    weapons: [{ name: 'Épée', type: 'melee', damage: '+BF', qualities: [] }],
    armour: {}, skills: [], talents: [], movement: 4, pos: { x: 0, y: 0 }, ...over,
  }) as unknown as Combatant;

const battle = (active: Combatant, over: Partial<BattleState> = {}): BattleState =>
  ({
    combatants: [active], order: [active.id], turn: 0, round: 1, action: null, selectedSpell: null,
    reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null, ...over,
  }) as unknown as BattleState;

describe('hasMeaningfulOption — garde-fou « tour gâché » (R6)', () => {
  it('tour frais (Action + Mouvement) → true', () => {
    const h = hero();
    expect(hasMeaningfulOption(h, battle(h))).toBe(true);
  });

  it('Action ET Mouvement dépensés, rien d’autre → false', () => {
    const h = hero();
    expect(hasMeaningfulOption(h, battle(h, { acted: true, movementUsed: 99, movedPreAction: true }))).toBe(false);
  });

  it('Action dépensée mais Mouvement restant → true', () => {
    const h = hero();
    expect(hasMeaningfulOption(h, battle(h, { acted: true, movementUsed: 0 }))).toBe(true);
  });

  it('tout dépensé mais Détermination + un État retirable → true', () => {
    const h = hero({ resolve: 1, conditions: [{ name: 'Sonné', value: 1 }] });
    expect(hasMeaningfulOption(h, battle(h, { acted: true, movementUsed: 99, movedPreAction: true }))).toBe(true);
  });

  it('tout dépensé mais attaque libre de Frénésie disponible → true', () => {
    const h = hero({ frenzied: true, frenzyFreeUsed: false });
    expect(hasMeaningfulOption(h, battle(h, { acted: true, movementUsed: 99, movedPreAction: true }))).toBe(true);
  });

  it('un ennemi n’a jamais d’« option de joueur » → false', () => {
    const e = hero({ id: 'E', kind: 'enemy' });
    expect(hasMeaningfulOption(e, battle(e))).toBe(false);
  });
});

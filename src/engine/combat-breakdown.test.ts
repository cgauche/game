import { describe, it, expect } from 'vitest';
import { resolveMelee, resolveRanged } from './combat';
import { makeRNG } from './dice';
import { Combatant, Weapon } from './types';

const mk = (over: Partial<Combatant> = {}): Combatant =>
  ({
    id: 'x',
    name: 'X',
    kind: 'enemy',
    characteristics: { CC: 50, CT: 50, F: 30, E: 30, I: 30, Ag: 40, Dex: 30, Int: 30, FM: 30, Soc: 30 },
    wounds: { current: 12, max: 12 },
    advantage: 0,
    conditions: [],
    weapons: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [],
    talents: [],
    movement: 4,
    ...over,
  }) as unknown as Combatant;

const sword: Weapon = { name: 'Épée', type: 'melee', damage: '+BF+4', qualities: [] };
const bow: Weapon = { name: 'Arc', type: 'ranged', damage: '+8', range: 60, qualities: [] };

describe('AttackResult — détail des jets (breakdown) pour la modale', () => {
  it('mêlée opposée : détaille l’attaquant ET le défenseur (cible + DR)', () => {
    const res = resolveMelee(mk({ name: 'Att' }), mk({ name: 'Def' }), sword, makeRNG(7));
    expect(res.attackerDetail).toBeTruthy();
    expect(res.attackerDetail!.label).toBe('Corps à corps');
    expect(res.attackerDetail!.base).toBe(50); // CC de base
    // cible = base + modificateurs (Avantage, viser, États…)
    expect(res.attackerDetail!.target).toBe(res.attackerDetail!.base + res.attackerDetail!.modifier);
    expect(typeof res.attackerDetail!.sl).toBe('number'); // le DR du jet
    expect(res.defenderDetail).toBeTruthy(); // jet OPPOSÉ → le défenseur est détaillé aussi
    expect(['Parade', 'Esquive']).toContain(res.defenderDetail!.label);
  });

  it('distance : détaille l’attaquant, pas de défenseur (non opposé)', () => {
    const res = resolveRanged(mk({ name: 'Tir' }), mk({ name: 'Cible' }), bow, makeRNG(3));
    expect(res.attackerDetail!.label).toBe('Projectiles');
    expect(res.defenderDetail).toBeUndefined();
  });
});

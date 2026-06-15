import { describe, it, expect } from 'vitest';
import { PERSISTENT_CONDITIONS, carryOverState } from './persistence';
import { traumaFromKind } from './trauma';
import type { Combatant } from './types';

function baseCombatant(over: Partial<Combatant> = {}): Combatant {
  return {
    id: 'h1', name: 'Test', kind: 'hero',
    characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
    wounds: { current: 12, max: 12 },
    advantage: 3, conditions: [], weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], movement: 4,
    ...over,
  } as Combatant;
}

describe('persistence — classement RAW des États', () => {
  it('classe les États persistants (LDB 16-États)', () => {
    expect(PERSISTENT_CONDITIONS.has('Hémorragique')).toBe(true);
    expect(PERSISTENT_CONDITIONS.has('Empoisonné')).toBe(true);
    expect(PERSISTENT_CONDITIONS.has('En flammes')).toBe(true);
    expect(PERSISTENT_CONDITIONS.has('Exténué')).toBe(true);
    expect(PERSISTENT_CONDITIONS.has('Brisé')).toBe(true);
    expect(PERSISTENT_CONDITIONS.has('Inconscient')).toBe(true);
  });
  it('exclut les États transitoires', () => {
    for (const n of ['Surpris', 'À Terre', 'Sonné', 'Aveuglé', 'Assourdi', 'Empêtré']) {
      expect(PERSISTENT_CONDITIONS.has(n)).toBe(false);
    }
  });
});

describe('persistence — carryOverState', () => {
  it('conserve Blessures, critiques, mort et les États persistants ; jette le transitoire', () => {
    const c = baseCombatant({
      wounds: { current: 4, max: 12 },
      conditions: [{ name: 'Hémorragique', value: 2 }, { name: 'Surpris', value: 1 }, { name: 'Exténué', value: 1 }],
      criticalWounds: 1, roundsAtZero: 0, dead: false, outOfRencontre: false,
    });
    const s = carryOverState(c);
    expect(s.wounds.current).toBe(4);
    expect(s.criticalWounds).toBe(1);
    expect(s.conditions.find((x) => x.name === 'Hémorragique')?.value).toBe(2);
    expect(s.conditions.some((x) => x.name === 'Exténué')).toBe(true);
    expect(s.conditions.some((x) => x.name === 'Surpris')).toBe(false);
  });
  it('reporte la mort (dead / outOfRencontre)', () => {
    expect(carryOverState(baseCombatant({ dead: true })).dead).toBe(true);
    expect(carryOverState(baseCombatant({ outOfRencontre: true })).outOfRencontre).toBe(true);
  });
  it('ne partage pas les références de conditions (copie défensive)', () => {
    const c = baseCombatant({ conditions: [{ name: 'Hémorragique', value: 1 }] });
    const s = carryOverState(c);
    s.conditions[0].value = 99;
    expect(c.conditions[0].value).toBe(1);
  });
  it('reporte soinRencontreUtilise (limite 1 soin/rencontre survit au combat)', () => {
    expect(carryOverState(baseCombatant({ soinRencontreUtilise: true })).soinRencontreUtilise).toBe(true);
    expect(carryOverState(baseCombatant({})).soinRencontreUtilise).toBe(false);
  });
  it('persiste les traumatismes', () => {
    const c = baseCombatant({ traumas: [traumaFromKind('fracture', 'mineur', 'jambeG')] });
    const s = carryOverState(c);
    expect(s.traumas.length).toBe(1);
    expect(s.traumas[0].ops?.some((o) => o.op === 'moveScale')).toBe(true);
  });
});

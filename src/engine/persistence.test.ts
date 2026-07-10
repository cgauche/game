import { describe, it, expect } from 'vitest';
import { PERSISTENT_CONDITIONS, carryOverState } from './persistence';
import { traumaById, dechirureFractureFicheId } from './trauma';
import type { HitLocation } from './types';
const tk = (k: 'dechirure' | 'fracture', s: 'mineur' | 'majeur', loc: HitLocation, opts?: { be?: number; d10?: number }) => traumaById(dechirureFractureFicheId(k, s, loc), opts, loc);
import type { Combatant } from './types';

function baseCombatant(over: Partial<Combatant> = {}): Combatant {
  return {
    id: 'h1', name: 'Test', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 12, max: 12 },
    advantage: 3, conditions: [], weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], movement: 4,
    ...over,
  } as Combatant;
}

describe('persistence — classement RAW des États', () => {
  it('classe les États persistants (LDB 16-États)', () => {
    expect(PERSISTENT_CONDITIONS.has('hemorragique')).toBe(true);
    expect(PERSISTENT_CONDITIONS.has('empoisonne')).toBe(true);
    expect(PERSISTENT_CONDITIONS.has('en-flammes')).toBe(true);
    expect(PERSISTENT_CONDITIONS.has('extenue')).toBe(true);
    expect(PERSISTENT_CONDITIONS.has('brise')).toBe(true);
    expect(PERSISTENT_CONDITIONS.has('inconscient')).toBe(true);
  });
  it('exclut les États transitoires', () => {
    for (const n of ['surpris', 'a-terre', 'sonne', 'aveugle', 'assourdi', 'empetre']) {
      expect(PERSISTENT_CONDITIONS.has(n)).toBe(false);
    }
  });
});

describe('persistence — carryOverState', () => {
  it('conserve Blessures, critiques, mort et les États persistants ; jette le transitoire', () => {
    const c = baseCombatant({
      wounds: { current: 4, max: 12 },
      conditions: [{ name: 'hemorragique', value: 2 }, { name: 'surpris', value: 1 }, { name: 'extenue', value: 1 }],
      criticalWounds: 1, roundsAtZero: 0, dead: false, outOfRencontre: false,
    });
    const s = carryOverState(c);
    expect(s.wounds.current).toBe(4);
    expect(s.criticalWounds).toBe(1);
    expect(s.conditions.find((x) => x.name === 'hemorragique')?.value).toBe(2);
    expect(s.conditions.some((x) => x.name === 'extenue')).toBe(true);
    expect(s.conditions.some((x) => x.name === 'surpris')).toBe(false);
  });
  it('reporte la mort (dead / outOfRencontre)', () => {
    expect(carryOverState(baseCombatant({ dead: true })).dead).toBe(true);
    expect(carryOverState(baseCombatant({ outOfRencontre: true })).outOfRencontre).toBe(true);
  });
  it('ne partage pas les références de conditions (copie défensive)', () => {
    const c = baseCombatant({ conditions: [{ name: 'hemorragique', value: 1 }] });
    const s = carryOverState(c);
    s.conditions[0].value = 99;
    expect(c.conditions[0].value).toBe(1);
  });
  it('reporte soinRencontreUtilise (limite 1 soin/rencontre survit au combat)', () => {
    expect(carryOverState(baseCombatant({ soinRencontreUtilise: true })).soinRencontreUtilise).toBe(true);
    expect(carryOverState(baseCombatant({})).soinRencontreUtilise).toBe(false);
  });
  it('persiste les traumatismes', () => {
    const c = baseCombatant({ traumas: [tk('fracture', 'mineur', 'jambeG')] });
    const s = carryOverState(c);
    expect(s.traumas.length).toBe(1);
    expect(s.traumas[0].ops?.some((o) => o.op === 'moveScale')).toBe(true);
  });
});

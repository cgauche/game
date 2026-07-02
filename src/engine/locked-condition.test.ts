import { describe, it, expect } from 'vitest';
import type { Combatant } from './types';
import type { Condition } from './flowCore';
import { addCondition, removeCondition, hasCondition, stacks, isConditionLocked } from './conditions';
import { applyOps } from './ops';
import criticalsJson from '../data/criticals.json';
import miscastJson from '../data/miscast.json';

function mk(): Combatant {
  return {
    id: 'x', name: 'X', kind: 'hero', characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
    conditions: [], activeEffects: [], skills: [], talents: [], traits: [], weapons: [], armour: [],
    wounds: { current: 10, max: 10, base: 10 }, advantage: 0,
  } as unknown as Combatant;
}

const noHemo: Condition = { kind: 'compare', subject: { who: 'target', condition: 'hemorragique' }, op: '==', value: 0 };

describe('Verrou d’État de Critique — lockedUntil (LDB 18)', () => {
  it('Aveuglé verrouillé tant qu’un Hémorragique subsiste : removeCondition inerte', () => {
    const c = mk();
    addCondition(c, 'hemorragique', 2);
    addCondition(c, 'aveugle', 1, undefined, noHemo);
    expect(isConditionLocked(c.conditions.find((x) => x.name === 'aveugle')!, c)).toBe(true);
    removeCondition(c, 'aveugle'); // auto-dissipation / soin : bloqué
    expect(hasCondition(c, 'aveugle')).toBe(true);
  });

  it('une fois les Hémorragique éliminés, l’Aveuglé se déverrouille et part', () => {
    const c = mk();
    addCondition(c, 'hemorragique', 1);
    addCondition(c, 'aveugle', 1, undefined, noHemo);
    removeCondition(c, 'hemorragique'); // Hémorragique = 0
    expect(isConditionLocked(c.conditions.find((x) => x.name === 'aveugle')!, c)).toBe(false);
    removeCondition(c, 'aveugle');
    expect(hasCondition(c, 'aveugle')).toBe(false);
  });

  it('sans lockedUntil : aucun verrou (comportement inchangé)', () => {
    const c = mk();
    addCondition(c, 'sonne', 2);
    removeCondition(c, 'sonne');
    expect(stacks(c, 'sonne')).toBe(1);
  });
});

describe('Données — verrous & escapeStrength câblés (RAW)', () => {
  it('Critique Tête « En plein front » (46-50) : l’op Aveuglé porte lockedUntil == 0 Hémorragique', () => {
    const entry = (criticalsJson as { tete: { id: string; ops?: { op: string; name?: string; lockedUntil?: unknown }[] }[] }).tete.find((e) => e.id === 'en-plein-front')!;
    const aveugleOp = entry.ops!.find((o) => o.op === 'condition' && o.name === 'aveugle')!;
    expect(aveugleOp.lockedUntil).toEqual(noHemo);
  });

  it('Imparfaite « Tenue indisciplinée » (LDB 46) : Empêtré avec Force d’évasion 1d10×5', () => {
    const entry = (miscastJson as { minor: { name: string; ops?: { op: string; name?: string; escapeStrength?: unknown }[] }[] }).minor.find((e) => e.name === 'Tenue indisciplinée')!;
    const op = entry.ops!.find((o) => o.op === 'condition')!;
    expect(op.name).toBe('empetre');
    // Résolution du 1d10×5 (multiple de 5, borné 5..50) via applyOps.
    for (let i = 0; i < 20; i++) {
      const c = mk();
      applyOps(c, entry.ops as import('./ops').GameOp[], { label: 'Tenue indisciplinée' });
      const inst = c.conditions.find((x) => x.name === 'empetre')!;
      expect(inst.escapeStrength! % 5).toBe(0);
      expect(inst.escapeStrength).toBeGreaterThanOrEqual(5);
      expect(inst.escapeStrength).toBeLessThanOrEqual(50);
    }
  });
});

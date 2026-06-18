import { describe, it, expect } from 'vitest';
import { skillDRBonus, incomingAttackMod, attackHasKeyword, incomingDamageNullified } from './ops';
import { bonus, effectiveChar } from './characteristics';
import type { Combatant } from './types';

/** Combattant minimal (Ag 45 → Bonus d'Agilité 4). */
const mk = (over: Partial<Combatant> = {}): Combatant => ({
  id: 'h', name: 'T', kind: 'hero',
  characteristics: { CC: 40, CT: 40, F: 40, E: 40, I: 40, Ag: 45, Dex: 40, Int: 40, FM: 40, Soc: 40 },
  wounds: { current: 12, max: 12 }, advantage: 0, conditions: [],
  weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
  skills: [], talents: [], movement: 4, items: [], traits: [],
  ...over,
} as Combatant);

describe('skillDRBonus — Furtif (LDB 85) : +Bonus d’Agilité au DR de Discrétion', () => {
  it('un combattant Furtif a +BAg au DR de Discrétion', () => {
    const c = mk({ traits: [{ id: 'furtif' }] });
    expect(skillDRBonus(c, 'discretion')).toBe(bonus(effectiveChar(c, 'Ag'))); // Ag 45 → 4
  });
  it('sans Furtif : aucun bonus', () => {
    expect(skillDRBonus(mk(), 'discretion')).toBe(0);
  });
  it("n’affecte pas une autre compétence", () => {
    expect(skillDRBonus(mk({ traits: [{ id: 'furtif' }] }), 'perception')).toBe(0);
  });
});

describe('incomingAttackMod — Parasité (LDB 85) : −10 au toucher en mêlée de l’attaquant', () => {
  it('un combattant Parasité impose −10 en mêlée', () => {
    expect(incomingAttackMod(mk({ traits: [{ id: 'parasite' }] }), 'melee')).toBe(-10);
  });
  it('aucun effet à distance ni sans le trait', () => {
    expect(incomingAttackMod(mk({ traits: [{ id: 'parasite' }] }), 'ranged')).toBe(0);
    expect(incomingAttackMod(mk(), 'melee')).toBe(0);
  });
});

describe('attackKeyword / mitigateIncoming — Magique & Éthéré (LDB 85)', () => {
  it('attackHasKeyword(magic) : Magique / Démoniaque / Fabriqué', () => {
    expect(attackHasKeyword(mk({ traits: [{ id: 'magique' }] }), 'magic')).toBe(true);
    expect(attackHasKeyword(mk({ traits: [{ id: 'demoniaque', value: 8 }] }), 'magic')).toBe(true);
    expect(attackHasKeyword(mk({ traits: [{ id: 'fabrique' }] }), 'magic')).toBe(true);
    expect(attackHasKeyword(mk(), 'magic')).toBe(false);
  });
  it('Éthéré : nullifie les Dégâts non magiques, laisse passer les attaques magiques', () => {
    const ethere = mk({ traits: [{ id: 'ethere' }] });
    expect(incomingDamageNullified(ethere, mk(), false)).toBe(true);
    expect(incomingDamageNullified(ethere, mk({ traits: [{ id: 'magique' }] }), false)).toBe(false);
    expect(incomingDamageNullified(ethere, mk(), true)).toBe(false);
    expect(incomingDamageNullified(mk(), mk(), false)).toBe(false);
  });
});

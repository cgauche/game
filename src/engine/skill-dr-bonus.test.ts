import { describe, it, expect } from 'vitest';
import { skillDRBonus, incomingAttackMod, attackHasKeyword, incomingDamageNullified } from './ops';
import { bonus, effectiveChar } from './characteristics';
import type { Combatant } from './types';

/** Combattant minimal (Ag 45 → Bonus d'Agilité 4). */
const mk = (over: Partial<Combatant> = {}): Combatant => ({
  id: 'h', label: 'T', kind: 'hero',
  characteristics: { 'capacite-de-combat': 40, 'capacite-de-tir': 40, force: 40, endurance: 40, initiative: 40, agilite: 45, dexterite: 40, intelligence: 40, 'force-mentale': 40, sociabilite: 40 },
  wounds: { current: 12, max: 12 }, advantage: 0, conditions: [],
  weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
  skills: [], talents: [], movement: 4, items: [], traits: [],
  ...over,
} as Combatant);

describe('skillDRBonus — Furtif (LDB 85) : +Bonus d’Agilité au DR de Discrétion', () => {
  it('un combattant Furtif a +BAg au DR de Discrétion', () => {
    const c = mk({ traits: [{ id: 'furtif' }] });
    expect(skillDRBonus(c, 'discretion')).toBe(bonus(effectiveChar(c, 'agilite'))); // Ag 45 → 4
  });
  it('sans Furtif : aucun bonus', () => {
    expect(skillDRBonus(mk(), 'discretion')).toBe(0);
  });
  it("n’affecte pas une autre compétence", () => {
    expect(skillDRBonus(mk({ traits: [{ id: 'furtif' }] }), 'perception')).toBe(0);
  });
});

// #1011 — Pisteur (LDB 85 folio 341) : « Ajoutez un DR égal au bonus d'Initiative de la créature, à
// tous les Tests de Pistage. » MÊME canal que Furtif : `passive: skillDRBonus` en donnée, lu par le
// collecteur `skillDRBonus` que la couche de Test générique applique (`rollFlowSpecs`, spec `test`).
describe('skillDRBonus — Pisteur (LDB 85) : +Bonus d’Initiative au DR de Pistage', () => {
  it('un combattant Pisteur a +BI au DR de Pistage (I 40 → 4 ; I 25 → 2)', () => {
    const c = mk({ traits: [{ id: 'pisteur' }] });
    expect(skillDRBonus(c, 'pistage')).toBe(bonus(effectiveChar(c, 'initiative')));
    expect(skillDRBonus(c, 'pistage')).toBe(4);
    const lent = mk({ traits: [{ id: 'pisteur' }], characteristics: { ...mk().characteristics, initiative: 25 } });
    expect(skillDRBonus(lent, 'pistage')).toBe(2); // par-créature, pas une constante
  });
  it('sans Pisteur : aucun bonus', () => {
    expect(skillDRBonus(mk(), 'pistage')).toBe(0);
  });
  it('n’affecte aucune autre compétence (ni celles de Furtif/Amphibie)', () => {
    const c = mk({ traits: [{ id: 'pisteur' }] });
    expect(skillDRBonus(c, 'perception')).toBe(0);
    expect(skillDRBonus(c, 'discretion')).toBe(0);
    expect(skillDRBonus(c, 'natation')).toBe(0);
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

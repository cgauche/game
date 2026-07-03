import { describe, it, expect } from 'vitest';
import { skillDRBonus } from './ops';
import type { Combatant } from './types';

/**
 * Amphibie (LDB p.338, VERBATIM du desc) : « Elle peut ajouter son bonus d'Agilité au DR de tous les Tests
 * de Natation… ». Exprimé en donnée : passive `skillDRBonus{ skill:'natation', bonus:{ bonusOf:'Ag' } }` —
 * lu par `skillDRBonus(c, skill)` que la couche de Test générique applique (rollFlows). Par-créature (BAg).
 */
const mk = (traits: { id: string }[], ag: number): Combatant => ({
  id: 'c', name: 'Bête', kind: 'enemy',
  characteristics: { CC: 30, CT: 0, F: 30, E: 30, I: 30, Ag: ag, Dex: 30, Int: 30, FM: 30, Soc: 30 },
  movement: 6, wounds: { current: 20, max: 20 }, weapons: [], skills: [], talents: [], traits,
} as unknown as Combatant);

describe('Amphibie — +Bonus d’Agilité au DR des Tests de Natation (LDB p.338)', () => {
  it('Ag 40 (BAg 4) → +4 DR à la Natation, et RIEN sur les autres Compétences', () => {
    const c = mk([{ id: 'amphibie' }], 40);
    expect(skillDRBonus(c, 'natation')).toBe(4);
    expect(skillDRBonus(c, 'escalade')).toBe(0);
    expect(skillDRBonus(c, 'athletisme')).toBe(0);
  });

  it('le bonus SUIT l’Agilité de la créature (Ag 25 → BAg 2)', () => {
    expect(skillDRBonus(mk([{ id: 'amphibie' }], 25), 'natation')).toBe(2);
  });

  it('sans le trait Amphibie → aucun bonus de Natation', () => {
    expect(skillDRBonus(mk([], 40), 'natation')).toBe(0);
  });
});

/**
 * #51 — Canal « objet équipé → bonus de Compétence ». Bésicles (LDB 67) : +20 aux Tests de Lire/Écrire
 * (Test de lecture = Compétence Langue) et de Perception tant qu'elles sont portées. Le bonus est porté
 * par la DONNÉE (`skillBonus` du trapping) et sommé dans `testValue` pour la Compétence ciblée.
 */
import { describe, it, expect } from 'vitest';
import { testValue } from './skills';
import type { Combatant, ItemInstance } from './types';

const CHARS = { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 };
const besicles: ItemInstance = { uid: 'b1', trappingId: 'besicles', name: 'Bésicles', kind: 'misc', qualities: [], enc: 0, equipped: true } as unknown as ItemInstance;
const mk = (items: ItemInstance[] = []): Combatant => ({ characteristics: CHARS, skills: [], items } as unknown as Combatant);

describe('#51 — Bésicles : canal objet→bonus de compétence', () => {
  it('avec bésicles : +20 à Perception via testValue', () => {
    expect(testValue(mk([besicles]), 'perception') - testValue(mk(), 'perception')).toBe(20);
  });
  it('avec bésicles : +20 au Test de lecture (Langue) via testValue', () => {
    expect(testValue(mk([besicles]), 'langue') - testValue(mk(), 'langue')).toBe(20);
  });
  it('sans bésicles : aucun bonus (Perception = caractéristique nue)', () => {
    expect(testValue(mk(), 'perception')).toBe(30);
  });
  it('bésicles n’affecte PAS une Compétence non concernée', () => {
    expect(testValue(mk([besicles]), 'escalade')).toBe(testValue(mk(), 'escalade'));
  });
});

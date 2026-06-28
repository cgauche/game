/**
 * #51 — Canal unifié « objet → modificateur PASSIF de Compétence », gaté sur le PORT. Bésicles (LDB 67) :
 * +20 aux Tests de Lire/Écrire (Test de lecture = Compétence Langue) et de Perception TANT QU'ELLES SONT
 * PORTÉES. Le bonus n'est plus un champ ad hoc : il vit en `passive: GameOp[]` sur le catalogue (op
 * `skillMod`, lu par `trappingId`), collecté par `passiveMods` UNIQUEMENT si l'objet est porté (`equipped`)
 * ou tenu (arme du loadout), et sommé par `passiveSkillSum` dans `testValue`. RAW « tant que porté » : un
 * objet NON porté ne confère AUCUN bonus.
 */
import { describe, it, expect } from 'vitest';
import { testValue } from './skills';
import type { Combatant, ItemInstance } from './types';

const CHARS = { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 };
const besicles = (equipped: boolean): ItemInstance =>
  ({ uid: 'b1', trappingId: 'besicles', name: 'Bésicles', kind: 'misc', qualities: [], enc: 0, equipped } as unknown as ItemInstance);
const mk = (items: ItemInstance[] = []): Combatant => ({ characteristics: CHARS, skills: [], items } as unknown as Combatant);

describe('#51 — Bésicles : canal passive/skillMod gaté sur le port', () => {
  it('PORTÉE (equipped) : +20 à Perception via testValue', () => {
    expect(testValue(mk([besicles(true)]), 'perception') - testValue(mk(), 'perception')).toBe(20);
  });
  it('PORTÉE (equipped) : +20 au Test de lecture (Langue) via testValue', () => {
    expect(testValue(mk([besicles(true)]), 'langue') - testValue(mk(), 'langue')).toBe(20);
  });
  it('NON portée (equipped:false, ni tenue) : AUCUN bonus (gating RAW « tant que porté »)', () => {
    expect(testValue(mk([besicles(false)]), 'perception')).toBe(30);
    expect(testValue(mk([besicles(false)]), 'langue')).toBe(30);
  });
  it('sans bésicles : Perception = caractéristique nue', () => {
    expect(testValue(mk(), 'perception')).toBe(30);
  });
  it('bésicles PORTÉE n’affecte PAS une Compétence non concernée', () => {
    expect(testValue(mk([besicles(true)]), 'escalade')).toBe(testValue(mk(), 'escalade'));
  });
});

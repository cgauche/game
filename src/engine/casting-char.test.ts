import { describe, it, expect, afterEach } from 'vitest';
import { castingValue } from './magic';
import { effectiveSkillCharKey, testValue } from './skills';
import { setRule, resetRule } from './policy';
import type { Combatant, CharKey } from './types';

/** Combatant minimal : Int 30 ≠ E 40 → la valeur de Test révèle quelle Caractéristique a servi. */
function mk(opts: Partial<Combatant> = {}): Combatant {
  return {
    id: 'c', name: 'c', kind: 'enemy', advantage: 0, conditions: [],
    characteristics: { Int: 30, E: 40, Soc: 20, FM: 25 } as never,
    psychState: [], psychTraits: [], groups: [], weapons: [], armour: {} as never,
    skills: [], talents: [], movement: 4, wounds: { current: 10, max: 10 }, ...opts,
  } as Combatant;
}

const langue = (characteristic: CharKey = 'Int') => ({ skillId: 'langue', spec: 'Magick', characteristic, advances: 0 });

afterEach(() => resetRule('magic-ogre-langue-e'));

describe('castingValue — caractéristique de la compétence d’incantation (POINT UNIQUE)', () => {
  it('non-ogre : Langue (Magick) sur Intelligence (défaut LDB)', () => {
    expect(castingValue(mk({ skills: [langue()] }), 'langue', 'Magick')).toBe(30);
  });

  it('ogre : Langue (Magick) sur Endurance (ADE II l.653, règle ON par défaut)', () => {
    expect(castingValue(mk({ species: 'Ogre', skills: [langue()] }), 'langue', 'Magick')).toBe(40);
  });

  it('ogre + règle désactivée : retour à l’Intelligence', () => {
    setRule('magic-ogre-langue-e', false);
    expect(castingValue(mk({ species: 'Ogre', skills: [langue()] }), 'langue', 'Magick')).toBe(30);
  });

  it('« Rat ogre » (Skaven) : NON concerné — ancrage ^ogre (Intelligence)', () => {
    expect(castingValue(mk({ species: 'Rat ogre', skills: [langue()] }), 'langue', 'Magick')).toBe(30);
  });

  it('données sur l’entité : une instance portant une carac alternative est respectée (data-driven)', () => {
    // non-ogre dont l’instance Langue porte explicitement E → E, sans aucune règle.
    expect(effectiveSkillCharKey(mk({ skills: [langue('E')] }), 'langue', { spec: 'Magick' })).toBe('E');
  });

  it('testValue et castingValue partagent le même point (ogre Langue → E des deux côtés)', () => {
    const ogre = mk({ species: 'Ogre', skills: [langue()] });
    expect(testValue(ogre, 'langue', undefined, 'Magick')).toBe(castingValue(ogre, 'langue', 'Magick'));
  });
});

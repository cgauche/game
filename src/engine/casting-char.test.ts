import { describe, it, expect } from 'vitest';
import { castingValue } from './magic';
import { effectiveSkillCharKey, testValue } from './skills';
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

const langue = (characteristic: CharKey) => ({ skillId: 'langue', spec: 'Magick', characteristic, advances: 0 });

describe('caractéristique d’incantation — DATA-DRIVEN (point unique, zéro valeur en dur)', () => {
  it('défaut : Langue (Magick) sur la carac de la compétence (Intelligence)', () => {
    expect(castingValue(mk({ skills: [langue('Int')] }), 'langue', 'Magick')).toBe(30);
  });

  it('carac alternative PORTÉE PAR LA DONNÉE : l’instance sur Endurance → Endurance (ex. lanceur ogre, ADE II l.653)', () => {
    // Aucun sniff d'espèce, aucune règle en dur : le moteur lit SkillInstance.characteristic.
    expect(castingValue(mk({ skills: [langue('E')] }), 'langue', 'Magick')).toBe(40);
  });

  it('sans instance possédée : repli sur la carac de la compétence (défaut LDB)', () => {
    expect(effectiveSkillCharKey(mk(), 'langue', { spec: 'Magick', fallback: 'Int' })).toBe('Int');
  });

  it('testValue et castingValue partagent LE MÊME point (carac d’instance respectée des deux côtés)', () => {
    const c = mk({ skills: [langue('E')] });
    expect(testValue(c, 'langue', undefined, 'Magick')).toBe(castingValue(c, 'langue', 'Magick'));
    expect(testValue(c, 'langue', undefined, 'Magick')).toBe(40);
  });
});

import { describe, it, expect } from 'vitest';
import { testValue, partyBest, skillCharKeyById } from './skills';
import { Combatant, SkillInstance } from './types';

const mk = (chars: Partial<Record<string, number>>, skills: { skillId: string; advances: number }[] = []): Combatant =>
  ({
    characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30, ...chars },
    skills: skills.map((s) => ({ ...s, characteristic: 'Dex' }) as SkillInstance),
  }) as unknown as Combatant;

describe('skills — testValue / partyBest / skillCharKeyById', () => {
  it('caractéristique fournie → valeur de la caractéristique', () => {
    expect(testValue(mk({ Soc: 55 }), undefined, 'Soc')).toBe(55);
  });
  it('compétence (inconnue de la base) → repli sur Dextérité + avances de la compétence portée', () => {
    const c = mk({ Dex: 40 }, [{ skillId: 'bidouille', advances: 7 }]);
    expect(testValue(c, 'bidouille')).toBe(47);
  });
  it('compétence sans avances → caractéristique de repli seule', () => {
    expect(testValue(mk({ Dex: 33 }), 'inexistante')).toBe(33);
  });
  it('partyBest renvoie le meilleur membre du groupe', () => {
    const a = mk({ Soc: 40 });
    const b = mk({ Soc: 60 });
    const c = mk({ Soc: 50 });
    expect(partyBest([a, b, c], undefined, 'Soc')).toEqual({ actor: b, value: 60 });
  });
  it('partyBest sur groupe vide → null', () => {
    expect(partyBest([], undefined, 'Soc')).toBeNull();
  });
  it('skillCharKeyById : compétence inconnue → undefined', () => {
    expect(skillCharKeyById('competence-totalement-imaginaire')).toBeUndefined();
  });
});

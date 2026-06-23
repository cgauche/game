import { describe, it, expect } from 'vitest';
import { testValue, partyBest, skillCharKeyById, resolveSkillBest } from './skills';
import { makeRNG } from './dice';
import { Combatant, SkillInstance } from './types';

const mk = (chars: Partial<Record<string, number>>, skills: { skillId: string; advances: number; spec?: string }[] = []): Combatant =>
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
  it('partyBest transmet la spécialisation à testValue (bonne instance de Métier)', () => {
    const h = mk({}, [
      { skillId: 'metier', advances: 10, spec: 'Forgeron' },
      { skillId: 'metier', advances: 40, spec: 'Serrurier' },
    ]);
    const forgeron = partyBest([h], 'metier', undefined, undefined, 'Forgeron')!;
    const serrurier = partyBest([h], 'metier', undefined, undefined, 'Serrurier')!;
    expect(serrurier.value - forgeron.value).toBe(30); // 40 − 10 d'avances, même caractéristique de base
  });
  it('skillCharKeyById : compétence inconnue → undefined', () => {
    expect(skillCharKeyById('competence-totalement-imaginaire')).toBeUndefined();
  });
});

describe('resolveSkillBest — Test du meilleur parmi N compétences (primitive NEUTRE poste/voyage/naval)', () => {
  it('prend la compétence où l’acteur est le meilleur (spec-aware) + cible = sa valeur', () => {
    const hero = mk({ Dex: 30 }, [
      { skillId: 'metier', spec: 'Cartographe', advances: 60 },
      { skillId: 'art', spec: 'Dessin', advances: 10 },
    ]);
    const r = resolveSkillBest(hero, [
      { skillId: 'metier', spec: 'Cartographe' },
      { skillId: 'art', spec: 'Dessin' },
    ], 'intermediaire', makeRNG(5));
    expect(r.used).toEqual({ skillId: 'metier', spec: 'Cartographe' }); // 30+60 > 30+10
    expect(r.value).toBe(testValue(hero, 'metier', undefined, 'Cartographe'));
    expect(r.target).toBe(r.value); // Difficulté Intermédiaire (+0), pas de mod
    expect(r.success).toBe(r.roll <= r.target);
  });

  it('le modificateur décale la cible ; option unique = cette compétence', () => {
    const hero = mk({ I: 40 }, [{ skillId: 'perception', advances: 20 }]);
    const a = resolveSkillBest(hero, [{ skillId: 'perception' }], 'intermediaire', makeRNG(7), 0);
    const b = resolveSkillBest(hero, [{ skillId: 'perception' }], 'intermediaire', makeRNG(7), -30);
    expect(a.target - b.target).toBe(30);
    expect(a.used).toEqual({ skillId: 'perception' });
  });
});

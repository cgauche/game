import { describe, it, expect } from 'vitest';
import type { Combatant } from './types';
import { skillAdvantageCap, combatAdvantageSkills, combatSubstitute, fearsBy } from './skillCombatApps';

function mk(over: Partial<Combatant> = {}): Combatant {
  return {
    id: 'a', name: 'A', kind: 'hero',
    characteristics: { CC: 30, CT: 30, F: 40, E: 30, I: 30, Ag: 30, Dex: 30, Int: 45, FM: 30, Soc: 38 },
    conditions: [], activeEffects: [], skills: [], talents: [], traits: [], psychState: [],
    weapons: [], armour: [], wounds: { current: 10, max: 10 }, advantage: 0,
    ...over,
  } as unknown as Combatant;
}

describe('Applications de combat — cumuler l’Avantage (LDB 09 l.305-308)', () => {
  it('Intuition (base) : plafond = Bonus d’Intelligence (Int 45 → 4)', () => {
    const c = mk();
    expect(skillAdvantageCap(c, 'intuition')).toBe(4); // Base : possédée sans Augmentation
  });
  it('Prière (avancée) : plafond = Bonus de Sociabilité, mais SEULEMENT si possédée', () => {
    const sansPriere = mk();
    expect(skillAdvantageCap(sansPriere, 'priere')).toBe(0); // avancée non prise → 0
    const avecPriere = mk({ skills: [{ skillId: 'priere', advances: 5 } as never] });
    expect(skillAdvantageCap(avecPriere, 'priere')).toBe(3); // Bonus Soc 38 → 3
  });
  it('une Compétence sans application « Avantage » → 0', () => {
    expect(skillAdvantageCap(mk(), 'corps-a-corps')).toBe(0);
  });
  it('combatAdvantageSkills liste les Compétences possédées éligibles', () => {
    const c = mk({ skills: [{ skillId: 'intuition', advances: 0 } as never, { skillId: 'savoir', advances: 2 } as never] });
    const ids = combatAdvantageSkills(c).map((s) => s.skillId).sort();
    expect(ids).toEqual(['intuition', 'savoir']);
  });
});

describe('Applications de combat — substitution sociale (LDB 09 l.207/287)', () => {
  const defender = () => mk({ id: 'def', skills: [{ skillId: 'intimidation', advances: 4 } as never] });
  const attacker = (fearsDef: boolean) => mk({
    id: 'atk',
    psychState: fearsDef ? [{ type: 'peur', sourceId: 'def', indice: 2, calmeDR: 0 } as never] : [],
  });

  it('gate `fear` : l’adversaire doit avoir Peur SOURCÉE par le personnage', () => {
    expect(fearsBy(attacker(true), defender())).toBe(true);
    expect(fearsBy(attacker(false), defender())).toBe(false);
  });
  it('Intimidation substitue Corps à corps en DÉFENSE quand l’attaquant a peur du défenseur', () => {
    const sub = combatSubstitute(defender(), attacker(true), 'defense');
    expect(sub?.skillId).toBe('intimidation');
    expect(sub?.value).toBe(44); // F 40 + 4 Augmentations
  });
  it('pas de peur → pas de substitution', () => {
    expect(combatSubstitute(defender(), attacker(false), 'defense')).toBeNull();
  });
  it('substitution aussi en ATTAQUE (role both) contre une cible effrayée', () => {
    const sub = combatSubstitute(defender(), attacker(true), 'attack');
    expect(sub?.skillId).toBe('intimidation');
  });
  it('sans la Compétence sociale → pas de substitution', () => {
    const plainDef = mk({ id: 'def' });
    expect(combatSubstitute(plainDef, attacker(true), 'defense')).toBeNull();
  });
});

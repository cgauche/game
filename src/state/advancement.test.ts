import { describe, it, expect } from 'vitest';
import { Combatant } from '../engine/types';
import { buildAdvancementView } from './advancement';

/** Héros minimal de carrière « Agitateur » (careerLevels.json : Niveau 1 = « Pamphlétaire »,
 *  Caractéristiques de carrière = CT/Int/Soc ; Compétences incluent Charme, Ragot ;
 *  Talents incluent Sociable). */
const hero = (over: Partial<Combatant> = {}): Combatant =>
  ({
    id: 'h',
    name: 'H',
    kind: 'hero',
    species: 'Humains (Reiklander)',
    career: 'Agitateur',
    careerLevel: 1,
    characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
    wounds: { current: 12, max: 12 },
    advantage: 0,
    conditions: [],
    weapons: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [
      { name: 'Charme', characteristic: 'Soc', advances: 0 }, // in-carrière
      { name: 'Esquive', characteristic: 'Ag', advances: 0 }, // hors-carrière
    ],
    talents: [],
    movement: 4,
    xp: 1000,
    charAdvances: {},
    ...over,
  }) as unknown as Combatant;

describe('buildAdvancementView — coûts & in-carrière depuis careerLevels.json', () => {
  it('méta : PX, carrière, niveau, libellé du niveau', () => {
    const v = buildAdvancementView(hero());
    expect(v.xp).toBe(1000);
    expect(v.career).toBe('Agitateur');
    expect(v.careerLevel).toBe(1);
    expect(v.levelLabel).toBe('Pamphlétaire');
  });

  it('Caractéristiques : CT in-carrière (coût 25), CC hors-carrière (coût ×2 = 50)', () => {
    const v = buildAdvancementView(hero());
    const ct = v.chars.find((c) => c.key === 'CT')!;
    const cc = v.chars.find((c) => c.key === 'CC')!;
    expect(ct.inCareer).toBe(true);
    expect(ct.nextCost).toBe(25);
    expect(ct.value).toBe(30);
    expect(cc.inCareer).toBe(false);
    expect(cc.nextCost).toBe(50);
  });

  it('Compétences connues : Charme in-carrière (10), Esquive hors-carrière (×2 = 20)', () => {
    const v = buildAdvancementView(hero());
    const charme = v.skills.find((s) => s.name === 'Charme')!;
    const esquive = v.skills.find((s) => s.name === 'Esquive')!;
    expect(charme.known).toBe(true);
    expect(charme.inCareer).toBe(true);
    expect(charme.nextCost).toBe(10);
    expect(esquive.inCareer).toBe(false);
    expect(esquive.nextCost).toBe(20);
  });

  it('Compétences in-carrière non connues : acquérables à advances 0 (coût 10)', () => {
    const v = buildAdvancementView(hero());
    const ragot = v.skills.find((s) => s.name === 'Ragot')!;
    expect(ragot).toBeTruthy();
    expect(ragot.known).toBe(false);
    expect(ragot.inCareer).toBe(true);
    expect(ragot.advances).toBe(0);
    expect(ragot.nextCost).toBe(10);
  });

  it('Talents in-carrière non possédés : acquérables (coût 100)', () => {
    const v = buildAdvancementView(hero());
    const sociable = v.talents.find((t) => t.name === 'Sociable')!;
    expect(sociable).toBeTruthy();
    expect(sociable.times).toBe(0);
    expect(sociable.inCareer).toBe(true);
    expect(sociable.nextCost).toBe(100);
  });

  it('complétion : héros frais NON complété → coût de changement 200', () => {
    const v = buildAdvancementView(hero());
    expect(v.completed).toBe(false);
    expect(v.changeCost).toBe(200);
  });

  it('cible de progression : le Niveau suivant de la carrière (« Agitateur », niv. 2)', () => {
    const v = buildAdvancementView(hero());
    const next = v.targets.find((t) => t.level === 2);
    expect(next).toBeTruthy();
    expect(next!.career).toBe('Agitateur');
    expect(next!.label).toBe('Agitateur'); // libellé du Niveau 2
  });
});

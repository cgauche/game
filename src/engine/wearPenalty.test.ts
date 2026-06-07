import { describe, it, expect } from 'vitest';
import { parseWearPenalty, wornArmourPenalty, wornSocialMod } from './wearPenalty';
import { testValue, partyBest } from './skills';
import { qualitySocMod } from './qualities/dispatch';
import type { Combatant } from './types';

describe('parseWearPenalty', () => {
  it('parse « -10% en Discrétion » → { skill: Discrétion, value: -10 }', () => {
    expect(parseWearPenalty('-10% en Discrétion')).toEqual({ skill: 'Discrétion', value: -10 });
  });
  it('parse « -20% en Perception »', () => {
    expect(parseWearPenalty('-20% en Perception')).toEqual({ skill: 'Perception', value: -20 });
  });
  it('renvoie null pour une qualité non-pénalité', () => {
    expect(parseWearPenalty('Flexible')).toBeNull();
    expect(parseWearPenalty('Impénétrable')).toBeNull();
  });
});

function mkWearer(qualities: string[]): Combatant {
  return {
    id: 'h', name: 'A', kind: 'hero',
    characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 40, Ag: 40, Dex: 30, Int: 30, FM: 30, Soc: 30 },
    wounds: { current: 10, max: 10 }, advantage: 0, conditions: [], movement: 4, skills: [], talents: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    items: [{ uid: 'a1', name: 'Heaume', kind: 'armor', qualities, pa: 2, locs: ['tete'], enc: 2, equipped: true }],
  } as unknown as Combatant;
}

describe('wornArmourPenalty', () => {
  it('somme la pénalité de la compétence portée (Perception -20 sur un Heaume)', () => {
    expect(wornArmourPenalty(mkWearer(['-10% en Discrétion', '-20% en Perception']), 'Perception')).toBe(-20);
    expect(wornArmourPenalty(mkWearer(['-10% en Discrétion', '-20% en Perception']), 'Discrétion')).toBe(-10);
  });
  it('ignore une pièce NON équipée', () => {
    const c = mkWearer(['-20% en Perception']);
    c.items![0].equipped = false;
    expect(wornArmourPenalty(c, 'Perception')).toBe(0);
  });
  it('Pratique réduit la pénalité d’un niveau (+10, plancher 0)', () => {
    expect(wornArmourPenalty(mkWearer(['-20% en Perception', 'Pratique']), 'Perception')).toBe(-10);
    expect(wornArmourPenalty(mkWearer(['-10% en Discrétion', 'Pratique']), 'Discrétion')).toBe(0);
  });
  it('Peu Fiable double la pénalité', () => {
    expect(wornArmourPenalty(mkWearer(['-10% en Discrétion', 'Peu Fiable']), 'Discrétion')).toBe(-20);
  });
  it('match insensible à la spécialisation et à la casse', () => {
    expect(wornArmourPenalty(mkWearer(['-10% en Discrétion']), 'discrétion (Urbaine)')).toBe(-10);
  });
});

describe('testValue + port d’armure', () => {
  function hero(id: string, ag: number, items: unknown[]): Combatant {
    return {
      id, name: id, kind: 'hero',
      characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: ag, Dex: 30, Int: 30, FM: 30, Soc: 30 },
      wounds: { current: 10, max: 10 }, advantage: 0, conditions: [], movement: 4,
      skills: [{ name: 'Discrétion', characteristic: 'Ag', advances: 0 }], talents: [],
      armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, items,
    } as unknown as Combatant;
  }
  it('testValue soustrait la pénalité de Discrétion d’une cotte équipée', () => {
    const c = hero('h1', 40, [{ uid: 'a', name: 'Cotte de mailles', kind: 'armor', qualities: ['-10% en Discrétion'], enc: 3, equipped: true }]);
    expect(testValue(c, 'Discrétion')).toBe(30); // Ag 40 − 10
  });
  it('partyBest préfère le héros NON armuré pour un Test de Discrétion', () => {
    const armure = hero('arm', 45, [{ uid: 'a', name: 'Cotte de mailles', kind: 'armor', qualities: ['-10% en Discrétion'], enc: 3, equipped: true }]); // 35
    const leste = hero('leste', 40, []); // 40
    expect(partyBest([armure, leste], 'Discrétion')!.actor.id).toBe('leste');
  });
});

describe('qualitySocMod (Laid)', () => {
  it('somme socMod (Laid = -10 ; qualité sans socMod = 0)', () => {
    expect(qualitySocMod({ qualities: ['Laid'] })).toBe(-10);
    expect(qualitySocMod({ qualities: ['Précise'] })).toBe(0);
  });
});

describe('wornSocialMod', () => {
  it('somme les Laid ÉQUIPÉS (-10), ignore les non équipés', () => {
    const c = { items: [
      { uid: 'a', name: 'Heaume hideux', kind: 'armor', qualities: ['Laid'], enc: 2, equipped: true },
      { uid: 'b', name: 'Babiole', kind: 'misc', qualities: ['Laid'], enc: 0, equipped: false },
    ] } as unknown as Combatant;
    expect(wornSocialMod(c)).toBe(-10);
  });
});

describe('testValue + Laid (Sociabilité)', () => {
  it('un objet Laid équipé impose -10 aux Tests Soc (caractéristique brute)', () => {
    const c = { characteristics: { Soc: 40 }, skills: [], items: [{ uid: 'a', name: 'X', kind: 'armor', qualities: ['Laid'], enc: 1, equipped: true }] } as unknown as Combatant;
    expect(testValue(c, undefined, 'Soc')).toBe(30);
  });
  it('-10 sur une compétence Soc-based (Charme), rien sur une compétence non-Soc (Discrétion)', () => {
    const c = {
      characteristics: { Soc: 40, Ag: 40 },
      skills: [{ name: 'Charme', characteristic: 'Soc', advances: 0 }, { name: 'Discrétion', characteristic: 'Ag', advances: 0 }],
      items: [{ uid: 'a', name: 'X', kind: 'armor', qualities: ['Laid'], enc: 1, equipped: true }],
    } as unknown as Combatant;
    expect(testValue(c, 'Charme')).toBe(30); // Soc 40 − 10
    expect(testValue(c, 'Discrétion')).toBe(40); // non-Soc, pas de pénalité d'armure → inchangé
  });
});

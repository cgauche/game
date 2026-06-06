import { describe, it, expect } from 'vitest';
import { makeRNG } from './dice';
import { isFumble, rollOups } from './oups';
import { OUPS_TABLE } from '../data/oups';
import type { Weapon } from './types';

const sword: Weapon = { name: 'Épée', type: 'melee', damage: '+BF+4', qualities: [] };
const pistol: Weapon = { name: 'Pistolet', type: 'ranged', damage: '+9', qualities: ['Pistolet'], subType: 'Poudre noire', range: 20 };

describe('isFumble (LDB 14 l.53)', () => {
  it('échec + double = Maladresse', () => {
    expect(isFumble(33, false)).toBe(true);
    expect(isFumble(100, false)).toBe(true); // 00
    expect(isFumble(33, true)).toBe(false);  // double réussi = Critique, pas Maladresse
    expect(isFumble(34, false)).toBe(false); // pas un double
    expect(isFumble(11, false)).toBe(true);
  });
});

describe('rollOups (Tableau des Oups !)', () => {
  it('le kind correspond toujours à la bande du jet (arme de mêlée, pas de misfire)', () => {
    for (let s = 1; s <= 300; s++) {
      const r = rollOups(sword, makeRNG(s));
      expect(r.roll).toBeGreaterThanOrEqual(1);
      expect(r.roll).toBeLessThanOrEqual(100);
      expect(r.kind).not.toBe('misfire');
      const band = OUPS_TABLE.find((e) => r.roll >= e.min && r.roll <= e.max)!;
      expect(r.kind).toBe(band.kind);
    }
  });
  it('couvre plusieurs bandes du tableau', () => {
    const kinds = new Set<string>();
    for (let s = 1; s <= 300; s++) kinds.add(rollOups(sword, makeRNG(s)).kind);
    expect(kinds.size).toBeGreaterThanOrEqual(4);
  });
  it("Incident de Tir : arme à poudre + jet PAIR → misfire", () => {
    let sawMisfire = false;
    for (let s = 1; s <= 200; s++) {
      const r = rollOups(pistol, makeRNG(s));
      if (r.roll % 2 === 0) { expect(r.kind).toBe('misfire'); sawMisfire = true; }
      else expect(r.kind).not.toBe('misfire');
    }
    expect(sawMisfire).toBe(true);
  });
  it("arme non à poudre : jamais de misfire", () => {
    for (let s = 1; s <= 200; s++) expect(rollOups(sword, makeRNG(s)).kind).not.toBe('misfire');
  });
});

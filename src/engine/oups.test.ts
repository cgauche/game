import { describe, it, expect } from 'vitest';
import { makeRNG } from './dice';
import { isFumble, rollOups } from './oups';
import { OUPS_TABLE, OUPS_MISFIRE } from '../data/oups';
import type { Weapon } from './types';

const sword: Weapon = { name: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] };
const pistol: Weapon = { name: 'Pistolet', type: 'ranged', damage: { plusBF: false, flat: 9 }, qualities: [{ id: 'pistolet' }], subType: 'Poudre noire', range: 20 };

describe('isFumble (LDB 14 l.53)', () => {
  it('échec + double = Maladresse', () => {
    expect(isFumble(33, false)).toBe(true);
    expect(isFumble(100, false)).toBe(true); // 00
    expect(isFumble(33, true)).toBe(false);  // double réussi = Critique, pas Maladresse
    expect(isFumble(34, false)).toBe(false); // pas un double
    expect(isFumble(11, false)).toBe(true);
  });
});

describe('isFumble — escalade Doigts amputés (LDB 18 l.251, #144)', () => {
  it('N doigts perdus + échec + chiffre des unités ∈ [1..N] (non-double) → Maladresse', () => {
    expect(isFumble(42, false, 2)).toBe(true); // unité 2 ≤ N=2
    expect(isFumble(21, false, 2)).toBe(true); // unité 1 ≤ N=2
  });
  it('chiffre des unités > N → PAS de Maladresse par escalade', () => {
    expect(isFumble(43, false, 2)).toBe(false); // unité 3 > N=2
  });
  it('0 doigt perdu (fingersLost omis/0) → comportement inchangé (pas de Maladresse hors double)', () => {
    expect(isFumble(41, false)).toBe(false);
    expect(isFumble(41, false, 0)).toBe(false);
  });
  it('réussite → jamais de Maladresse même dans la fenêtre de doigts perdus', () => {
    expect(isFumble(42, true, 2)).toBe(false);
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
      if (r.roll % 2 === 0) { expect(r.kind).toBe('misfire'); expect(r.label).toBe(OUPS_MISFIRE.label); sawMisfire = true; }
      else expect(r.kind).not.toBe('misfire');
    }
    expect(sawMisfire).toBe(true);
  });
  it("parité #365 : le label Incident de Tir vit dans oups.json, byte-identique à l'ancien code en dur", () => {
    expect(OUPS_MISFIRE.label).toBe('Incident de Tir ! L’arme explose dans votre main (Dégâts au Bras principal, arme détruite).');
    expect(OUPS_TABLE).toHaveLength(7); // la table d100 = 7 bandes, le misfire en est exclu (filtré hors table)
  });
  it("arme non à poudre : jamais de misfire", () => {
    for (let s = 1; s <= 200; s++) expect(rollOups(sword, makeRNG(s)).kind).not.toBe('misfire');
  });
});

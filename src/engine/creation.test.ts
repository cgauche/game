import { describe, it, expect } from 'vitest';
import { makeRNG } from './dice';
import { CHAR_KEYS, CharKey } from './types';
import {
  RANDOM_SPECIES_TABLE,
  rollSpecies,
  rollCareer,
  validatePointBuy,
  POINT_BUY_TOTAL,
  parseStatus,
  rollInitialWealth,
  rollAge,
  rollHeight,
  rollEyes,
  rollHair,
  XP_SPECIES_ACCEPTED,
  XP_CAREER_FIRST,
  XP_CAREER_TOP3,
  XP_CHARS_KEPT,
  XP_CHARS_REASSIGNED,
} from './creation';
import { careers, findSpecies } from '../data';

describe('bonus de PX des choix aléatoires (LDB 04 l.87 / 05 l.191-385)', () => {
  it('valeurs verbatim', () => {
    expect(XP_SPECIES_ACCEPTED).toBe(20);
    expect(XP_CAREER_FIRST).toBe(50);
    expect(XP_CAREER_TOP3).toBe(25);
    expect(XP_CHARS_KEPT).toBe(50);
    expect(XP_CHARS_REASSIGNED).toBe(25);
  });
});

describe('Tableau des Races aléatoires (LDB 04 l.90)', () => {
  it('bornes : 01-90 Humain, 91-94 Halfling, 95-98 Nain, 99 Haut elfe, 00 Elfe sylvain', () => {
    expect(RANDOM_SPECIES_TABLE.map((e) => e.max)).toEqual([90, 94, 98, 99, 100]);
    // Les 5 labels existent dans species.json.
    for (const e of RANDOM_SPECIES_TABLE) expect(findSpecies(e.label), e.label).toBeTruthy();
  });
  it('rollSpecies : déterministe (RNG seedé) et cohérent avec son jet', () => {
    const a = rollSpecies(makeRNG(7));
    expect(a).toEqual(rollSpecies(makeRNG(7)));
    const entry = RANDOM_SPECIES_TABLE.find((e) => a.roll <= e.max)!;
    expect(a.label).toBe(entry.label);
  });
});

describe('Tableau des Classes et Carrières aléatoires (LDB 05 l.197+)', () => {
  it('rollCareer : retourne une carrière ACCESSIBLE à l\'espèce', () => {
    const sylvain = findSpecies('Elfes sylvains')!;
    for (let seed = 1; seed <= 20; seed++) {
      const r = rollCareer(careers, sylvain, makeRNG(seed))!;
      const career = careers.find((c) => c.label === r.label)!;
      expect(career.rand[sylvain.refCareer], r.label).not.toBeNull();
    }
  });
});

describe('répartition de 100 Points (LDB 05 l.385 : min 4, max 18)', () => {
  const alloc = (v: number): Record<CharKey, number> => Object.fromEntries(CHAR_KEYS.map((k) => [k, v])) as Record<CharKey, number>;
  it('valide : 10 × 10 = 100', () => {
    expect(validatePointBuy(alloc(10)).ok).toBe(true);
    expect(POINT_BUY_TOTAL).toBe(100);
  });
  it('refus : total ≠ 100, min < 4, max > 18', () => {
    expect(validatePointBuy({ ...alloc(10), CC: 11 }).ok).toBe(false); // 101
    expect(validatePointBuy({ ...alloc(10), CC: 3, CT: 17 }).ok).toBe(false); // min
    expect(validatePointBuy({ ...alloc(10), CC: 19, CT: 1 }).ok).toBe(false); // max
  });
});

describe('Richesse initiale (LDB 05 l.578-583)', () => {
  it('parseStatus : Bronze/Argent/Or + Standing ; typo de données « Agent 1 » tolérée', () => {
    expect(parseStatus('Bronze 2')).toEqual({ tier: 'Bronze', standing: 2 });
    expect(parseStatus('Argent 5')).toEqual({ tier: 'Argent', standing: 5 });
    expect(parseStatus('Or 7')).toEqual({ tier: 'Or', standing: 7 });
    expect(parseStatus('Agent 1')).toEqual({ tier: 'Argent', standing: 1 });
  });
  it('Bronze N : 2N d10 sous ; Argent N : N d10 pistoles ; Or N : N CO ; Standing 0 : rien', () => {
    const bronze = rollInitialWealth({ tier: 'Bronze', standing: 3 }, makeRNG(1));
    expect(bronze.gold).toBe(0);
    expect(bronze.silver).toBe(0);
    expect(bronze.brass).toBeGreaterThanOrEqual(6); // 6d10
    expect(bronze.brass).toBeLessThanOrEqual(60);
    const silver = rollInitialWealth({ tier: 'Argent', standing: 3 }, makeRNG(1));
    expect(silver.silver).toBeGreaterThanOrEqual(3);
    expect(silver.silver).toBeLessThanOrEqual(30);
    expect(rollInitialWealth({ tier: 'Or', standing: 3 }, makeRNG(1))).toEqual({ gold: 3, silver: 0, brass: 0 });
    expect(rollInitialWealth({ tier: 'Bronze', standing: 0 }, makeRNG(1))).toEqual({ gold: 0, silver: 0, brass: 0 });
  });
});

describe('Détails (LDB 05 l.691-744)', () => {
  it('âge/taille dans les bornes par espèce', () => {
    const human = findSpecies('Humains (Reiklander)')!;
    const dwarf = findSpecies('Nains')!;
    for (let seed = 1; seed <= 10; seed++) {
      const a = rollAge(human, makeRNG(seed));
      expect(a).toBeGreaterThanOrEqual(16); // 15 + 1d10
      expect(a).toBeLessThanOrEqual(25);
      const t = rollHeight(dwarf, makeRNG(seed)); // 130 + 3d10
      expect(t).toBeGreaterThanOrEqual(133);
      expect(t).toBeLessThanOrEqual(160);
    }
  });
  it('yeux/cheveux : libellé non vide tiré des tables, déterministe', () => {
    const elf = findSpecies('Hauts elfes')!;
    expect(rollEyes(elf, makeRNG(3))).toBe(rollEyes(elf, makeRNG(3)));
    expect(rollEyes(elf, makeRNG(3)).length).toBeGreaterThan(0);
    expect(rollHair(elf, makeRNG(3)).length).toBeGreaterThan(0);
  });
});

import { describe, it, expect } from 'vitest';
import { makeRNG } from './dice';
import { rollTest } from './tests';
import { findTavernGameById, resolveTavernRound, rollTavernTest, roundSL, TAVERN_GAMES, TAVERN_TEST_DIFFICULTY } from './tavernGame';

describe('Jeux de taverne — moteur générique (NADJ 16)', () => {
  it('les 11 jeux sont en données, chacun avec une règle verbatim et une source', () => {
    expect(TAVERN_GAMES.length).toBe(11);
    for (const g of TAVERN_GAMES) {
      expect(g.desc.length).toBeGreaterThan(30); // règle recopiée
      expect(g.source.book).toBe('nuits-agitees-et-dures-journees');
      expect(['opposed', 'extended']).toContain(g.mode);
    }
  });

  it('variante rapide (l.11) : le plus de DR l’emporte — une compétence supérieure gagne le plus souvent', () => {
    const dominos = findTavernGameById('dominos')!;
    let pWins = 0;
    for (let seed = 0; seed < 60; seed++) {
      const rng = makeRNG(seed);
      const playerTR = rollTest(70, TAVERN_TEST_DIFFICULTY, rng);
      const opponentTR = rollTavernTest(25, rng);
      const r = resolveTavernRound(dominos, playerTR, opponentTR);
      if (r.winner === 'player') pWins++;
    }
    expect(pWins).toBeGreaterThan(40); // 70 % vs 25 % : le joueur fort domine
  });

  it('déterminisme : même seed → même issue', () => {
    const flechettes = findTavernGameById('flechettes')!;
    const rngA = makeRNG(3);
    const a = resolveTavernRound(flechettes, rollTest(45, TAVERN_TEST_DIFFICULTY, rngA), rollTavernTest(45, rngA));
    const rngB = makeRNG(3);
    const b = resolveTavernRound(flechettes, rollTest(45, TAVERN_TEST_DIFFICULTY, rngB), rollTavernTest(45, rngB));
    expect(a).toEqual(b);
  });

  it('mode ÉTENDU (Bras de fer, l.34) : joué jusqu’à 10 DR cumulés, plusieurs manches — accumulation pure', () => {
    const bras = findTavernGameById('bras-de-fer')!;
    expect(bras.mode).toBe('extended');
    const target = bras.target ?? 10;
    const rng = makeRNG(1);
    let p = 0, o = 0, rounds = 0;
    while (p < target && o < target && rounds < 50) {
      rounds++;
      p += Math.max(0, roundSL(rollTest(55, TAVERN_TEST_DIFFICULTY, rng), bras.drCap));
      o += Math.max(0, roundSL(rollTavernTest(40, rng), bras.drCap));
    }
    expect(rounds).toBeGreaterThanOrEqual(1);
    expect(Math.max(p, o)).toBeGreaterThanOrEqual(target);
  });

  it('plafond de DR par manche (Boules = 6, drCap)', () => {
    const boules = findTavernGameById('boules')!;
    expect(boules.drCap).toBe(6);
    for (let seed = 0; seed < 40; seed++) {
      const rng = makeRNG(seed);
      // valeurs énormes → DR bruts > 6
      const r = resolveTavernRound(boules, rollTest(100, TAVERN_TEST_DIFFICULTY, rng), rollTavernTest(100, rng));
      expect(r.playerSL).toBeLessThanOrEqual(6);
      expect(r.opponentSL).toBeLessThanOrEqual(6);
    }
  });

  it('Al-Zahr n’indique aucune Compétence → repli Pari (skill null, l.11)', () => {
    expect(findTavernGameById('al-zahr')!.skill).toBeNull();
  });
});

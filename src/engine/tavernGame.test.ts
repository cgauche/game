import { describe, it, expect } from 'vitest';
import { makeRNG } from './dice';
import { resolveTavernGame, findTavernGameById, TAVERN_GAMES } from './tavernGame';

describe('Jeux de taverne — moteur générique (NADJ ch.16)', () => {
  it('les 11 jeux sont en données, chacun avec une règle verbatim et une source', () => {
    expect(TAVERN_GAMES.length).toBe(11);
    for (const g of TAVERN_GAMES) {
      expect(g.desc.length).toBeGreaterThan(30); // règle recopiée
      expect(g.source.book).toBe('NADJ');
      expect(['opposed', 'extended']).toContain(g.mode);
    }
  });

  it('variante rapide (l.11) : le plus de DR l’emporte — une compétence supérieure gagne le plus souvent', () => {
    const dominos = findTavernGameById('dominos')!;
    let pWins = 0;
    for (let seed = 0; seed < 60; seed++) {
      const r = resolveTavernGame(dominos, 70, 25, makeRNG(seed));
      if (r.winner === 'player') pWins++;
    }
    expect(pWins).toBeGreaterThan(40); // 70 % vs 25 % : le joueur fort domine
  });

  it('déterminisme : même seed → même issue', () => {
    const flechettes = findTavernGameById('flechettes')!;
    const a = resolveTavernGame(flechettes, 45, 45, makeRNG(3));
    const b = resolveTavernGame(flechettes, 45, 45, makeRNG(3));
    expect(a).toEqual(b);
  });

  it('mode ÉTENDU (Bras de fer, l.34) : joué jusqu’à 10 DR cumulés, plusieurs manches', () => {
    const bras = findTavernGameById('bras-de-fer')!;
    expect(bras.mode).toBe('extended');
    const r = resolveTavernGame(bras, 55, 40, makeRNG(1));
    expect(r.rounds).toBeGreaterThanOrEqual(1);
    expect(Math.max(r.playerSL, r.opponentSL)).toBeGreaterThanOrEqual(bras.target ?? 10);
  });

  it('plafond de DR par manche (Boules = 6, drCap)', () => {
    const boules = findTavernGameById('boules')!;
    expect(boules.drCap).toBe(6);
    for (let seed = 0; seed < 40; seed++) {
      const r = resolveTavernGame(boules, 100, 100, makeRNG(seed)); // valeurs énormes → DR bruts > 6
      expect(r.playerSL).toBeLessThanOrEqual(6);
      expect(r.opponentSL).toBeLessThanOrEqual(6);
    }
  });

  it('Al-Zahr n’indique aucune Compétence → repli Pari (skill null, l.11)', () => {
    expect(findTavernGameById('al-zahr')!.skill).toBeNull();
  });
});

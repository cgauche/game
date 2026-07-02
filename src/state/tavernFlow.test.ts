/**
 * Jeux de taverne (NADJ ch.16) — câblage store : une partie se joue de bout en bout via la modale
 * (choix jeu + adversaire → moteur générique), l'issue est stockée, la mise déplace la bourse.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { makePregens } from '../data/pregens';
import { toBrass } from '../engine/money';
import type { Combatant } from '../engine/types';

function twoHeroes(): [Combatant, Combatant] {
  const all = makePregens();
  return [all[0] as Combatant, all[1] as Combatant];
}

beforeEach(() => {
  useGame.setState({ battle: null, party: [], journal: [], tavernGames: null, money: { gold: 5, silver: 0, brass: 0 } });
  useGame.getState().seedRng(3);
});

describe('playTavernGame', () => {
  it('partie entre compagnons : issue stockée, gagnant cohérent, bourse inchangée', () => {
    const [a, b] = twoHeroes();
    useGame.setState({ party: [a, b] });
    const purseBefore = toBrass(useGame.getState().money);
    useGame.getState().openTavernGames();
    useGame.getState().playTavernGame({ gameId: 'boules', challengerId: a.id, opponent: { kind: 'hero', id: b.id }, stakeBrass: 20 });
    const res = useGame.getState().tavernGames?.result;
    expect(res).toBeTruthy();
    expect(res!.gameLabel).toBe('Les boules');
    expect(['player', 'opponent', 'tie']).toContain(res!.winner);
    // Mise ignorée entre compagnons (bourse commune inchangée).
    expect(res!.stakeBrass).toBe(0);
    expect(res!.netBrass).toBe(0);
    expect(toBrass(useGame.getState().money)).toBe(purseBefore);
  });

  it('bras de fer (Test étendu) : plusieurs manches, premier à 10 DR cumulés', () => {
    const [a, b] = twoHeroes();
    useGame.setState({ party: [a, b] });
    useGame.getState().playTavernGame({ gameId: 'bras-de-fer', challengerId: a.id, opponent: { kind: 'hero', id: b.id } });
    const res = useGame.getState().tavernGames!.result!;
    expect(res.rounds).toBeGreaterThanOrEqual(1);
    expect(Math.max(res.playerSL, res.opponentSL)).toBeGreaterThanOrEqual(10); // cible atteinte
  });

  it('mise contre un habitué (Al-zahr) : la bourse suit le résultat (±mise / 0)', () => {
    const [a] = twoHeroes();
    useGame.setState({ party: [a], money: { gold: 5, silver: 0, brass: 0 } });
    const before = toBrass(useGame.getState().money);
    // Al-zahr porte une mise ; adversaire ABSTRAIT → la mise joue. 10 pistoles = 120 sc.
    useGame.getState().playTavernGame({ gameId: 'al-zahr', challengerId: a.id, opponent: { kind: 'abstract', value: 30 }, stakeBrass: 120 });
    const res = useGame.getState().tavernGames!.result!;
    expect(res.stakeBrass).toBe(120);
    const expectedNet = res.winner === 'player' ? 120 : res.winner === 'opponent' ? -120 : 0;
    expect(res.netBrass).toBe(expectedNet);
    expect(toBrass(useGame.getState().money)).toBe(before + expectedNet);
  });

  it('mise plafonnée à la bourse', () => {
    const [a] = twoHeroes();
    useGame.setState({ party: [a], money: { gold: 0, silver: 0, brass: 50 } }); // 50 sc
    useGame.getState().playTavernGame({ gameId: 'al-zahr', challengerId: a.id, opponent: { kind: 'abstract', value: 30 }, stakeBrass: 100000 });
    expect(useGame.getState().tavernGames!.result!.stakeBrass).toBe(50); // borné à la bourse
  });
});

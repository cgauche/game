/**
 * Jeux de taverne (NADJ ch.16) — câblage store : le jet du challenger est une CASCADE (`openRoll`,
 * `state/tavernFlow.ts`, #370) — une partie se joue de bout en bout via `drain()` (patron
 * `port-sell-cargo.test.ts`) : choix jeu + adversaire → cascade (jet du joueur surfacé, adversaire
 * roulé côté monde dans l'applier) → issue stockée, la mise déplace la bourse.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { makePregens } from '../data/pregens';
import { toBrass } from '../engine/money';
import { seedBattleRng } from './battleRng';
import type { Combatant } from '../engine/types';

const get = useGame.getState.bind(useGame);

const tick = () => new Promise<void>((r) => setTimeout(r, 0));
async function drain(): Promise<void> {
  for (let i = 0; i < 60; i++) {
    const p = get().pendingCascade;
    if (p) {
      const cur = p.participants[p.cursor];
      if (cur && cur.target != null && !cur.result) get().cascadeRoll(cur.id);
      get().cascadeNext();
    }
    await tick();
  }
}

function twoHeroes(): [Combatant, Combatant] {
  const all = makePregens();
  return [all[0] as Combatant, all[1] as Combatant];
}

beforeEach(() => {
  useGame.setState({ battle: null, party: [], journal: [], tavernGames: null, money: { gold: 5, silver: 0, brass: 0 }, pendingCascade: null });
  seedBattleRng(3);
});

describe('playTavernGame', () => {
  it('ouvre le jet du challenger par le seam de jet (openRoll) — jamais un résultat synchrone', () => {
    const [a, b] = twoHeroes();
    useGame.setState({ party: [a, b] });
    get().openTavernGames();
    get().playTavernGame({ gameId: 'boules', challengerId: a.id, opponent: { kind: 'hero', id: b.id }, stakeBrass: 20 });
    expect(get().tavernGames?.result).toBeNull();
    expect(get().pendingCascade).not.toBeNull();
    const step = get().pendingCascade!.participants[0];
    expect(step.actorId).toBe(a.id);
    expect(step.kind).toBe('tavern-game');
  });

  it('partie entre compagnons : issue stockée après la cascade, gagnant cohérent, bourse inchangée', async () => {
    const [a, b] = twoHeroes();
    useGame.setState({ party: [a, b] });
    const purseBefore = toBrass(get().money);
    get().openTavernGames();
    get().playTavernGame({ gameId: 'boules', challengerId: a.id, opponent: { kind: 'hero', id: b.id }, stakeBrass: 20 });
    await drain();
    const res = get().tavernGames?.result;
    expect(res).toBeTruthy();
    expect(res!.gameLabel).toBe('Les boules');
    expect(['player', 'opponent', 'tie']).toContain(res!.winner);
    // Mise ignorée entre compagnons (bourse commune inchangée).
    expect(res!.stakeBrass).toBe(0);
    expect(res!.netBrass).toBe(0);
    expect(toBrass(get().money)).toBe(purseBefore);
  });

  it('bras de fer (Test étendu) : plusieurs manches, premier à 10 DR cumulés', async () => {
    const [a, b] = twoHeroes();
    useGame.setState({ party: [a, b] });
    get().playTavernGame({ gameId: 'bras-de-fer', challengerId: a.id, opponent: { kind: 'hero', id: b.id } });
    await drain();
    const res = get().tavernGames!.result!;
    expect(res.rounds).toBeGreaterThanOrEqual(1);
    expect(Math.max(res.playerSL, res.opponentSL)).toBeGreaterThanOrEqual(10); // cible atteinte
  });

  it('mise contre un habitué (Al-zahr) : la bourse suit le résultat (±mise / 0)', async () => {
    const [a] = twoHeroes();
    useGame.setState({ party: [a], money: { gold: 5, silver: 0, brass: 0 } });
    const before = toBrass(get().money);
    // Al-zahr porte une mise ; adversaire ABSTRAIT → la mise joue. 10 pistoles = 120 sc.
    get().playTavernGame({ gameId: 'al-zahr', challengerId: a.id, opponent: { kind: 'abstract', value: 30 }, stakeBrass: 120 });
    await drain();
    const res = get().tavernGames!.result!;
    expect(res.stakeBrass).toBe(120);
    const expectedNet = res.winner === 'player' ? 120 : res.winner === 'opponent' ? -120 : 0;
    expect(res.netBrass).toBe(expectedNet);
    expect(toBrass(get().money)).toBe(before + expectedNet);
  });

  it('mise plafonnée à la bourse', async () => {
    const [a] = twoHeroes();
    useGame.setState({ party: [a], money: { gold: 0, silver: 0, brass: 50 } }); // 50 sc
    get().playTavernGame({ gameId: 'al-zahr', challengerId: a.id, opponent: { kind: 'abstract', value: 30 }, stakeBrass: 100000 });
    await drain();
    expect(get().tavernGames!.result!.stakeBrass).toBe(50); // borné à la bourse
  });
});

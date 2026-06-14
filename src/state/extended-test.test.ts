import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';

/** Test Étendu SÉQUENTIEL (LDB 12 l.197-211 : « atteindre un certain DR … les DR obtenus à chaque
 *  Round sont additionnés … Si le DR total passe en dessous de 0, recommencer depuis le début »).
 *  2ᵉ consommateur de la fabrique UNIQUE — SÉQUENTIEL (chaque Round dépend du total) là où le
 *  Contre-sort est PARALLÈLE (jets indépendants). Ex. enfoncer une porte renforcée (DR cible). */
describe('Test Étendu séquentiel (porte DR cumulé)', () => {
  beforeEach(() => { useGame.setState({ battle: null, pendingExtendedTest: null }); });

  function hero() {
    const h = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'Brawn', rng: makeRNG(1) });
    h.fortune = 2; h.resilience = 1;
    useGame.setState({ party: [h] });
    return h;
  }

  it('cumule le DR Round par Round jusqu’à la cible (≥ 2 Rounds = vraiment séquentiel)', () => {
    useGame.getState().seedRng(7);
    const h = hero();
    useGame.getState().startExtendedTest({ actorId: h.id, label: 'Enfoncer la porte', skillLabel: 'Force', target: 70, targetDR: 15 });
    let rounds = 0;
    let prevTotal = 0;
    while (useGame.getState().pendingExtendedTest && rounds++ < 40) {
      const p = useGame.getState().pendingExtendedTest!;
      expect(p.total).toBe(prevTotal); // le total reporté du Round précédent (dépendance séquentielle)
      const cur = p.rounds[p.rounds.length - 1];
      useGame.getState().extendedTestRoll(cur.id);
      const rr = useGame.getState().pendingExtendedTest!.rounds;
      expect(rr[rr.length - 1].result).toBeTruthy(); // chaque Round a SON jet
      useGame.getState().extendedTestNext();
      prevTotal = useGame.getState().pendingExtendedTest?.total ?? prevTotal;
    }
    expect(useGame.getState().pendingExtendedTest).toBeNull(); // la porte a cédé
    expect(rounds).toBeGreaterThan(1); // un seul jet ne suffisait pas — DR cumulés
  });

  it('un Round à DR négatif fait repartir le total à 0 + ouvre un nouveau Round', () => {
    const h = hero();
    useGame.getState().startExtendedTest({ actorId: h.id, label: 'Forcer', skillLabel: 'Force', target: 50, targetDR: 20 });
    const p = useGame.getState().pendingExtendedTest!;
    // total à 5, Round raté à DR -8 → total clampé à 0 (« recommencer depuis le début »).
    useGame.setState({ pendingExtendedTest: { ...p, total: 5, rounds: [{ id: 'round-1', interactive: true, result: { roll: 95, sl: -8, success: false } }] } });
    useGame.getState().extendedTestNext();
    const after = useGame.getState().pendingExtendedTest!;
    expect(after.total).toBe(0);
    expect(after.rounds).toHaveLength(2); // un nouveau Round s'ouvre (la tâche continue)
  });

  it('mêmes verbes d’influence que tout flux : Chance relance, Résilience garantit le Round', () => {
    const h = hero();
    useGame.getState().startExtendedTest({ actorId: h.id, label: 'Forcer', skillLabel: 'Force', target: 30, targetDR: 50 });
    const p = useGame.getState().pendingExtendedTest!;
    useGame.setState({ pendingExtendedTest: { ...p, rounds: [{ id: 'round-1', interactive: true, result: { roll: 88, sl: -5, success: false }, rerolled: false }] } });
    useGame.getState().extendedTestReroll('round-1'); // Chance : relance le Round propre raté
    expect(useGame.getState().party[0].fortune).toBe(1); // 1 Point de Chance dépensé
    // Résilience (nouveau flux) : Round garanti réussi.
    useGame.getState().startExtendedTest({ actorId: h.id, label: 'Forcer', skillLabel: 'Force', target: 30, targetDR: 50 });
    useGame.getState().extendedTestForceSuccess('round-1');
    expect(useGame.getState().pendingExtendedTest!.rounds[0].result!.success).toBe(true);
    expect(useGame.getState().party[0].resilience).toBe(0); // 1 Point de Résilience dépensé
  });
});

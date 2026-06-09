import { describe, it, expect } from 'vitest';
import { useGame } from './store';

/**
 * Résilience « Je ne faillirai pas ! » = AVANT le jet uniquement (LDB 17 l.73, mode principal
 * « au lieu de lancer les dés » ; choix maison : on retire la concession après-échec).
 */
function setPendingTest(over: Partial<any> = {}) {
  useGame.setState({
    party: [{ id: 'h1', name: 'Héros', resilience: 2 } as any],
    pendingTest: {
      actorId: 'h1', actorName: 'Héros', label: 'Test', skillValue: 40, difficulty: 'intermediaire',
      requireSL: 0, target: 40, roll: null, success: false, sl: 0,
      ...over,
    } as any,
  });
}

describe('testForceSuccess — Résilience AVANT le jet', () => {
  it('avant le jet (roll==null) : réussite garantie, DR ≥ 1, dé choisi, 1 Résilience dépensée', () => {
    setPendingTest();
    useGame.getState().testForceSuccess();
    const pt = useGame.getState().pendingTest!;
    expect(pt.success).toBe(true);
    expect(pt.sl).toBeGreaterThanOrEqual(1);
    expect(pt.roll).toBe(1); // « vous choisissez le résultat » → 01
    expect(pt.forced).toBe(true);
    expect(useGame.getState().party[0].resilience).toBe(1);
  });

  it('respecte le DR requis (Test étendu) : DR ≥ requireSL', () => {
    setPendingTest({ requireSL: 3 });
    useGame.getState().testForceSuccess();
    expect(useGame.getState().pendingTest!.sl).toBeGreaterThanOrEqual(3);
  });

  it('APRÈS un Test échoué (RAW l.73) : réussite forcée, dé conservé, 1 Résilience dépensée', () => {
    setPendingTest({ roll: 88, success: false, sl: -2 });
    useGame.getState().testForceSuccess();
    const pt = useGame.getState().pendingTest!;
    expect(pt.success).toBe(true);
    expect(pt.roll).toBe(88); // le dé raté est conservé (post-jet)
    expect(pt.forced).toBe(true);
    expect(useGame.getState().party[0].resilience).toBe(1);
  });

  it('Test déjà réussi : no-op (pas de gaspillage de Résilience)', () => {
    setPendingTest({ roll: 12, success: true, sl: 2 });
    useGame.getState().testForceSuccess();
    expect(useGame.getState().party[0].resilience).toBe(2);
  });

  it('sans Résilience : no-op', () => {
    setPendingTest();
    useGame.setState({ party: [{ id: 'h1', name: 'Héros', resilience: 0 } as any] });
    useGame.getState().testForceSuccess();
    expect(useGame.getState().pendingTest!.success).toBe(false);
  });
});

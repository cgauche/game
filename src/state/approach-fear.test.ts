/**
 * Peur à l'approche (LDB 21 — Psychologie — l.29) : « Si la source de votre Peur se rapproche de vous,
 * vous devez réussir un Test de Calme Intermédiaire (+0) ou gagner un État Brisé. » Le Test est ROUTÉ par
 * la brique cadence-aware (`runCombatFlow` + nœud `test`, comme `checkFocusInterruption`) : héros MANUEL →
 * étape de cascade INFLUENÇABLE ; héros AUTO / ennemi → jet inline. La conséquence PURE de l'échec (1 État
 * Brisé) est une op `condition` sur la branche `fail`. Plusieurs héros craintifs → autant d'étapes appendues
 * à la MÊME cascade `combat` (file naturelle).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { approachFearTrigger } from './combatFlow';
import './combat/triggeredTest'; // effet de bord : applier `triggeredTest` + appliers de cascade
import { seedBattleRng } from './battleRng';
import { stacks, COND } from '../engine/conditions';

import type { Combatant } from '../engine/types';
import { resetCadence, setCadence } from '../engine/cadence';

const hero = (over: Partial<Combatant>): Combatant =>
  ({ id: 'h', kind: 'hero', name: 'H', pos: { x: 5, y: 5 }, conditions: [], characteristics: { 'force-mentale': 50 }, skills: [], wounds: { current: 10, max: 10 },
     psychState: [{ type: 'peur', sourceId: 'e', indice: 2, calmeDR: 0 }], ...over } as unknown as Combatant);
const mover = (over: Partial<Combatant>): Combatant =>
  ({ id: 'e', kind: 'enemy', name: 'Spectre', pos: { x: 6, y: 5 }, conditions: [], wounds: { current: 10, max: 10 }, ...over } as unknown as Combatant);

/** Pose un combat minimal (héros craintifs + source de Peur), puis appelle le déclencheur. `fromPos` =
 *  la position de la source AVANT son déplacement (l'« approche » se mesure contre elle). */
function run(heroes: Combatant[], m: Combatant, fromPos: { x: number; y: number }) {
  useGame.setState({
    battle: { combatants: [...heroes, m], order: [...heroes.map((h) => h.id), m.id], turn: 0, round: 1, log: [], over: null } as never,
    party: [], pendingCascade: null, pendingReveals: [], pendingLogQueue: [],
  });
  approachFearTrigger(useGame.getState, useGame.setState, m, fromPos);
}

beforeEach(() => {
  resetCadence();
  useGame.setState({ battle: null, pendingCascade: null, pendingReveals: [], pendingLogQueue: [] });
});

describe('approachFearTrigger — source de Peur qui s’approche (LDB 21 l.29)', () => {
  it('héros MANUEL craint + s’est rapproché → étape de cascade triggeredTest INFLUENÇABLE (non lancée)', () => {
    seedBattleRng(1);
    const h = hero({});
    run([h], mover({ pos: { x: 6, y: 5 } }), { x: 9, y: 5 }); // de (9,5) à (6,5) : s’est rapproché de (5,5)
    const c = useGame.getState().pendingCascade!;
    expect(c).toBeTruthy();
    expect(c.purpose).toBe('combat');
    expect(c.participants).toHaveLength(1);
    const step = c.participants[0];
    expect(step.kind).toBe('triggeredTest');
    expect(step.actorId).toBe(h.id);
    expect(step.rollLabel).toBe('Calme'); // le Test RÉEL (≠ le libellé de situation)
    expect(step.result).toBeFalsy();       // pas encore lancé → Chance/Résilience possibles
    expect(stacks(h, COND.brise)).toBe(0); // conséquence différée
  });

  it('héros MANUEL : Calme RATÉ (cascadeRoll+Next) → 1 État Brisé', () => {
    seedBattleRng(1);
    const h = hero({ characteristics: { FM: 1 } as never }); // Calme ~imbattable à rater
    run([h], mover({ pos: { x: 6, y: 5 } }), { x: 9, y: 5 });
    const step = useGame.getState().pendingCascade!.participants.find((s) => s.kind === 'triggeredTest')!;
    useGame.getState().cascadeRoll(step.id);
    useGame.getState().cascadeNext(); // valide l’échec → branche fail → op condition `brise`
    const got = useGame.getState().battle!.combatants.find((x) => x.id === h.id)!;
    expect(stacks(got, COND.brise)).toBe(1);
  });

  it('héros MANUEL : Calme RÉUSSI → pas de Brisé', () => {
    seedBattleRng(1);
    const h = hero({ characteristics: { 'force-mentale': 100 } as never });
    run([h], mover({ pos: { x: 6, y: 5 } }), { x: 9, y: 5 });
    const step = useGame.getState().pendingCascade!.participants.find((s) => s.kind === 'triggeredTest')!;
    useGame.getState().cascadeRoll(step.id);
    useGame.getState().cascadeNext();
    const got = useGame.getState().battle!.combatants.find((x) => x.id === h.id)!;
    expect(stacks(got, COND.brise)).toBe(0);
  });

  it('2 héros craintifs s’étant rapprochés → 2 étapes triggeredTest en FILE (même cascade)', () => {
    seedBattleRng(1);
    const h1 = hero({ id: 'h1', pos: { x: 5, y: 5 } });
    const h2 = hero({ id: 'h2', pos: { x: 5, y: 7 } });
    run([h1, h2], mover({ pos: { x: 6, y: 6 } }), { x: 9, y: 6 }); // s’approche des deux
    const c = useGame.getState().pendingCascade!;
    expect(c.purpose).toBe('combat');
    expect(c.participants.filter((s) => s.kind === 'triggeredTest')).toHaveLength(2);
    expect(c.participants.map((s) => s.actorId)).toEqual(['h1', 'h2']);
  });

  it('héros AUTO craint + Calme raté → résolu INLINE (1 Brisé, aucune cascade)', () => {
    setCadence('auto');
    try {
      seedBattleRng(1);
      const h = hero({ characteristics: { FM: 1 } as never });
      run([h], mover({ pos: { x: 6, y: 5 } }), { x: 9, y: 5 });
      expect(useGame.getState().pendingCascade).toBeNull(); // auto → pas d’étape influençable
      const got = useGame.getState().battle!.combatants.find((x) => x.id === h.id)!;
      expect(stacks(got, COND.brise)).toBe(1);
    } finally {
      resetCadence();
    }
  });

  it('ne s’est PAS rapproché (s’éloigne) → aucun Test', () => {
    seedBattleRng(1);
    const h = hero({});
    run([h], mover({ pos: { x: 9, y: 5 } }), { x: 6, y: 5 }); // de (6,5) à (9,5) : s’éloigne
    expect(useGame.getState().pendingCascade).toBeNull();
  });

  it('Peur déjà vaincue (calmeDR ≥ indice) → aucun Test', () => {
    seedBattleRng(1);
    const h = hero({ psychState: [{ type: 'peur', sourceId: 'e', indice: 2, calmeDR: 2 } as never] });
    run([h], mover({ pos: { x: 6, y: 5 } }), { x: 9, y: 5 });
    expect(useGame.getState().pendingCascade).toBeNull();
  });
});

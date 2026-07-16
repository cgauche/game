import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { runFlow } from './combatFlow';
import { testFlow, EMPTY_FLOW } from './flow';
import type { Combatant } from '../engine/types';

/**
 * INTÉGRATION scène → jet : les DEUX limites du Soutien (LDB 12 l.196/l.197) réellement gatées par
 * `openSkillTest` (#467) — adjacence en combat (géométrie `battle.combatants`) et exclusion déclarative
 * (`FlowTest.noSupport`). Hors combat, sans géométrie, le Soutien reste inchangé (comportement établi).
 */
const skilled = (id: string, pos: { x: number; y: number } | undefined, agilite = 40): Combatant => ({
  id, name: id, kind: 'hero', pos,
  characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
  wounds: { current: 10, max: 10 }, advantage: 0, conditions: [], movement: 4,
  skills: [{ skillId: 'perception', characteristic: 'agilite', advances: 0 }], talents: [],
  armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, items: [],
} as unknown as Combatant);

const battleOf = (combatants: Combatant[]) => ({ combatants, order: combatants.map((c) => c.id), turn: 0, round: 1, log: [], over: null } as never);

describe('Soutien à un Test — adjacence + exclusion (#467, LDB 12 l.196/l.197)', () => {
  beforeEach(() => { useGame.setState({ battle: null, pendingTest: null, party: [] }); });

  it('EN COMBAT, dispersé : seul le supporter ADJACENT (l.196) compte, le lointain est écarté', () => {
    const leader = skilled('h1', { x: 5, y: 5 }, 40); // BAg 4
    const near = skilled('h2', { x: 6, y: 5 }); // adjacent (Chebyshev 1)
    const far = skilled('h3', { x: 20, y: 20 }); // hors de portée
    useGame.setState({ battle: battleOf([leader, near, far]), party: [leader, near, far] });
    runFlow(useGame.getState, useGame.setState, testFlow({ skill: 'perception', requireSL: 0 }, EMPTY_FLOW, EMPTY_FLOW));
    expect(useGame.getState().pendingTest!.skillValue).toBe(50); // 40 + 1×10 (near seul)
  });

  it('EN COMBAT, tous adjacents : les DEUX supporters comptent (plafond BAg 4 non atteint)', () => {
    const leader = skilled('h1', { x: 5, y: 5 }, 40);
    const near1 = skilled('h2', { x: 6, y: 5 });
    const near2 = skilled('h3', { x: 4, y: 5 });
    useGame.setState({ battle: battleOf([leader, near1, near2]), party: [leader, near1, near2] });
    runFlow(useGame.getState, useGame.setState, testFlow({ skill: 'perception', requireSL: 0 }, EMPTY_FLOW, EMPTY_FLOW));
    expect(useGame.getState().pendingTest!.skillValue).toBe(60); // 40 + 2×10
  });

  it('HORS COMBAT : aucune géométrie → le supporter distant compte quand même (comportement établi)', () => {
    const leader = skilled('h1', undefined, 40);
    const far = skilled('h2', undefined);
    useGame.setState({ battle: null, party: [leader, far] });
    runFlow(useGame.getState, useGame.setState, testFlow({ skill: 'perception', requireSL: 0 }, EMPTY_FLOW, EMPTY_FLOW));
    expect(useGame.getState().pendingTest!.skillValue).toBe(50); // 40 + 10, pas de filtre hors combat
  });

  it('`noSupport` (l.197, résistance maladie/poison/peur/danger) : AUCUN Soutien même adjacent/capable', () => {
    const leader = skilled('h1', { x: 5, y: 5 }, 40);
    const near = skilled('h2', { x: 6, y: 5 });
    useGame.setState({ battle: battleOf([leader, near]), party: [leader, near] });
    runFlow(useGame.getState, useGame.setState, testFlow({ skill: 'perception', requireSL: 0, noSupport: true }, EMPTY_FLOW, EMPTY_FLOW));
    expect(useGame.getState().pendingTest!.skillValue).toBe(40); // base seule, Soutien coupé à la source
  });
});

import { describe, it, expect } from 'vitest';
import { brokenRecovery } from './combatFlow';
import { seedBattleRng } from './battleRng';
import { stacks } from '../engine/conditions';
import type { Combatant } from '../engine/types';

const scene = () =>
  ({ id: 's', nom: '', description: '', dimensions: { w: 12, h: 12 }, levels: [{ z: 0, tiles: Array(144).fill('herbe') }], entities: [], dialogues: [], triggers: [], encounters: [], flags: {} } as never);

const getFn = (battle: unknown, scn: unknown) => () => ({ battle, scene: scn } as never);

function broken(over: Partial<Combatant>): Combatant {
  return { id: 'h', kind: 'hero', name: 'H', pos: { x: 1, y: 1 }, conditions: [{ name: 'brise', value: 2 }], characteristics: { FM: 80 }, skills: [], engagedWith: [], wounds: { current: 10, max: 10 }, ...over } as unknown as Combatant;
}
const foe = (over: Partial<Combatant>): Combatant => ({ id: 'e', kind: 'enemy', name: 'E', pos: { x: 9, y: 9 }, conditions: [], wounds: { current: 10, max: 10 }, ...over } as unknown as Combatant);

describe('brokenRecovery — récupération du Brisé en fin de Round (LDB 16 l.57-59)', () => {
  it('non Engagé, ennemi loin, Calme réussi → retire ≥ 1 État Brisé', () => {
    seedBattleRng(1);
    const h = broken({});
    const battle = { combatants: [h, foe({})] };
    const lines: string[] = [];
    brokenRecovery(getFn(battle, scene()), (l) => lines.push(l));
    expect(stacks(h, 'brise')).toBeLessThan(2); // FM 80 → Test de Calme réussi
    expect(lines.join(' ')).toMatch(/Brisé/);
  });

  it('Engagé avec un ennemi → AUCUN Test de récupération (LDB 16 l.57)', () => {
    seedBattleRng(1);
    const h = broken({ pos: { x: 5, y: 5 }, engagedWith: ['e'] });
    const battle = { combatants: [h, foe({ pos: { x: 5, y: 6 } })] }; // adjacent, en vue
    brokenRecovery(getFn(battle, scene()), () => {});
    expect(stacks(h, 'brise')).toBe(2); // inchangé (Engagé + visible donc pas caché)
  });

  it('aucun Brisé → no-op', () => {
    const h = broken({ conditions: [] });
    brokenRecovery(getFn({ combatants: [h, foe({})] }, scene()), () => {});
    expect(stacks(h, 'brise')).toBe(0);
  });
});

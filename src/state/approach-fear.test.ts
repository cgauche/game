import { describe, it, expect } from 'vitest';
import { approachFearTrigger } from './combatFlow';
import { seedBattleRng } from './battleRng';
import { stacks } from '../engine/conditions';
import type { Combatant } from '../engine/types';

const hero = (over: Partial<Combatant>): Combatant =>
  ({ id: 'h', kind: 'hero', name: 'H', pos: { x: 5, y: 5 }, conditions: [], characteristics: { FM: 5 }, skills: [], wounds: { current: 10, max: 10 },
     psychState: [{ type: 'peur', sourceId: 'e', indice: 2, calmeDR: 0 }], ...over } as unknown as Combatant);
const mover = (over: Partial<Combatant>): Combatant =>
  ({ id: 'e', kind: 'enemy', name: 'Spectre', pos: { x: 6, y: 5 }, conditions: [], wounds: { current: 10, max: 10 }, ...over } as unknown as Combatant);

const run = (h: Combatant, m: Combatant, fromPos: { x: number; y: number }) =>
  approachFearTrigger(() => ({ battle: { combatants: [h, m], log: [] } } as never), () => {}, m, fromPos);

describe('approachFearTrigger — source de Peur qui s\'approche (LDB 21 l.29)', () => {
  it('le craint + s\'est rapproché + Calme raté (FM 5) → 1 État Brisé', () => {
    seedBattleRng(1);
    const h = hero({});
    run(h, mover({ pos: { x: 6, y: 5 } }), { x: 9, y: 5 }); // de (9,5) à (6,5) : s\'est rapproché de (5,5)
    expect(stacks(h, 'Brisé')).toBe(1);
  });

  it('ne s\'est PAS rapproché (s\'éloigne) → aucun Test', () => {
    seedBattleRng(1);
    const h = hero({});
    run(h, mover({ pos: { x: 9, y: 5 } }), { x: 6, y: 5 }); // de (6,5) à (9,5) : s\'éloigne
    expect(stacks(h, 'Brisé')).toBe(0);
  });

  it('Peur déjà vaincue (calmeDR ≥ indice) → aucun Test', () => {
    seedBattleRng(1);
    const h = hero({ psychState: [{ type: 'peur', sourceId: 'e', indice: 2, calmeDR: 2 } as never] });
    run(h, mover({ pos: { x: 6, y: 5 } }), { x: 9, y: 5 });
    expect(stacks(h, 'Brisé')).toBe(0);
  });

  it('Calme réussi (FM 90) → pas de Brisé', () => {
    seedBattleRng(1);
    const h = hero({ characteristics: { FM: 90 } as never });
    run(h, mover({ pos: { x: 6, y: 5 } }), { x: 9, y: 5 });
    expect(stacks(h, 'Brisé')).toBe(0);
  });
});

import { describe, it, expect } from 'vitest';
import { occupied } from './combatFlow';
import type { BattleState } from './store';
import type { Combatant } from '../engine/types';
import type { SizeCategory } from '../engine/size';

// occupied() = tuiles bloquant le déplacement d'un mover : empreinte (LDB 15 l.55) de chaque autre
// combattant, SAUF ceux de Taille strictement inférieure (« dégagés du chemin », LDB 85 l.308-309).
const mk = (id: string, x: number, y: number, size?: SizeCategory): Combatant =>
  ({ id, name: id, pos: { x, y }, size, wounds: { current: 10, max: 10, base: 10 }, conditions: [] }) as unknown as Combatant;
const battle = (cs: Combatant[]): BattleState => ({ combatants: cs }) as unknown as BattleState;

describe('occupied — empreinte + relativité de Taille au déplacement', () => {
  it('un mover plus GRAND ignore les combattants plus petits (dégagés du chemin, 85 l.308-309)', () => {
    const big = mk('big', 0, 0, 'grande');
    const small = mk('small', 5, 5, 'moyenne');
    expect(occupied(battle([big, small]), big).has('5,5')).toBe(false);
  });

  it('un mover plus PETIT est bloqué par TOUTE l’empreinte d’un plus grand (2×2)', () => {
    const big = mk('big', 5, 5, 'grande'); // occupe 5..6 × 5..6
    const small = mk('small', 0, 0, 'moyenne');
    const blocked = occupied(battle([big, small]), small);
    expect(blocked.has('5,5')).toBe(true);
    expect(blocked.has('6,5')).toBe(true);
    expect(blocked.has('5,6')).toBe(true);
    expect(blocked.has('6,6')).toBe(true);
  });

  it('Taille égale : les combattants se bloquent mutuellement', () => {
    const a = mk('a', 0, 0, 'moyenne');
    const z = mk('z', 5, 5, 'moyenne');
    expect(occupied(battle([a, z]), a).has('5,5')).toBe(true);
  });

  it('argument id (legacy/tests) : aucun filtrage de Taille — tout bloque', () => {
    const big = mk('big', 0, 0, 'grande');
    const small = mk('small', 5, 5, 'moyenne');
    expect(occupied(battle([big, small]), 'big').has('5,5')).toBe(true);
  });
});

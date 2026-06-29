import { describe, it, expect } from 'vitest';
import { chooseEnemyAction, type EnemyTurnInput } from './ai';
import type { Combatant } from '../engine/types';

/**
 * IA de mêlée z-aware (combat-z) : un ennemi au SOL (z=0) ne doit PAS « frapper » un héros perché sur la
 * muraille (z=1) même 2D-adjacent — il s'approche (cherche un chemin), il ne mouline pas dans le vide.
 * `inMelee` (résolution) et `withinMelee` (planif) plient désormais Δétage comme `combatDistance`.
 */
const scene = () =>
  ({ id: 's', nom: '', description: '', dimensions: { w: 30, h: 21 }, levels: [{ z: 0, tiles: Array(630).fill('herbe') }], entities: [], dialogues: [], triggers: [], encounters: [], flags: {} } as never);

const C = (kind: 'hero' | 'enemy', id: string, pos: { x: number; y: number; z?: number }): Combatant =>
  ({
    id, name: id, kind, pos, movement: 4,
    characteristics: { CC: 40, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
    weapons: [{ name: 'Épée', type: 'melee', damage: { plusBF: false, flat: 4 }, qualities: [] }],
    conditions: [], skills: [], wounds: { current: 10, max: 10 }, advantage: 0, engagedWith: [], psychState: [],
  }) as unknown as Combatant;

function actionFor(heroZ?: number) {
  const enemy = C('enemy', 'e', { x: 2, y: 10 }); // sol (z=0)
  const hero = C('hero', 'h', { x: 3, y: 10, ...(heroZ ? { z: heroZ } : {}) }); // 2D-adjacent
  const input: EnemyTurnInput = { enemy, heroes: [hero], scene: scene(), blocked: new Set(['3,10']), movement: 4, spells: [] };
  return chooseEnemyAction(input);
}

describe('chooseEnemyAction — mêlée bornée par la séparation verticale', () => {
  it('héros sur la muraille (z=1), 2D-adjacent : l’ennemi au sol NE frappe PAS (approche)', () => {
    const action = actionFor(1);
    expect(action.kind).not.toBe('melee'); // Δétage=1 → distance de combat 2 > Allonge 1
  });

  it('contrôle : MÊME héros au sol (z=0) 2D-adjacent → l’ennemi frappe (melee)', () => {
    const action = actionFor(); // coplanaire : distance 1 ≤ Allonge 1
    expect(action.kind).toBe('melee');
  });
});

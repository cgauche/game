import { describe, it, expect } from 'vitest';
import { chooseEnemyAction, type EnemyTurnInput } from './ai';
import type { Combatant } from '../engine/types';

/**
 * IA de mêlée z-aware (relief unifié) : un ennemi au SOL (h = 0 m) ne « frappe » PAS un héros perché
 * en hauteur (h = 4 m) même 2D-adjacent — la séparation VERTICALE (`verticalTiles` = Δhauteur ÷ mpt)
 * plie la distance de combat au-delà de l'Allonge. Il s'approche (cherche un chemin) au lieu de
 * mouliner dans le vide. Coplanaire (même hauteur) → il frappe normalement.
 */
const scene = () =>
  ({ id: 's', nom: '', description: '', dimensions: { w: 30, h: 21 }, layers: [{ z: 0, tiles: Array(630).fill('herbe') }], entities: [], dialogues: [], triggers: [], encounters: [], flags: {} } as never);

const C = (kind: 'hero' | 'enemy', id: string, pos: { x: number; y: number; h?: number }): Combatant =>
  ({
    id, name: id, kind, pos, movement: 4,
    characteristics: { CC: 40, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
    weapons: [{ name: 'Épée', type: 'melee', damage: { plusBF: false, flat: 4 }, qualities: [] }],
    conditions: [], skills: [], wounds: { current: 10, max: 10 }, advantage: 0, engagedWith: [], psychState: [],
  }) as unknown as Combatant;

function actionFor(heroH?: number) {
  const enemy = C('enemy', 'e', { x: 2, y: 10 }); // sol (h = 0)
  const hero = C('hero', 'h', { x: 3, y: 10, ...(heroH ? { h: heroH } : {}) }); // 2D-adjacent
  const input: EnemyTurnInput = { enemy, heroes: [hero], scene: scene(), blocked: new Set(['3,10']), movement: 4, spells: [] };
  return chooseEnemyAction(input);
}

describe('chooseEnemyAction — mêlée bornée par la séparation verticale MÉTRIQUE', () => {
  it('héros perché à 4 m, 2D-adjacent : l’ennemi au sol NE frappe PAS (approche)', () => {
    const action = actionFor(4); // verticalTiles(0,4,2)=2 → distance de combat 2 > Allonge 1
    expect(action.kind).not.toBe('melee');
  });

  it('contrôle : MÊME héros coplanaire (0 m) 2D-adjacent → l’ennemi frappe (melee)', () => {
    const action = actionFor(); // même hauteur : distance 1 ≤ Allonge 1
    expect(action.kind).toBe('melee');
  });
});

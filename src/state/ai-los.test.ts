import { describe, it, expect } from 'vitest';
import { chooseEnemyAction } from './ai';
import { Scene } from './scene';
import { Combatant } from '../engine/types';

const enemy = (over: Partial<Combatant> = {}): Combatant =>
  ({ id: 'E', name: 'Tireur', kind: 'enemy', characteristics: {} as any, wounds: { current: 10, max: 10 }, advantage: 0, conditions: [], weapons: [{ name: 'Arc', type: 'ranged', damage: '+8', range: 60, qualities: [] }], armour: {} as any, skills: [], talents: [], movement: 4, pos: { x: 0, y: 0 }, ...over }) as unknown as Combatant;

const hero = (x: number): Combatant =>
  ({ id: 'H', name: 'Héros', kind: 'hero', wounds: { current: 10, max: 10 }, pos: { x, y: 0 } }) as unknown as Combatant;

function scene(w: number, tiles?: Record<string, string>): Scene {
  const grid = new Array(w).fill('herbe');
  if (tiles) for (const [k, v] of Object.entries(tiles)) grid[Number(k.split(',')[0])] = v;
  return { id: 's', name: 's', dimensions: { w, h: 1 }, ambiance: 'jour', tiles: grid, entities: [], buildings: [], dialogues: [], triggers: [], encounters: [] } as unknown as Scene;
}

describe('IA — respecte la Ligne de Vue au tir (LDB 13 l.123)', () => {
  it('cible visible → tire', () => {
    const action = chooseEnemyAction({ enemy: enemy(), heroes: [hero(5)], scene: scene(7), blocked: new Set(), movement: 4 });
    expect(action.kind).toBe('shoot');
  });
  it('cible derrière un mur (LdV bloquée) → ne tire PAS', () => {
    const action = chooseEnemyAction({ enemy: enemy(), heroes: [hero(6)], scene: scene(8, { '3,0': 'mur' }), blocked: new Set(), movement: 4 });
    expect(action.kind).not.toBe('shoot');
  });
});

describe('IA — respecte la PORTÉE (tir : bande Extrême ×3 ; sort : portée du sort)', () => {
  it('héros au-delà de Portée ×3 → ne tire pas (s’approche) ; à exactement ×3 → tire', () => {
    // Arc 10 m → Extrême ≤ 30 m = 15 cases.
    const e = () => enemy({ weapons: [{ name: 'Arc', type: 'ranged', damage: '+8', range: 10, qualities: [] }] as never });
    const far = chooseEnemyAction({ enemy: e(), heroes: [hero(20)], scene: scene(25), blocked: new Set(), movement: 4 });
    expect(far.kind).toBe('move');
    const edge = chooseEnemyAction({ enemy: e(), heroes: [hero(15)], scene: scene(25), blocked: new Set(), movement: 4 });
    expect(edge.kind).toBe('shoot');
  });
  it('sort hors de portée → ne lance pas (s’approche) ; à portée → cast', () => {
    const e = () => enemy({ weapons: [] });
    const far = chooseEnemyAction({ enemy: e(), heroes: [hero(5)], scene: scene(10), blocked: new Set(), movement: 4, offensiveSpell: 'Carreau', spellRange: 3 });
    expect(far.kind).toBe('move');
    const ok = chooseEnemyAction({ enemy: e(), heroes: [hero(3)], scene: scene(10), blocked: new Set(), movement: 4, offensiveSpell: 'Carreau', spellRange: 3 });
    expect(ok.kind).toBe('cast');
  });
  it('portée non chiffrable (sort spécial / arme sans Portée) → pas de gate', () => {
    const ok = chooseEnemyAction({ enemy: enemy({ weapons: [] }), heroes: [hero(8)], scene: scene(10), blocked: new Set(), movement: 4, offensiveSpell: 'Carreau', spellRange: null });
    expect(ok.kind).toBe('cast');
  });
});

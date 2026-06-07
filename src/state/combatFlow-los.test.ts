import { describe, it, expect } from 'vitest';
import { resolveAttack } from './combatFlow';
import { seedBattleRng } from './battleRng';
import { Scene } from './scene';
import { Combatant } from '../engine/types';
import type { GameState } from './store';

const shooter = (over: Partial<Combatant> = {}): Combatant =>
  ({
    id: 'A',
    name: 'Tireur',
    kind: 'hero',
    characteristics: { CC: 40, CT: 55, F: 30, E: 30, I: 30, Ag: 40, Dex: 30, Int: 30, FM: 30, Soc: 30 },
    wounds: { current: 12, max: 12 },
    advantage: 0,
    conditions: [],
    weapons: [{ name: 'Arc', type: 'ranged', damage: '+8', range: 60, qualities: [] }],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [],
    talents: [],
    movement: 4,
    pos: { x: 0, y: 0 },
    ...over,
  }) as unknown as Combatant;

const target = (over: Partial<Combatant> = {}): Combatant =>
  ({ ...shooter({ id: 'B', name: 'Cible', kind: 'enemy', weapons: [], pos: { x: 5, y: 0 } }), ...over }) as Combatant;

function scene(w: number, tiles?: Record<string, string>): Scene {
  const grid = new Array(w).fill('herbe');
  if (tiles) for (const [k, v] of Object.entries(tiles)) grid[Number(k.split(',')[0])] = v;
  return { id: 's', name: 's', dimensions: { w, h: 1 }, ambiance: 'jour', tiles: grid, entities: [], buildings: [], dialogues: [], triggers: [], encounters: [] } as unknown as Scene;
}

const mkGet = (sc: Scene, combatants: Combatant[]): (() => GameState) =>
  (() => ({ scene: sc, battle: { combatants }, log: () => {} })) as unknown as () => GameState;

describe('resolveAttack — gate Ligne de Vue + Couvert (LDB 13 l.123 / 14)', () => {
  it('mur intercalé à distance de la cible → pas de Ligne de Vue → null (pas de tir)', () => {
    seedBattleRng(1);
    const s = scene(7, { '3,0': 'mur' });
    const a = shooter();
    const b = target({ pos: { x: 6, y: 0 } });
    expect(resolveAttack(mkGet(s, [a, b]), a, b)).toBeNull();
  });

  it('ligne dégagée → tir résolu (résultat non nul)', () => {
    seedBattleRng(1);
    const s = scene(7);
    const a = shooter();
    const b = target({ pos: { x: 6, y: 0 } });
    expect(resolveAttack(mkGet(s, [a, b]), a, b)).not.toBeNull();
  });

  it('sous-bois sur la ligne → ligne « Couvert » dans le détail du jet', () => {
    seedBattleRng(1);
    const s = scene(7, { '3,0': 'bois' });
    const a = shooter();
    const b = target({ pos: { x: 6, y: 0 } });
    const r = resolveAttack(mkGet(s, [a, b]), a, b);
    expect(r!.res.attackerDetail!.mods!.some((m) => m.label.startsWith('Couvert'))).toBe(true);
  });
});

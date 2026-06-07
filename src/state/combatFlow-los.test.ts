import { describe, it, expect } from 'vitest';
import { resolveAttack, strayShotVictim } from './combatFlow';
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

  it('tir en bougeant (Mouvement dépensé ce tour) → -10 (LDB 14 l.101)', () => {
    seedBattleRng(1);
    const s = scene(7);
    const a = shooter();
    const b = target({ pos: { x: 6, y: 0 } });
    const get = (() => ({ scene: s, battle: { combatants: [a, b], moved: true }, log: () => {} })) as unknown as () => GameState;
    const r = resolveAttack(get, a, b);
    expect(r!.res.attackerDetail!.mods!.some((m) => m.label === 'Tir en bougeant' && m.value === -10)).toBe(true);
  });

  it('tir sans Mouvement → pas de pénalité « Tir en bougeant »', () => {
    seedBattleRng(1);
    const s = scene(7);
    const a = shooter();
    const b = target({ pos: { x: 6, y: 0 } });
    const r = resolveAttack(mkGet(s, [a, b]), a, b); // mkGet : moved absent
    expect(r!.res.attackerDetail!.mods!.some((m) => m.label === 'Tir en bougeant')).toBe(false);
  });
});

describe('strayShotVictim — tir dévié vers un allié (LDB 14 l.136)', () => {
  const att = shooter();
  const ally = { id: 'ALLY', kind: 'hero', wounds: { current: 10, max: 10 }, conditions: [] } as unknown as Combatant;
  const tgt = target({ pos: { x: 6, y: 0 }, engagedWith: ['ALLY'] });
  const battle = { combatants: [att, tgt, ally] } as any;
  const miss = (roll: number, t: number) => ({ hit: false, attackerRoll: roll, attackerDetail: { target: t } }) as any;

  it('le -20 a fait rater (jet ≤ cible+20) + allié Engagé → redirige vers l’allié', () => {
    expect(strayShotVictim(miss(40, 30), att, tgt, battle)?.id).toBe('ALLY'); // 40 ≤ 30+20
  });
  it('jet > cible+20 (aurait raté de toute façon) → pas de redirection', () => {
    expect(strayShotVictim(miss(60, 30), att, tgt, battle)).toBeNull();
  });
  it('le tir a touché → pas de redirection', () => {
    expect(strayShotVictim({ hit: true } as any, att, tgt, battle)).toBeNull();
  });
  it('cible non engagée avec un allié → pas de redirection', () => {
    expect(strayShotVictim(miss(40, 30), att, target({ pos: { x: 6, y: 0 } }), battle)).toBeNull();
  });
});

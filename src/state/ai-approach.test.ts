import { describe, it, expect } from 'vitest';
import { aiApproachPlan } from './combatFlow';
import { chooseEnemyAction, type EnemyTurnInput } from './ai';
import { makeRNG } from '../engine/dice';
import type { Combatant } from '../engine/types';

/**
 * Parité héros/IA sur l'approche (LDB 15 l.74-82) : Charge à portée de Course (2M) quand la Marche
 * ne suffit pas à entrer au contact ; Course (Test d'Athlétisme, pas d'attaque) au-delà.
 */
const scene = () =>
  ({ id: 's', nom: '', description: '', dimensions: { w: 30, h: 21 }, tiles: Array(630).fill('herbe'), entities: [], dialogues: [], triggers: [], encounters: [], flags: {} } as never);

const C = (kind: 'hero' | 'enemy', id: string, x: number, over: Partial<Combatant> = {}): Combatant =>
  ({
    id, name: id, kind, pos: { x, y: 10 }, movement: 4,
    characteristics: { CC: 40, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
    weapons: [{ name: 'Épée', type: 'melee', damage: '+4', qualities: [] }],
    conditions: [], skills: [], wounds: { current: 10, max: 10 }, advantage: 0, engagedWith: [], psychState: [],
    ...over,
  }) as unknown as Combatant;

function planFor(heroX: number, over: Partial<Combatant> = {}) {
  const enemy = C('enemy', 'e', 2, over);
  const hero = C('hero', 'h', heroX);
  const input: EnemyTurnInput = { enemy, heroes: [hero], scene: scene(), blocked: new Set([`${heroX},10`]), movement: 4 };
  const action = chooseEnemyAction(input);
  return { enemy, hero, ...aiApproachPlan(input, enemy, action, makeRNG(3)), action };
}

describe('aiApproachPlan — Charge à portée de Course / Course au-delà', () => {
  it('Marche suffisante (cible à 3) : plan inchangé, pas de Course', () => {
    const { plan, action, ran } = planFor(5);
    expect(plan).toBe(action);
    expect(ran).toBeNull();
  });

  it('cible à 6 cases (M4) : CHARGE à portée de Course — arrive AU CONTACT, sans jet', () => {
    const { plan, ran } = planFor(8); // distance 6 : marche (4) insuffisante, Course (8) au contact
    expect(ran).toBeNull(); // une charge ne demande pas de Test
    expect(plan.kind).toBe('move');
    const to = (plan as { to: { x: number; y: number } }).to;
    expect(Math.max(Math.abs(to.x - 8), Math.abs(to.y - 10))).toBe(1); // adjacent au héros
  });

  it('cible hors de portée de Course : COURT (Test d’Athlétisme) et avance plus loin que la Marche', () => {
    const { plan, ran, action } = planFor(25); // distance 23 : même la Course (8) n'atteint pas
    expect(ran).not.toBeNull(); // jet de Course consommant l'Action
    expect(ran!.budget).toBeGreaterThan(4); // Marche + Course + DR
    const to = (plan as { to: { x: number; y: number } }).to;
    const toWalk = (action as { to: { x: number; y: number } }).to;
    expect(to.x).toBeGreaterThan(toWalk.x); // porte plus loin que le plan de Marche
  });

  it('Engagé : jamais de re-planification (ni Charge étendue ni Course)', () => {
    const { plan, action, ran } = planFor(8, { engagedWith: ['x'] });
    expect(plan).toBe(action);
    expect(ran).toBeNull();
  });
});

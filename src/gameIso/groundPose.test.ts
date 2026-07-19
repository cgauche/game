import { describe, it, expect } from 'vitest';
import { groundStateOf } from './groundPose';
import type { Combatant } from '../engine/types';

const mk = (over: Partial<Combatant>): Combatant =>
  ({ id: 'c', name: 'C', kind: 'hero', wounds: { current: 10, max: 10 }, conditions: [], ...over }) as unknown as Combatant;

describe('état au sol pour le rendu (groundStateOf)', () => {
  it('debout par défaut ; entité éparse (sans conditions) = debout', () => {
    expect(groundStateOf(mk({}))).toBeNull();
    expect(groundStateOf({ id: 'e', name: 'E' } as unknown as Combatant)).toBeNull();
  });

  it('À Terre → prone (couché conscient)', () => {
    expect(groundStateOf(mk({ conditions: [{ id: 'a-terre', value: 1 }] } as Partial<Combatant>))).toBe('prone');
  });

  it('Inconscient ou hors de combat → corpse (effondré) — prime sur À Terre', () => {
    expect(groundStateOf(mk({ conditions: [{ id: 'inconscient', value: 1 }, { id: 'a-terre', value: 1 }] } as Partial<Combatant>))).toBe('corpse');
    expect(groundStateOf(mk({ dead: true }))).toBe('corpse');
    // Figurant (Mort Subite) à 0 PB → hors de combat ; un HÉROS à 0 PB reste actif (LDB 18 l.15).
    expect(groundStateOf(mk({ kind: 'enemy', wounds: { current: 0, max: 10 } }))).toBe('corpse');
    expect(groundStateOf(mk({ wounds: { current: 0, max: 10 } }))).toBeNull();
  });
});

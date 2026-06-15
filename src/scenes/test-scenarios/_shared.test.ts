import { describe, it, expect } from 'vitest';
import { arena } from './_shared';
import { isWalkable } from '../../state/scene';

describe('arena (helper scénarios de test)', () => {
  it('produit une scène dégagée avec un point de départ héros', () => {
    const s = arena({ id: 'arn', nom: 'Arène', w: 16, h: 10 });
    expect(s.dimensions).toEqual({ w: 16, h: 10 });
    expect(s.levels[0].tiles.length).toBe(160);
    expect(s.entities.find((e) => e.kind === 'heroStart')).toBeTruthy();
    expect(isWalkable(s, 8, 5)).toBe(true); // herbe = praticable
    expect(s.encounters).toEqual([]);
  });
});

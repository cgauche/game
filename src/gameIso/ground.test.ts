import { describe, it, expect } from 'vitest';
import { edgeBlends } from './ground';
import { emptyScene } from '../state/scene';

describe('edgeBlends (raccord d arêtes)', () => {
  it('un voisin de priorité plus haute déborde ; plus basse n est pas listé', () => {
    const s = emptyScene(3, 3); // tout herbe (priority 1)
    s.tiles[1 * 3 + 1] = 'herbe'; // centre = herbe
    s.tiles[1 * 3 + 2] = 'pave'; // E (x=2,y=1) = pave (priority 5)
    const blends = edgeBlends(s, 1, 1);
    expect(blends).toContainEqual({ dir: 'E', terrain: 'pave' });
    // un voisin herbe (même priorité) ne déborde pas
    expect(blends.find((b) => b.terrain === 'herbe')).toBeUndefined();
  });
  it('aucun débordement si tous voisins ≤ priorité du centre', () => {
    const s = emptyScene(3, 3);
    s.tiles[1 * 3 + 1] = 'pave'; // centre = pave (haute)
    const blends = edgeBlends(s, 1, 1); // voisins herbe (basse)
    expect(blends).toEqual([]);
  });
});

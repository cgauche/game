import { describe, it, expect } from 'vitest';
import { composeComposite } from './composite';
import type { ResolvedBone } from './composeRig';
import { identity, translate, type Matrix } from './kinematics';

const bone = (id: string, z: number, matrix: Matrix = identity()): ResolvedBone => ({
  id, z, matrix, scale: [1, 1], parts: [{ svg: `<rect/>`, layer: 0 }],
});

describe('composeComposite', () => {
  it('concatène les os de toutes les couches', () => {
    const out = composeComposite([
      { bones: [bone('a', 1), bone('b', 2)], z: (b) => b.z },
      { bones: [bone('c', 3)], z: (b) => b.z },
    ]);
    expect(out.map((b) => b.id).sort()).toEqual(['a', 'b', 'c']);
  });

  it('trie TOUS les os par z final, toutes couches mêlées (interleaving)', () => {
    // couche monture z 1..3, couche cavalier ré-étiquetée à 1.5 et 2.5 → s'intercalent.
    const merged = composeComposite([
      { bones: [bone('m1', 1), bone('m2', 2), bone('m3', 3)], z: (b) => b.z },
      { bones: [bone('rA', 0), bone('rB', 0)], z: (b) => (b.id === 'rA' ? 1.5 : 2.5) },
    ]);
    expect(merged.map((b) => b.id)).toEqual(['m1', 'rA', 'm2', 'rB', 'm3']);
  });

  it('applique la matrice de placement (place) aux os de la couche', () => {
    const out = composeComposite([
      { bones: [bone('r', 5, translate(10, 20))], place: translate(100, 200), z: (b) => b.z },
    ]);
    // place ∘ matrice : translation cumulée (100+10, 200+20)
    expect(out[0].matrix[4]).toBe(110);
    expect(out[0].matrix[5]).toBe(220);
  });

  it('sans place, la matrice de l\'os est inchangée', () => {
    const m = translate(7, 9);
    const out = composeComposite([{ bones: [bone('r', 1, m)], z: (b) => b.z }]);
    expect(out[0].matrix).toEqual(m);
  });

  it('réassigne le z de chaque os via la fonction de la couche', () => {
    const out = composeComposite([{ bones: [bone('r', 99)], z: () => 4.2 }]);
    expect(out[0].z).toBe(4.2);
  });

  it('préserve les parts et l\'échelle des os', () => {
    const out = composeComposite([{ bones: [bone('r', 1)], z: (b) => b.z }]);
    expect(out[0].parts).toEqual([{ svg: '<rect/>', layer: 0 }]);
    expect(out[0].scale).toEqual([1, 1]);
  });
});

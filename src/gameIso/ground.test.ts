import { describe, it, expect } from 'vitest';
import { edgeBlends, elevSkirt, groundTile } from './ground';
import { emptyScene, type Scene } from '../state/scene';
import type { Dims } from './iso';

describe('edgeBlends (raccord d arêtes)', () => {
  it('un voisin de priorité plus haute déborde ; plus basse n est pas listé', () => {
    const s = emptyScene(3, 3); // tout herbe (priority 1)
    s.levels[0].tiles[1 * 3 + 1] = 'herbe'; // centre = herbe
    s.levels[0].tiles[1 * 3 + 2] = 'pave'; // E (x=2,y=1) = pave (priority 5)
    const blends = edgeBlends(s, 1, 1);
    expect(blends).toContainEqual({ dir: 'E', terrain: 'pave' });
    // un voisin herbe (même priorité) ne déborde pas
    expect(blends.find((b) => b.terrain === 'herbe')).toBeUndefined();
  });
  it('aucun débordement si tous voisins ≤ priorité du centre', () => {
    const s = emptyScene(3, 3);
    s.levels[0].tiles[1 * 3 + 1] = 'pave'; // centre = pave (haute)
    const blends = edgeBlends(s, 1, 1); // voisins herbe (basse)
    expect(blends).toEqual([]);
  });
  it('opère sur le NIVEAU demandé (z) — un étage a ses propres raccords', () => {
    const s = emptyScene(3, 3);
    s.levels.push({ z: 1, tiles: new Array(9).fill('herbe') });
    s.levels[1].tiles[1 * 3 + 2] = 'pave'; // voisin E au niveau 1
    expect(edgeBlends(s, 1, 1, 1)).toContainEqual({ dir: 'E', terrain: 'pave' });
    expect(edgeBlends(s, 1, 1, 0)).toEqual([]); // niveau 0 inchangé (tout herbe)
  });
});

const dims: Dims = { w: 4, h: 4 };
function withElev(): Scene {
  const s = emptyScene(4, 4);
  s.levels[0].tiles = new Array(16).fill('plancher');
  s.levels[0].elev = new Array(16).fill(0);
  return s;
}

describe('élévation — jupe (riser) sur les arêtes en dénivelé', () => {
  it('case plate (elev 0 partout) → aucune jupe', () => {
    expect(elevSkirt(withElev(), 1, 1, dims)).toEqual([]);
  });

  it('case surélevée cernée de cases basses → une jupe par arête (4)', () => {
    const s = withElev();
    s.levels[0].elev![1 * 4 + 1] = 0.4;
    const sk = elevSkirt(s, 1, 1, dims);
    expect(sk).toHaveLength(4);
    for (const q of sk) expect(q.points).toHaveLength(4); // quad vertical
  });

  it('plateau plat (2 cases à la même élévation) → pas de jupe sur l’arête PARTAGÉE', () => {
    const s = withElev();
    s.levels[0].elev![1 * 4 + 1] = 0.4;
    s.levels[0].elev![1 * 4 + 2] = 0.4; // voisin E à la même hauteur
    const dirs = elevSkirt(s, 1, 1, dims).map((q) => q.dir);
    expect(dirs).not.toContain('E'); // arête partagée du plateau : pas de chute
    expect(dirs).toContain('S'); // bord du plateau : chute
  });

  it('fosse : la case RIM (haute) dessine la paroi vers la case basse ; la fosse n’en dessine pas', () => {
    const s = withElev();
    s.levels[0].elev![2 * 4 + 1] = -0.5; // fosse en (1,2)
    expect(elevSkirt(s, 1, 1, dims).map((q) => q.dir)).toContain('S'); // rim (1,1) descend vers la fosse
    expect(elevSkirt(s, 1, 2, dims)).toEqual([]); // la fosse (plus basse) ne dessine rien
  });

  it('jupe = bande verticale non dégénérée (haut ≠ bas)', () => {
    const s = withElev();
    s.levels[0].elev![1 * 4 + 1] = 0.5;
    const [q] = elevSkirt(s, 1, 1, dims);
    const ys = q.points.map((p) => p[1]);
    expect(Math.max(...ys)).toBeGreaterThan(Math.min(...ys));
  });

  it('groundTile d’une case surélevée intègre la/les jupe(s) dans son SVG', () => {
    const s = withElev();
    s.levels[0].elev![1 * 4 + 1] = 0.4;
    const flat = groundTile(emptyScene(4, 4), 1, 1, dims);
    const raised = groundTile(s, 1, 1, dims);
    expect(raised.length).toBeGreaterThan(flat.length);
    expect(raised).toContain('elev-skirt');
  });
});

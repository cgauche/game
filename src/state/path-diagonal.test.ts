import { describe, it, expect } from 'vitest';
import { emptyScene, type Scene, type Terrain, type WallSeg } from './scene';
import { pathTo, walkNeighbors, reachable } from './path';

/**
 * GRILLE 8-CONNEXE — déplacement diagonal (LDB 15 « Déplacement » l.10-16 : la grille optionnelle
 * « compte les cases », aucune règle de diagonale → une diagonale = 1 case = 1 pas, Chebyshev). Source
 * UNIQUE de connectivité (`walkNeighbors`/`pathTo`/`reachable`) partagée explo + clic + POV + combat + IA.
 * La garde anti coupe-de-coin empêche de se faufiler en diagonale à travers un coin de mur / entre deux vides.
 */

const key = (p: { x: number; y: number; z?: number }) => `${p.x},${p.y},${p.z ?? 0}`;
const NO_BLOCK = { blocked: new Set<string>() };

/** Rend une case non-marchable (vide) sur la couche z0. `emptyScene` remplit d'herbe marchable partout. */
function voidTile(s: Scene, w: number, x: number, y: number) {
  s.layers[0].tiles[y * w + x] = 'vide' as Terrain;
}

describe('path — 8-connexe (déplacement diagonal)', () => {
  it('walkNeighbors sur sol ouvert renvoie 8 voisins (4 cardinaux + 4 diagonaux)', () => {
    const s = emptyScene(5, 5);
    const keys = new Set(walkNeighbors(s, { x: 2, y: 2 }).map(key));
    for (const k of ['3,2,0', '1,2,0', '2,3,0', '2,1,0']) expect(keys.has(k)).toBe(true); // cardinaux
    for (const k of ['3,3,0', '3,1,0', '1,3,0', '1,1,0']) expect(keys.has(k)).toBe(true); // diagonaux
    expect(keys.size).toBe(8);
  });

  it('pathTo prend le raccourci diagonal : (0,0)→(3,3) = 4 cases (Chebyshev), pas 7 (Manhattan)', () => {
    const path = pathTo(emptyScene(5, 5), { x: 0, y: 0 }, { x: 3, y: 3 }, NO_BLOCK);
    expect(path).not.toBeNull();
    expect(path!.length).toBe(4); // départ + 3 pas diagonaux
  });

  it('reachable : la diagonale coûte 1 pas (distance = Chebyshev)', () => {
    const dist = reachable(emptyScene(7, 7), { x: 3, y: 3 }, 2, NO_BLOCK);
    expect(dist.get('4,4')).toBe(1); // diagonale adjacente = 1 pas
    expect(dist.get('5,5')).toBe(2); // 2 diagonales = 2 pas
    expect(dist.get('5,3')).toBe(2); // et le cardinal à 2 reste 2
  });
});

describe('path — garde anti coupe-de-coin', () => {
  it('une seule orthogonale flanquante VIDE suffit à interdire la diagonale', () => {
    const s = emptyScene(3, 3);
    voidTile(s, 3, 2, 1); // orthogonale (2,1) vide → interdit la diagonale (1,1)→(2,0) et (1,1)→(2,2)
    const keys = new Set(walkNeighbors(s, { x: 1, y: 1 }).map(key));
    expect(keys.has('2,0,0')).toBe(false);
    expect(keys.has('2,2,0')).toBe(false);
    expect(keys.has('1,0,0')).toBe(true); // la diagonale de l'autre côté (orthogonales libres) reste permise
  });

  it('un MUR sur une arête flanquante bloque la diagonale (coin de mur)', () => {
    const s = emptyScene(3, 3);
    s.walls = [{ x: 1, y: 1, side: 'E' } as WallSeg]; // arête E de (1,1) : entre (1,1) et (2,1)
    const keys = new Set(walkNeighbors(s, { x: 1, y: 1 }).map(key));
    expect(keys.has('2,1,0')).toBe(false); // le cardinal E est muré
    expect(keys.has('2,0,0')).toBe(false); // …donc pas de coupe diagonale par ce coin
    expect(keys.has('2,2,0')).toBe(false);
    expect(keys.has('0,0,0')).toBe(true);  // diagonale opposée (loin du mur) intacte
  });
});

import { describe, it, expect } from 'vitest';
import { sizeFootprint, footprintTiles, occupiesTile, footprintChebyshev, footprintsOverlap, combatDistance } from './footprint';
import { chebyshev } from './path';
import type { Combatant } from '../engine/types';
import type { SizeCategory } from '../engine/size';

const C = (x: number, y: number, size?: SizeCategory): Combatant => ({ pos: { x, y }, size }) as unknown as Combatant;

// Empreinte de grille par Taille (LDB 15 - Déplacement l.55 : « 2, 4 ou même plus de cases »).
describe('footprint — empreinte N×N par Taille (LDB 15 l.55)', () => {
  it('côté N : Minuscule→Moyenne 1, Grande 2, Énorme 3, Monstrueuse 4', () => {
    expect(sizeFootprint('minuscule')).toBe(1);
    expect(sizeFootprint('moyenne')).toBe(1);
    expect(sizeFootprint(undefined)).toBe(1); // défaut Moyenne
    expect(sizeFootprint('grande')).toBe(2); // = les « 4 cases » du texte canon
    expect(sizeFootprint('enorme')).toBe(3);
    expect(sizeFootprint('monstrueuse')).toBe(4);
  });

  it('footprintTiles : 1×1 = la tuile ; Grande = bloc 2×2 ancré au coin NO', () => {
    expect(footprintTiles({ x: 3, y: 7 }, 'moyenne')).toEqual([{ x: 3, y: 7 }]);
    expect(footprintTiles({ x: 5, y: 5 }, 'grande')).toEqual([
      { x: 5, y: 5 }, { x: 6, y: 5 }, { x: 5, y: 6 }, { x: 6, y: 6 },
    ]);
    expect(footprintTiles({ x: 0, y: 0 }, 'enorme')).toHaveLength(9);
    expect(footprintTiles({ x: 0, y: 0 }, 'monstrueuse')).toHaveLength(16);
  });

  it('occupiesTile : couvre les N×N tuiles à partir du coin NO', () => {
    const p = { x: 5, y: 5 };
    expect(occupiesTile(p, 'grande', 6, 6)).toBe(true);
    expect(occupiesTile(p, 'grande', 5, 5)).toBe(true);
    expect(occupiesTile(p, 'grande', 7, 5)).toBe(false); // hors du 2×2
    expect(occupiesTile(p, 'moyenne', 6, 5)).toBe(false);
  });

  it('footprintChebyshev coïncide avec chebyshev pour deux créatures 1×1', () => {
    const a = { x: 2, y: 3 }, b = { x: 6, y: 5 };
    expect(footprintChebyshev(a, 'moyenne', b, 'moyenne')).toBe(chebyshev(a, b));
  });

  it('adjacence par empreinte : une Grande (2×2) est « au contact » si UNE tuile touche la cible', () => {
    const big = { x: 5, y: 5 }; // occupe 5..6 × 5..6
    // cible 1×1 en (7,6) : colle au bord est du 2×2 → distance 1 (adjacent)
    expect(footprintChebyshev(big, 'grande', { x: 7, y: 6 }, 'moyenne')).toBe(1);
    // cible 1×1 en (8,6) : une tuile de marge → distance 2
    expect(footprintChebyshev(big, 'grande', { x: 8, y: 6 }, 'moyenne')).toBe(2);
    // cible dans l'empreinte → 0 (chevauchement)
    expect(footprintChebyshev(big, 'grande', { x: 6, y: 6 }, 'moyenne')).toBe(0);
  });

  it('footprintsOverlap : détecte la collision de placement', () => {
    expect(footprintsOverlap({ x: 5, y: 5 }, 'grande', { x: 6, y: 6 }, 'moyenne')).toBe(true);
    expect(footprintsOverlap({ x: 5, y: 5 }, 'grande', { x: 7, y: 7 }, 'moyenne')).toBe(false);
  });

  it('combatDistance : coïncide avec chebyshev pour le 1×1, mais un grand est au contact par son bord', () => {
    expect(combatDistance(C(0, 0), C(3, 0))).toBe(3); // deux 1×1 → identique à chebyshev
    expect(combatDistance(C(5, 5, 'grande'), C(7, 6))).toBe(1); // 2×2 adjacent au bord est
    expect(combatDistance(C(5, 5, 'grande'), C(8, 6))).toBe(2); // une tuile de marge
    expect(combatDistance(C(0, 0), {} as Combatant)).toBe(Infinity); // cible non posée
  });
});

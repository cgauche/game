import { describe, it, expect } from 'vitest';
import { sizeFootprint, footprintN, footprintTiles, occupiesTile, footprintChebyshev, footprintsOverlap, combatDistance, decorFootGeometry } from './footprint';
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

  it('footprintN : empreinte autorée (NAVIRE) ⊥ Taille créature — `footprint` prime sur `size`', () => {
    expect(footprintN({ size: 'grande' })).toBe(2); // dérivée de la Taille créature
    expect(footprintN({})).toBe(1); // défaut Moyenne
    expect(footprintN({ footprint: 3 })).toBe(3); // empreinte AUTORÉE (un navire) — SANS Taille créature
    expect(footprintN({ size: 'monstrueuse', footprint: 2 })).toBe(2); // `footprint` explicite prime sur `size`
  });

  it('footprintTiles : côté 1 = la tuile ; côté 2 = bloc 2×2 ancré au coin NO', () => {
    expect(footprintTiles({ x: 3, y: 7 }, 1)).toEqual([{ x: 3, y: 7 }]);
    expect(footprintTiles({ x: 5, y: 5 }, 2)).toEqual([
      { x: 5, y: 5 }, { x: 6, y: 5 }, { x: 5, y: 6 }, { x: 6, y: 6 },
    ]);
    expect(footprintTiles({ x: 0, y: 0 }, 3)).toHaveLength(9);
    expect(footprintTiles({ x: 0, y: 0 }, 4)).toHaveLength(16);
  });

  it('occupiesTile : couvre les N×N tuiles à partir du coin NO', () => {
    const p = { x: 5, y: 5 };
    expect(occupiesTile(p, 2, 6, 6)).toBe(true);
    expect(occupiesTile(p, 2, 5, 5)).toBe(true);
    expect(occupiesTile(p, 2, 7, 5)).toBe(false); // hors du 2×2
    expect(occupiesTile(p, 1, 6, 5)).toBe(false);
  });

  it('footprintChebyshev coïncide avec chebyshev pour deux empreintes 1×1', () => {
    const a = { x: 2, y: 3 }, b = { x: 6, y: 5 };
    expect(footprintChebyshev(a, 1, b, 1)).toBe(chebyshev(a, b));
  });

  it('adjacence par empreinte : un bloc 2×2 est « au contact » si UNE tuile touche la cible', () => {
    const big = { x: 5, y: 5 }; // occupe 5..6 × 5..6
    expect(footprintChebyshev(big, 2, { x: 7, y: 6 }, 1)).toBe(1); // colle au bord est → distance 1 (adjacent)
    expect(footprintChebyshev(big, 2, { x: 8, y: 6 }, 1)).toBe(2); // une tuile de marge → distance 2
    expect(footprintChebyshev(big, 2, { x: 6, y: 6 }, 1)).toBe(0); // dans l'empreinte → 0 (chevauchement)
  });

  it('footprintsOverlap : détecte la collision de placement', () => {
    expect(footprintsOverlap({ x: 5, y: 5 }, 2, { x: 6, y: 6 }, 1)).toBe(true);
    expect(footprintsOverlap({ x: 5, y: 5 }, 2, { x: 7, y: 7 }, 1)).toBe(false);
  });

  it('combatDistance : coïncide avec chebyshev pour le 1×1, mais un grand est au contact par son bord', () => {
    expect(combatDistance(C(0, 0), C(3, 0))).toBe(3); // deux 1×1 → identique à chebyshev
    expect(combatDistance(C(5, 5, 'grande'), C(7, 6))).toBe(1); // 2×2 adjacent au bord est
    expect(combatDistance(C(5, 5, 'grande'), C(8, 6))).toBe(2); // une tuile de marge
    expect(combatDistance(C(0, 0), {} as Combatant)).toBe(Infinity); // cible non posée
  });
});

describe('decorFootGeometry — empreinte rectangulaire des décors (foot {w,h})', () => {
  it('absent ou 1×1 → identité (le décor historique ne bouge pas)', () => {
    expect(decorFootGeometry(undefined)).toEqual({ offX: 0, offY: 0, scale: 1 });
    expect(decorFootGeometry({ w: 1, h: 1 })).toEqual({ offX: 0, offY: 0, scale: 1 });
  });
  it('tente 2×2 → centre du bloc (+0.5,+0.5), échelle ×2', () => {
    expect(decorFootGeometry({ w: 2, h: 2 })).toEqual({ offX: 0.5, offY: 0.5, scale: 2 });
  });
  it('tribune 3×1 → centre (+1,0), échelle = côté max (×3)', () => {
    expect(decorFootGeometry({ w: 3, h: 1 })).toEqual({ offX: 1, offY: 0, scale: 3 });
  });
  it('valeurs dégénérées (0/négatives) ramenées à 1', () => {
    expect(decorFootGeometry({ w: 0, h: -2 })).toEqual({ offX: 0, offY: 0, scale: 1 });
  });
});

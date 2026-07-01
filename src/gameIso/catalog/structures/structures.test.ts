import { describe, it, expect } from 'vitest';
import { structureAppearance, wallApp } from './index';
import { structureAppearances } from '../../../data';
import { wallSeg } from '../../walls';
import type { WallSeg } from '../../../state/scene';
import type { Dims } from '../../iso';

const DIMS: Dims = { w: 6, h: 6 }; // iso (view non défini)

describe('apparence de structure (JSON partagé iso/POV)', () => {
  it('les 6 apparences sont présentes', () => {
    const ids = structureAppearances.map((s) => s.id).sort();
    expect(ids).toEqual(['mur-en-bois', 'mur-en-pierre', 'plain', 'porte', 'porte-blindee', 'porte-de-ville']);
  });

  it('mur-en-pierre : pierre + parapet ; porte-de-ville : herse 6 barreaux', () => {
    expect(structureAppearance('mur-en-pierre').material).toBe('pierre');
    expect(structureAppearance('mur-en-pierre').parapet).toBeDefined();
    expect(structureAppearance('porte-de-ville').door?.herse?.bars).toBe(6);
  });

  it('bois : couleur de base par partie (plus de palette pré-ombrée faceN/faceE)', () => {
    const wood = structureAppearance('mur-en-bois').wood!;
    expect(wood.inset).toMatch(/^#/);
    expect(wood).not.toHaveProperty('faceN');
  });

  it('repli sur plain (undefined + id inconnu)', () => {
    expect(structureAppearance(undefined).id).toBe('plain');
    expect(structureAppearance('inconnu').id).toBe('plain');
  });

  it('wallApp : structure explicite, sinon rempart si surélevé, sinon mur nu', () => {
    expect(wallApp({ x: 0, y: 0, side: 'N', structure: 'porte-de-ville' } as WallSeg, 0).id).toBe('porte-de-ville');
    expect(wallApp({ x: 0, y: 0, side: 'N' } as WallSeg, 3).id).toBe('mur-en-pierre');
    expect(wallApp({ x: 0, y: 0, side: 'N' } as WallSeg, 0).id).toBe('plain');
  });

  it('walls.ts consomme la donnée : la face du JSON apparaît dans le SVG rendu', () => {
    const wood = wallSeg({ x: 1, y: 1, side: 'E' } as WallSeg, DIMS, false, 0); // 'plain' bois
    expect(wood.svg).toContain(structureAppearance('plain').face); // #6e5940 (face E = SIDE_LIT identité)
    const stone = wallSeg({ x: 1, y: 1, side: 'E', structure: 'mur-en-pierre' } as WallSeg, DIMS, false, 0);
    expect(stone.svg).toContain('var(--struct-face)');
  });
});

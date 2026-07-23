import { describe, it, expect } from 'vitest';
import { structureAppearance, wallApp, wallPartColor } from './index';
import { structureAppearances } from '../../../data';
import { buildWalls } from '../../builders/walls';
import { wallSvg } from '../../backends/affineWalls';
import { emptyScene, type Scene, type WallSeg } from '../../../state/scene';
import type { Dims } from '../../../geometry/iso';

const DIMS: Dims = { w: 6, h: 6 }; // iso (view non défini)

function sceneWith(seg: WallSeg): Scene {
  const s = emptyScene(6, 6);
  s.walls = [seg];
  return s;
}

describe('apparence de structure (JSON partagé iso/POV)', () => {
  it('les 7 apparences sont présentes', () => {
    const ids = structureAppearances.map((s) => s.id).sort();
    expect(ids).toEqual([
      'mur-a-ossature-en-bois',
      'mur-en-bois',
      'mur-en-pierre',
      'plain',
      'porte',
      'porte-blindee',
      'porte-de-ville',
    ]);
  });

  it('mur-a-ossature-en-bois : réutilise detail.timber (poteaux plus serrés que mur-en-bois)', () => {
    const app = structureAppearance('mur-a-ossature-en-bois');
    expect(app.detail?.timber).toBeDefined();
    expect(app.detail!.timber!.postEveryM).toBeLessThan(structureAppearance('mur-en-bois').detail!.timber!.postEveryM);
    expect(app.face).not.toBe(structureAppearance('mur-en-bois').face);
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

  it('le pipeline murs (buildWalls + backend affine) consomme la donnée : la face du JSON apparaît dans le SVG', () => {
    const wood = wallSvg(buildWalls(sceneWith({ x: 1, y: 1, side: 'E' }))[0], DIMS); // 'plain' bois
    expect(wood).toContain(structureAppearance('plain').face); // #6e5940 (face E = SIDE_LIT identité)
    const stone = wallSvg(buildWalls(sceneWith({ x: 1, y: 1, side: 'E', structure: 'mur-en-pierre' }))[0], DIMS);
    expect(stone).toContain(structureAppearance('mur-en-pierre').face); // palette pierre UNIFIÉE (hex du JSON)
  });

  it('mur FENÊTRÉ : wallSvg pose la croisée (verre froid le jour) ; NUIT → ambre émissif + class="warm"', () => {
    const el = buildWalls(sceneWith({ x: 1, y: 1, side: 'E', window: true }))[0];
    const day = wallSvg(el, DIMS);
    expect(day).toContain(structureAppearance('plain').window!.glass); // verre froid du JOUR (hex de la def)
    expect(day).not.toContain('class="warm"');
    const night = wallSvg(el, DIMS, { night: true });
    expect(night).toContain('class="warm"'); // vitre allumée scintillante (anim.css global)
    expect(night).toContain(structureAppearance('plain').window!.lit); // ambre émissif de la def
  });

  it('wallPartColor : couleur de base par PART depuis les champs de la def (source unique des 2 backends)', () => {
    const bois = structureAppearance('plain');
    expect(wallPartColor(bois, 'face')).toBe(bois.face);
    expect(wallPartColor(bois, 'panneau')).toBe(bois.wood!.inset);
    expect(wallPartColor(bois, 'gravats')).toBe(bois.wood!.rubble); // repli bois (pas de rubble pierre)
    const pierre = structureAppearance('mur-en-pierre');
    expect(wallPartColor(pierre, 'bande')).toBe(pierre.band);
    expect(wallPartColor(pierre, 'merlon')).toBe(pierre.cap);
    const porte = structureAppearance('porte-de-ville');
    expect(wallPartColor(porte, 'herse-traverse')).toBe(porte.door!.herse!.traverseColor);
  });
});

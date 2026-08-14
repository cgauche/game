import { describe, it, expect } from 'vitest';
import { emptyScene } from '../../state/scene';
import { buildWalls } from '../builders/walls';
import { buildRoofs } from '../builders/roofs';
import type { Dims } from '../../geometry/iso';
import { wallLayerObjs } from './layers';

/**
 * Couche des MURS au trait (plan de station, aperçu d'éditeur). Les couches de SOLS et de TOITS
 * projetées en SVG sont mortes avec la voie de jeu affine (#1176 P3-4, commit C5a) : les vérités de
 * SCÈNE qu'elles bakaient (ghost/solidOverhang, hauteur métrique, relations de pièce) sont celles des
 * BUILDERS, et s'y testent — `builders/floors.test.ts`, `builders/props.test.ts`,
 * `builders/roofs.test.ts`. Ce qui reste ici est la PROJECTION, et elle seule.
 */
const DIMS = (s: { dimensions: { w: number; h: number } }): Dims => ({ ...s.dimensions, rot: 0, view: 'iso' });
const OPTS = { zoom: 1, mpt: 2 };

describe('couche des murs — la projection porte les vérités du builder', () => {
  it('murs : PLUS d’op bakée (aucune estompe d’occlusion ici) ; vis = vérité du builder ; x,y,z portés', () => {
    const s = emptyScene(3, 3);
    s.walls = [{ x: 1, y: 1, side: 'N' }];
    const objs = wallLayerObjs(buildWalls(s), DIMS(s), 0, OPTS);
    expect(objs).toHaveLength(1);
    expect(objs[0].x).toBe(1);
    expect(objs[0].y).toBe(1);
    expect(objs[0].vis).toBe(true); // sans set de visibilité : tout visible (builder)
    expect(objs[0]).toMatchObject({ kind: 'wall', side: 'N' });
  });

  it('propage les relations architecturales du mur au stage, et le builder de toits porte les siennes', () => {
    const s = emptyScene(5, 5);
    s.effectZones = [{ id: 'salle', label: 'Salle', presentation: 'interior', area: { kind: 'rect', x: 2, y: 2, w: 1, h: 1 }, z: 0 }];
    s.walls = [{ x: 2, y: 2, side: 'N' }];
    s.architecture = [{
      id: 'corps', style: 'maison', storeys: [],
      facades: [{ id: 'facade', z: 0, edges: [{ x: 2, y: 2, side: 'N' }], appearance: 'mur-a-ossature-en-bois', roomZoneIds: ['salle'] }],
      masses: [{ id: 'toit', z: 0, footprint: [{ x: 2, y: 2, w: 1, h: 1 }], levels: 1, profile: 'flat', pitchDeg: 30, material: 'tuile' }],
    }];

    expect(wallLayerObjs(buildWalls(s), DIMS(s), 0, OPTS)[0].roomZoneIds).toEqual(['salle']);
    // La nappe porte la MÊME relation, lue directement au builder : c'est de là que la voie volumique
    // la prend (`IsoStage.keepEl` → `cutawayForSection`), aucune projection SVG entre les deux.
    expect(buildRoofs(s)[0].roomZoneIds).toEqual(['salle']);
  });
});

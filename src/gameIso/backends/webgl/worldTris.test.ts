import { describe, expect, it } from 'vitest';
import {
  COPLANAR_BIAS_M,
  biasPoly,
  coplanarOverlapPairs,
  coplanarRanks,
  crossQuadTris,
  facePoly,
  faceQuads,
  facesGeometry,
  fanTriangles,
  gpToWorld,
  isConvex,
  planarity,
  polyNormal,
  pxPerM,
  uprightWidthM,
  type WorldPoly,
} from './worldTris';
import { buildFloors } from '../../builders/floors';
import { buildWalls } from '../../builders/walls';
import { buildRoofs } from '../../builders/roofs';
import { buildScene } from '../../../state/mapSpec';
import { spec as siegeSpec } from '../../../scenes/test-scenarios/siege-enceinte';
import { scenario as arene } from '../../../scenes/test-scenarios/arene';
import { sceneMetresPerTile, type Scene } from '../../../state/scene';
import { TW } from '../../../geometry/iso';
import type { Face } from '../../builders/types';

const siege = buildScene(siegeSpec);

/** Toutes les faces MONDE d'une scène, dans l'ordre de peinture des builders. */
function facesOf(scene: Scene): Face[] {
  return [...buildFloors(scene), ...buildWalls(scene), ...buildRoofs(scene)].flatMap((el) => el.faces);
}

describe('gpToWorld — GP (tuiles + mètres) → repère three Y-haut', () => {
  it('(x, y, h) devient (x·mpt, h, y·mpt)', () => {
    expect(gpToWorld({ x: 3, y: -1.5, h: 4 }, 2)).toEqual({ x: 6, y: 4, z: -3 });
  });

  it('pxPerM dérive de TW : la demi-diagonale projetée d’une tuile', () => {
    expect(pxPerM(2)).toBeCloseTo((TW * Math.SQRT1_2) / 2, 12);
  });
});

describe('Triangulation en ÉVENTAIL — le pivot n’émet que des faces planes, convexes, ≤ 4 points', () => {
  const scenes: [string, Scene][] = [
    ['siege-enceinte', siege],
    ['arene (hub)', arene.scene],
  ];

  for (const [name, scene] of scenes) {
    it(`${name} : 0 face > 4 points, 0 non-plane (> 1e-4 m), 0 non-convexe`, () => {
      const mpt = sceneMetresPerTile(scene);
      let counted = 0;
      let tooMany = 0;
      let nonPlanar = 0;
      let nonConvex = 0;
      let worst = 0;
      for (const f of facesOf(scene)) {
        if (f.poly.length < 3) continue; // montant : traité en quads croisés
        counted++;
        const poly = facePoly(f, mpt);
        if (poly.length > 4) tooMany++;
        const flat = planarity(poly);
        worst = Math.max(worst, flat);
        if (flat > 1e-4) nonPlanar++;
        if (!isConvex(poly)) nonConvex++;
      }
      expect(counted).toBeGreaterThan(100);
      expect({ tooMany, nonPlanar, nonConvex }).toEqual({ tooMany: 0, nonPlanar: 0, nonConvex: 0 });
      expect(worst).toBeLessThanOrEqual(1e-4);
    });
  }

  it('un quad donne 2 triangles en éventail depuis son premier sommet', () => {
    const quad: WorldPoly = [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 1, y: 0, z: 1 },
      { x: 0, y: 0, z: 1 },
    ];
    const tris = fanTriangles(quad);
    expect(tris).toHaveLength(2);
    expect(tris[0]).toEqual([quad[0], quad[1], quad[2]]);
    expect(tris[1]).toEqual([quad[0], quad[2], quad[3]]);
  });
});

describe('MONTANTS à 2 points — deux quads verticaux croisés, largeur écran ramenée au monde', () => {
  it('la largeur MONDE est la largeur ÉCRAN divisée par pxPerM', () => {
    expect(uprightWidthM('poteau', 2)).toBeCloseTo(3.8 / pxPerM(2), 12);
    expect(uprightWidthM('jambage', 2)).toBeCloseTo(3.6 / pxPerM(2), 12);
    expect(uprightWidthM('pillar', 2)).toBeCloseTo(5 / pxPerM(2), 12);
  });

  it('un montant produit 4 triangles (2 quads croisés) centrés sur le segment', () => {
    const tris = crossQuadTris({ x: 10, y: 4, z: 6 }, { x: 10, y: 0, z: 6 }, 0.4);
    expect(tris).toHaveLength(4);
    const xs = tris.flat().map((p) => p.x);
    const zs = tris.flat().map((p) => p.z);
    expect(Math.min(...xs)).toBeCloseTo(9.8, 12);
    expect(Math.max(...xs)).toBeCloseTo(10.2, 12);
    expect(Math.min(...zs)).toBeCloseTo(5.8, 12);
    expect(Math.max(...zs)).toBeCloseTo(6.2, 12);
  });

  it('les faces à 2 points des builders passent par les quads croisés, jamais par l’éventail', () => {
    const face: Face = {
      poly: [{ x: 1, y: 1, h: 4 }, { x: 1, y: 1, h: 0 }],
      material: { domain: 'structure', id: 'mur-en-bois', part: 'poteau' },
    };
    const [geom] = facesGeometry([face], 2);
    expect(geom.tris).toHaveLength(4);
    expect(geom.normal).toBeNull();
  });
});

describe('BIAIS COPLANAIRE — l’ordre de peinture affine devient une séparation métrique', () => {
  it('3 faces empilées dans un même plan reçoivent les rangs 0/1/2', () => {
    const quad = (h: number): WorldPoly => [
      { x: 0, y: h, z: 0 },
      { x: 2, y: h, z: 0 },
      { x: 2, y: h - 2, z: 0 },
      { x: 0, y: h - 2, z: 0 },
    ];
    const polys = [quad(4), quad(3), quad(2.5)];
    expect(coplanarRanks(polys)).toEqual([0, 1, 2]);
  });

  it('un rang N déplace la face de N × 1.5 mm le long de SA normale', () => {
    const poly: WorldPoly = [
      { x: 0, y: 2, z: 0 },
      { x: 1, y: 2, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
    ];
    expect(COPLANAR_BIAS_M).toBe(0.0015);
    const n = polyNormal(poly)!;
    const moved = biasPoly(poly, 2);
    expect(Math.abs(moved[0].z - poly[0].z)).toBeCloseTo(0.003, 12);
    expect(moved[0].z).toBeCloseTo(poly[0].z + 2 * COPLANAR_BIAS_M * n.z, 12);
    expect(biasPoly(poly, 0)).toBe(poly);
  });

  it('deux faces d’un même plan qui ne se RECOUVRENT pas ne sont pas comptées (sols voisins)', () => {
    const tile = (x: number): WorldPoly => [
      { x, y: 0, z: 0 },
      { x: x + 2, y: 0, z: 0 },
      { x: x + 2, y: 0, z: 2 },
      { x, y: 0, z: 2 },
    ];
    expect(coplanarOverlapPairs([tile(0), tile(2)])).toHaveLength(0);
    expect(coplanarOverlapPairs([tile(0), tile(1)])).toHaveLength(1);
  });

  const scenes: [string, Scene][] = [
    ['siege-enceinte', siege],
    ['arene (hub)', arene.scene],
  ];
  for (const [name, scene] of scenes)
    it(`${name} : des paires coplanaires recouvrantes AVANT biais, zéro APRÈS (montants COMPRIS)`, () => {
      const mpt = sceneMetresPerTile(scene);
      const quads = facesOf(scene).flatMap((f) => faceQuads(f, mpt));
      const ranks = coplanarRanks(quads);
      const biased = quads.map((p, i) => biasPoly(p, ranks[i]));
      expect(coplanarOverlapPairs(quads).length).toBeGreaterThan(0);
      expect(coplanarOverlapPairs(biased)).toEqual([]);
    });

  it('arène : les quads de MONTANT entrent dans le rang (poteaux/jambages/piliers)', () => {
    const mpt = sceneMetresPerTile(arene.scene);
    const faces = facesOf(arene.scene);
    const quads: WorldPoly[] = [];
    const montant: boolean[] = [];
    for (const f of faces)
      for (const q of faceQuads(f, mpt)) {
        quads.push(q);
        montant.push(f.poly.length === 2);
      }
    expect(montant.filter(Boolean).length).toBeGreaterThan(0);
    const pairs = coplanarOverlapPairs(quads);
    const mm = pairs.filter(([a, b]) => montant[a] && montant[b]).length;
    const mf = pairs.filter(([a, b]) => montant[a] !== montant[b]).length;
    expect({ montantMontant: mm > 0, montantFace: mf > 0 }).toEqual({ montantMontant: true, montantFace: true });
    const ranks = coplanarRanks(quads);
    expect(ranks.some((r, i) => r > 0 && montant[i])).toBe(true);
  });

  it('facesGeometry biaise AUSSI les quads d’un montant (même liste de rangs que faceQuads)', () => {
    const mpt = sceneMetresPerTile(arene.scene);
    const faces = facesOf(arene.scene);
    const geoms = facesGeometry(faces, mpt);
    const iMontant = faces.findIndex((f, i) => f.poly.length === 2 && geoms[i].rank > 0);
    expect(iMontant).toBeGreaterThanOrEqual(0);
    // les sommets rendus ne sont plus ceux des quads NUS : le biais les a déplacés.
    const nus = faceQuads(faces[iMontant], mpt).flatMap(fanTriangles);
    const rendus = geoms[iMontant].tris;
    expect(rendus).toHaveLength(nus.length);
    expect(rendus).not.toEqual(nus);
  });
});

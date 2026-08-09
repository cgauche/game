import { describe, expect, it } from 'vitest';
import {
  COPLANAR_BIAS_M,
  biasPoly,
  coplanarOverlapPairs,
  coplanarRanks,
  crossQuadTris,
  facePoly,
  faceQuads,
  faceQuadsOriented,
  facesGeometry,
  faceUv1,
  faceUvFrame,
  planarFrame,
  planarUV,
  fanTriangles,
  gpToWorld,
  isConvex,
  planarity,
  polyBounds,
  polyNormal,
  pxPerM,
  uprightCrossWidthM,
  uprightOverhangM,
  uprightWidthM,
  wallBoxPolys,
  wallThicknessM,
  type Bounds,
  type Vec3,
  type WorldPoly,
} from './worldTris';
import { buildFloors } from '../../builders/floors';
import { buildWalls } from '../../builders/walls';
import { buildRoofs } from '../../builders/roofs';
import { buildScene } from '../../../state/mapSpec';
import { spec as siegeSpec } from '../../../scenes/test-scenarios/siege-enceinte';
import { scenario as arene } from '../../../scenes/test-scenarios/arene';
import { buildOperaFloorplan } from '../../../scenes/opera/floorplan';
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

  it('la croix DÉPASSE les joues du mur : largeur = max(largeur écran, épaisseur de mur) + 2 saillies', () => {
    expect(uprightOverhangM(2)).toBeCloseTo(1 / pxPerM(2), 12);
    expect(uprightOverhangM(2)).toBeGreaterThan(0.03);
    expect(uprightOverhangM(2)).toBeLessThan(0.05);
    for (const part of ['poteau', 'jambage', 'pillar'])
      expect(uprightCrossWidthM(part, 2)).toBeCloseTo(
        Math.max(uprightWidthM(part, 2), wallThicknessM(2)) + 2 * uprightOverhangM(2),
        12,
      );
    expect(uprightCrossWidthM('poteau', 2)).toBeGreaterThan(wallThicknessM(2));
  });

  it('arène : AUCUN montant n’est entièrement noyé dans la matière des murs', () => {
    const mpt = sceneMetresPerTile(arene.scene);
    const faces = facesOf(arene.scene);
    // Matière = les BOÎTES des faces de mur pleines (5 quads : 2 joues + coiffe + 2 chants).
    const boites: Bounds[] = [];
    for (const f of faces) {
      const { quads, oriented } = faceQuadsOriented(f, mpt);
      if (oriented && quads.length === 5) boites.push(polyBounds(quads.flat()));
    }
    expect(boites.length).toBeGreaterThan(100);
    const dedans = (p: Vec3) =>
      boites.some(
        (b) =>
          p.x >= b.lo.x - 1e-9 && p.x <= b.hi.x + 1e-9 &&
          p.y >= b.lo.y - 1e-9 && p.y <= b.hi.y + 1e-9 &&
          p.z >= b.lo.z - 1e-9 && p.z <= b.hi.z + 1e-9,
      );
    let montants = 0;
    let noyesEntiers = 0;
    for (const f of faces) {
      if (f.poly.length !== 2) continue;
      montants++;
      const pts = faceQuads(f, mpt).flat();
      if (pts.every((p) => dedans(p))) noyesEntiers++;
    }
    expect(montants).toBeGreaterThan(300);
    expect(noyesEntiers).toBe(0);
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

describe('ÉPAISSEUR de mur — un plan d’épaisseur nulle n’a AUCUNE surface à 90° de plongée', () => {
  /** Aire (m²) d'un triangle. */
  const aire = ([a, b, c]: [Vec3, Vec3, Vec3]) => {
    const u = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
    const v = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z };
    return Math.hypot(u.y * v.z - u.z * v.y, u.z * v.x - u.x * v.z, u.x * v.y - u.y * v.x) / 2;
  };
  /** Aire PROJETÉE au sol (ce que la caméra top voit) d'un triangle. */
  const aireVueDuDessus = (t: [Vec3, Vec3, Vec3]) => {
    const n = polyNormal(t);
    return n ? aire(t) * Math.abs(n.y) : 0;
  };

  const murVertical: WorldPoly = [
    { x: 0, y: 4, z: 6 },
    { x: 2, y: 4, z: 6 },
    { x: 2, y: 0, z: 6 },
    { x: 0, y: 0, z: 6 },
  ];

  it('l’épaisseur MONDE est celle du poteau qui encadre le mur (3.8 px d’écran affine)', () => {
    expect(wallThicknessM(2)).toBeCloseTo(uprightWidthM('poteau', 2), 12);
    expect(wallThicknessM(2)).toBeGreaterThan(0.15);
    expect(wallThicknessM(2)).toBeLessThan(0.2);
  });

  it('un quad de mur devient une boîte : 2 joues + coiffe + 2 chants, AUCUN dessous', () => {
    const box = wallBoxPolys(murVertical, polyNormal(murVertical)!, 0.2);
    expect(box).toHaveLength(5);
    const zs = box.flat().map((p) => p.z);
    expect(Math.min(...zs)).toBeCloseTo(5.9, 12);
    expect(Math.max(...zs)).toBeCloseTo(6.1, 12);
    // La COIFFE : le seul quad horizontal, au sommet ; aucun quad au point bas (dessous omis).
    const horizontaux = box.filter((q) => Math.abs(polyNormal(q)!.y) > 0.99);
    expect(horizontaux).toHaveLength(1);
    expect(horizontaux[0].every((p) => p.y === 4)).toBe(true);
    // Chaque quad regarde le DEHORS de la boîte (le biais coplanaire pousse hors de la matière).
    const mid = { x: 1, y: 2, z: 6 };
    for (const q of box) {
      const n = polyNormal(q)!;
      const g = q.reduce((s, p) => ({ x: s.x + p.x / q.length, y: s.y + p.y / q.length, z: s.z + p.z / q.length }), { x: 0, y: 0, z: 0 });
      expect(n.x * (g.x - mid.x) + n.y * (g.y - mid.y) + n.z * (g.z - mid.z)).toBeGreaterThan(0);
    }
  });

  it('une face DÉCORATIVE de mur reste coplanaire à la joue de SON côté (une copie par joue)', () => {
    const deco: Face = {
      poly: [{ x: 1, y: 0, h: 3 }, { x: 2, y: 0, h: 3 }, { x: 2, y: 0, h: 1 }, { x: 1, y: 0, h: 1 }],
      material: { domain: 'structure', id: 'mur-en-bois', part: 'panneau' },
    };
    const t = wallThicknessM(2);
    const quads = faceQuads(deco, 2);
    expect(quads).toHaveLength(2);
    const zs = quads.map((q) => q[0].z).sort((a, b) => a - b);
    expect(zs[1] - zs[0]).toBeCloseTo(t, 12);
    // Les deux copies regardent chacune vers l'EXTÉRIEUR de la boîte (normales opposées).
    expect(polyNormal(quads[0])!.z).toBeCloseTo(-polyNormal(quads[1])!.z, 12);
  });

  const parScene: [string, Scene][] = [
    ['siege-enceinte', siege],
    ['arene (hub)', arene.scene],
  ];
  for (const [name, scene] of parScene)
    it(`${name} : les murs offrent une surface NON NULLE vue du dessus (coiffes)`, () => {
      const mpt = sceneMetresPerTile(scene);
      const faces = buildWalls(scene).flatMap((el) => el.faces);
      const tris = facesGeometry(faces, mpt).flatMap((g) => g.tris);
      const vueDuDessus = tris.reduce((s, t) => s + aireVueDuDessus(t), 0);
      const coiffes = tris.filter((t) => Math.abs(polyNormal(t)?.y ?? 0) > 0.99).length;
      expect(coiffes).toBeGreaterThan(0);
      expect(vueDuDessus).toBeGreaterThan(1); // m² — 2 aplats vides sur la planche `*-top-*` sinon
    });
});

describe('CONVERSION des murs — la géométrie rendue est celle que `buildWalls` a émise', () => {
  // L'opéra dresse 983 segments (aucun diagonal : son ovale est un ESCALIER de segments N/E). La garde
  // mesure que la conversion n'en PERD ni n'en DÉPLACE aucun — l'aspect « dalles disjointes » de la
  // planche `opera-iso-rot2-unlit.png` se joue en amont, dans le plan authoré.
  const opera = buildOperaFloorplan();

  it('opéra : chaque face de mur émise produit des triangles, tous DANS l’emprise de la scène', () => {
    const mpt = sceneMetresPerTile(opera);
    const faces = buildWalls(opera).flatMap((el) => el.faces);
    expect(faces.length).toBeGreaterThan(1000);
    const geoms = facesGeometry(faces, mpt);
    expect(geoms.filter((g) => g.tris.length === 0)).toEqual([]);
    // Emprise MÉTRIQUE de la grille authorée (case 0 → case n−1), à 1 cm près : une tolérance d'une CASE
    // laissait 2 m de jeu, de quoi loger un mur entier hors de la carte sans que la garde bronche.
    const TOL_M = 0.01;
    const hors = geoms
      .flatMap((g) => g.tris.flat())
      .filter(
        (p) =>
          p.x < -TOL_M ||
          p.x > (opera.dimensions.w - 1) * mpt + TOL_M ||
          p.z < -TOL_M ||
          p.z > (opera.dimensions.h - 1) * mpt + TOL_M,
      );
    expect(hors).toEqual([]);
  });
});

describe('UV — la maille MONDE en mètres (attribut `uv`)', () => {
  /** Distance entre deux UV. */
  const dUV = (a: { u: number; v: number }, b: { u: number; v: number }) => Math.hypot(a.u - b.u, a.v - b.v);
  /** Distance monde entre deux sommets. */
  const d3 = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

  /** Un quad par ORIENTATION, en mètres : sol horizontal, mur vertical, pan de toit incliné. */
  const HORIZONTAL: WorldPoly = [
    { x: 0, y: 0, z: 0 },
    { x: 4, y: 0, z: 0 },
    { x: 4, y: 0, z: 3 },
    { x: 0, y: 0, z: 3 },
  ];
  const VERTICAL: WorldPoly = [
    { x: 1, y: 5, z: 2 },
    { x: 6, y: 5, z: 2 },
    { x: 6, y: 1, z: 2 },
    { x: 1, y: 1, z: 2 },
  ];
  const INCLINE: WorldPoly = [
    { x: 0, y: 3, z: 0 },
    { x: 4, y: 3, z: 0 },
    { x: 4, y: 0, z: 3 },
    { x: 0, y: 0, z: 3 },
  ];

  it.each([
    ['horizontal (sol)', HORIZONTAL],
    ['vertical (mur)', VERTICAL],
    ['incliné (pan de toit)', INCLINE],
  ])('%s : l’UV mesure les MÈTRES du quad (isométrie — chaque arête garde sa longueur)', (_libellé, poly) => {
    const f = planarFrame(polyNormal(poly));
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      expect(dUV(planarUV(a, f), planarUV(b, f))).toBeCloseTo(d3(a, b), 9);
    }
    // Les diagonales aussi : une isométrie n'est pas qu'une conservation des bords.
    expect(dUV(planarUV(poly[0], f), planarUV(poly[2], f))).toBeCloseTo(d3(poly[0], poly[2]), 9);
  });

  it('quad vertical : u court à l’horizontale, v DESCEND (v croît quand y baisse)', () => {
    const f = planarFrame(polyNormal(VERTICAL));
    expect(f.eu.y).toBeCloseTo(0, 12);
    const haut = planarUV({ x: 1, y: 5, z: 2 }, f);
    const bas = planarUV({ x: 1, y: 1, z: 2 }, f);
    expect(bas.v - haut.v).toBeCloseTo(4, 9);
  });

  it('sol : la maille est ancrée au MONDE — deux dalles voisines se raccordent sans couture', () => {
    const f = planarFrame(polyNormal(HORIZONTAL));
    // Le sommet partagé par deux dalles adjacentes reçoit la MÊME UV, quel que soit le quad qui le porte.
    expect(planarUV({ x: 4, y: 0, z: 3 }, f)).toEqual(planarUV({ x: 4, y: 0, z: 3 }, planarFrame(polyNormal(HORIZONTAL))));
    // …et une dalle décalée d'un mètre voit son UV décalée d'exactement un mètre (jamais remise à 0).
    expect(planarUV({ x: 5, y: 0, z: 3 }, f).u - planarUV({ x: 4, y: 0, z: 3 }, f).u).toBeCloseTo(1, 12);
  });

  it('le biais coplanaire (déplacement le long de la NORMALE) ne bouge aucune UV', () => {
    const f = planarFrame(polyNormal(VERTICAL));
    const biaisé = biasPoly(VERTICAL, 7);
    for (let i = 0; i < VERTICAL.length; i++) {
      expect(planarUV(biaisé[i], f).u).toBeCloseTo(planarUV(VERTICAL[i], f).u, 9);
      expect(planarUV(biaisé[i], f).v).toBeCloseTo(planarUV(VERTICAL[i], f).v, 9);
    }
  });

  it('scène réelle (siege-enceinte) : chaque triangle porte 3 UV monde, à l’échelle métrique de SON quad', () => {
    const mpt = sceneMetresPerTile(siege);
    const geoms = facesGeometry(facesOf(siege), mpt);
    expect(geoms.length).toBeGreaterThan(100);
    let pires = 0;
    for (const g of geoms) {
      expect(g.uv.length).toBe(g.tris.length);
      g.tris.forEach((tri, t) => {
        for (let i = 0; i < 3; i++) {
          const j = (i + 1) % 3;
          const écart = Math.abs(dUV(g.uv[t][i], g.uv[t][j]) - d3(tri[i], tri[j]));
          if (écart > 1e-6) pires++;
        }
      });
    }
    expect(pires).toBe(0);
  });
});

describe('UV1 — la FACE d’origine en [0,1]² (attribut `uv1`)', () => {
  it('une face pleine : ses 4 coins prennent les 4 coins de [0,1]², v=0 en HAUT', () => {
    const poly: WorldPoly = [
      { x: 1, y: 5, z: 2 },
      { x: 6, y: 5, z: 2 },
      { x: 6, y: 1, z: 2 },
      { x: 1, y: 1, z: 2 },
    ];
    const fr = faceUvFrame(poly);
    const coins = poly.map((p) => faceUv1(p, fr));
    expect(coins.map((c) => Math.round(c.v))).toEqual([0, 0, 1, 1]);
    expect(new Set(coins.map((c) => `${Math.round(c.u)},${Math.round(c.v)}`)).size).toBe(4);
  });

  it('scène réelle : TOUTES les uv1 sont bornées [0,1] (montants et chants de boîte compris)', () => {
    for (const [, scène] of [
      ['siege', siege],
      ['arene', arene.scene],
    ] as [string, Scene][]) {
      const geoms = facesGeometry(facesOf(scène), sceneMetresPerTile(scène));
      const hors = geoms.flatMap((g) => g.uv1.flat()).filter((c) => c.u < 0 || c.u > 1 || c.v < 0 || c.v > 1);
      expect(hors).toEqual([]);
    }
  });

  it('scène réelle : uv1 EXPLOITE la face (elle n’est pas un aplat de zéros)', () => {
    const geoms = facesGeometry(facesOf(siege), sceneMetresPerTile(siege));
    const toutes = geoms.flatMap((g) => g.uv1.flat());
    expect(toutes.length).toBeGreaterThan(100);
    expect(toutes.filter((c) => c.u > 0.99).length).toBeGreaterThan(50);
    expect(toutes.filter((c) => c.v > 0.99).length).toBeGreaterThan(50);
  });

  it('les DEUX joues d’un mur plein partagent leurs uv1 : le même ornement des deux côtés', () => {
    const mpt = sceneMetresPerTile(siege);
    // Une part DÉCORATIVE de mur (panneau, moulure…) : le pivot en fait une copie par JOUE.
    const face = facesOf(siege).find((f) => {
      const q = faceQuadsOriented(f, mpt);
      return q.oriented && q.quads.length === 2;
    });
    expect(face).toBeDefined();
    const fr = faceUvFrame(facePoly(face!, mpt));
    const [avant, arrière] = faceQuadsOriented(face!, mpt).quads;
    const uvA = avant.map((p) => faceUv1(p, fr));
    const uvB = arrière.map((p) => faceUv1(p, fr));
    // Mêmes 4 coins de part et d'autre (l'ordre de parcours d'une joue est inversé).
    const clé = (c: { u: number; v: number }) => `${c.u.toFixed(6)},${c.v.toFixed(6)}`;
    expect(new Set(uvA.map(clé))).toEqual(new Set(uvB.map(clé)));
  });
});

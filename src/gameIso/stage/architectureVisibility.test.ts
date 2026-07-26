import { describe, expect, it } from 'vitest';
import { cutawayForSection, exteriorWallViewZ, frontFacadeCutaway, type ClearedSpace } from './architectureVisibility';
import { buildRoofs, clearedSpace } from '../builders/roofs';
import { buildWalls } from '../builders/walls';
import { diligenceCampaign } from '../../scenes/campaign';
import { sceneZoneTiles } from '../../state/zones';

/** Un allié dans une PIÈCE : la pièce dégagée, et les cases qu'elle couvre. */
const piece = (id: string, cells: string[]): ClearedSpace =>
  ({ zoneIds: new Set([id]), zoneCells: new Map([[id, new Set(cells)]]), roomlessCells: new Set() });
/** Un allié sous un bâti SANS pièce déclarée : l'emprise du bâtiment qui l'abrite. */
const emprise = (cells: string[]): ClearedSpace =>
  ({ zoneIds: new Set(), zoneCells: new Map(), roomlessCells: new Set(cells) });

describe('cutawayForSection', () => {
  it('masque une section dont la PIÈCE est occupée', () => {
    expect(cutawayForSection({ roomZoneIds: ['salle'], cells: ['3,3,0'] }, piece('salle', ['3,3,0']))).toBe('hidden');
    expect(cutawayForSection({ roomZoneIds: ['cuisine'], cells: ['3,3,0'] }, piece('salle', ['3,3,0']))).toBe('visible');
  });

  it('masque une section SANS pièce dont l’EMPRISE est dégagée — le bâti pas encore zoné suit la même loi', () => {
    expect(cutawayForSection({ cells: ['3,3,0'] }, emprise(['3,3,0']))).toBe('hidden');
    expect(cutawayForSection({ cells: ['9,9,0'] }, emprise(['3,3,0']))).toBe('visible');
  });
});

describe('exteriorWallViewZ', () => {
  it('rend toute l’élévation depuis l’extérieur et revient à l’étage actif dans une pièce', () => {
    expect(exteriorWallViewZ(0, false, [0, 1])).toBe(1);
    expect(exteriorWallViewZ(0, true, [0, 1])).toBe(0);
    expect(exteriorWallViewZ(1, false, [0, 1])).toBe(1);
  });
});

describe('frontFacadeCutaway', () => {
  const panel = { roomZoneIds: ['salle'], x: 3, y: 3, z: 0, side: 'E' as const };

  it.each([
    ['N', '3,3,0', [false, false, true, true]],
    ['N', '3,2,0', [true, true, false, false]],
    ['E', '3,3,0', [true, false, false, true]],
    ['E', '4,3,0', [false, true, true, false]],
  ] as const)('dérive les deux normales de %s depuis la pièce', (side, tile, expected) => {
    for (const rot of [0, 1, 2, 3] as const)
      expect(frontFacadeCutaway({ ...panel, side }, piece('salle', [tile]), { w: 8, h: 8, rot })).toBe(expected[rot]);
  });

  it.each([
    ['N', '3,3,0', [false, false, true, true]],
    ['E', '3,3,0', [true, false, false, true]],
  ] as const)('tombe pareil sur %s quand le dedans est une EMPRISE sans pièce', (side, tile, expected) => {
    for (const rot of [0, 1, 2, 3] as const)
      expect(frontFacadeCutaway({ x: 3, y: 3, z: 0, side }, emprise([tile]), { w: 8, h: 8, rot })).toBe(expected[rot]);
  });

  it('garde une façade non liée entière même si elle est frontale', () => {
    expect(frontFacadeCutaway({ ...panel, roomZoneIds: ['cuisine'] }, piece('salle', ['3,3,0']), { w: 8, h: 8, rot: 0 })).toBe(false);
  });

  it('refuse une arête diagonale non authorable', () => {
    expect(frontFacadeCutaway({ ...panel, side: '\\' }, piece('salle', ['3,3,0']), { w: 8, h: 8, rot: 0 })).toBe(false);
  });
});

/** La MÊME loi pour les toits et pour les façades — mesuré sur la carte authorée « La Diligence », où
 *  119 des 959 cases couvertes par une masse n'appartiennent encore à aucune pièce. Le repli d'emprise
 *  qui lève les toits doit lever les façades du même geste : un bâtiment décoiffé mais emmuré est la
 *  signature de deux lois divergentes. */
describe('dégagement — une seule loi pour toits et façades (La Diligence)', () => {
  const scene = diligenceCampaign.scenes[0];
  const dims = { w: scene.dimensions.w, h: scene.dimensions.h, rot: 0 } as const;
  const cut = (allies: { x: number; y: number; z: number }[]) => {
    const cleared = clearedSpace(scene, allies);
    const z = allies[0].z;
    const pans = buildRoofs(scene, { allies }).filter((el) => el.states.roofOccupied);
    const facades = buildWalls(scene, undefined, { activeZ: z, viewZ: z })
      .filter((panel) => frontFacadeCutaway({ ...panel, x: panel.cell.x, y: panel.cell.y, z: panel.cell.z }, cleared, dims));
    return { cleared, pans, facades, cases: new Set(pans.flatMap((el) => el.cells.map((c) => `${c.x},${c.y}`))) };
  };

  it('sous un bâti non zoné, la façade frontale tombe avec la toiture', () => {
    const { pans, facades } = cut([{ x: 29, y: 7, z: 1 }]);
    expect(pans.length).toBeGreaterThan(0);
    expect(facades.length).toBeGreaterThan(0);
  });

  it('sur une case couverte non zonée, les deux lectures s’accordent : ce que le toit dégage, le mur le voit dedans', () => {
    const { cleared, pans } = cut([{ x: 13, y: 6, z: 1 }]);
    expect(pans.length).toBeGreaterThan(0);
    for (const el of pans)
      for (const cell of el.cells)
        expect(cutawayForSection({ cells: [`${cell.x},${cell.y},1`] }, cleared)).toBe('hidden');
  });

  it('entrer dans la Salle principale ouvre l’espace ENTIER de la pièce', () => {
    const zone = (scene.effectZones ?? []).find((z) => z.id === 'zone-S-z0')!;
    const { cases } = cut([{ x: 10, y: 7, z: 0 }]);
    expect(cases.size).toBe(222);
    for (const tile of sceneZoneTiles(zone)) expect(cases.has(`${tile.x},${tile.y}`)).toBe(true);
  });
});

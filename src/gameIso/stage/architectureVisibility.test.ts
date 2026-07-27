import { describe, expect, it } from 'vitest';
import { cutawayForSection, exteriorWallViewZ, frontFacadeCutaway, type ClearedSpace } from './architectureVisibility';
import { buildRoofs, clearedSpace, massFootprintCells, massRoomZoneIds } from '../builders/roofs';
import { effectiveArchitecture } from '../../state/sceneEdit';
import { emptyScene, type BuildingMass, type Scene, type WallSeg } from '../../state/scene';
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

/** Le dégagement se lit par UNE loi partagée : ce que le toit lève, le mur le voit dedans, et la
 *  façade frontale tombe du même geste — un bâtiment décoiffé mais emmuré est la signature de deux
 *  lois divergentes. Ce que l'ESPACE dégagé contient (pièce déclarée, ou emprise d'un bâti pas encore
 *  zoné) est la seule entrée de la loi. */
const cut = (scene: Scene, allies: { x: number; y: number; z: number }[]) => {
  const cleared = clearedSpace(scene, allies);
  const z = allies[0].z;
  const dims = { w: scene.dimensions.w, h: scene.dimensions.h, rot: 0 } as const;
  const pans = buildRoofs(scene, { allies }).filter((el) => el.states.roofOccupied);
  const facades = buildWalls(scene, undefined, { activeZ: z, viewZ: z })
    .filter((panel) => frontFacadeCutaway({ ...panel, x: panel.cell.x, y: panel.cell.y, z: panel.cell.z }, cleared, dims));
  return { cleared, pans, facades, cases: new Set(pans.flatMap((el) => el.cells.map((c) => `${c.x},${c.y}`))) };
};

describe('dégagement — une seule loi pour toits et façades, sur un bâti SANS pièce déclarée', () => {
  /** Un bâti non zoné PAR CONSTRUCTION : une masse de toit, sa ceinture de murs, aucune pièce. La
   *  condition que la loi exige se bâtit ici — une carte d'auteur est une donnée vivante, elle a le
   *  droit de zoner tout son bâti du jour au lendemain. */
  const hangarSansPiece = (): Scene => {
    const scene = emptyScene(12, 12);
    const emprise = { x: 3, y: 3, w: 4, h: 4 };
    const masse: BuildingMass = {
      id: 'toit-hangar', z: 0, footprint: [emprise], levels: 1, profile: 'gable', ridge: 'x', pitchDeg: 45, material: 'tuile',
    };
    scene.architecture = [{ id: 'hangar', label: 'Hangar', style: 'maison', storeys: [], facades: [], masses: [masse] }];
    const murs: WallSeg[] = [];
    for (let x = emprise.x; x < emprise.x + emprise.w; x++) {
      murs.push({ x, y: emprise.y, side: 'N' }); // arête nord de l'emprise
      murs.push({ x, y: emprise.y + emprise.h, side: 'N' }); // arête sud (au nord de la case d'après)
    }
    for (let y = emprise.y; y < emprise.y + emprise.h; y++) {
      murs.push({ x: emprise.x - 1, y, side: 'E' }); // arête ouest (à l'est de la case d'avant)
      murs.push({ x: emprise.x + emprise.w - 1, y, side: 'E' }); // arête est
    }
    scene.walls = murs;
    return scene;
  };
  const dedans = { x: 4, y: 4, z: 0 };

  it('l’allié sans pièce dégage l’EMPRISE qui l’abrite', () => {
    const { cleared } = cut(hangarSansPiece(), [dedans]);
    expect(cleared.roomlessCells.has(`${dedans.x},${dedans.y},${dedans.z}`)).toBe(true);
  });

  it('sous un bâti non zoné, la façade frontale tombe avec la toiture', () => {
    const { pans, facades } = cut(hangarSansPiece(), [dedans]);
    expect(pans.length).toBeGreaterThan(0);
    expect(facades.length).toBeGreaterThan(0);
  });

  it('sur une case couverte non zonée, les deux lectures s’accordent : ce que le toit dégage, le mur le voit dedans', () => {
    const { cleared, pans } = cut(hangarSansPiece(), [dedans]);
    expect(pans.length).toBeGreaterThan(0);
    for (const el of pans)
      for (const cell of el.cells)
        expect(cutawayForSection({ cells: [`${cell.x},${cell.y},${dedans.z}`] }, cleared)).toBe('hidden');
  });
});

/** La carte authorée « La Diligence » est une donnée VIVANTE : on n'y mesure que des RELATIONS —
 *  aucun compte ni aucune pièce nommée en dur, tout se re-dérive de la carte à la lecture. */
describe('dégagement — chemin réel (La Diligence)', () => {
  const scene = diligenceCampaign.scenes[0];
  const masses = effectiveArchitecture(scene)
    .flatMap((corps) => corps.masses.map((masse) => ({ masse, cells: massFootprintCells(masse.footprint) })));
  const travees = (pieceId: string) =>
    masses.filter(({ masse, cells }) => massRoomZoneIds(scene, masse, cells).includes(pieceId));

  it('entrer dans une pièce ouvre l’espace ENTIER de la pièce, pas la travée où l’on pose le pied', () => {
    // La pièce que le plus de travées de charpente traversent : c'est là que la confusion « travée
    // piétinée » vs « espace habité » se voit. Le découpage en travées est une vérité de SILHOUETTE.
    const pieces = (scene.effectZones ?? []).filter((zone) => zone.presentation === 'interior');
    const [piece] = [...pieces].sort((a, b) => travees(b.id).length - travees(a.id).length);
    const couverture = new Set(travees(piece.id).flatMap(({ cells }) => [...cells]));
    const [tuile] = sceneZoneTiles(piece);
    const { cases } = cut(scene, [{ x: tuile.x, y: tuile.y, z: tuile.z ?? piece.z ?? 0 }]);
    const couvertes = sceneZoneTiles(piece).filter((t) => couverture.has(`${t.x},${t.y}`));
    expect(couvertes.length).toBeGreaterThan(0);
    for (const tile of couvertes) expect(cases.has(`${tile.x},${tile.y}`)).toBe(true);
  });
});

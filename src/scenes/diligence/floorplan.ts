import type { ArchitectureBody, RoofSection, Scene } from '../../state/scene';
import type { Edge4 } from '../../state/sceneEdit';
import { buildScene, type MapSpec } from '../../state/mapSpec';
import {
  DILIGENCE_Z0_ASCII,
  DILIGENCE_Z0_ZONES,
  DILIGENCE_Z1_ASCII,
  DILIGENCE_Z1_ZONES,
} from './floorplan.ascii';

export const DILIGENCE_SIZE = [32, 34] as const;

export const DILIGENCE_LABELS = [
  'Portier',
  'Cour',
  'Salle principale',
  'Écuries & remise',
  'Forge',
  'Réserves',
  'Brasserie',
  'Salle commune',
  'Chambre',
  'Quartier des serviteurs',
  'Patrouilleurs routiers',
  'Cuisine',
  'Cellier',
  'Salon privé',
  'Passage couvert',
  'Couloir',
  'Chambres individuelles',
  'Jardin potager',
  'Balcons',
  'Salles de réunion',
  'Chambre de Gustav',
  'Galerie',
] as const;

export const DILIGENCE_OPENINGS = {
  z0: { doors: 32, windows: 33 },
  z1: { doors: 25, windows: 26 },
} as const;

export const DILIGENCE_ZONE_MULTIPLICITIES = {
  Cour: 2,
  'Écuries & remise': 2,
  Réserves: 3,
  Chambre: 3,
  'Quartier des serviteurs': 2,
  'Patrouilleurs routiers': 2,
  Cellier: 2,
  'Chambres individuelles': 5,
  Balcons: 2,
  'Salles de réunion': 2,
} as const;

export const DILIGENCE_WITNESSES: readonly {
  x: number;
  y: number;
  side: Edge4;
  z: number;
  state: 'wall' | 'door';
}[] = [
  { x: 12, y: 1, side: 'N', z: 0, state: 'wall' },
  { x: 17, y: 1, side: 'N', z: 0, state: 'door' },
  { x: 5, y: 2, side: 'O', z: 0, state: 'wall' },
  { x: 8, y: 1, side: 'N', z: 0, state: 'wall' },
  { x: 14, y: 9, side: 'N', z: 1, state: 'door' },
  { x: 12, y: 7, side: 'N', z: 1, state: 'wall' },
] as const;

const ZONE_LEGEND: NonNullable<MapSpec['zoneLegend']> = {
  A: { label: 'Portier', presentation: 'interior' },
  C: { label: 'Cour', presentation: 'exterior' },
  Z: { label: 'Cour', presentation: 'exterior' },
  S: { label: 'Salle principale', presentation: 'interior' },
  E: { label: 'Écuries & remise', presentation: 'interior' },
  e: { label: 'Écuries & remise', presentation: 'interior' },
  F: { label: 'Forge', presentation: 'interior' },
  R: { label: 'Réserves', presentation: 'interior' },
  r: { label: 'Réserves', presentation: 'interior' },
  B: { label: 'Brasserie', presentation: 'interior' },
  U: { label: 'Salle commune', presentation: 'interior' },
  H: { label: 'Chambre', presentation: 'interior' },
  I: { label: 'Chambre', presentation: 'interior' },
  j: { label: 'Chambre', presentation: 'interior' },
  D: { label: 'Quartier des serviteurs', presentation: 'interior' },
  d: { label: 'Quartier des serviteurs', presentation: 'interior' },
  T: { label: 'Patrouilleurs routiers', presentation: 'interior' },
  t: { label: 'Patrouilleurs routiers', presentation: 'interior' },
  K: { label: 'Cuisine', presentation: 'interior' },
  L: { label: 'Cellier', presentation: 'interior' },
  l: { label: 'Cellier', presentation: 'interior' },
  P: { label: 'Salon privé', presentation: 'interior' },
  V: { label: 'Passage couvert', presentation: 'interior' },
  O: { label: 'Couloir', presentation: 'interior' },
  Q: { label: 'Chambres individuelles', presentation: 'interior' },
  q: { label: 'Chambres individuelles', presentation: 'interior' },
  a: { label: 'Chambres individuelles', presentation: 'interior' },
  b: { label: 'Chambres individuelles', presentation: 'interior' },
  c: { label: 'Chambres individuelles', presentation: 'interior' },
  J: { label: 'Jardin potager', presentation: 'exterior' },
  N: { label: 'Balcons', presentation: 'exterior' },
  n: { label: 'Balcons', presentation: 'exterior' },
  G: { label: 'Salles de réunion', presentation: 'interior' },
  g: { label: 'Salles de réunion', presentation: 'interior' },
  Y: { label: 'Chambre de Gustav', presentation: 'interior' },
  X: { label: 'Galerie', presentation: 'interior' },
};

const roofSection = (
  id: string,
  z: number,
  parts: RoofSection['parts'],
  ridge: RoofSection['ridge'],
  roomZoneIds: string[],
): RoofSection => ({
  id,
  z,
  parts,
  profile: 'gable',
  ridge,
  eaveHeightM: z === 0 ? 4 : 8,
  pitch: 0.75,
  material: 'tuile',
  roomZoneIds,
});

const DILIGENCE_ROOF_SECTIONS: RoofSection[] = [
  roofSection('diligence-portier', 0, [{ x: 5, y: 1, w: 4, h: 5 }], 'y', [
    'zone-A-z0',
  ]),
  roofSection('diligence-aile-ouest', 1, [
    { x: 5, y: 7, w: 10, h: 17 },
    { x: 5, y: 24, w: 3, h: 1 },
    { x: 8, y: 24, w: 3, h: 2 },
    { x: 14, y: 24, w: 1, h: 2 },
  ], 'y', [
    'zone-K-z0', 'zone-S-z0', 'zone-L-z0', 'zone-P-z0', 'zone-V-z0',
    'zone-Y-z1', 'zone-Q-z1', 'zone-l-z1', 'zone-r-z1', 'zone-X-z1',
    'zone-g-z1', 'zone-q-z1', 'zone-G-z1',
  ]),
  roofSection('diligence-passage-central', 1, [
    { x: 15, y: 6, w: 4, h: 16 },
    { x: 19, y: 7, w: 1, h: 6 },
    { x: 19, y: 15, w: 1, h: 7 },
  ], 'y', [
    'zone-S-z0', 'zone-V-z0',
    'zone-G-z1', 'zone-X-z1', 'zone-g-z1', 'zone-O-z1',
  ]),
  roofSection('diligence-aile-est', 1, [
    { x: 20, y: 6, w: 9, h: 14 },
    { x: 21, y: 20, w: 8, h: 2 },
    { x: 22, y: 22, w: 7, h: 2 },
    { x: 24, y: 24, w: 5, h: 2 },
  ], 'y', [
    'zone-R-z0', 'zone-U-z0', 'zone-H-z0', 'zone-I-z0', 'zone-j-z0', 'zone-B-z0',
    'zone-T-z1', 'zone-t-z1', 'zone-D-z1', 'zone-d-z1', 'zone-O-z1',
    'zone-a-z1', 'zone-b-z1', 'zone-c-z1',
  ]),
  roofSection('diligence-dependances-sud', 0, [
    { x: 5, y: 26, w: 24, h: 4 },
    { x: 9, y: 30, w: 15, h: 3 },
  ], 'x', [
    'zone-F-z0', 'zone-E-z0', 'zone-e-z0', 'zone-B-z0', 'zone-r-z0',
  ]),
];

const DILIGENCE_ARCHITECTURE: ArchitectureBody[] = [{
  id: 'diligence',
  label: 'La Diligence',
  style: 'maison',
  storeys: [0, 1].map((z) => ({
    id: `diligence-z${z}`,
    z,
    parts: DILIGENCE_ROOF_SECTIONS
      .filter((section) => section.z === z)
      .flatMap((section) => section.parts.map((part, index) => ({
        id: `${section.id}-volume-${index + 1}`,
        foot: { ...part },
      }))),
    // Une toiture COUVRE parfois des zones à un étage inférieur au sien (revealBelow, cutaway) —
    // mais l'étage lui-même (`storey.roomZoneIds`, validé STRICT : zone du MÊME étage uniquement,
    // cf. validateScene.ts) ne doit retenir que SES zones propres, jamais celles héritées d'une
    // toiture qui plonge plus bas. Filtre par le suffixe `-z${z}` (convention `mapSpec.ts:796`).
    roomZoneIds: [...new Set(
      DILIGENCE_ROOF_SECTIONS
        .filter((section) => section.z === z)
        .flatMap((section) => section.roomZoneIds)
        .filter((id) => id.endsWith(`-z${z}`)),
    )],
  })),
  facades: [],
  roofs: DILIGENCE_ROOF_SECTIONS,
}];

export const DILIGENCE_FLOORPLAN_SPEC: MapSpec = {
  id: 'la-diligence',
  nom: 'La Diligence',
  size: [DILIGENCE_SIZE[0], DILIGENCE_SIZE[1]],
  metresPerTile: 2,
  ambiance: 'exterieur',
  terrain: 'herbe',
  legend: {
    g: 'herbe',
    P: 'plancher',
    C: 'pave',
    J: 'terre',
  },
  walled: {
    z0: DILIGENCE_Z0_ASCII,
    z1: DILIGENCE_Z1_ASCII,
  },
  wallStructures: {
    '-': 'mur-a-ossature-en-bois',
    '|': 'mur-a-ossature-en-bois',
    o: 'mur-a-ossature-en-bois',
    '=': 'mur-en-pierre',
    '!': 'mur-en-pierre',
  },
  cells: {
    E: { terrain: 'plancher', stair: { to: 'z1', style: 'escalier-bois' } },
    W: { terrain: 'plancher', stair: { to: 'z1', style: 'escalier-bois' } },
  },
  relief: [{ rect: [0, 0, DILIGENCE_SIZE[0] - 1, DILIGENCE_SIZE[1] - 1], height: 4, z: 1 }],
  heroStart: [17, 2],
  zoneMap: {
    z0: DILIGENCE_Z0_ZONES,
    z1: DILIGENCE_Z1_ZONES,
  },
  zoneLegend: ZONE_LEGEND,
  architecture: DILIGENCE_ARCHITECTURE,
};

export function buildDiligenceFloorplan(): Scene {
  return buildScene(DILIGENCE_FLOORPLAN_SPEC);
}

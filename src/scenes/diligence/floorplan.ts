import type { ArchitectureBody, BuildingMass, Scene } from '../../state/scene';
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

// AUCUNE masse authorée à la main (#829, corrige #823/#822) : l'emprise de toiture se DÉRIVE du
// plancher réel par `deriveArchitectureMasses` (`state/mapSpec.ts`) — éditer un mur/une pièce dans
// l'éditeur fait suivre la toiture sans repasser ici. `DILIGENCE_MASSES` reste le point d'insertion des
// SURCHARGES (passage couvert à profil forcé, cour à ne pas coiffer via `roofExclusions`…) le jour où
// la dérivation par défaut s'y tromperait — aucune à ce jour sur ce plan.
const DILIGENCE_MASSES: BuildingMass[] = [];

const DILIGENCE_ARCHITECTURE: ArchitectureBody[] = [{
  id: 'diligence',
  label: 'La Diligence',
  style: 'maison',
  storeys: [0, 1].map((z) => ({ id: `diligence-z${z}`, z, parts: [], roomZoneIds: [] })),
  facades: [],
  masses: DILIGENCE_MASSES,
}];

// #825ter — 5 cases d'étage mesurées SANS appui (herbe nue au rez) : défaut de plan réel, pas une
// dérivation ratée. Signalé à l'orchestrateur pour le lot de correction du plan ; tolérées ICI par
// leurs coordonnées NOMMÉES (jamais un contournement silencieux) le temps que ce lot les corrige.
const DILIGENCE_UNSUPPORTED_FLOOR: { x: number; y: number; z: number }[] = [
  { x: 5, y: 24, z: 1 },
  { x: 6, y: 24, z: 1 },
  { x: 7, y: 24, z: 1 },
  { x: 8, y: 24, z: 1 },
  { x: 8, y: 25, z: 1 },
];

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
  knownUnsupportedFloor: DILIGENCE_UNSUPPORTED_FLOOR,
};

export function buildDiligenceFloorplan(): Scene {
  return buildScene(DILIGENCE_FLOORPLAN_SPEC);
}

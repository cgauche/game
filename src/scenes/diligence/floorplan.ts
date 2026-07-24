import type { Scene } from '../../state/scene';
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
  A: { label: 'Portier' },
  C: { label: 'Cour' },
  Z: { label: 'Cour' },
  S: { label: 'Salle principale' },
  E: { label: 'Écuries & remise' },
  e: { label: 'Écuries & remise' },
  F: { label: 'Forge' },
  R: { label: 'Réserves' },
  r: { label: 'Réserves' },
  B: { label: 'Brasserie' },
  U: { label: 'Salle commune' },
  H: { label: 'Chambre' },
  I: { label: 'Chambre' },
  j: { label: 'Chambre' },
  D: { label: 'Quartier des serviteurs' },
  d: { label: 'Quartier des serviteurs' },
  T: { label: 'Patrouilleurs routiers' },
  t: { label: 'Patrouilleurs routiers' },
  K: { label: 'Cuisine' },
  L: { label: 'Cellier' },
  l: { label: 'Cellier' },
  P: { label: 'Salon privé' },
  V: { label: 'Passage couvert' },
  O: { label: 'Couloir' },
  Q: { label: 'Chambres individuelles' },
  q: { label: 'Chambres individuelles' },
  a: { label: 'Chambres individuelles' },
  b: { label: 'Chambres individuelles' },
  c: { label: 'Chambres individuelles' },
  J: { label: 'Jardin potager' },
  N: { label: 'Balcons' },
  n: { label: 'Balcons' },
  G: { label: 'Salles de réunion' },
  g: { label: 'Salles de réunion' },
  Y: { label: 'Chambre de Gustav' },
  X: { label: 'Galerie' },
};

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
};

export function buildDiligenceFloorplan(): Scene {
  return buildScene(DILIGENCE_FLOORPLAN_SPEC);
}

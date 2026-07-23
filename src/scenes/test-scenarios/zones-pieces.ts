import { makeShowcaseParty } from '../../data/pregens';
import { buildScene } from '../../state/mapSpec';
import type { WallSpec } from '../../state/mapSpec';
import type { TestScenario } from './_shared';

/**
 * « Étiquettes de zone » — VITRINE de l'étiquette CUITE de pièce (#782) : un petit bâtiment `rooms`
 * (périmètre + toit + porte, `addBuilding`) cloisonné en 4 pièces par des murs d'arête intérieurs
 * (`walls`, portes de circulation), nommées via `zoneMap`/`zoneLegend`. Le toit se lève en cutaway
 * dès qu'un allié entre dans l'empreinte (`roofHidden`) → les 4 noms de pièce, peints au centre de
 * leur aire, se révèlent (`buildZoneLabels`). Démo AUSSI consommée par le harnais de recette (#778).
 */
const FOOT: [number, number, number, number] = [1, 1, 8, 6]; // x,y,w,h — cases x1..8, y1..6

// Partitions intérieures : mur vertical (x=4|5, y1..6, porte y=2) + mur horizontal (y3|4, x1..8,
// portes x=2 et x=6) — 4 pièces mutuellement reliées, entrée (porte ouest) débouchant dans la Cave.
const INTERIOR_WALLS: WallSpec[] = [
  ...Array.from({ length: 6 }, (_, i) => 1 + i).map((y) => ({ x: 4, y, side: 'E' as const, door: y === 2 })),
  ...Array.from({ length: 8 }, (_, i) => 1 + i).map((x) => ({ x, y: 3, side: 'S' as const, door: x === 2 || x === 6 })),
];

const scene = buildScene({
  id: 'zones-pieces',
  nom: 'Étiquettes de zone',
  description:
    'Une maisonnette à 4 pièces cloisonnées (Cave, Chambre, Cuisine, Salle commune) sous un même toit. ' +
    "Entrez : le toit se lève en cutaway et le nom de chaque pièce s'affiche, cuit au centre de son aire.",
  size: [10, 9],
  terrain: 'herbe',
  ambiance: 'exterieur',
  heroStart: [0, 3],
  startMessage: 'Une masure aux volets clos. La porte ouest est entrebâillée.',
  rooms: [{ foot: FOOT, style: 'maison', door: { x: 1, y: 3, side: 'O' }, floor: 'plancher', label: 'Masure', id: 'toit-masure' }],
  walls: INTERIOR_WALLS,
  zoneMap: {
    z0: [
      '..........',
      '.AAAABBBB.',
      '.AAAABBBB.',
      '.AAAABBBB.',
      '.CCCCDDDD.',
      '.CCCCDDDD.',
      '.CCCCDDDD.',
      '..........',
      '..........',
    ].join('\n'),
  },
  zoneLegend: {
    A: { label: 'Cave' },
    B: { label: 'Chambre' },
    C: { label: 'Cuisine' },
    D: { label: 'Salle commune' },
  },
});

export const scenario: TestScenario = {
  id: 'zones-pieces',
  order: 55,
  category: 'rendu',
  icon: 'scenario/village',
  title: 'Étiquettes de zone',
  tests:
    "Étiquette CUITE au centre d'une zone descriptive (#782, `zoneMap`/`zoneLegend`) : 4 pièces cloisonnées " +
    "(murs d'arête + portes) sous un toit unique — révélation en cutaway (toit levé dès qu'un allié entre " +
    "dans l'empreinte), un nom par pièce, jamais au survol.",
  partyNote: 'Groupe vitrine (Soldat / Tueur / Sorcier / Chasseur) — promenade libre, aucun combat.',
  makeParty: makeShowcaseParty,
  scene,
};

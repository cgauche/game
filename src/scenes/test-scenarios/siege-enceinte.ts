import { pregen, PREGEN } from '../../data/pregens';
import { parseLevels } from '../../state/asciiMap';
import { itemFromTrappingById } from '../../engine/items';
import type { Scene, SceneEntity } from '../../state/scene';
import { setEncounters, type TestScenario } from './_shared';

/**
 * SIÈGE VERTICAL — défendre la muraille. Démontre le combat z-aware (Lot 0) : des défenseurs sur le
 * CHEMIN DE RONDE (z=1, par-dessus le mur d'enceinte) pilonnent les assaillants au SOL (z=0), qui ne
 * peuvent pas les frapper en mêlée à travers le vide vertical et doivent forcer la HERSE destructible.
 *
 * Carte ASCII multi-niveaux (1 grille/étage, `parseLevels`) :
 *  - z=0 : champ (Nord, les assaillants), mur d'enceinte (`mur`) percé d'une herse, cour (Sud, le groupe).
 *  - z=1 : chemin de ronde (`plancher`) sur le mur, relié à la cour par un escalier (marqueur `X` → `Scene.stairs` auto).
 */
const Z0 = [
  '..............', // 0  champ (assaillants)
  '..............', // 1
  '..............', // 2
  '..............', // 3
  '######.#######', // 4  MUR D'ENCEINTE — herse (case ouverte) à x=6
  '..X...........', // 5  escalier (2,5) montant au chemin de ronde
  '..............', // 6  cour intérieure
  '..............', // 7
  '..............', // 8
  '..............', // 9  (départ du groupe)
  '..............', // 10
  '..............', // 11
];
const Z1 = [
  '..............', // 0
  '..............', // 1
  '..............', // 2
  '..............', // 3
  'PPPPPPPPPPPPPP', // 4  CHEMIN DE RONDE (plancher) — par-dessus le mur, passerelle au-dessus de la herse
  '..X...........', // 5  palier de l'escalier, relie le chemin de ronde au sol
  '..............', // 6
  '..............', // 7
  '..............', // 8
  '..............', // 9
  '..............', // 10
  '..............', // 11
];

const map = parseLevels(
  [{ z: 0, rows: Z0, base: 'sol' }, { z: 1, rows: Z1, base: 'vide' }],
  { legend: { '#': 'mur', P: 'plancher' }, stair: 'X', stairBase: 'plancher' },
);

const baliste = itemFromTrappingById('baliste')!; // Arme d'équipe sur le rempart, servie par un défenseur

const entities: SceneEntity[] = [
  { id: 'start', kind: 'heroStart', pos: { x: 6, y: 9 } }, // cour intérieure
  // Emplacement de baliste sur le chemin de ronde (z=1) : un héros monté au rempart le SERT et tire en contrebas.
  { id: 'baliste-rempart', kind: 'personnage', pos: { x: 9, y: 4 }, z: 1, label: 'Baliste de rempart', postes: [{ item: baliste, crewIds: [] }] },
];

const scene: Scene = {
  id: 'siege-enceinte',
  nom: 'Siège — défendre la muraille',
  description: "Un mur d'enceinte percé d'une herse, un chemin de ronde sur le rempart, une cour ; les assaillants forcent la herse pendant que les défenseurs les pilonnent d'en haut.",
  dimensions: { w: map.w, h: map.h },
  ambiance: 'exterieur',
  ambientLight: 'jour', // plein jour : on voit le champ et les assaillants qui approchent (un siège n'est pas une embuscade de nuit)
  levels: map.levels,
  stairs: map.stairs,
  // HERSE destructible sur l'arête Nord de la case ouverte (6,4) : bloque le passage champ→cour tant
  // qu'elle tient (M2). Les assaillants la forcent ; les défenseurs tirent par-dessus le parapet (cross-z).
  walls: [{ x: 6, y: 4, side: 'N', structure: 'porte-de-ville' }],
  entities,
  dialogues: [],
  triggers: [],
  flags: {},
  encounters: [], // posées par setEncounters ci-dessous (expanse les ennemis en entités + members)
  startMessage:
    "Défendez la muraille : montez au CHEMIN DE RONDE (escalier en 2,5), servez la baliste et pilonnez les " +
    "assaillants en contrebas. Ils ne peuvent pas vous atteindre en mêlée tant qu'ils n'ont pas forcé la herse.",
};

// Assaillants au SOL (z=0) — `setEncounters` les expanse en entités + `members` canoniques (lus par startCombat).
setEncounters(scene, [
  {
    id: 'assaut',
    enemies: [
      { ref: 'gobelin', pos: { x: 3, y: 1 } }, // à pilonner depuis le rempart
      { ref: 'gobelin', pos: { x: 10, y: 1 } },
      { ref: 'brigand', pos: { x: 6, y: 2 } }, // devant la herse
    ],
  },
]);

export const scenario: TestScenario = {
  id: 'siege-enceinte',
  order: 41,
  category: '⚔️ Combat',
  icon: '🏰',
  title: 'Siège — défendre la muraille',
  tests:
    'Combat VERTICAL (z-aware) : défenseurs sur le chemin de ronde (z=1) qui voient/tirent les assaillants au ' +
    'sol (z=0) ; mêlée à travers le vide refusée ; escalier d’accès ; herse destructible ; emplacement de baliste sur le rempart.',
  partyNote: 'Groupe pré-tiré : monter au rempart par l’escalier, servir la baliste, tirer vers le bas.',
  makeParty: () => [pregen(PREGEN.soldat), pregen(PREGEN.tueur), pregen(PREGEN.sorcier)],
  scene,
};

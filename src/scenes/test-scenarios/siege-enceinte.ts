import { pregenParty, PREGEN } from '../../data/pregens';
import { parseLevels } from '../../state/asciiMap';
import { itemFromTrappingById } from '../../engine/items';
import type { Scene, SceneEntity, WallSeg, EncounterMember, CustomStatblock } from '../../state/scene';
import type { ShipPoste } from '../../engine/types';
import { setEncounters, type TestScenario } from './_shared';

/**
 * SIÈGE COMPLET — défendre la muraille. UN seul scénario qui exerce toute la chaîne de siège :
 *  - un MUR D'ENCEINTE en arêtes-structure HAUTES (`mur-en-pierre`, `height:1` → monte au chemin de ronde
 *    z=1), percé d'une grande HERSE destructible (`porte-de-ville`, `height:1`) ;
 *  - un CHEMIN DE RONDE (z=1) sur le dessus du mur, relié à la cour par 2 escaliers (marqueurs `X` auto) ;
 *  - 2 EMPLACEMENTS de siège servis sur le rempart (baliste + canon de siège), `crewIds` vide → un héros
 *    monté au chemin de ronde les SERT (« Servir cette pièce ») et pilonne les assaillants en contrebas ;
 *  - 6 ASSAILLANTS dans le champ au Nord (z=0), dont un CANONNIER servant un canon de siège (Atout Siège)
 *    qui force la herse `porte-de-ville` (Impénétrable) ;
 *  - un GUETTEUR posté sur la passerelle JUSTE au-dessus de la herse : quand elle tombe, la passerelle
 *    s'effondre et il CHUTE (Lot B `collapseStructure` / `parapetTilesAbove`).
 *
 * Carte ASCII multi-niveaux (1 grille / étage, `parseLevels`) ; les arêtes-structure et les emplacements
 * z=1 sont posés à la main (un mur d'enceinte = des `WallSeg`, pas une tuile de terrain).
 */

// z=0 : champ au Nord (rangées 0-3, les assaillants), cour intérieure au Sud (départ du groupe en 6,9).
//        Escaliers `X` en (1,4) et (12,4), juste sous le rempart.
const Z0 = [
  '..............', // 0  champ (assaillants)
  '..............', // 1
  '..............', // 2  (canonnier de siège)
  '..............', // 3
  '.X..........X.', // 4  cour : pied des 2 escaliers (1,4) et (12,4)
  '..............', // 5  cour intérieure
  '..............', // 6
  '..............', // 7
  '..............', // 8
  '..............', // 9  (départ du groupe)
  '..............', // 10
  '..............', // 11
];
// z=1 : CHEMIN DE RONDE (`plancher`) sur le dessus du mur (rangée 4), paliers d'escalier `X` aux extrémités.
const Z1 = [
  '..............', // 0
  '..............', // 1
  '..............', // 2
  '..............', // 3
  'PXPPPPPPPPPPXP', // 4  chemin de ronde (par-dessus le mur d'enceinte), escaliers en (1,4) et (12,4)
  '..............', // 5
  '..............', // 6
  '..............', // 7
  '..............', // 8
  '..............', // 9
  '..............', // 10
  '..............', // 11
];

const map = parseLevels(
  [{ z: 0, rows: Z0, base: 'herbe' }, { z: 1, rows: Z1, base: 'vide' }],
  { legend: { P: 'plancher' }, stair: 'X', stairBase: 'plancher' },
);

// MUR D'ENCEINTE — arête Nord de la rangée 4, HAUTE (`height:1` → monte pile au chemin de ronde z=1).
// 13 segments de `mur-en-pierre` (Impénétrable) + une grande HERSE de 2 cases (`porte-de-ville`) en (6,7).
const ENCEINTE_ROW = 4;
const HERSE = new Set([6, 7]);
const walls: WallSeg[] = [];
for (let x = 0; x < map.w; x++)
  walls.push({ x, y: ENCEINTE_ROW, side: 'N', height: 1, structure: HERSE.has(x) ? 'porte-de-ville' : 'mur-en-pierre' });

// EMPLACEMENTS de siège sur le rempart (z=1) : `crewIds` vide → un héros adjacent les SERT au combat.
const emplPoste = (trappingId: string): ShipPoste => ({ item: itemFromTrappingById(trappingId)!, crewIds: [] });
const affut = (name: string): CustomStatblock => ({ name, char: { B: 20 } }); // affût inerte, à servir
const guetteur: CustomStatblock = { name: 'Guetteur', char: { B: 11, CC: 35, CT: 40, F: 30, E: 35, Ag: 30 } };

// Alliés (côté héros) posés sur le chemin de ronde : 2 emplacements + le guetteur au-dessus de la herse.
const allies: SceneEntity[] = [
  { id: 'empl-baliste', kind: 'personnage', z: 1, pos: { x: 2, y: 4 }, facing: 'N', label: 'Baliste de rempart',
    statblock: affut('Baliste de rempart'), postes: [emplPoste('baliste')] },
  { id: 'empl-canon', kind: 'personnage', z: 1, pos: { x: 11, y: 4 }, facing: 'N', label: 'Canon de rempart',
    statblock: affut('Canon de rempart'), postes: [emplPoste('canon-petit')] }, // Atout Siège (peut brécher)
  // GUETTEUR sur la passerelle juste au-dessus de la herse (6,4) → chute quand `collapseStructure` l'effondre.
  { id: 'garde-passerelle', kind: 'personnage', z: 1, pos: { x: 6, y: 4 }, facing: 'N', label: 'Guetteur', statblock: guetteur },
];

const entities: SceneEntity[] = [
  { id: 'start', kind: 'heroStart', pos: { x: 6, y: 9 } }, // cour intérieure (z=0)
  ...allies,
];

const scene: Scene = {
  id: 'siege-enceinte',
  nom: 'Siège — défendre la muraille',
  description: "Un mur d'enceinte HAUT percé d'une grande herse, un chemin de ronde garni de pièces de siège, une cour ; les assaillants forcent la herse au canon pendant que les défenseurs les pilonnent d'en haut.",
  dimensions: { w: map.w, h: map.h },
  ambiance: 'exterieur',
  ambientLight: 'jour', // plein jour : on voit le champ et les assaillants approcher (un siège ≠ une embuscade de nuit)
  levels: map.levels,
  stairs: map.stairs,
  walls,
  entities,
  dialogues: [],
  triggers: [],
  flags: {},
  encounters: [], // posés par setEncounters ci-dessous (assaillants), + membres alliés ajoutés ensuite
  startMessage:
    "Défendez la muraille : montez au CHEMIN DE RONDE par un escalier (1,4 ou 12,4), SERVEZ la baliste ou le " +
    "canon de rempart et pilonnez les assaillants. Ils ne peuvent vous atteindre en mêlée tant qu'ils n'ont " +
    "pas forcé la herse au canon de siège — et qui se tient sur la passerelle quand elle cède chute en contrebas.",
};

// ASSAILLANTS au champ Nord (z=0) — `setEncounters` les expanse en entités 'personnage' + `members` canoniques.
// Le chef de pièce (index 4) porte un CANON DE SIÈGE servi au spawn (`applyShipPostes`, crewIds déterministes
// `enemy-assaut-<i>`) ; son Atout Siège perce la herse `porte-de-ville` (Impénétrable).
setEncounters(scene, [
  {
    id: 'assaut',
    enemies: [
      { ref: 'gobelin', pos: { x: 2, y: 0 } },
      { ref: 'gobelin', pos: { x: 11, y: 0 } },
      { ref: 'gobelin', pos: { x: 3, y: 3 } },
      { ref: 'gobelin', pos: { x: 10, y: 3 } },
      { ref: 'brigand', pos: { x: 6, y: 2 }, facing: 'S', label: 'Canonnier de siège',
        postes: [{ item: itemFromTrappingById('canon-petit')!, crewIds: ['enemy-assaut-4', 'enemy-assaut-5'] }] },
      { ref: 'brigand', pos: { x: 7, y: 2 }, facing: 'S' }, // 2ᵉ servant du canon (équipage complet, Indice 2)
    ],
  },
]);

// Emplacements + guetteur = membres ALLIÉS de l'assaut (side:'ally' → côté héros ; n'entrent pas dans la fin
// de combat). Une SceneEntity à `postes`/`z` n'est enrôlée au combat QUE si un `EncounterMember` la référence
// (combatSlice : le roster se construit depuis `members`), d'où l'ajout explicite ici.
const allyMembers: EncounterMember[] = allies.map((e) => ({ entityId: e.id, side: 'ally' }));
scene.encounters[0].members!.push(...allyMembers);

export const scenario: TestScenario = {
  id: 'siege-enceinte',
  order: 41,
  category: '⚔️ Combat',
  icon: '🏰',
  title: 'Siège — défendre la muraille',
  tests:
    'Siège complet : mur d\'enceinte HAUT (height:1) + herse destructible + chemin de ronde z=1 + 2 escaliers ; ' +
    'emplacements de siège servis (baliste/canon, « Servir cette pièce ») ; combat VERTICAL (défenseurs z=1 ' +
    'pilonnent les assaillants z=0, mêlée refusée à travers le vide) ; canon de siège ennemi qui force la herse ' +
    '(Atout Siège vs Impénétrable) ; passerelle qui s\'effondre → le guetteur au-dessus de la herse chute.',
  partyNote: 'Groupe pré-tiré (Soldat / Chasseur / Sorcier / Tueur) : montez au rempart et servez les pièces.',
  makeParty: () => pregenParty(PREGEN.soldat, PREGEN.chasseur, PREGEN.sorcier, PREGEN.tueur),
  scene,
  autoCombat: 'assaut',
};

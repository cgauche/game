import { pregenParty, PREGEN } from '../../data/pregens';
import { parseLevels } from '../../state/asciiMap';
import { itemFromTrappingById } from '../../engine/items';
import type { Scene, SceneEntity, WallSeg, EncounterMember, CustomStatblock } from '../../state/scene';
import type { ShipPoste } from '../../engine/types';
import { setEncounters, type TestScenario } from './_shared';

/**
 * SIÈGE COMPLET — défendre la muraille. Carte LARGE (28×18) à 2 niveaux qui exerce toute la chaîne de siège :
 *  - un CHAMP D'APPROCHE au nord (herbe, y0-5) où les assaillants déploient un CANON DE SIÈGE braqué sur la PORTE ;
 *  - un MUR D'ENCEINTE de pierre (arêtes-structure HAUTES) percé d'un CORPS DE GARDE — une PORTE DE VILLE
 *    (rendue en porte : arche + herse) encadrée de deux TOURS (`height:2`) — et flanqué de TOURS d'angle ;
 *  - un CHEMIN DE RONDE (z=1) tout du long, garni de PIÈCES de siège SERVIES (baliste + canon) ; rejoint par
 *    deux ESCALIERS qui montent DEPUIS LA COUR (paliers z=1 en saillie, pas collés au mur) ;
 *  - une COUR pavée profonde au sud (y6-17) où démarre le groupe.
 * Combat VERTICAL : les défenseurs pilonnent les assaillants en contrebas, mêlée refusée à travers le vide ;
 * le canon ennemi force la PORTE (Atout Siège vs Impénétrable) → la passerelle au-dessus s'effondre, le
 * guetteur du corps de garde chute (Lot B `collapseStructure`/`parapetTilesAbove`).
 */

const W = 28;
// z=0 : CHAMP (herbe, y0-5) au nord ; mur sur l'arête N de y6 ; COUR pavée (y6-17) au sud (départ en 13,11).
const FIELD = '.'.repeat(W);
const COURT = 'P'.repeat(W);
const Z0 = [FIELD, FIELD, FIELD, FIELD, FIELD, FIELD, COURT, COURT, COURT, COURT, COURT, COURT, COURT, COURT, COURT, COURT, COURT, COURT];
// z=1 : CHEMIN DE RONDE (plancher) sur le mur (y6) + 2 PALIERS d'escalier en saillie DANS LA COUR (y7, x3/x24).
const WALK = 'W'.repeat(W);
const VOID = '.'.repeat(W);
const LAND = (() => { const a = '.'.repeat(W).split(''); a[3] = 'W'; a[24] = 'W'; return a.join(''); })();
const Z1 = [VOID, VOID, VOID, VOID, VOID, VOID, WALK, LAND, VOID, VOID, VOID, VOID, VOID, VOID, VOID, VOID, VOID, VOID];

const map = parseLevels(
  [{ z: 0, rows: Z0, base: 'herbe' }, { z: 1, rows: Z1, base: 'vide' }],
  { legend: { P: 'pave', W: 'plancher' } },
);

// MUR D'ENCEINTE — arête Nord de y6. CORPS DE GARDE au centre (PORTE x13-14 + TOURS de flanquement x11-12/15-16,
// `height:2`) ; TOURS d'angle (x0-1 / x26-27, `height:2`) ; COURTINE crénelée (`height:1`) entre les deux.
const WALL_ROW = 6;
const GATE = new Set([13, 14]);
const TOWER = new Set([0, 1, 11, 12, 15, 16, 26, 27]);
const walls: WallSeg[] = [];
for (let x = 0; x < W; x++)
  walls.push({
    x, y: WALL_ROW, side: 'N',
    structure: GATE.has(x) ? 'porte-de-ville' : 'mur-en-pierre',
    height: GATE.has(x) ? 1 : TOWER.has(x) ? 2 : 1,
  });

// ESCALIERS : volées DANS LA COUR (paliers z=1 en saillie (3,7)/(24,7)) qui montent au chemin de ronde — pas
// collées au mur. La volée grimpe depuis la case d'approche au sud (x,8) jusqu'au palier (x,7,z1).
const stairs = [
  { from: { x: 3, y: 7, z: 0 }, to: { x: 3, y: 7, z: 1 } },
  { from: { x: 24, y: 7, z: 0 }, to: { x: 24, y: 7, z: 1 } },
];

// PIÈCES de siège SERVIES (z=1, `crewIds` vide → un héros monté au chemin de ronde les SERT) + GUETTEUR.
const emplPoste = (trappingId: string): ShipPoste => ({ item: itemFromTrappingById(trappingId)!, crewIds: [] });
const affut = (name: string): CustomStatblock => ({ name, char: { B: 20 }, inert: true }); // affût INERTE servi : ciblable, sans réaction de combat ni tour (rendu = engin via appearance.species)
const guetteur: CustomStatblock = { name: 'Guetteur', char: { B: 11, CC: 35, CT: 40, F: 30, E: 35, Ag: 30 } };

const allies: SceneEntity[] = [
  { id: 'empl-baliste', kind: 'personnage', z: 1, pos: { x: 6, y: 6 }, facing: 'N', label: 'Baliste de rempart',
    appearance: { species: 'baliste' }, // rig : gabarit ENGIN (grande arbalète), pas un bipède
    statblock: affut('Baliste de rempart'), postes: [emplPoste('baliste')] },
  { id: 'empl-canon', kind: 'personnage', z: 1, pos: { x: 21, y: 6 }, facing: 'N', label: 'Canon de rempart',
    appearance: { species: 'canon-petit' }, // rig : gabarit ENGIN (tube sur affût à roues)
    statblock: affut('Canon de rempart'), postes: [emplPoste('canon-petit')] }, // Atout Siège (peut brécher)
  // GUETTEUR sur la passerelle du corps de garde, JUSTE au-dessus de la porte (13,6) → chute quand elle cède.
  { id: 'garde-porte', kind: 'personnage', z: 1, pos: { x: 13, y: 6 }, facing: 'N', label: 'Guetteur du corps de garde', statblock: guetteur },
];

const entities: SceneEntity[] = [
  { id: 'start', kind: 'heroStart', pos: { x: 13, y: 11 } }, // cour pavée (z=0)
  ...allies,
];

const scene: Scene = {
  id: 'siege-enceinte',
  nom: 'Siège — défendre la muraille',
  description: "Un mur d'enceinte de pierre à corps de garde, un chemin de ronde garni de pièces de siège, une cour pavée ; les assaillants braquent un canon de siège sur la porte pendant que les défenseurs les pilonnent d'en haut.",
  dimensions: { w: map.w, h: map.h },
  ambiance: 'exterieur',
  ambientLight: 'jour', // plein jour : on voit le champ et les assaillants approcher (un siège ≠ une embuscade de nuit)
  levels: map.levels,
  stairs,
  walls,
  entities,
  dialogues: [],
  triggers: [],
  flags: {},
  encounters: [], // posés par setEncounters ci-dessous (assaillants) + membres alliés ajoutés ensuite
  startMessage:
    "Défendez la muraille : gagnez le CHEMIN DE RONDE par un escalier de la cour (3,7 ou 24,7), SERVEZ la " +
    "baliste ou le canon de rempart et pilonnez les assaillants en contrebas. Ils ne peuvent vous atteindre " +
    "en mêlée tant qu'ils n'ont pas forcé la PORTE au canon de siège — et qui se tient sur la passerelle quand elle cède chute.",
};

// ASSAILLANTS au champ (z=0) — `setEncounters` les expanse en entités 'personnage' + `members` canoniques.
// Le CANONNIER (index 0) sert un CANON DE SIÈGE braqué sur la porte (équipage `enemy-assaut-0/1`) ; son Atout
// Siège perce la `porte-de-ville` (Impénétrable). Suivent 6 fantassins à l'assaut, étalés sur le champ large.
setEncounters(scene, [
  {
    id: 'assaut',
    enemies: [
      { ref: 'brigand', pos: { x: 13, y: 1 }, facing: 'S', label: 'Canonnier de siège',
        postes: [{ item: itemFromTrappingById('canon-petit')!, crewIds: ['enemy-assaut-0', 'enemy-assaut-1'] }] },
      { ref: 'brigand', pos: { x: 14, y: 1 }, facing: 'S' }, // 2ᵉ servant du canon (équipage complet, Indice 2)
      { ref: 'gobelin', pos: { x: 3, y: 3 } },
      { ref: 'gobelin', pos: { x: 8, y: 2 } },
      { ref: 'gobelin', pos: { x: 11, y: 4 } },
      { ref: 'gobelin', pos: { x: 17, y: 4 } },
      { ref: 'gobelin', pos: { x: 20, y: 2 } },
      { ref: 'gobelin', pos: { x: 25, y: 3 } },
    ],
  },
]);

// Emplacements + guetteur = membres ALLIÉS de l'assaut (side:'ally' → côté héros). Une SceneEntity à `postes`/`z`
// n'est enrôlée au combat QUE si un `EncounterMember` la référence (le roster se construit depuis `members`).
const allyMembers: EncounterMember[] = allies.map((e) => ({ entityId: e.id, side: 'ally' }));
scene.encounters[0].members!.push(...allyMembers);

export const scenario: TestScenario = {
  id: 'siege-enceinte',
  order: 41,
  category: '⚔️ Combat',
  icon: '🏰',
  title: 'Siège — défendre la muraille',
  tests:
    'Siège complet (carte large 28×18) : mur d\'enceinte de pierre + CORPS DE GARDE (porte rendue en porte + ' +
    'tours height:2) + tours d\'angle ; chemin de ronde z=1 ; 2 escaliers DANS LA COUR (paliers en saillie) ; ' +
    'pièces de siège servies (baliste/canon, « Servir cette pièce ») ; combat VERTICAL (défenseurs z=1 pilonnent ' +
    'les assaillants z=0, mêlée refusée à travers le vide) ; canon de siège ennemi qui force la porte (Atout Siège ' +
    'vs Impénétrable) ; passerelle qui s\'effondre → le guetteur au-dessus de la porte chute.',
  partyNote: 'Groupe pré-tiré (Soldat / Chasseur / Sorcier / Tueur) : montez au rempart par un escalier et servez les pièces.',
  makeParty: () => pregenParty(PREGEN.soldat, PREGEN.chasseur, PREGEN.sorcier, PREGEN.tueur),
  scene,
  autoCombat: 'assaut',
};

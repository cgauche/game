/**
 * SCÈNE DE TEST — « Du Sang sur la Route » (fidèle à `public/ambush.html`).
 *
 * Une diligence éventrée en travers d'une route forestière ; ses passagers gisent,
 * dépecés. Des MUTANTS de morphologies variées (charognard quadrupède, homme-chien
 * hurlant, bras-tentacule, reptilien) se repaissent des cadavres — composés par le rig
 * (parts monstrueuses) et animés en CSS (feed/howl/wrap…),
 * comme dans ambush.html. L'approche déclenche un DIALOGUE ; sa fin lance le COMBAT.
 * Le décor (épave, corps, sang) reste visible pendant le combat.
 *
 * Document au schéma `Scene` : entièrement reproductible dans l'éditeur (ref bestiaire +
 * variante d'apparence + animation d'ambiance + zone-trigger + dialogue + rencontre).
 */
import { Scene, Terrain, Dialogue } from '../state/scene';
import { flowFromEffects } from '../state/flow';
import { buildEncounter } from '../state/encounterAuthoring';

const W = 20;
const H = 14;

function build(): Scene {
  const tiles: Terrain[] = new Array(W * H).fill('herbe');
  const set = (x: number, y: number, t: Terrain) => {
    if (x >= 0 && y >= 0 && x < W && y < H) tiles[y * W + x] = t;
  };

  // Grand-route est-ouest (deux rangées) — l'unique trouée dans les bois.
  for (let x = 0; x < W; x++) {
    set(x, 6, 'route');
    set(x, 7, 'route');
  }
  // Forêt dense et oppressante qui enferme la route (nord + sud).
  for (let x = 0; x < W; x++) {
    set(x, 0, 'bois');
    set(x, 1, 'bois');
    set(x, 13, 'bois');
    set(x, 12, 'bois');
    if (x % 2 === 0) set(x, 2, 'bois');
    if (x % 3 === 0) set(x, 11, 'bois');
  }
  for (const [x, y] of [[4, 3], [9, 3], [14, 3], [18, 2], [3, 10], [8, 10], [13, 9], [18, 10]] as const) set(x, y, 'bois');

  const dialogues: Dialogue[] = [
    {
      id: 'dlg-ambush',
      start: 'a1',
      nodes: [
        {
          id: 'a1',
          text:
            "La forêt se referme sur la route. Plus loin, une diligence gît renversée, l'attelage " +
            "éventré, les bagages crevés et répandus dans la boue. Penchées sur les corps des voyageurs, " +
            "des silhouettes difformes s'en repaissent à pleines dents — l'une, à quatre pattes, fouille " +
            "un ventre ouvert ; une autre, museau dressé, hurle vers la canopée. Une gueule ensanglantée " +
            "se tourne lentement vers vous.",
          choices: [
            {
              text: 'Fondre sur les charognards avant qu’ils ne se ruent.',
              flow: flowFromEffects([
                { type: 'journal', text: "Vous chargez — l'acier contre la chair corrompue." },
                { type: 'endDialogue' },
                { type: 'startCombat', encounter: 'enc-mutants' },
              ]),
            },
            { text: 'Reculer sans bruit vers le couvert…', next: 'a2' },
          ],
        },
        {
          id: 'a2',
          text:
            'Une branche craque sous votre botte. Aussitôt les créatures relèvent la tête, naseaux ' +
            'frémissants — elles ont flairé le sang neuf. Elles abandonnent leur festin et bondissent ' +
            'vers vous en hurlant, gueules béantes.',
          choices: [
            {
              text: 'Au combat !',
              flow: flowFromEffects([
                { type: 'endDialogue' },
                { type: 'startCombat', encounter: 'enc-mutants' },
              ]),
            },
          ],
        },
      ],
    },
  ];

  // VISIBLE (plus de double calque) : les mutants qu'on voit se repaître SONT les combattants. L'entité
  // enrôlée porte TOUT — rig 'mutant' + mutation visible + arme + anim d'ambiance + statbloc ch.2. Le fix
  // embuscade les masque pendant le combat (leur combattant les rend) et les retire de la scène à la victoire.
  const enc = buildEncounter({
    id: 'enc-mutants',
    // Statblocs CUSTOM fidèles à L'ennemi dans l'Ombre ch.2 (stats VF vérifiées). `ref:'mutant'` = base rig
    // en exploration ; l'apparence (mutation) et l'anim d'ambiance sont séparées des stats.
    enemies: [
      {
        // Chef : reste en retrait, tire à l'arbalète (À distance dans le Trait — le Trait dérive déjà
        // l'arme de RENDU via `weaponFromTrapping`, plus de `weapon:` d'authoring redondant, #145).
        pos: { x: 17, y: 6 }, ref: 'mutant', appearance: { monster: { tete: 'lezard' } }, anim: 'standing',
        label: 'Knud Cratinx — chef à la peau écailleuse',
        statblock: {
          label: 'Knud Cratinx',
          char: { M: 4, 'capacite-de-combat': 36, 'capacite-de-tir': 43, force: 39, endurance: 32, initiative: 35, agilite: 33, dexterite: 29, intelligence: 33, 'force-mentale': 35, sociabilite: 30, B: 12 },
          traits: [{ id: 'a-distance', value: 9, arg: 'arbalete', range: 60 }, { id: 'arme', value: 7, arg: 'arme-simple' }, { id: 'corruption', arg: 'Mineure' }, { id: 'mutation', arg: 'ecailles-epineuses' }],
        },
      },
      {
        pos: { x: 16, y: 7 }, ref: 'mutant', appearance: { monster: { tete: 'chien' } }, anim: 'howl',
        label: 'Mikael — tête de chien, hurle à la mort',
        statblock: { label: 'Mikael', char: { M: 4, 'capacite-de-combat': 45, 'capacite-de-tir': 30, force: 35, endurance: 35, initiative: 30, agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30, B: 1 }, traits: [{ id: 'arme', value: 7 }, { id: 'corruption', arg: 'Mineure' }, { id: 'mutation', arg: 'tete-bestiale-chien' }] },
      },
      {
        pos: { x: 14, y: 8 }, ref: 'mutant', appearance: { monster: { jambes: 'chevre' } }, anim: 'feeding',
        label: 'Erik — pattes de chèvre, dévore un cadavre',
        statblock: { label: 'Erik', char: { M: 4, 'capacite-de-combat': 45, 'capacite-de-tir': 30, force: 35, endurance: 35, initiative: 30, agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30, B: 2 }, traits: [{ id: 'arme', value: 7 }, { id: 'corruption', arg: 'Mineure' }, { id: 'mutation', arg: 'pattes-chevre' }] },
      },
      {
        pos: { x: 15, y: 7 }, ref: 'mutant', appearance: { monster: { tete: 'ogive' } }, anim: 'standing',
        label: 'Johann — tête en ogive, panse Mikael',
        statblock: { label: 'Johann', char: { M: 4, 'capacite-de-combat': 45, 'capacite-de-tir': 30, force: 35, endurance: 35, initiative: 30, agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30, B: 4 }, traits: [{ id: 'arme', value: 7 }, { id: 'corruption', arg: 'Mineure' }, { id: 'mutation', arg: 'tete-pointue' }] },
      },
      {
        // « Mutile l'attelage à la hache » → arme dans le Trait (type Grande hache, libellé catalogué → shape).
        pos: { x: 12, y: 7 }, ref: 'mutant', appearance: { monster: { tete: 'minuscule' } }, anim: 'standing',
        label: 'Terenz — crétin, mutile l’attelage',
        statblock: { label: 'Terenz', char: { M: 4, 'capacite-de-combat': 45, 'capacite-de-tir': 30, force: 35, endurance: 35, initiative: 30, agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30, B: 3 }, traits: [{ id: 'arme', value: 7, arg: 'grande-hache' }, { id: 'corruption', arg: 'Mineure' }, { id: 'mutation', arg: 'cretin' }] },
      },
    ],
    onVictory: flowFromEffects([
      { type: 'setFlag', flag: 'embuscade_nettoyee' },
      { type: 'journal', text: 'La bande de Knud Cratinx gît à son tour. La route, enfin, se tait.' },
    ]),
  });

  return {
    id: 'ambush-test',
    nom: 'Du Sang sur la Route — scène de test',
    description:
      'Route forestière. Une diligence éventrée, ses passagers dépecés, des mutants de toutes ' +
      "formes qui s'en repaissent. L'approche déclenche un dialogue, dont la fin lance le combat.",
    dimensions: { w: W, h: H },
    ambiance: 'exterieur',
    layers: [{ z: 0, tiles }],
    startMessage:
      'Au détour des arbres, une diligence renversée, des corps éparpillés… et des formes difformes ' +
      'penchées dessus, qui se relèvent en grognant.',
    entities: [
      { id: 'start', kind: 'heroStart', pos: { x: 2, y: 7 } },
      // — Carnage : la diligence, l'attelage, les voyageurs, le sang —
      { id: 'epave', kind: 'prop', pos: { x: 15, y: 6 }, ref: 'epave-carrosse', label: 'Diligence éventrée' },
      { id: 'cheval', kind: 'prop', pos: { x: 12, y: 6 }, ref: 'cheval-mort', label: 'Attelage éventré' },
      { id: 'corps1', kind: 'prop', pos: { x: 11, y: 7 }, ref: 'cadavre', label: 'Voyageur dépecé' },
      { id: 'corps2', kind: 'prop', pos: { x: 14, y: 8 }, ref: 'cadavre', label: 'Voyageur dépecé' },
      { id: 'corps3', kind: 'prop', pos: { x: 17, y: 7 }, ref: 'cadavre', label: 'Voyageur dépecé' },
      { id: 'sang1', kind: 'prop', pos: { x: 13, y: 7 }, ref: 'mare-sang', anim: 'gush' },
      { id: 'sang2', kind: 'prop', pos: { x: 15, y: 7 }, ref: 'mare-sang', anim: 'gush' },
      { id: 'sang3', kind: 'prop', pos: { x: 16, y: 8 }, ref: 'mare-sang' },
      { id: 'sang4', kind: 'prop', pos: { x: 12, y: 8 }, ref: 'mare-sang' },
      // — La bande de Knud Cratinx (fidèle à « L'ennemi dans l'Ombre » ch.2) : entités VISIBLES enrôlées,
      //   portées par l'encounter (mutation visible + arme + anim + statbloc). Plus de calque ambiant séparé. —
      ...enc.entities,
    ],
    dialogues,
    triggers: [
      {
        id: 'approche',
        rect: { x: 8, y: 6, w: 3, h: 2 },
        once: true,
        flow: flowFromEffects([{ type: 'startDialogue', dialogue: 'dlg-ambush' }]),
      },
    ],
    encounters: [enc.encounter],
    flags: {},
  };
}

export const ambushTest: Scene = build();

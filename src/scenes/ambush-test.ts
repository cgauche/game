/**
 * SCÈNE DE TEST — « Du Sang sur la Route » (fidèle à `public/ambush.html`).
 *
 * Une diligence éventrée en travers d'une route forestière ; ses passagers gisent,
 * dépecés. Des MUTANTS de morphologies variées (charognard quadrupède, homme-chien
 * hurlant, bras-tentacule, reptilien) se repaissent des cadavres — modèles par CALQUES
 * (variantes choisies via `appearance.pins.forme`) et animés en CSS (feed/howl/wrap…),
 * comme dans ambush.html. L'approche déclenche un DIALOGUE ; sa fin lance le COMBAT.
 * Le décor (épave, corps, sang) reste visible pendant le combat.
 *
 * Document au schéma `Scene` : entièrement reproductible dans l'éditeur (ref bestiaire +
 * variante d'apparence + animation d'ambiance + zone-trigger + dialogue + rencontre).
 */
import { Scene, Terrain, Dialogue } from '../state/scene';

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
              effects: [
                { type: 'journal', text: "Vous chargez — l'acier contre la chair corrompue." },
                { type: 'endDialogue' },
                { type: 'startCombat', encounter: 'enc-mutants' },
              ],
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
              effects: [
                { type: 'endDialogue' },
                { type: 'startCombat', encounter: 'enc-mutants' },
              ],
            },
          ],
        },
      ],
    },
  ];

  return {
    id: 'ambush-test',
    nom: 'Du Sang sur la Route — scène de test',
    description:
      'Route forestière. Une diligence éventrée, ses passagers dépecés, des mutants de toutes ' +
      "formes qui s'en repaissent. L'approche déclenche un dialogue, dont la fin lance le combat.",
    dimensions: { w: W, h: H },
    ambiance: 'foret',
    tiles,
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
      // — Mutants HUMANOÏDES : riggés + parts monstrueux choisis par slot (tête/bras),
      //   comme on construit un PJ. L'arme est de l'ÉQUIPEMENT (le reptilien porte une
      //   arbalète, tenue prête). Aux MÊMES positions que l'encounter (raccord combat). —
      { id: 'mut-feed', kind: 'personnage', pos: { x: 13, y: 8 }, ref: 'Mutant', appearance: { monster: { brasD: 'griffe' } }, anim: 'feeding', label: 'Mutant qui dévore' },
      { id: 'mut-tentacule', kind: 'personnage', pos: { x: 14, y: 7 }, ref: 'Mutant', appearance: { monster: { brasG: 'tentacule' } }, anim: 'feeding', label: 'Mutant à tentacule' },
      { id: 'mut-chien', kind: 'personnage', pos: { x: 16, y: 7 }, ref: 'Mutant', appearance: { monster: { tete: 'chien' } }, anim: 'howl', label: 'Mutant à tête de chien' },
      { id: 'mut-lezard', kind: 'personnage', pos: { x: 18, y: 6 }, ref: 'Mutant', appearance: { monster: { tete: 'lezard', cornes: true } }, weapon: 'Arbalète', anim: 'standing', label: 'Mutant reptilien (arbalète)' },
      // — Charognard quadrupède : créature NON-bipède → sprite monolithique. —
      { id: 'charognard', kind: 'personnage', pos: { x: 11, y: 8 }, ref: 'Charognard', anim: 'feed', label: 'Charognard' },
    ],
    dialogues,
    triggers: [
      {
        id: 'approche',
        rect: { x: 8, y: 6, w: 3, h: 2 },
        once: true,
        effects: [{ type: 'startDialogue', dialogue: 'dlg-ambush' }],
      },
    ],
    encounters: [
      {
        id: 'enc-mutants',
        // Mêmes parts/équipement qu'en exploration → modèles identiques en combat.
        enemies: [
          { ref: 'Mutant', pos: { x: 13, y: 8 }, appearance: { monster: { brasD: 'griffe' } } },
          { ref: 'Mutant', pos: { x: 14, y: 7 }, appearance: { monster: { brasG: 'tentacule' } } },
          { ref: 'Mutant', pos: { x: 16, y: 7 }, appearance: { monster: { tete: 'chien' } } },
          { ref: 'Mutant', pos: { x: 18, y: 6 }, appearance: { monster: { tete: 'lezard', cornes: true } }, weapon: 'Arbalète' },
          { ref: 'Charognard', pos: { x: 11, y: 8 } },
        ],
        onVictory: [
          { type: 'setFlag', flag: 'embuscade_nettoyee' },
          { type: 'journal', text: 'Les charognards gisent à leur tour. La route, enfin, se tait.' },
        ],
      },
    ],
    flags: {},
  };
}

export const ambushTest: Scene = build();

/**
 * SCÈNE DE TEST — « L'Embuscade » (fidèle à `public/ambush.html`).
 *
 * Sur une route forestière, une diligence renversée : des MUTANTS dévorent les
 * cadavres, ANIMÉS avant tout combat (clip d'ambiance « feeding »). En entrant dans
 * la zone d'approche → un DIALOGUE se déclenche ; à la fin du dialogue → le COMBAT
 * démarre contre ces mêmes mutants (mêmes positions → transition transparente).
 *
 * Document au schéma `Scene` : ouvrable et modifiable dans l'éditeur de niveau.
 */
import { Scene, Terrain, Dialogue } from '../state/scene';

const W = 20;
const H = 14;

function build(): Scene {
  const tiles: Terrain[] = new Array(W * H).fill('herbe');
  const set = (x: number, y: number, t: Terrain) => {
    if (x >= 0 && y >= 0 && x < W && y < H) tiles[y * W + x] = t;
  };

  // Grand-route est-ouest (deux rangées) — le couloir d'embuscade.
  for (let x = 0; x < W; x++) {
    set(x, 6, 'route');
    set(x, 7, 'route');
  }
  // Lisière de forêt dense (bloquante) au nord et au sud : on est pris au piège.
  for (let x = 0; x < W; x++) {
    set(x, 0, 'bois');
    set(x, 13, 'bois');
    if (x % 2 === 0) set(x, 1, 'bois');
    if (x % 2 === 1) set(x, 12, 'bois');
  }
  for (const [x, y] of [[3, 3], [7, 2], [11, 3], [16, 2], [4, 10], [9, 11], [13, 10], [17, 11]] as const) set(x, y, 'bois');

  const dialogues: Dialogue[] = [
    {
      id: 'dlg-ambush',
      start: 'a1',
      nodes: [
        {
          id: 'a1',
          text:
            "La diligence gît renversée en travers de la route, un cheval éventré sous les brancards. " +
            "Des silhouettes difformes se penchent sur les cadavres et s'en repaissent en grognant. " +
            "L'une d'elles relève une gueule ensanglantée — et vous fixe.",
          choices: [
            {
              text: 'Dégainer et charger avant qu’elles ne réagissent.',
              effects: [
                { type: 'journal', text: 'Vous fondez sur les charognards.' },
                { type: 'endDialogue' },
                { type: 'startCombat', encounter: 'enc-mutants' },
              ],
            },
            { text: 'Reculer lentement vers le couvert…', next: 'a2' },
          ],
        },
        {
          id: 'a2',
          text:
            'Trop tard : les créatures ont flairé le sang frais. Elles abandonnent leur festin ' +
            'et bondissent vers vous en hurlant.',
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
    nom: "L'Embuscade — scène de test",
    description:
      "Route forestière. Une diligence renversée et des mutants qui dévorent les cadavres. " +
      "L'approche déclenche un dialogue, dont la fin lance le combat.",
    dimensions: { w: W, h: H },
    ambiance: 'foret',
    tiles,
    startMessage:
      'Au détour des arbres, une diligence renversée… et des formes difformes penchées sur les corps.',
    entities: [
      { id: 'start', kind: 'heroStart', pos: { x: 2, y: 7 } },
      // Décor d'embuscade (props repris d'ambush.html).
      { id: 'epave', kind: 'prop', pos: { x: 15, y: 6 }, ref: 'epave-carrosse', label: 'Diligence renversée' },
      { id: 'cheval', kind: 'prop', pos: { x: 13, y: 7 }, ref: 'cheval-mort', label: 'Cheval éventré' },
      { id: 'corps1', kind: 'prop', pos: { x: 14, y: 8 }, ref: 'cadavre', label: 'Cadavre' },
      { id: 'corps2', kind: 'prop', pos: { x: 16, y: 8 }, ref: 'cadavre', label: 'Cadavre' },
      { id: 'sang1', kind: 'prop', pos: { x: 15, y: 7 }, ref: 'mare-sang' },
      { id: 'sang2', kind: 'prop', pos: { x: 14, y: 6 }, ref: 'mare-sang' },
      // Mutants PRÉSENTS et ANIMÉS (dévorent) — mêmes positions que l'encounter pour
      // un raccord transparent quand le combat démarre.
      { id: 'mut1', kind: 'personnage', pos: { x: 14, y: 7 }, ref: 'Mutant', anim: 'feeding', label: 'Mutant charognard' },
      { id: 'mut2', kind: 'personnage', pos: { x: 16, y: 7 }, ref: 'Mutant', anim: 'feeding', label: 'Mutant charognard' },
      { id: 'mut3', kind: 'personnage', pos: { x: 15, y: 8 }, ref: 'Mutant', anim: 'feeding', label: 'Mutant charognard' },
    ],
    dialogues,
    triggers: [
      {
        id: 'approche',
        rect: { x: 9, y: 6, w: 3, h: 2 },
        once: true,
        effects: [{ type: 'startDialogue', dialogue: 'dlg-ambush' }],
      },
    ],
    encounters: [
      {
        id: 'enc-mutants',
        enemies: [
          { ref: 'Mutant', pos: { x: 14, y: 7 } },
          { ref: 'Mutant', pos: { x: 16, y: 7 } },
          { ref: 'Mutant', pos: { x: 15, y: 8 } },
        ],
        onVictory: [
          { type: 'setFlag', flag: 'embuscade_nettoyee' },
          { type: 'journal', text: 'Les charognards gisent. La route est de nouveau sûre.' },
        ],
      },
    ],
    flags: {},
  };
}

export const ambushTest: Scene = build();

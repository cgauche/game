/**
 * CAMPAGNE — L'Ennemi dans l'Ombre (Tome 1), ouverture.
 * Sourcé de « Chapitre 1 : On recherche : aventuriers courageux » :
 * l'auberge-relais « La Diligence » puis l'embuscade des mutants sur la route.
 *
 * Ce document respecte le schéma `Scene` : il est donc ouvrable et modifiable
 * dans l'éditeur de niveau (exigence : tout le contenu de campagne est éditable).
 */
import { Scene, Terrain } from '../state/scene';

const W = 22;
const H = 16;

function build(): Scene {
  const tiles: Terrain[] = new Array(W * H).fill('herbe');
  const set = (x: number, y: number, t: Terrain) => {
    if (x >= 0 && y >= 0 && x < W && y < H) tiles[y * W + x] = t;
  };

  // Route est-ouest (la grand-route Middenheim–Altdorf) sur deux rangées.
  for (let x = 0; x < W; x++) {
    set(x, 11, 'route');
    set(x, 12, 'route');
  }

  // Auberge « La Diligence » : bâtiment fermé (murs + plancher), porte au sud.
  for (let x = 2; x <= 10; x++) {
    set(x, 2, 'mur');
    set(x, 8, 'mur');
  }
  for (let y = 2; y <= 8; y++) {
    set(2, y, 'mur');
    set(10, y, 'mur');
  }
  for (let x = 3; x <= 9; x++) for (let y = 3; y <= 7; y++) set(x, y, 'plancher');
  set(6, 8, 'porte'); // entrée de la salle de bar

  // Quelques arbres en lisière (décor / obstacles).
  for (const [x, y] of [[15, 3], [17, 4], [19, 2], [16, 6], [20, 7], [18, 8]] as const) set(x, y, 'bois');

  // Sentier de la porte vers la route.
  for (let y = 9; y <= 10; y++) set(6, y, 'sol');

  return {
    id: 'tome1-intro',
    nom: "La Diligence — L'Ennemi dans l'Ombre",
    description:
      "À deux jours d'Altdorf, votre groupe atteint l'auberge-relais « La Diligence ». " +
      'Parlez à l\'aubergiste, puis reprenez la route — mais le voyage réserve une mauvaise surprise.',
    dimensions: { w: W, h: H },
    ambiance: 'jour',
    tiles,
    startMessage:
      "Chapitre 1 — Vous approchez de l'auberge-relais « La Diligence », à deux jours d'Altdorf.",
    entities: [
      { id: 'start', kind: 'heroStart', pos: { x: 6, y: 10 } },
      {
        id: 'gustav',
        kind: 'pnj',
        pos: { x: 6, y: 4 },
        label: 'Gustav',
        dialogueId: 'dlg-gustav',
      },
      { id: 'noiraud', kind: 'prop', pos: { x: 8, y: 3 }, label: 'Noiraud' },
      {
        id: 'corps',
        kind: 'objet',
        pos: { x: 19, y: 12 },
        label: 'Cadavre près de la diligence',
        loot: ['Lettre scellée de Kastor Lieberung', "Papiers d'identité"],
      },
    ],
    dialogues: [
      {
        id: 'dlg-gustav',
        start: 'g1',
        nodes: [
          {
            id: 'g1',
            speaker: 'Gustav, l’aubergiste',
            text:
              '« Bonsoir ! Bienvenue à la Diligence. Prenez un siège, là, près du feu, vous serez bien au chaud. ' +
              'Voulez-vous à manger et à boire ? » Au-dessus du bar, le corbeau Noiraud croasse : « Voulez-vous boire des chevaux ? »',
            choices: [
              { text: 'Nous cherchons une place pour Altdorf.', next: 'g2' },
              { text: 'Parlez-nous des autres voyageurs.', next: 'g3' },
              { text: 'Plus tard. (Quitter)', effects: [{ type: 'endDialogue' }] },
            ],
          },
          {
            id: 'g2',
            speaker: 'Gustav, l’aubergiste',
            text:
              '« Altdorf ! La capitale ! Deux cochers logent ici cette nuit, Gunnar et Hultz. ' +
              'La diligence repart au matin — si vous tenez à votre place, soyez prêts à l’aube. »',
            choices: [
              { text: '(Revenir)', next: 'g1' },
              { text: 'Merci, Gustav.', effects: [{ type: 'journal', text: 'La diligence pour Altdorf repart au matin.' }, { type: 'endDialogue' }] },
            ],
          },
          {
            id: 'g3',
            speaker: 'Gustav, l’aubergiste',
            text:
              '« Une noble dame, Isolde von Strudeldorf, avec sa servante et sa garde du corps. ' +
              'Un étudiant plongé dans ses livres, et un joueur trop élégant accoudé au bar. Du beau monde ! »',
            choices: [{ text: '(Revenir)', next: 'g1' }],
          },
        ],
      },
    ],
    triggers: [
      {
        id: 'ambush',
        rect: { x: 14, y: 11, w: 6, h: 2 },
        once: true,
        effects: [
          { type: 'journal', text: 'Sur la route, une diligence renversée… et des silhuettes difformes qui se repaissent des restes.' },
          { type: 'startCombat', encounter: 'enc-mutants' },
        ],
      },
    ],
    encounters: [
      {
        id: 'enc-mutants',
        enemies: [
          { ref: 'Mutant', pos: { x: 16, y: 11 } },
          { ref: 'Mutant', pos: { x: 18, y: 12 } },
          { ref: 'Mutant', pos: { x: 17, y: 13 } },
        ],
        onVictory: [
          { type: 'setFlag', flag: 'mutants_vaincus' },
          {
            type: 'journal',
            text:
              'Les mutants gisent au sol. Sur une victime, vous trouvez une lettre scellée au nom de Kastor Lieberung — ' +
              'fouillez le cadavre près de la diligence pour la récupérer.',
          },
        ],
      },
    ],
    flags: {},
  };
}

export const tome1Intro: Scene = build();

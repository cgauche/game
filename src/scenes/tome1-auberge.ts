/**
 * CAMPAGNE — Intérieur de l'auberge-relais « La Diligence » (Tome 1, ch.1).
 *
 * La salle de bar (« Grande Salle ») où se joue la soirée d'ouverture de
 * « L'Ennemi dans l'Ombre ». Contenu SOURCÉ : la salle, ses occupants, leurs
 * rôles et leurs répliques viennent de `src/scenes/tome1-dossiers.json` (mine du
 * chapitre 1, l.9-414) et de `Source/Enemy Within … Vol.1 « Wanted: Bold
 * Adventurers »` (l.35-36, 78-83, 175). Aucune règle n'est inventée.
 *
 * ⚠ RÉSERVE de fidélité : la source ne donne PAS de plan de salle (placement des
 * tables, de l'âtre, du comptoir). Les positions ci-dessous sont une mise en
 * scène ÉDITABLE (modifiable dans l'éditeur), pas une géométrie canonique. Les
 * PNJ rendent un sprite générique (villageois) faute d'apparences distinctes ;
 * il n'existe au catalogue ni prop « table/comptoir/âtre » ni sprite « corbeau »
 * (Noiraud est posé en prop). À enrichir depuis le livre quand les assets existeront.
 *
 * Atteint via le bâtiment `taverne` `reveal:'door'` de tome1-intro ; on en
 * ressort par la porte du bas (effet `transitionBack`, fourni par makeInteriorScene).
 */
import { Scene, SceneEntity, Dialogue } from '../state/scene';
import { makeInteriorScene } from './interiors';

function build(): Scene {
  const scene = makeInteriorScene({
    id: 'tome1-auberge-interieur',
    nom: 'La Diligence — Grande Salle',
    w: 11,
    h: 9,
    floor: 'plancher',
    ambiance: 'interieur',
    startMessage:
      'Grande Salle de La Diligence : un feu crépite, deux cochers rient en buvant, ' +
      'une dame richement vêtue vous toise, un homme lit, un autre vous observe depuis le comptoir.',
  });

  // Occupants de la salle de bar (tous sourcés ; cf. en-tête). Positions = mise en
  // scène éditable. Gustav, Phillipe, Isolde et Ernst ont une réplique sourcée ;
  // les autres peuplent la salle (décor vivant, clic sans effet par défaut).
  const npcs: SceneEntity[] = [
    { id: 'gustav', kind: 'personnage', pos: { x: 5, y: 2 }, label: 'Gustav, l’aubergiste', dialogueId: 'dlg-gustav' },
    { id: 'herpin', kind: 'personnage', pos: { x: 2, y: 2 }, label: 'Herpin, le barman' },
    { id: 'noiraud', kind: 'prop', pos: { x: 3, y: 1 }, label: 'Noiraud (corbeau)' },
    { id: 'phillipe', kind: 'personnage', pos: { x: 3, y: 4 }, label: 'Phillipe, le joueur', dialogueId: 'dlg-phillipe' },
    { id: 'isolde', kind: 'personnage', pos: { x: 8, y: 3 }, label: 'Dame Isolde von Strudeldorf', dialogueId: 'dlg-isolde' },
    { id: 'marie', kind: 'personnage', pos: { x: 7, y: 3 }, label: 'Marie, la garde du corps' },
    { id: 'janna', kind: 'personnage', pos: { x: 8, y: 4 }, label: 'Janna, la servante' },
    { id: 'ernst', kind: 'personnage', pos: { x: 2, y: 5 }, label: 'Ernst, l’étudiant', dialogueId: 'dlg-ernst' },
    { id: 'cochers', kind: 'personnage', pos: { x: 7, y: 5 }, label: 'Gunnar et Hultz, les cochers' },
  ];
  // Décor (props du catalogue ; pas de table/âtre dédié → approximations).
  const props: SceneEntity[] = [
    { id: 'feu', kind: 'prop', pos: { x: 2, y: 6 }, ref: 'feu-camp', label: 'Le feu' },
    { id: 'tonneaux', kind: 'prop', pos: { x: 9, y: 1 }, ref: 'tonneau', label: 'Tonneaux' },
  ];
  scene.entities.push(...npcs, ...props);

  const dialogues: Dialogue[] = [
    {
      // Repris tel quel de tome1-intro (déplacé ici : Gustav est dans la salle).
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
            {
              text: 'Lire l’affiche placardée près du bar.',
              effects: [
                {
                  type: 'document',
                  title: 'ON RECHERCHE',
                  text:
                    'AVIS À LA POPULATION\n\nSon Altesse le Prince Héritier Hergard von Tasseninck recherche des aventuriers courageux et loyaux pour une mission au service de l’Empire.\n\nForte récompense promise. Présentez-vous à Altdorf, au Palais, en mentionnant cette affiche.\n\nQue Sigmar guide vos pas.',
                },
              ],
            },
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
            {
              text: 'Marchander le prix de la place. (Marchandage)',
              effects: [
                {
                  type: 'test',
                  skill: 'Marchandage',
                  label: 'Marchandage du prix',
                  difficulty: 'intermediaire',
                  onSuccess: [
                    { type: 'giveMoney', silver: 2 },
                    { type: 'journal', text: 'Gustav grommelle puis consent à baisser le prix.' },
                    { type: 'endDialogue' },
                  ],
                  onFailure: [
                    { type: 'journal', text: '« Désolé, c’est le tarif, et c’est déjà une affaire ! »' },
                    { type: 'endDialogue' },
                  ],
                },
              ],
            },
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
    {
      id: 'dlg-phillipe',
      start: 'p1',
      nodes: [
        {
          id: 'p1',
          speaker: 'Phillipe Descartes',
          text: '« Une petite partie d’Impératrice Écarlate pour passer le temps, mes amis ? » Son sourire est un peu trop affûté.',
          choices: [{ text: '(Décliner poliment)', effects: [{ type: 'endDialogue' }] }],
        },
      ],
    },
    {
      id: 'dlg-isolde',
      start: 'i1',
      nodes: [
        {
          id: 'i1',
          speaker: 'Dame Isolde von Strudeldorf',
          text: '« Je ne vais tout de même pas voyager entassée avec des roturiers. » Sa servante détourne les yeux.',
          choices: [{ text: '(S’éloigner)', effects: [{ type: 'endDialogue' }] }],
        },
      ],
    },
    {
      id: 'dlg-ernst',
      start: 'e1',
      nodes: [
        {
          id: 'e1',
          speaker: 'Ernst Heidlemann',
          text: '« Laissez-moi tranquille, j’ai beaucoup à réviser pour mon examen d’entrée. » Il referme vivement son livre.',
          choices: [{ text: '(Le laisser)', effects: [{ type: 'endDialogue' }] }],
        },
      ],
    },
  ];
  scene.dialogues.push(...dialogues);

  scene.description =
    'La salle de bar de l’auberge-relais « La Diligence ». La soirée précédant le départ ' +
    'de la diligence pour Altdorf — la dernière nuit de calme avant l’embuscade.';
  return scene;
}

export const tome1Auberge: Scene = build();

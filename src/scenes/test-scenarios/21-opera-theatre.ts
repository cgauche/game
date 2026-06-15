import { makePregens } from '../../data/pregens';
import type { Scene, Terrain, SceneEntity } from '../../state/scene';
import type { TestScenario } from './_shared';

/**
 * « Une nuit à l'Opéra » — le THÉÂTRE multi-niveaux (Lot C1). Le lieu central, 100 % en données
 * éditeur : parterre + scène (z0) et galerie de loges + loge royale en surplomb (z1), reliés
 * visuellement par le tri de profondeur (un sol de loge surplombe les fauteuils du parterre). Tout
 * le mobilier d'opéra (props SVG) est posé à son étage. Aucune ligne de code applicatif — assemblé
 * avec `levels`, `SceneEntity.z` et les props du catalogue. (La bombe jouable vit dans « Opéra —
 * Bombe » ; ici on bâtit la salle ; les intrigues s'y câbleront quand la traversée d'étage existera.)
 */
const W = 18, H = 14;
const at = (x: number, y: number) => y * W + x;
const z0 = new Array(W * H).fill('marbre') as Terrain[]; // parterre dallé de marbre
const z1 = new Array(W * H).fill('vide') as Terrain[]; // galerie : vide sauf les planchers de loge
const fill = (t: Terrain[], x0: number, y0: number, x1: number, y1: number, v: Terrain) => {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) t[at(x, y)] = v;
};

// --- Niveau 0 : la salle ---
for (let x = 0; x < W; x++) { z0[at(x, 0)] = 'mur'; if (x < 8 || x > 9) z0[at(x, H - 1)] = 'mur'; } // entrée au centre du mur du fond
for (let y = 0; y < H; y++) { z0[at(0, y)] = 'mur'; z0[at(W - 1, y)] = 'mur'; }
fill(z0, 3, 1, 14, 3, 'plancher'); // la scène (plancher de bois, au fond)

// --- Niveau 1 : les loges en surplomb (plancher posé sur le vide) ---
fill(z1, 1, 4, 2, 9, 'plancher'); // loges latérales gauche
fill(z1, 15, 4, 16, 9, 'plancher'); // loges latérales droite
fill(z1, 6, 11, 11, 12, 'plancher'); // LOGE ROYALE (devant, surplombe l'arrière du parterre)

const ents: SceneEntity[] = [
  { id: 'start', kind: 'heroStart', pos: { x: 8, y: 12 } },

  // Scène (z0) : rideau au fond, pupitre du chef devant.
  { id: 'rideau-g', kind: 'prop', ref: 'rideau-scene', pos: { x: 5, y: 1 } },
  { id: 'rideau-c', kind: 'prop', ref: 'rideau-scene', pos: { x: 8, y: 1 } },
  { id: 'rideau-d', kind: 'prop', ref: 'rideau-scene', pos: { x: 11, y: 1 } },
  { id: 'pupitre', kind: 'prop', ref: 'pupitre-chef', pos: { x: 8, y: 4 }, facing: 'N' },

  // Parterre (z0) : rangées de fauteuils face à la scène + colonnes + statue.
  { id: 'sieges-1g', kind: 'prop', ref: 'rangee-sieges', pos: { x: 4, y: 7 }, facing: 'N' },
  { id: 'sieges-1d', kind: 'prop', ref: 'rangee-sieges', pos: { x: 10, y: 7 }, facing: 'N' },
  { id: 'sieges-2g', kind: 'prop', ref: 'rangee-sieges', pos: { x: 4, y: 9 }, facing: 'N' },
  { id: 'sieges-2d', kind: 'prop', ref: 'rangee-sieges', pos: { x: 10, y: 9 }, facing: 'N' },
  { id: 'colonne-g', kind: 'prop', ref: 'colonne-brisee', pos: { x: 2, y: 6 } },
  { id: 'colonne-d', kind: 'prop', ref: 'colonne-brisee', pos: { x: 15, y: 6 } },
  { id: 'statue', kind: 'prop', ref: 'statue', pos: { x: 2, y: 11 } },
  // Professeur Pakker et son épouse, assis près de l'allée centrale (source 08 l.158) — cible des
  // pétards des étudiants (intrigue n°2 : Glimbrin lui vole ses clés dans le brouhaha).
  { id: 'pakker', kind: 'personnage', ref: 'Villageois', label: 'Professeur Pakker', pos: { x: 8, y: 8 }, facing: 'N' },

  // Lustre suspendu au-dessus du parterre (prop sur le vide z1 → flotte 96 px plus haut).
  { id: 'lustre', kind: 'prop', ref: 'lustre-opera', pos: { x: 8, y: 6 }, z: 1 },

  // Loge gauche (z1) : balustrade côté parterre, fauteuils, applique, un spectateur.
  { id: 'bal-g', kind: 'prop', ref: 'balustrade-loge', pos: { x: 2, y: 5 }, facing: 'E', z: 1 },
  { id: 'ft-g1', kind: 'prop', ref: 'fauteuil-loge', pos: { x: 1, y: 5 }, z: 1 },
  { id: 'ft-g2', kind: 'prop', ref: 'fauteuil-loge', pos: { x: 1, y: 7 }, z: 1 },
  { id: 'app-g', kind: 'prop', ref: 'applique-murale', pos: { x: 1, y: 4 }, z: 1 },
  { id: 'spect-g', kind: 'personnage', ref: 'Villageois', label: 'Spectatrice', pos: { x: 2, y: 7 }, z: 1, facing: 'E' },

  // Loge droite (z1).
  { id: 'bal-d', kind: 'prop', ref: 'balustrade-loge', pos: { x: 15, y: 5 }, facing: 'O', z: 1 },
  { id: 'ft-d1', kind: 'prop', ref: 'fauteuil-loge', pos: { x: 16, y: 5 }, z: 1 },
  { id: 'ft-d2', kind: 'prop', ref: 'fauteuil-loge', pos: { x: 16, y: 7 }, z: 1 },
  { id: 'app-d', kind: 'prop', ref: 'applique-murale', pos: { x: 16, y: 4 }, z: 1 },
  { id: 'spect-d', kind: 'personnage', ref: 'Villageois', label: 'Spectateur', pos: { x: 15, y: 7 }, z: 1, facing: 'O' },

  // LOGE ROYALE (z1) : balustrade face à la scène, fauteuils d'apparat, la Comtesse, appliques.
  { id: 'bal-royale-g', kind: 'prop', ref: 'balustrade-loge', pos: { x: 6, y: 11 }, facing: 'N', z: 1 },
  { id: 'bal-royale-d', kind: 'prop', ref: 'balustrade-loge', pos: { x: 11, y: 11 }, facing: 'N', z: 1 },
  { id: 'fauteuil-royal', kind: 'prop', ref: 'fauteuil-loge', pos: { x: 8, y: 12 }, z: 1 },
  { id: 'comtesse', kind: 'personnage', ref: 'Villageois', label: 'Comtesse Emmanuelle', pos: { x: 9, y: 12 }, z: 1, facing: 'N', dialogueId: 'dlg-comtesse' },
  { id: 'app-royale-g', kind: 'prop', ref: 'applique-murale', pos: { x: 6, y: 12 }, z: 1 },
  { id: 'app-royale-d', kind: 'prop', ref: 'applique-murale', pos: { x: 11, y: 12 }, z: 1 },
  // INTRIGUE n°1 (source 08 l.131) : « une grande plante en pot… le pot est rempli de poudre à canon,
  // avec un détonateur caché », posée dans l'antichambre de la LOGE ROYALE (z1). Désamorçage = retirer
  // le détonateur (l.166). Détection plus aisée pour qui connaît la Poudre noire.
  {
    id: 'plante-bombe', kind: 'prop', ref: 'plante-pot', pos: { x: 7, y: 11 }, z: 1,
    interact: {
      consume: false,
      effects: [
        {
          type: 'test', skill: 'Perception', difficulty: 'complexe',
          easierIf: { hasSkill: 'Projectiles (Poudre noire)', steps: 1 },
          label: 'Examiner la plante en pot',
          onSuccess: [
            { type: 'journal', text: 'Sous le feuillage : le pot est bourré de poudre à canon, relié à un détonateur. Vous arrachez le détonateur — la bombe est neutralisée.' },
            { type: 'setFlag', flag: 'bombeDesamorcee' },
          ],
          onFailure: [{ type: 'journal', text: 'Une grande plante en pot, sans rien de particulier.' }],
        },
      ],
    },
  },

  // Escaliers (props visuels) reliant le parterre aux loges — la traversée est portée en données par
  // `Scene.stairs` (cf. ci-dessous). Le groupe monte en cliquant une case de loge.
  { id: 'esc-royale', kind: 'prop', ref: 'escalier-loge', pos: { x: 12, y: 12 }, facing: 'NO' },
  { id: 'esc-gauche', kind: 'prop', ref: 'escalier-loge', pos: { x: 3, y: 9 }, facing: 'NO' },
];

const scene: Scene = {
  id: 'test-opera-theatre',
  nom: 'Opéra — Le théâtre',
  description: 'Le théâtre de l\'Opéra : parterre et scène au sol, galerie de loges et loge royale en surplomb.',
  dimensions: { w: W, h: H },
  ambiance: 'interieur',
  levels: [{ z: 0, tiles: z0 }, { z: 1, tiles: z1 }],
  // Franchissements verticaux (pathfinding 3D) : le parterre monte vers la loge royale et la loge
  // gauche par leur escalier. Bidirectionnel — on redescend par le même.
  stairs: [
    { from: { x: 12, y: 12, z: 0 }, to: { x: 11, y: 12, z: 1 } }, // → loge royale
    { from: { x: 3, y: 9, z: 0 }, to: { x: 2, y: 9, z: 1 } }, // → loge gauche
  ],
  entities: ents,
  dialogues: [
    {
      id: 'dlg-comtesse',
      start: 'n0',
      nodes: [
        {
          id: 'n0',
          speaker: 'Comtesse Emmanuelle',
          text: 'La Comtesse Emmanuelle vous toise depuis sa loge. « On ne vous a pas conviés dans ma loge. Qu’est-ce qui peut bien valoir cette intrusion ? »',
          choices: [
            { text: '« Excellence, l’antichambre n’est peut-être pas sûre ce soir. »', next: 'n1' },
            { text: 'S’incliner et se retirer.', effects: [{ type: 'endDialogue' }] },
          ],
        },
        {
          id: 'n1',
          speaker: 'Comtesse Emmanuelle',
          text: '« Pas sûre ? » Un sourire glacé. « Mes gardes en jugeront. Mais examinez donc, puisque vous y tenez — discrètement. »',
          choices: [{ text: 'Remercier et examiner les lieux.', effects: [{ type: 'endDialogue' }] }],
        },
      ],
    },
  ],
  triggers: [
    {
      // Entrer dans l'auditorium ARME l'intrigue (la plante est déjà en place, source 20h02) : la mèche
      // brûle, l'explosion frappe l'antichambre sauf si on retire le détonateur (flag bombeDesamorcee).
      id: 'armer-bombe',
      rect: { x: 3, y: 6, w: 12, h: 4 },
      once: true,
      effects: [
        { type: 'journal', text: 'Les lumières de la salle baissent, le rideau se lève — la représentation commence.' },
        { type: 'setLight', level: 0.35 }, // mise en scène : la salle plonge dans la pénombre
        { type: 'journal', text: 'Une âcre odeur de poudre flotte depuis la galerie des loges…' },
        // INTRIGUE n°2 (source 08 l.158-162) : à 20h30, deux étudiants jettent un chapelet de pétards
        // sur le siège du professeur Pakker. La lueur de la mèche éclaire la salle (flash), puis les
        // pétards éclatent — le spectacle s'interrompt SANS panique ; Glimbrin en profite pour voler.
        {
          type: 'delayedEffect', afterMinutes: 10,
          effects: [
            { type: 'journal', text: 'Près de l’allée centrale, la lueur d’une mèche embrase la pénombre…' },
            { type: 'setLight', level: 0.8 }, // l'éclat des pétards illumine brièvement toute la salle
            { type: 'zoneBlast', center: { x: 8, y: 8 }, radius: 1, damage: '2' },
            { type: 'journal', text: 'Une volée de pétards éclate sur le siège du professeur Pakker ! Le spectacle s’interrompt dans les cris — mais sans panique. Dans le brouhaha, une petite silhouette se faufile sous son fauteuil…' },
          ],
        },
        { type: 'delayedEffect', afterMinutes: 11, effects: [{ type: 'setLight', level: 0.35 }] }, // la salle se rassoit dans la pénombre
        {
          type: 'delayedEffect', afterMinutes: 60, cancelFlag: 'bombeDesamorcee',
          effects: [
            { type: 'journal', text: 'UNE EXPLOSION DÉCHIRE L’ANTICHAMBRE DE LA LOGE ROYALE !' },
            { type: 'zoneBlast', center: { x: 8, y: 12 }, radius: 6, damage: '1d10+15', conditions: [{ name: 'En flammes' }] },
          ],
        },
      ],
    },
  ],
  encounters: [],
  flags: {},
  startMessage:
    'Le grand théâtre de l\'Opéra d\'Altdorf. En bas, le parterre face à la scène ; au-dessus, la galerie de loges et la loge royale en surplomb où siège la Comtesse.',
};

export const scenario: TestScenario = {
  id: 'opera-theatre',
  order: 21,
  icon: '🎭',
  title: 'Opéra — Théâtre',
  tests: 'Salle multi-niveaux 100 % en données : parterre + scène (z0) et loges + loge royale (z1) avec mobilier d\'opéra posé à chaque étage ; surplomb des planchers ; NPC placés par niveau.',
  partyNote: 'Pré-tirés',
  makeParty: () => makePregens(),
  scene,
};

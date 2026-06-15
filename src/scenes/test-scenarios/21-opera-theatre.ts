import { makePregens } from '../../data/pregens';
import { parseAsciiRows } from '../../state/asciiMap';
import type { Scene, SceneEntity, CustomStatblock } from '../../state/scene';
import type { TestScenario } from './_shared';
import { flowFromEffects, testFlow, type Flow } from '../../state/flow';

// Profil des deux étudiants saboteurs : de jeunes civils paniqués, vifs mais fragiles (pas de combattants).
const ETUDIANT: CustomStatblock = {
  name: 'Étudiant', char: { M: 4, CC: 32, CT: 38, F: 30, E: 30, I: 35, Ag: 38, Dex: 35, Int: 42, FM: 28, Soc: 35, B: 11 },
  weaponDamage: '+BF+2', armour: 0,
};

/**
 * « Une nuit à l'Opéra » — le Théâtre Staatsoper, reconstitué d'après le PLAN du scénario (NADJ ch.8,
 * source 08 l.28-41). Carte AUTHORÉE EN ASCII (une grille par étage, comme l'arène), 100 % en données.
 *
 *  Rez-de-chaussée (z0) : coulisses + coursive (mur arrière) → scène → PARTERRE (auditorium) → HALL
 *  (foyer) → vestibule d'entrée ; escaliers JUMEAUX de chaque côté du hall (surveillés) montant à l'étage.
 *  Étage supérieur (z1) : galerie moquettée desservant 8 LOGES (4 de chaque côté) + la LOGE ROYALE et son
 *  ANTICHAMBRE au fond-centre (où les agents de Dammenblatz posent la bombe, l.62/131).
 *
 *  Légende : # mur · = planches (coulisses/coursive) · S plancher (scène) · M marbre (parterre) ·
 *  H dalle (hall/vestibule) · E plancher (escalier) · L plancher (galerie/loges) · D porte.
 */
const LEGEND: Record<string, string> = { M: 'marbre', S: 'plancher', H: 'dalle', E: 'plancher', L: 'plancher' };

const Z0 = [
  '#####################',
  '#===================#', // coursive le long du mur arrière (accès coulisses/acteurs)
  '#===#SSSSSSSSSSS#===#', // coulisses gauche (loges d'artistes/salle verte) | SCÈNE | coulisses droite (ateliers)
  '#===#SSSSSSSSSSS#===#',
  '#===DSSSSSSSSSSSD===#', // portes de scène
  '#...MMMMMMMMMMMMM...#', // PARTERRE (auditorium, face à la scène)
  '#...MMMMMMMMMMMMM...#',
  '#...MMMMMMMMMMMMM...#',
  '#...MMMMMMMMMMMMM...#',
  '#...MMMMMMMMMMMMM...#',
  '#...MMMMMMMMMMMMM...#',
  '#...MMMMMMMMMMMMM...#',
  '#...MMMMMMMMMMMMM...#',
  '#EEHHHHHHHHHHHHHHHEE#', // escaliers jumeaux (E) flanquant le HALL d'entrée
  '#EEHHHHHHHHHHHHHHHEE#',
  '#..HHHHHHHHHHHHHHH..#',
  '#......HHHHHHH......#', // vestibule (Porte des Dames / des Seigneurs, entrée du groupe)
];

const Z1 = [
  '.....................',
  '.....................',
  '.....................',
  '.....................',
  '.LLL.............LLL.', // loges latérales : 4 à gauche, 4 à droite, surplombant le parterre
  '.LLL.............LLL.',
  '.LLL.............LLL.',
  '.LLL.............LLL.',
  '.LLL.............LLL.',
  '.LLL.............LLL.',
  '.LLL.............LLL.',
  '.LLL.............LLL.',
  '.LLL.............LLL.',
  '.LLLLLLLLLLLLLLLLLLL.', // galerie moquettée (relie les escaliers, les loges et la loge royale)
  '.LLLLLLLLLLLLLLLLLLL.',
  '...LLLLLLLLLLLLLLL...', // ANTICHAMBRE de la loge royale (la plante piégée y est livrée)
  '.....................',
];

const g0 = parseAsciiRows(Z0, 'mur', LEGEND);
const g1 = parseAsciiRows(Z1, 'vide', LEGEND);
const W = g0.w, H = g0.h;

const ents: SceneEntity[] = [
  { id: 'start', kind: 'heroStart', pos: { x: 10, y: 16 } }, // vestibule d'entrée

  // Scène (z0) : rideau au fond, pupitre du chef devant.
  { id: 'rideau-g', kind: 'prop', ref: 'rideau-scene', pos: { x: 7, y: 2 } },
  { id: 'rideau-c', kind: 'prop', ref: 'rideau-scene', pos: { x: 10, y: 2 } },
  { id: 'rideau-d', kind: 'prop', ref: 'rideau-scene', pos: { x: 13, y: 2 } },
  { id: 'pupitre', kind: 'prop', ref: 'pupitre-chef', pos: { x: 10, y: 5 }, facing: 'N' },

  // Parterre (z0) : rangées de fauteuils face à la scène (allée centrale x10), colonnes, statue.
  { id: 'sieges-1g', kind: 'prop', ref: 'rangee-sieges', pos: { x: 5, y: 7 }, facing: 'N' },
  { id: 'sieges-1d', kind: 'prop', ref: 'rangee-sieges', pos: { x: 11, y: 7 }, facing: 'N' },
  { id: 'sieges-2g', kind: 'prop', ref: 'rangee-sieges', pos: { x: 5, y: 10 }, facing: 'N' },
  { id: 'sieges-2d', kind: 'prop', ref: 'rangee-sieges', pos: { x: 11, y: 10 }, facing: 'N' },
  { id: 'colonne-g', kind: 'prop', ref: 'colonne-brisee', pos: { x: 4, y: 6 } },
  { id: 'colonne-d', kind: 'prop', ref: 'colonne-brisee', pos: { x: 16, y: 6 } },
  { id: 'statue', kind: 'prop', ref: 'statue', pos: { x: 4, y: 15 } },
  // Professeur Pakker et son épouse, près de l'allée centrale (source 08 l.158) — cible des pétards.
  { id: 'pakker', kind: 'personnage', ref: 'Villageois', label: 'Professeur Pakker', pos: { x: 9, y: 8 }, facing: 'N' },
  // Les deux étudiants, repliés vers l'arrière de la salle près de la porte (l.158) — combat optionnel.
  { id: 'etudiant-1', kind: 'personnage', label: 'Étudiant nerveux', pos: { x: 5, y: 15 }, facing: 'S', dialogueId: 'dlg-etudiants', statblock: ETUDIANT },
  { id: 'etudiant-2', kind: 'personnage', label: 'Étudiant fébrile', pos: { x: 6, y: 15 }, facing: 'S', statblock: ETUDIANT },

  // Lustre suspendu au-dessus du parterre (prop sur le vide z1 → flotte plus haut).
  { id: 'lustre', kind: 'prop', ref: 'lustre-opera', pos: { x: 10, y: 8 }, z: 1 },

  // Loges gauche (z1) : balustrade côté parterre, fauteuils, applique, un spectateur.
  { id: 'bal-g', kind: 'prop', ref: 'balustrade-loge', pos: { x: 3, y: 6 }, facing: 'E', z: 1 },
  { id: 'ft-g1', kind: 'prop', ref: 'fauteuil-loge', pos: { x: 1, y: 6 }, z: 1 },
  { id: 'ft-g2', kind: 'prop', ref: 'fauteuil-loge', pos: { x: 1, y: 8 }, z: 1 },
  { id: 'app-g', kind: 'prop', ref: 'applique-murale', pos: { x: 1, y: 5 }, z: 1 },
  { id: 'spect-g', kind: 'personnage', ref: 'Villageois', label: 'Spectatrice', pos: { x: 2, y: 7 }, z: 1, facing: 'E' },

  // Loges droite (z1).
  { id: 'bal-d', kind: 'prop', ref: 'balustrade-loge', pos: { x: 17, y: 6 }, facing: 'O', z: 1 },
  { id: 'ft-d1', kind: 'prop', ref: 'fauteuil-loge', pos: { x: 19, y: 6 }, z: 1 },
  { id: 'ft-d2', kind: 'prop', ref: 'fauteuil-loge', pos: { x: 19, y: 8 }, z: 1 },
  { id: 'app-d', kind: 'prop', ref: 'applique-murale', pos: { x: 19, y: 5 }, z: 1 },
  { id: 'spect-d', kind: 'personnage', ref: 'Villageois', label: 'Spectateur', pos: { x: 18, y: 7 }, z: 1, facing: 'O' },

  // LOGE ROYALE (z1, fond-centre de la galerie) : balustrade face à la scène, fauteuil, la Comtesse, appliques.
  { id: 'bal-royale-g', kind: 'prop', ref: 'balustrade-loge', pos: { x: 8, y: 13 }, facing: 'N', z: 1 },
  { id: 'bal-royale-d', kind: 'prop', ref: 'balustrade-loge', pos: { x: 12, y: 13 }, facing: 'N', z: 1 },
  { id: 'fauteuil-royal', kind: 'prop', ref: 'fauteuil-loge', pos: { x: 10, y: 14 }, z: 1 },
  { id: 'comtesse', kind: 'personnage', ref: 'Villageois', label: 'Comtesse Emmanuelle', pos: { x: 10, y: 13 }, z: 1, facing: 'N', dialogueId: 'dlg-comtesse' },
  { id: 'app-royale-g', kind: 'prop', ref: 'applique-murale', pos: { x: 7, y: 14 }, z: 1 },
  { id: 'app-royale-d', kind: 'prop', ref: 'applique-murale', pos: { x: 13, y: 14 }, z: 1 },
  // INTRIGUE n°1 (source 08 l.131/166) : « grande plante en pot remplie de poudre à canon, détonateur
  // caché », livrée dans l'ANTICHAMBRE de la loge royale (z1). Désamorçage = retirer le détonateur.
  {
    id: 'plante-bombe', kind: 'prop', ref: 'plante-pot', pos: { x: 10, y: 15 }, z: 1,
    interact: {
      consume: false,
      flow: testFlow(
        {
          skill: 'Perception', difficulty: 'complexe',
          easierIf: { hasSkill: 'Projectiles (Poudre noire)', steps: 1 },
          label: 'Examiner la plante en pot',
        },
        flowFromEffects([
          { type: 'journal', text: 'Sous le feuillage : le pot est bourré de poudre à canon, relié à un détonateur. Vous arrachez le détonateur — la bombe est neutralisée.' },
          { type: 'setFlag', flag: 'bombeDesamorcee' },
          { type: 'giveXp', amount: 50 }, // déjouer le complot de la bombe de Dammenblatz (source 08 l.275)
        ]),
        flowFromEffects([{ type: 'journal', text: 'Une grande plante en pot, sans rien de particulier.' }]),
      ),
    },
  },

  // Escaliers JUMEAUX (props visuels) ; la traversée est portée en données par `Scene.stairs`.
  { id: 'esc-gauche', kind: 'prop', ref: 'escalier-loge', pos: { x: 2, y: 14 }, facing: 'N' },
  { id: 'esc-droite', kind: 'prop', ref: 'escalier-loge', pos: { x: 18, y: 14 }, facing: 'N' },
];

const scene: Scene = {
  id: 'test-opera-theatre',
  nom: 'Opéra — Le théâtre',
  description: 'Le Théâtre Staatsoper d\'après le plan du scénario : coulisses, scène, parterre, hall et escaliers jumeaux ; galerie de loges et loge royale à l\'étage.',
  dimensions: { w: W, h: H },
  ambiance: 'interieur',
  levels: [{ z: 0, tiles: g0.tiles }, { z: 1, tiles: g1.tiles }],
  // Escaliers JUMEAUX (source l.36/41) : de chaque côté du hall, montant à la galerie. Bidirectionnels.
  stairs: [
    { from: { x: 2, y: 13, z: 0 }, to: { x: 2, y: 13, z: 1 } }, // escalier gauche → galerie
    { from: { x: 18, y: 13, z: 0 }, to: { x: 18, y: 13, z: 1 } }, // escalier droit → galerie
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
            { text: '« Excellence — un attentat vous visait. Il est déjoué. »', when: { kind: 'flag', expr: 'bombeDesamorcee' }, next: 'merci' },
            { text: '« Excellence, l’antichambre n’est peut-être pas sûre ce soir. »', when: { kind: 'flag', expr: '!bombeDesamorcee' }, next: 'n1' },
            { text: 'S’incliner et se retirer.', flow: flowFromEffects([{ type: 'endDialogue' }]) },
          ],
        },
        {
          id: 'n1',
          speaker: 'Comtesse Emmanuelle',
          text: '« Pas sûre ? » Un sourire glacé. « Mes gardes en jugeront. Mais examinez donc, puisque vous y tenez — discrètement. »',
          choices: [{ text: 'Remercier et examiner les lieux.', flow: flowFromEffects([{ type: 'endDialogue' }]) }],
        },
        {
          id: 'merci',
          speaker: 'Comtesse Emmanuelle',
          text: 'Le masque de hauteur se fissure une seconde. « …Un attentat ? Dans MA loge ? » Elle se ressaisit, mais son regard s’est radouci. « L’Empire saura que la maison von Liebwitz a une dette envers vous. Prenez ceci — et discrétion. »',
          choices: [
            {
              text: 'S’incliner et accepter.',
              flow: flowFromEffects([
                { type: 'giveMoney', gold: 5 },
                { type: 'setFlag', flag: 'faveurComtesse' },
                { type: 'endDialogue' },
              ]),
            },
          ],
        },
      ],
    },
    {
      id: 'dlg-etudiants',
      start: 'e0',
      nodes: [
        {
          id: 'e0',
          text: 'Deux jeunes gens nerveux, dissimulés près de la porte, manipulent un petit pot à feu et un chapelet de pétards. L’un d’eux blêmit en vous voyant approcher.',
          choices: [
            { text: '« Lâchez ça. Vous êtes en état d’arrestation. »', next: 'e1' },
            { text: 'Les laisser filer.', flow: flowFromEffects([{ type: 'journal', text: 'Vous détournez le regard ; les étudiants se fondent dans la foule.' }, { type: 'endDialogue' }]) },
          ],
        },
        {
          id: 'e1',
          text: '« On… on ne faisait rien ! » Ils refusent de se rendre et tentent de forcer le passage.',
          choices: [{ text: 'Les maîtriser.', flow: flowFromEffects([{ type: 'endDialogue' }, { type: 'startCombat', encounter: 'enc-etudiants' }]) }],
        },
      ],
    },
  ],
  triggers: [
    {
      // Entrer dans l'auditorium ARME l'intrigue (la plante est en place, l.20h02) : la mèche brûle,
      // l'explosion frappe l'antichambre de la loge royale sauf si on retire le détonateur.
      id: 'armer-bombe',
      rect: { x: 4, y: 5, w: 13, h: 8 },
      once: true,
      flow: flowFromEffects([
        { type: 'journal', text: 'Les lumières de la salle baissent, le rideau se lève — la représentation commence.' },
        { type: 'setLight', level: 0.35 },
        { type: 'journal', text: 'Une âcre odeur de poudre flotte depuis la galerie des loges…' },
        // INTRIGUE n°2 (source 08 l.158-162) : à 20h30, deux étudiants jettent des pétards sur le siège
        // de Pakker. Flash de la mèche, pétards, spectacle interrompu SANS panique ; Glimbrin vole.
        {
          type: 'delayedEffect', afterMinutes: 10,
          // Séquence d'échéance : ambiance + souffle des pétards, PUIS un Test de Perception (le vol de Glimbrin).
          flow: {
            kind: 'seq',
            steps: [
              { kind: 'do', effect: { type: 'journal', text: 'Près de l’allée centrale, la lueur d’une mèche embrase la pénombre…' } },
              { kind: 'do', effect: { type: 'setLight', level: 0.8 } },
              { kind: 'do', effect: { type: 'zoneBlast', center: { x: 9, y: 8 }, radius: 1, damage: '2' } },
              { kind: 'do', effect: { type: 'journal', text: 'Une volée de pétards éclate sur le siège du professeur Pakker ! Le spectacle s’interrompt dans les cris — mais sans panique. Dans le brouhaha, une petite silhouette se faufile sous son fauteuil…' } },
              testFlow(
                { skill: 'Perception', difficulty: 'difficile', label: 'Repérer le voleur dans le brouhaha' },
                flowFromEffects([
                  { type: 'journal', text: 'Vous surprenez un gnome glissé sous le fauteuil du professeur — il détale les mains vides. Les clés de l’École d’artillerie sont sauves.' },
                  { type: 'setFlag', flag: 'glimbrinDejoue' },
                  { type: 'giveXp', amount: 15 }, // empêcher le vol des clés du professeur Pakker (source 08 l.297)
                ]),
                flowFromEffects([
                  { type: 'journal', text: 'Plus tard, le professeur Pakker s’aperçoit avec effroi que les clés de l’École impériale d’artillerie ont disparu de sa poche…' },
                  { type: 'setFlag', flag: 'clesVolees' },
                ]),
              ),
            ] as Flow[],
          },
        },
        { type: 'delayedEffect', afterMinutes: 11, flow: flowFromEffects([{ type: 'setLight', level: 0.35 }]) },
        {
          type: 'delayedEffect', afterMinutes: 60, cancelFlag: 'bombeDesamorcee',
          flow: flowFromEffects([
            { type: 'journal', text: 'UNE EXPLOSION DÉCHIRE L’ANTICHAMBRE DE LA LOGE ROYALE !' },
            { type: 'zoneBlast', center: { x: 10, y: 14 }, radius: 6, damage: '1d10+15', conditions: [{ name: 'En flammes' }] },
          ]),
        },
      ]),
    },
  ],
  encounters: [
    {
      id: 'enc-etudiants',
      members: [{ entityId: 'etudiant-1' }, { entityId: 'etudiant-2' }],
      onVictory: [
        { type: 'journal', text: 'Les deux étudiants sont maîtrisés et remis à la garde — ils passeront la nuit en cellule.' },
        { type: 'setFlag', flag: 'etudiantsArretes' },
        { type: 'giveXp', amount: 10 }, // les étudiants en artillerie contrecarrés (source 08 l.277)
      ],
    },
  ],
  flags: {},
  startMessage:
    'Le Théâtre Staatsoper. Du vestibule, le hall s’ouvre sur le parterre face à la scène ; deux escaliers surveillés montent à la galerie des loges, où siège la Comtesse dans la loge royale.',
};

export const scenario: TestScenario = {
  id: 'opera-theatre',
  order: 21,
  icon: '🎭',
  title: 'Opéra — Théâtre',
  tests: 'Plan du Théâtre Staatsoper reproduit en ASCII (source 08 l.28-41) : coulisses+scène+parterre+hall+vestibule (z0), escaliers jumeaux → galerie+loges+loge royale & antichambre (z1) ; intrigues bombe + pétards/Glimbrin + étudiants.',
  partyNote: 'Pré-tirés',
  makeParty: () => makePregens(),
  scene,
};

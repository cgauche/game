/** Le Bourg de l'Arène (hub refondu, id conservé `arene-hub`) — TOUT-EN-SCÈNE, une seule scène. */
import { scene, P, NPC, hero, resetIds, flowOf, flagWhen, testNode } from './lib.mjs';

// ── Modèle TOUT-EN-SCÈNE ────────────────────────────────────────────────────────────────────
// Un bâtiment n'est PLUS une scène-intérieur séparée : c'est une GRANDE empreinte SUR la carte du
// Bourg (toit `Roof` + murs d'arête `mur-en-bois` + porte, posés par `addBuilding`). Son intérieur —
// sol, PNJ, marchand, props — vit DANS l'empreinte ; le toit se lève en CUTAWAY (`roofHidden`, IsoStage)
// dès qu'un allié entre. Le SOL de chaque intérieur est PEINT dans la grille ASCII (`noFloor` sur le
// bâtiment) pour que le détail (plancher, nef de marbre) survive à `addBuilding`.

// ── Dialogues du Bourg ──────────────────────────────────────────────────────────────────────

/** Porte d'une zone de l'échelle : visible quand la précédente est nettoyée, pas la suivante. */
const porte = (n, nom) => ({
  text: `⚔️ Entrer — ${nom}.`,
  when: flagWhen(n === 1 ? '!zone1_clear' : `zone${n - 1}_clear,!zone${n}_clear`),
  flow: flowOf([{ type: 'transition', scene: `arene-zone${n}` }]),
});

/** Contrat d'expédition : proposition (gated progression) puis paiement au retour (flag _fait). */
const contrat = (key, cond, propose, fait, gold, xp) => [
  {
    text: `📜 ${propose}`,
    when: flagWhen(`${cond},!contrat_${key}`),
    flow: flowOf([
      { type: 'setFlag', flag: `contrat_${key}` },
      { type: 'journal', text: `Contrat accepté — ouvrez la carte du monde (🗺️) pour voyager. ${fait}` },
    ]),
  },
  {
    text: `💰 Toucher la prime — ${propose.replace(/^.*?: /, '')}`,
    when: flagWhen(`contrat_${key}_fait,!contrat_${key}_paye`),
    flow: flowOf([
      { type: 'setFlag', flag: `contrat_${key}_paye` },
      { type: 'giveMoney', gold },
      { type: 'giveXp', amount: xp },
      { type: 'journal', text: 'Le Maître compte les couronnes sans sourciller. « Du travail propre. »' },
    ]),
  },
];

const dlgHub = {
  id: 'dlg-hub',
  start: 'accueil',
  nodes: [
    {
      id: 'accueil',
      speaker: 'Maître d’arène',
      text: 'Tu saignes encore ? Parfait, le sable boit tout. L’échelle t’attend — et pour les plus gourmands, j’ai des contrats au-delà de la palissade.',
      choices: [
        { text: '⚔️ L’échelle de l’arène.', next: 'echelle' },
        { text: '📜 Les contrats d’expédition.', next: 'contrats' },
        {
          text: '🔓 Crocheter le vieux coffre du maître (Test de Crochetage).',
          when: flagWhen('!coffre_pris'),
          flow: testNode(
            { skill: 'Crochetage', difficulty: 'intermediaire', label: 'Crocheter le coffre' },
            [
              { type: 'setFlag', flag: 'coffre_pris' },
              { type: 'giveMoney', gold: 5 },
              { type: 'journal', text: 'Le coffre cède : 5 couronnes !' },
            ],
            [{ type: 'journal', text: 'Le mécanisme rouillé résiste — peut-être plus tard.' }],
          ),
        },
        {
          text: '🏆 Réclamer ton titre de CHAMPION.',
          when: flagWhen('zone13_clear,!champion_fete'),
          flow: flowOf([
            { type: 'setFlag', flag: 'champion_fete' },
            { type: 'giveXp', amount: 300 },
            { type: 'journal', text: 'Le Maître s’incline, et tout le Bourg avec lui : « CHAMPION DE L’ARÈNE ! »' },
            {
              type: 'document',
              title: 'Titre de Champion de l’Arène',
              text: 'Par la présente, le porteur est proclamé CHAMPION DE L’ARÈNE DU BOURG — vainqueur de la Cour, des Ruines, des Égouts, du Charnier, des Lices, du Marais, du Nid, de la Fosse, de la Caverne, du Nid de Vermine, du Cercle Maudit, du Sépulcre… et du Dragon des ténèbres lui-même. Que les tavernes lui servent à boire et que les routes s’écartent.',
            },
            { type: 'interlude', weeks: 2 },
            { type: 'endDialogue' },
          ]),
        },
        {
          text: '🏆 Savourer ta gloire de champion.',
          when: flagWhen('champion_fete'),
          flow: flowOf([
            { type: 'journal', text: 'Le maître s’incline : « CHAMPION DE L’ARÈNE ! »' },
            { type: 'endDialogue' },
          ]),
        },
        { text: 'Plus tard.', flow: flowOf([{ type: 'endDialogue' }]) },
      ],
    },
    {
      id: 'echelle',
      speaker: 'Maître d’arène',
      text: 'Treize portes, treize bourses. On ouvre la suivante quand la précédente est nettoyée. Équipe-toi avant d’entrer — le sable ne rend rien.',
      choices: [
        porte(1, 'La Cour (échauffement)'),
        porte(2, 'Les Ruines'),
        porte(3, 'Les Égouts'),
        porte(4, 'Le Charnier'),
        porte(5, 'Les Lices'),
        porte(6, 'Le Marais'),
        porte(7, 'Le Nid'),
        porte(8, 'La Fosse'),
        porte(9, 'La Caverne du Troll'),
        porte(10, 'Le Nid de Vermine'),
        porte(11, 'Le Cercle Maudit'),
        porte(12, 'Le Sépulcre'),
        porte(13, 'L’Antre du Dragon'),
        { text: '↩ Revenir.', next: 'accueil' },
      ],
    },
    {
      id: 'contrats',
      speaker: 'Maître d’arène',
      text: 'Le Bourg paie pour ce qui rôde au-delà de la palissade. Accepte, puis prends la route par la carte du monde (🗺️). Emporte des RATIONS — la Tavernière en vend : la route creuse l’estomac.',
      choices: [
        ...contrat('foret', 'zone4_clear', 'La Vieille Futaie : des hommes-bêtes ont dressé un camp — et la bande de Bella la Noire détrousse les convois.', 'Méfie-toi : la futaie a des yeux.', 3, 160),
        ...contrat('marais', 'zone6_clear', 'La Tourbière Noire : quelque chose de FABRIQUÉ y traîne les voyageurs sous l’eau.', 'Reste sur les pontons.', 4, 200),
        ...contrat('village', 'zone8_clear', 'Felsbach : le village ne répond plus depuis un mois. Brûle ce qui marche encore.', 'Ne bois pas l’eau du puits.', 5, 240),
        { text: '↩ Revenir.', next: 'accueil' },
      ],
    },
  ],
};

const dlgMedecin = {
  id: 'dlg-medecin',
  start: 'accueil',
  nodes: [
    {
      id: 'accueil',
      speaker: 'Médecin',
      text: 'Encore vivant ? Bien. J’ai des potions, du faxtoryll pour les saignements, des membres de rechange… et la scie, si vraiment il faut OPÉRER.',
      choices: [
        { text: '⚕️ Voir les remèdes et prothèses.', flow: flowOf([{ type: 'openMerchant', entityId: 'medecin' }]) },
        {
          text: '🔪 Passer sur la table (actes payants).',
          // « Une simple visite coûte 4-6 pistoles pour une aide médicale » (LDB 75 l.34) — tarif PAR ACTE.
          flow: flowOf([{
            type: 'medicalAid',
            acts: [
              { act: 'wounds', cost: { silver: 4 } },
              { act: 'bleed', cost: { silver: 4 } },
              { act: 'trauma', cost: { silver: 5 } },
              { act: 'surgery', cost: { silver: 6 } },
            ],
            skill: 55, intBonus: 4, entityId: 'medecin',
          }]),
        },
        { text: 'Plus tard.', flow: flowOf([{ type: 'endDialogue' }]) },
      ],
    },
  ],
};

const dlgForgeron = {
  id: 'dlg-forgeron',
  start: 'accueil',
  nodes: [
    {
      id: 'accueil',
      speaker: 'Forgeron',
      text: 'Le sable bouffe le fil des lames plus vite que les monstres. Montre-moi ton acier — je vends, je rachète, je RÉPARE.',
      choices: [
        { text: '🛒 Armes, armures et réparations.', flow: flowOf([{ type: 'openMerchant', entityId: 'forgeron' }]) },
        { text: 'Plus tard.', flow: flowOf([{ type: 'endDialogue' }]) },
      ],
    },
  ],
};

const dlgEchoppier = {
  id: 'dlg-echoppier',
  start: 'accueil',
  nodes: [
    {
      id: 'accueil',
      speaker: 'Échoppière',
      text: 'Onguents, herbes, cordages, torches — tout ce qui manque quand la nuit tombe sur la route. Entrez, entrez : ma boutique a tout ce que le sable n’a pas encore mangé.',
      choices: [
        { text: '🛒 Voir l’étal (herbes, potions, fournitures).', flow: flowOf([{ type: 'openMerchant', entityId: 'echoppiere' }]) },
        { text: 'Plus tard.', flow: flowOf([{ type: 'endDialogue' }]) },
      ],
    },
  ],
};

const dlgTaverne = {
  id: 'dlg-taverne',
  start: 'accueil',
  nodes: [
    {
      id: 'accueil',
      speaker: 'Tavernière',
      text: 'Bienvenue au Trophée ! Table, chambre, et de quoi remplir les sacoches — la route ne nourrit personne, prenez des RATIONS avant de voyager.',
      choices: [
        { text: '🧺 Voir le garde-manger (rations, vivres, pintes).', flow: flowOf([{ type: 'openMerchant', entityId: 'taverniere' }]) },
        {
          // Repas de MIDI (sans dormir) : prix de groupe d'auteur — la nuit passe par la modale de Repos.
          text: '🍲 Repas chaud pour le groupe — 4 pa.',
          cost: { silver: 4 },
          flow: flowOf([{ type: 'mealParty' }, { type: 'journal', text: 'Ragoût, pain noir et bière : le groupe est nourri pour la journée.' }]),
        },
        {
          // Nuit au Trophée : la MODALE DE REPOS fait le reste (chambre/repas PAR HÉROS, prix RAW
          // dans la modale — plus de forfait sur le choix de dialogue).
          text: '🛏️ Prendre des chambres pour la nuit.',
          flow: flowOf([{ type: 'rest', lodging: 'auberge' }]),
        },
        { text: '👂 Écouter la salle.', next: 'rumeurs' },
        { text: 'Plus tard.', flow: flowOf([{ type: 'endDialogue' }]) },
      ],
    },
    {
      id: 'rumeurs',
      speaker: 'Tavernière',
      text: 'On entend de tout ici, surtout après la troisième pinte…',
      choices: [
        { text: '« Et l’arène ? »', next: 'rumeur-arene' },
        { text: '« Et les routes ? »', next: 'rumeur-routes' },
        { text: '↩ Revenir.', next: 'accueil' },
      ],
    },
    {
      id: 'rumeur-arene',
      speaker: 'Tavernière',
      text: 'Elle essuie une chope, l’œil en coin. « Personne n’a jamais passé la treizième porte. Et entre nous : le Maître fait descendre des carcasses ENTIÈRES là-dessous. On ne nourrit pas un trophée. »',
      choices: [
        { text: '« Bon à savoir. »', flow: flowOf([{ type: 'journal', text: 'Rumeur du Trophée : personne n’a passé la 13e porte — le Maître NOURRIT quelque chose là-dessous.' }, { type: 'endDialogue' }]) },
        { text: '↩ Une autre rumeur.', next: 'rumeurs' },
      ],
    },
    {
      id: 'rumeur-routes',
      speaker: 'Tavernière',
      text: '« La diligence de Felsbach n’est jamais arrivée le mois dernier. Et les charognards qu’on croise en lisière de la Futaie… portent des cottes de voyageurs. Prenez des rations, et voyagez armés. »',
      choices: [
        { text: '« Merci du tuyau. »', flow: flowOf([{ type: 'journal', text: 'Rumeur du Trophée : la diligence de Felsbach a disparu — la Futaie détrousse les convois.' }, { type: 'endDialogue' }]) },
        { text: '↩ Une autre rumeur.', next: 'rumeurs' },
      ],
    },
  ],
};

const dlgFrere = {
  id: 'dlg-frere',
  start: 'accueil',
  nodes: [
    {
      id: 'accueil',
      speaker: 'Frère Anselm',
      text: 'Sigmar garde les braves — et recoud les imprudents. Approche : la chapelle soigne, bénit, et accepte les dons.',
      choices: [
        {
          text: '⚕️ Recevoir des soins (actes payants).',
          flow: flowOf([{ type: 'medicalAid', acts: [{ act: 'wounds', cost: { silver: 5 } }, { act: 'bleed', cost: { silver: 5 } }], skill: 55, intBonus: 4, entityId: 'frere' }]),
        },
        {
          text: '🙏 Recevoir la bénédiction du départ (retrouver la Chance).',
          when: flagWhen('!benediction_recue'),
          flow: flowOf([
            { type: 'restoreFortune' },
            { type: 'setFlag', flag: 'benediction_recue' },
            { type: 'journal', text: 'Frère Anselm trace la comète sur vos fronts : la Chance vous revient.' },
          ]),
        },
        {
          text: '🪙 Faire un don au tronc — 1 co.',
          cost: { gold: 1 },
          flow: flowOf([{ type: 'journal', text: 'La pièce sonne au fond du tronc. Frère Anselm hoche la tête, sincèrement ému.' }]),
        },
        {
          text: '🕯️ Piller le tronc des offrandes (Test de Discrétion).',
          when: flagWhen('!tronc_pille'),
          flow: testNode(
            { skill: 'Discrétion', difficulty: 'difficile', label: 'Piller le tronc sous l’œil de Sigmar' },
            [
              { type: 'setFlag', flag: 'tronc_pille' },
              { type: 'giveMoney', silver: 30 },
              { type: 'journal', text: 'Trente pistoles d’offrandes glissent dans votre poche. Personne n’a rien vu. Sauf, peut-être, Sigmar.' },
            ],
            [
              { type: 'setFlag', flag: 'tronc_pille' },
              { type: 'giveSin', amount: 1 },
              { type: 'journal', text: 'Le tronc bascule avec fracas — le regard de Frère Anselm vous transperce. La honte (et le Péché) vous colle à la peau.' },
            ],
          ),
        },
        { text: 'Plus tard.', flow: flowOf([{ type: 'endDialogue' }]) },
      ],
    },
  ],
};

const dlgGarde = {
  id: 'dlg-garde',
  start: 'accueil',
  nodes: [
    {
      id: 'accueil',
      speaker: 'Garde du Bourg',
      text: 'L’arène est au sud, derrière la porte. La route de l’est mène à la Futaie, à la Tourbière et à Felsbach — si tu tiens à tes jambes, voyage de jour et le ventre plein.',
      choices: [
        { text: '« Rien à signaler ? »', next: 'signalements' },
        { text: 'Plus tard.', flow: flowOf([{ type: 'endDialogue' }]) },
      ],
    },
    {
      id: 'signalements',
      speaker: 'Garde du Bourg',
      text: 'Il hausse les épaules. « Des hurlements dans la Futaie, la nuit. Et plus une lumière à Felsbach depuis un mois. Si tu veux mon avis : reste du bon côté de la palissade. »',
      choices: [
        { text: '« Merci du conseil. »', flow: flowOf([{ type: 'journal', text: 'Le garde : hurlements nocturnes dans la Futaie, Felsbach éteint depuis un mois.' }, { type: 'endDialogue' }]) },
        { text: '↩ Autre chose.', next: 'accueil' },
      ],
    },
  ],
};

const dlgRumeurs = {
  id: 'dlg-rumeurs',
  start: 'accueil',
  nodes: [
    {
      id: 'accueil',
      speaker: 'Villageoise',
      text: 'Vous êtes les nouveaux gladiateurs ? On parie sur vous au lavoir. Enfin… certains.',
      choices: [
        { text: '« Qu’est-ce qui se raconte ? »', next: 'lavoir' },
        { text: 'Plus tard.', flow: flowOf([{ type: 'endDialogue' }]) },
      ],
    },
    {
      id: 'lavoir',
      speaker: 'Villageoise',
      text: 'Elle baisse la voix. « Le Maître garde un vieux coffre dont il a perdu la clef — il dit que c’est sans valeur, mais il dort dessus. Et passez voir Frère Anselm à la chapelle : il bénit ceux qui descendent sur le sable. »',
      choices: [
        { text: '« Intéressant… »', flow: flowOf([{ type: 'journal', text: 'Rumeur du lavoir : le coffre « sans valeur » du Maître, et la bénédiction de Frère Anselm avant le combat.' }, { type: 'endDialogue' }]) },
        { text: '↩ Autre chose.', next: 'accueil' },
      ],
    },
  ],
};

// ── La carte du Bourg (50×40, extérieur, TOUT-EN-SCÈNE) ──────────────────────────────────────
// Une PLACE PAVÉE centrale (maître d'arène, puits, étals, tente du médecin) d'où RAYONNENT des rues
// pavées vers les 4 bâtiments (aux 4 coins), la porte SUD (arène) et la porte EST (route/monde). Chaque
// bâtiment est une GRANDE empreinte dont l'intérieur (sol peint ci-dessous + PNJ/marchand/props) tient
// DEDANS ; le toit se lève en cutaway quand on entre. Les 4 empreintes (posées par `addBuilding`) :
//   taverne  x3..17  y3..12  (15×10, NO) — porte S (10,12)
//   chapelle x34..46 y3..13  (13×11, NE) — porte S (40,13)
//   forge    x3..13  y27..35 (11×9,  SO) — porte N (8,27)
//   échoppe  x36..46 y27..35 (11×9,  SE) — porte N (41,27)
// La grille peint le SOL des intérieurs (`b`=plancher, `m`=marbre, `d`=dalle) — les bâtiments sont posés
// avec `noFloor` pour préserver ce détail. Le reste : `p`=pavé (place+rues), `h`=herbe, base=terre.

const W = 50;
const H = 40;

/** Rect inclusif [x0,x1]×[y0,y1] rempli d'un char (dans la grille). */
function fillRect(grid, x0, y0, x1, y1, ch) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) grid[y][x] = ch;
}

function buildRows() {
  // Base = terre ('.'), bordée d'une palissade '#'.
  const grid = Array.from({ length: H }, () => new Array(W).fill('.'));
  for (let x = 0; x < W; x++) { grid[0][x] = '#'; grid[H - 1][x] = '#'; }
  for (let y = 0; y < H; y++) { grid[y][0] = '#'; grid[y][W - 1] = '#'; }

  // Ceinture d'herbe autour de la place et aux abords des bâtiments (verdure de bourg).
  fillRect(grid, 1, 1, W - 2, H - 2, 'h');

  // Place pavée centrale.
  fillRect(grid, 18, 14, 33, 26, 'p');
  // Rues pavées reliant la place aux 4 portes de bâtiment + aux 2 portes de rempart.
  fillRect(grid, 10, 12, 11, 15, 'p'); // vers la porte de la TAVERNE (10,12) — remonte à la place
  fillRect(grid, 10, 14, 18, 15, 'p'); // rue NO → place
  fillRect(grid, 40, 13, 41, 16, 'p'); // vers la porte de la CHAPELLE (40,13)
  fillRect(grid, 33, 15, 41, 16, 'p'); // rue NE → place
  fillRect(grid, 8, 24, 9, 27, 'p');   // vers la porte de la FORGE (8,27)
  fillRect(grid, 8, 24, 18, 25, 'p');  // rue SO → place
  fillRect(grid, 41, 24, 42, 27, 'p'); // vers la porte de l'ÉCHOPPE (41,27)
  fillRect(grid, 33, 24, 42, 25, 'p'); // rue SE → place
  fillRect(grid, 24, 26, 25, 38, 'p'); // rue SUD → porte de l'arène
  fillRect(grid, 33, 19, 48, 20, 'p'); // rue EST → porte de la route

  // Intérieurs : sol PEINT (le toit + les murs d'arête sont posés par addBuilding avec `noFloor`).
  fillRect(grid, 3, 3, 17, 12, 'b');   // taverne : plancher
  fillRect(grid, 3, 27, 13, 35, 'b');  // forge : plancher
  fillRect(grid, 36, 27, 46, 35, 'b'); // échoppe : plancher
  // Chapelle : nef de marbre centrale bordée de dalle.
  fillRect(grid, 34, 3, 46, 13, 'd');  // dallage
  fillRect(grid, 37, 5, 43, 11, 'm');  // nef de marbre

  // Portes de rempart (tuiles `porte`).
  grid[H - 1][24] = 'D'; grid[H - 1][25] = 'D'; // porte SUD (arène)
  grid[19][W - 1] = 'D'; grid[20][W - 1] = 'D'; // porte EST (route)

  return grid.map((r) => r.join(''));
}

const ROWS = buildRows();

export function makeHub() {
  resetIds();
  return scene({
    id: 'arene-hub',
    nom: 'Le Bourg de l’Arène',
    description: 'Le bourg fortifié qui vit de son arène : taverne, chapelle, forge, échoppe — quatre bâtiments GRANDS ouverts sur une place, et treize portes vers le sable.',
    ambiance: 'exterieur',
    music: { ambient: 'musique-ville' },
    startMessage:
      'LE BOURG DE L’ARÈNE. Une place pavée, quatre bâtiments et treize portes. Le Maître d’arène (au centre) ouvre l’échelle et les contrats. Entrez dans la Taverne (repos, repas, rations), la Chapelle (soins, bénédiction), la Forge (armes, réparations) ou l’Échoppe (herbes, fournitures) — le toit se lève quand vous y pénétrez. La route de l’est part vers le monde (🗺️).',
    rows: ROWS,
    base: 'terre',
    legend: { p: 'pave', h: 'herbe', b: 'plancher', m: 'marbre', d: 'dalle' },
    // Bâtiments TOUT-EN-SCÈNE : toit (cutaway) + murs d'arête `mur-en-bois` + porte, posés par
    // `addBuilding`. `noFloor` : le sol des intérieurs est déjà PEINT dans l'ASCII (préservé). La porte
    // (en CASE) est l'unique arête franchissable, orientée VERS la place.
    buildings: [
      { id: 'taverne', type: 'taverne', foot: { x: 3, y: 3, w: 15, h: 10 }, door: { x: 10, y: 12 }, label: 'Taverne « Au Trophée »', noFloor: true },
      { id: 'chapelle', type: 'chapelle', foot: { x: 34, y: 3, w: 13, h: 11 }, door: { x: 40, y: 13 }, label: 'Chapelle de Sigmar', noFloor: true },
      { id: 'forge', type: 'forge', foot: { x: 3, y: 27, w: 11, h: 9 }, door: { x: 8, y: 27 }, label: 'Forge du Bourg', noFloor: true },
      { id: 'echoppe', type: 'echoppe', foot: { x: 36, y: 27, w: 11, h: 9 }, door: { x: 41, y: 27 }, label: 'Échoppe « Le Bric-à-Broc »', noFloor: true },
    ],
    entities: [
      hero(24, 24),
      // ── Place centrale ──────────────────────────────────────────────────────────────────────
      NPC('maitre', 25, 20, 'Maître d’arène', {
        facing: 'S',
        dialogueId: 'dlg-hub',
        appearance: { species: 'Humains (Reiklander)', career: 'Répurgateur', sex: 'M', build: 0.62 },
        weapon: 'Épée bâtarde',
      }),
      NPC('garde', 25, 34, 'Garde du Bourg', {
        facing: 'S',
        dialogueId: 'dlg-garde',
        appearance: { species: 'Humains (Reiklander)', career: 'Soldat', sex: 'M', build: 0.58 },
        weapon: 'Hallebarde',
      }),
      NPC('villageoise', 21, 22, 'Villageoise', { facing: 'S', dialogueId: 'dlg-rumeurs', anim: 'standing', appearance: { career: 'Mendiant', sex: 'F' } }),
      NPC('villageois-1', 30, 22, 'Villageois', { anim: 'standing', appearance: { career: 'Mendiant' } }),
      NPC('villageois-2', 29, 17, 'Badaud', { anim: 'cowering', facing: 'E', appearance: { career: 'Bourgeois' } }),
      P(20, 18, 'puits'),
      P(28, 16, 'coffre', { label: 'Le coffre du maître' }),
      P(19, 15, 'lampadaire'),
      P(32, 25, 'lampadaire'),
      P(22, 24, 'etal-marche'),
      P(31, 19, 'etal-marche'),
      P(22, 16, 'gibet'),
      P(30, 24, 'pilori'),
      // Médecin : sous sa tente d'infirmerie, au nord de la place (extérieur) — soins & prothèses.
      NPC('medecin', 26, 15, 'Médecin', {
        facing: 'S',
        dialogueId: 'dlg-medecin',
        merchant: { archetype: 'medecin' },
        appearance: { species: 'Humains (Reiklander)', career: 'Apothicaire', sex: 'M', build: 0.46 },
      }),
      P(27, 14, 'tente', { foot: { w: 2, h: 2 }, label: 'Infirmerie' }),
      // Coin entraînement (herbe, ouest de la place)
      P(15, 20, 'mannequin'),
      P(15, 22, 'rack-lances'),
      // Panneau vers la porte de l'arène (sud)
      P(23, 30, 'panneau', { label: '« L’ARÈNE — treize portes, une gloire »' }),
      P(22, 38, 'palissade'),
      P(27, 38, 'palissade'),

      // ── Intérieur : TAVERNE « Au Trophée » (empreinte x3..17 y3..12) ──────────────────────────
      NPC('taverniere', 9, 5, 'Tavernière', {
        facing: 'S',
        dialogueId: 'dlg-taverne',
        merchant: { archetype: 'taverniere' },
        appearance: { career: 'Bourgeois', sex: 'F', build: 0.55 },
      }),
      NPC('client-1', 5, 8, 'Client', { anim: 'feeding', facing: 'E', appearance: { species: 'Nains', career: 'Batelier' } }),
      NPC('client-2', 14, 9, 'Habitué', { anim: 'standing', facing: 'O', appearance: { career: 'Mendiant' } }),
      NPC('client-3', 6, 10, 'Buveur', { anim: 'standing', facing: 'E', appearance: { career: 'Soldat', sex: 'M' } }),
      P(4, 4, 'feu-camp', { label: 'Âtre' }),
      P(12, 4, 'etagere'),
      P(13, 4, 'tonneau'),
      P(14, 4, 'tonneau'),
      P(15, 4, 'crane-monstre', { label: 'LE Trophée' }),
      P(6, 7, 'tonneau', { label: 'Table' }),
      P(12, 7, 'tonneau', { label: 'Table' }),
      P(9, 9, 'tonneau', { label: 'Table' }),
      P(4, 11, 'caisse'),
      P(16, 11, 'tas-foin'),
      P(4, 6, 'tas-foin'),

      // ── Intérieur : CHAPELLE de Sigmar (empreinte x34..46 y3..13, nef de marbre) ──────────────
      NPC('frere', 40, 5, 'Frère Anselm', {
        facing: 'S',
        dialogueId: 'dlg-frere',
        appearance: { species: 'Humains (Reiklander)', career: 'Prêtre', sex: 'M', build: 0.5 },
      }),
      NPC('fidele', 38, 10, 'Fidèle en prière', { anim: 'cowering', facing: 'N', appearance: { career: 'Mendiant', sex: 'F' } }),
      P(40, 4, 'autel'),
      P(38, 4, 'chandelier'),
      P(42, 4, 'chandelier'),
      P(35, 7, 'statue', { label: 'Sigmar Heldenhammer' }),
      P(45, 7, 'statue', { label: 'La Comète à deux queues' }),
      P(35, 11, 'brasero'),
      P(45, 11, 'brasero'),
      P(36, 5, 'urne'),
      P(44, 5, 'urne'),
      P(44, 12, 'coffre', { label: 'Tronc des offrandes' }),

      // ── Intérieur : FORGE du Bourg (empreinte x3..13 y27..35) ─────────────────────────────────
      NPC('forgeron', 8, 33, 'Forgeron', {
        facing: 'N',
        dialogueId: 'dlg-forgeron',
        merchant: { archetype: 'armurier' },
        appearance: { species: 'Nains', career: 'Artisan', sex: 'M', build: 0.7 },
        weapon: 'Marteau de guerre',
      }),
      NPC('apprenti', 11, 31, 'Apprenti', { anim: 'standing', facing: 'O', appearance: { career: 'Artisan', sex: 'M', build: 0.4 } }),
      P(4, 28, 'feu-camp', { label: 'Le foyer' }),
      P(6, 30, 'etabli', { label: 'Établi & enclume' }),
      P(4, 32, 'tonneau', { label: 'Cuve à trempe' }),
      P(12, 28, 'rack-armes'),
      P(12, 29, 'rack-lances'),
      P(12, 34, 'caisse'),
      P(4, 34, 'tonneaux-pile'),

      // ── Intérieur : ÉCHOPPE « Le Bric-à-Broc » (empreinte x36..46 y27..35) ────────────────────
      NPC('echoppiere', 41, 33, 'Échoppière', {
        facing: 'N',
        dialogueId: 'dlg-echoppier',
        merchant: { archetype: 'herboriste' },
        appearance: { career: 'Bourgeois', sex: 'F', build: 0.48 },
      }),
      NPC('chaland', 44, 32, 'Chaland', { anim: 'standing', facing: 'O', appearance: { career: 'Mendiant' } }),
      P(37, 28, 'etal-marche', { label: 'Comptoir' }),
      P(45, 28, 'etagere'),
      P(38, 30, 'etagere'),
      P(45, 30, 'etagere'),
      P(37, 32, 'tonneau'),
      P(45, 34, 'caisse'),
      P(37, 34, 'caisse'),
      P(45, 32, 'tonneaux-pile'),
    ],
    dialogues: [dlgHub, dlgMedecin, dlgGarde, dlgRumeurs, dlgTaverne, dlgFrere, dlgForgeron, dlgEchoppier],
    triggers: [
      // Porte EST (la route) : franchir la porte ouvre la carte du monde — la sortie du Bourg EST le
      // voyage (#T2). Posé sur les tuiles de porte (x49), pas sur l'entryPoint `route` → pas de
      // réouverture intempestive au retour de voyage.
      { id: 'porte-route', rect: { x: 49, y: 19, w: 1, h: 2 }, flow: flowOf([{ type: 'openWorldMap' }]) },
      // Porte SUD (l'arène) : on n'y entre que sur ordre du Maître — rappel in-world.
      {
        id: 'porte-arene-rappel',
        rect: { x: 24, y: 38, w: 2, h: 1 },
        flow: flowOf([{ type: 'journal', text: 'Les portes de l’arène sont barrées de l’intérieur — elles ne s’ouvrent que sur ordre du Maître d’arène (place centrale).' }]),
      },
    ],
    encounters: [],
    entryPoints: { 'porte-arene': { x: 24, y: 37 }, route: { x: 48, y: 20 }, entree: { x: 24, y: 24 } },
    flags: {},
  });
}

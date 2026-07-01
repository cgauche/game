/** Le Bourg de l'Arène (hub refondu, id conservé `arene-hub`) + ses deux intérieurs. */
import { scene, P, NPC, hero, resetIds, fouille, flowOf, flagWhen, testNode } from './lib.mjs';

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

// ── La carte du Bourg (36×26, extérieur) ────────────────────────────────────────────────────
// REDESIGN : une PLACE PAVÉE centrale (x11-24, y9-16) d'où partent des rues vers les 4 bâtiments
// (coins), la porte SUD (arène) et la porte EST (route/monde). Les bâtiments sont GÉNÉREUX et
// lisibles — chacun a son intérieur (scène dédiée) desservi par une porte d'arête sur la place.
//   taverne  6×5 (NO)  porte S    chapelle 6×6 (NE)  porte S
//   forge    6×4 (SO)  porte N    échoppe  6×4 (SE)  porte N
const ROWS = [
  '####################################',
  '#..................................#',
  '#..................................#',
  '#........h................h........#',
  '#........h................h........#',
  '#........h.........................#',
  '#..................................#',
  '#...p..............................#',
  '#...p.........................p....#',
  '#..........pppppppppppppp..........#',
  '#..........pppppppppppppp..........#',
  '#..........pppppppppppppp..........#',
  '#..........ppppppppppppppppppppppppD',
  '#..........ppppppppppppppppppppppppD',
  '#..........pppppppppppppp..........#',
  '#..........pppppppppppppp..........#',
  '#..........pppppppppppppp..........#',
  '#...p............pp...........p....#',
  '#................pp................#',
  '#................pp................#',
  '#........h.......pp.......h........#',
  '#........h.......pp.......h........#',
  '#................pp................#',
  '#................pp................#',
  '#................pp................#',
  '#################DD#################',
];

export function makeHub() {
  resetIds();
  return scene({
    id: 'arene-hub',
    nom: 'Le Bourg de l’Arène',
    description: 'Le bourg fortifié qui vit de son arène : taverne, chapelle, forge, échoppe — autour d’une place, et treize portes vers le sable.',
    ambiance: 'exterieur',
    music: { ambient: 'musique-ville' },
    startMessage:
      'LE BOURG DE L’ARÈNE. Une place pavée, quatre bâtiments et treize portes. Le Maître d’arène (au centre) ouvre l’échelle et les contrats. Taverne (repos, repas, rations), chapelle (soins, bénédiction), forge (armes, réparations), échoppe (herbes, fournitures). La route de l’est part vers le monde (🗺️).',
    rows: ROWS,
    base: 'terre',
    legend: { p: 'pave', h: 'herbe' },
    // Bâtiments composés (toit + murs d'arête + porte + sol planchéié), abattus par `addBuilding`.
    // Empreintes GÉNÉREUSES, implantées aux quatre coins autour de la place ; la porte (en CASE) est
    // l'unique arête franchissable du périmètre, orientée VERS la place. Les 4 ont un INTÉRIEUR.
    buildings: [
      { id: 'taverne', type: 'taverne', foot: { x: 2, y: 2, w: 6, h: 5 }, door: { x: 4, y: 6 }, label: 'Taverne « Au Trophée »' },
      { id: 'chapelle', type: 'chapelle', foot: { x: 28, y: 2, w: 6, h: 6 }, door: { x: 30, y: 7 }, label: 'Chapelle de Sigmar' },
      { id: 'forge', type: 'forge', foot: { x: 2, y: 18, w: 6, h: 4 }, door: { x: 4, y: 18 }, label: 'Forge du Bourg' },
      { id: 'echoppe', type: 'echoppe', foot: { x: 28, y: 18, w: 6, h: 4 }, door: { x: 30, y: 18 }, label: 'Échoppe « Le Bric-à-Broc »' },
    ],
    entities: [
      hero(18, 15),
      NPC('maitre', 17, 11, 'Maître d’arène', {
        facing: 'S',
        dialogueId: 'dlg-hub',
        appearance: { species: 'Humains (Reiklander)', career: 'Répurgateur', sex: 'M', build: 0.62 },
        weapon: 'Épée bâtarde',
      }),
      // Médecin : reste au BOURG, sous sa tente d'infirmerie (nord de la place) — soins & prothèses.
      NPC('medecin', 22, 8, 'Médecin', {
        facing: 'S',
        dialogueId: 'dlg-medecin',
        merchant: { archetype: 'medecin' },
        appearance: { species: 'Humains (Reiklander)', career: 'Apothicaire', sex: 'M', build: 0.46 },
      }),
      NPC('garde', 18, 19, 'Garde du Bourg', {
        facing: 'S',
        dialogueId: 'dlg-garde',
        appearance: { species: 'Humains (Reiklander)', career: 'Soldat', sex: 'M', build: 0.58 },
        weapon: 'Hallebarde',
      }),
      NPC('villageoise', 14, 10, 'Villageoise', { facing: 'S', dialogueId: 'dlg-rumeurs', anim: 'standing', appearance: { career: 'Mendiant', sex: 'F' } }),
      NPC('villageois-1', 21, 15, 'Villageois', { anim: 'standing', appearance: { career: 'Mendiant' } }),
      NPC('villageois-2', 13, 15, 'Badaud', { anim: 'cowering', facing: 'E', appearance: { career: 'Bourgeois' } }),
      // Place centrale : puits, coffre du maître, lampadaires
      P(15, 13, 'puits'),
      P(19, 10, 'coffre', { label: 'Le coffre du maître' }),
      P(12, 9, 'lampadaire'),
      P(23, 16, 'lampadaire'),
      // Marché de la place (étals)
      P(13, 12, 'etal-marche'),
      P(22, 12, 'etal-marche'),
      // Médecin : tente d'infirmerie (nord de la place)
      P(21, 7, 'tente', { foot: { w: 2, h: 2 }, label: 'Infirmerie' }),
      // Devant la taverne (NO) : cour à tonneaux + charrette
      P(9, 3, 'tonneaux-pile'),
      P(9, 5, 'charrette', { foot: { w: 2, h: 1 } }),
      // Coin entraînement (ouest, hors place)
      P(4, 10, 'mannequin'),
      P(4, 12, 'rack-lances'),
      P(2, 8, 'arbre'),
      // Justice du Bourg (est de la place)
      P(24, 10, 'gibet'),
      P(20, 16, 'pilori'),
      P(33, 10, 'arbre'),
      // Devant la forge (SO)
      P(9, 18, 'rack-armes'),
      P(9, 20, 'abreuvoir', { foot: { w: 2, h: 1 } }),
      // Devant l'échoppe (SE) : étals & bric-à-brac
      P(25, 19, 'etal-marche'),
      P(27, 20, 'buisson'),
      // Porte sud (vers l'arène)
      P(15, 24, 'palissade'),
      P(20, 24, 'palissade'),
      P(16, 22, 'panneau', { label: '« L’ARÈNE — treize portes, une gloire »' }),
    ],
    dialogues: [dlgHub, dlgMedecin, dlgGarde, dlgRumeurs],
    triggers: [
      // Intérieurs du Bourg : marcher sur la CASE DE PORTE d'un bâtiment transitionne vers sa scène ;
      // la `sortie` de l'intérieur (transitionBack) ramène ici. L'auteur pose la porte (pas d'auto-magie) ;
      // pas de `once` (ré-entrable), et transitionBack ne re-déclenche pas (transitionTo ≠ checkTriggers).
      { id: 'entrer-taverne', rect: { x: 4, y: 6, w: 1, h: 1 }, flow: flowOf([{ type: 'transition', scene: 'arene-int-taverne', entry: 'entree' }]) },
      { id: 'entrer-chapelle', rect: { x: 30, y: 7, w: 1, h: 1 }, flow: flowOf([{ type: 'transition', scene: 'arene-int-chapelle', entry: 'entree' }]) },
      { id: 'entrer-forge', rect: { x: 4, y: 18, w: 1, h: 1 }, flow: flowOf([{ type: 'transition', scene: 'arene-int-forge', entry: 'entree' }]) },
      { id: 'entrer-echoppe', rect: { x: 30, y: 18, w: 1, h: 1 }, flow: flowOf([{ type: 'transition', scene: 'arene-int-echoppe', entry: 'entree' }]) },
      // Porte EST (la route) : franchir la porte ouvre la carte du monde — la sortie du Bourg EST le
      // voyage (#T2). Posé sur les tuiles de porte (x35), pas sur l'entryPoint `route` (34,12) → pas de
      // réouverture intempestive au retour de voyage.
      { id: 'porte-route', rect: { x: 35, y: 12, w: 1, h: 2 }, flow: flowOf([{ type: 'openWorldMap' }]) },
      // Porte SUD (l'arène) : on n'y entre que sur ordre du Maître — rappel in-world.
      {
        id: 'porte-arene-rappel',
        rect: { x: 17, y: 24, w: 2, h: 1 },
        flow: flowOf([{ type: 'journal', text: 'Les portes de l’arène sont barrées de l’intérieur — elles ne s’ouvrent que sur ordre du Maître d’arène (place centrale).' }],),
      },
    ],
    encounters: [],
    entryPoints: { 'porte-arene': { x: 17, y: 24 }, route: { x: 34, y: 12 }, entree: { x: 18, y: 15 } },
    flags: {},
  });
}

// ── Intérieur : taverne « Au Trophée » ──────────────────────────────────────────────────────

const TAVERNE_ROWS = [
  '###############',
  '#.............#',
  '#.............#',
  '#.............#',
  '#.............#',
  '#.............#',
  '#.............#',
  '#.............#',
  '#.............#',
  '#######D#######',
];

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

export function makeTaverne() {
  resetIds();
  return scene({
    id: 'arene-int-taverne',
    nom: 'Taverne « Au Trophée »',
    description: 'La salle commune de la taverne du Bourg.',
    ambiance: 'interieur',
    music: { ambient: 'musique-taverne' },
    startMessage: 'La salle du Trophée : feu, ragoût, rumeurs. La Tavernière vend des RATIONS pour la route.',
    rows: TAVERNE_ROWS,
    base: 'plancher',
    entities: [
      hero(7, 8),
      NPC('taverniere', 7, 2, 'Tavernière', {
        facing: 'S',
        dialogueId: 'dlg-taverne',
        merchant: { archetype: 'taverniere' },
        appearance: { career: 'Bourgeois', sex: 'F', build: 0.55 },
      }),
      NPC('client-1', 3, 5, 'Client', { anim: 'feeding', facing: 'E', appearance: { species: 'Nains', career: 'Batelier' } }),
      NPC('client-2', 11, 6, 'Habitué', { anim: 'standing', facing: 'O', appearance: { career: 'Mendiant' } }),
      NPC('client-3', 4, 7, 'Buveur', { anim: 'standing', facing: 'E', appearance: { career: 'Soldat', sex: 'M' } }),
      // Comptoir & âtre (nord)
      P(2, 1, 'feu-camp', { label: 'Âtre' }),
      P(9, 1, 'etagere'),
      P(10, 1, 'tonneau'),
      P(11, 1, 'tonneau'),
      P(12, 1, 'crane-monstre', { label: 'LE Trophée' }),
      // Salle : tables & tabourets
      P(4, 4, 'tonneau', { label: 'Table' }),
      P(10, 4, 'tonneau', { label: 'Table' }),
      P(7, 6, 'tonneau', { label: 'Table' }),
      // Réserve (coins)
      P(2, 8, 'caisse'),
      P(12, 8, 'tas-foin'),
      P(2, 4, 'tas-foin'),
    ],
    dialogues: [dlgTaverne],
    triggers: [{ id: 'sortie', rect: { x: 7, y: 9, w: 1, h: 1 }, flow: flowOf([{ type: 'transitionBack' }]) }],
    encounters: [],
    entryPoints: { entree: { x: 7, y: 8 } },
    flags: {},
  });
}

// ── Intérieur : chapelle de Sigmar ──────────────────────────────────────────────────────────

const CHAPELLE_ROWS = [
  '#############',
  '#...........#',
  '#...........#',
  '#..mmmmmmm..#',
  '#..mmmmmmm..#',
  '#..mmmmmmm..#',
  '#..mmmmmmm..#',
  '#..mmmmmmm..#',
  '#...........#',
  '#...........#',
  '######D######',
];

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

export function makeChapelle() {
  resetIds();
  return scene({
    id: 'arene-int-chapelle',
    nom: 'Chapelle de Sigmar',
    description: 'La petite chapelle du Bourg — nef de marbre, autel à la comète.',
    ambiance: 'interieur',
    startMessage: 'La chapelle de Sigmar. Frère Anselm soigne les corps, bénit les âmes — et surveille son tronc.',
    rows: CHAPELLE_ROWS,
    base: 'dalle',
    legend: { m: 'marbre' },
    entities: [
      hero(6, 9),
      NPC('frere', 6, 4, 'Frère Anselm', {
        facing: 'S',
        dialogueId: 'dlg-frere',
        appearance: { species: 'Humains (Reiklander)', career: 'Prêtre', sex: 'M', build: 0.5 },
      }),
      NPC('fidele', 4, 7, 'Fidèle en prière', { anim: 'cowering', facing: 'N', appearance: { career: 'Mendiant', sex: 'F' } }),
      // Chœur (nord) : autel & chandeliers
      P(6, 2, 'autel'),
      P(4, 2, 'chandelier'),
      P(8, 2, 'chandelier'),
      // Nef : statue de Sigmar, urnes, braseros bordant l'allée
      P(2, 5, 'statue', { label: 'Sigmar Heldenhammer' }),
      P(10, 5, 'statue', { label: 'La Comète à deux queues' }),
      P(2, 8, 'brasero'),
      P(10, 8, 'brasero'),
      P(3, 3, 'urne'),
      P(9, 3, 'urne'),
      // Tronc des offrandes (près de la sortie)
      P(10, 9, 'coffre', { label: 'Tronc des offrandes' }),
    ],
    dialogues: [dlgFrere],
    triggers: [{ id: 'sortie', rect: { x: 6, y: 10, w: 1, h: 1 }, flow: flowOf([{ type: 'transitionBack' }]) }],
    encounters: [],
    entryPoints: { entree: { x: 6, y: 9 } },
    flags: {},
  });
}

// ── Intérieur : forge du Bourg ────────────────────────────────────────────────────────────────

export function makeForge() {
  resetIds();
  return scene({
    id: 'arene-int-forge',
    nom: 'Forge du Bourg',
    description: 'L’atelier du forgeron nain — enclume, foyer rougeoyant, râteliers d’acier.',
    ambiance: 'interieur',
    music: { ambient: 'musique-ville' },
    startMessage: 'LA FORGE. Le foyer ronfle, l’enclume sonne. Le Forgeron vend armes et armures, rachète et RÉPARE l’acier émoussé par le sable.',
    rows: [
      '###########',
      '#.........#',
      '#.........#',
      '#.........#',
      '#.........#',
      '#.........#',
      '#.........#',
      '#.........#',
      '#####D#####',
    ],
    base: 'plancher',
    entities: [
      hero(5, 7),
      NPC('forgeron', 5, 2, 'Forgeron', {
        facing: 'S',
        dialogueId: 'dlg-forgeron',
        merchant: { archetype: 'armurier' },
        appearance: { species: 'Nains', career: 'Artisan', sex: 'M', build: 0.7 },
        weapon: 'Marteau de guerre',
      }),
      NPC('apprenti', 8, 5, 'Apprenti', { anim: 'standing', facing: 'O', appearance: { career: 'Artisan', sex: 'M', build: 0.4 } }),
      // Le foyer & l'établi (cœur de l'atelier)
      P(2, 1, 'feu-camp', { label: 'Le foyer' }),
      P(3, 3, 'etabli', { label: 'Établi & enclume' }),
      P(2, 5, 'tonneau', { label: 'Cuve à trempe' }),
      // Râteliers & réserve
      P(8, 1, 'rack-armes'),
      P(8, 2, 'rack-lances'),
      P(8, 7, 'caisse'),
      P(2, 7, 'tonneaux-pile'),
    ],
    dialogues: [dlgForgeron],
    triggers: [{ id: 'sortie', rect: { x: 5, y: 8, w: 1, h: 1 }, flow: flowOf([{ type: 'transitionBack' }]) }],
    encounters: [],
    entryPoints: { entree: { x: 5, y: 7 } },
    flags: {},
  });
}

// ── Intérieur : échoppe « Le Bric-à-Broc » ────────────────────────────────────────────────────

export function makeEchoppe() {
  resetIds();
  return scene({
    id: 'arene-int-echoppe',
    nom: 'Échoppe « Le Bric-à-Broc »',
    description: 'La boutique fourre-tout du Bourg — herbes, potions, cordages, torches et curiosités.',
    ambiance: 'interieur',
    music: { ambient: 'musique-ville' },
    startMessage: 'L’ÉCHOPPE. Bocaux, fagots d’herbes et cordages du sol au plafond. L’Échoppière vend herbes, potions et fournitures pour la route.',
    rows: [
      '###########',
      '#.........#',
      '#.........#',
      '#.........#',
      '#.........#',
      '#.........#',
      '#.........#',
      '#.........#',
      '#####D#####',
    ],
    base: 'plancher',
    entities: [
      hero(5, 7),
      NPC('echoppiere', 5, 2, 'Échoppière', {
        facing: 'S',
        dialogueId: 'dlg-echoppier',
        merchant: { archetype: 'herboriste' },
        appearance: { career: 'Bourgeois', sex: 'F', build: 0.48 },
      }),
      NPC('chaland', 8, 6, 'Chaland', { anim: 'standing', facing: 'O', appearance: { career: 'Mendiant' } }),
      // Comptoir & étagères (nord)
      P(2, 1, 'etal-marche', { label: 'Comptoir' }),
      P(8, 1, 'etagere'),
      P(3, 3, 'etagere'),
      P(8, 3, 'etagere'),
      // Marchandises : tonneaux, caisses, bric-à-brac
      P(2, 5, 'tonneau'),
      P(8, 5, 'caisse'),
      P(2, 7, 'caisse'),
      P(8, 7, 'tonneaux-pile'),
    ],
    dialogues: [dlgEchoppier],
    triggers: [{ id: 'sortie', rect: { x: 5, y: 8, w: 1, h: 1 }, flow: flowOf([{ type: 'transitionBack' }]) }],
    encounters: [],
    entryPoints: { entree: { x: 5, y: 7 } },
    flags: {},
  });
}

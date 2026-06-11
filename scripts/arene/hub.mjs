/** Le Bourg de l'Arène (hub refondu, id conservé `arene-hub`) + ses deux intérieurs. */
import { scene, P, NPC, hero, resetIds, fouille } from './lib.mjs';

// ── Dialogues du Bourg ──────────────────────────────────────────────────────────────────────

/** Porte d'une zone de l'échelle : visible quand la précédente est nettoyée, pas la suivante. */
const porte = (n, nom) => ({
  text: `⚔️ Entrer — ${nom}.`,
  condition: n === 1 ? '!zone1_clear' : `zone${n - 1}_clear,!zone${n}_clear`,
  effects: [{ type: 'transition', scene: `arene-zone${n}` }],
});

/** Contrat d'expédition : proposition (gated progression) puis paiement au retour (flag _fait). */
const contrat = (key, cond, propose, fait, gold, xp) => [
  {
    text: `📜 ${propose}`,
    condition: `${cond},!contrat_${key}`,
    effects: [
      { type: 'setFlag', flag: `contrat_${key}` },
      { type: 'journal', text: `Contrat accepté — ouvrez la carte du monde (🗺️) pour voyager. ${fait}` },
    ],
  },
  {
    text: `💰 Toucher la prime — ${propose.replace(/^.*?: /, '')}`,
    condition: `contrat_${key}_fait,!contrat_${key}_paye`,
    effects: [
      { type: 'setFlag', flag: `contrat_${key}_paye` },
      { type: 'giveMoney', gold },
      { type: 'giveXp', amount: xp },
      { type: 'journal', text: 'Le Maître compte les couronnes sans sourciller. « Du travail propre. »' },
    ],
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
          condition: '!coffre_pris',
          effects: [
            {
              type: 'test',
              skill: 'Crochetage',
              difficulty: 'intermediaire',
              label: 'Crocheter le coffre',
              onSuccess: [
                { type: 'setFlag', flag: 'coffre_pris' },
                { type: 'giveMoney', gold: 5 },
                { type: 'journal', text: 'Le coffre cède : 5 couronnes !' },
              ],
              onFailure: [{ type: 'journal', text: 'Le mécanisme rouillé résiste — peut-être plus tard.' }],
            },
          ],
        },
        {
          text: '🏆 Réclamer ton titre de CHAMPION.',
          condition: 'zone13_clear,!champion_fete',
          effects: [
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
          ],
        },
        {
          text: '🏆 Savourer ta gloire de champion.',
          condition: 'champion_fete',
          effects: [
            { type: 'journal', text: 'Le maître s’incline : « CHAMPION DE L’ARÈNE ! »' },
            { type: 'endDialogue' },
          ],
        },
        { text: 'Plus tard.', effects: [{ type: 'endDialogue' }] },
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
        { text: '⚕️ Voir les remèdes et prothèses.', effects: [{ type: 'openMerchant', entityId: 'medecin' }] },
        {
          text: '🔪 Opérer une blessure grave (Chirurgie) — 6 pa.',
          cost: { silver: 6 },
          effects: [{ type: 'medicalAid', act: 'surgery', skill: 55, intBonus: 4, entityId: 'medecin' }],
        },
        { text: 'Plus tard.', effects: [{ type: 'endDialogue' }] },
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
        { text: '🛒 Armes, armures et réparations.', effects: [{ type: 'openMerchant', entityId: 'forgeron' }] },
        { text: 'Plus tard.', effects: [{ type: 'endDialogue' }] },
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
        { text: 'Plus tard.', effects: [{ type: 'endDialogue' }] },
      ],
    },
    {
      id: 'signalements',
      speaker: 'Garde du Bourg',
      text: 'Il hausse les épaules. « Des hurlements dans la Futaie, la nuit. Et plus une lumière à Felsbach depuis un mois. Si tu veux mon avis : reste du bon côté de la palissade. »',
      choices: [
        { text: '« Merci du conseil. »', effects: [{ type: 'journal', text: 'Le garde : hurlements nocturnes dans la Futaie, Felsbach éteint depuis un mois.' }, { type: 'endDialogue' }] },
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
        { text: 'Plus tard.', effects: [{ type: 'endDialogue' }] },
      ],
    },
    {
      id: 'lavoir',
      speaker: 'Villageoise',
      text: 'Elle baisse la voix. « Le Maître garde un vieux coffre dont il a perdu la clef — il dit que c’est sans valeur, mais il dort dessus. Et passez voir Frère Anselm à la chapelle : il bénit ceux qui descendent sur le sable. »',
      choices: [
        { text: '« Intéressant… »', effects: [{ type: 'journal', text: 'Rumeur du lavoir : le coffre « sans valeur » du Maître, et la bénédiction de Frère Anselm avant le combat.' }, { type: 'endDialogue' }] },
        { text: '↩ Autre chose.', next: 'accueil' },
      ],
    },
  ],
};

// ── La carte du Bourg (32×22, extérieur — l'horloge jour/nuit s'y voit enfin) ───────────────

const ROWS = [
  '################################',
  '#hh............................#',
  '#hh............................#',
  '#..............................#',
  '#..............................#',
  '#..............................#',
  '#..............................#',
  '#..............................#',
  '#.........pppppppppppp.........#',
  '#.........pppppppppppp.........#',
  '#.........pppppppppppp.........D',
  '#.........pppppppppppp.........D',
  '#.........pppppppppppp.........#',
  '#.........pppppppppppp.........#',
  '#..............................#',
  '#..............................#',
  '#..............................#',
  '#hh............................#',
  '#hh............................#',
  '#..............................#',
  '#..............................#',
  '###############DD###############',
];

export function makeHub() {
  resetIds();
  return scene({
    id: 'arene-hub',
    nom: 'Le Bourg de l’Arène',
    description: 'Le bourg fortifié qui vit de son arène : taverne, chapelle, forge — et treize portes vers le sable.',
    ambiance: 'exterieur',
    music: { ambient: 'musique-ville' },
    startMessage:
      'LE BOURG DE L’ARÈNE. Le Maître d’arène (place centrale) ouvre l’échelle et les contrats. Taverne (repos, repas, rations), chapelle (soins, bénédiction), forge (équipement, réparations). La route de l’est part vers le monde (🗺️).',
    rows: ROWS,
    base: 'terre',
    legend: { p: 'pave', h: 'herbe' },
    buildings: [
      { id: 'taverne', type: 'taverne', foot: { x: 3, y: 2, w: 4, h: 3 }, facing: 'S', reveal: 'door', door: { x: 5, y: 4 }, interiorScene: 'arene-int-taverne', entry: 'entree', label: 'Taverne « Au Trophée »' },
      { id: 'chapelle', type: 'chapelle', foot: { x: 25, y: 2, w: 4, h: 5 }, facing: 'S', reveal: 'door', door: { x: 27, y: 6 }, interiorScene: 'arene-int-chapelle', entry: 'entree', label: 'Chapelle de Sigmar' },
      { id: 'forge', type: 'forge', foot: { x: 3, y: 15, w: 3, h: 2 }, facing: 'S', reveal: 'cutaway', door: { x: 4, y: 16 }, label: 'Forge' },
      { id: 'echoppe', type: 'echoppe', foot: { x: 25, y: 15, w: 2, h: 2 }, facing: 'S', reveal: 'cutaway', door: { x: 26, y: 16 }, label: 'Échoppe' },
    ],
    entities: [
      hero(16, 12),
      NPC('maitre', 13, 9, 'Maître d’arène', {
        facing: 'E',
        dialogueId: 'dlg-hub',
        appearance: { species: 'Humains (Reiklander)', career: 'Répurgateur', sex: 'M', build: 0.62 },
        weapon: 'Épée bâtarde',
      }),
      NPC('medecin', 20, 5, 'Médecin', {
        facing: 'S',
        dialogueId: 'dlg-medecin',
        merchant: { archetype: 'medecin' },
        appearance: { species: 'Humains (Reiklander)', career: 'Apothicaire', sex: 'M', build: 0.46 },
      }),
      NPC('forgeron', 5, 18, 'Forgeron', {
        facing: 'N',
        dialogueId: 'dlg-forgeron',
        merchant: { archetype: 'armurier' },
        appearance: { species: 'Nains', career: 'Artisan', sex: 'M', build: 0.7 },
        weapon: 'Marteau de guerre',
      }),
      NPC('garde', 14, 19, 'Garde du Bourg', {
        facing: 'S',
        dialogueId: 'dlg-garde',
        appearance: { species: 'Humains (Reiklander)', career: 'Soldat', sex: 'M', build: 0.58 },
        weapon: 'Hallebarde',
      }),
      NPC('villageoise', 12, 7, 'Villageoise', { facing: 'S', dialogueId: 'dlg-rumeurs', anim: 'standing', appearance: { sex: 'F' } }),
      NPC('villageois-1', 10, 15, 'Villageois', { anim: 'standing' }),
      NPC('villageois-2', 18, 15, 'Badaud', { anim: 'cowering', facing: 'E' }),
      // Place centrale
      P(15, 10, 'puits'),
      P(12, 8, 'coffre', { label: 'Le coffre du maître' }),
      P(10, 8, 'lampadaire'),
      P(21, 13, 'lampadaire'),
      // Marché (nord de la place)
      P(11, 6, 'etal-marche'),
      P(13, 6, 'etal-marche'),
      // Médecin : tente d'infirmerie
      P(20, 3, 'tente', { foot: { w: 2, h: 2 }, label: 'Infirmerie' }),
      // Coin entraînement (ouest)
      P(6, 8, 'mannequin'),
      P(6, 10, 'rack-lances'),
      // Taverne : cour à tonneaux + charrette
      P(7, 3, 'tonneaux-pile'),
      P(8, 5, 'charrette', { foot: { w: 2, h: 1 } }),
      // Justice du Bourg (est)
      P(24, 12, 'gibet'),
      P(19, 14, 'pilori'),
      // Forge / écurie (sud-ouest)
      P(7, 17, 'rack-armes'),
      P(8, 18, 'abreuvoir', { foot: { w: 2, h: 1 } }),
      P(2, 13, 'arbre'),
      // Campement des suivants (sud-est)
      P(24, 17, 'tente', { foot: { w: 2, h: 2 } }),
      P(23, 19, 'feu-camp'),
      P(28, 18, 'arbre'),
      P(29, 19, 'buisson'),
      // Porte sud (vers l'arène)
      P(12, 20, 'palissade'),
      P(19, 20, 'palissade'),
      P(17, 18, 'panneau', { label: '« L’ARÈNE — treize portes, une gloire »' }),
    ],
    dialogues: [dlgHub, dlgMedecin, dlgForgeron, dlgGarde, dlgRumeurs],
    triggers: [
      // Porte EST (la route) : franchir la porte ouvre la carte du monde — la sortie du Bourg
      // EST le voyage (#T2). Posé sur les tuiles de porte (x31), pas sur l'entryPoint `route`
      // (30,10) → pas de réouverture intempestive au retour de voyage.
      { id: 'porte-route', rect: { x: 31, y: 10, w: 1, h: 2 }, effects: [{ type: 'openWorldMap' }] },
      // Porte SUD (l'arène) : on n'y entre que sur ordre du Maître — rappel in-world.
      {
        id: 'porte-arene-rappel',
        rect: { x: 15, y: 21, w: 2, h: 1 },
        effects: [{ type: 'journal', text: 'Les portes de l’arène sont barrées de l’intérieur — elles ne s’ouvrent que sur ordre du Maître d’arène (place centrale).' }],
      },
    ],
    encounters: [],
    entryPoints: { 'porte-arene': { x: 15, y: 20 }, route: { x: 30, y: 10 }, entree: { x: 16, y: 12 } },
    flags: {},
  });
}

// ── Intérieur : taverne « Au Trophée » ──────────────────────────────────────────────────────

const TAVERNE_ROWS = [
  '#############',
  '#...........#',
  '#...........#',
  '#...........#',
  '#...........#',
  '#...........#',
  '#...........#',
  '#...........#',
  '######D######',
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
        { text: '🧺 Voir le garde-manger (rations, vivres, pintes).', effects: [{ type: 'openMerchant', entityId: 'taverniere' }] },
        {
          text: '🍲 Repas chaud pour le groupe — 4 pa (LDB p.302).',
          cost: { silver: 4 },
          effects: [{ type: 'mealParty' }, { type: 'journal', text: 'Ragoût, pain noir et bière : le groupe est nourri pour la journée.' }],
        },
        {
          // Gîte ET couvert : dormir sans souper affamerait le groupe pendant la nuit (Faim RAW) —
          // l'auberge nourrit TOUJOURS ses dormeurs (repas du soir compris dans le prix).
          text: '🛏️ Souper et dormir — gîte et couvert pour le groupe, 7 pa.',
          cost: { silver: 7 },
          effects: [
            { type: 'mealParty' },
            { type: 'rest' },
            { type: 'journal', text: 'Ventres pleins et paillasses propres : le Trophée veille sur vos rêves jusqu’à l’aube.' },
          ],
        },
        { text: '👂 Écouter la salle.', next: 'rumeurs' },
        { text: 'Plus tard.', effects: [{ type: 'endDialogue' }] },
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
        { text: '« Bon à savoir. »', effects: [{ type: 'journal', text: 'Rumeur du Trophée : personne n’a passé la 13e porte — le Maître NOURRIT quelque chose là-dessous.' }, { type: 'endDialogue' }] },
        { text: '↩ Une autre rumeur.', next: 'rumeurs' },
      ],
    },
    {
      id: 'rumeur-routes',
      speaker: 'Tavernière',
      text: '« La diligence de Felsbach n’est jamais arrivée le mois dernier. Et les charognards qu’on croise en lisière de la Futaie… portent des cottes de voyageurs. Prenez des rations, et voyagez armés. »',
      choices: [
        { text: '« Merci du tuyau. »', effects: [{ type: 'journal', text: 'Rumeur du Trophée : la diligence de Felsbach a disparu — la Futaie détrousse les convois.' }, { type: 'endDialogue' }] },
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
      hero(6, 7),
      NPC('taverniere', 7, 2, 'Tavernière', {
        facing: 'S',
        dialogueId: 'dlg-taverne',
        merchant: { archetype: 'taverniere' },
        appearance: { sex: 'F', build: 0.55 },
      }),
      NPC('client-1', 3, 4, 'Client', { anim: 'feeding', facing: 'E' }),
      NPC('client-2', 9, 5, 'Habitué', { anim: 'standing', facing: 'O' }),
      P(2, 2, 'feu-camp', { label: 'Âtre' }),
      P(8, 1, 'etagere'),
      P(9, 1, 'tonneau'),
      P(10, 1, 'tonneau'),
      P(2, 6, 'caisse'),
      P(4, 4, 'tonneau', { label: 'Table' }),
      P(9, 4, 'tonneau', { label: 'Table' }),
      P(11, 6, 'tas-foin'),
      P(1, 1, 'crane-monstre', { label: 'LE Trophée' }),
    ],
    dialogues: [dlgTaverne],
    triggers: [{ id: 'sortie', rect: { x: 6, y: 8, w: 1, h: 1 }, effects: [{ type: 'transitionBack' }] }],
    encounters: [],
    entryPoints: { entree: { x: 6, y: 7 } },
    flags: {},
  });
}

// ── Intérieur : chapelle de Sigmar ──────────────────────────────────────────────────────────

const CHAPELLE_ROWS = [
  '###########',
  '#.........#',
  '#.........#',
  '#.mmmmmmm.#',
  '#.mmmmmmm.#',
  '#.mmmmmmm.#',
  '#.mmmmmmm.#',
  '#.........#',
  '#.........#',
  '#####D#####',
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
          text: '🩹 Soin des Blessures (jet de Guérison) — 5 pa.',
          cost: { silver: 5 },
          effects: [{ type: 'medicalAid', act: 'wounds', skill: 55, intBonus: 4, entityId: 'frere' }],
        },
        {
          text: '🩸 Stopper une hémorragie (jet de Guérison) — 5 pa.',
          cost: { silver: 5 },
          effects: [{ type: 'medicalAid', act: 'bleed', skill: 55, intBonus: 4, entityId: 'frere' }],
        },
        {
          text: '🙏 Recevoir la bénédiction du départ (retrouver la Chance).',
          condition: '!benediction_recue',
          effects: [
            { type: 'restoreFortune' },
            { type: 'setFlag', flag: 'benediction_recue' },
            { type: 'journal', text: 'Frère Anselm trace la comète sur vos fronts : la Chance vous revient.' },
          ],
        },
        {
          text: '🪙 Faire un don au tronc — 1 co.',
          cost: { gold: 1 },
          effects: [{ type: 'journal', text: 'La pièce sonne au fond du tronc. Frère Anselm hoche la tête, sincèrement ému.' }],
        },
        {
          text: '🕯️ Piller le tronc des offrandes (Test de Discrétion).',
          condition: '!tronc_pille',
          effects: [
            {
              type: 'test',
              skill: 'Discrétion',
              difficulty: 'difficile',
              label: 'Piller le tronc sous l’œil de Sigmar',
              onSuccess: [
                { type: 'setFlag', flag: 'tronc_pille' },
                { type: 'giveMoney', silver: 30 },
                { type: 'journal', text: 'Trente pistoles d’offrandes glissent dans votre poche. Personne n’a rien vu. Sauf, peut-être, Sigmar.' },
              ],
              onFailure: [
                { type: 'setFlag', flag: 'tronc_pille' },
                { type: 'giveSin', amount: 1 },
                { type: 'journal', text: 'Le tronc bascule avec fracas — le regard de Frère Anselm vous transperce. La honte (et le Péché) vous colle à la peau.' },
              ],
            },
          ],
        },
        { text: 'Plus tard.', effects: [{ type: 'endDialogue' }] },
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
      hero(5, 8),
      NPC('frere', 5, 4, 'Frère Anselm', {
        facing: 'S',
        dialogueId: 'dlg-frere',
        appearance: { species: 'Humains (Reiklander)', career: 'Prêtre', sex: 'M', build: 0.5 },
      }),
      P(5, 2, 'autel'),
      P(3, 2, 'chandelier'),
      P(7, 2, 'chandelier'),
      P(2, 5, 'statue', { label: 'Sigmar Heldenhammer' }),
      P(8, 5, 'urne'),
      P(2, 7, 'brasero'),
      P(8, 7, 'brasero'),
      P(8, 8, 'coffre', { label: 'Tronc des offrandes' }),
    ],
    dialogues: [dlgFrere],
    triggers: [{ id: 'sortie', rect: { x: 5, y: 9, w: 1, h: 1 }, effects: [{ type: 'transitionBack' }] }],
    encounters: [],
    entryPoints: { entree: { x: 5, y: 8 } },
    flags: {},
  });
}

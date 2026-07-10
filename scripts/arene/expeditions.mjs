/** Expéditions de la carte du monde (#T2) — on y VOYAGE depuis le Bourg (rations, péripéties,
 *  embuscades), on en revient par la carte. Pas de retour-hub automatique : la route est le retour. */
import { scene, P, NPC, hero, resetIds, fouille, fightTrigger, testNode, flowOf } from '../campagne/lib.mjs';

// ── La Vieille Futaie (40×28) : harde en lisière + camp de Bella la Noire (PNJ nommée) ──────

export function makeForet() {
  resetIds();
  return scene({
    id: 'arene-exp-foret',
    nom: 'La Vieille Futaie',
    description: 'La grande forêt à l’est du Bourg — hommes-bêtes en lisière, brigands au cœur.',
    startMessage:
      'LA VIEILLE FUTAIE. La harde chasse en lisière — et au cœur du bois, la bande de BELLA LA NOIRE compte son butin. Les herbes du sous-bois valent leur pesant d’or.',
    rows: [
      '########################################',
      '#bb......bbb............bb.........bbb.#',
      '#bbb......bb........................bb.#',
      '#bb....................b...........bb..#',
      '#b.....................b...............#',
      '#......hh..............bb..............#',
      '#......hh...............b..............#',
      '#......................................#',
      '#..bb..................................#',
      '#..bbb.........bbb.....................#',
      '#..............bbb..........bb.........#',
      '#...............b..........bbb.........#',
      '#......................................#',
      '#......................................#',
      '#.........b............................#',
      '#.........bb...........hh..............#',
      '#......................hh..............#',
      '#......................................#',
      '#............bb........................#',
      '#............bb........................#',
      '#......................................#',
      '#...bb.................................#',
      '#...bb.........................bb......#',
      '#..............................bbb.....#',
      '#......................................#',
      '#......................................#',
      '#..............b.......................#',
      '########################################',
    ],
    base: 'herbe',
    legend: { b: 'bois', h: 'herbe' },
    entities: [
      hero(2, 13),
      P(12, 4, 'arbre'),
      P(28, 7, 'arbre'),
      P(7, 19, 'arbre'),
      P(34, 14, 'arbre'),
      P(20, 22, 'arbre'),
      P(26, 3, 'arbre-mort'),
      P(10, 24, 'souche'),
      P(31, 19, 'souche'),
      P(5, 8, 'buisson'),
      P(24, 12, 'buisson'),
      P(35, 24, 'buisson'),
      P(8, 5, 'champignon', {
        label: 'Herbes de sous-bois',
        ...fouille([
          { type: 'giveTrapping', trapping: 'Racine de terre' },
          { type: 'journal', text: 'De la racine de terre, fraîche — l’apothicaire du Bourg en redemande.' },
        ]),
      }),
      P(27, 24, 'champignon', {
        label: 'Talus à faxtoryll',
        ...fouille([
          { type: 'giveTrapping', trapping: 'Faxtoryll' },
          { type: 'journal', text: 'Du faxtoryll sauvage : de quoi étancher une mauvaise plaie.' },
        ]),
      }),
      // Le camp de Bella (cœur du bois, est)
      P(30, 9, 'tente', { foot: { w: 2, h: 2 }, label: 'Tente de Bella' }),
      P(28, 12, 'feu-camp'),
      P(33, 12, 'tonneaux-pile'),
      P(27, 10, 'charrette', { foot: { w: 2, h: 1 }, label: 'Butin des convois' }),
      P(34, 8, 'coffre', {
        label: 'Coffre de la bande',
        ...fouille([
          { type: 'giveMoney', gold: 5 },
          { type: 'giveTrapping', trapping: 'Rapière', qualities: ['Raffiné'] },
          { type: 'journal', text: 'Le coffre de Bella : 5 co… et une rapière de duelliste, raffinée, prise à quelque noble détroussé.' },
        ]),
      }),
      P(16, 6, 'gibet', { label: 'L’avertissement de Bella' }),
    ],
    triggers: [
      fightTrigger('enc-foret-harde', { x: 5, y: 1, w: 18, h: 25 }),
      fightTrigger('enc-foret-bande', { x: 25, y: 6, w: 14, h: 10 }),
    ],
    encounters: [
      {
        // La harde en lisière : embuscade — invisible jusqu'au combat (brouillard de sous-bois),
        // + Test de Surprise opposé (la Perception du groupe peut la déjouer).
        id: 'enc-foret-harde',
        surprise: 'party',
        hidden: true,
        enemies: [
          { ref: 'gor', pos: { x: 12, y: 9 } },
          { ref: 'gor', pos: { x: 18, y: 16 }, optionals: ['Armure 2'] },
          { ref: 'ungor', pos: { x: 9, y: 12 } },
          { ref: 'ungor', pos: { x: 15, y: 20 } },
          { ref: 'ungor', pos: { x: 19, y: 7 } },
          { ref: 'loup', pos: { x: 7, y: 16 } },
          { ref: 'loup', pos: { x: 14, y: 12 } },
          { ref: 'loup', pos: { x: 17, y: 23 } },
        ],
        onVictory: flowOf([
          { type: 'giveXp', amount: 120 },
          { type: 'journal', text: 'La harde de lisière est dispersée. Plus profond, une fumée monte du camp des brigands…' },
        ]),
      },
      {
        // Le camp de Bella la Noire — PNJ NOMMÉE du bestiaire (ADE), à la tête de ses coupe-jarrets.
        id: 'enc-foret-bande',
        enemies: [
          { ref: 'bella-la-noire', pos: { x: 31, y: 11 } },
          { ref: 'humain', pos: { x: 29, y: 9 }, weapon: 'arc', randomChars: true, label: 'Coupe-jarret de Bella', appearance: { tenue: 'hors-la-loi', sex: 'F' } },
          { ref: 'humain', pos: { x: 33, y: 13 }, weapon: 'epee-batarde', randomChars: true, label: 'Spadassin de Bella', appearance: { tenue: 'hors-la-loi' } },
          { ref: 'chien', pos: { x: 28, y: 14 } },
        ],
        onVictory: flowOf([
          { type: 'setFlag', flag: 'contrat_foret_fait' },
          { type: 'giveXp', amount: 160 },
          { type: 'journal', text: 'Bella la Noire est tombée, sa bande éparpillée. CONTRAT REMPLI — le Maître paiera. (Le coffre du camp est à vous ; retour par la carte du monde.)' },
        ]),
      },
    ],
  });
}

// ── La Tourbière Noire (36×26) : pontons sur l'eau noire, chose FABRIQUÉE ───────────────────

export function makeMarais() {
  resetIds();
  return scene({
    id: 'arene-exp-marais',
    nom: 'La Tourbière Noire',
    description: 'Une tourbière d’eau noire au sud de la Futaie — les pontons sont le seul chemin sûr. Enfin, « sûr »…',
    weather: 'brouillard',
    startMessage:
      'LA TOURBIÈRE NOIRE. Les pontons de planches serpentent sur l’eau morte. Ce qui traîne les voyageurs sous la surface a été FABRIQUÉ — et il régénère. Apportez du feu.',
    rows: [
      '####################################',
      '#..................................#',
      '#......~~~~~~~.........~~~~~~~~....#',
      '#....~~~~~~~~~~~.....~~~~~~~~~~~...#',
      '#...~~~~=~~~~~~~~...~~~~~~=~~~~~~..#',
      '#...~~~~=~~~~~~~~~~~~~~~~~=~~~~~~..#',
      '#...~~~~=====~~~~~~~~~~====~~~~~~..#',
      '#...~~~~~~~~=~~~~~~~~~~=~~~~~~~~...#',
      '#....~~~~~~~====~~~~~~~=~~~~~~.....#',
      '#......~~~~~~~~=~~~~~~~=~~~~.......#',
      '#........~~~~~~====~~~~=~~.........#',
      '#..........~~~~~~~=~~~~=~~.........#',
      '#...........~~~~~~====~==~.........#',
      '#............~~~~~~~~=~~~..........#',
      '#.............~~~~~~~=~~...........#',
      '#..............~~~~~~=~~...........#',
      '#...............~~~~~=~............#',
      '#..................................#',
      '#..................................#',
      '#..................................#',
      '#..................................#',
      '#......hh..........................#',
      '#......hh..........................#',
      '#..................................#',
      '#..................................#',
      '####################################',
    ],
    base: 'boue',
    legend: { h: 'herbe' },
    entities: [
      hero(18, 22),
      P(10, 3, 'nenuphars'),
      P(26, 3, 'nenuphars'),
      P(14, 8, 'nenuphars'),
      P(22, 14, 'nenuphars'),
      P(6, 8, 'roseaux'),
      P(29, 9, 'roseaux'),
      P(12, 16, 'roseaux'),
      P(24, 17, 'roseaux'),
      P(4, 18, 'arbre-mort'),
      P(31, 18, 'arbre-mort'),
      P(8, 21, 'arbre-mort'),
      P(28, 21, 'souche'),
      P(5, 23, 'barque', { foot: { w: 2, h: 1 },
        label: 'Barque du tourbier',
        ...fouille([
          { type: 'giveTrapping', trapping: 'Corde' },
          { type: 'giveMoney', silver: 8 },
          { type: 'journal', text: 'La barque du tourbier : une bonne corde et 8 pa dans une boîte à amadou.' },
        ]),
      }),
      P(20, 18, 'cadavre', {
        label: 'Voyageur repêché',
        ...fouille(testNode(
          { skill: 'resistance', difficulty: 'facile', label: 'Fouiller le noyé sans frémir' },
          [
            { type: 'giveMoney', silver: 22 },
            { type: 'journal', text: 'Le noyé voyageait riche : 22 pa, que la tourbe lui pardonne.' },
          ],
          [
            { type: 'inflictDisease', disease: 'Infection Mineure' },
            { type: 'journal', text: 'L’eau morte vous entre par une écorchure. Ça gratte. Ça GRATTE.' },
          ],
        )),
      }),
      P(22, 2, 'menhir', { label: 'Pierre engloutie' }),
    ],
    triggers: [fightTrigger('enc-marais', { x: 3, y: 2, w: 31, h: 16 })],
    encounters: [
      {
        id: 'enc-marais',
        surprise: 'party',
        hidden: true, // embuscade de tourbière : la chose surgit de l'eau morte
        enemies: [
          { ref: 'bete-des-marais', pos: { x: 15, y: 19 } },
          { ref: 'pieuvre-des-tourbieres', pos: { x: 22, y: 19 } },
          { ref: 'serpent', pos: { x: 9, y: 20 } },
          { ref: 'serpent', pos: { x: 21, y: 16 } },
        ],
        onVictory: flowOf([
          { type: 'setFlag', flag: 'contrat_marais_fait' },
          { type: 'giveXp', amount: 180 },
          { type: 'giveMoney', gold: 3 },
          { type: 'journal', text: 'La chose FABRIQUÉE a cessé de se recoudre. CONTRAT REMPLI — la tourbière redevient juste sinistre. (Retour par la carte du monde.)' },
        ]),
      },
    ],
  });
}

// ── Felsbach, village pesteux (34×24) : maisons mortes, puits maudit, journal du prévôt ─────

export function makeVillage() {
  resetIds();
  return scene({
    id: 'arene-exp-village',
    nom: 'Felsbach — village pesteux',
    description: 'Un village qui ne répond plus : portes ouvertes, marmites froides… et des pas traînants.',
    startMessage:
      'FELSBACH. Plus une lumière, des portes battantes — et des silhouettes qui TRAÎNENT entre les maisons. Ne buvez pas l’eau du puits. Cherchez le journal du prévôt.',
    rows: [
      '##################################',
      '#................................#',
      '#................................#',
      '#................................#',
      '#................................#',
      '#................................#',
      '#................................#',
      '#................................#',
      '#......ppp.......................#',
      '#......ppp.......................#',
      '#......ppp.......................#',
      '#................................#',
      '#................................#',
      '#................................#',
      '#................................#',
      '#................................#',
      '#................................#',
      '#................................#',
      '#................................#',
      '#................................#',
      '#hh..............................#',
      '#hh..............................#',
      '#................................#',
      '##################################',
    ],
    base: 'terre',
    legend: { p: 'pave', h: 'herbe' },
    // Bâtiments composés (toit + murs d'arête + sol planchéié) — cf. `buildingToComposite` du générateur.
    buildings: [
      { id: 'maison-1', type: 'maison', foot: { x: 3, y: 2, w: 3, h: 3 }, door: { x: 4, y: 4 }, label: 'Maison du charron' },
      { id: 'maison-2', type: 'maison', foot: { x: 12, y: 2, w: 3, h: 3 }, door: { x: 13, y: 4 }, label: 'Maison morte' },
      { id: 'maison-3', type: 'maison', foot: { x: 22, y: 3, w: 3, h: 3 }, door: { x: 22, y: 4 }, label: 'Maison aux volets clos' },
      { id: 'maison-prevot', type: 'manoir', foot: { x: 25, y: 14, w: 5, h: 4 }, door: { x: 25, y: 16 }, label: 'Logis du prévôt' },
      { id: 'maison-4', type: 'maison', foot: { x: 5, y: 14, w: 3, h: 3 }, door: { x: 7, y: 15 }, label: 'Ferme aux portes battantes' },
    ],
    entities: [
      hero(2, 21),
      P(7, 9, 'puits', { label: 'LE puits de Felsbach' }),
      P(10, 8, 'abreuvoir', { foot: { w: 2, h: 1 } }),
      P(16, 9, 'charrette', { foot: { w: 2, h: 1 }, label: 'Charrette abandonnée' }),
      P(19, 5, 'gibet', { label: 'Le gibet du village' }),
      P(13, 13, 'cadavre'),
      P(20, 17, 'cadavre'),
      P(9, 18, 'mare-sang'),
      P(17, 14, 'detritus'),
      P(28, 8, 'arbre-mort'),
      P(3, 8, 'tonneau'),
      P(30, 20, 'buisson'),
      P(13, 3, 'coffre', {
        label: 'Coffre du foyer',
        ...fouille([
          { type: 'giveMoney', silver: 26 },
          { type: 'journal', text: 'Les économies d’une famille qui ne reviendra pas : 26 pa. Elles serviront à les venger.' },
        ]),
      }),
      P(27, 16, 'lettre', {
        label: 'Journal du prévôt',
        ...fouille([
          {
            type: 'document',
            title: 'Journal du prévôt de Felsbach',
            text: '« 12 Sigmarzeit — Le colporteur est reparti vers le marais, fiévreux. 15 — Trois foyers touchés, on a muré la maison Brenner. 19 — L’eau du puits a un goût. TOUT LE MONDE a bu. 22 — Que Morr nous ouvre. Ne buvez pas l’e— » (la plume a traversé la page)',
          },
          { type: 'journal', text: 'Le journal du prévôt : la peste est venue du PUITS. Le Maître voudra lire ça.' },
        ]),
      }),
      P(4, 3, 'tonneaux-pile'),
    ],
    triggers: [
      {
        id: 'puits-maudit',
        rect: { x: 6, y: 8, w: 3, h: 3 },
        once: true,
        flow: testNode(
          { skill: 'resistance', difficulty: 'intermediaire', label: 'Les remontées du puits maudit' },
          [{ type: 'journal', text: 'L’odeur du puits vous plie en deux — mais rien ne s’accroche. Cette eau a TUÉ le village.' }],
          [
            { type: 'inflictDisease', disease: 'Courante Galopante' },
            { type: 'journal', text: 'Les miasmes du puits vous prennent à la gorge. Votre ventre gargouille déjà sinistrement…' },
          ],
        ),
      },
      fightTrigger('enc-village', { x: 9, y: 1, w: 24, h: 21 }),
    ],
    encounters: [
      {
        id: 'enc-village',
        enemies: [
          { ref: 'zombie', pos: { x: 14, y: 7 } },
          { ref: 'zombie', pos: { x: 18, y: 12 }, optionals: ['Maladie'] },
          { ref: 'zombie', pos: { x: 11, y: 16 } },
          { ref: 'zombie', pos: { x: 22, y: 8 }, randomChars: true },
          { ref: 'zombie', pos: { x: 16, y: 19 } },
          { ref: 'goule-de-crypte', pos: { x: 20, y: 20 } },
        ],
        onVictory: flowOf([
          { type: 'setFlag', flag: 'contrat_village_fait' },
          { type: 'giveXp', amount: 200 },
          { type: 'journal', text: 'Felsbach repose enfin. CONTRAT REMPLI — rapportez le journal du prévôt au Maître. (Retour par la carte du monde.)' },
        ]),
      },
    ],
  });
}

// ── Le Gué du Carrosse (28×14) : scène d'EMBUSCADE de route (« Attaqués ! », péripétie 10) ──

export function makeEmbuscade() {
  resetIds();
  return scene({
    id: 'arene-route-embuscade',
    nom: 'Le Gué du Carrosse',
    description: 'Un gué encaissé sur la route de l’est — l’endroit rêvé pour détrousser les voyageurs.',
    startMessage:
      'EMBUSCADE AU GUÉ ! Des silhouettes jaillissent des fourrés — défendez-vous, puis reprenez la route.',
    rows: [
      '############################',
      '#bb......................bb#',
      '#b........................b#',
      '#..........................#',
      '#rrrrrrrrrrrrrrrrrrrrrrrrrr#',
      '#rrrrrrrrrrrrrrrrrrrrrrrrrr#',
      '#..........~~~.............#',
      '#..........~~~.............#',
      '#rrrrrrrrrr===rrrrrrrrrrrrr#',
      '#rrrrrrrrrr===rrrrrrrrrrrrr#',
      '#..........................#',
      '#b........................b#',
      '#bb......................bb#',
      '############################',
    ],
    base: 'herbe',
    legend: { r: 'route', b: 'bois' },
    entities: [
      hero(3, 8),
      P(8, 6, 'epave-carrosse', { foot: { w: 2, h: 2 }, label: 'La diligence de Felsbach' }),
      P(16, 3, 'buisson'),
      P(22, 10, 'buisson'),
      P(5, 11, 'arbre-mort'),
      P(24, 2, 'rocher'),
      P(12, 11, 'cadavre', {
        label: 'Postillon détroussé',
        ...fouille([
          { type: 'giveMoney', silver: 9 },
          { type: 'journal', text: 'Le postillon de la diligence perdue. Sa sacoche : 9 pa et une lettre illisible.' },
        ]),
      }),
      P(20, 6, 'tonneau'),
    ],
    triggers: [],
    encounters: [
      {
        id: 'enc-embuscade',
        surprise: 'party',
        hidden: true, // embuscade de route : les détrousseurs jaillissent des fourrés
        enemies: [
          { ref: 'gobelin', pos: { x: 14, y: 4 }, randomChars: true },
          { ref: 'gobelin', pos: { x: 18, y: 9 }, randomChars: true },
          { ref: 'gobelin', pos: { x: 10, y: 10 } },
          { ref: 'orc', pos: { x: 21, y: 5 } },
        ],
        onVictory: flowOf([
          { type: 'giveXp', amount: 80 },
          { type: 'giveMoney', silver: 15 },
          { type: 'journal', text: 'Les détrousseurs sont détroussés (15 pa). Reprenez la route par la carte du monde.' },
        ]),
      },
    ],
  });
}

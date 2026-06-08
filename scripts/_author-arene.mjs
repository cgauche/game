/**
 * Outil d'AUTORAT one-off (équivalent d'un export d'éditeur) : produit le projet « Arène » en DONNÉES
 * pures (src/scenes/arene/arene-projet.json) — un tableau de Scènes [zone1, hub, zone2…zoneN] reliées
 * par des Effets `transition` + des flags. Aucune mécanique dédiée : tout repose sur le moteur existant.
 *
 * LAYOUTS EN CARTES ASCII : chaque zone est DESSINÉE comme une grille lisible (1 char = 1 tuile). Les
 * murs (`#` → terrain `mur`, rendu en bloc 3D + bloque vue/déplacement) sont POSÉS, pas éparpillés :
 * salles, couloirs, points d'étranglement et lignes de couvert sont cohérents PAR CONSTRUCTION. Le JSON
 * émis reste l'artefact ÉDITABLE (chargeable/modifiable dans l'éditeur).
 *
 * COURBE longue et CROISSANTE : chaque zone = UN thème + UNE nouveauté à son palier (les débuts restent
 * faciles ; on n'empile pas les mécaniques sur les premières zones). Large vitrine du bestiaire (58
 * créatures) incluant des Traits pas encore codés mais déjà DONNÉES (Champion, Corruption, Démoniaque,
 * Venin, Élite, Brutal…) — « ça reste des systèmes qu'on veut tester ».
 * Lancer : node scripts/_author-arene.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ─────────────────────────── Légende des cartes ASCII ───────────────────────────
// Chars de TERRAIN : remplacent la tuile elle-même.
const TERRAIN_CH = {
  '#': 'mur',     // mur de pierre — bloque vue + déplacement, rendu en bloc 3D (g_sol)
  '~': 'eau',     // eau infranchissable
  'T': 'bois',    // sous-bois / fourré — infranchissable, couvert imparfait
  ',': 'terre',   // terre battue (accent marchable)
  '=': 'pave',    // pavé (accent marchable) — bordures, gradins
  '%': 'porte',   // porte / herse (marchable mais bloque la vue)
};
// Chars de DÉCOR : la tuile reste le sol de base (marchable) ; un prop est posé dessus.
// `foot` = empreinte multi-cases (bloque la walkability + couvert sur toutes ses cases).
const PROP_CH = {
  o: 'tonneau', x: 'caisse', S: 'statue', h: 'tas-foin', f: 'feu-camp',
  c: 'cadavre', m: 'mare-sang', L: 'lampadaire', a: 'arbre', w: 'puits',
  C: 'coffre', u: 'fontaine', F: 'cloture', k: 'cheval-mort',
  '+': { ref: 'charrette', foot: { w: 2, h: 1 } },
  E: { ref: 'epave-carrosse', foot: { w: 2, h: 2 } },
};
const HERO_CH = '@';
const BASE_CH = new Set(['.', ' ']); // sol de base

// ─────────────────────────── Constructeurs ennemis ───────────────────────────
// Statbloc inline : Nuée de rats (trait « Nuée » → swarm ×5 PB, immunité Psycho, Frappe Mortelle, LDB 85).
const NUEE_RATS = { name: 'Nuée de rats', char: { M: 4, CC: 30, F: 25, E: 30, Ag: 40, B: 5 }, traits: ['Nuée', 'Taille (Petite)'] };
// Statbloc inline FINALE : Dragon des ténèbres MONSTRUEUX (occupe 4×4) + Souffle (Ténèbres) + Terreur.
const DRAGON_TENEBRES = {
  name: 'Dragon des ténèbres',
  char: { M: 6, CC: 55, CT: 45, F: 55, E: 55, I: 50, Ag: 35, Dex: 30, Int: 40, FM: 60, Soc: 40, B: 104 },
  traits: ['Taille (Monstrueuse)', 'Souffle +15 (Ténèbres)', 'Terreur 2', 'Armure 5', 'Arme +10', 'Morsure +10', 'Vol'],
  size: 'monstrueuse',
};

const loot = (trapping, qualities, skin) => ({ type: 'giveTrapping', trapping, qualities, identified: false, ...(skin ? { skin } : {}) });

/**
 * SPÉCIFS DES ZONES, par palier croissant. Chaque zone : `map` (carte ASCII), `roster` (char → ennemi),
 * thème (`nom`), terrain de base, ambiance/météo, récompenses (gold/xp/loot/fortune), options (surprise).
 * w/h sont DÉRIVÉS de la carte. `roster` : `{ ref }`, `{ statblock }`, `{ ref, mount }`, `{ ref, ridesChar }`,
 * `{ ref, mount, side:'ally' }`. Les digits/lettres de `roster` se posent où ils apparaissent sur la carte.
 */
const ZONES = [
  { // ── PALIER 1 : très facile — les bases (mêlée/distance/couvert) ──
    key: 'zone1', nom: 'La Cour', base: 'sable', amb: 'exterieur',
    map: [
      '###############',
      '#..M..o...x..B#',
      '#..S.......,,.#',
      '#.....o..1....#',
      '#.,,......3...#',
      '#@...f.......2#',
      '#.,,....1.....#',
      '#.....o...x...#',
      '#..R.......,,.#',
      '#.....o...x..B#',
      '###############',
    ],
    decor: { M: 'mannequin', R: 'rack-armes', B: 'etendard' },
    roster: { 1: { ref: 'Snotling' }, 2: { ref: 'Snotling' }, 3: { ref: 'Gobelin' } },
    gold: 25, xp: 40,
    msg: 'L’ARÈNE — La Cour. Pour s’échauffer : de la vermine. Avancez sur le sable (couvert : tonneaux, caisses, statues).',
  },
  { // ── PALIER 2 : facile — peaux-vertes + MURS / lignes de vue ──
    key: 'zone2', nom: 'Les Ruines', base: 'dalle', amb: 'exterieur',
    map: [
      '###############',
      '#@....#......1#',
      '#..K..#......,#',
      '#.....G......2#',
      '#..A..##.....,#',
      '#.....G....3..#',
      '#..K..#......,#',
      '#.....#.G..2..#',
      '#..A..#......,#',
      '#.G...#......1#',
      '###############',
    ],
    decor: { K: 'colonne-brisee', A: 'arche-ruine', G: 'gravats' },
    roster: { 1: { ref: 'Gobelin' }, 2: { ref: 'Gobelin' }, 3: { ref: 'Orc' } },
    gold: 45, xp: 75,
    msg: 'LES RUINES. Un mur éventré coupe la cour en deux : passez la porte (brèche) ou contournez. Gobelins et un Orc derrière.',
  },
  { // ── PALIER 3 : facile-moyen — NUÉE (swarm), couloirs d'eau ──
    key: 'zone3', nom: 'Les Égouts', base: 'sol', amb: 'interieur',
    map: [
      '###############',
      '#..G..o....G..#',
      '#..~~.....~~..#',
      '#..~~.1.2.~~..#',
      '#@....N.....D.#',
      '#....o...o....#',
      '#@.D.....N..1.#',
      '#..~~.....~~..#',
      '#..~~.2...~~..#',
      '#..G..o....G..#',
      '###############',
    ],
    decor: { G: 'grille', D: 'detritus' },
    roster: { N: { statblock: NUEE_RATS }, 1: { ref: 'Rat géant' }, 2: { ref: 'Snotling' } },
    gold: 60, xp: 110, fortune: true,
    msg: 'LES ÉGOUTS. Une NUÉE de rats grouille (tirez dessus : +40 ; elle submerge en mêlée). Les canaux d’eau canalisent le combat.',
  },
  { // ── PALIER 4 : moyen — MORTS-VIVANTS / Peur + 1er butin magique ──
    key: 'zone4', nom: 'Le Charnier', base: 'ossuaire', amb: 'interieur',
    map: [
      '###############',
      '#X.c..G.#.1...#',
      '#@....B.#....2#',
      '#.....B.#.,,..#',
      '#..m...G%..3..#',
      '#.......#.....#',
      '#.X....G#.,,..#',
      '#@.c..B.#.2...#',
      '#.....B.#...C.#',
      '#G....o.#....1#',
      '###############',
    ],
    decor: { B: 'ossements', G: 'tombe', X: 'sarcophage' },
    roster: { 1: { ref: 'Squelette' }, 2: { ref: 'Zombie' }, 3: { ref: 'Goule de crypte' } },
    loot: loot('Dague', ['Dévastatrice']),
    gold: 80, xp: 150,
    msg: 'LE CHARNIER. Les morts se lèvent derrière l’ossuaire (Peur). Un poignard à l’éclat trouble traîne près du coffre (à faire évaluer).',
  },
  { // ── PALIER 5 : moyen-haut — CAVALERIE (charge montée). Lice ouverte bordée de pavé. ──
    key: 'zone5', nom: 'Les Lices', base: 'terre', amb: 'exterieur',
    map: [
      '#################',
      '#@..R.B.B.B...J1#',
      '#....U.......U.,#',
      '#.P.........M...#',
      '#.P.........H...#',
      '#...........,...#',
      '#J...B.B.B....U1#',
      '#....U.........J#',
      '#################',
    ],
    decor: { B: 'barriere', R: 'rack-lances', U: 'tribune', J: 'etendard' },
    roster: {
      H: { ref: 'Cheval', mount: true },
      M: { ref: 'Mutant', ridesChar: 'H' },
      P: { ref: 'Cheval', mount: true, side: 'ally' },
      1: { ref: 'Gobelin' },
    },
    gold: 100, xp: 180, fortune: true,
    msg: 'LES LICES. Un cavalier mutant vous CHARGE le long de la lice ! Un cheval de bataille LIBRE attend près de vous : Chevauchez-le pour rendre coup pour coup.',
  },
  { // ── PALIER 6 : élite — EMBUSCADE (Surprise), marais brumeux cerné de fourrés. ──
    key: 'zone6', nom: 'Le Marais', base: 'herbe', amb: 'exterieur', weather: 'brouillard',
    map: [
      'TTTTTTTTTTTTTTTTT',
      'T@..U.R....1....T',
      'T...N...........T',
      'T..~~~...2.....RT',
      'T..~~~bb........T',
      'T...3......1....T',
      'T.....1......N..T',
      'T.R......k.....UT',
      'TTTTTTTTTTTTTTTTT',
    ],
    decor: { R: 'roseaux', U: 'souche', N: 'menhir' },
    terrain: { b: 'boue' },
    roster: { 1: { ref: 'Loup funeste' }, 2: { ref: 'Gor' }, 3: { ref: 'Ungor' } },
    surprise: 'party',
    gold: 130, xp: 220, fortune: true,
    msg: 'LE MARAIS. Le brouillard cache une EMBUSCADE : Test de Perception ou vos héros démarrent Surpris. Meute de loups funestes (Peur, Taille Grande) et un Gor enragé entre les fourrés.',
  },
  { // ── PALIER 7 : élite — POISON / VENIN. Vouivre Énorme (3×3) au fond du nid. ──
    key: 'zone7', nom: 'Le Nid', base: 'tourbe', amb: 'interieur',
    map: [
      '###############',
      '#@..U....W..1.#',
      '#....K........#',
      '#...,,,,,,,...#',
      '#..,,V,,,,,.2.#',
      '#..,,,,,,,,...#',
      '#..,,,,,...1..#',
      '#...,,,,,.....#',
      '#.W......U..2.#',
      '#..o....1.....#',
      '###############',
    ],
    decor: { W: 'toile', K: 'cocon', U: 'champignon' },
    roster: { V: { ref: 'Vouivre' }, 1: { ref: 'Araignée géante' }, 2: { ref: 'Serpent' } },
    loot: loot('Lance', ['Perçante']),
    gold: 160, xp: 270,
    msg: 'LE NID. Une Vouivre (VENIN, Énorme — occupe 3×3) niche au fond ; des araignées géantes (Toile → Empêtré) gardent les alcôves, des serpents filent au sol. Le poison ronge — soignez vite.',
  },
  { // ── PALIER 8 : grosse bête — TAILLE Grande / Piétinement. Pilier central. ──
    key: 'zone8', nom: 'La Fosse', base: 'roche', amb: 'interieur',
    map: [
      '###############',
      '#@..G......2..#',
      '#......K......#',
      '#..G.###...K..#',
      '#....#.#.M....#',
      '#.K..#.#......#',
      '#....###...B..#',
      '#@..B....3..2.#',
      '#G....m....K..#',
      '#..o.......o..#',
      '###############',
    ],
    decor: { K: 'rocher', G: 'stalagmite', B: 'ossements' },
    roster: { M: { ref: 'Minotaure' }, 2: { ref: 'Gor' }, 3: { ref: 'Ungor' } },
    gold: 190, xp: 320,
    msg: 'LA FOSSE. Un Minotaure (Taille Grande : occupe 2×2, peut Piétiner) tourne autour d’un pilier creux, flanqué de Gors. Servez-vous du pilier pour briser sa charge.',
  },
  { // ── PALIER 9 : boss — Troll (régénère/vomit) + Gors (Rage), derrière la herse. ──
    key: 'zone9', nom: 'La Caverne du Troll', base: 'pierre', amb: 'interieur',
    map: [
      '###############',
      '#@..G.#.....2.#',
      '#.....#.B.....#',
      '#.K...#..R....#',
      '#.....%......U#',
      '#.G...#..B....#',
      '#..o..#....2.K#',
      '#@..B.#....3..#',
      '#G...m....C...#',
      '###############',
    ],
    decor: { G: 'stalagmite', K: 'rocher', U: 'marmite', B: 'ossements' },
    roster: { R: { ref: 'Troll' }, 2: { ref: 'Gor' }, 3: { ref: 'Squig des cavernes' } },
    loot: loot('Épée bâtarde', ['De plaies atroces'], { metal: '#7faaff' }),
    gold: 220, xp: 380, fortune: true,
    msg: 'LA CAVERNE. Un Troll (Régénération, Vomissement, Taille Grande) garde son antre derrière la herse, ses Gors (Rage) en sentinelle. Le feu/l’acide arrête sa régénération — frappez fort.',
  },
  { // ── PALIER 10 : HORDE — meute skaven en surnombre (Rat-ogre + vermine). ──
    key: 'zone10', nom: 'Le Nid de Vermine', base: 'pave', amb: 'interieur',
    map: [
      '###############',
      '#@..#...U....3#',
      '#...#.......6.#',
      '#....,O,.....3#',
      '#....,,,....G4#',
      '#..K.#.......5#',
      '#....#.......4#',
      '#@..#...D....3#',
      '#.U.....m....U#',
      '#..o.......o..#',
      '###############',
    ],
    decor: { U: 'terrier', G: 'cage', K: 'roue-dentee', D: 'detritus' },
    roster: {
      O: { ref: 'Rat ogre' },
      3: { ref: 'Guerrier des clans' },
      4: { ref: 'Guerrier des clans' },
      5: { ref: 'Vermine de choc' },
      6: { ref: 'Rat géant' },
    },
    gold: 260, xp: 440,
    msg: 'LE NID DE VERMINE. Une HORDE skaven déferle : un Rat-ogre (Taille Grande, Stupide) lancé en avant, une nuée de Guerriers des clans et une Vermine de choc en surnombre. Tenez les couloirs.',
  },
  { // ── PALIER 11 : CHAOS — Corruption / Champion / Démoniaque. Cercle d'invocation. ──
    key: 'zone11', nom: 'Le Cercle Maudit', base: 'sang', amb: 'interieur',
    map: [
      '#################',
      '#@...A.....A...1#',
      '#..P.........P.2#',
      '#...,,,,,,,,...K#',
      '#..3,,,,RR,,...W#',
      '#...,,,,,,,,...K#',
      '#@..Z....A....P2#',
      '#....A.....A..1.#',
      '#......mmm.Z..C.#',
      '#################',
    ],
    decor: { R: 'cercle-runique', A: 'autel', P: 'pieu', Z: 'crane-monstre' },
    roster: {
      K: { ref: 'Sanguinaire de Khorne' },
      W: { ref: 'Guerrier du Chaos' },
      1: { ref: 'Cultiste' },
      2: { ref: 'Mutant' },
      3: { ref: 'Chamane-Brey' },
    },
    loot: loot('Hallebarde', ['Tranchante']),
    gold: 320, xp: 520, fortune: true,
    msg: 'LE CERCLE MAUDIT. Un cercle d’invocation saigne : Cultistes et Mutants (CORROMPUS) protègent un Guerrier du Chaos (CHAMPION, Armure 5) et deux Sanguinaires de Khorne (DÉMONIAQUE, Frénésie, Instable, Peur). Le sol corrompu teste l’âme.',
  },
  { // ── PALIER 12 : TERREUR (Test de Terreur, plus dur que la Peur). Caveau central. ──
    key: 'zone12', nom: 'Le Sépulcre', base: 'marbre', amb: 'interieur',
    map: [
      '###############',
      '#@.N.X...X.N.2#',
      '#......3.....,#',
      '#.U..#####..U,#',
      '#....#.P.#...4#',
      '#.B..#...#..,,#',
      '#....##.##...,#',
      '#@.N.X...X.N.2#',
      '#.....mmm.C..3#',
      '###############',
    ],
    decor: { X: 'sarcophage', U: 'urne', N: 'chandelier', B: 'ossements' },
    roster: { P: { ref: 'Spectre de cairn' }, 2: { ref: 'Squelette' }, 3: { ref: 'Fantôme' }, 4: { ref: 'Banshee' } },
    loot: loot('Dague', ['Dévastatrice'], { metal: '#caa64a' }),
    gold: 380, xp: 600,
    msg: 'LE SÉPULCRE. Un Spectre de cairn s’élève du caveau central — sa TERREUR fige le sang (Test de Terreur, plus dur que la Peur). Ultime palier avant l’Antre du Dragon.',
  },
  { // ── PALIER 13 : FINALE — MONSTRUEUSE (4×4) + SOUFFLE de ténèbres + Terreur ──
    key: 'zone13', nom: 'L’Antre du Dragon', base: 'cendre', amb: 'interieur',
    map: [
      '###################',
      '#@....f.K......g..#',
      '#.vv,.........Z...#',
      '#.vv,.....3.....,.#',
      '#......D..........#',
      '#..G...........vv.#',
      '#..............vv.#',
      '#..............vv.#',
      '#.,,,.....Q.....,.#',
      '#@....m.....K.c...#',
      '#..o.....Z......gC#',
      '#g.......Z.......g#',
      '###################',
    ],
    decor: { Z: 'tas-or', Q: 'oeuf-dragon', K: 'crane-monstre', G: 'stalagmite' },
    terrain: { v: 'lave' },
    roster: { D: { statblock: DRAGON_TENEBRES }, g: { ref: 'Gobelin' }, 3: { ref: 'Cultiste' } },
    loot: loot('Épée bâtarde', ['Dévastatrice'], { metal: '#caa64a' }),
    gold: 480, xp: 780,
    final: true,
    msg: 'L’ANTRE DU DRAGON. Un Dragon des ténèbres MONSTRUEUX (occupe 4×4) crache un SOUFFLE de ténèbres (attaque de zone) et inspire la TERREUR. L’épreuve ULTIME — le trésor est à ce prix.',
  },
];

// ─────────────────────────── Décodeur de carte ASCII ───────────────────────────
/**
 * Décode `spec.map` (lignes de même longueur) → { w, h, tiles, props, hero, enemies }. Chaque char est
 * routé : terrain (remplace la tuile) / héros (`@`) / ennemi (roster) / décor (PROP_CH) / sol de base.
 * Lève si les lignes ne sont pas toutes de la même largeur (erreur d'autorat).
 */
/** Normalise une entrée de décor (`'tonneau'` ou `{ ref, foot }`) en `{ ref, foot? }`. */
const asProp = (p) => (typeof p === 'string' ? { ref: p } : { ref: p.ref, foot: p.foot });

function decodeMap(spec) {
  const rows = spec.map;
  const w = rows[0].length;
  const h = rows.length;
  for (let y = 0; y < h; y++) {
    if (rows[y].length !== w) throw new Error(`${spec.key}: ligne ${y} large de ${rows[y].length}, attendu ${w}`);
  }
  // Légendes : globales (TERRAIN_CH/PROP_CH) ÉTENDUES par des légendes LOCALES à la zone
  // (`spec.terrain` / `spec.decor`). Le vocabulaire de décor dépasse les ~26 chars ASCII → chaque
  // salle réutilise ses propres symboles pour ses props signature (zéro collision inter-zones).
  const terrainCh = { ...TERRAIN_CH, ...(spec.terrain ?? {}) };
  const decorCh = { ...PROP_CH, ...(spec.decor ?? {}) };
  const tiles = new Array(w * h).fill(spec.base);
  const props = [];
  const enemies = [];
  let hero = null;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x];
      // 1) Terrain : remplace la tuile.
      if (ch in terrainCh) { tiles[y * w + x] = terrainCh[ch]; continue; }
      // (tout le reste se tient sur le sol de base : la tuile reste `spec.base`)
      // 2) Héros.
      if (ch === HERO_CH) { if (!hero) hero = { x, y }; continue; }
      // 3) Ennemi (roster).
      if (spec.roster && ch in spec.roster) {
        const r = spec.roster[ch];
        enemies.push({ ...r, x, y, _ch: ch });
        continue;
      }
      // 4) Décor (local puis global).
      if (ch in decorCh) {
        props.push({ ...asProp(decorCh[ch]), x, y });
        continue;
      }
      // 5) Sol de base (`.`/espace) : rien de plus.
      if (!BASE_CH.has(ch)) throw new Error(`${spec.key}: char « ${ch} » non reconnu (${x},${y})`);
    }
  }
  if (!hero) throw new Error(`${spec.key}: pas de point de départ « @ »`);
  return { w, h, tiles, props, hero, enemies };
}

// ─────────────────────────── Construction d'une zone ───────────────────────────
const fightTrigger = (encId, w, h) => ({ id: `fight-${encId}`, rect: { x: 5, y: 0, w: w - 5, h }, once: true, effects: [{ type: 'startCombat', encounter: encId }] });

function buildZone(spec) {
  const { w, h, tiles, props, hero, enemies: raw } = decodeMap(spec);
  const encId = `enc-${spec.key}`;
  // Résolution des cavaliers : `ridesChar` → index de la monture (même char) la plus proche.
  const enemies = raw.map((en) => {
    const out = {
      ...(en.ref ? { ref: en.ref } : { statblock: en.statblock }),
      pos: { x: en.x, y: en.y },
      ...(en.mount ? { mount: true } : {}),
      ...(en.side ? { side: en.side } : {}),
    };
    if (en.ridesChar) {
      let best = -1, bestD = Infinity;
      raw.forEach((m, i) => {
        if (m._ch !== en.ridesChar) return;
        const d = Math.abs(m.x - en.x) + Math.abs(m.y - en.y);
        if (d < bestD) { bestD = d; best = i; }
      });
      if (best >= 0) out.rides = best;
    }
    return out;
  });
  const entities = [
    { id: 'start', kind: 'heroStart', pos: { x: hero.x, y: hero.y } },
    ...props.map((p, i) => ({
      id: `${spec.key}-p${i}`, kind: 'prop', pos: { x: p.x, y: p.y }, ref: p.ref,
      ...(p.foot ? { foot: p.foot } : {}),
    })),
  ];
  return {
    id: `arene-${spec.key}`,
    nom: `Arène — ${spec.nom}`,
    description: spec.nom,
    dimensions: { w, h },
    ambiance: spec.amb,
    ...(spec.weather ? { weather: spec.weather } : {}),
    startMessage: spec.msg,
    tiles,
    entities,
    dialogues: [],
    triggers: [fightTrigger(encId, w, h)],
    encounters: [{
      id: encId,
      enemies,
      ...(spec.surprise ? { surprise: spec.surprise } : {}),
      onVictory: [
        { type: 'giveMoney', gold: spec.gold },
        { type: 'giveXp', amount: spec.xp },
        ...(spec.loot ? [spec.loot] : []),
        { type: 'setFlag', flag: `${spec.key}_clear` },
        ...(spec.fortune ? [{ type: 'setFlag', flag: 'chance_dispo' }] : []),
        { type: 'journal', text: spec.final ? 'CHAMPION DE L’ARÈNE ! L’épreuve ultime est tombée.' : `${spec.nom} : vaincue ! Retournez voir le maître d’arène.` },
        { type: 'transition', scene: 'arene-hub' },
      ],
    }],
    flags: {},
  };
}

const zoneScenes = ZONES.map(buildZone);

// Portes du hub vers chaque zone (sauf l'entrée zone1), gated par le flag de la zone précédente.
const waveDoors = ZONES.slice(1).map((z, i) => ({
  text: `⚔️ Entrer — ${z.nom}.`,
  condition: `${ZONES[i].key}_clear,!${z.key}_clear`,
  effects: [{ type: 'transition', scene: `arene-${z.key}` }],
}));
const lastKey = ZONES[ZONES.length - 1].key;

// ════════════════════════ HUB — Antichambre du Maître (murée) ════════════════════════
const HUB_MAP = [
  '#############',
  '#...........#',
  '#..D....o...#',
  '#...........#',
  '#.M.....E...#',
  '#.......et..#',
  '#..C....f...#',
  '#.....@.L...#',
  '#############',
];
// Décor du hub posé par carte (D=médecin, M=maître posés à part car ce sont des personnages).
const HUB_W = HUB_MAP[0].length, HUB_H = HUB_MAP.length;
const hubTiles = new Array(HUB_W * HUB_H).fill('plancher');
const hubProps = [];
let hubHero = { x: 6, y: 7 };
let medecinPos = { x: 3, y: 4 }, maitrePos = { x: 6, y: 2 };
for (let y = 0; y < HUB_H; y++) for (let x = 0; x < HUB_W; x++) {
  const ch = HUB_MAP[y][x];
  if (ch === '#') { hubTiles[y * HUB_W + x] = 'mur'; continue; }
  if (ch === '@') { hubHero = { x, y }; continue; }
  if (ch === 'D') { medecinPos = { x, y }; continue; }   // Médecin (personnage)
  if (ch === 'M') { maitrePos = { x, y }; continue; }     // Maître d'arène (personnage)
  if (ch === 't') { hubProps.push({ ref: 'etal-marche', x, y }); continue; }
  if (ch in PROP_CH) {
    const p = PROP_CH[ch];
    hubProps.push({ ref: typeof p === 'string' ? p : p.ref, x, y, foot: typeof p === 'string' ? undefined : p.foot });
  }
}

const hub = {
  id: 'arene-hub', nom: 'Arène — Antichambre du Maître', description: 'Repos, marchand, médecin, et portes vers les arènes.',
  dimensions: { w: HUB_W, h: HUB_H }, ambiance: 'interieur',
  startMessage: 'Antichambre du maître d’arène. Marchande, fais évaluer ton butin, soigne-toi, dors (payant)… puis repars saigner.',
  tiles: hubTiles,
  entities: [
    { id: 'start', kind: 'heroStart', pos: hubHero },
    { id: 'maitre', kind: 'personnage', pos: maitrePos, label: 'Maître d’arène', facing: 'S', dialogueId: 'dlg-hub', merchant: { archetype: 'armurier' }, appearance: { species: 'Humains (Reiklander)', career: 'Répurgateur', sex: 'M', build: 0.62 }, weapon: 'Épée bâtarde' },
    { id: 'medecin', kind: 'personnage', pos: medecinPos, label: 'Médecin', facing: 'E', dialogueId: 'dlg-medecin', merchant: { archetype: 'medecin' }, appearance: { species: 'Humains (Reiklander)', career: 'Apothicaire', sex: 'M', build: 0.46 } },
    ...hubProps.map((p, i) => ({ id: `hub-p${i}`, kind: 'prop', pos: { x: p.x, y: p.y }, ref: p.ref, ...(p.foot ? { foot: p.foot } : {}) })),
  ],
  dialogues: [{
    id: 'dlg-medecin', start: 'accueil',
    nodes: [{
      id: 'accueil', speaker: 'Médecin',
      text: 'Encore vivant ? Bien. J’ai des potions, des cataplasmes, du faxtoryll pour les saignements… et des membres de rechange si l’arène t’en a pris un.',
      choices: [
        { text: '⚕️ Voir les remèdes et prothèses.', effects: [{ type: 'openMerchant', entityId: 'medecin' }] },
        { text: '🩹 Soin des Blessures (jet de Guérison) — 5 pa.', cost: { silver: 5 }, effects: [{ type: 'medicalAid', act: 'wounds', skill: 55, intBonus: 4, entityId: 'medecin' }] },
        { text: '🩸 Stopper une hémorragie (jet de Guérison) — 5 pa.', cost: { silver: 5 }, effects: [{ type: 'medicalAid', act: 'bleed', skill: 55, intBonus: 4, entityId: 'medecin' }] },
        { text: '🔪 Opérer une blessure grave (Chirurgie) — 6 pa.', cost: { silver: 6 }, effects: [{ type: 'medicalAid', act: 'surgery', skill: 55, intBonus: 4, entityId: 'medecin' }] },
        { text: 'Plus tard.', effects: [{ type: 'endDialogue' }] },
      ],
    }],
  }, {
    id: 'dlg-hub', start: 'accueil',
    nodes: [{
      id: 'accueil', speaker: 'Maître d’arène',
      text: 'Tu saignes encore ? Parfait. Équipe-toi, soigne-toi… puis retourne dans l’arène.',
      choices: [
        { text: '🛒 Marchander / s’équiper / faire évaluer le butin.', effects: [{ type: 'openMerchant', entityId: 'maitre' }] },
        { text: '🛏️ Dormir (chambre pour le groupe).', cost: { silver: 20 }, effects: [{ type: 'rest' }] },
        { text: '🍀 Méditer — retrouver la Chance.', condition: 'chance_dispo', effects: [{ type: 'restoreFortune' }, { type: 'setFlag', flag: 'chance_dispo', value: false }] },
        { text: '🔓 Crocheter le vieux coffre du maître (Test de Crochetage).', condition: '!coffre_pris', effects: [{ type: 'test', skill: 'Crochetage', difficulty: 'intermediaire', label: 'Crocheter le coffre', onSuccess: [{ type: 'setFlag', flag: 'coffre_pris' }, { type: 'giveMoney', gold: 30 }, { type: 'journal', text: 'Le coffre cède : 30 couronnes !' }], onFailure: [{ type: 'journal', text: 'Le mécanisme rouillé résiste — peut-être plus tard.' }] }] },
        ...waveDoors,
        { text: '🏆 Savourer ta gloire de champion.', condition: `${lastKey}_clear`, effects: [{ type: 'journal', text: 'Le maître s’incline : « CHAMPION DE L’ARÈNE ! »' }, { type: 'endDialogue' }] },
        { text: 'Plus tard.', effects: [{ type: 'endDialogue' }] },
      ],
    }],
  }],
  triggers: [],
  encounters: [],
  flags: {},
};

// Projet : [zone1 (entrée), hub, zones 2..N]. campaign[0] = la première zone.
const project = [zoneScenes[0], hub, ...zoneScenes.slice(1)];
const outDir = join(ROOT, 'src', 'scenes', 'arene');
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, 'arene-projet.json');
writeFileSync(outFile, JSON.stringify(project, null, 2) + '\n', 'utf8');
console.log(`Arène écrite : ${outFile} (${project.length} scènes : ${ZONES.length} zones + hub, entrée = ${project[0].id})`);

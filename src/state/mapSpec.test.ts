import { describe, it, expect } from 'vitest';
import { buildScene } from './mapSpec';
import { layerTiles, isWalkable, wallBetween, setStructureDown } from './scene';
import { pathTo } from './path';
import { edgeWallState } from '../ui/editor/editorState';

/** GOLDEN = spécification exécutable du format `MapSpec`. Chaque bloc verrouille une section de la
 *  compilation `buildScene` (headless-editor). L'ordre de compilation est figé par ces attentes. */

describe('buildScene — cas trivial + scalaires', () => {
  const s = buildScene({
    id: 't', nom: 'T', size: [4, 3], terrain: 'pave', heroStart: [1, 1],
    ambiance: 'interieur', metresPerTile: 10, flags: { ouvert: true },
  });
  it('pose dimensions, une couche pleine, le départ héros et les scalaires', () => {
    expect(s.dimensions).toEqual({ w: 4, h: 3 });
    expect(s.layers).toHaveLength(1);
    expect(layerTiles(s, 0).every((t) => t === 'pave')).toBe(true);
    expect(s.metresPerTile).toBe(10);
    expect(s.ambiance).toBe('interieur');
    expect(s.flags).toEqual({ ouvert: true });
    const hero = s.entities.find((e) => e.kind === 'heroStart');
    expect(hero?.pos).toEqual({ x: 1, y: 1 });
  });
});

describe('buildScene — multi-niveaux + relief métrique', () => {
  const s = buildScene({
    id: 'r', nom: 'R', size: [3, 3],
    levels: { z0: '...\n...\n...', z1: 'WWW\nWWW\nWWW' },
    legend: { W: 'pierre' },
    relief: [
      { rect: [0, 2, 2, 2], height: 4, z: 1 }, // rangée du bas de z1 à 4 m
      { ramp: [0, 0, 0, 2], from: 0, to: 2, z: 0 }, // colonne x=0 de z0 : 0→1→2 m
    ],
  });
  it('crée deux couches, la légende s’applique, les hauteurs sont posées', () => {
    expect(s.layers.map((l) => l.z)).toEqual([0, 1]);
    expect(layerTiles(s, 0).every((t) => t === 'herbe')).toBe(true); // base z0 par défaut
    expect(layerTiles(s, 1).every((t) => t === 'pierre')).toBe(true);
    const l1 = s.layers.find((l) => l.z === 1)!;
    expect(l1.height![2 * 3 + 0]).toBe(4); // (0,2)
    expect(l1.height![2 * 3 + 2]).toBe(4); // (2,2)
    const l0 = s.layers.find((l) => l.z === 0)!;
    expect(l0.height![0 * 3 + 0]).toBe(0); // (0,0)
    expect(l0.height![1 * 3 + 0]).toBe(1); // (0,1)
    expect(l0.height![2 * 3 + 0]).toBe(2); // (0,2)
  });
});

describe('buildScene — grille `walled` (box-drawing : tuiles + murs d’arête + porte)', () => {
  // Grille 2×2 en box-drawing (2W+1 × 2H+1 = 5×5) : cases 'P' cloisonnées, arête E de (0,0) = PORTE `:`.
  // Convention `parseWalledAscii` : les `-` sont aux colonnes IMPAIRES (au-dessus des cases), les `|`/`:` aux paires.
  const s = buildScene({
    id: 'wl', nom: 'WL', size: [2, 2],
    walled: {
      z0: [
        ' - - ',
        '|P:P|',
        ' - - ',
        '|P|P|',
        ' - - ',
      ].join('\n'),
    },
    legend: { P: 'planches' },
  });
  it('parse les tuiles de l’ASCII box-drawing', () => {
    expect(s.layers).toHaveLength(1);
    expect(layerTiles(s, 0)).toEqual(['planches', 'planches', 'planches', 'planches']);
  });
  it('pose les murs d’arête intérieurs et le périmètre', () => {
    expect(edgeWallState(s, 0, 1, 'E')).toBe('wall'); // cloison intérieure (rangée du bas)
    expect(edgeWallState(s, 0, 0, 'N')).toBe('wall'); // bord haut du bâti
    expect(edgeWallState(s, 0, 0, 'O')).toBe('wall'); // bord gauche du bâti
  });
  it('reconnaît la PORTE `:` comme arête franchissable', () => {
    expect(edgeWallState(s, 0, 0, 'E')).toBe('door');
  });
});

describe('buildScene — `walled` multi-étages + relief (l’étage porté à 4 m)', () => {
  const s = buildScene({
    id: 'wl2', nom: 'WL2', size: [2, 1],
    walled: { z0: [' - - ', '|P|P|', ' - - '].join('\n'), z1: [' - - ', '|M|M|', ' - - '].join('\n') },
    legend: { P: 'planches', M: 'marbre' },
    relief: [{ rect: [0, 0, 1, 0], height: 4, z: 1 }],
  });
  it('crée deux couches (z0 sol + z1 vide), la base z>0 = vide, relief posé', () => {
    expect(s.layers.map((l) => l.z)).toEqual([0, 1]);
    expect(layerTiles(s, 0)).toEqual(['planches', 'planches']);
    expect(layerTiles(s, 1)[0]).toBe('marbre');
    expect(s.layers.find((l) => l.z === 1)!.height![0]).toBe(4);
    // murs du z1 héritent du z de l'étage
    expect(edgeWallState(s, 0, 0, 'N', 1)).toBe('wall');
  });
});

describe('buildScene — murs d’arête explicites', () => {
  const s = buildScene({
    id: 'w', nom: 'W', size: [3, 3], terrain: 'pave',
    walls: [
      { x: 1, y: 1, side: 'N' },
      { x: 1, y: 1, side: 'E', door: true },
      { x: 0, y: 0, side: 'N', structure: 'porte-de-ville' },
      { x: 2, y: 0, side: 'N', climb: { kind: 'surface', difficulty: 'difficile' } },
    ],
  });
  it('pose cloisons, portes et structures brèchables', () => {
    expect(edgeWallState(s, 1, 1, 'N')).toBe('wall');
    expect(edgeWallState(s, 1, 1, 'E')).toBe('door');
    expect(s.walls!.find((w) => w.x === 0 && w.y === 0 && w.side === 'N')!.structure).toBe('porte-de-ville');
  });
  it('pose une arête escaladable (#505)', () => {
    expect(s.walls!.find((w) => w.x === 2 && w.y === 0 && w.side === 'N')!.climb).toEqual({ kind: 'surface', difficulty: 'difficile' });
  });
});

describe('buildScene — diagonales (side \\\\/\\/) : attributs riches (#554)', () => {
  it('`window` (décoratif pur) est PROPAGÉ sur une diagonale (patchWall après toggleDiagonalWall)', () => {
    const s = buildScene({
      id: 'diag', nom: 'Diag', size: [3, 3], terrain: 'pave',
      walls: [{ x: 1, y: 1, side: '\\', window: true }],
    });
    const seg = s.walls!.find((w) => w.x === 1 && w.y === 1 && w.side === '\\');
    expect(seg?.window).toBe(true);
  });

  it('`climb` sur une diagonale REFUSE explicitement (arête oblique purement visuelle, jamais résolue par `edgeOf`)', () => {
    expect(() =>
      buildScene({
        id: 'diag2', nom: 'Diag2', size: [3, 3], terrain: 'pave',
        walls: [{ x: 1, y: 1, side: '\\', climb: { kind: 'ladder' } }],
      }),
    ).toThrow(/WallSpec diagonal \(1,1\) ne peut pas porter climb\/structure/);
  });

  it('`structure` sur une diagonale REFUSE explicitement (jamais bloquante : `wallBetween`/`vision` ignorent \\\\/\\/)', () => {
    expect(() =>
      buildScene({
        id: 'diag3', nom: 'Diag3', size: [3, 3], terrain: 'pave',
        walls: [{ x: 1, y: 1, side: '/', structure: 'porte-de-ville' }],
      }),
    ).toThrow(/WallSpec diagonal \(1,1\) ne peut pas porter climb\/structure\/door/);
  });

  it('`door` sur une diagonale REFUSE explicitement (une porte qui ne barre jamais le passage = donnée mensongère)', () => {
    expect(() =>
      buildScene({
        id: 'diag4', nom: 'Diag4', size: [3, 3], terrain: 'pave',
        walls: [{ x: 1, y: 1, side: '\\', door: true }],
      }),
    ).toThrow(/WallSpec diagonal \(1,1\) ne peut pas porter climb\/structure\/door/);
  });
});

describe('buildScene — `cells` (recette par LETTRE de case : enceinte pleine + tunnel + départ)', () => {
  // ENCEINTE de 2 cases d'épaisseur (rows 2-3) percée d'une PORTE au col 2, sur une carte 5×6.
  //   .....  (row 0 = champ)   ##D##  (row 2 = bande, gate col 2)   .....  (row 4 = cour)
  //   .....  (row 1 = champ)   ##D##  (row 3 = bande)               H....  (row 5 = cour + départ)
  const s = buildScene({
    id: 'c', nom: 'C', size: [5, 6],
    levels: { z0: ['.....', '.....', '##D##', '##D##', '.....', 'H....'].join('\n') },
    cells: {
      '#': { terrain: 'pierre', wall: { structure: 'mur-en-pierre', facing: 'N' } },
      D: { terrain: 'pierre', gate: { structure: 'porte-de-ville', facing: 'N' } },
      H: { terrain: 'pave', hero: true },
    },
  });
  const idx = (x: number, y: number) => y * s.dimensions.w + x;

  it('MASSE = BLOC PLEIN `mur` au sol (z0, comme un bâtiment) + CHEMIN DE RONDE `pierre` marchable posé par-dessus (z1, 4 m)', () => {
    expect(s.layers.map((l) => l.z)).toEqual([0, 1]); // couche z1 (chemin de ronde) créée par la recette
    const z0 = s.layers.find((l) => l.z === 0)!;
    const z1 = s.layers.find((l) => l.z === 1)!;
    // Courtine = BLOC PLEIN `mur` (le moteur en dérive TOUTES les faces) ; PORTE = sol `pierre` passable (tunnel).
    for (const y of [2, 3]) {
      for (const x of [0, 1, 3, 4]) expect(z0.tiles[idx(x, y)]).toBe('mur');
      expect(z0.tiles[idx(2, y)]).toBe('pierre'); // tunnel de porte (col 2)
    }
    // Chemin de ronde = couche de sol `pierre` MARCHABLE à 4 m sur TOUTE la bande (gate incluse).
    for (const y of [2, 3]) for (const x of [0, 1, 2, 3, 4]) {
      expect(z1.tiles[idx(x, y)]).toBe('pierre');
      expect(z1.height![idx(x, y)]).toBe(4);
      expect(isWalkable(s, x, y, 1)).toBe(true);
    }
    // Le SOLIDE vient du TERRAIN (bloc plein `mur`), comme un bâtiment ; la seule donnée z1 est la CRÉNELURE
    // (décoration de rendu, n'affecte NI passabilité NI LdV).
    expect(z1.crenellated).toBeDefined();
    // Champ/cour restent au SOL : pas de bloc `mur`, pas de chemin de ronde (z1 vide).
    for (const y of [0, 1, 4, 5]) for (const x of [0, 2, 4]) {
      expect(z0.tiles[idx(x, y)]).not.toBe('mur');
      expect(z1.tiles[idx(x, y)]).toBe('vide');
    }
  });

  it('MASSE DE MUR : une case de courtine (z0) est ENSEVELIE → IMPASSABLE ; le TUNNEL de porte reste PASSABLE', () => {
    // Courtine pleine : z0 sous le rempart = impassable (on ne traverse pas la masse).
    for (const y of [2, 3]) for (const x of [0, 1, 3, 4]) expect(isWalkable(s, x, y, 0)).toBe(false);
    // Tunnel de porte (col 2, TOUTE l'épaisseur) : z0 marchable.
    for (const y of [2, 3]) expect(isWalkable(s, 2, y, 0)).toBe(true);
  });

  it('HERSE sur la BOUCHE extérieure seule (facing N) : intacte elle coupe champ↔cour ; abattue, la brèche ouvre', () => {
    const gate = s.walls!.filter((w) => w.structure === 'porte-de-ville');
    expect(gate).toHaveLength(1); // UNE herse (arête interne de la bande épaisse n'en porte pas)
    expect(gate[0]).toMatchObject({ x: 2, y: 2, side: 'N' }); // bouche = arête extérieure (côté champ)
    expect(gate[0].door).toBeUndefined(); // structure brèchable pure, pas une porte ouvrable
    // INTACTE : aucun chemin z0 champ (2,0) → cour (2,4).
    const field = { x: 2, y: 0, z: 0 }, cour = { x: 2, y: 4, z: 0 };
    expect(wallBetween(s, 2, 1, 2, 2)).toBe(true); // la bouche bloque
    expect(pathTo(s, field, cour, { blocked: new Set() })).toBeNull();
    // ABATTUE : le tunnel s'ouvre et traverse les 2 cases de la bande.
    const breached = setStructureDown(s, 2, 2, 'N', 0, true);
    const path = pathTo(breached, field, cour, { blocked: new Set() });
    expect(path).not.toBeNull();
    expect(path!.some((p) => p.x === 2 && p.y === 2 && (p.z ?? 0) === 0)).toBe(true);
    expect(path!.some((p) => p.x === 2 && p.y === 3 && (p.z ?? 0) === 0)).toBe(true);
  });

  it('`hero` pose le départ du groupe ; la fondation `terrain` évite l’herbe surprise', () => {
    expect(s.entities.find((e) => e.kind === 'heroStart')?.pos).toEqual({ x: 0, y: 5 });
    expect(layerTiles(s, 0)[idx(0, 5)]).toBe('pave'); // terrain de la recette hero
    expect(layerTiles(s, 0)[idx(0, 2)]).toBe('mur'); // courtine = BLOC PLEIN `mur` au sol (plus de fondation 'pierre')
  });
});

describe('buildScene — rooms (bâtiment composé)', () => {
  const s = buildScene({
    id: 'b', nom: 'B', size: [8, 8], terrain: 'herbe',
    rooms: [{ id: 'taverne', label: 'Au Trophée', foot: [2, 2, 3, 3], style: 'taverne', door: { x: 3, y: 4, side: 'S' }, floor: 'planches', wallStructure: 'mur-en-bois' }],
  });
  it('pose toit + périmètre + porte + sol, id/label d’auteur préservés sur le toit', () => {
    expect(s.roofs).toHaveLength(1);
    expect(s.roofs![0].style).toBe('taverne');
    expect(s.roofs![0].id).toBe('taverne'); // id d'auteur (déclaratif) préservé, pas un `roof-N` frais
    expect(s.roofs![0].label).toBe('Au Trophée');
    expect(edgeWallState(s, 2, 2, 'N')).toBe('wall');
    expect(edgeWallState(s, 3, 4, 'S')).toBe('door');
    expect(layerTiles(s, 0)[2 + 2 * 8]).toBe('planches');
  });
});

describe('buildScene — bind (marqueurs → poses)', () => {
  const s = buildScene({
    id: 'm', nom: 'M', size: [6, 2],
    levels: { z0: '@.k.A.\n......' },
    bind: {
      '@': 'heroStart',
      k: { emplacement: 'canon-petit', crew: 'crew-0' },
      A: { kind: 'personnage', ref: 'garde-du-village', weapon: 'Arc' },
    },
  });
  it('interprète départ, emplacement+équipage et entité-modèle aux positions des marqueurs', () => {
    expect(s.entities.find((e) => e.kind === 'heroStart')?.pos).toEqual({ x: 0, y: 0 });
    const empl = s.entities.find((e) => e.postes?.length);
    expect(empl?.pos).toEqual({ x: 2, y: 0 });
    expect(empl?.postes![0].crewIds).toEqual(['crew-0']);
    const garde = s.entities.find((e) => e.ref === 'garde-du-village');
    expect(garde?.pos).toEqual({ x: 4, y: 0 });
    expect(garde?.weapon).toBe('Arc');
    // les marqueurs ne laissent pas de terrain parasite (nettoyés → base 'herbe')
    expect(layerTiles(s, 0)[0]).toBe('herbe');
  });
});

describe('buildScene — encounters (terse → entités + members)', () => {
  const s = buildScene({
    id: 'e', nom: 'E', size: [10, 6], terrain: 'herbe', heroStart: [1, 3],
    encounters: [{ id: 'enc', enemies: [{ ref: 'gobelin', pos: { x: 8, y: 3 } }] }],
  });
  it('expanse les ennemis en entités + rencontre (VISIBLES par défaut, RAW)', () => {
    expect(s.encounters).toHaveLength(1);
    expect(s.encounters[0].id).toBe('enc');
    expect(s.encounters[0].members).toEqual([{ entityId: 'enemy-enc-0' }]);
    const gob = s.entities.find((e) => e.id === 'enemy-enc-0');
    expect(gob?.ref).toBe('gobelin');
    expect(gob?.pos).toEqual({ x: 8, y: 3 });
    expect(gob?.combat?.hiddenUntilCombat).toBeUndefined(); // défaut visible
  });
});

describe('buildScene — encounters `hidden` (embuscade : entités invisibles jusqu’au combat)', () => {
  const s = buildScene({
    id: 'h', nom: 'H', size: [10, 6], terrain: 'herbe', heroStart: [1, 3],
    encounters: [{ id: 'amb', hidden: true, surprise: 'party', enemies: [{ ref: 'gobelin', pos: { x: 8, y: 3 } }] }],
  });
  it('propage `hidden` sur les entités enrôlées (combat.hiddenUntilCombat)', () => {
    expect(s.encounters[0].surprise).toBe('party');
    expect(s.entities.find((e) => e.id === 'enemy-amb-0')?.combat?.hiddenUntilCombat).toBe(true);
  });
});

describe('buildScene — encounters : marqueurs d’Avantage initial (Manœuvrabilité/Menace/Terrain, AA 11 l.53-65)', () => {
  const s = buildScene({
    id: 'adv', nom: 'ADV', size: [10, 6], terrain: 'herbe', heroStart: [1, 3],
    encounters: [{
      id: 'enc-menace',
      maneuverability: 'party',
      threat: { camp: 'enemies', tier: 'dangereuse' },
      terrain: { camp: 'party', heavy: true },
      enemies: [{ ref: 'gobelin', pos: { x: 8, y: 3 } }],
    }],
  });
  it('la rencontre buildée porte maneuverability/threat/terrain — parité avec surprise', () => {
    const enc = s.encounters[0];
    expect(enc.maneuverability).toBe('party');
    expect(enc.threat).toEqual({ camp: 'enemies', tier: 'dangereuse' });
    expect(enc.terrain).toEqual({ camp: 'party', heavy: true });
  });

  it('startAdvantagePools dérive l’Avantage initial depuis la rencontre buildée (bout en bout authoring → moteur)', async () => {
    const { startAdvantagePools } = await import('./combat/advantagePool');
    const mk = (id: string, kind: 'hero' | 'enemy') =>
      ({ id, kind, advantage: 0, conditions: [], talents: [], activeEffects: [], wounds: { current: 10, max: 10, base: 10 } }) as unknown as Parameters<typeof startAdvantagePools>[0][number];
    const hero = mk('h1', 'hero');
    const foe = mk('e1', 'enemy');
    // Manœuvrabilité 'party' (+2) + Terrain 'party' heavy (+2) côté alliés ; Menace 'enemies' dangereuse (+1) côté adverses.
    expect(startAdvantagePools([hero, foe], false, s.encounters[0])).toEqual({ allies: 4, foes: 1 });
  });
});

describe('buildScene — encounters : victoryCondition (#197) forwardée par le compilateur MapSpec', () => {
  const s = buildScene({
    id: 'vc', nom: 'VC', size: [10, 6], terrain: 'herbe', heroStart: [1, 3],
    encounters: [{
      id: 'enc-vc',
      victoryCondition: { type: 'destroyStructure', edge: { x: 5, y: 4, side: 'N' } },
      enemies: [{ ref: 'gobelin', pos: { x: 8, y: 3 } }],
    }],
  });
  it('la rencontre buildée porte victoryCondition', () => {
    expect(s.encounters[0].victoryCondition).toEqual({ type: 'destroyStructure', edge: { x: 5, y: 4, side: 'N' } });
  });
});

describe('buildScene — markerFill + emplacement hérite du z du marqueur', () => {
  const s = buildScene({
    id: 'mz', nom: 'MZ', size: [4, 2],
    levels: { z0: '....\n....', z1: 'B...\n....' }, // B (pièce) sur le chemin de ronde z1
    legend: { W: 'pierre' },
    markerFill: { B: 'W' }, // sous B : laisser 'W' (pierre marchable) au lieu d'un trou 'vide'
    relief: [{ rect: [0, 0, 3, 1], height: 4, z: 1 }],
    bind: { B: { emplacement: 'baliste', facing: 'N', member: { enc: 'def', side: 'ally' } } },
  });
  it('l’affût est posé sur l’étage du marqueur (z1), orienté, et sa case reste marchable', () => {
    const empl = s.entities.find((e) => e.postes?.length)!;
    expect(empl.z).toBe(1); // sur le rempart, pas au sol
    expect(empl.facing).toBe('N');
    expect(layerTiles(s, 1)[0]).toBe('pierre'); // case sous B = pierre (pas 'vide')
    expect(s.encounters.find((e) => e.id === 'def')!.members).toContainEqual({ entityId: empl.id, side: 'ally' });
  });
});

describe('buildScene — bind enrôle les entités posées dans une rencontre', () => {
  const s = buildScene({
    id: 'bm', nom: 'BM', size: [6, 2],
    levels: { z0: 'k.A...\n......' },
    bind: {
      k: { emplacement: 'canon-petit', crew: 'crew-0', member: { enc: 'def', side: 'ally' } },
      A: { entity: { kind: 'personnage', ref: 'garde-du-village' }, member: { enc: 'def', side: 'ally', ai: true } },
    },
    encounters: [{ id: 'def' }], // roster vide — rempli par les marqueurs bind
  });
  it('emplacement et entité-template posés aux marqueurs deviennent members (id généré → enrôlé)', () => {
    const empl = s.entities.find((e) => e.postes?.length)!;
    const garde = s.entities.find((e) => e.ref === 'garde-du-village')!;
    expect(empl.pos).toEqual({ x: 0, y: 0 });
    expect(garde.pos).toEqual({ x: 2, y: 0 });
    const def = s.encounters.find((e) => e.id === 'def')!;
    expect(def.members).toEqual(
      expect.arrayContaining([
        { entityId: empl.id, side: 'ally' },
        { entityId: garde.id, side: 'ally', ai: true },
      ]),
    );
  });
});

describe('buildScene — encounters à membres PRÉ-DÉCLARÉS (roster mixte)', () => {
  const s = buildScene({
    id: 'e2', nom: 'E2', size: [10, 6], terrain: 'herbe',
    entities: [{ id: 'pnj-1', kind: 'personnage', pos: { x: 5, y: 3 }, ref: 'garde-du-village', label: 'Garde' }],
    encounters: [
      // terse (entité fraîche cachée) + membre référençant une entité DÉJÀ posée (visible, dialogue…)
      { id: 'mix', enemies: [{ ref: 'gobelin', pos: { x: 8, y: 3 } }], members: [{ entityId: 'pnj-1', side: 'ally', ai: true }] },
    ],
  });
  it('fusionne les members terse et les members pré-déclarés, sans dupliquer l’entité existante', () => {
    expect(s.encounters[0].members).toEqual([
      { entityId: 'enemy-mix-0' },
      { entityId: 'pnj-1', side: 'ally', ai: true },
    ]);
    expect(s.entities.find((e) => e.id === 'enemy-mix-0')?.ref).toBe('gobelin');
    const pnj = s.entities.filter((e) => e.id === 'pnj-1');
    expect(pnj).toHaveLength(1); // pas de doublon fantôme
    expect(pnj[0].ref).toBe('garde-du-village');
  });
});

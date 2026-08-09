import { describe, it, expect } from 'vitest';
import { buildScene } from './mapSpec';
import { layerTiles, isWalkable, wallBetween, setStructureDown, heightAt, tileAt, type BuildingMass } from './scene';
import { pathTo, reachable, walkNeighbors } from './path';
import { edgeWallState } from '../ui/editor/editorState';
import { sceneZoneTiles } from './zones';
import { scenario as zonesPieces } from '../scenes/test-scenarios/zones-pieces';
import { perimeterEdges } from './sceneEdit.testkit';

/** GOLDEN = spécification exécutable du format `MapSpec`. Chaque bloc verrouille une section de la
 *  compilation `buildScene` (headless-editor). L'ordre de compilation est figé par ces attentes. */

// Les murs de PÉRIMÈTRE des specs viennent du kit partagé `sceneEdit.testkit` (`perimeterEdges`,
// côtés bruts N/E/S/O — `setEdgeWall` canonicalise à la compilation). `realFloorAt`/`interiorCells`
// au rez exige des murs clos (#881) : une salle décrite par une seule zone `zoneMap`/`zoneLegend`
// sans mur n'est pas du plancher réel.

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

describe('buildScene — peintures rectangulaires de terrain', () => {
  it('peint chaque rectangle sur sa couche sans modifier les autres cases', () => {
    const s = buildScene({
      id: 'rects', nom: 'Rects', size: [4, 3], terrain: 'herbe',
      levels: { z0: '....\n....\n....', z1: '....\n....\n....' },
      terrainRects: [
        { rect: [1, 0, 2, 2], terrain: 'plancher' },
        { rect: [0, 1, 1, 1], terrain: 'dalle', z: 1 },
      ],
    });
    expect(layerTiles(s, 0)).toEqual([
      'herbe', 'plancher', 'plancher', 'herbe',
      'herbe', 'plancher', 'plancher', 'herbe',
      'herbe', 'herbe', 'herbe', 'herbe',
    ]);
    expect(layerTiles(s, 1)).toEqual([
      'vide', 'vide', 'vide', 'vide',
      'dalle', 'vide', 'vide', 'vide',
      'vide', 'vide', 'vide', 'vide',
    ]);
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

describe('buildScene — `walled` : arête FENÊTRE `o` (#779)', () => {
  // Cases 'P' cloisonnées, arête E de (0,0) = fenêtre `o` (verticale), arête N de (0,1) = fenêtre `o` (horizontale).
  const s = buildScene({
    id: 'wlwin', nom: 'WLWIN', size: [2, 2],
    walled: {
      z0: [
        ' - - ',
        '|PoP|',
        ' o - ',
        '|P|P|',
        ' - - ',
      ].join('\n'),
    },
    legend: { P: 'planches' },
  });
  it('la fenêtre verticale (E de (0,0)) reste un mur PLEIN et porte window:true', () => {
    expect(edgeWallState(s, 0, 0, 'E')).toBe('wall');
    const seg = s.walls!.find((w) => w.x === 0 && w.y === 0 && w.side === 'E');
    expect(seg?.window).toBe(true);
  });
  it('la fenêtre horizontale (N de (0,1)) reste un mur PLEIN et porte window:true', () => {
    expect(edgeWallState(s, 0, 1, 'N')).toBe('wall');
    const seg = s.walls!.find((w) => w.x === 0 && w.y === 1 && w.side === 'N');
    expect(seg?.window).toBe(true);
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
  it('`window` (décoratif pur) est PROPAGÉ sur une diagonale (patchWall après toggleDiagonalWall), pan adossé au coin NO fermé', () => {
    const s = buildScene({
      id: 'diag', nom: 'Diag', size: [3, 3], terrain: 'pave',
      walls: [
        { x: 1, y: 1, side: 'N' },
        { x: 1, y: 1, side: 'O' },
        { x: 1, y: 1, side: '\\', window: true },
      ],
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

describe('buildScene — pan diagonal doit adosser un coin orthogonal fermé (#781)', () => {
  it('pan `\\` adossé aux deux murs pleins du coin NO (arêtes N+O murées) : ne throw pas, la diagonale est posée', () => {
    const s = buildScene({
      id: 'diag5', nom: 'Diag5', size: [3, 3], terrain: 'pave',
      walls: [
        { x: 1, y: 1, side: 'N' },
        { x: 1, y: 1, side: 'O' },
        { x: 1, y: 1, side: '\\' },
      ],
    });
    expect(s.walls!.find((w) => w.x === 1 && w.y === 1 && w.side === '\\')).toBeTruthy();
  });

  it('pan `\\` FLOTTANT (aucun mur orthogonal autour) : throw', () => {
    expect(() =>
      buildScene({
        id: 'diag6', nom: 'Diag6', size: [3, 3], terrain: 'pave',
        walls: [{ x: 1, y: 1, side: '\\' }],
      }),
    ).toThrow(/pan diagonal \(1,1\) sans coin orthogonal muré/);
  });

  it('pan `/` adossé aux deux murs pleins du coin SO (arêtes S+O murées) : ne throw pas', () => {
    const s = buildScene({
      id: 'diag7', nom: 'Diag7', size: [3, 3], terrain: 'pave',
      walls: [
        { x: 1, y: 1, side: 'S' },
        { x: 1, y: 1, side: 'O' },
        { x: 1, y: 1, side: '/' },
      ],
    });
    expect(s.walls!.find((w) => w.x === 1 && w.y === 1 && w.side === '/')).toBeTruthy();
  });

  it('pan `/` FLOTTANT (aucun mur orthogonal autour) : throw', () => {
    expect(() =>
      buildScene({
        id: 'diag8', nom: 'Diag8', size: [3, 3], terrain: 'pave',
        walls: [{ x: 1, y: 1, side: '/' }],
      }),
    ).toThrow(/pan diagonal \(1,1\) sans coin orthogonal muré/);
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

describe('buildScene — `cells.stair` (#780 : volée d’escalier → rampe interpolée entre deux surfaces)', () => {
  // Foyer (1 m, x=0) → volée de 3 `E` (z0) → galerie (4 m, z1) en diagonale du haut de la volée.
  // Base `mur` partout ailleurs (impassable) : seul le foyer offre un appui bas, seule la galerie un appui
  // haut — élimine toute ambiguïté d'orientation dans le test.
  const base = {
    id: 's', nom: 'S', size: [4, 3] as [number, number], terrain: 'mur' as const,
    levels: { z0: ['....', 'FEEE', '....'].join('\n'), z1: ['...G', '....', '....'].join('\n') },
    legend: { F: 'pave' as const, G: 'pierre' as const },
    elevate: { F: 1, G: 4 },
  };

  it('rampe interpolée Δ≤STEP_MAX_M (hauteurs 2/3/4 m) + connexité verticale z0→z1 DÉRIVÉE (départ ≠ 0)', () => {
    const s = buildScene({ ...base, cells: { E: { terrain: 'pierre', stair: { to: 'z1' } } } });
    expect(heightAt(s, 1, 1, 0)).toBe(2);
    expect(heightAt(s, 2, 1, 0)).toBe(3);
    expect(heightAt(s, 3, 1, 0)).toBe(4);
    expect(tileAt(s, 1, 1, 1)).toBe('vide'); // trémie z1 laissée ouverte au-dessus de la volée
    expect(tileAt(s, 2, 1, 1)).toBe('vide');
    expect(tileAt(s, 3, 1, 1)).toBe('vide');
    // Preuve de connexité CROSS-COUCHE : le haut de la volée (3,1,z0) rejoint la galerie (3,0,z1) à pied.
    expect(walkNeighbors(s, { x: 3, y: 1, z: 0 }).some((n) => n.x === 3 && n.y === 0 && n.z === 1)).toBe(true);
    const reach = reachable(s, { x: 0, y: 1, z: 0 }, 20, { blocked: new Set() });
    expect(reach.has('3,0,1')).toBe(true); // du foyer (z0) à la galerie (z1) en passant par la volée
  });

  it('volée peinte avec PLUSIEURS lettres (même `to`) : une seule rampe, mêmes cotes qu’en lettre unique', () => {
    const s = buildScene({
      ...base,
      levels: { ...base.levels, z0: ['....', 'FEDE', '....'].join('\n') },
      cells: { E: { terrain: 'pierre', stair: { to: 'z1' } }, D: { terrain: 'pierre', stair: { to: 'z1' } } },
    });
    expect(heightAt(s, 1, 1, 0)).toBe(2);
    expect(heightAt(s, 2, 1, 0)).toBe(3);
    expect(heightAt(s, 3, 1, 0)).toBe(4);
    expect(walkNeighbors(s, { x: 3, y: 1, z: 0 }).some((n) => n.x === 3 && n.y === 0 && n.z === 1)).toBe(true);
  });

  it('run RAMIFIÉ (T, degré 3) → rejeté', () => {
    expect(() => buildScene({
      id: 't', nom: 'T', size: [4, 4],
      levels: { z0: ['....', '.EEE', '..E.', '....'].join('\n') },
      cells: { E: { stair: { to: 'z1' } } },
    })).toThrow(/non-linéaire\/ramifiée/);
  });

  it('run trop COURT pour son Δh (2 cases, Δ=3 m, minimum 3) → rejeté', () => {
    expect(() => buildScene({
      id: 'c2', nom: 'C2', size: [4, 3], terrain: 'mur',
      levels: { z0: ['....', 'FEE.', '....'].join('\n'), z1: ['...G', '....', '....'].join('\n') },
      legend: { F: 'pave', G: 'pierre' },
      elevate: { F: 1, G: 4 },
      cells: { E: { terrain: 'pierre', stair: { to: 'z1' } } },
    })).toThrow(/insuffisante/);
  });

  it('TRÉMIE bouchée (case `to` non vide au-dessus du run) → rejetée', () => {
    expect(() => buildScene({
      ...base,
      levels: { ...base.levels, z1: ['...G', '.X..', '....'].join('\n') },
      legend: { ...base.legend, X: 'pierre' },
      cells: { E: { terrain: 'pierre', stair: { to: 'z1' } } },
    })).toThrow(/trémie bouchée/);
  });

  it('étage `to` inexistant → rejeté', () => {
    expect(() => buildScene({
      id: 'z5', nom: 'Z5', size: [2, 2],
      levels: { z0: 'E.\n..' },
      cells: { E: { stair: { to: 'z5' } } },
    })).toThrow(/étage to=z5 inexistant/);
  });

  it('les DEUX extrémités atteignent `to` → orientation ambiguë, rejetée', () => {
    expect(() => buildScene({
      id: 'amb', nom: 'AMB', size: [4, 3], terrain: 'mur',
      levels: { z0: ['....', '.EE.', '....'].join('\n'), z1: ['G..G', '....', '....'].join('\n') },
      legend: { G: 'pierre' },
      elevate: { G: 4 },
      cells: { E: { terrain: 'pierre', stair: { to: 'z1' } } },
    })).toThrow(/ambiguë/);
  });

  it('extrémité basse SANS surface d’appui (aucun voisin marchable) → rejetée', () => {
    expect(() => buildScene({
      id: 'noappui', nom: 'NA', size: [4, 3], terrain: 'mur',
      levels: { z0: ['....', 'EEE.', '....'].join('\n'), z1: ['...G', '....', '....'].join('\n') },
      legend: { G: 'pierre' },
      elevate: { G: 4 },
      cells: { E: { terrain: 'pierre', stair: { to: 'z1' } } },
    })).toThrow(/extrémité basse sans surface/);
  });

  // Volée d'UNE case (L=1) : la case est À LA FOIS l'extrémité haute (touche `to`) et basse (appui z).
  // Base `mur` partout ailleurs (impassable) : seul F offre un appui bas, seul G un plancher `to`.
  const one = {
    id: 'l1', nom: 'L1', size: [4, 3] as [number, number], terrain: 'mur' as const,
    levels: { z0: ['....', 'FE..', '....'].join('\n'), z1: ['.G..', '....', '....'].join('\n') },
    legend: { F: 'pave' as const, G: 'pierre' as const },
  };

  it('L=1 nominal (Δ=1 m) : case unique affleure `to`, connexité z0→z1 DÉRIVÉE', () => {
    const s = buildScene({ ...one, elevate: { F: 1, G: 2 }, cells: { E: { terrain: 'pierre', stair: { to: 'z1' } } } });
    expect(heightAt(s, 1, 1, 0)).toBe(2); // la case affleure hHigh (Δ=1, minCells=1)
    expect(tileAt(s, 1, 1, 1)).toBe('vide'); // trémie z1 laissée ouverte au-dessus de la case
    expect(walkNeighbors(s, { x: 1, y: 1, z: 0 }).some((n) => n.x === 1 && n.y === 0 && n.z === 1)).toBe(true);
    const reach = reachable(s, { x: 0, y: 1, z: 0 }, 20, { blocked: new Set() });
    expect(reach.has('1,0,1')).toBe(true); // du pied (F, z0) à la galerie (G, z1) via la case unique
  });

  it('L=1 trop raide (Δ=2 m > STEP_MAX_M) → rejetée avec le BON message (pas « ambiguë »)', () => {
    expect(() => buildScene({ ...one, elevate: { F: 1, G: 3 }, cells: { E: { terrain: 'pierre', stair: { to: 'z1' } } } }))
      .toThrow(/insuffisante/);
  });

  it('L=1 ne touche pas le plancher de `to` (case isolée) → rejetée', () => {
    expect(() => buildScene({
      id: 'l1iso', nom: 'L1ISO', size: [4, 3], terrain: 'mur',
      levels: { z0: ['....', 'FE..', '....'].join('\n'), z1: ['....', '....', '....'].join('\n') },
      legend: { F: 'pave' },
      elevate: { F: 1 },
      cells: { E: { terrain: 'pierre', stair: { to: 'z1' } } },
    })).toThrow(/ne touche pas le plancher de to/);
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

describe('buildScene — `zoneMap`/`zoneLegend` (#782 : zones descriptives de pièce, par étage)', () => {
  const s = buildScene({
    id: 'zm', nom: 'ZM', size: [4, 3], terrain: 'pave',
    levels: { z0: '....\n....\n....', z1: '....\n....\n....' },
    zoneMap: {
      z0: 'AA..\nAA..\n....',
      z1: '..BB\n..BB\n....',
    },
    zoneLegend: { A: { label: 'Cave' }, B: { label: 'Chambre' } },
  });
  it('compile une zone descriptive par (char, étage), bounding-box exacte + bon label + bon z', () => {
    const cave = s.effectZones!.find((z) => z.id === 'zone-A-z0')!;
    expect(cave.label).toBe('Cave');
    expect(cave.z).toBe(0);
    expect(cave.area).toEqual({ kind: 'rect', x: 0, y: 0, w: 2, h: 2 });
    const chambre = s.effectZones!.find((z) => z.id === 'zone-B-z1')!;
    expect(chambre.label).toBe('Chambre');
    expect(chambre.z).toBe(1);
    expect(chambre.area).toEqual({ kind: 'rect', x: 2, y: 0, w: 2, h: 2 });
  });
  it('zone purement descriptive : aucun effet mécanique (inerte)', () => {
    const cave = s.effectZones!.find((z) => z.id === 'zone-A-z0')!;
    expect(cave.onCross).toBeUndefined();
    expect(cave.perRound).toBeUndefined();
  });

  it('conserve le masque exact d’une zone non rectangulaire sans absorber les trous ni une autre zone dans sa bounding-box', () => {
    const masked = buildScene({
      id: 'zmmask', nom: 'ZMMASK', size: [4, 3], terrain: 'pave',
      zoneMap: { z0: 'A.A.\n.B..\nA...' },
      zoneLegend: {
        A: { label: 'Coursive', presentation: 'interior' },
        B: { label: 'Cour', presentation: 'exterior' },
      },
    });
    const coursive = masked.effectZones!.find((z) => z.id === 'zone-A-z0')!;
    const cour = masked.effectZones!.find((z) => z.id === 'zone-B-z0')!;
    expect(coursive.area).toEqual({ kind: 'rect', x: 0, y: 0, w: 3, h: 3 });
    expect(coursive.presentation).toBe('interior');
    expect(sceneZoneTiles(coursive)).toEqual([
      { x: 0, y: 0, z: 0 },
      { x: 2, y: 0, z: 0 },
      { x: 0, y: 2, z: 0 },
    ]);
    expect(sceneZoneTiles(coursive)).not.toContainEqual({ x: 1, y: 1, z: 0 });
    expect(cour.presentation).toBe('exterior');
    expect(sceneZoneTiles(cour)).toEqual([{ x: 1, y: 1, z: 0 }]);
  });

  it('deux pièces au même (x,y) sur des étages différents restent deux zones distinctes (raison du champ z)', () => {
    const s2 = buildScene({
      id: 'zm2', nom: 'ZM2', size: [2, 2], terrain: 'pave',
      levels: { z0: '..\n..', z1: '..\n..' },
      zoneMap: { z0: 'CC\nCC', z1: 'CC\nCC' },
      zoneLegend: { C: { label: 'Salle' } },
    });
    expect(s2.effectZones).toHaveLength(2);
    expect(s2.effectZones!.map((z) => z.id).sort()).toEqual(['zone-C-z0', 'zone-C-z1']);
    expect(s2.effectZones!.find((z) => z.id === 'zone-C-z0')!.z).toBe(0);
    expect(s2.effectZones!.find((z) => z.id === 'zone-C-z1')!.z).toBe(1);
  });

  it('char de `zoneMap` hors `zoneLegend` → fail-fast', () => {
    expect(() =>
      buildScene({
        id: 'zmbad', nom: 'ZMBAD', size: [2, 2], terrain: 'pave',
        zoneMap: { z0: 'X.\n..' },
        zoneLegend: {},
      }),
    ).toThrow(/char inconnu/);
  });
});

describe('buildScene — architecture authorée', () => {
  it('compile une architecture par ids stables et copie profondément ses parties', () => {
    const spec = {
      id: 'architecture', nom: 'Architecture', size: [8, 8] as [number, number],
      architecture: [{
        id: 'corps', style: 'maison',
        storeys: [{ id: 'corps-z0', z: 0, parts: [{ id: 'nef', foot: { x: 1, y: 1, w: 4, h: 3 } }], roomZoneIds: ['salle'] }],
        facades: [{ id: 'facade-sud', z: 0, edges: [{ x: 1, y: 3, side: 'N' as const }], appearance: 'mur-a-ossature-en-bois', features: [{ id: 'pignon', kind: 'gable' as const, edge: { x: 1, y: 3, side: 'N' as const } }] }],
        masses: [{ id: 'toit-nef', z: 0, footprint: [{ x: 1, y: 1, w: 4, h: 3 }, { x: 4, y: 4, w: 1, h: 1 }], levels: 1, profile: 'gable' as const, ridge: 'x' as const, pitchDeg: 42, material: 'tuile' }],
      }],
      zoneMap: { z0: ['........', '.SSSS...', '.SSSS...', '.SSSS...', '....S...', '........', '........', '........'] },
      zoneLegend: { S: { id: 'salle', label: 'Salle', presentation: 'interior' as const } },
      walls: perimeterEdges([{ x: 1, y: 1, w: 4, h: 3 }, { x: 4, y: 4, w: 1, h: 1 }]),
    };
    const scene = buildScene(spec);
    expect(scene.effectZones?.[0]?.id).toBe('salle');
    expect(scene.architecture?.[0]?.masses[0]?.id).toBe('toit-nef');
    scene.architecture![0].storeys[0].parts[0].foot.x = 7;
    expect(spec.architecture[0].storeys[0].parts[0].foot.x).toBe(1);
    scene.architecture![0].facades[0].edges[0].x = 7;
    scene.architecture![0].facades[0].features![0].edge.x = 7;
    scene.architecture![0].masses[0].footprint[0].y = 7;
    scene.architecture![0].masses[0].footprint[1].x = 7;
    expect(spec.architecture[0].facades[0].edges[0].x).toBe(1);
    expect(spec.architecture[0].facades[0].features![0].edge.x).toBe(1);
    expect(spec.architecture[0].masses[0].footprint[0].y).toBe(1);
    expect(spec.architecture[0].masses[0].footprint[1].x).toBe(4);
  });

  it('refuse un id de zone descriptive dupliqué', () => {
    expect(() => buildScene({
      id: 'zones-dupliquees', nom: 'Zones dupliquées', size: [2, 2],
      levels: { z0: '..\n..', z1: '..\n..' },
      zoneMap: { z0: 'A.\n..', z1: 'B.\n..' },
      zoneLegend: { A: { id: 'salle', label: 'Salle' }, B: { id: 'salle', label: 'Chambre' } },
    })).toThrow(/id dupliqué/i);
  });
});

describe('scénario zones-pieces — architecture liée aux zones intérieures', () => {
  it('lie le corps et son étage aux quatre ids de pièces ; la masse de toiture couvre exactement leur emprise', () => {
    const s = zonesPieces.scene;
    const roomIds = ['cave', 'chambre', 'cuisine', 'salle-commune'];
    expect(s.effectZones?.map((zone) => zone.id)).toEqual(roomIds);
    expect(s.effectZones?.every((zone) => zone.presentation === 'interior')).toBe(true);
    expect(s.architecture).toHaveLength(1);
    expect(s.architecture?.[0].storeys[0].roomZoneIds).toEqual(roomIds);
    const cells = new Set(s.effectZones!.flatMap((zone) => sceneZoneTiles(zone).map((t) => `${t.x},${t.y}`)));
    const massCells = new Set(s.architecture![0].masses.flatMap((mass) =>
      mass.footprint.flatMap((rect) => {
        const out: string[] = [];
        for (let y = rect.y; y < rect.y + rect.h; y++) for (let x = rect.x; x < rect.x + rect.w; x++) out.push(`${x},${y}`);
        return out;
      })));
    expect(massCells).toEqual(cells); // buildScene valide déjà cette égalité (fail-fast) ; on la re-vérifie ici
  });
});

describe('buildScene — validation FAIL-FAST des masses de bâtiment (#823)', () => {
  const salleZoneMap = [
    '............',
    '.SSSS.......',
    '.SSSS.......',
    '.SSSS.......',
    '.SSSS.......',
    '............',
    '............',
    '............',
    '............',
    '............',
    '............',
    '............',
  ].join('\n');
  const goodMass: BuildingMass = {
    id: 'm', z: 0, footprint: [{ x: 1, y: 1, w: 4, h: 4 }], levels: 1,
    profile: 'gable' as const, ridge: 'x' as const, pitchDeg: 40, material: 'tuile',
  };
  const specWith = (masses: BuildingMass[], patchSpec: Partial<Parameters<typeof buildScene>[0]> = {}) => ({
    id: 't', nom: 'T', size: [12, 12] as [number, number], terrain: 'herbe',
    levels: { z0: Array.from({ length: 12 }, () => '.'.repeat(12)).join('\n'), z1: Array.from({ length: 12 }, () => '.'.repeat(12)).join('\n') },
    zoneMap: { z0: salleZoneMap },
    zoneLegend: { S: { id: 'salle', label: 'Salle', presentation: 'interior' as const } },
    walls: perimeterEdges([{ x: 1, y: 1, w: 4, h: 4 }]),
    architecture: [{ id: 'corps', style: 'maison', storeys: [], facades: [], masses }],
    ...patchSpec,
  });

  it('contrôle positif : une masse valide ne lève pas', () => {
    expect(() => buildScene(specWith([goodMass]))).not.toThrow();
  });

  it('règle 1 — une case déclarée dans une masse hors du plancher réel → lève', () => {
    expect(() => buildScene(specWith([{ ...goodMass, footprint: [{ x: 1, y: 1, w: 5, h: 5 }] }])))
      .toThrow(/hors du plancher réel/);
  });

  it('règle 2 (révisée #829) — une case de plancher orpheline (masse déclarée trop petite) est DÉRIVÉE, ne lève plus', () => {
    const spec = specWith([{ ...goodMass, footprint: [{ x: 1, y: 1, w: 2, h: 2 }] }]);
    const scene = buildScene(spec);
    const corps = scene.architecture!.find((b) => b.id === 'corps')!;
    // la masse déclarée (surcharge, 2×2) + au moins une masse DÉRIVÉE qui couvre le reste de la salle.
    expect(corps.masses.length).toBeGreaterThan(1);
    const covered = new Set<string>();
    for (const mass of corps.masses)
      for (const rect of mass.footprint)
        for (let y = rect.y; y < rect.y + rect.h; y++)
          for (let x = rect.x; x < rect.x + rect.w; x++) covered.add(`${x},${y}`);
    for (let y = 1; y <= 4; y++) for (let x = 1; x <= 4; x++) expect(covered.has(`${x},${y}`)).toBe(true);
  });

  it('règle 3 — deux masses se chevauchent → lève', () => {
    expect(() => buildScene(specWith([goodMass, { ...goodMass, id: 'm2' }])))
      .toThrow(/CHEVAUCHÉE/);
  });

  it('règle 4 — masse non contiguë (deux cases diagonales seulement) → lève', () => {
    const zoneMap = [
      '............',
      '.S..........',
      '............',
      '...S........',
      '............',
      '............',
      '............',
      '............',
      '............',
      '............',
      '............',
      '............',
    ].join('\n');
    expect(() => buildScene(specWith(
      [{ ...goodMass, footprint: [{ x: 1, y: 1, w: 1, h: 1 }, { x: 3, y: 3, w: 1, h: 1 }] }],
      { zoneMap: { z0: zoneMap } },
    ))).toThrow(/NON CONTIGUË/);
  });

  it('règle 5 — masse carrée (gable/hip) sans `ridge` déclaré → lève ; déclaré = passe', () => {
    expect(() => buildScene(specWith([{ ...goodMass, ridge: undefined }])))
      .toThrow(/faîtage.*est ambigu/);
    expect(() => buildScene(specWith([goodMass]))).not.toThrow(); // même emprise carrée, ridge déclaré
  });

  it('règle 6 — pente hors de la plage sensée [5°, 75°] → lève', () => {
    expect(() => buildScene(specWith([{ ...goodMass, pitchDeg: 2 }]))).toThrow(/pente .* hors plage sensée/);
    expect(() => buildScene(specWith([{ ...goodMass, pitchDeg: 89 }]))).toThrow(/pente .* hors plage sensée/);
  });

  it('profil `shed` sans `eaveSide` déclaré → lève', () => {
    expect(() => buildScene(specWith([{ ...goodMass, profile: 'shed' as const, ridge: undefined }])))
      .toThrow(/sans .eaveSide. déclaré/);
  });

  it('support de plancher — une case d’étage (z>0) posée sur du vide/de la terre nue → lève ; tolérée nommément = passe', () => {
    const spec = specWith([goodMass], {
      relief: [{ rect: [0, 0, 11, 11], height: 4, z: 1 }],
      terrainRects: [{ rect: [8, 8, 1, 1], terrain: 'plancher' as const, z: 1 }],
    });
    expect(() => buildScene(spec)).toThrow(/posée sur/);
    expect(() => buildScene({ ...spec, knownUnsupportedFloor: [{ x: 8, y: 8, z: 1 }] })).not.toThrow();
  });
});

describe('buildScene — dérivation par défaut des masses de bâtiment (#829)', () => {
  const salleZoneMap = [
    '............',
    '.SSSS.......',
    '.SSSS.......',
    '.SSSS.......',
    '.SSSS.......',
    '............',
    '............',
    '............',
    '............',
    '............',
    '............',
    '............',
  ].join('\n');
  const baseSpec = (patch: Partial<Parameters<typeof buildScene>[0]> = {}) => ({
    id: 't', nom: 'T', size: [12, 12] as [number, number], terrain: 'herbe',
    levels: { z0: Array.from({ length: 12 }, () => '.'.repeat(12)).join('\n') },
    zoneMap: { z0: salleZoneMap },
    zoneLegend: { S: { id: 'salle', label: 'Salle', presentation: 'interior' as const } },
    walls: perimeterEdges([{ x: 1, y: 1, w: 4, h: 4 }]),
    ...patch,
  });

  it('AUCUNE masse déclarée → la toiture couvre tout le bâti sans qu\'un auteur ait rien authoré', () => {
    const scene = buildScene(baseSpec({ architecture: [{ id: 'corps', style: 'maison', storeys: [], facades: [], masses: [] }] }));
    const corps = scene.architecture!.find((b) => b.id === 'corps')!;
    expect(corps.masses.length).toBeGreaterThan(0);
    const covered = new Set<string>();
    for (const mass of corps.masses)
      for (const rect of mass.footprint)
        for (let y = rect.y; y < rect.y + rect.h; y++)
          for (let x = rect.x; x < rect.x + rect.w; x++) covered.add(`${x},${y}`);
    for (let y = 1; y <= 4; y++) for (let x = 1; x <= 4; x++) expect(covered.has(`${x},${y}`)).toBe(true);
  });

  it('une surcharge explicite PRIME sur la dérivation (cour non coiffée par `roofExclusions`)', () => {
    const scene = buildScene(baseSpec({
      architecture: [{
        id: 'corps', style: 'maison', storeys: [], facades: [], masses: [],
        roofExclusions: [{ z: 0, rect: { x: 2, y: 2, w: 2, h: 2 } }],
      }],
    }));
    const corps = scene.architecture!.find((b) => b.id === 'corps')!;
    const covered = new Set<string>();
    for (const mass of corps.masses)
      for (const rect of mass.footprint)
        for (let y = rect.y; y < rect.y + rect.h; y++)
          for (let x = rect.x; x < rect.x + rect.w; x++) covered.add(`${x},${y}`);
    // la cour exclue (2,2)-(3,3) ne reçoit AUCUN toit dérivé…
    for (let y = 2; y <= 3; y++) for (let x = 2; x <= 3; x++) expect(covered.has(`${x},${y}`)).toBe(false);
    // …le reste de la salle reste couvert.
    expect(covered.has('1,1')).toBe(true);
    expect(covered.has('4,4')).toBe(true);
  });

  it('déplacer un mur (agrandir la pièce) fait suivre la toiture — aucune masse à re-déclarer', () => {
    const biggerZoneMap = [
      '............',
      '.SSSSS......',
      '.SSSSS......',
      '.SSSSS......',
      '.SSSSS......',
      '.SSSSS......',
      '............',
      '............',
      '............',
      '............',
      '............',
      '............',
    ].join('\n');
    const scene = buildScene(baseSpec({
      zoneMap: { z0: biggerZoneMap },
      walls: perimeterEdges([{ x: 1, y: 1, w: 5, h: 5 }]), // le mur agrandi lui aussi (#881, walls = source de la pièce)
      architecture: [{ id: 'corps', style: 'maison', storeys: [], facades: [], masses: [] }],
    }));
    const corps = scene.architecture!.find((b) => b.id === 'corps')!;
    const covered = new Set<string>();
    for (const mass of corps.masses)
      for (const rect of mass.footprint)
        for (let y = rect.y; y < rect.y + rect.h; y++)
          for (let x = rect.x; x < rect.x + rect.w; x++) covered.add(`${x},${y}`);
    for (let y = 1; y <= 5; y++) for (let x = 1; x <= 5; x++) expect(covered.has(`${x},${y}`)).toBe(true);
  });

  it('deux corps sur la MÊME scène (l\'éditeur en crée un vide au passage) ne dérivent JAMAIS le même plancher deux fois', () => {
    const scene = buildScene(baseSpec({
      architecture: [
        { id: 'diligence', style: 'maison', storeys: [], facades: [], masses: [] },
        { id: 'architecture-0', style: 'maison', storeys: [], facades: [], masses: [] },
      ],
    }));
    const [corps, vide] = scene.architecture!;
    expect(corps.masses.length).toBeGreaterThan(0);
    expect(vide.masses).toHaveLength(0); // rien à dériver : « diligence » a déjà tout pris (1er du tableau)
    const covered = new Set<string>();
    for (const mass of [...corps.masses, ...vide.masses])
      for (const rect of mass.footprint)
        for (let y = rect.y; y < rect.y + rect.h; y++)
          for (let x = rect.x; x < rect.x + rect.w; x++) covered.add(`${x},${y}`);
    for (let y = 1; y <= 4; y++) for (let x = 1; x <= 4; x++) expect(covered.has(`${x},${y}`)).toBe(true);
  });
});

describe('buildScene — la couverture des masses se juge sur l\'EMPRISE du corps (#1158)', () => {
  type Foot = { x: number; y: number; w: number; h: number };
  const A: Foot = { x: 1, y: 1, w: 4, h: 4 };
  const B: Foot = { x: 7, y: 1, w: 3, h: 3 };

  const body = (id: string, foot: Foot, footprint: Foot[] = [foot]) => ({
    id, style: 'maison',
    storeys: [{ id: `${id}-z0`, z: 0, parts: [{ id: `${id}-volume`, foot }], roomZoneIds: [`piece-${id}`] }],
    facades: [],
    masses: footprint.map((rect, i) => ({
      id: `toit-${id}-${i}`, z: 0, footprint: [{ ...rect }], levels: 1,
      profile: 'gable' as const, ridge: 'x' as const, pitchDeg: 42, material: 'tuile',
    })),
  });

  const specOf = (bodies: ReturnType<typeof body>[], foots: Foot[]) => ({
    id: 't', nom: 'T', size: [12, 12] as [number, number], terrain: 'herbe',
    levels: { z0: Array.from({ length: 12 }, () => '.'.repeat(12)).join('\n') },
    architecture: bodies,
    walls: perimeterEdges(foots),
    terrainRects: foots.map((f) => ({ rect: [f.x, f.y, f.w, f.h] as [number, number, number, number], terrain: 'plancher' as const })),
    zoneMap: {
      z0: Array.from({ length: 12 }, (_, y) => Array.from({ length: 12 }, (_, x) => {
        if (x >= A.x && x < A.x + A.w && y >= A.y && y < A.y + A.h) return 'S';
        if (x >= B.x && x < B.x + B.w && y >= B.y && y < B.y + B.h) return 'T';
        return '.';
      }).join('')).join('\n'),
    },
    zoneLegend: {
      S: { id: 'piece-corps-a', label: 'Salle A', presentation: 'interior' as const },
      T: { id: 'piece-corps-b', label: 'Salle B', presentation: 'interior' as const },
    },
  });

  it('deux corps DISJOINTS, chacun couvrant sa propre emprise → compile', () => {
    expect(() => buildScene(specOf([body('corps-a', A), body('corps-b', B)], [A, B]))).not.toThrow();
  });

  it('un corps dont la masse authorée laisse une case de SA PROPRE emprise sans toit → lève, en nommant CE corps', () => {
    const trou: Foot = { x: B.x, y: B.y, w: B.w, h: B.h - 1 }; // la rangée y=3 de « corps-b » reste nue
    expect(() => buildScene(specOf([body('corps-a', A), body('corps-b', B, [trou])], [A, B])))
      .toThrow(/corps « corps-b » : case de plancher \(\d+,3\) à l'étage 0 n'appartient à AUCUNE masse/);
  });

  it('non-régression mono-corps : la masse couvrant toute l\'emprise compile, et la couvre bien', () => {
    const scene = buildScene(specOf([body('corps-a', A)], [A]));
    const corps = scene.architecture!.find((b) => b.id === 'corps-a')!;
    const covered = new Set<string>();
    for (const mass of corps.masses)
      for (const rect of mass.footprint)
        for (let y = rect.y; y < rect.y + rect.h; y++)
          for (let x = rect.x; x < rect.x + rect.w; x++) covered.add(`${x},${y}`);
    for (let y = A.y; y < A.y + A.h; y++)
      for (let x = A.x; x < A.x + A.w; x++) expect(covered.has(`${x},${y}`)).toBe(true);
  });
});

import type { Terrain, WallSeg } from './scene';
import { terrainWalkable } from './terrain';

/**
 * Authoring de carte par ASCII (1 char = 1 tuile) — lisible et fidèle pour reproduire un plan. Une
 * grille par ÉTAGE (z) pour le multi-niveaux. Même esprit que le générateur d'arène (`scripts/arene`),
 * mais côté app (source unique réutilisable par les scénarios `src/scenes/...`).
 */

/** Légende commune : `.`/espace = `base`. Surchargeable par scène via `legend`. */
const BASE_LEGEND: Record<string, Terrain> = { '#': 'mur', '~': 'eau', D: 'porte', _: 'fosse', '=': 'planches' };

/** Parse une carte ASCII → { w, h, tiles }. Lève si les lignes diffèrent en largeur ou sur un char
 *  inconnu (garde-fou d'authoring : un plan mal aligné ne passe pas en silence). */
export function parseAsciiRows(rows: string[], base: Terrain, legend: Record<string, Terrain> = {}): { w: number; h: number; tiles: Terrain[] } {
  const w = rows[0]?.length ?? 0;
  const lg = { ...BASE_LEGEND, ...legend };
  const tiles: Terrain[] = [];
  rows.forEach((row, y) => {
    if (row.length !== w) throw new Error(`ascii: ligne ${y} largeur ${row.length} ≠ ${w}`);
    for (const ch of row) {
      if (ch === '.' || ch === ' ') tiles.push(base);
      else if (lg[ch]) tiles.push(lg[ch]);
      else throw new Error(`ascii: char inconnu « ${ch} » (ligne ${y})`);
    }
  });
  return { w, h: rows.length, tiles };
}

/**
 * Scanne les `markerChars` dans la grille → leurs positions ET les lignes NETTOYÉES (chaque marqueur
 * remplacé par le char de remplissage = `fill[ch]` sinon `'.'`). Brique de base du motif « poser un
 * marqueur, le nettoyer, scanner sa position » (cf. authoring d'entités dans l'ASCII). `fill` RESTAURE la
 * tuile SOUS le marqueur (ex. une unité au sol pavé : `{ '@': 'P' }`) — sans quoi un marqueur effacerait
 * son terrain (retombe sur la `base`). N'altère AUCUN char non-marqueur. Une clé par char marqueur (même
 * absent → `[]`), positions en ordre de balayage (haut→bas, gauche→droite).
 */
export function scanMarkers(rows: string[], markerChars: string, fill: Record<string, string> = {}): { positions: Record<string, { x: number; y: number }[]>; cleaned: string[] } {
  const marks = new Set(markerChars.split(''));
  const positions: Record<string, { x: number; y: number }[]> = {};
  for (const ch of marks) positions[ch] = [];
  const cleaned = rows.map((row, y) => {
    let out = '';
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (marks.has(ch)) { positions[ch].push({ x, y }); out += fill[ch] ?? '.'; }
      else out += ch;
    }
    return out;
  });
  return { positions, cleaned };
}

/** PORTE d'arête (franchissable au jeu, MUR pour la lecture du plan). */
const DOOR_EDGE = ':';
/** FENÊTRE d'arête (mur serti d'une vitre). */
const WINDOW_EDGE = 'o';
/** Cloison DIAGONALE posée sur une CASE (et non sur une arête) — angle mort d'`isWallEdge`. */
const DIAGONAL_CELLS = '/\\';

/** Un char d'ARÊTE ferme-t-il le plan ? Table UNIQUE du box-drawing, lue par le seul `parseWalledAscii`
 *  — `structures` y ajoute les chars de STRUCTURE déclarés par la scène (herse, grille), qui valent mur. */
function isWallEdge(ch: string, structures: Record<string, string> = {}): boolean {
  return ch === '|' || ch === '-' || ch === DOOR_EDGE || ch === WINDOW_EDGE || ch in structures;
}

/** Découpe une grille BOX-DRAWING en lignes, en ne retirant QUE l'ARTEFACT de littéral de gabarit (une
 *  seule ligne vide de tête et une seule de queue autour du `String.raw`) : les lignes vides INTERNES
 *  sont des rangées d'arêtes SIGNIFICATIVES, une grille (2H+1)×(2W+1) ne doit jamais perdre de rangée.
 *
 *  `w` (largeur de la carte en cases) recomplète chaque rangée à `2w+1` : les grilles éditables perdent
 *  leurs espaces de FIN à l'édition, et une rangée courte ferait mentir la lecture des arêtes E. Une
 *  rangée PLUS LONGUE que `2w+1` n'est jamais tronquée — c'est un désaccord entre la taille déclarée et
 *  le littéral, que `parseWalledAscii` doit rapporter comme une largeur incohérente. */
export function walledRowsOf(str: string, w?: number): string[] {
  const rows = str.split('\n');
  if (rows.length && rows[0].trim() === '') rows.shift();
  if (rows.length && rows[rows.length - 1].trim() === '') rows.pop();
  return w === undefined ? rows : rows.map((r) => r.padEnd(2 * w + 1, ' '));
}

/**
 * Carte BOÎTE (box-drawing) : tuiles ET murs sur arêtes en une grille lisible, comme un plan. Une carte
 * WxH s'écrit en (2H+1)×(2W+1) chars — les lignes/colonnes IMPAIRES portent les TUILES, les PAIRES les
 * ARÊTES :
 *   `|` mur vertical · `-` mur horizontal · `:` PORTE (arête franchissable) · `o` FENÊTRE (mur plein
 *   serti d'une vitre, décoratif — ne change pas le combat) · `+` jonction · ` ` ouvert.
 * Les cases (slots impairs) utilisent la même légende que `parseAsciiRows` (`.`/espace = `base`).
 * Renvoie aussi les bords du bâtiment (murs périmétriques, en x=-1 / y=H — rendus, sans effet de jeu).
 *
 * `opts.structures` (char d'arête → id de `structures.json`) pose une STRUCTURE destructible sur l'arête
 * (ex. herse `porte-de-ville` dans le mur d'enceinte) : le char vaut mur, et le `WallSeg` porte
 * `structure: <id>` (en plus de `door` si le char est aussi `:`). Sans `structures`, comportement inchangé.
 */
export function parseWalledAscii(
  rows: string[],
  base: Terrain,
  legend: Record<string, Terrain> = {},
  opts: { structures?: Record<string, string> } = {},
): { w: number; h: number; tiles: Terrain[]; walls: WallSeg[] } {
  const W = (rows[0].length - 1) / 2;
  const H = (rows.length - 1) / 2;
  if (!Number.isInteger(W) || !Number.isInteger(H) || W < 1 || H < 1) throw new Error('ascii murs : grille (2W+1)×(2H+1) attendue');
  rows.forEach((r, y) => { if (r.length !== 2 * W + 1) throw new Error(`ascii murs : ligne ${y} largeur ${r.length} ≠ ${2 * W + 1}`); });
  const lg = { ...BASE_LEGEND, ...legend };
  const structures = opts.structures ?? {};
  const isWall = (ch: string) => isWallEdge(ch, structures);
  const tiles: Terrain[] = [];
  const walls: WallSeg[] = [];
  const wall = (x: number, y: number, side: 'N' | 'E', ch: string) => {
    const seg: WallSeg = { x, y, side };
    if (ch === DOOR_EDGE) seg.door = true;
    if (ch === WINDOW_EDGE) seg.window = true;
    if (structures[ch]) seg.structure = structures[ch];
    walls.push(seg);
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const ch = rows[2 * y + 1][2 * x + 1];
      if (DIAGONAL_CELLS.includes(ch)) { tiles.push(base); walls.push({ x, y, side: ch as '/' | '\\' }); } // cloison DIAGONALE en travers de la case
      else tiles.push(ch === '.' || ch === ' ' ? base : (lg[ch] ?? (() => { throw new Error(`ascii murs : char inconnu « ${ch} »`); })()));
      const n = rows[2 * y][2 * x + 1]; if (isWall(n)) wall(x, y, 'N', n); // arête N (au-dessus de la case)
      const e = rows[2 * y + 1][2 * x + 2]; if (isWall(e)) wall(x, y, 'E', e); // arête E (à droite)
    }
  for (let x = 0; x < W; x++) { const s = rows[2 * H][2 * x + 1]; if (isWall(s)) wall(x, H, 'N', s); } // bord bas (S de la dernière rangée)
  for (let y = 0; y < H; y++) { const w = rows[2 * y + 1][0]; if (isWall(w)) wall(-1, y, 'E', w); } // bord gauche (W de la 1ʳᵉ colonne)
  return { w: W, h: H, tiles, walls };
}

/**
 * GRAINE d'une pièce dans un calque de zones : le `char` de la légende, les cases d'amorçage `at` (une
 * pièce coupée en deux par une PORTE interne en demande une par morceau), et une `clip` facultative —
 * fenêtre rectangulaire qui borne le remplissage là où le BÂTI ne le borne pas : une aire OUVERTE
 * partagée par n pièces se partitionne alors par une décision d'auteur, que le site déclarant motive.
 */
export type ZoneSeed = {
  char: string;
  at: readonly (readonly [number, number])[];
  clip?: { x0?: number; x1?: number; y0?: number; y1?: number };
};

/**
 * DÉRIVE le calque de zones (`MapSpec.zoneMap`) d'une grille `walled` : chaque graine inonde sa pièce en
 * 4-connexe, bornée par le BÂTI lui-même — toute arête murale (mur, porte, fenêtre, STRUCTURE
 * destructible : une herse ferme la pièce autant qu'un mur), toute case que le pas ne foule pas
 * (`terrainWalkable` : vide, eau, masse de maçonnerie, fosse, lave), toute cloison DIAGONALE posée sur
 * la case, le bord de grille, et la `clip` de la graine. Le plan est ainsi la SEULE source du
 * cloisonnement : un calque littéral se mettrait à mentir dès qu'on bouge un mur.
 *
 * La grille est lue UNE fois, par `parseWalledAscii` — la même lecture, les mêmes `base`/`legend`/
 * `structures` que `buildScene` : il n'y a donc aucun second lecteur de box-drawing à tenir synchrone.
 *
 * `sceneToAscii` produit lui aussi un `zoneMap`, d'un amont différent : une Scène DÉJÀ zonée, qu'il
 * re-sérialise ; ici l'amont est la grille + les graines, et le zonage n'existe pas encore.
 *
 * Rendu : calque dense H×W, `.` hors zone, tel que `buildScene` le consomme. Deux chars différents qui
 * atteignent une même case → `throw` (le plan ne tranche pas : il manque un mur ou une `clip`).
 */
export function zonesFromSeeds(
  rows: string[],
  base: Terrain,
  legend: Record<string, Terrain>,
  seeds: readonly ZoneSeed[],
  opts: { structures?: Record<string, string> } = {},
): string {
  const { w: W, h: H, tiles, walls } = parseWalledAscii(rows, base, legend, opts);
  const blocked = tiles.map((t) => !terrainWalkable(t));
  const edges = new Set<string>();
  for (const seg of walls) {
    if (seg.side === 'N' || seg.side === 'E') edges.add(`${seg.x},${seg.y},${seg.side}`);
    else blocked[seg.y * W + seg.x] = true; // cloison DIAGONALE en travers de la case
  }
  /** Une arête murale sépare-t-elle (x,y) de son voisin ? Les arêtes O/S sont celles E/N du voisin. */
  const barre = (x: number, y: number, nx: number, ny: number) =>
    edges.has(ny < y ? `${x},${y},N` : ny > y ? `${x},${ny},N` : nx < x ? `${nx},${y},E` : `${x},${y},E`);
  const owner: (string | undefined)[] = new Array(W * H);
  for (const seed of seeds) {
    const { x0 = 0, x1 = W - 1, y0 = 0, y1 = H - 1 } = seed.clip ?? {};
    const open = (x: number, y: number) =>
      x >= x0 && x <= x1 && y >= y0 && y <= y1 && x >= 0 && y >= 0 && x < W && y < H && !blocked[y * W + x];
    const stack: [number, number][] = [];
    for (const [sx, sy] of seed.at) {
      const dedans = sx >= 0 && sy >= 0 && sx < W && sy < H;
      if (!open(sx, sy)) throw new Error(`zonesFromSeeds : graine ${seed.char}@${sx},${sy} hors pièce (terrain « ${dedans ? tiles[sy * W + sx] : 'hors grille'} », clip ${x0},${y0}..${x1},${y1})`);
      stack.push([sx, sy]);
    }
    while (stack.length) {
      const [x, y] = stack.pop()!;
      const i = y * W + x;
      if (owner[i] === seed.char) continue;
      if (owner[i] !== undefined) throw new Error(`zonesFromSeeds : case (${x},${y}) revendiquée par « ${owner[i]} » et « ${seed.char} »`);
      owner[i] = seed.char;
      for (const [nx, ny] of [[x, y - 1], [x, y + 1], [x - 1, y], [x + 1, y]] as const)
        if (!barre(x, y, nx, ny) && open(nx, ny)) stack.push([nx, ny]);
    }
  }
  const out: string[] = [];
  for (let y = 0; y < H; y++) {
    let line = '';
    for (let x = 0; x < W; x++) line += owner[y * W + x] ?? '.';
    out.push(line);
  }
  return out.join('\n');
}

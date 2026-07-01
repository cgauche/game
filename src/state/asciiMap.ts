import type { Terrain, WallSeg } from './scene';

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

/**
 * Assemblage MULTI-ÉTAGES en un appel : une grille ASCII par niveau (siège : enceinte z0 + chemin de
 * ronde z1 + escaliers). Les `markers` (entités, escaliers…) sont scannés PUIS nettoyés sur CHAQUE
 * étage avant le parse terrain ; leurs positions ressortent avec `z`. Le char `stair` (sous-ensemble
 * des marqueurs) pose une case marchable (`stairBase ?? base`) et génère les escaliers AUTO : présent
 * sur z ET z+1 (même case) → un lien MONTANT `{ from:z, to:z+1 }` (le sens descendant est ajouté par
 * `stairLinks` côté consommateur). Tous les étages DOIVENT avoir le même w×h (sinon throw, comme
 * `parseAsciiRows`).
 */
export function parseLevels(
  levels: { z: number; rows: string[]; base: Terrain }[],
  opts: { legend?: Record<string, Terrain>; markers?: string; stair?: string; stairBase?: Terrain } = {},
): {
  w: number;
  h: number;
  levels: { z: number; tiles: Terrain[] }[];
  stairs: { from: { x: number; y: number; z: number }; to: { x: number; y: number; z: number } }[];
  markers: Record<string, { x: number; y: number; z: number }[]>;
} {
  const { legend = {}, markers: markerOpt = '', stair, stairBase } = opts;
  // L'escalier est un marqueur comme les autres (scanné+nettoyé). Dédoublonné, ordre stable.
  const allMarkers = [...new Set((markerOpt + (stair ?? '')).split(''))].join('');
  const markers: Record<string, { x: number; y: number; z: number }[]> = {};
  for (const ch of allMarkers) markers[ch] = [];
  const stairCells = new Map<number, Set<string>>(); // z → cases « x,y » portant l'escalier
  const present = new Set(levels.map((l) => l.z));
  const out: { z: number; tiles: Terrain[] }[] = [];
  let w = -1, h = -1;
  for (const lv of levels) {
    const { positions, cleaned } = scanMarkers(lv.rows, allMarkers);
    const grid = parseAsciiRows(cleaned, lv.base, legend);
    if (w < 0) { w = grid.w; h = grid.h; }
    else if (grid.w !== w || grid.h !== h) throw new Error(`ascii niveaux : étage z=${lv.z} ${grid.w}×${grid.h} ≠ ${w}×${h}`);
    for (const ch of allMarkers) for (const p of positions[ch]) markers[ch].push({ x: p.x, y: p.y, z: lv.z });
    if (stair) {
      const cells = new Set<string>();
      for (const p of positions[stair] ?? []) { grid.tiles[p.y * grid.w + p.x] = stairBase ?? lv.base; cells.add(`${p.x},${p.y}`); }
      stairCells.set(lv.z, cells);
    }
    out.push({ z: lv.z, tiles: grid.tiles });
  }
  const stairs: { from: { x: number; y: number; z: number }; to: { x: number; y: number; z: number } }[] = [];
  if (stair) for (const [z, cells] of stairCells) {
    const up = present.has(z + 1) ? stairCells.get(z + 1) : undefined;
    if (!up) continue;
    for (const c of cells) if (up.has(c)) { const [x, y] = c.split(',').map(Number); stairs.push({ from: { x, y, z }, to: { x, y, z: z + 1 } }); } // z explicite : un escalier relie deux étages précis (≠ convention z=0-omis des positions)
  }
  return { w, h, levels: out, stairs, markers };
}

/**
 * Carte BOÎTE (box-drawing) : tuiles ET murs sur arêtes en une grille lisible, comme un plan. Une carte
 * WxH s'écrit en (2H+1)×(2W+1) chars — les lignes/colonnes IMPAIRES portent les TUILES, les PAIRES les
 * ARÊTES :
 *   `|` mur vertical · `-` mur horizontal · `:` PORTE (arête franchissable) · `+` jonction · ` ` ouvert.
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
  const isDoor = (ch: string) => ch === ':';
  const isWall = (ch: string) => ch === '|' || ch === '-' || isDoor(ch) || ch in structures;
  const tiles: Terrain[] = [];
  const walls: WallSeg[] = [];
  const wall = (x: number, y: number, side: 'N' | 'E', ch: string) => {
    const seg: WallSeg = { x, y, side };
    if (isDoor(ch)) seg.door = true;
    if (structures[ch]) seg.structure = structures[ch];
    walls.push(seg);
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const ch = rows[2 * y + 1][2 * x + 1];
      if (ch === '/' || ch === '\\') { tiles.push(base); walls.push({ x, y, side: ch }); } // cloison DIAGONALE en travers de la case
      else tiles.push(ch === '.' || ch === ' ' ? base : (lg[ch] ?? (() => { throw new Error(`ascii murs : char inconnu « ${ch} »`); })()));
      const n = rows[2 * y][2 * x + 1]; if (isWall(n)) wall(x, y, 'N', n); // arête N (au-dessus de la case)
      const e = rows[2 * y + 1][2 * x + 2]; if (isWall(e)) wall(x, y, 'E', e); // arête E (à droite)
    }
  for (let x = 0; x < W; x++) { const s = rows[2 * H][2 * x + 1]; if (isWall(s)) wall(x, H, 'N', s); } // bord bas (S de la dernière rangée)
  for (let y = 0; y < H; y++) { const w = rows[2 * y + 1][0]; if (isWall(w)) wall(-1, y, 'E', w); } // bord gauche (W de la 1ʳᵉ colonne)
  return { w: W, h: H, tiles, walls };
}

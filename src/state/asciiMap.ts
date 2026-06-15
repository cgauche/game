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
 * Carte BOÎTE (box-drawing) : tuiles ET murs sur arêtes en une grille lisible, comme un plan. Une carte
 * WxH s'écrit en (2H+1)×(2W+1) chars — les lignes/colonnes IMPAIRES portent les TUILES, les PAIRES les
 * ARÊTES :
 *   `|` mur vertical · `-` mur horizontal · `:` PORTE (arête franchissable) · `+` jonction · ` ` ouvert.
 * Les cases (slots impairs) utilisent la même légende que `parseAsciiRows` (`.`/espace = `base`).
 * Renvoie aussi les bords du bâtiment (murs périmétriques, en x=-1 / y=H — rendus, sans effet de jeu).
 */
export function parseWalledAscii(rows: string[], base: Terrain, legend: Record<string, Terrain> = {}): { w: number; h: number; tiles: Terrain[]; walls: WallSeg[] } {
  const W = (rows[0].length - 1) / 2;
  const H = (rows.length - 1) / 2;
  if (!Number.isInteger(W) || !Number.isInteger(H) || W < 1 || H < 1) throw new Error('ascii murs : grille (2W+1)×(2H+1) attendue');
  rows.forEach((r, y) => { if (r.length !== 2 * W + 1) throw new Error(`ascii murs : ligne ${y} largeur ${r.length} ≠ ${2 * W + 1}`); });
  const lg = { ...BASE_LEGEND, ...legend };
  const isDoor = (ch: string) => ch === ':';
  const isWall = (ch: string) => ch === '|' || ch === '-' || isDoor(ch);
  const tiles: Terrain[] = [];
  const walls: WallSeg[] = [];
  const wall = (x: number, y: number, side: 'N' | 'E', ch: string) => walls.push(isDoor(ch) ? { x, y, side, door: true } : { x, y, side });
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const ch = rows[2 * y + 1][2 * x + 1];
      tiles.push(ch === '.' || ch === ' ' ? base : (lg[ch] ?? (() => { throw new Error(`ascii murs : char inconnu « ${ch} »`); })()));
      const n = rows[2 * y][2 * x + 1]; if (isWall(n)) wall(x, y, 'N', n); // arête N (au-dessus de la case)
      const e = rows[2 * y + 1][2 * x + 2]; if (isWall(e)) wall(x, y, 'E', e); // arête E (à droite)
    }
  for (let x = 0; x < W; x++) { const s = rows[2 * H][2 * x + 1]; if (isWall(s)) wall(x, H, 'N', s); } // bord bas (S de la dernière rangée)
  for (let y = 0; y < H; y++) { const w = rows[2 * y + 1][0]; if (isWall(w)) wall(-1, y, 'E', w); } // bord gauche (W de la 1ʳᵉ colonne)
  return { w: W, h: H, tiles, walls };
}

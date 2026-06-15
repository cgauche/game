import type { Terrain } from './scene';

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

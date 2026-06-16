/**
 * One-shot : DUMP la géométrie actuelle de l'opéra (buildOperaFloorplan) en GRILLES ASCII box-drawing
 * au format EXACT de `parseWalledAscii` (2W+1 × 2H+1), pour faire de l'ASCII la SOURCE éditable de la
 * carte. Légende : ' '=vide · ','=dalle (salles) · 'P'=plancher (parterre) · 'M'=marbre (foyer) ·
 * 'S'=scène (planches +0.4) · 's'=fosse (planches −0.4) ; arêtes '-'=mur N · '|'=mur E · ':'=porte.
 * Les DIAGONALES (visuelles) et les ESCALIERS et l'ÉLÉVATION restent gérés en code (overlay) — l'ASCII
 * porte le sol + les murs cardinaux + les portes (le gros). Sortie imprimée (à coller dans floorplan.ascii.ts).
 *   npx tsx scripts/qc/gen-opera-ascii.mts
 */
import { buildOperaFloorplan } from '../../src/scenes/opera/floorplan';

const scene = buildOperaFloorplan();
const W = scene.dimensions.w, H = scene.dimensions.h;

function gridFor(z: number): string {
  const lvl = scene.levels.find((l) => l.z === z)!;
  const tiles = lvl.tiles;
  const elev = lvl.elev;
  const g: string[][] = Array.from({ length: 2 * H + 1 }, () => Array(2 * W + 1).fill(' '));
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const t = tiles[y * W + x];
      let ch = ' ';
      if (t === 'dalle') ch = ',';
      else if (t === 'plancher') ch = 'P';
      else if (t === 'marbre') ch = 'M';
      else if (t === 'planches') { const e = elev?.[y * W + x] ?? 0; ch = e < 0 ? 's' : 'S'; }
      else if (t === 'vide') ch = ' ';
      else ch = '?'; // terrain non prévu → visible
      g[2 * y + 1][2 * x + 1] = ch;
    }
  for (const w of scene.walls ?? []) {
    if ((w.z ?? 0) !== z) continue;
    if (w.side === 'N') g[2 * w.y][2 * w.x + 1] = w.door ? ':' : '-';
    else if (w.side === 'E') g[2 * w.y + 1][2 * w.x + 2] = w.door ? ':' : '|';
    // diagonales (/ \) : NON émises (gérées en overlay code) — visuelles, et incompatibles avec le slot tuile.
  }
  return g.map((r) => r.join('').replace(/\s+$/u, '')).join('\n'); // trim trailing spaces par ligne (lisibilité)
}

import { writeFileSync } from 'node:fs';
const header = `/**
 * SOURCE ASCII de la carte de l'opéra (généré une fois depuis l'ancienne géométrie, puis ÉDITABLE ici).
 * 1 char = 1 case ; format box-drawing de \`parseWalledAscii\` (lignes/colonnes paires = ARÊTES).
 * Légende cases : ' '=vide (hors bâtiment) · ','=salle (dalle) · 'P'=parterre (parquet) · 'M'=foyer (marbre) ·
 *   'S'=scène (planches, +0.4) · 's'=fosse (planches, −0.4). Arêtes : '-'=mur (N) · '|'=mur (E) · ':'=PORTE.
 * L'élévation (S/s), les diagonales visuelles et les 2 escaliers sont rajoutés EN CODE par floorplan.ts.
 * Largeur de grille = ${2 * W + 1} (= 2·${W}+1) ; les espaces de fin sont retirés → floorplan.ts re-complète.
 * Régénérable : \`npx tsx scripts/qc/gen-opera-ascii.mts\`.
 */
export const REZ_ASCII = String.raw\``;
const out = header + '\n' + gridFor(0) + '\n`;\n\nexport const ETAGE_ASCII = String.raw`\n' + gridFor(1) + '\n`;\n';
writeFileSync('src/scenes/opera/floorplan.ascii.ts', out);
console.log('OK: src/scenes/opera/floorplan.ascii.ts');
console.log('rez lines:', gridFor(0).split('\n').length, '| etage lines:', gridFor(1).split('\n').length, '| width target:', 2 * W + 1);

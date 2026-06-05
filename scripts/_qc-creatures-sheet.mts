/** Planche QC créatures : front / profil / dos / MORT (bascule), pour audit 8-dir + position mort.
 *  → public/qc/sheets/F-creatures.png. Lancer : npx tsx scripts/_qc-creatures-sheet.mts */
import { mkdirSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { creatureView, DEFS } from '../src/gameIso/sprites';
import creatureViews from '../src/gameIso/creatureViews.json';
import { hashSeed } from '../src/gameIso/appearance';

const allNames = Object.keys(creatureViews as Record<string, unknown>).sort();
const SC = 1.0;
const CW = 132, CH = 150, FEET = 132;
const COLS = [
  { l: 'face', v: 'front' as const, dead: false },
  { l: 'profil', v: 'profile' as const, dead: false },
  { l: 'dos', v: 'back' as const, dead: false },
  { l: 'MORT', v: 'front' as const, dead: true },
];
// Découpe en lots lisibles pour l'audit (1 image par lot).
const BATCH = 16;
const batches: string[][] = [];
for (let i = 0; i < allNames.length; i += BATCH) batches.push(allNames.slice(i, i + BATCH));
batches.forEach((names, bi) => renderSheet(names, bi + 1));

function renderSheet(names: string[], bi: number): void {
const cells: string[] = [];
names.forEach((name, r) => {
  cells.push(`<text x="4" y="${28 + r * CH + CH / 2}" font-size="8" fill="#9fb0c8" font-family="sans-serif">${name.slice(0, 16)}</text>`);
  COLS.forEach((col, ci) => {
    const inner = creatureView(name, col.v, hashSeed(name));
    // boîte créature ~120×150, pieds ~y150 ; MORT = bascule 78° autour des pieds (60,150).
    const body = `<g transform="translate(6,${FEET - 150 * SC}) scale(${SC})">${col.dead ? `<g transform="rotate(78 60 150)">${inner}</g>` : inner}</g>`;
    const x = 92 + ci * CW, y = 28 + r * CH;
    cells.push(`<g transform="translate(${x},${y})"><rect width="${CW - 4}" height="${CH - 12}" fill="#262d3b"/><line x1="0" y1="${FEET}" x2="${CW - 4}" y2="${FEET}" stroke="#e06a4a" stroke-width="0.5"/>${body}<text x="${(CW - 4) / 2}" y="${CH - 2}" text-anchor="middle" font-size="8" fill="#cdd" font-family="sans-serif">${col.l}</text></g>`);
  });
});
mkdirSync('public/qc/sheets', { recursive: true });
const W = 92 + COLS.length * CW, H = 28 + names.length * CH;
const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><defs>${DEFS}</defs><rect width="${W}" height="${H}" fill="#11141c"/><text x="12" y="18" font-size="14" fill="#d8a93b" font-family="sans-serif">F${bi} — Créatures : 8-dir + position mort (${names.length})</text>${cells.join('')}</svg>`;
writeFileSync(`public/qc/sheets/F-creatures-${bi}.png`, new Resvg(full, { background: '#11141c', fitTo: { mode: 'width', value: W * 2 } }).render().asPng());
console.log(`OK → public/qc/sheets/F-creatures-${bi}.png (${names.length} créatures)`);
}

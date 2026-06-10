/** QC des coiffures (TÊTE seule, agrandie) : chaque coiffure en face/profil/dos. */
import { writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { cosmeticPart } from '../src/gameIso/rig/parts/cosmetic';
import { pickView } from '../src/gameIso/rig/parts/types';
import { buildTokenMap } from '../src/gameIso/rig/palette';
import { racePalette } from '../src/gameIso/rig/races';
import { HAIRSTYLES } from '../src/gameIso/rig/parts/generated/hairstyles';
import type { View } from '../src/gameIso/rig/facing';

type Row = { sex: 'M' | 'F'; idx: number; label: string };
const rows: Row[] = [];
(['M', 'F'] as const).forEach((sex) => {
  const n = 1 + HAIRSTYLES[sex].length;
  for (let i = 0; i < n; i++) rows.push({ sex, idx: i, label: i === 0 ? `${sex} défaut` : `${sex}: ${HAIRSTYLES[sex][i - 1].name.slice(0, 34)}` });
});

const applyTokens = (svg: string, tmap: Record<string, string>) =>
  svg.replace(/@([a-zA-Z]+[12]?[OH]?)/g, (m, t) => tmap[t] ?? m);

const stored = racePalette('Humain', 'M');
const tmap = buildTokenMap(stored, {});

const CW = 130, CH = 130, SC = 4.2, LBLW = 280, CX0 = CW / 2, CY0 = 64;
const views: View[] = ['front', 'profile', 'back'];
const cells: string[] = [];
rows.forEach((row, r) => {
  const visage = cosmeticPart('visage', 'Humain', row.sex, 0);
  const cheveux = cosmeticPart('cheveux', 'Humain', row.sex, row.idx);
  cells.push(`<text x="6" y="${24 + r * CH + CH / 2}" font-size="12" fill="#d8a93b" font-family="sans-serif">${row.label}</text>`);
  views.forEach((v, i) => {
    const vis = applyTokens(pickView(visage, v), tmap);
    const che = applyTokens(pickView(cheveux, v), tmap);
    const x = LBLW + i * CW, y = 24 + r * CH;
    cells.push(
      `<g transform="translate(${x},${y})"><rect width="${CW - 6}" height="${CH - 8}" fill="#2b3142"/>` +
      `<g transform="translate(${CX0},${CY0}) scale(${SC})">${vis}${che}</g></g>`,
    );
  });
});
const W = LBLW + views.length * CW, H = 24 + rows.length * CH;
const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#11141c"/><text x="6" y="16" font-size="13" fill="#d8a93b" font-family="sans-serif">Coiffures (tête) — face / profil / dos</text>${cells.join('')}</svg>`;
writeFileSync('public/qc/hair.png', new Resvg(full, { background: '#11141c', fitTo: { mode: 'width', value: W * 2 } }).render().asPng());
console.log('OK hair.png');

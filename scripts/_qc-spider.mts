/** QC du gabarit arachnide : vues + poses (repos/idle/ruée/mort) + recolor. */
import { writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { DEFS } from '../src/gameIso/sprites';
import { spiderSvg, SPIDER_DEFAULT, resolveSpiderFromProps, spiderRush } from '../src/gameIso/rig/arachnid/composeSpider';
import { bonesToSvg } from '../src/gameIso/rig/renderBones';

const cells: { label: string; svg: string }[] = [
  { label: 'Araignée face', svg: spiderSvg(SPIDER_DEFAULT, 'front') },
  { label: 'Araignée dos', svg: spiderSvg(SPIDER_DEFAULT, 'back') },
  { label: 'ruée (attaque)', svg: bonesToSvg(resolveSpiderFromProps(SPIDER_DEFAULT, 'front', spiderRush(0.5))) },
  { label: 'mort (sur le dos)', svg: spiderSvg(SPIDER_DEFAULT, 'front', { dead: true }) },
  { label: 'recolor (veuve rouge)', svg: spiderSvg(SPIDER_DEFAULT, 'front', { colors: { corps: '#1a1010', cuir: '#c01818' } }) },
  { label: 'recolor vert', svg: spiderSvg(SPIDER_DEFAULT, 'front', { colors: { corps: '#3a5a2a' } }) },
];
const CW = 300, CH = 320, FEET = 250, COLS = 3;
const out = cells.map((c, i) => {
  const SC = 1.7, col = i % COLS, row = Math.floor(i / COLS);
  const ox = 10 + col * CW, oy = 10 + row * CH, cx = (CW - 8) / 2;
  return `<g transform="translate(${ox},${oy})"><rect width="${CW - 8}" height="${CH - 10}" fill="#2b3142"/><g transform="translate(${cx - 60 * SC},${FEET - 96 * SC}) scale(${SC})">${c.svg}</g><text x="${cx}" y="${CH - 16}" text-anchor="middle" font-size="14" fill="#cdd" font-family="sans-serif">${c.label}</text></g>`;
});
const W = 10 + COLS * CW, H = 10 + Math.ceil(cells.length / COLS) * CH;
const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><defs>${DEFS}</defs><rect width="${W}" height="${H}" fill="#11141c"/>${out.join('')}</svg>`;
writeFileSync('public/qc/_qc-spider.png', new Resvg(full, { background: '#11141c', fitTo: { mode: 'width', value: W } }).render().asPng());
console.log('OK public/qc/_qc-spider.png');

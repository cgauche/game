/**
 * QC — montage PNG des objets d'opéra (props décor) pour jugement visuel « se lit-il sans le nom ? ».
 *   npx tsx scripts/qc/render-opera-props.mts
 * Sortie : public/qc/opera/props-montage.png
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { PROPS, propSvg } from '../../src/gameIso/catalog/decor';
import { DEFS } from '../../src/gameIso/sprites';

const ids = ['rangee-sieges', 'rideau-scene', 'balustrade-loge', 'lustre-opera', 'applique-murale', 'pupitre-chef', 'fauteuil-loge', 'plante-pot'];
const COLS = 4, CW = 130, CH = 178;
const cells = ids
  .map((id, i) => {
    const x = (i % COLS) * CW, y = Math.floor(i / COLS) * CH;
    return `<g transform="translate(${x},${y})"><rect width="${CW}" height="${CH}" fill="#262b38" stroke="#3a4255"/><g transform="translate(5,3)">${propSvg(id)}</g><text x="${CW / 2}" y="${CH - 6}" fill="#cbd3e1" font-size="11" text-anchor="middle">${PROPS[id]?.label ?? id}</text></g>`;
  })
  .join('');
const W = COLS * CW, H = Math.ceil(ids.length / COLS) * CH;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><defs>${DEFS}</defs><rect width="${W}" height="${H}" fill="#1d2230"/>${cells}</svg>`;
const png = new Resvg(svg, { fitTo: { mode: 'width', value: W * 2 }, font: { loadSystemFonts: true } }).render().asPng();
mkdirSync('public/qc/opera', { recursive: true });
writeFileSync('public/qc/opera/props-montage.png', png);
console.log('OK: public/qc/opera/props-montage.png');

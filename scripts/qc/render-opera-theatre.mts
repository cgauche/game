/**
 * QC — rend le THÉÂTRE de l'Opéra (scénario 21) en réutilisant le tri de profondeur de IsoStage :
 * planchers par étage (floorDepth) + props (propSvg, positionnés comme BodyToken) + PNJ (jetons).
 * Preuve visuelle de la salle multi-niveaux. npx tsx scripts/qc/render-opera-theatre.mts
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { groundTile } from '../../src/gameIso/ground';
import { propSvg } from '../../src/gameIso/catalog/decor';
import { DEFS } from '../../src/gameIso/sprites';
import { stageSize, tileCenter, depth, floorDepth, type Dims } from '../../src/gameIso/iso';
import { scenario } from '../../src/scenes/test-scenarios/21-opera-theatre';

const scene = scenario.scene;
const d: Dims = { w: scene.dimensions.w, h: scene.dimensions.h };
const objs: { d: number; svg: string }[] = [];

// Planchers : une bande de profondeur par étage (cf. IsoStage.floorObjs).
for (const lvl of [...scene.levels].sort((a, b) => a.z - b.z)) {
  const fd = floorDepth(d, lvl.z);
  for (let y = 0; y < d.h; y++) for (let x = 0; x < d.w; x++) { const h = groundTile(scene, x, y, d, lvl.z); if (h) objs.push({ d: fd, svg: h }); }
}

// Props + PNJ positionnés comme BodyToken (translate(cx,cy) ; corps ancré aux pieds).
const S = 0.55;
const body = (cx: number, cy: number, inner: string) => `<g transform="translate(${cx},${cy})"><g transform="translate(${-60 * S},${-150 * S}) scale(${S})">${inner}</g></g>`;
const pawn = (cx: number, cy: number, fill: string, label: string) =>
  `<g transform="translate(${cx},${cy})"><ellipse cx="0" cy="0" rx="9" ry="4.5" fill="#000" opacity="0.33"/><rect x="-7" y="-46" width="14" height="46" rx="6" fill="${fill}" stroke="#101015"/><circle cx="0" cy="-52" r="7" fill="${fill}" stroke="#101015"/><text x="0" y="14" font-size="8" fill="#e7ecf5" text-anchor="middle">${label}</text></g>`;

for (const e of scene.entities) {
  if (e.kind === 'heroStart') continue;
  const z = e.z ?? 0;
  const { cx, cy } = tileCenter(e.pos.x, e.pos.y, d, z);
  if (e.kind === 'prop' && e.ref) objs.push({ d: depth(e.pos.x, e.pos.y, d, z), svg: body(cx, cy, propSvg(e.ref)) });
  else if (e.kind === 'personnage') objs.push({ d: depth(e.pos.x, e.pos.y, d, z) + 0.5, svg: pawn(cx, cy, e.id === 'comtesse' ? '#c4496b' : '#4f7bd0', e.label ?? '') });
}

objs.sort((a, b) => a.d - b.d);
const stage = stageSize(d);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${stage.w} ${stage.h}" width="${stage.w}" height="${stage.h}"><defs>${DEFS}</defs><rect width="${stage.w}" height="${stage.h}" fill="#14161f"/>${objs.map((o) => o.svg).join('')}</svg>`;
const png = new Resvg(svg, { fitTo: { mode: 'width', value: stage.w * 2 }, font: { loadSystemFonts: true } }).render().asPng();
mkdirSync('public/qc/opera', { recursive: true });
writeFileSync('public/qc/opera/theatre.png', png);
console.log('OK: public/qc/opera/theatre.png');

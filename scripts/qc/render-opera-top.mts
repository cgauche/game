/**
 * QC — Opéra en VUE DU DESSUS (z=0) : vérifie que les murs sont des TRAITS sur les arêtes (pas des
 * panneaux extrudés flottants) et les escaliers des symboles de plan. npx tsx scripts/qc/render-opera-top.mts
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { groundTile } from '../../src/gameIso/ground';
import { wallSegs } from '../../src/gameIso/walls';
import { stairSegs } from '../../src/gameIso/stairs';
import { buildOperaFloorplan } from '../../src/scenes/opera/floorplan';
import { DEFS } from '../../src/gameIso/sprites';
import { stageSize, floorDepth, type Dims } from '../../src/gameIso/iso';

const scene = buildOperaFloorplan();
const d: Dims = { w: scene.dimensions.w, h: scene.dimensions.h, view: 'top' };
const z = 0;
const objs: { d: number; svg: string }[] = [];
for (let y = 0; y < d.h; y++) for (let x = 0; x < d.w; x++) { const h = groundTile(scene, x, y, d, z); if (h) objs.push({ d: floorDepth(d, z), svg: h }); }
for (const w of scene.walls ?? []) if ((w.z ?? 0) === z) { const seg = wallSegs({ ...scene, walls: [w] } as typeof scene, d)[0]; if (seg) objs.push(seg); }
for (const s of scene.stairs ?? []) if (s.from.z === z) objs.push(stairSegs({ ...scene, stairs: [s] } as typeof scene, d)[0]);
objs.sort((a, b) => a.d - b.d);

const stage = stageSize(d);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${stage.w} ${stage.h}" width="${stage.w}" height="${stage.h}"><defs>${DEFS}</defs><rect width="${stage.w}" height="${stage.h}" fill="#14161f"/>${objs.map((o) => o.svg).join('')}</svg>`;
const png = new Resvg(svg, { fitTo: { mode: 'width', value: stage.w * 1.4 }, font: { loadSystemFonts: true } }).render().asPng();
mkdirSync('public/qc', { recursive: true });
writeFileSync('public/qc/opera-top.png', png);
console.log('OK: public/qc/opera-top.png — Opéra rez vue du dessus (murs = traits sur arêtes)');

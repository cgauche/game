/**
 * QC — Théâtre Staatsoper : rend le rez-de-chaussée (z=0) et le premier étage (z=1) séparément pour
 * vérifier la fidélité au plan. npx tsx scripts/qc/render-opera.mts → public/qc/opera-rez.png + opera-etage.png
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { buildFloors } from '../../src/gameIso/builders/floors';
import { floorSvg, floorDepth } from '../../src/gameIso/backends/affineFloors';
import { buildWalls } from '../../src/gameIso/builders/walls';
import { wallDepth, wallSvg } from '../../src/gameIso/backends/affineWalls';
import { buildOperaFloorplan } from '../../src/scenes/opera/floorplan';
import { DEFS } from '../../src/gameIso/sprites';
import { stageSize, type Dims } from '../../src/gameIso/iso';

const scene = buildOperaFloorplan();

function renderLevel(z: number, file: string, rot: 0 | 2 = 0) {
  const d: Dims = { w: scene.dimensions.w, h: scene.dimensions.h, rot };
  const objs: { d: number; svg: string }[] = [];
  for (const el of buildFloors(scene, undefined, { viewZ: z })) objs.push({ d: floorDepth(el, d), svg: floorSvg(el, d) });
  // murs de CE niveau seulement
  for (const el of buildWalls(scene, undefined, { viewZ: z })) objs.push({ d: wallDepth(el, d), svg: wallSvg(el, d) });
  objs.sort((a, b) => a.d - b.d);
  const stage = stageSize(d);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${stage.w} ${stage.h}" width="${stage.w}" height="${stage.h}"><defs>${DEFS}</defs><rect width="${stage.w}" height="${stage.h}" fill="#14161f"/>${objs.map((o) => o.svg).join('')}</svg>`;
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: stage.w * 1.6 }, font: { loadSystemFonts: true } }).render().asPng();
  mkdirSync('public/qc', { recursive: true });
  writeFileSync(`public/qc/${file}`, png);
  console.log(`OK: public/qc/${file}`);
}

renderLevel(0, 'opera-rez.png');
renderLevel(1, 'opera-etage.png');
renderLevel(0, 'opera-rez-scene.png', 2); // rez vu côté SCÈNE (180°) → relief scène/fosse

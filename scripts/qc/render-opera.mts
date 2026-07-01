/**
 * QC — Théâtre Staatsoper : rend le rez-de-chaussée (z=0) et le premier étage (z=1) séparément pour
 * vérifier la fidélité au plan. npx tsx scripts/qc/render-opera.mts → public/qc/opera-rez.png + opera-etage.png
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { groundTile } from '../../src/gameIso/ground';
import { wallSegs } from '../../src/gameIso/walls';
import { buildOperaFloorplan } from '../../src/scenes/opera/floorplan';
import { DEFS } from '../../src/gameIso/sprites';
import { stageSize, depth, type Dims } from '../../src/gameIso/iso';

const scene = buildOperaFloorplan();

function renderLevel(z: number, file: string, rot: 0 | 2 = 0) {
  const d: Dims = { w: scene.dimensions.w, h: scene.dimensions.h, rot };
  const objs: { d: number; svg: string }[] = [];
  for (let y = 0; y < d.h; y++) for (let x = 0; x < d.w; x++) { const h = groundTile(scene, x, y, d, z); if (h) objs.push({ d: depth(x, y, d, z) - 0.5, svg: h }); }
  // murs de CE niveau seulement
  for (const w of scene.walls ?? []) if ((w.z ?? 0) === z) { const seg = wallSegs({ ...scene, walls: [w] } as typeof scene, d)[0]; if (seg) objs.push(seg); }
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

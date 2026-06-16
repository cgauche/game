/**
 * QC — Théâtre Staatsoper en VUE DU DESSUS (la plus proche du plan officiel p.40/p.41), MEUBLÉ : rend le
 * rez (z=0) et l'étage (z=1) avec sol + élévation + murs/portes + escaliers + les props posés dans
 * `22-opera-plan.ts`. Sert à comparer DIRECTEMENT au plan (pièces, murs, mobilier) et à itérer.
 *   npx tsx scripts/qc/opera-plan-qc.mts
 * Sortie : public/qc/opera-plan-rez.png + opera-plan-etage.png (vue du dessus).
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { groundTile } from '../../src/gameIso/ground';
import { wallSegs } from '../../src/gameIso/walls';
import { stairSeg } from '../../src/gameIso/stairs';
import { buildOperaFloorplan } from '../../src/scenes/opera/floorplan';
import { propSvg } from '../../src/gameIso/catalog/decor';
import { DEFS } from '../../src/gameIso/sprites';
import { stageSize, floorDepth, tileCenter, depth, type Dims } from '../../src/gameIso/iso';
import { decorFootGeometry } from '../../src/state/footprint';
import { scenarioEntities } from '../../src/scenes/test-scenarios/22-opera-plan';
import type { SceneEntity } from '../../src/state/scene';

const scene = buildOperaFloorplan();
const ents = scenarioEntities;

function placeProp(e: SceneEntity, d: Dims, z: number): { d: number; svg: string } {
  const fg = decorFootGeometry(e.foot);
  const px = e.pos.x + fg.offX, py = e.pos.y + fg.offY;
  const s = 0.5 * fg.scale;
  const { cx, cy } = tileCenter(px, py, d, z);
  const inner = propSvg(e.ref ?? 'tonneau', e.facing, d.rot);
  const svg = `<g transform="translate(${cx},${cy})"><g transform="translate(${-60 * s},${-150 * s}) scale(${s})">${inner}</g></g>`;
  const pd = depth(e.pos.x + (e.foot ? e.foot.w - 1 : 0), e.pos.y + (e.foot ? e.foot.h - 1 : 0), d, z);
  return { d: pd + 0.5, svg };
}

function renderLevel(z: number, file: string, zoom = 1.6) {
  const d: Dims = { w: scene.dimensions.w, h: scene.dimensions.h, view: 'top' };
  const objs: { d: number; svg: string }[] = [];
  for (let y = 0; y < d.h; y++) for (let x = 0; x < d.w; x++) { const h = groundTile(scene, x, y, d, z); if (h) objs.push({ d: floorDepth(d, z), svg: h }); }
  for (const w of scene.walls ?? []) if ((w.z ?? 0) === z) { const seg = wallSegs({ ...scene, walls: [w] } as typeof scene, d)[0]; if (seg) objs.push(seg); }
  for (const s of scene.stairs ?? []) if (s.from.z === z) objs.push(stairSeg(s, d));
  for (const e of ents) if (e.kind === 'prop' && e.ref && (e.z ?? 0) === z) objs.push(placeProp(e, d, z));
  objs.sort((a, b) => a.d - b.d);
  const stage = stageSize(d);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${stage.w} ${stage.h}" width="${stage.w}" height="${stage.h}"><defs>${DEFS}</defs><rect width="${stage.w}" height="${stage.h}" fill="#1a1d27"/>${objs.map((o) => o.svg).join('')}</svg>`;
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: Math.round(stage.w * zoom) }, font: { loadSystemFonts: true } }).render().asPng();
  mkdirSync('public/qc', { recursive: true });
  writeFileSync(`public/qc/${file}`, png);
  console.log(`OK: public/qc/${file}`);
}

renderLevel(0, 'opera-plan-rez.png');
renderLevel(1, 'opera-plan-etage.png');

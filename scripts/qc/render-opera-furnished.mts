/**
 * QC — Théâtre Staatsoper MEUBLÉ : rend le rez (z=0) et l'étage (z=1) avec les props posés dans
 * `22-opera-plan.ts`, pour vérifier que les sièges FONT FACE À LA SCÈNE et que le décor tombe dans
 * les bonnes pièces. Réplique le placement de IsoStage (BodyToken + decorFootGeometry) pour les props.
 *   npx tsx scripts/qc/render-opera-furnished.mts
 * Sortie : public/qc/opera-furnished-{rez,etage,rez-scene}.png + crops de lecture d'orientation.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { groundTile } from '../../src/gameIso/ground';
import { wallSegs } from '../../src/gameIso/walls';
import { buildOperaFloorplan } from '../../src/scenes/opera/floorplan';
import { propSvg } from '../../src/gameIso/catalog/decor';
import { DEFS } from '../../src/gameIso/sprites';
import { stageSize, tileCenter, depth, type Dims } from '../../src/gameIso/iso';
import { decorFootGeometry } from '../../src/state/footprint';
import { scenarioEntities } from '../../src/scenes/opera/furnished';
import type { SceneEntity } from '../../src/state/scene';

const scene = buildOperaFloorplan();
const ents = scenarioEntities;

// Réplique EXACTE du placement de IsoStage (cf. IsoStage.tsx l.699-730) : empreinte → centre + échelle.
function placeProp(e: SceneEntity, d: Dims): { d: number; svg: string } {
  const z = e.z ?? 0;
  const fg = decorFootGeometry(e.foot);
  const px = e.pos.x + fg.offX, py = e.pos.y + fg.offY;
  const s = 0.55 * fg.scale;
  const { cx, cy } = tileCenter(px, py, d, z);
  const inner = propSvg(e.ref ?? 'tonneau', e.facing, d.rot); // honore l'orientation + le cran caméra (les sièges PIVOTENT)
  const svg = `<g transform="translate(${cx},${cy})"><g transform="translate(${-60 * s},${-150 * s}) scale(${s})">${inner}</g></g>`;
  const pd = depth(e.pos.x + (e.foot ? e.foot.w - 1 : 0), e.pos.y + (e.foot ? e.foot.h - 1 : 0), d, z);
  return { d: pd + 0.5, svg };
}

function renderLevel(z: number, file: string, rot: 0 | 2 = 0, zoom = 1.6) {
  const d: Dims = { w: scene.dimensions.w, h: scene.dimensions.h, rot };
  const objs: { d: number; svg: string }[] = [];
  for (let y = 0; y < d.h; y++) for (let x = 0; x < d.w; x++) { const h = groundTile(scene, x, y, d, z); if (h) objs.push({ d: depth(x, y, d, z) - 0.5, svg: h }); }
  for (const w of scene.walls ?? []) if ((w.z ?? 0) === z) { const seg = wallSegs({ ...scene, walls: [w] } as typeof scene, d)[0]; if (seg) objs.push(seg); }
  for (const e of ents) if (e.kind === 'prop' && e.ref && (e.z ?? 0) === z) objs.push(placeProp(e, d));
  objs.sort((a, b) => a.d - b.d);
  const stage = stageSize(d);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${stage.w} ${stage.h}" width="${stage.w}" height="${stage.h}"><defs>${DEFS}</defs><rect width="${stage.w}" height="${stage.h}" fill="#14161f"/>${objs.map((o) => o.svg).join('')}</svg>`;
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: Math.round(stage.w * zoom) }, font: { loadSystemFonts: true } }).render().asPng();
  mkdirSync('public/qc', { recursive: true });
  writeFileSync(`public/qc/${file}`, png);
  console.log(`OK: public/qc/${file}`);
}

// Crop autour d'une tuile : ne garde que le sol/props proches (évite la géométrie globale qui fait
// paniquer resvg sur un viewBox décalé), puis translate dans une petite boîte positive.
function renderCrop(z: number, tx: number, ty: number, file: string, half = 170, span = 7, rot: 0 | 2 = 0) {
  const d: Dims = { w: scene.dimensions.w, h: scene.dimensions.h, rot };
  const objs: { d: number; svg: string }[] = [];
  for (let y = Math.max(0, ty - span); y <= Math.min(d.h - 1, ty + span); y++)
    for (let x = Math.max(0, tx - span); x <= Math.min(d.w - 1, tx + span); x++) {
      const h = groundTile(scene, x, y, d, z); if (h) objs.push({ d: depth(x, y, d, z) - 0.5, svg: h });
    }
  for (const e of ents) {
    if (e.kind !== 'prop' || !e.ref || (e.z ?? 0) !== z) continue;
    if (Math.abs(e.pos.x - tx) > span || Math.abs(e.pos.y - ty) > span) continue;
    objs.push(placeProp(e, d));
  }
  objs.sort((a, b) => a.d - b.d);
  const { cx, cy } = tileCenter(tx, ty, d, z);
  const vw = half * 2, vh = half * 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vw} ${vh}" width="${vw}" height="${vh}"><defs>${DEFS}</defs><rect width="${vw}" height="${vh}" fill="#14161f"/><g transform="translate(${half - cx},${half - cy})">${objs.map((o) => o.svg).join('')}</g></svg>`;
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: vw * 2.4 }, font: { loadSystemFonts: true } }).render().asPng();
  mkdirSync('public/qc', { recursive: true });
  writeFileSync(`public/qc/${file}`, png);
  console.log(`OK: public/qc/${file}`);
}

renderLevel(0, 'opera-furnished-rez.png');
renderLevel(1, 'opera-furnished-etage.png');
renderLevel(0, 'opera-furnished-rez-scene.png', 2);
// Crops de lecture d'orientation (sièges du parterre ; scène/rideau ; loges ; loge royale).
renderCrop(0, 21, 30, 'opera-furnished-crop-sieges.png', 230, 9);
// MÊME bloc de sièges, caméra tournée d'un demi-tour (rot 2) : ils doivent PIVOTER (dos→face) et
// continuer de regarder la scène (désormais en bas de l'écran). Preuve visuelle du helper project().
renderCrop(0, 21, 30, 'opera-furnished-crop-sieges-rot2.png', 230, 9, 2);
renderCrop(0, 21, 8, 'opera-furnished-crop-scene.png', 220, 9);
renderCrop(1, 6, 24, 'opera-furnished-crop-loge.png', 230, 9);
renderCrop(1, 21, 3, 'opera-furnished-crop-royale.png', 240, 10);

/**
 * QC — LA DILIGENCE : planche de GOÛT de l'auberge (2 étages × 4 rotations + plan source) et planche
 * de DÉGAGEMENT de toiture, assemblées hors app par le backend AFFINE.
 *   npx tsx scripts/qc/render-diligence.mts
 * Sortie : public/qc/diligence.png + public/qc/diligence-degagement.png
 *
 * CLASSEMENT #1176 C3 — planche de GOÛT. Successeur sur l'écran de jeu réel (voie volumique) :
 * `scripts/qc/capture-jeu.mjs --scenes diligence`. Ce script s'appuie sur les backends affine
 * (`affineFloors`/`affineWalls`/`affineRoofs`) et disparaît AVEC eux à C5a ; sa dernière sortie est
 * figée dans `public/qc/baseline-affine/` (référence de comparaison du juge vision de C4).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { floorDepth, floorSvg } from '../../src/gameIso/backends/affineFloors';
import { roofDepth, roofSvg } from '../../src/gameIso/backends/affineRoofs';
import { wallDepth, wallSvg } from '../../src/gameIso/backends/affineWalls';
import { buildFloors } from '../../src/gameIso/builders/floors';
import { buildRoofs } from '../../src/gameIso/builders/roofs';
import { buildWalls } from '../../src/gameIso/builders/walls';
import { propSvg } from '../../src/gameIso/catalog/decor';
import { DEFS } from '../../src/gameIso/sprites';
import { depth, stageSize, tileCenter, type Dims, type Rot } from '../../src/geometry/iso';
import { diligenceCampaign } from '../../src/scenes/campaign';
import { decorFootGeometry } from '../../src/state/footprint';
import type { SceneEntity } from '../../src/state/scene';

const scene = diligenceCampaign.scenes[0];
const rotations: Rot[] = [0, 1, 2, 3];
const zoneLabels: readonly string[] = [...new Set((scene.effectZones ?? []).map((z) => z.label).filter((l): l is string => !!l))];
const zoneColors = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e',
  '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
  '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#fb7185',
  '#a3e635', '#2dd4bf', '#38bdf8', '#818cf8', '#c084fc',
] as const;
const escapeXml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function placeProp(entity: SceneEntity, dims: Dims): { d: number; svg: string } {
  const z = entity.z ?? 0;
  const foot = decorFootGeometry(entity.foot);
  const { cx, cy } = tileCenter(entity.pos.x + foot.offX, entity.pos.y + foot.offY, dims, z);
  const scale = 0.55 * foot.scale;
  const svg =
    `<g transform="translate(${cx},${cy})">` +
    `<g transform="translate(${-60 * scale},${-150 * scale}) scale(${scale})">` +
    `${propSvg(entity.ref ?? 'tonneau', entity.facing, dims.rot)}</g></g>`;
  return {
    d: depth(
      entity.pos.x + (entity.foot ? entity.foot.w - 1 : 0),
      entity.pos.y + (entity.foot ? entity.foot.h - 1 : 0),
      dims,
      z,
    ) + 0.5,
    svg,
  };
}

function levelPanel(z: number, rot: Rot): { w: number; h: number; svg: string } {
  const dims: Dims = { ...scene.dimensions, rot };
  const objects: { d: number; svg: string }[] = [];
  for (const floor of buildFloors(scene, undefined, { viewZ: z }))
    objects.push({ d: floorDepth(floor, dims), svg: floorSvg(floor, dims) });
  for (const wall of buildWalls(scene, undefined, { viewZ: z }))
    objects.push({ d: wallDepth(wall, dims), svg: wallSvg(wall, dims) });
  for (const roof of buildRoofs(scene))
    if (roof.cell.z === z) objects.push({ d: roofDepth(roof, dims), svg: roofSvg(roof, dims, { zoom: 1 }) });
  for (const entity of scene.entities)
    if (entity.kind === 'prop' && entity.ref && (entity.z ?? 0) === z) objects.push(placeProp(entity, dims));
  objects.sort((a, b) => a.d - b.d);
  const stage = stageSize(dims);
  return { ...stage, svg: objects.map((object) => object.svg).join('') };
}

function zonePlanPanel(z: number): { w: number; h: number; svg: string } {
  const w = 760;
  const h = 680;
  const scale = 13.5;
  const ox = 18;
  const oy = 104;
  const legendX = 470;
  let svg =
    `<rect width="${w}" height="${h}" fill="#090b11"/>` +
    `<text x="${ox}" y="34" fill="#fff" font-family="sans-serif" font-size="25" font-weight="bold">Zones — ${z === 0 ? 'rez-de-chaussée' : 'étage'}</text>` +
    `<rect x="${ox}" y="${oy}" width="${scene.dimensions.w * scale}" height="${scene.dimensions.h * scale}" fill="#151923" stroke="#f8fafc" stroke-width="2"/>`;
  for (let x = 0; x <= scene.dimensions.w; x++)
    svg += `<path d="M${ox + x * scale} ${oy}V${oy + scene.dimensions.h * scale}" stroke="#475569" stroke-width="0.35"/>`;
  for (let y = 0; y <= scene.dimensions.h; y++)
    svg += `<path d="M${ox} ${oy + y * scale}H${ox + scene.dimensions.w * scale}" stroke="#475569" stroke-width="0.35"/>`;
  for (const zone of scene.effectZones ?? []) {
    if ((zone.z ?? 0) !== z || zone.area.kind !== 'rect') continue;
    const index = zoneLabels.indexOf(zone.label);
    if (index < 0) continue;
    const color = zoneColors[index];
    const x = ox + zone.area.x * scale;
    const y = oy + zone.area.y * scale;
    const rw = zone.area.w * scale;
    const rh = zone.area.h * scale;
    svg +=
      `<rect x="${x}" y="${y}" width="${rw}" height="${rh}" fill="${color}" fill-opacity="0.68" stroke="#fff" stroke-width="1.2"/>` +
      `<text x="${x + rw / 2}" y="${y + rh / 2}" fill="#05070b" stroke="#fff" stroke-width="2.4" paint-order="stroke" font-family="sans-serif" font-size="12" font-weight="900" text-anchor="middle" dominant-baseline="central">${index + 1}</text>`;
  }
  zoneLabels.forEach((label, index) => {
    const y = 31 + index * 27;
    svg +=
      `<rect x="${legendX}" y="${y - 15}" width="18" height="18" rx="3" fill="${zoneColors[index]}" stroke="#fff"/>` +
      `<text x="${legendX + 9}" y="${y - 5}" fill="#05070b" font-family="sans-serif" font-size="11" font-weight="900" text-anchor="middle">${index + 1}</text>` +
      `<text x="${legendX + 27}" y="${y}" fill="#fff" font-family="sans-serif" font-size="14" font-weight="700">${escapeXml(label)}</text>`;
  });
  return { w, h, svg };
}

const CELL_W = 900;
const CELL_H = 640;
const PAD = 18;
const LABEL_H = 38;
const COLS = 3;
const HEADER_H = 62;
const panels = [0, 1].flatMap((z) =>
  rotations.map((rot) => ({ label: `${z === 0 ? 'Rez-de-chaussée' : 'Étage'} — rotation ${rot}`, panel: levelPanel(z, rot) })),
).concat([
  { label: 'Zones top-down — rez-de-chaussée', panel: zonePlanPanel(0) },
  { label: 'Zones top-down — étage', panel: zonePlanPanel(1) },
]);
const sourcePath = 'art-ref/page012_img3.png';
if (!existsSync(sourcePath)) throw new Error(`Source QC absente : ${sourcePath}`);
const source = `data:image/png;base64,${readFileSync(sourcePath).toString('base64')}`;
const rows = Math.ceil((panels.length + 1) / COLS);
const width = COLS * CELL_W;
const height = HEADER_H + rows * CELL_H;

const cells = panels.map(({ label, panel }, index) => {
  const x = (index % COLS) * CELL_W;
  const y = HEADER_H + Math.floor(index / COLS) * CELL_H;
  const innerW = CELL_W - PAD * 2;
  const innerH = CELL_H - PAD * 2 - LABEL_H;
  const scale = Math.min(innerW / panel.w, innerH / panel.h);
  const px = x + PAD + (innerW - panel.w * scale) / 2;
  const py = y + PAD + (innerH - panel.h * scale) / 2;
  return (
    `<svg x="${px}" y="${py}" width="${panel.w * scale}" height="${panel.h * scale}" viewBox="0 0 ${panel.w} ${panel.h}">` +
    `<rect width="${panel.w}" height="${panel.h}" fill="#14161f"/><defs>${DEFS}</defs>${panel.svg}</svg>` +
    `<text x="${x + CELL_W / 2}" y="${y + CELL_H - 14}" fill="#eee6d3" font-family="sans-serif" font-size="24" text-anchor="middle">${label}</text>`
  );
});

const sourceIndex = panels.length;
const sourceX = (sourceIndex % COLS) * CELL_W;
const sourceY = HEADER_H + Math.floor(sourceIndex / COLS) * CELL_H;
const sourceCell = `<image href="${source}" x="${sourceX + PAD}" y="${sourceY + PAD}" width="${CELL_W - PAD * 2}" height="${CELL_H - PAD * 2 - LABEL_H}" preserveAspectRatio="xMidYMid meet"/>`;

const svg =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">` +
  `<rect width="${width}" height="${height}" fill="#0f1118"/>` +
  `<text x="${width / 2}" y="40" fill="#eee6d3" font-family="sans-serif" font-size="30" font-weight="bold" text-anchor="middle">La Diligence — deux étages × quatre rotations</text>` +
  cells.join('') +
  sourceCell +
  `<text x="${sourceX + CELL_W / 2}" y="${sourceY + CELL_H - 14}" fill="#eee6d3" font-family="sans-serif" font-size="24" text-anchor="middle">Plan source</text>` +
  `</svg>`;

mkdirSync('public/qc', { recursive: true });
writeFileSync(
  'public/qc/diligence.png',
  new Resvg(svg, { fitTo: { mode: 'width', value: width }, font: { loadSystemFonts: true } }).render().asPng(),
);
console.log('OK: public/qc/diligence.png — 2 étages × 4 rotations + plan source');

// ── PLANCHE DE DÉGAGEMENT (cutaway #818) — la MÊME scène, les MÊMES builders, mais un allié POSÉ À
//    L'INTÉRIEUR : la seule vue qui montre ce que le joueur voit en entrant dans l'auberge. Contrairement
//    à la planche ci-dessus (un étage ISOLÉ par vignette), elle rejoue les vérités de couche du JEU —
//    l'étage du groupe et ceux du dessous — et TOUS les toits, quel que soit l'étage de leur masse : le
//    toit qui coiffe le rez est porté par la masse d'étage, il n'apparaîtrait dans aucune vignette isolée.
/** Case de contrôle : au cœur de la Salle principale du rez (`zone-S-z0`, emprise (10,7)→(14,23)). */
const CUTAWAY_ALLY = { x: 12, y: 12, z: 0 };

function cutawayPanel(rot: Rot, ally: { x: number; y: number; z: number } | null): { w: number; h: number; svg: string } {
  const dims: Dims = { ...scene.dimensions, rot };
  const objects: { d: number; svg: string }[] = [];
  // Les MÊMES vérités de couche qu'en jeu (`IsoStage`) : `activeZ` = l'étage où se tient le groupe. Les
  // couches AU-DESSUS sortent en `ghost` (sol de l'étage vu d'en dessous) et le jeu ne les peint pas
  // par-dessus la pièce occupée — sinon le toit levé ne révélerait que le plancher du dessus.
  const activeZ = ally?.z ?? 0;
  for (const floor of buildFloors(scene, undefined, { activeZ }))
    if (!floor.states.ghost) objects.push({ d: floorDepth(floor, dims), svg: floorSvg(floor, dims) });
  for (const wall of buildWalls(scene, undefined, { activeZ }))
    objects.push({ d: wallDepth(wall, dims), svg: wallSvg(wall, dims) });
  // Un toit dégagé DISPARAÎT en iso (`visibilityOf(cutaway)` = opacity 0, `stage/CulledScene`) — quel
  // que soit l'étage de sa masse : le toit qui coiffe le rez est porté par la masse de l'étage.
  for (const roof of buildRoofs(scene, ally ? { allies: [ally] } : undefined))
    if (!roof.states.roofOccupied) objects.push({ d: roofDepth(roof, dims), svg: roofSvg(roof, dims, { zoom: 1 }) });
  for (const entity of scene.entities)
    if (entity.kind === 'prop' && entity.ref && (entity.z ?? 0) <= activeZ) objects.push(placeProp(entity, dims));
  objects.sort((a, b) => a.d - b.d);
  // Le JETON de contrôle se pose APRÈS le tri : c'est un repère de planche, pas un objet de la scène —
  // il doit rester visible même sous un pan resté posé, sinon la planche ne prouve rien.
  const allyMark = ally
    ? (() => {
        const { cx, cy } = tileCenter(ally.x, ally.y, dims, ally.z);
        return (
          `<g transform="translate(${cx},${cy})">` +
          `<ellipse cx="0" cy="0" rx="19" ry="10" fill="#22d3ee" fill-opacity="0.6" stroke="#ecfeff" stroke-width="2"/>` +
          `<path d="M0 0 V-52" stroke="#22d3ee" stroke-width="6"/>` +
          `<circle cx="0" cy="-64" r="13" fill="#22d3ee" stroke="#04202a" stroke-width="3"/></g>`
        );
      })()
    : '';
  return { ...stageSize(dims), svg: objects.map((object) => object.svg).join('') + allyMark };
}

const cutPanels = ([0, 2] as Rot[]).flatMap((rot) => [
  { label: `Toit ENTIER — rotation ${rot} (aucun allié)`, panel: cutawayPanel(rot, null) },
  { label: `Allié en Salle principale (${CUTAWAY_ALLY.x},${CUTAWAY_ALLY.y},z${CUTAWAY_ALLY.z}) — rotation ${rot}`, panel: cutawayPanel(rot, CUTAWAY_ALLY) },
]);
const CUT_W = 1180;
const CUT_H = 860;
const cutWidth = 2 * CUT_W;
const cutHeight = HEADER_H + 2 * CUT_H;
const cutCells = cutPanels.map(({ label, panel }, index) => {
  const x = (index % 2) * CUT_W;
  const y = HEADER_H + Math.floor(index / 2) * CUT_H;
  const innerW = CUT_W - PAD * 2;
  const innerH = CUT_H - PAD * 2 - LABEL_H;
  const scale = Math.min(innerW / panel.w, innerH / panel.h);
  const px = x + PAD + (innerW - panel.w * scale) / 2;
  const py = y + PAD + (innerH - panel.h * scale) / 2;
  return (
    `<svg x="${px}" y="${py}" width="${panel.w * scale}" height="${panel.h * scale}" viewBox="0 0 ${panel.w} ${panel.h}">` +
    `<rect width="${panel.w}" height="${panel.h}" fill="#14161f"/><defs>${DEFS}</defs>${panel.svg}</svg>` +
    `<text x="${x + CUT_W / 2}" y="${y + CUT_H - 14}" fill="#eee6d3" font-family="sans-serif" font-size="26" text-anchor="middle">${escapeXml(label)}</text>`
  );
});
const cutSvg =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${cutWidth} ${cutHeight}">` +
  `<rect width="${cutWidth}" height="${cutHeight}" fill="#0f1118"/>` +
  `<text x="${cutWidth / 2}" y="40" fill="#eee6d3" font-family="sans-serif" font-size="30" font-weight="bold" text-anchor="middle">La Diligence — dégagement de toiture (niveaux empilés)</text>` +
  cutCells.join('') +
  `</svg>`;
writeFileSync(
  'public/qc/diligence-degagement.png',
  new Resvg(cutSvg, { fitTo: { mode: 'width', value: cutWidth }, font: { loadSystemFonts: true } }).render().asPng(),
);
console.log('OK: public/qc/diligence-degagement.png — toit entier vs allié dans la Salle principale');

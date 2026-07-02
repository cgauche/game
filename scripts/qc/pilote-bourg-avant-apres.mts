/**
 * QC — PLANCHE COMPARATIVE du PILOTE BOURG (généralisation des matériaux v2, Lot 4b) : iso rot2 ·
 * edge rot1 · CROP 1:1 du quartier taverne, en AVANT / APRÈS côte à côte. L'AVANT est RECADRÉ depuis
 * une planche `env-arene-hub.png` de référence (rendue AVANT le lot) ; l'APRÈS est rendu à l'instant
 * via les panneaux partagés (`env-panels.ts`). Les panneaux APRÈS passent par un PNG intermédiaire
 * (resvg panique sur une viewBox qui rogne des polygones à motifs — le raster, lui, se rogne sans
 * risque) ; le crop AVANT est agrandi depuis la planche contact (≈×2,2 — flou assumé, il montre
 * l'aplat d'origine).
 *   npx tsx scripts/qc/pilote-bourg-avant-apres.mts <chemin/vers/planche-avant.png>
 * Sortie : public/qc/pilote-bourg-avant-apres.png
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { DEFS } from '../../src/gameIso/sprites';
import { povAmbianceDefs } from '../../src/gameIso/catalog/ambiance';
import { tileCenter, type Dims } from '../../src/gameIso/iso';
import { envPanel, type Panel } from './env-panels';
import { scenario as arene } from '../../src/scenes/test-scenarios/arene';

const avantPath = process.argv[2];
if (!avantPath) {
  console.error('Usage : npx tsx scripts/qc/pilote-bourg-avant-apres.mts <planche-avant env-arene-hub.png>');
  process.exit(1);
}

// ── Géométrie de la planche contact source (mêmes constantes que render-env.mts) ─────────────────────
const CELL_W = 1180, CELL_H = 820, PAD = 10, LABEL_H = 30, HEADER_H = 56;
const SHEET_W = 4720, SHEET_H = 2516;

const scene = arene.scene;
const avantUri = `data:image/png;base64,${readFileSync(avantPath).toString('base64')}`;

/** Placement d'un panneau dans sa cellule de planche contact (même calcul que render-env.mts). */
function cellPlacement(col: number, row: number, p: Panel): { ox: number; oy: number; s: number } {
  const innerW = CELL_W - 2 * PAD;
  const innerH = CELL_H - 2 * PAD - LABEL_H;
  const s = Math.min(innerW / p.w, innerH / p.h, 1.25);
  return { ox: col * CELL_W + PAD + (innerW - p.w * s) / 2, oy: HEADER_H + row * CELL_H + PAD + (innerH - p.h * s) / 2, s };
}

/** Cellule AVANT : recadrage de la cellule (col,row) de la planche de référence (étiquette comprise). */
function avantCell(col: number, row: number): string {
  const x = col * CELL_W, y = HEADER_H + row * CELL_H;
  return `<svg viewBox="${x} ${y} ${CELL_W} ${CELL_H}" width="${CELL_W}" height="${CELL_H}"><image href="${avantUri}" width="${SHEET_W}" height="${SHEET_H}"/></svg>`;
}

/** Cellule APRÈS : panneau rendu à l'instant, rasterisé PLEIN puis inséré à l'échelle de la cellule. */
function apresCell(p: Panel): string {
  const innerW = CELL_W - 2 * PAD, innerH = CELL_H - 2 * PAD - LABEL_H;
  const s = Math.min(innerW / p.w, innerH / p.h, 1.25);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${p.w} ${p.h}" width="${p.w}" height="${p.h}"><defs>${DEFS}${povAmbianceDefs()}</defs>${p.svg}</svg>`;
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: Math.round(p.w * s) }, font: { loadSystemFonts: true } }).render();
  const uri = `data:image/png;base64,${Buffer.from(png.asPng()).toString('base64')}`;
  const ox = PAD + (innerW - png.width) / 2, oy = PAD + (innerH - png.height) / 2;
  return `<image x="${ox.toFixed(1)}" y="${oy.toFixed(1)}" width="${png.width}" height="${png.height}" href="${uri}"/>`;
}

type Rect = { x: number; y: number; w: number; h: number };

/** Rect ÉCRAN (espace panneau iso rot0) du quartier TAVERNE : empreinte du toit + marge (façade sud,
 *  bout de place au pied, volume du toit au-dessus). */
function taverneRect(dims: Dims): Rect {
  const foot = { x: 3, y: 3, w: 15, h: 10 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [cx, cy] of [
    [foot.x - 1, foot.y - 1], [foot.x + foot.w, foot.y - 1], [foot.x + foot.w, foot.y + foot.h + 2], [foot.x - 1, foot.y + foot.h + 2],
  ]) {
    const c = tileCenter(cx, cy, dims);
    minX = Math.min(minX, c.cx); maxX = Math.max(maxX, c.cx);
    minY = Math.min(minY, c.cy); maxY = Math.max(maxY, c.cy);
  }
  return { x: minX - 40, y: minY - 210, w: maxX - minX + 80, h: maxY - minY + 250 };
}

/** Crop APRÈS 1:1 : panneau rasterisé à l'échelle 1, recadré via une <svg viewBox> imbriquée. */
function cropApres(p: Panel, r: Rect): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${p.w} ${p.h}" width="${p.w}" height="${p.h}"><defs>${DEFS}${povAmbianceDefs()}</defs>${p.svg}</svg>`;
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: p.w }, font: { loadSystemFonts: true } }).render();
  const uri = `data:image/png;base64,${Buffer.from(png.asPng()).toString('base64')}`;
  return `<svg viewBox="${r.x} ${r.y} ${r.w} ${r.h}" width="${r.w}" height="${r.h}"><image href="${uri}" width="${p.w}" height="${p.h}"/></svg>`;
}

/** Crop AVANT : le même rect, projeté dans la cellule (col,row) de la planche de référence puis
 *  agrandi à la taille du crop APRÈS (flou d'agrandissement assumé). */
function cropAvant(col: number, row: number, p: Panel, r: Rect): string {
  const { ox, oy, s } = cellPlacement(col, row, p);
  const vb = { x: ox + r.x * s, y: oy + r.y * s, w: r.w * s, h: r.h * s };
  return `<svg viewBox="${vb.x.toFixed(1)} ${vb.y.toFixed(1)} ${vb.w.toFixed(1)} ${vb.h.toFixed(1)}" width="${r.w}" height="${r.h}"><image href="${avantUri}" width="${SHEET_W}" height="${SHEET_H}"/></svg>`;
}

/** Fragment (taille r.w×r.h) inséré à l'échelle de la cellule. */
function fitCell(frag: string, r: Rect): string {
  const innerW = CELL_W - 2 * PAD, innerH = CELL_H - 2 * PAD - LABEL_H;
  const s = Math.min(innerW / r.w, innerH / r.h, 1);
  const ox = PAD + (innerW - r.w * s) / 2, oy = PAD + (innerH - r.h * s) / 2;
  return `<g transform="translate(${ox.toFixed(1)},${oy.toFixed(1)}) scale(${s.toFixed(3)})">${frag}</g>`;
}

const dimsIso0: Dims = { ...scene.dimensions, rot: 0 };
const pIso0 = envPanel(scene, dimsIso0);
const rect = taverneRect(dimsIso0);
const rows: { label: string; avant: string; apres: string }[] = [
  { label: 'iso rot2', avant: avantCell(2, 0), apres: apresCell(envPanel(scene, { ...scene.dimensions, rot: 2 })) },
  { label: 'edge rot1', avant: avantCell(1, 1), apres: apresCell(envPanel(scene, { ...scene.dimensions, rot: 1, edge: true })) },
  { label: 'quartier taverne (crop 1:1, iso rot0)', avant: fitCell(cropAvant(0, 0, pIso0, rect), rect), apres: fitCell(cropApres(pIso0, rect), rect) },
];

const W = 2 * CELL_W;
const H = HEADER_H + rows.length * CELL_H;
const cells = rows
  .map((r, i) => {
    const y = HEADER_H + i * CELL_H;
    const frame = (x: number) => `<rect x="${x + 4}" y="${y + 4}" width="${CELL_W - 8}" height="${CELL_H - 8}" fill="none" stroke="#2a2f3a" stroke-width="2"/>`;
    return (
      `<g transform="translate(0,${y})">${r.avant}</g>${frame(0)}` +
      `<g transform="translate(${CELL_W},${y})">${r.apres}</g>${frame(CELL_W)}` +
      `<text x="${CELL_W}" y="${y + CELL_H - 12}" fill="#e8e2d2" font-family="sans-serif" font-size="26" font-weight="bold" text-anchor="middle">${r.label}</text>`
    );
  })
  .join('');

const svg =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">` +
  `<rect width="${W}" height="${H}" fill="#14161f"/>` +
  `<text x="${CELL_W / 2}" y="40" fill="#e8e2d2" font-family="sans-serif" font-size="34" font-weight="bold" text-anchor="middle">AVANT</text>` +
  `<text x="${CELL_W + CELL_W / 2}" y="40" fill="#e8e2d2" font-family="sans-serif" font-size="34" font-weight="bold" text-anchor="middle">APRÈS — matériaux v2 (pilote Bourg)</text>` +
  cells +
  `</svg>`;

mkdirSync('public/qc', { recursive: true });
const out = new Resvg(svg, { fitTo: { mode: 'width', value: W }, font: { loadSystemFonts: true } }).render().asPng();
writeFileSync('public/qc/pilote-bourg-avant-apres.png', out);
console.log(`OK: public/qc/pilote-bourg-avant-apres.png (${W}×${H})`);

/**
 * QC — PLANCHE COMPARATIVE du PILOTE SIÈGE (matériaux v2 « dessiné main », Lot 4) : trois vues
 * (iso rot0 · edge rot0 · POV) en AVANT / APRÈS côte à côte. L'AVANT est RECADRÉ depuis une planche
 * `env-siege-explore.png` de référence (rendue AVANT le lot) ; l'APRÈS est rendu à l'instant via les
 * panneaux partagés (`env-panels.ts`). Les panneaux APRÈS passent par un PNG intermédiaire (resvg
 * panique sur une viewBox qui rogne des polygones à motifs — le raster, lui, se rogne sans risque).
 *   npx tsx scripts/qc/pilote-siege-avant-apres.mts <chemin/vers/planche-avant.png>
 * Sortie : public/qc/pilote-siege-avant-apres.png
 *
 * CLASSEMENT #1176 C3 — INSTRUMENT DE DIAGNOSTIC d'un lot de matériaux du backend AFFINE : il compare
 * deux états d'un rendu affine (une planche de référence recadrée face à un rendu `env-panels.ts`),
 * et n'a de sens qu'entre deux versions de ce backend. MORT PLANIFIÉE à C5a, avec lui.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { DEFS } from '../../src/gameIso/sprites';
import { povAmbianceDefs } from '../../src/gameIso/catalog/ambiance';
import { envPanel, povPanel, partyStart, capsToward, type Panel } from './env-panels';
import { scenario as siege } from '../../src/scenes/test-scenarios/siege-explore';

const avantPath = process.argv[2];
if (!avantPath) {
  console.error('Usage : npx tsx scripts/qc/pilote-siege-avant-apres.mts <planche-avant env-siege-explore.png>');
  process.exit(1);
}

// ── Géométrie de la planche contact source (mêmes constantes que render-env.mts) ─────────────────────
const CELL_W = 1180, CELL_H = 820, PAD = 10, LABEL_H = 30, HEADER_H = 56;
const SHEET_W = 4720, SHEET_H = 2516;

const scene = siege.scene;
const avantUri = `data:image/png;base64,${readFileSync(avantPath).toString('base64')}`;

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

const eye = partyStart(scene);
const [cap1] = capsToward(scene, eye);
const rows: { label: string; avant: string; apres: string }[] = [
  { label: 'iso rot0', avant: avantCell(0, 0), apres: apresCell(envPanel(scene, { ...scene.dimensions, rot: 0 })) },
  { label: 'edge rot0', avant: avantCell(0, 1), apres: apresCell(envPanel(scene, { ...scene.dimensions, rot: 0, edge: true })) },
  { label: `POV (${eye.x},${eye.y}) → ${cap1}`, avant: avantCell(1, 2), apres: apresCell(povPanel(scene, eye, cap1)) },
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
  `<text x="${CELL_W + CELL_W / 2}" y="40" fill="#e8e2d2" font-family="sans-serif" font-size="34" font-weight="bold" text-anchor="middle">APRÈS — matériaux v2 (pilote pierre)</text>` +
  cells +
  `</svg>`;

mkdirSync('public/qc', { recursive: true });
const out = new Resvg(svg, { fitTo: { mode: 'width', value: W }, font: { loadSystemFonts: true } }).render().asPng();
writeFileSync('public/qc/pilote-siege-avant-apres.png', out);
console.log(`OK: public/qc/pilote-siege-avant-apres.png (${W}×${H})`);

/**
 * QC — GALERIE D'ENVIRONNEMENT headless : instrument de NON-RÉGRESSION VISUELLE de la refonte du rendu.
 * Rend les 4 scènes de référence (siège, Bourg de l'arène, opéra, caveau) via les PANNEAUX partagés
 * (`env-panels.ts`, mêmes primitives pures que le jeu — matériaux v2 au plein détail compris), dans
 * TOUTES les projections : iso losange rot 0..3, edge-on rot 0..3, vue du dessus, + 2 POV (première
 * personne, œil au départ du groupe). Environnement STATIQUE uniquement : ni brouillard, ni tokens, ni FX.
 *   npx tsx scripts/qc/render-env.mts   (npm run qc:env)
 * Sortie : public/qc/env-<sceneId>.png — 1 planche par scène, 11 panneaux étiquetés.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { DEFS } from '../../src/gameIso/sprites';
import { povAmbianceDefs } from '../../src/gameIso/catalog/ambiance';
import { type Rot } from '../../src/geometry/iso';
import { type Scene } from '../../src/state/scene';
import { buildScene } from '../../src/state/mapSpec';
import { envPanel, povPanel, partyStart, capsToward } from './env-panels';
import { scenario as siege } from '../../src/scenes/test-scenarios/siege-explore';
import { scenario as arene } from '../../src/scenes/test-scenarios/arene';
import { scenario as opera } from '../../src/scenes/test-scenarios/opera';
import { scenario as caveau } from '../../src/scenes/test-scenarios/piege-caveau';

function vitrinePerimeterWalls(
  foot: { x: number; y: number; w: number; h: number },
  door: { x: number; y: number; side: 'N' | 'E' | 'S' | 'O' },
) {
  const runs = [
    Array.from({ length: foot.w }, (_, i) => ({ x: foot.x + i, y: foot.y, side: 'N' as const })),
    Array.from({ length: foot.w }, (_, i) => ({ x: foot.x + i, y: foot.y + foot.h - 1, side: 'S' as const })),
    Array.from({ length: foot.h }, (_, i) => ({ x: foot.x, y: foot.y + i, side: 'O' as const })),
    Array.from({ length: foot.h }, (_, i) => ({ x: foot.x + foot.w - 1, y: foot.y + i, side: 'E' as const })),
  ];
  return runs.flatMap((run) => run.map((wall, i) => {
    if (wall.x === door.x && wall.y === door.y && wall.side === door.side) return { ...wall, door: true };
    return {
      ...wall,
      structure: 'mur-en-bois',
      ...(i > 0 && i < run.length - 1 && i % 3 === 1 ? { window: true } : {}),
    };
  }));
}

function vitrineBody(
  id: string,
  label: string,
  style: string,
  foot: { x: number; y: number; w: number; h: number },
  material: string,
) {
  const roomId = `piece-${id}`;
  return {
    id,
    label,
    style,
    storeys: [{ id: `${id}-z0`, z: 0, parts: [{ id: `${id}-volume`, foot }], roomZoneIds: [roomId] }],
    facades: [],
    roofs: [{ id: `toit-${id}`, z: 0, parts: [{ ...foot }], profile: 'gable' as const, ridge: 'x' as const, eaveHeightM: 3, pitch: 0.75, material, roomZoneIds: [roomId] }],
  };
}

const VITRINE_BODIES = [
  { id: 'vit-taverne', label: 'Taverne', style: 'taverne', foot: { x: 3, y: 3, w: 15, h: 10 }, material: 'tuile', door: { x: 10, y: 12, side: 'S' as const } },
  { id: 'vit-maison', label: 'Maison', style: 'maison', foot: { x: 21, y: 4, w: 7, h: 7 }, material: 'tuile', door: { x: 24, y: 10, side: 'S' as const } },
  { id: 'vit-forge', label: 'Forge', style: 'forge', foot: { x: 5, y: 16, w: 10, h: 5 }, material: 'ardoise', door: { x: 9, y: 16, side: 'N' as const } },
  { id: 'vit-chapelle', label: 'Chapelle', style: 'chapelle', foot: { x: 20, y: 14, w: 4, h: 5 }, material: 'ardoise', door: { x: 21, y: 18, side: 'S' as const } },
  { id: 'vit-echoppe', label: 'Échoppe', style: 'echoppe', foot: { x: 25, y: 16, w: 3, h: 3 }, material: 'chaume', door: { x: 26, y: 18, side: 'S' as const } },
];

const vitrine: Scene = buildScene({
  size: [30, 24],
  id: 'vitrine-batiments',
  nom: 'Vitrine — bâtiments (ornements par type)',
  ambiance: 'exterieur',
  terrain: 'herbe',
  heroStart: { x: 24, y: 22 },
  flags: { '__door_10_13_N_0': false, '__door_24_11_N_0': false },
  architecture: VITRINE_BODIES.map(({ id, label, style, foot, material }) => vitrineBody(id, label, style, foot, material)),
  walls: VITRINE_BODIES.flatMap(({ foot, door }) => vitrinePerimeterWalls(foot, door)),
  terrainRects: VITRINE_BODIES.map(({ foot }) => ({ rect: [foot.x, foot.y, foot.w, foot.h] as [number, number, number, number], terrain: 'plancher' })),
  effectZones: VITRINE_BODIES.map(({ id, label, foot }) => ({
    id: `piece-${id}`,
    label,
    presentation: 'interior' as const,
    area: { kind: 'rect' as const, ...foot },
    z: 0,
  })),
  entities: [
    { id: 'orn-vit-taverne-enseigne', kind: 'prop', pos: { x: 10, y: 13 }, facing: 'S', ref: 'enseigne' },
    { id: 'orn-vit-forge-cheminee', kind: 'prop', pos: { x: 10, y: 18 }, ref: 'cheminee', anim: 'warm' },
    { id: 'orn-vit-chapelle-clocheton', kind: 'prop', pos: { x: 22, y: 16 }, ref: 'clocheton' },
    { id: 'orn-vit-echoppe-etal', kind: 'prop', pos: { x: 26, y: 19 }, facing: 'S', ref: 'etal-marche' },
  ],
});

// ── Planche contact : grille 4×3 de panneaux étiquetés, réduits pour tenir ≤ ~4800 px de large ───────
const CELL_W = 1180;
const CELL_H = 820;
const PAD = 10;
const LABEL_H = 30;
const HEADER_H = 56;
const COLS = 4;

function renderSheet(scene: Scene) {
  const rots: Rot[] = [0, 1, 2, 3];
  const eye = partyStart(scene);
  const [cap1, cap2] = capsToward(scene, eye);
  const panels: { label: string; p: { w: number; h: number; svg: string } }[] = [
    ...rots.map((rot) => ({ label: `iso rot${rot}`, p: envPanel(scene, { ...scene.dimensions, rot }) })),
    ...rots.map((rot) => ({ label: `edge rot${rot}`, p: envPanel(scene, { ...scene.dimensions, rot, edge: true }) })),
    { label: 'top', p: envPanel(scene, { ...scene.dimensions, view: 'top' }) },
    { label: `POV (${eye.x},${eye.y}) → ${cap1}`, p: povPanel(scene, eye, cap1) },
    { label: `POV (${eye.x},${eye.y}) → ${cap2}`, p: povPanel(scene, eye, cap2) },
    { label: `POV NUIT → ${cap1} (fenêtres allumées)`, p: povPanel(scene, eye, cap1, true) },
  ];
  const rows = Math.ceil(panels.length / COLS);
  const W = COLS * CELL_W;
  const H = HEADER_H + rows * CELL_H;

  const cells = panels.map(({ label, p }, idx) => {
    const cx = (idx % COLS) * CELL_W;
    const cy = HEADER_H + Math.floor(idx / COLS) * CELL_H;
    const innerW = CELL_W - 2 * PAD;
    const innerH = CELL_H - 2 * PAD - LABEL_H;
    const s = Math.min(innerW / p.w, innerH / p.h, 1.25);
    const ox = cx + PAD + (innerW - p.w * s) / 2;
    const oy = cy + PAD + (innerH - p.h * s) / 2;
    return (
      // <svg> imbriqué = clipping automatique du panneau (les polygones POV débordent du viewport)
      `<svg x="${ox.toFixed(1)}" y="${oy.toFixed(1)}" width="${(p.w * s).toFixed(1)}" height="${(p.h * s).toFixed(1)}" viewBox="0 0 ${p.w} ${p.h}" preserveAspectRatio="xMidYMid meet">${p.svg}</svg>` +
      `<rect x="${cx + 4}" y="${cy + 4}" width="${CELL_W - 8}" height="${CELL_H - 8}" fill="none" stroke="#2a2f3a" stroke-width="2"/>` +
      `<text x="${cx + CELL_W / 2}" y="${cy + CELL_H - 14}" fill="#e8e2d2" font-family="sans-serif" font-size="24" text-anchor="middle">${label}</text>`
    );
  });

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">` +
    `<defs>${DEFS}${povAmbianceDefs()}</defs>` +
    `<rect width="${W}" height="${H}" fill="#14161f"/>` +
    `<text x="${W / 2}" y="38" fill="#e8e2d2" font-family="sans-serif" font-size="30" font-weight="bold" text-anchor="middle">${scene.nom} — ${scene.id} (${scene.dimensions.w}×${scene.dimensions.h}, ${scene.layers.length} couche${scene.layers.length > 1 ? 's' : ''})</text>` +
    cells.join('') +
    `</svg>`;

  const png = new Resvg(svg, { fitTo: { mode: 'width', value: W }, font: { loadSystemFonts: true } }).render().asPng();
  mkdirSync('public/qc', { recursive: true });
  const file = `public/qc/env-${scene.id}.png`;
  writeFileSync(file, png);
  console.log(`OK: ${file} (${W}×${H})`);
}

for (const scn of [siege, arene, opera, caveau]) renderSheet(scn.scene);
renderSheet(vitrine);

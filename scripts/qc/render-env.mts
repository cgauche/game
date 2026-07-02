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
import { type Rot } from '../../src/gameIso/iso';
import { type Scene } from '../../src/state/scene';
import { buildScene } from '../../src/state/mapSpec';
import { envPanel, povPanel, partyStart, capsToward } from './env-panels';
import { scenario as siege } from '../../src/scenes/test-scenarios/siege-explore';
import { scenario as arene } from '../../src/scenes/test-scenarios/arene';
import { scenario as opera } from '../../src/scenes/test-scenarios/opera';
import { scenario as caveau } from '../../src/scenes/test-scenarios/piege-caveau';

// VITRINE BÂTIMENTS : petit bourg construit par `addBuilding` (via `rooms`) — 5 bâtiments à murs bois
// avec PORTE et FENÊTRES décoratives (posées automatiquement par `addBuilding`). Prouve que les pans se
// lisent comme des maisons (croisées + porte à vantail) ET que chaque TYPE se LIT par son ornement
// (enseigne sur la taverne, cheminée+fumée sur la forge, clocheton sur la chapelle, étal devant l'échoppe)
// en iso rot0-3, edge, top, POV jour ET nuit.
const vitrine: Scene = buildScene({
  size: [30, 24],
  id: 'vitrine-batiments',
  nom: 'Vitrine — bâtiments (ornements par type)',
  ambiance: 'exterieur',
  terrain: 'herbe',
  heroStart: { x: 24, y: 22 }, // œil POV sous la chapelle/échoppe → leurs ornements plein cadre
  // Deux portes FERMÉES (vantail visible) : taverne (canon 10,13,N) + maison (canon 24,11,N). La forge
  // reste ouverte (embrasure) pour le contraste. Clés = `__door_<x>_<y>_<side>_<z>`.
  flags: { '__door_10_13_N_0': false, '__door_24_11_N_0': false },
  rooms: [
    { foot: [3, 3, 15, 10], style: 'taverne', door: { x: 10, y: 12, side: 'S' }, wallStructure: 'mur-en-bois', floor: 'plancher', label: 'Taverne', id: 'vit-taverne' },
    { foot: [21, 4, 7, 7], style: 'maison', door: { x: 24, y: 10, side: 'S' }, wallStructure: 'mur-en-bois', floor: 'plancher', id: 'vit-maison' },
    { foot: [5, 16, 10, 5], style: 'forge', door: { x: 9, y: 16, side: 'N' }, wallStructure: 'mur-en-bois', floor: 'plancher', label: 'Forge', id: 'vit-forge' },
    { foot: [20, 14, 4, 5], style: 'chapelle', door: { x: 21, y: 18, side: 'S' }, wallStructure: 'mur-en-bois', floor: 'plancher', label: 'Chapelle', id: 'vit-chapelle' },
    { foot: [25, 16, 3, 3], style: 'echoppe', door: { x: 26, y: 18, side: 'S' }, wallStructure: 'mur-en-bois', floor: 'plancher', label: 'Échoppe', id: 'vit-echoppe' },
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

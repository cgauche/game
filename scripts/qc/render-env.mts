/**
 * QC — GALERIE D'ENVIRONNEMENT headless : instrument de NON-RÉGRESSION VISUELLE de la refonte du rendu.
 * Rend les 4 scènes de référence (siège, Bourg de l'arène, opéra, caveau) avec les MÊMES primitives
 * PURES que le jeu (buildFloors+floorSvg / buildWalls+wallSvg / terrainOverlay / buildRoofs+roofSvg / propSvg / buildPovDrawList),
 * dans TOUTES les projections : iso losange rot 0..3, edge-on rot 0..3, vue du dessus, + 2 POV
 * (première personne, œil au départ du groupe). Environnement STATIQUE uniquement : ni brouillard,
 * ni tokens, ni FX.
 *   npx tsx scripts/qc/render-env.mts   (npm run qc:env)
 * Sortie : public/qc/env-<sceneId>.png — 1 planche par scène, 11 panneaux étiquetés.
 */
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { buildFloors } from '../../src/gameIso/builders/floors';
import { floorSvg, floorDepth } from '../../src/gameIso/backends/affineFloors';
import { buildWalls } from '../../src/gameIso/builders/walls';
import { wallDepth, wallSvg } from '../../src/gameIso/backends/affineWalls';
import { buildRoofs } from '../../src/gameIso/builders/roofs';
import { roofDepth, roofSvg } from '../../src/gameIso/backends/affineRoofs';
import { DEFS, terrainOverlay } from '../../src/gameIso/sprites';
import { propSvg } from '../../src/gameIso/catalog/decor';
import { stageSize, depth, tileCenter, billboardScale, TH, type Dims, type Rot } from '../../src/gameIso/iso';
import { makeCamera, VW, VH, FOG_COLOR } from '../../src/gameIso/pov/camera';
import { buildPovDrawList } from '../../src/gameIso/pov/geometry';
import { tileAt, heightAt, isIndoor, type Scene } from '../../src/state/scene';
import { metricToLift } from '../../src/state/relief';
import { DIR8_DELTA, type Dir8 } from '../../src/gameIso/rig/facing';
import { scenario as siege } from '../../src/scenes/test-scenarios/siege-explore';
import { scenario as arene } from '../../src/scenes/test-scenarios/arene';
import { scenario as opera } from '../../src/scenes/test-scenarios/opera';
import { scenario as caveau } from '../../src/scenes/test-scenarios/piege-caveau';

// ── Résolution des `var(--x)` CSS (couleurs pierre des fortifications) : resvg n'a pas de DOM → on
//    substitue chaque `var(--x)` par sa valeur lue dans la VRAIE feuille base.css (source unique, mêmes
//    valeurs que le jeu ; c'est l'équivalent headless du getComputedStyle de pov/geometry.resolveCss). ──
const CSS_VARS: [string, string][] = [...readFileSync('src/ui/styles/base.css', 'utf8').matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)].map(
  (m) => [m[1], m[2].trim()],
);
function resolveCssVars(svg: string): string {
  let out = svg;
  for (let pass = 0; pass < 2 && out.includes('var(--'); pass++)
    for (const [name, val] of CSS_VARS) out = out.split(`var(--${name})`).join(val); // pas de replaceAll : lib tsconfig < es2021
  return out;
}

// ── Panneau ISO / EDGE / TOP : mêmes couches et mêmes offsets de profondeur que IsoStage ─────────────
// (sol −0.5 · prop 0 · overlay = biais du registre · mur = wallDepth interne · toit = roofDepth interne)
function envPanel(scene: Scene, dims: Dims): { w: number; h: number; svg: string } {
  const objs: { d: number; svg: string }[] = [];
  // Sols : TOUTES les couches PLEINES (activeZ = couche max → aucun fantôme), tout visible ;
  // parois de relief auto-dérivées comprises.
  const maxZ = Math.max(...scene.layers.map((l) => l.z));
  for (const el of buildFloors(scene, undefined, { activeZ: maxZ })) objs.push({ d: floorDepth(el, dims), svg: floorSvg(el, dims) });
  // Murs d'arête (portes/parapets/herses inclus — apparence 100 % donnée), toutes couches.
  for (const el of buildWalls(scene)) objs.push({ d: wallDepth(el, dims), svg: wallSvg(el, dims) });
  // Overlays de terrain en relief (tuile 'mur' pleine, 'bois') — couche de base, comme IsoStage.
  for (let y = 0; y < dims.h; y++)
    for (let x = 0; x < dims.w; x++) {
      const ov = terrainOverlay(tileAt(scene, x, y), x, y, dims);
      if (ov) objs.push({ d: ov.d, svg: ov.html });
    }
  // Props de scène (décor statique) : placement type placeSprite (boîte 120×150, pieds au bas de la
  // tuile), soulevés au lift MÉTRIQUE de leur case, réduits en edge-on (billboardScale).
  for (const ent of scene.entities) {
    if (ent.kind !== 'prop') continue;
    const z = ent.z ?? 0;
    const lift = metricToLift(heightAt(scene, ent.pos.x, ent.pos.y, z));
    const { cx, cy } = tileCenter(ent.pos.x, ent.pos.y, dims, lift);
    const scale = 0.55 * billboardScale(dims);
    const sh = `<ellipse cx="${cx}" cy="${cy + 3}" rx="${22 * scale + 4}" ry="${(22 * scale + 4) / 2}" fill="#000" opacity="0.33"/>`;
    objs.push({
      d: depth(ent.pos.x, ent.pos.y, dims, z),
      svg: `${sh}<g transform="translate(${cx - 60 * scale},${cy + TH / 2 - 150 * scale}) scale(${scale})">${propSvg(ent.ref ?? 'tonneau', ent.facing, dims.rot ?? 0)}</g>`,
    });
  }
  // Toits des bâtiments composés en PANS CONTINUS (jamais en cutaway : environnement pur).
  for (const el of buildRoofs(scene)) objs.push({ d: roofDepth(el, dims), svg: roofSvg(el, dims) });
  objs.sort((a, b) => a.d - b.d);
  const st = stageSize(dims);
  return { w: st.w, h: st.h, svg: objs.map((o) => o.svg).join('') };
}

// ── POV : caméra + liste de dessin PURES ; « tout visible » + lumière uniforme (QC d'environnement) ──
function allVisible(scene: Scene): Set<string> {
  const vis = new Set<string>();
  for (const lvl of scene.layers)
    for (let y = 0; y < scene.dimensions.h; y++)
      for (let x = 0; x < scene.dimensions.w; x++) vis.add(`${x},${y},${lvl.z}`);
  return vis;
}

function povPanel(scene: Scene, eye: { x: number; y: number; z?: number }, cap: Dir8): { w: number; h: number; svg: string } {
  const cam = makeCamera(scene, eye, cap);
  const draw = buildPovDrawList(scene, cam, allVisible(scene), { at: () => 1 });
  // Fond = ciel dégradé (extérieur) / sombre (intérieur), comme PovStage.
  const bg = `<rect width="${VW}" height="${VH}" fill="${isIndoor(scene) ? FOG_COLOR : 'url(#pov-sky)'}"/>`;
  const polys = draw
    .map((d) => `<polygon points="${d.points.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')}" fill="${d.fill}"/>`)
    .join('');
  return { w: VW, h: VH, svg: bg + polys };
}

/** Départ du groupe : entité `heroStart` de la scène, sinon premier point d'entrée, sinon le centre. */
function partyStart(scene: Scene): { x: number; y: number; z?: number } {
  const hs = scene.entities.find((e) => e.kind === 'heroStart');
  if (hs) return { x: hs.pos.x, y: hs.pos.y, z: hs.z };
  const entry = Object.values(scene.entryPoints ?? {})[0];
  if (entry) return entry;
  return { x: Math.floor(scene.dimensions.w / 2), y: Math.floor(scene.dimensions.h / 2) };
}

/** 2 caps pointés vers le CONTENU : le Dir8 le plus proche de « œil → centre », + la meilleure diagonale
 *  adjacente (45°, produit scalaire vers le centre maximal) — jamais tournés vers le bord. */
const RING: Dir8[] = ['E', 'SE', 'S', 'SO', 'O', 'NO', 'N', 'NE'];
function capsToward(scene: Scene, eye: { x: number; y: number }): [Dir8, Dir8] {
  let dx = (scene.dimensions.w - 1) / 2 - eye.x;
  let dy = (scene.dimensions.h - 1) / 2 - eye.y;
  if (!dx && !dy) dy = -1;
  const i = ((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 8) + 8) % 8;
  const inward = (d: Dir8) => DIR8_DELTA[d].gx * dx + DIR8_DELTA[d].gy * dy;
  const diag1 = RING[(i + 1) % 8];
  const diag2 = RING[(i + 7) % 8];
  return [RING[i], inward(diag1) >= inward(diag2) ? diag1 : diag2];
}

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
    `<defs>${DEFS}` +
    `<linearGradient id="pov-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#5b83ac"/><stop offset="100%" stop-color="#9fb2c6"/></linearGradient>` +
    `</defs>` +
    `<rect width="${W}" height="${H}" fill="#14161f"/>` +
    `<text x="${W / 2}" y="38" fill="#e8e2d2" font-family="sans-serif" font-size="30" font-weight="bold" text-anchor="middle">${scene.nom} — ${scene.id} (${scene.dimensions.w}×${scene.dimensions.h}, ${scene.layers.length} couche${scene.layers.length > 1 ? 's' : ''})</text>` +
    cells.join('') +
    `</svg>`;

  const png = new Resvg(resolveCssVars(svg), { fitTo: { mode: 'width', value: W }, font: { loadSystemFonts: true } }).render().asPng();
  mkdirSync('public/qc', { recursive: true });
  const file = `public/qc/env-${scene.id}.png`;
  writeFileSync(file, png);
  console.log(`OK: ${file} (${W}×${H})`);
}

for (const scn of [siege, arene, opera, caveau]) renderSheet(scn.scene);

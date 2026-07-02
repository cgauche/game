/**
 * QC — PANNEAUX D'ENVIRONNEMENT partagés (headless) : assemble une scène avec les MÊMES primitives
 * PURES que le jeu (buildFloors+floorSvg(+accents) / buildWalls+wallSvg(+accents) / terrainOverlay /
 * buildRoofs+roofSvg / propSvg / buildPovDrawList), en iso/edge/top (affine) et en POV première
 * personne. Consommé par `render-env.mts` (planches contact) et `pilote-siege-avant-apres.mts`
 * (planche comparative). Environnement STATIQUE uniquement : ni brouillard, ni tokens, ni FX.
 * Matériaux v2 : zoom 1 (plein détail) — fills + motifs de joints + accents seedés, defs par panneau.
 */
import { buildFloors } from '../../src/gameIso/builders/floors';
import { floorSvg, floorAccentsSvg, floorDepth } from '../../src/gameIso/backends/affineFloors';
import { buildWalls } from '../../src/gameIso/builders/walls';
import { wallDepth, wallSvg, wallAccentsSvg } from '../../src/gameIso/backends/affineWalls';
import { buildRoofs } from '../../src/gameIso/builders/roofs';
import { roofDepth, roofSvg } from '../../src/gameIso/backends/affineRoofs';
import { detailPatternDefs } from '../../src/gameIso/backends/affineDetail';
import { terrainOverlay } from '../../src/gameIso/sprites';
import { propSvg } from '../../src/gameIso/catalog/decor';
import { stageSize, depth, tileCenter, billboardScale, TH, type Dims } from '../../src/gameIso/iso';
import { makeCamera, VW, VH } from '../../src/gameIso/pov/camera';
import { buildPovDrawList } from '../../src/gameIso/pov/geometry';
import { AMBIANCE } from '../../src/gameIso/catalog/ambiance';
import { tileAt, heightAt, isIndoor, sceneMetresPerTile, type Scene } from '../../src/state/scene';
import { metricToLift } from '../../src/state/relief';
import { DIR8_DELTA, type Dir8 } from '../../src/gameIso/rig/facing';

export interface Panel { w: number; h: number; svg: string }

// ── Panneau ISO / EDGE / TOP : mêmes couches et mêmes offsets de profondeur que IsoStage ─────────────
// (sol −0.5 · prop 0 · overlay = biais du registre · mur = wallDepth interne · toit = roofDepth interne)
export function envPanel(scene: Scene, dims: Dims): Panel {
  const opts = { zoom: 1, mpt: sceneMetresPerTile(scene) };
  const objs: { d: number; svg: string }[] = [];
  // Sols : TOUTES les couches PLEINES (activeZ = couche max → aucun fantôme), tout visible ;
  // parois de relief auto-dérivées comprises + accents matériaux v2 par-dessus leur tuile.
  const maxZ = Math.max(...scene.layers.map((l) => l.z));
  for (const el of buildFloors(scene, undefined, { activeZ: maxZ }))
    objs.push({ d: floorDepth(el, dims), svg: floorSvg(el, dims, opts) + floorAccentsSvg(el, dims, opts) });
  // Murs d'arête (portes/parapets/herses inclus — apparence 100 % donnée), toutes couches.
  for (const el of buildWalls(scene)) objs.push({ d: wallDepth(el, dims), svg: wallSvg(el, dims, opts) + wallAccentsSvg(el, dims, opts) });
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
  // Toits des bâtiments composés en PANS CONTINUS (jamais en cutaway : environnement pur), au plein
  // détail matériaux v2 (bardeaux/chaume clippés par pan).
  for (const el of buildRoofs(scene)) objs.push({ d: roofDepth(el, dims), svg: roofSvg(el, dims, opts) });
  objs.sort((a, b) => a.d - b.d);
  const st = stageSize(dims);
  // Defs des matériaux v2 DANS le panneau (le `patternTransform` dépend de la projection ; les ids
  // sont étiquetés par projection → plusieurs panneaux coexistent dans un même document).
  return { w: st.w, h: st.h, svg: `<defs>${detailPatternDefs(dims, opts.mpt)}</defs>` + objs.map((o) => o.svg).join('') };
}

// ── POV : caméra + liste de dessin PURES ; « tout visible » + lumière uniforme (QC d'environnement) ──
export function allVisible(scene: Scene): Set<string> {
  const vis = new Set<string>();
  for (const lvl of scene.layers)
    for (let y = 0; y < scene.dimensions.h; y++)
      for (let x = 0; x < scene.dimensions.w; x++) vis.add(`${x},${y},${lvl.z}`);
  return vis;
}

export function povPanel(scene: Scene, eye: { x: number; y: number; z?: number }, cap: Dir8): Panel {
  const cam = makeCamera(scene, eye, cap);
  const draw = buildPovDrawList(scene, cam, allVisible(scene), { at: () => 1 });
  // Fond = ciel dégradé (extérieur) / sombre (intérieur), comme PovStage (`pov-sky` : defs d'ambiance).
  const bg = `<rect width="${VW}" height="${VH}" fill="${isIndoor(scene) ? AMBIANCE.pov.fogIndoor : 'url(#pov-sky)'}"/>`;
  const polys = draw
    .map((d) => `<polygon points="${d.points.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')}" fill="${d.fill}"/>`)
    .join('');
  return { w: VW, h: VH, svg: bg + polys };
}

/** Départ du groupe : entité `heroStart` de la scène, sinon premier point d'entrée, sinon le centre. */
export function partyStart(scene: Scene): { x: number; y: number; z?: number } {
  const hs = scene.entities.find((e) => e.kind === 'heroStart');
  if (hs) return { x: hs.pos.x, y: hs.pos.y, z: hs.z };
  const entry = Object.values(scene.entryPoints ?? {})[0];
  if (entry) return entry;
  return { x: Math.floor(scene.dimensions.w / 2), y: Math.floor(scene.dimensions.h / 2) };
}

/** 2 caps pointés vers le CONTENU : le Dir8 le plus proche de « œil → centre », + la meilleure diagonale
 *  adjacente (45°, produit scalaire vers le centre maximal) — jamais tournés vers le bord. */
const RING: Dir8[] = ['E', 'SE', 'S', 'SO', 'O', 'NO', 'N', 'NE'];
export function capsToward(scene: Scene, eye: { x: number; y: number }): [Dir8, Dir8] {
  let dx = (scene.dimensions.w - 1) / 2 - eye.x;
  let dy = (scene.dimensions.h - 1) / 2 - eye.y;
  if (!dx && !dy) dy = -1;
  const i = ((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 8) + 8) % 8;
  const inward = (d: Dir8) => DIR8_DELTA[d].gx * dx + DIR8_DELTA[d].gy * dy;
  const diag1 = RING[(i + 1) % 8];
  const diag2 = RING[(i + 7) % 8];
  return [RING[i], inward(diag1) >= inward(diag2) ? diag1 : diag2];
}

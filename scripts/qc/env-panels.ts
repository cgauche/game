/**
 * QC — PANNEAUX D'ENVIRONNEMENT partagés (headless) : assemble une scène avec les MÊMES primitives
 * PURES que le jeu (buildFloors+floorSvg(+accents) / buildWalls+wallSvg(+accents) / buildProps+propSvg /
 * buildRoofs+roofSvg / buildPovDrawList), en iso/edge/top (affine) et en POV première
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
import { buildProps } from '../../src/gameIso/builders/props';
import { propDepth } from '../../src/gameIso/backends/affineProps';
import { propSvg } from '../../src/gameIso/catalog/decor';
import { edgeDepthVeil } from '../../src/gameIso/catalog/ambiance';
import { stageSize, tileCenter, billboardScale, TH, type Dims } from '../../src/geometry/iso';
import { makeCamera, VW, VH } from '../../src/gameIso/pov/camera';
import { buildPovDrawList } from '../../src/gameIso/pov/geometry';
import { buildPropBillboards } from '../../src/gameIso/pov/billboardCore';
import { AMBIANCE } from '../../src/gameIso/catalog/ambiance';
import { heightAt, isIndoor, sceneMetresPerTile, type Scene } from '../../src/state/scene';
import { metricToLift } from '../../src/state/relief';
import { DIR8_DELTA, type Dir8 } from '../../src/state/dir8';

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
  // Toits des bâtiments composés en PANS CONTINUS (jamais en cutaway : environnement pur), au plein détail
  // matériaux v2. ÉMIS AVANT les props → à profondeur ÉGALE un ornement de faîte (clocheton/cheminée) se
  // peint PAR-DESSUS sa nappe (tri stable), comme le stage live où `propObjs` suit `roofObjs`.
  for (const el of buildRoofs(scene)) objs.push({ d: roofDepth(el, dims), svg: roofSvg(el, dims, opts) });
  // PROPS en billboards du MÊME SVG iso — décor de scène (tonneaux, tentes…), overlays de terrain
  // (bois → arbre) ET ornements de bâtiment (clocheton/cheminée/enseigne/étal), tous via `buildProps`
  // (source unique). Boîte 120×150 CENTRÉE sur l'empreinte (`foot.offX/offY`, `foot.scale`), soulevée au
  // lift MÉTRIQUE de la case + `liftM` de l'ornement, profondeur au coin caméra-proche (`propDepth`),
  // réduite en edge-on (billboardScale). Le mur PLEIN, lui, est déjà rendu par `buildFloors`, pas ici.
  for (const el of buildProps(scene)) {
    const px = el.cell.x + el.foot.offX, py = el.cell.y + el.foot.offY;
    const lift = metricToLift(heightAt(scene, el.cell.x, el.cell.y, el.cell.z) + (el.liftM ?? 0));
    const { cx, cy } = tileCenter(px, py, dims, lift);
    const scale = 0.55 * el.foot.scale * billboardScale(dims);
    const sh = `<ellipse cx="${cx}" cy="${cy + 3}" rx="${22 * scale + 4}" ry="${(22 * scale + 4) / 2}" fill="#000" opacity="0.33"/>`;
    objs.push({
      d: propDepth(el, dims),
      svg: `${sh}<g transform="translate(${cx - 60 * scale},${cy + TH / 2 - 150 * scale}) scale(${scale})">${propSvg(el.ref, el.facing, dims.rot ?? 0)}</g>`,
    });
  }
  objs.sort((a, b) => a.d - b.d);
  const st = stageSize(dims);
  // Defs des matériaux v2 DANS le panneau (le `patternTransform` dépend de la projection ; les ids
  // sont étiquetés par projection → plusieurs panneaux coexistent dans un même document). Le voile
  // d'ombrage de profondeur (edge-on) est posé PAR-DESSUS la scène (décoration de vue, comme le stage).
  return { w: st.w, h: st.h, svg: `<defs>${detailPatternDefs(dims, opts.mpt)}</defs>` + objs.map((o) => o.svg).join('') + edgeDepthVeil(dims, st.w, st.h) };
}

// ── POV : caméra + liste de dessin PURES ; « tout visible » + lumière uniforme (QC d'environnement) ──
export function allVisible(scene: Scene): Set<string> {
  const vis = new Set<string>();
  for (const lvl of scene.layers)
    for (let y = 0; y < scene.dimensions.h; y++)
      for (let x = 0; x < scene.dimensions.w; x++) vis.add(`${x},${y},${lvl.z}`);
  return vis;
}

export function povPanel(scene: Scene, eye: { x: number; y: number; z?: number }, cap: Dir8, night = false): Panel {
  const cam = makeCamera(scene, eye, cap);
  const visible = allVisible(scene);
  const draw = buildPovDrawList(scene, cam, visible, { at: () => (night ? 0.3 : 1) }, night);
  // Fond = ciel dégradé (extérieur) / sombre (intérieur), comme PovStage (`pov-sky` : defs d'ambiance).
  const bg = `<rect width="${VW}" height="${VH}" fill="${night ? '#0e1420' : isIndoor(scene) ? AMBIANCE.pov.fogIndoor : 'url(#pov-sky)'}"/>`;
  const cls = (d: { cls?: string }) => (d.cls ? ` class="${d.cls}"` : '');
  const op = (d: { opacity?: number }) => (d.opacity != null ? ` opacity="${d.opacity}"` : '');
  const polys = draw
    .map((d) =>
      d.path
        ? `<path d="${d.path}" fill="${d.fill ?? 'none'}" stroke="${d.stroke ?? 'none'}" stroke-width="${d.strokeW ?? 0}" stroke-linecap="round"${cls(d)}${op(d)}/>`
        : `<polygon points="${d.points!.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')}" fill="${d.fill}"${cls(d)}${op(d)}/>`,
    )
    .join('');
  // Props en billboards du MÊME SVG iso (noyau pur partagé avec PovStage) — le décor peuple le POV.
  const props = buildPropBillboards(scene, cam, visible)
    .map((b) => b.svg)
    .join('');
  return { w: VW, h: VH, svg: bg + polys + props };
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
  const dx = (scene.dimensions.w - 1) / 2 - eye.x;
  let dy = (scene.dimensions.h - 1) / 2 - eye.y;
  if (!dx && !dy) dy = -1;
  const i = ((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 8) + 8) % 8;
  const inward = (d: Dir8) => DIR8_DELTA[d].gx * dx + DIR8_DELTA[d].gy * dy;
  const diag1 = RING[(i + 1) % 8];
  const diag2 = RING[(i + 7) % 8];
  return [RING[i], inward(diag1) >= inward(diag2) ? diag1 : diag2];
}

import { describe, it, expect } from 'vitest';
import { emptyScene, type Roof } from '../../state/scene';
import { buildFloors } from '../builders/floors';
import { buildWalls } from '../builders/walls';
import { buildRoofs } from '../builders/roofs';
import type { Dims } from '../../geometry/iso';
import type { LightField } from '../../state/vision';
import { AMBIANCE } from '../catalog/ambiance';
import { floorLayerObjs, wallLayerObjs, roofLayerObjs, revealActorsOf, type LayerCtx } from './layers';
import { viewOpacityOf, tileBrightness } from './CulledScene';

const DIMS = (s: { dimensions: { w: number; h: number } }): Dims => ({ ...s.dimensions, rot: 0, view: 'iso' });
const OPTS = { zoom: 1, mpt: 2 };
const NEUTRAL_CTX: LayerCtx = { mode: 'exploration', battle: null, partyPos: { x: 0, y: 0 } };
const NO_OCCLUDE = () => false;
const ALWAYS_OCCLUDE = () => true;

describe('CulledScene — vérités de VUE écran-espace (#797 : décidées au RENDU, sur les objets à l’écran)', () => {
  it('reveal : une passerelle d’étage au-dessus d’un acteur EN DESSOUS devient semi-transparente (0.22)', () => {
    const s = emptyScene(2, 2);
    const z1 = new Array(4).fill('vide');
    z1[0] = 'planches';
    s.layers.push({ z: 1, tiles: z1, height: [4, 0, 0, 0] }); // tablier à 4 m au-dessus du sol
    const dims = DIMS(s);
    const objs = floorLayerObjs(buildFloors(s, undefined, { activeZ: 1 }), s, dims, NEUTRAL_CTX, 0, OPTS);
    const deck = objs.find((o) => o.z === 1)!;
    const ctx: LayerCtx = { mode: 'exploration', battle: null, partyPos: { x: 0, y: 0, z: 0 } };
    const revealActors = revealActorsOf(s, ctx);
    expect(viewOpacityOf(deck, dims, revealActors, NO_OCCLUDE, false)).toBe(0.22); // le groupe se tient dessous → on le révèle
  });

  it('reveal : ghost/solidOverhang ne se révèlent JAMAIS (déjà translucides ou pleins)', () => {
    const s = emptyScene(2, 2);
    const z1 = new Array(4).fill('vide');
    z1[0] = 'planches';
    s.layers.push({ z: 1, tiles: z1 });
    const dims = DIMS(s);
    const objs = floorLayerObjs(buildFloors(s, new Set(['0,0,0']), { activeZ: 0 }), s, dims, NEUTRAL_CTX, 0, OPTS);
    const ghost = objs.find((o) => o.z === 1)!;
    const revealActors = revealActorsOf(s, { mode: 'exploration', battle: null, partyPos: { x: 1, y: 1 } });
    expect(viewOpacityOf(ghost, dims, revealActors, NO_OCCLUDE, false)).toBe(0.35); // op bakée, jamais 0.22
  });

  it('murs : estompe d’occlusion (0.4) devant un acteur à suivre', () => {
    const s = emptyScene(3, 3);
    s.walls = [{ x: 1, y: 1, side: 'N' }];
    const dims = DIMS(s);
    const objs = wallLayerObjs(buildWalls(s), dims, NO_OCCLUDE, 0, OPTS);
    expect(objs).toHaveLength(1);
    expect(viewOpacityOf(objs[0], dims, [], ALWAYS_OCCLUDE, false)).toBe(0.4);
    expect(viewOpacityOf(objs[0], dims, [], NO_OCCLUDE, false)).toBe(1);
  });

  it('toits : cutaway occupé (bakée) → 0 en iso, 0.5 en vue plan', () => {
    const s = emptyScene(8, 8);
    const roof: Roof = { id: 'r1', foot: { x: 2, y: 2, w: 4, h: 2 }, style: 'maison' };
    s.roofs = [roof];
    const dims = DIMS(s);
    const el = buildRoofs(s, undefined, { allies: [{ x: 3, y: 3 }] })[0]; // allié DANS l'empreinte → roofOccupied
    const objs = roofLayerObjs([el], dims, OPTS);
    expect(objs[0].roofOccupied).toBe(true);
    expect(viewOpacityOf(objs[0], dims, [], NO_OCCLUDE, false)).toBe(0); // iso : invisible
    expect(viewOpacityOf(objs[0], dims, [], NO_OCCLUDE, true)).toBe(0.5); // plan : estompé
  });

  it('toits : cutaway « derrière » (écran-espace, occlusion sur une case de l’empreinte) même sans roofOccupied', () => {
    const s = emptyScene(8, 8);
    const roof: Roof = { id: 'r1', foot: { x: 2, y: 2, w: 4, h: 2 }, style: 'maison' };
    s.roofs = [roof];
    const dims = DIMS(s);
    const el = buildRoofs(s)[0]; // aucun allié dans l'empreinte → PAS roofOccupied
    const objs = roofLayerObjs([el], dims, OPTS);
    expect(objs[0].roofOccupied).toBe(false);
    expect(viewOpacityOf(objs[0], dims, [], NO_OCCLUDE, false)).toBe(1); // rien ne l'occulte → toit plein
    expect(viewOpacityOf(objs[0], dims, [], ALWAYS_OCCLUDE, false)).toBe(0); // une case de l'empreinte occultée → cutaway
  });
});

describe('CulledScene — éclairage par tuile via filtre CSS brightness (miroir POV base×light)', () => {
  const constLight = (v: number): LightField => ({ at: () => v });
  const floorObj = (h = 0) => ({ d: 0, x: 0, y: 0, z: 0, h, op: 1, el: <g /> });

  it('plein jour (light = 1) OU sans champ de lumière : AUCUN dim (no-op, zéro filtre)', () => {
    expect(tileBrightness(floorObj())).toBeUndefined();
    expect(tileBrightness(floorObj(), constLight(1))).toBeUndefined();
  });

  it('tuile ombrée (light < 1) : dim = brightness(qL) QUANTIFIÉ au cran ~0.06', () => {
    expect(tileBrightness(floorObj(), constLight(0.5))).toBe('brightness(0.48)'); // round(0.5/0.06)*0.06 = 8*0.06 = 0.48
  });

  it('lumière SOUS le plancher : clampée au plancher partagé AMBIANCE.ambientFloor (jamais noir plein)', () => {
    const floor = AMBIANCE.ambientFloor;
    const qFloor = Math.round(floor / 0.06) * 0.06;
    expect(tileBrightness(floorObj(), constLight(0))).toBe(`brightness(${qFloor.toFixed(2)})`);
  });

  it('mur/toit (pas de `h` bakée) : jamais de dim, quel que soit le champ de lumière', () => {
    expect(tileBrightness({ d: 0, x: 0, y: 0, z: 0, el: <g /> }, constLight(0.2))).toBeUndefined();
  });
});

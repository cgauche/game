import { describe, it, expect } from 'vitest';
import { emptyScene } from '../../state/scene';
import { buildFloors } from '../builders/floors';
import { buildProps } from '../builders/props';
import { buildWalls } from '../builders/walls';
import type { LightField } from '../../state/vision';
import { AMBIANCE } from '../catalog/ambiance';
import type { Dims } from '../iso';
import { floorLayerObjs, wallLayerObjs } from './layers';

const DIMS = (s: { dimensions: { w: number; h: number } }): Dims => ({ ...s.dimensions, rot: 0, view: 'iso' });
const OPTS = { zoom: 1, mpt: 2 };
const EXPLO = (partyPos: { x: number; y: number; z?: number }) => ({ mode: 'exploration', battle: null, partyPos });

describe('couches statiques du stage — vérités de VUE décorées au dessin', () => {
  it('sols plats : un obj par tuile, opaque, sous le voile (pas de vis)', () => {
    const s = emptyScene(3, 3);
    const objs = floorLayerObjs(buildFloors(s), s, DIMS(s), EXPLO({ x: 0, y: 0 }), 0, OPTS);
    expect(objs).toHaveLength(9);
    for (const o of objs) {
      expect(o.op).toBe(1);
      expect(o.vis).toBeUndefined();
    }
  });

  it('trio ghost/solidOverhang : tablier au-dessus de la zone active translucide, PLEIN (opaque + vis) là où le dessous n’est pas visible', () => {
    const s = emptyScene(2, 2);
    const z1 = new Array(4).fill('vide');
    z1[0] = 'planches'; // (0,0) z1 au-dessus d'herbe marchable → SURPLOMB
    s.layers.push({ z: 1, tiles: z1 });
    // Dessous VISIBLE → fantôme translucide (on protège la surface visible en contrebas).
    const seen = floorLayerObjs(buildFloors(s, new Set(['0,0,0']), { activeZ: 0 }), s, DIMS(s), EXPLO({ x: 1, y: 1 }), 0, OPTS);
    const ghost = seen.find((o) => o.z === 1)!;
    expect(ghost.op).toBe(0.35);
    expect(ghost.vis).toBeUndefined();
    // Dessous NON visible → surplomb PLEIN : opaque, au-dessus du voile (rempart en bord de carte).
    const unseen = floorLayerObjs(buildFloors(s, new Set(), { activeZ: 0 }), s, DIMS(s), EXPLO({ x: 1, y: 1 }), 0, OPTS);
    const solid = unseen.find((o) => o.z === 1)!;
    expect(solid.op).toBe(1);
    expect(solid.vis).toBe(true);
  });

  it('reveal : une passerelle d’étage au-dessus d’un acteur EN DESSOUS devient semi-transparente (0.22)', () => {
    const s = emptyScene(2, 2);
    const z1 = new Array(4).fill('vide');
    z1[0] = 'planches';
    s.layers.push({ z: 1, tiles: z1, height: [4, 0, 0, 0] }); // tablier à 4 m au-dessus du sol
    const objs = floorLayerObjs(buildFloors(s, undefined, { activeZ: 1 }), s, DIMS(s), EXPLO({ x: 0, y: 0, z: 0 }), 0, OPTS);
    const deck = objs.find((o) => o.z === 1)!;
    expect(deck.op).toBe(0.22); // le groupe se tient dessous → on le révèle
  });

  it('mur PLEIN : rendu par la couche SOL (bloc de relief), plus jamais un overlay de décor', () => {
    const s = emptyScene(3, 3);
    s.layers[0].tiles[4] = 'mur'; // (1,1)
    const objs = floorLayerObjs(buildFloors(s), s, DIMS(s), EXPLO({ x: 0, y: 0 }), 0, OPTS);
    expect(objs.find((o) => o.x === 1 && o.y === 1)).toBeDefined(); // un obj de SOL (le bloc plein)
    expect(buildProps(s).some((e) => e.source === 'terrain')).toBe(false); // le mur n'est PAS un prop
  });

  it('bois : émis en billboard de PROP (overlayProp → arbre) — MÊME chemin que le décor de scène', () => {
    const s = emptyScene(3, 3);
    s.layers[0].tiles[4] = 'bois'; // (1,1)
    const props = buildProps(s).filter((e) => e.source === 'terrain');
    expect(props).toHaveLength(1);
    expect(props[0].ref).toBe('arbre');
  });

  it('murs : estompe d’occlusion (0.4) devant un acteur à suivre, vis = vérité du builder', () => {
    const s = emptyScene(3, 3);
    s.walls = [{ x: 1, y: 1, side: 'N' }];
    const els = buildWalls(s);
    const objs = wallLayerObjs(els, DIMS(s), () => true, 0, OPTS);
    expect(objs).toHaveLength(1);
    expect(objs[0].op).toBe(0.4);
    expect(objs[0].vis).toBe(true); // sans set de visibilité : tout visible (builder)
  });
});

describe('floorLayerObjs — éclairage par tuile via filtre CSS brightness (miroir POV base×light)', () => {
  const constLight = (v: number): LightField => ({ at: () => v });

  it('plein jour (light = 1) OU sans champ de lumière : AUCUN dim (no-op, zéro filtre)', () => {
    const s = emptyScene(3, 3);
    const noLight = floorLayerObjs(buildFloors(s), s, DIMS(s), EXPLO({ x: 0, y: 0 }), 0, OPTS);
    const dayLight = floorLayerObjs(buildFloors(s), s, DIMS(s), EXPLO({ x: 0, y: 0 }), 0, OPTS, constLight(1));
    for (const o of [...noLight, ...dayLight]) expect(o.dim).toBeUndefined();
  });

  it('tuile ombrée (light < 1) : dim = brightness(qL) QUANTIFIÉ au cran ~0.06', () => {
    const s = emptyScene(3, 3);
    const objs = floorLayerObjs(buildFloors(s), s, DIMS(s), EXPLO({ x: 0, y: 0 }), 0, OPTS, constLight(0.5));
    for (const o of objs) expect(o.dim).toBe('brightness(0.48)'); // round(0.5/0.06)*0.06 = 8*0.06 = 0.48
  });

  it('lumière SOUS le plancher : clampée au plancher partagé AMBIANCE.ambientFloor (jamais noir plein)', () => {
    const s = emptyScene(3, 3);
    const objs = floorLayerObjs(buildFloors(s), s, DIMS(s), EXPLO({ x: 0, y: 0 }), 0, OPTS, constLight(0));
    const floor = AMBIANCE.ambientFloor;
    const qFloor = Math.round(floor / 0.06) * 0.06;
    for (const o of objs) expect(o.dim).toBe(`brightness(${qFloor.toFixed(2)})`); // pas brightness(0.00)
  });

  it('coalescence : la MÊME luminosité produit une chaîne dim IDENTIQUE (tuiles regroupées sous 1 <g filter>)', () => {
    const s = emptyScene(3, 3);
    const objs = floorLayerObjs(buildFloors(s), s, DIMS(s), EXPLO({ x: 0, y: 0 }), 0, OPTS, constLight(0.62));
    expect(new Set(objs.map((o) => o.dim))).toEqual(new Set(['brightness(0.60)'])); // une seule clé → un seul run
  });
});

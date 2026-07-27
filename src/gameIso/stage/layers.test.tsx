import { describe, it, expect } from 'vitest';
import { emptyScene } from '../../state/scene';
import { buildFloors } from '../builders/floors';
import { buildProps } from '../builders/props';
import { buildWalls } from '../builders/walls';
import { buildRoofs } from '../builders/roofs';
import type { Dims } from '../../geometry/iso';
import { floorLayerObjs, wallLayerObjs, roofLayerObjs, type LayerCtx } from './layers';

const DIMS = (s: { dimensions: { w: number; h: number } }): Dims => ({ ...s.dimensions, rot: 0, view: 'iso' });
const OPTS = { zoom: 1, mpt: 2 };
const NEUTRAL_CTX: LayerCtx = { mode: 'exploration', battle: null, partyPos: { x: 0, y: 0 } };
const NO_OCCLUDE = () => false;

describe('couches statiques du stage — vérités de SCÈNE bakées (invariantes à la position des acteurs)', () => {
  it('sols plats : un obj par tuile, opaque, sous le voile (pas de vis), hauteur bakée', () => {
    const s = emptyScene(3, 3);
    const objs = floorLayerObjs(buildFloors(s), s, DIMS(s), NEUTRAL_CTX, 0, OPTS);
    expect(objs).toHaveLength(9);
    for (const o of objs) {
      expect(o.kind).toBe('floor');
      expect(o.op).toBe(1);
      expect(o.vis).toBeUndefined();
      expect(o.ghost).toBe(false);
      expect(o.h).toBe(0);
    }
  });

  it('trio ghost/solidOverhang : tablier au-dessus de la zone active translucide, PLEIN (opaque + vis) là où le dessous n’est pas visible', () => {
    const s = emptyScene(2, 2);
    const z1 = new Array(4).fill('vide');
    z1[0] = 'planches'; // (0,0) z1 au-dessus d'herbe marchable → SURPLOMB
    s.layers.push({ z: 1, tiles: z1 });
    // Dessous VISIBLE → fantôme translucide (on protège la surface visible en contrebas).
    const seen = floorLayerObjs(buildFloors(s, new Set(['0,0,0']), { activeZ: 0 }), s, DIMS(s), NEUTRAL_CTX, 0, OPTS);
    const ghost = seen.find((o) => o.z === 1)!;
    expect(ghost.op).toBe(0.35);
    expect(ghost.ghost).toBe(true);
    expect(ghost.vis).toBeUndefined();
    // Dessous NON visible → surplomb PLEIN : opaque, au-dessus du voile (rempart en bord de carte).
    const unseen = floorLayerObjs(buildFloors(s, new Set(), { activeZ: 0 }), s, DIMS(s), NEUTRAL_CTX, 0, OPTS);
    const solid = unseen.find((o) => o.z === 1)!;
    expect(solid.op).toBe(1);
    expect(solid.ghost).toBe(true);
    expect(solid.vis).toBe(true);
  });

  it('reveal : PLUS baké ici (vérité de VUE écran-espace, cf. CulledScene.test.tsx) — un tablier non-ghost reste op=1', () => {
    const s = emptyScene(2, 2);
    const z1 = new Array(4).fill('vide');
    z1[0] = 'planches';
    s.layers.push({ z: 1, tiles: z1, height: [4, 0, 0, 0] }); // tablier à 4 m au-dessus du sol
    const objs = floorLayerObjs(buildFloors(s, undefined, { activeZ: 1 }), s, DIMS(s), NEUTRAL_CTX, 0, OPTS);
    const deck = objs.find((o) => o.z === 1)!;
    expect(deck.ghost).toBe(false);
    expect(deck.op).toBe(1); // reveal décidé au RENDU par CulledScene, jamais ici
    expect(deck.h).toBeGreaterThan(0); // hauteur MÉTRIQUE bakée, consommée par CulledScene
  });

  it('mur PLEIN : rendu par la couche SOL (bloc de relief), plus jamais un overlay de décor', () => {
    const s = emptyScene(3, 3);
    s.layers[0].tiles[4] = 'mur'; // (1,1)
    const objs = floorLayerObjs(buildFloors(s), s, DIMS(s), NEUTRAL_CTX, 0, OPTS);
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

  it('murs : PLUS d’op bakée (estompe d’occlusion décidée au RENDU) ; vis = vérité du builder ; x,y,z portés', () => {
    const s = emptyScene(3, 3);
    s.walls = [{ x: 1, y: 1, side: 'N' }];
    const els = buildWalls(s);
    const objs = wallLayerObjs(els, DIMS(s), NO_OCCLUDE, 0, OPTS);
    expect(objs).toHaveLength(1);
    expect(objs[0].x).toBe(1);
    expect(objs[0].y).toBe(1);
    expect(objs[0].vis).toBe(true); // sans set de visibilité : tout visible (builder)
    expect(objs[0]).toMatchObject({ kind: 'wall', side: 'N' });
  });

  it('toits : portent leur kind et leur étage logique', () => {
    const s = emptyScene(4, 4);
    s.architecture = [{ id: 'corps', style: 'maison', storeys: [], facades: [], masses: [{ id: 'toit', z: 1, footprint: [{ x: 1, y: 1, w: 2, h: 2 }], levels: 1, profile: 'flat', pitchDeg: 30, material: 'tuile' }] }];
    const objs = roofLayerObjs(buildRoofs(s), DIMS(s), OPTS);
    expect(objs[0]).toMatchObject({ kind: 'roof', z: 1 });
  });

  it('propage les relations architecturales des murs et toits au stage', () => {
    const s = emptyScene(5, 5);
    s.effectZones = [{ id: 'salle', label: 'Salle', presentation: 'interior', area: { kind: 'rect', x: 2, y: 2, w: 1, h: 1 }, z: 0 }];
    s.walls = [{ x: 2, y: 2, side: 'N' }];
    s.architecture = [{
      id: 'corps', style: 'maison', storeys: [],
      facades: [{ id: 'facade', z: 0, edges: [{ x: 2, y: 2, side: 'N' }], appearance: 'mur-a-ossature-en-bois', roomZoneIds: ['salle'] }],
      masses: [{ id: 'toit', z: 0, footprint: [{ x: 2, y: 2, w: 1, h: 1 }], levels: 1, profile: 'flat', pitchDeg: 30, material: 'tuile' }],
    }];

    expect(wallLayerObjs(buildWalls(s), DIMS(s), NO_OCCLUDE, 0, OPTS)[0].roomZoneIds).toEqual(['salle']);
    expect(roofLayerObjs(buildRoofs(s), DIMS(s), OPTS)[0].roomZoneIds).toEqual(['salle']);
  });
});

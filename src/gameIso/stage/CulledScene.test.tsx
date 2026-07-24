import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { emptyScene, type Roof } from '../../state/scene';
import { buildFloors } from '../builders/floors';
import { buildWalls } from '../builders/walls';
import { buildRoofs } from '../builders/roofs';
import type { Dims } from '../../geometry/iso';
import type { LightField } from '../../state/vision';
import { AMBIANCE } from '../catalog/ambiance';
import { floorLayerObjs, wallLayerObjs, roofLayerObjs, revealActorsOf, type LayerCtx } from './layers';
import { CulledScene, roomOpacityOf, viewOpacityOf, tileBrightness } from './CulledScene';
import type { StageObj } from './objs';
import type { RoomFocus } from './roomFocus';

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

  it('murs : estompe d’occlusion (0.14) devant un acteur à suivre', () => {
    const s = emptyScene(3, 3);
    s.walls = [{ x: 1, y: 1, side: 'N' }];
    const dims = DIMS(s);
    const objs = wallLayerObjs(buildWalls(s), dims, NO_OCCLUDE, 0, OPTS);
    expect(objs).toHaveLength(1);
    expect(viewOpacityOf(objs[0], dims, [], ALWAYS_OCCLUDE, false)).toBe(0.14);
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
    expect(viewOpacityOf(objs[0], dims, [], ALWAYS_OCCLUDE, false)).toBe(0.18); // une case de l'empreinte occultée → estompe
  });

  it('applique la fenêtre 3 colonnes × profondeur 10 aux murs/toits et garde le mur hors fenêtre opaque', () => {
    const dims: Dims = { w: 20, h: 20, view: 'top' };
    const wall = (id: string, y: number): StageObj => ({
      d: y,
      x: 8,
      y,
      z: 0,
      vis: true,
      el: <path key={id} data-id={id} />,
    });
    const objs: StageObj[] = [
      wall('wall-near', 15),
      wall('wall-outside', 16),
      {
        d: 10,
        roofCell: { x: 8, y: 15, z: 0 },
        roofSpan: { w: 1, h: 1 },
        roofOccupied: false,
        el: <g key="roof-near" data-id="roof-near" />,
      },
    ];
    const html = renderToStaticMarkup(
      <CulledScene
        objs={objs}
        dims={dims}
        cam={{ x: 0, y: -300 }}
        zoom={1}
        activeZ={0}
        fog={{ explored: new Set() }}
        revealActors={[]}
        occludeTiles={[{ x: 5, y: 5 }]}
        topView={false}
      />,
    );
    const tag = (id: string) => html.match(new RegExp(`<[^>]+data-id="${id}"[^>]*>`))?.[0] ?? '';

    expect(tag('wall-near')).toContain('opacity:0.14');
    expect(tag('wall-outside')).not.toContain('opacity');
    expect(tag('roof-near')).toContain('opacity="0.18"');
  });

  it('compose l’estompe de pièce avec le cutaway du mur de façade sans estomper le mur limitrophe', () => {
    const dims: Dims = { w: 20, h: 20, view: 'top' };
    const objs: StageObj[] = [
      { d: 0, x: 5, y: 5, z: 0, kind: 'floor', vis: true, el: <path key="floor-in" data-id="floor-in" /> },
      { d: 1, x: 7, y: 5, z: 0, kind: 'prop', vis: true, el: <path key="prop-out" data-id="prop-out" /> },
      { d: 2, x: 5, y: 6, z: 0, kind: 'wall', side: 'N', vis: true, el: <path key="wall-front" data-id="wall-front" /> },
    ];
    const roomFocus: RoomFocus = { id: 'salle', z: 0, tiles: new Set(['5,5,0']) };
    const html = renderToStaticMarkup(
      <CulledScene
        objs={objs}
        dims={dims}
        cam={{ x: 0, y: 0 }}
        zoom={1}
        activeZ={0}
        fog={{ explored: new Set() }}
        revealActors={[]}
        occludeTiles={[{ x: 5, y: 5 }]}
        topView={false}
        roomFocus={roomFocus}
      />,
    );
    const tag = (id: string) => html.match(new RegExp(`<[^>]+data-id="${id}"[^>]*>`))?.[0] ?? '';
    expect(tag('floor-in')).not.toContain('opacity');
    expect(tag('prop-out')).toContain('opacity:0.03');
    expect(tag('wall-front')).toContain('opacity:0.14');
  });
});

describe('roomOpacityOf', () => {
  const focus: RoomFocus = { id: 'salle', z: 0, tiles: new Set(['2,2,0']) };
  const obj = (extra: Partial<StageObj>): StageObj => ({ d: 0, el: <g />, ...extra });

  it('reste neutre sans focus ou sans kind', () => {
    expect(roomOpacityOf(obj({ kind: 'floor', x: 9, y: 9, z: 0 }), null)).toBe(1);
    expect(roomOpacityOf(obj({ x: 9, y: 9, z: 0 }), focus)).toBe(1);
  });

  it('estompe tout objet classé d’un autre étage', () => {
    expect(roomOpacityOf(obj({ kind: 'floor', x: 2, y: 2, z: 1 }), focus)).toBe(0.03);
    expect(roomOpacityOf(obj({ kind: 'roof', roofCell: { x: 2, y: 2, z: 1 }, roofSpan: { w: 1, h: 1 }, z: 1 }), focus)).toBe(0.03);
  });

  it('garde sols et props du masque exact, estompe les autres', () => {
    expect(roomOpacityOf(obj({ kind: 'floor', x: 2, y: 2, z: 0 }), focus)).toBe(1);
    expect(roomOpacityOf(obj({ kind: 'prop', x: 2, y: 2, z: 0 }), focus)).toBe(1);
    expect(roomOpacityOf(obj({ kind: 'floor', x: 3, y: 2, z: 0 }), focus)).toBe(0.03);
  });

  it.each([
    ['N', 2, 1],
    ['S', 2, 3],
    ['E', 3, 2],
    ['O', 1, 2],
  ] as const)('garde un mur %s quand l’une des deux cellules séparées appartient à la pièce', (side, x, y) => {
    expect(roomOpacityOf(obj({ kind: 'wall', x: 2, y: 2, z: 0, side }), { ...focus, tiles: new Set([`${x},${y},0`]) })).toBe(1);
  });

  it('estompe un mur sans cellule adjacente dans la pièce', () => {
    expect(roomOpacityOf(obj({ kind: 'wall', x: 5, y: 5, z: 0, side: 'N' }), focus)).toBe(0.03);
  });

  it('garde un toit dont l’empreinte intersecte la pièce', () => {
    expect(roomOpacityOf(obj({
      kind: 'roof',
      z: 0,
      roofCell: { x: 1, y: 1, z: 0 },
      roofSpan: { w: 2, h: 2 },
    }), focus)).toBe(1);
    expect(roomOpacityOf(obj({
      kind: 'roof',
      z: 0,
      roofCell: { x: 4, y: 4, z: 0 },
      roofSpan: { w: 2, h: 2 },
    }), focus)).toBe(0.03);
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

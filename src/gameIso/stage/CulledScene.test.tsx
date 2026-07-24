import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { emptyScene, type Roof } from '../../state/scene';
import { buildFloors } from '../builders/floors';
import { buildWalls } from '../builders/walls';
import { buildRoofs } from '../builders/roofs';
import { buildProps } from '../builders/props';
import { propLayerObjs } from './tokens';
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
const MiniToken = () => <g data-id="component-prop" />;

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

  it('toits : aucune coupe depuis l’extérieur, même si une case passe devant l’acteur à l’écran', () => {
    const s = emptyScene(8, 8);
    const roof: Roof = { id: 'r1', foot: { x: 2, y: 2, w: 4, h: 2 }, style: 'maison' };
    s.roofs = [roof];
    const dims = DIMS(s);
    const el = buildRoofs(s)[0]; // aucun allié dans l'empreinte → PAS roofOccupied
    const objs = roofLayerObjs([el], dims, OPTS);
    expect(objs[0].roofOccupied).toBe(false);
    expect(viewOpacityOf(objs[0], dims, [], NO_OCCLUDE, false)).toBe(1); // rien ne l'occulte → toit plein
    expect(viewOpacityOf(objs[0], dims, [], ALWAYS_OCCLUDE, false)).toBe(1);
  });

  it('toiture groupée : opaque pour un acteur extérieur adjacent, cutaway seulement sur une cellule couverte', () => {
    const s = emptyScene(8, 8);
    s.roofs = [
      { id: 'verticale', groupId: 'aile', foot: { x: 2, y: 2, w: 1, h: 3 }, style: 'maison' },
      { id: 'horizontale', groupId: 'aile', foot: { x: 3, y: 4, w: 2, h: 1 }, style: 'maison' },
    ];
    const dims = DIMS(s);
    const exterior = roofLayerObjs(buildRoofs(s, undefined, { allies: [{ x: 3, y: 3 }] }), dims, OPTS)[0];
    const interior = roofLayerObjs(buildRoofs(s, undefined, { allies: [{ x: 3, y: 4 }] }), dims, OPTS)[0];

    expect(exterior.roofOccupied).toBe(false);
    expect(viewOpacityOf(exterior, dims, [], ALWAYS_OCCLUDE, false)).toBe(1);
    expect(interior.roofOccupied).toBe(true);
    expect(viewOpacityOf(interior, dims, [], NO_OCCLUDE, false)).toBe(0);
  });

  it('hors toiture, garde opaques le mur extérieur et le toit même devant l’acteur', () => {
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

    expect(tag('wall-near')).not.toContain('opacity');
    expect(tag('wall-outside')).not.toContain('opacity');
    expect(tag('roof-near')).not.toContain('opacity');

    const insideHtml = renderToStaticMarkup(
      <CulledScene
        objs={objs.map((o) => o.roofCell ? { ...o, kind: 'roof', roofOccupied: true } : o)}
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
    const insideTag = (id: string) => insideHtml.match(new RegExp(`<[^>]+data-id="${id}"[^>]*>`))?.[0] ?? '';
    expect(insideTag('wall-near')).toContain('opacity:0.14');
    expect(insideTag('roof-near')).toContain('opacity="0"');
  });

  it('compose l’estompe de pièce avec le cutaway du mur de façade sans estomper le mur limitrophe', () => {
    const dims: Dims = { w: 20, h: 20, view: 'top' };
    const objs: StageObj[] = [
      { d: 0, x: 5, y: 5, z: 0, kind: 'floor', vis: true, el: <path key="floor-in" data-id="floor-in" /> },
      { d: 0.5, x: 7, y: 5, z: 0, kind: 'floor', vis: true, el: <path key="floor-out" data-id="floor-out" /> },
      { d: 1, x: 7, y: 5, z: 0, kind: 'prop', vis: true, el: <path key="prop-out" data-id="prop-out" /> },
      { d: 1.5, x: 8, y: 5, z: 0, kind: 'prop', vis: true, el: <MiniToken key="component-prop" /> },
      { d: 2, x: 5, y: 6, z: 0, kind: 'wall', side: 'N', vis: true, el: <path key="wall-front" data-id="wall-front" /> },
      { d: 3, el: <path key="hero" data-id="hero" /> },
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
    expect(tag('floor-out')).toContain('opacity:0');
    expect(tag('prop-out')).toContain('opacity:0');
    expect(html).toContain('<g style="opacity:0;transition:opacity 0.2s"><g data-id="component-prop"></g></g>');
    expect(tag('wall-front')).toContain('opacity:0');
    expect(tag('hero')).not.toContain('opacity');
  });
});

describe('roomOpacityOf', () => {
  const focus: RoomFocus = { id: 'salle', z: 0, tiles: new Set(['2,2,0']) };
  const obj = (extra: Partial<StageObj>): StageObj => ({ d: 0, el: <g />, ...extra });
  const dims = (rot: 0 | 1 | 2 | 3 = 0): Dims => ({ w: 10, h: 10, view: 'iso', rot });

  it('reste neutre sans focus ou sans kind', () => {
    expect(roomOpacityOf(obj({ kind: 'floor', x: 9, y: 9, z: 0 }), null, dims())).toBe(1);
    expect(roomOpacityOf(obj({ x: 9, y: 9, z: 0 }), focus, dims())).toBe(1);
  });

  it('masque tout objet classé d’un autre étage', () => {
    expect(roomOpacityOf(obj({ kind: 'floor', x: 2, y: 2, z: 1 }), focus, dims())).toBe(0);
    expect(roomOpacityOf(obj({ kind: 'roof', roofCell: { x: 2, y: 2, z: 1 }, roofSpan: { w: 1, h: 1 }, z: 1 }), focus, dims())).toBe(0);
  });

  it('garde le contenu du masque et masque tout sol ou décor extérieur', () => {
    expect(roomOpacityOf(obj({ kind: 'floor', x: 2, y: 2, z: 0 }), focus, dims())).toBe(1);
    expect(roomOpacityOf(obj({ kind: 'prop', x: 2, y: 2, z: 0 }), focus, dims())).toBe(1);
    expect(roomOpacityOf(obj({ kind: 'floor', x: 3, y: 2, z: 0 }), focus, dims())).toBe(0);
    expect(roomOpacityOf(obj({ kind: 'prop', x: 3, y: 2, z: 0 }), focus, dims())).toBe(0);
    expect(roomOpacityOf(obj({
      kind: 'roof',
      z: 0,
      roofCell: { x: 4, y: 4, z: 0 },
      roofSpan: { w: 2, h: 2 },
    }), focus, dims())).toBe(0);
  });

  it.each([
    [0, 'façade', '2,1,0', 0],
    [0, 'arrière', '2,2,0', 1],
    [2, 'façade', '2,2,0', 0],
    [2, 'arrière', '2,1,0', 1],
  ] as const)('rotation %i : mur de %s', (rot, _position, inside, expected) => {
    const boundary = { ...focus, tiles: new Set([inside]) };
    expect(roomOpacityOf(obj({ kind: 'wall', x: 2, y: 2, z: 0, side: 'N' }), boundary, dims(rot))).toBe(expected);
  });

  it('masque un mur sans cellule adjacente dans la pièce', () => {
    expect(roomOpacityOf(obj({ kind: 'wall', x: 5, y: 5, z: 0, side: 'N' }), focus, dims())).toBe(0);
  });

  it('exempte de l’isolation spatiale un panneau architectural relationnel', () => {
    expect(roomOpacityOf(
      obj({ kind: 'wall', x: 5, y: 5, z: 0, side: 'N', roomZoneIds: ['salle'] }),
      focus,
      dims(),
    )).toBe(1);
  });

  it('préserve l’isolation legacy mais exempte les objets architecturaux propagés par les builders', () => {
    const scene = emptyScene(6, 6);
    scene.effectZones = [{ id: 'salle', label: 'Salle', presentation: 'interior', area: { kind: 'rect', x: 2, y: 2, w: 1, h: 1 }, z: 0 }];
    scene.entities.push({ id: 'dehors', kind: 'prop', pos: { x: 4, y: 4 }, ref: 'tonneau' });
    scene.walls = [{ x: 2, y: 2, side: 'N' }];
    scene.roofs = [{ id: 'legacy', foot: { x: 4, y: 4, w: 1, h: 1 }, style: 'maison' }];
    scene.architecture = [{
      id: 'corps', style: 'maison', storeys: [],
      facades: [{ id: 'facade', z: 0, edges: [{ x: 2, y: 2, side: 'N' }], appearance: 'mur-a-ossature-en-bois', roomZoneIds: ['salle'] }],
      roofs: [{ id: 'toit', z: 0, foot: { x: 2, y: 2, w: 1, h: 1 }, profile: 'flat', ridge: 'x', eaveHeightM: 2, pitch: 0, material: 'tuile', roomZoneIds: ['salle'] }],
    }];
    const d = DIMS(scene);
    const focus: RoomFocus = { id: 'salle', z: 0, tiles: new Set(['2,2,0']) };
    const floors = floorLayerObjs(buildFloors(scene), scene, d, NEUTRAL_CTX, 0, OPTS);
    const props = propLayerObjs(buildProps(scene), { dims: d, view: 'iso', liftAt: () => 0 });
    const walls = wallLayerObjs(buildWalls(scene), d, NO_OCCLUDE, 0, OPTS);
    const roofs = roofLayerObjs(buildRoofs(scene), d, OPTS);

    expect(roomOpacityOf(floors.find((o) => o.x === 4 && o.y === 4)!, focus, d)).toBe(0);
    expect(roomOpacityOf(props.find((o) => o.x === 4 && o.y === 4)!, focus, d)).toBe(0);
    expect(roomOpacityOf(roofs.find((o) => o.roofCell?.x === 4)!, focus, d)).toBe(0);
    expect(roomOpacityOf(walls[0], focus, d)).toBe(1);
    expect(roomOpacityOf(roofs.find((o) => o.roofCell?.x === 2)!, focus, d)).toBe(1);
  });

  it('garde un toit dont l’empreinte intersecte la pièce', () => {
    expect(roomOpacityOf(obj({
      kind: 'roof',
      z: 0,
      roofCell: { x: 1, y: 1, z: 0 },
      roofSpan: { w: 2, h: 2 },
    }), focus, dims())).toBe(1);
  });

  it('ne garde pas un toit quand la pièce intersecte seulement un trou de sa bbox', () => {
    const roof = obj({
      kind: 'roof',
      z: 0,
      roofCell: { x: 0, y: 0, z: 0 },
      roofSpan: { w: 3, h: 3 },
      roofCells: [
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 1, z: 0 },
        { x: 0, y: 2, z: 0 },
        { x: 1, y: 2, z: 0 },
        { x: 2, y: 2, z: 0 },
      ],
    });
    const holeFocus: RoomFocus = { id: 'trou', z: 0, tiles: new Set(['1,0,0']) };
    const exactFocus: RoomFocus = { id: 'branche', z: 0, tiles: new Set(['1,2,0']) };
    expect(roomOpacityOf(roof, holeFocus, dims())).toBe(0);
    expect(roomOpacityOf(roof, exactFocus, dims())).toBe(1);
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

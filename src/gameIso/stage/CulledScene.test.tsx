import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { emptyScene, heightAt } from '../../state/scene';
import { buildFloors } from '../builders/floors';
import { buildWalls } from '../builders/walls';
import { buildRoofs } from '../builders/roofs';
import { buildProps } from '../builders/props';
import { propLayerObjs } from './tokens';
import { projectOccluder, occludesActor, type Dims } from '../../geometry/iso';
import { metricToLift } from '../../state/relief';
import type { LightField } from '../../state/vision';
import { AMBIANCE } from '../catalog/ambiance';
import { floorLayerObjs, wallLayerObjs, roofLayerObjs, type LayerCtx } from './layers';
import { CulledScene, roomOpacityOf, bakedOpacityOf, tileBrightness } from './CulledScene';
import { actorCapsuleOf } from './actorCapsule';
import type { StageObj } from './objs';
import type { RoomFocus } from './roomFocus';
import { baseSkeleton, applyBuild, groundSkeleton } from '../rig/skeletons';
import { gabaritById, type GabaritDef } from '../rig/gabarits';
import { raceById } from '../rig/races';
import { worldTransforms, apply } from '../rig/kinematics';
import { BONE_IDS } from '../rig/bones';
import { sizeTokenScale } from '../sizeScale';
import type { SizeCategory } from '../../engine/size';

const DIMS = (s: { dimensions: { w: number; h: number } }): Dims => ({ ...s.dimensions, rot: 0, view: 'iso' });
const OPTS = { zoom: 1, mpt: 2 };
const NEUTRAL_CTX: LayerCtx = { mode: 'exploration', battle: null, partyPos: { x: 0, y: 0 } };
const NO_OCCLUDE = () => false;
const MiniToken = () => <g data-id="component-prop" />;

/** Rendu RÉEL de la scène cullée (le chemin de production `coreOf`). */
const renderScene = (objs: StageObj[], dims: Dims) => renderToStaticMarkup(
  <CulledScene
    objs={objs}
    dims={dims}
    cam={{ x: 0, y: 0 }}
    zoom={1}
    activeZ={0}
    fog={{ explored: new Set() }}
  />,
);
const roofOpacity = (html: string) => Number(html.match(/opacity="([\d.]+)"/)![1]);
const roofScene = () => {
  const s = emptyScene(8, 8);
  s.architecture = [{
    id: 'corps', style: 'maison', storeys: [], facades: [],
    masses: [{ id: 'r1', z: 0, footprint: [{ x: 2, y: 2, w: 4, h: 2 }], levels: 1, profile: 'flat', pitchDeg: 30, material: 'tuile' }],
  }];
  return s;
};

describe('CulledScene — vérités de VUE écran-espace (#797 : décidées au RENDU, sur les objets à l’écran)', () => {
  it('un tablier d’étage garde l’opacité BAKÉE par sa couche — le rendu n’y superpose aucun voile', () => {
    const s = emptyScene(2, 2);
    const z1 = new Array(4).fill('vide');
    z1[0] = 'planches';
    s.layers.push({ z: 1, tiles: z1, height: [4, 0, 0, 0] }); // tablier à 4 m au-dessus du sol
    const dims = DIMS(s);
    const objs = floorLayerObjs(buildFloors(s, new Set(['0,0,0']), { activeZ: 0 }), s, dims, NEUTRAL_CTX, 0, OPTS);
    const deck = objs.find((o) => o.z === 1)!;
    expect(bakedOpacityOf(deck)).toBe(0.35);
    expect(renderScene([deck], dims)).toContain('opacity:0.35');
  });

  it('murs : un panneau qui COUVRE la capsule du héros et se peint après elle reste OPAQUE (aucun voile de caméra)', () => {
    const s = emptyScene(3, 3);
    s.walls = [{ x: 1, y: 1, side: 'N' }];
    const dims = DIMS(s);
    const objs = wallLayerObjs(buildWalls(s), dims, NO_OCCLUDE, 0, OPTS);
    expect(objs).toHaveLength(1);
    // Prémisse MESURÉE : le panneau recouvre bien la capsule d'un héros placé devant lui et se peint
    // après elle — c'est le cas qui produisait la « paroi de verre ». Il est désormais peint plein :
    // ce qui gêne la lecture d'un intérieur est RETIRÉ par masse (`cutawayForSection`), jamais voilé.
    const devant = { x: 0, y: 0, z: 0, h: 0 };
    const capsule = actorCapsuleOf(devant, dims);
    const panneau = projectOccluder({
      polygons: buildWalls(s)[0].faces.map((face) => face.poly.map((p) => ({ x: p.x, y: p.y, lift: metricToLift(p.h) }))),
    }, dims);
    expect(occludesActor(panneau, capsule)).toBe(true);
    expect(bakedOpacityOf(objs[0])).toBe(1);
    expect(renderScene(objs, dims)).toContain('opacity:1');
  });

  it('toits : une nappe rendue est TOUJOURS opaque — son retrait se décide par MASSE, en amont du rendu', () => {
    const s = roofScene();
    const dims = DIMS(s);
    const objs = roofLayerObjs([buildRoofs(s)[0]], dims, OPTS);
    expect(objs[0].h).toBeUndefined();
    expect(bakedOpacityOf(objs[0])).toBe(1);
    expect(roofOpacity(renderScene(objs, dims))).toBe(1);
  });

  it('garde opaques les panneaux sans géométrie occlusive locale', () => {
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
      />,
    );
    const tag = (id: string) => html.match(new RegExp(`<[^>]+data-id="${id}"[^>]*>`))?.[0] ?? '';

    expect(tag('wall-near')).not.toContain('opacity');
    expect(tag('wall-outside')).not.toContain('opacity');
    expect(tag('roof-near')).not.toContain('opacity');
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
    expect(roomOpacityOf(obj({ kind: 'roof', roofCell: { x: 2, y: 2, z: 1 }, roofSpan: { w: 1, h: 1 }, z: 1 }), focus, dims())).toBe(1);
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
    }), focus, dims())).toBe(1);
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

  it('propage les relations architecturales sans chemin de toiture historique', () => {
    const scene = emptyScene(6, 6);
    scene.effectZones = [{ id: 'salle', label: 'Salle', presentation: 'interior', area: { kind: 'rect', x: 2, y: 2, w: 1, h: 1 }, z: 0 }];
    scene.entities.push({ id: 'dehors', kind: 'prop', pos: { x: 4, y: 4 }, ref: 'tonneau' });
    scene.walls = [{ x: 2, y: 2, side: 'N' }];
    scene.architecture = [{
      id: 'corps', style: 'maison', storeys: [],
      facades: [{ id: 'facade', z: 0, edges: [{ x: 2, y: 2, side: 'N' }], appearance: 'mur-a-ossature-en-bois', roomZoneIds: ['salle'] }],
      masses: [{ id: 'toit', z: 0, footprint: [{ x: 2, y: 2, w: 1, h: 1 }], levels: 1, profile: 'flat', pitchDeg: 30, material: 'tuile' }],
    }];
    const d = DIMS(scene);
    const focus: RoomFocus = { id: 'salle', z: 0, tiles: new Set(['2,2,0']) };
    const floors = floorLayerObjs(buildFloors(scene), scene, d, NEUTRAL_CTX, 0, OPTS);
    const props = propLayerObjs(buildProps(scene), { dims: d, view: 'iso', liftAt: () => 0 });
    const walls = wallLayerObjs(buildWalls(scene), d, NO_OCCLUDE, 0, OPTS);
    const roofs = roofLayerObjs(buildRoofs(scene), d, OPTS);

    expect(roomOpacityOf(floors.find((o) => o.x === 4 && o.y === 4)!, focus, d)).toBe(0);
    expect(roomOpacityOf(props.find((o) => o.x === 4 && o.y === 4)!, focus, d)).toBe(0);
    expect(roomOpacityOf(walls[0], focus, d)).toBe(1);
    expect(roomOpacityOf(roofs.find((o) => o.roofCell?.x === 2)!, focus, d)).toBe(1);
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

describe('CulledScene — occlusion locale et SVG paresseux', () => {
  const dims: Dims = { w: 20, h: 20, rot: 0, view: 'iso' };
  const view = {
    dims,
    cam: { x: 0, y: 0 },
    zoom: 1,
    activeZ: 0,
    fog: { explored: new Set<string>() },
  };
  const panelAt = (x: number, y: number) => projectOccluder({
    polygons: [[
      { x: x - 0.5, y: y - 0.5, lift: 0 },
      { x: x + 0.5, y: y - 0.5, lift: 0 },
      { x: x + 0.5, y: y - 0.5, lift: 1 },
      { x: x - 0.5, y: y - 0.5, lift: 1 },
    ]],
  }, dims);

  it('l’opacité rendue est celle BAKÉE par la couche : jamais de palier intermédiaire décidé au rendu', () => {
    const wall: StageObj = { d: 0, x: 0, y: 0, z: 0, el: <g /> };
    const roof: StageObj = { d: 0, roofCell: { x: 0, y: 0, z: 0 }, el: <g /> };
    const ghost: StageObj = { d: 0, x: 0, y: 0, z: 1, h: 4, ghost: true, op: 0.35, el: <g /> };
    expect(bakedOpacityOf(wall)).toBe(1);
    expect(bakedOpacityOf(roof)).toBe(1);
    expect(bakedOpacityOf(ghost)).toBe(0.35);
  });

  it('matérialise le SVG lazy d’un toit à l’écran, et le peint PLEIN', () => {
    const scene = emptyScene(20, 20);
    scene.architecture = [{
      id: 'corps', style: 'maison', storeys: [], facades: [],
      masses: [{
        id: 'toit', z: 0, footprint: [{ x: 5, y: 5, w: 2, h: 2 }], levels: 1,
        profile: 'flat', pitchDeg: 30,
        material: 'tuile',
      }],
    }];
    const built = buildRoofs(scene)[0];
    const roof = roofLayerObjs([built], dims, OPTS, true)[0];
    const svg = vi.fn(roof.svg!);
    roof.svg = svg;

    const html = renderToStaticMarkup(<CulledScene objs={[roof]} {...view} />);

    expect(svg).toHaveBeenCalledTimes(1);
    expect(html).toContain('<path');
    expect(html).toContain('opacity="1"');
  });

  it('ancre la capsule au relief métrique réel, jamais à l’index z', () => {
    const scene = emptyScene(2, 2);
    scene.layers.push({ z: 1, tiles: new Array(4).fill('planches'), height: [6, 0, 0, 0] });
    const actor = { x: 0, y: 0, z: 1, h: heightAt(scene, 0, 0, 1) };
    const lift = metricToLift(6);
    const capsule = actorCapsuleOf(actor, dims);
    const foot = projectOccluder({
      polygons: [[{ x: 0, y: 0, lift }, { x: 0, y: 0, lift }]],
    }, dims).polygons[0].points[0];

    expect(actor.h).toBe(6);
    expect(capsule.vertical).toEqual([lift, lift + 1]);
    expect(capsule.segment[0]).toEqual(foot);
    expect(capsule.depth).toBeGreaterThan(0);
  });

  it('n’atténue AUCUN panneau, occultant ou non : plus une seule opacité décidée à la caméra', () => {
    const objects: StageObj[] = [
      {
        d: 1,
        x: 6,
        y: 6,
        z: 0,
        kind: 'wall',
        bounds: panelAt(6, 6).bounds,
        el: <path key="occluding" data-id="occluding" />,
      },
      {
        d: 2,
        x: 8,
        y: 6,
        z: 0,
        kind: 'wall',
        bounds: panelAt(8, 6).bounds,
        el: <path key="sibling" data-id="sibling" />,
      },
    ];
    // Prémisse MESURÉE : le premier panneau occulte bien la capsule d'un héros en (5,5) — c'est
    // exactement ce panneau qui devenait vitreux.
    expect(occludesActor(panelAt(6, 6), actorCapsuleOf({ x: 5, y: 5, h: 0 }, dims))).toBe(true);
    const html = renderToStaticMarkup(<CulledScene objs={objects} {...view} />);
    const tag = (id: string) => html.match(new RegExp(`<[^>]+data-id="${id}"[^>]*>`))?.[0] ?? '';
    expect(tag('occluding')).not.toContain('opacity');
    expect(tag('sibling')).not.toContain('opacity');
  });

  it('n’appelle jamais le thunk SVG hors champ et l’appelle une fois à l’écran', () => {
    const offscreenSvg = vi.fn(() => '<path data-id="offscreen-main"/>');
    const onscreenSvg = vi.fn(() => '<path data-id="onscreen-main"/>');
    const offscreenAcc = vi.fn(() => '<path data-id="offscreen-accent"/>');
    const onscreenAcc = vi.fn(() => '<path data-id="onscreen-accent"/>');
    const objects: StageObj[] = [
      {
        d: 0,
        bounds: { left: 4000, right: 4100, top: 4000, bottom: 4100 },
        svg: offscreenSvg,
        acc: offscreenAcc,
        el: <g key="offscreen" />,
      },
      {
        d: 1,
        bounds: { left: 100, right: 120, top: 100, bottom: 120 },
        svg: onscreenSvg,
        acc: onscreenAcc,
        el: <g key="onscreen" />,
      },
    ];
    renderToStaticMarkup(<CulledScene objs={objects} {...view} />);
    expect(offscreenSvg).not.toHaveBeenCalled();
    expect(onscreenSvg).toHaveBeenCalledTimes(1);
    expect(offscreenAcc).not.toHaveBeenCalled();
    expect(onscreenAcc).toHaveBeenCalledTimes(1);
  });

  it('garde une silhouette légère sous brouillard inconnu sans matérialiser les détails lazy', () => {
    const unknownSvg = vi.fn(() => '<path data-id="unknown-main"/>');
    const unknownAcc = vi.fn(() => '<path data-id="unknown-accent"/>');
    const visibleSvg = vi.fn(() => '<path data-id="visible-main"/>');
    const visibleAcc = vi.fn(() => '<path data-id="visible-accent"/>');
    const exploredSvg = vi.fn(() => '<path data-id="explored-main"/>');
    const exploredAcc = vi.fn(() => '<path data-id="explored-accent"/>');
    const objects: StageObj[] = [
      {
        d: 0,
        x: 5,
        y: 5,
        z: 0,
        svg: unknownSvg,
        acc: unknownAcc,
        el: <g key="unknown" data-id="unknown-silhouette" />,
      },
      {
        d: 1,
        x: 6,
        y: 5,
        z: 0,
        vis: true,
        svg: visibleSvg,
        acc: visibleAcc,
        el: <g key="visible" data-id="visible-silhouette" />,
      },
      {
        d: 2,
        x: 7,
        y: 5,
        z: 0,
        svg: exploredSvg,
        acc: exploredAcc,
        el: <g key="explored" data-id="explored-silhouette" />,
      },
    ];

    const html = renderToStaticMarkup(
      <CulledScene
        objs={objects}
        {...view}
        fog={{ explored: new Set(['7,5,0']) }}
      />,
    );

    expect(unknownSvg).not.toHaveBeenCalled();
    expect(unknownAcc).not.toHaveBeenCalled();
    expect(html).toContain('data-id="unknown-silhouette"');
    expect(html).not.toContain('data-id="unknown-main"');
    expect(html).not.toContain('data-id="unknown-accent"');
    expect(visibleSvg).toHaveBeenCalledTimes(1);
    expect(visibleAcc).toHaveBeenCalledTimes(1);
    expect(exploredSvg).toHaveBeenCalledTimes(1);
    expect(exploredAcc).toHaveBeenCalledTimes(1);
  });
});

describe('CulledScene — la boîte du jeton est calée sur le CORPS DESSINÉ (#907)', () => {
  const dims: Dims = { w: 20, h: 20, rot: 0, view: 'iso' };
  const radiusOf = () => actorCapsuleOf({ x: 5, y: 5, h: 0 }, dims).radius;

  /** Échelle de token d'un combattant (`combatantObjs`, tokens.tsx) : 0.62 × speciesScale ×
   *  sizeTokenScale. `speciesScale` vaut 1 pour toute espèce jouable — ni `perso.scale` sur la def de
   *  créature, ni `scale` sur la race (`raceAppearance.json`). */
  const tokenScale = (size: SizeCategory) => 0.62 * sizeTokenScale(size);

  /** Demi-largeur ÉCRAN de la silhouette RÉELLEMENT dessinée par le rig, sur le squelette de
   *  production (`groundedBodySkeleton`, composeRig.tsx) : FK de la pose de repos, extrémités de
   *  chaque os élargies de sa demi-épaisseur, écart maximal à l'axe du bassin — l'axe que `BodyToken`
   *  aligne sur le centre de la tuile. */
  const drawnHalfWidth = (g: GabaritDef, sex: 'M' | 'F', build: number, scale: number) => {
    const sk = groundSkeleton(applyBuild(baseSkeleton(g, sex), build));
    const world = worldTransforms(sk, {});
    let half = 0;
    for (const id of BONE_IDS) {
      const bone = sk[id];
      if (bone.thickness === 0 && bone.length === 0) continue;
      const t = bone.thickness / 2;
      for (const along of [0, bone.length])
        for (const across of [-t, t])
          half = Math.max(half, Math.abs(apply(world[id], { x: across, y: along }).x - sk.bassin.pivot.x));
    }
    return half * scale;
  };

  /** Carrures qu'un HÉROS présente à la capsule (elle ne sert que les héros et le meneur du groupe —
   *  `IsoStage`), de Taille Moyenne ou moindre. La Taille vient du talent d'espèce (`species.json` :
   *  `petit` → Petite, `talents.json`). */
  const HERO_RIGS: { race: string; size: SizeCategory }[] = [
    { race: 'Humain', size: 'moyenne' },
    { race: 'Nain', size: 'moyenne' },
    { race: 'Haut-Elfe', size: 'moyenne' },
    { race: 'Elfe sylvain', size: 'moyenne' },
    { race: 'Halfling', size: 'petite' },
    { race: 'Gnome', size: 'petite' },
  ];
  /** Gabarit résolu comme en production : celui de la race, surchargé par son `gabaritOverride`. */
  const gabaritOf = (raceId: string): GabaritDef => {
    const r = raceById(raceId);
    return { ...gabaritById(r.gabarit), ...(r.gabaritOverride ?? {}) };
  };
  const SEXES = ['M', 'F'] as const;
  const BUILDS = [0, 0.5, 1]; // `Appearance.build` est libre sur [0,1] — la carrure MAXIMALE compte

  const widestHeroBody = () => Math.max(...HERO_RIGS.flatMap(({ race, size }) =>
    SEXES.flatMap((sex) => BUILDS.map((b) => drawnHalfWidth(gabaritOf(race), sex, b, tokenScale(size))))));

  it('couvre le corps dessiné de CHAQUE carrure de héros, jusqu’à la carrure maximale', () => {
    const radius = radiusOf();
    for (const { race, size } of HERO_RIGS)
      for (const sex of SEXES)
        for (const build of BUILDS)
          expect(radius, `${race} ${sex} build=${build}`)
            .toBeGreaterThanOrEqual(drawnHalfWidth(gabaritOf(race), sex, build, tokenScale(size)));
  });

  it('sans doubler ce corps : la capsule n’est pas une colonne de verre', () => {
    expect(radiusOf()).toBeLessThan(widestHeroBody() * 1.3);
  });
});

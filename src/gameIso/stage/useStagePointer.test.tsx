// @vitest-environment jsdom
import { act, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { screenToTileAtZ, tileCenter, type Dims } from '../../geometry/iso';
import { emptyScene, isWalkable, setDoorOpen } from '../../state/scene';
import { metricToLift } from '../../state/relief';
import { walkNeighbors } from '../../state/path';
import { resolveCursorZ } from '../../state/combatCursor';
import { useGame } from '../../state/store';
import { bus, EVT } from '../../state/bus';
import { STEP_MS } from '../../geometry/walk';
import type { Combatant } from '../../engine/types';
import type { RoomPortal } from '../../state/roomPortals';
import { VH, VW } from './useStageCamera';
import { useStagePointer, type StagePointer } from './useStagePointer';
import { SENSIBILITE_DRAG_DEG_PX, getStageYaw, poserYaw, resetStageYaw } from '../../state/stageYaw';
import { getStagePan, resetStagePan } from '../../state/stagePan';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Object.defineProperty(window, 'matchMedia', {
  configurable: true,
  value: vi.fn().mockReturnValue({ matches: true }),
});

const dims: Dims = { w: 8, h: 8, rot: 0, view: 'iso' };

/** Élément de stage MESURÉ : sa surface vaut exactement le viewBox (VW×VH) posé au coin (0,0) — le
 *  recouvrement `slice` y vaut donc 1, et un pixel client EST un point de viewBox. C'est le contrat
 *  que le picking inverse (`viewBoxPointAt` puis `stagePointAt`, `stage/stageCam.ts`) : une géométrie
 *  d'élément, jamais un CTM de SVG — la voie volumique peint sur un canevas, qui n'en a pas. */
function stageEl(): SVGSVGElement {
  return {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: VW, height: VH }) as DOMRect,
    setPointerCapture: () => undefined,
    releasePointerCapture: () => undefined,
  } as unknown as SVGSVGElement;
}

const portal: RoomPortal = {
  id: '0:2,2:N:room-a:room-b',
  z: 0,
  edge: { x: 2, y: 2, side: 'N' },
  fromZoneId: 'room-a',
  toZoneId: 'room-b',
  kind: 'passage',
  exterior: false,
  from: { x: 2, y: 1 },
  to: { x: 2, y: 2 },
};
const closedExteriorPortal: RoomPortal = {
  id: '0:0,1:E:exterior:room-a',
  z: 0,
  edge: { x: 0, y: 1, side: 'E' },
  fromZoneId: null,
  toZoneId: 'room-a',
  kind: 'door-closed',
  exterior: true,
  from: { x: 0, y: 1 },
  to: { x: 1, y: 1 },
};

function pointerEvent(x: number, y: number) {
  return {
    button: 0,
    clientX: x,
    clientY: y,
    pointerId: 1,
    currentTarget: { style: {} },
  } as unknown as React.PointerEvent;
}

// Ce banc remplace l'ACTION `moveParty` du store par une sonde. Le store est partagé par toute la
// suite (`isolate: false`) : une action laissée stubbée fait tourner à vide le pas d'un fichier
// voisin, qui mesure alors un monde qui ne bouge plus.
const MOVE_PARTY_VRAI = useGame.getState().moveParty;
afterEach(() => useGame.setState({ moveParty: MOVE_PARTY_VRAI }));

describe('useStagePointer — picking exploration', () => {
  let root: Root | null = null;
  const unsubs: (() => void)[] = [];

  afterEach(() => {
    for (const unsub of unsubs.splice(0)) unsub();
    if (root) {
      act(() => root!.unmount());
      root = null;
    }
    vi.useRealTimers();
    vi.mocked(window.matchMedia).mockReturnValue({ matches: true } as unknown as MediaQueryList);
  });

  it('préfère la surface marchable de activeZ à une couche supérieure superposée', () => {
    vi.useFakeTimers();
    const scene = emptyScene(8, 8);
    const upper = new Array(64).fill('vide');
    upper[5 + 5 * 8] = 'herbe';
    scene.layers.push({ z: 1, tiles: upper });
    const moveParty = vi.fn();
    useGame.setState({
      scene,
      mode: 'exploration',
      partyPos: { x: 2, y: 1 },
      party: [],
      dialogue: null,
      moveParty,
    });

    let pointer: StagePointer | undefined;
    const Probe = () => {
      const svgRef = useRef(stageEl());
      const camRef = useRef({ x: 0, y: 0 });
      pointer = useStagePointer({
        svgRef,
        scene,
        dims,
        zoom: 1,
        camRef,
        hoverTracking: false,
        partyLeader: undefined,
        activeZ: 0,
      });
      return null;
    };
    renderToStaticMarkup(<Probe />);

    const center = tileCenter(2, 2, dims);
    expect(screenToTileAtZ(center.cx, center.cy, dims, 1)).toEqual({ x: 5, y: 5 });
    expect(isWalkable(scene, 5, 5, 1)).toBe(true);
    expect(resolveCursorZ(scene, 5, 5)).toBe(1);
    const event = pointerEvent(center.cx, center.cy);
    pointer!.handlers.onPointerDown(event);
    pointer!.handlers.onPointerUp(event);
    vi.runAllTimers();

    expect(moveParty).toHaveBeenLastCalledWith({ x: 2, y: 2 });
  });

  it('efface le hover au clic exploration accepté et ne le recrée qu’au prochain pointer move', () => {
    vi.useFakeTimers();
    const scene = emptyScene(8, 8);
    useGame.setState({
      scene,
      mode: 'exploration',
      partyPos: { x: 2, y: 1 },
      party: [],
      dialogue: null,
      moveParty: vi.fn(),
    });

    let pointer: StagePointer | undefined;
    const Probe = () => {
      const svgRef = useRef(stageEl());
      const camRef = useRef({ x: 0, y: 0 });
      pointer = useStagePointer({
        svgRef,
        scene,
        dims,
        zoom: 1,
        camRef,
        hoverTracking: false,
        partyLeader: undefined,
        activeZ: 0,
      });
      return null;
    };

    const container = document.createElement('div');
    root = createRoot(container);
    act(() => root!.render(<Probe />));
    const center = tileCenter(2, 2, dims);
    const event = pointerEvent(center.cx, center.cy);

    act(() => pointer!.handlers.onPointerMove(event));
    expect(pointer!.hover).toEqual({ x: 2, y: 2 });

    act(() => {
      pointer!.handlers.onPointerDown(event);
      pointer!.handlers.onPointerUp(event);
    });
    expect(pointer!.hover).toBeNull();

    act(() => vi.runAllTimers());
    expect(pointer!.hover).toBeNull();

    act(() => pointer!.handlers.onPointerMove(event));
    expect(pointer!.hover).toEqual({ x: 2, y: 2 });
  });

  it('n’anime aucun pas au-delà de la position logique quand un dialogue interrompt la marche', () => {
    vi.useFakeTimers();
    const scene = emptyScene(8, 8);
    const moveParty = vi.fn((pos: { x: number; y: number; z?: number }) => {
      useGame.setState({
        partyPos: pos,
        dialogue: {} as NonNullable<ReturnType<typeof useGame.getState>['dialogue']>,
      });
    });
    useGame.setState({
      scene,
      mode: 'exploration',
      partyPos: { x: 2, y: 1 },
      party: [],
      dialogue: null,
      moveParty,
    });
    const emitted: { id: string; path: { x: number; y: number }[] }[] = [];
    unsubs.push(bus.on(EVT.ANIM_MOVE, (payload) => emitted.push(payload)));

    let pointer: StagePointer | undefined;
    const Probe = () => {
      const svgRef = useRef(stageEl());
      const camRef = useRef({ x: 0, y: 0 });
      pointer = useStagePointer({
        svgRef,
        scene,
        dims,
        zoom: 1,
        camRef,
        hoverTracking: false,
        partyLeader: { id: 'hero' } as Combatant,
        activeZ: 0,
      });
      return null;
    };
    renderToStaticMarkup(<Probe />);

    const center = tileCenter(2, 4, dims);
    const event = pointerEvent(center.cx, center.cy);
    pointer!.handlers.onPointerDown(event);
    pointer!.handlers.onPointerUp(event);
    vi.advanceTimersByTime(STEP_MS * 4);

    expect(moveParty).toHaveBeenCalledTimes(1);
    expect(useGame.getState().partyPos).toEqual({ x: 2, y: 2 });
    expect(emitted).toEqual([{ id: 'hero', path: [{ x: 2, y: 1 }, { x: 2, y: 2 }] }]);
  });

  it('arrête la marche avant toute nouvelle émission si la scène active est remplacée', () => {
    vi.useFakeTimers();
    const scene = emptyScene(8, 8);
    const replacement = emptyScene(8, 8);
    replacement.id = 'replacement';
    const moveParty = vi.fn((pos: { x: number; y: number; z?: number }) => {
      useGame.setState({ scene: replacement, partyPos: pos, mode: 'exploration', dialogue: null });
    });
    useGame.setState({
      scene,
      mode: 'exploration',
      partyPos: { x: 2, y: 1 },
      party: [],
      dialogue: null,
      moveParty,
    });
    const emitted: { id: string; path: { x: number; y: number }[] }[] = [];
    unsubs.push(bus.on(EVT.ANIM_MOVE, (payload) => emitted.push(payload)));

    let pointer: StagePointer | undefined;
    const Probe = () => {
      const svgRef = useRef(stageEl());
      const camRef = useRef({ x: 0, y: 0 });
      pointer = useStagePointer({
        svgRef,
        scene,
        dims,
        zoom: 1,
        camRef,
        hoverTracking: false,
        partyLeader: { id: 'hero' } as Combatant,
        activeZ: 0,
      });
      return null;
    };
    renderToStaticMarkup(<Probe />);

    const center = tileCenter(2, 4, dims);
    const event = pointerEvent(center.cx, center.cy);
    pointer!.handlers.onPointerDown(event);
    pointer!.handlers.onPointerUp(event);
    vi.advanceTimersByTime(STEP_MS * 4);

    expect(useGame.getState().scene).toBe(replacement);
    expect(moveParty).toHaveBeenCalledTimes(1);
    expect(emitted).toEqual([{ id: 'hero', path: [{ x: 2, y: 1 }, { x: 2, y: 2 }] }]);
  });

  it('anime un trajet complet par émissions contiguës cadencées et atteint la destination', () => {
    vi.useFakeTimers();
    const scene = emptyScene(8, 8);
    const moveParty = vi.fn((pos: { x: number; y: number; z?: number }) => useGame.setState({ partyPos: pos }));
    useGame.setState({
      scene,
      mode: 'exploration',
      partyPos: { x: 2, y: 1 },
      party: [],
      dialogue: null,
      moveParty,
    });
    const emitted: { id: string; path: { x: number; y: number }[] }[] = [];
    unsubs.push(bus.on(EVT.ANIM_MOVE, (payload) => emitted.push(payload)));

    let pointer: StagePointer | undefined;
    const Probe = () => {
      const svgRef = useRef(stageEl());
      const camRef = useRef({ x: 0, y: 0 });
      pointer = useStagePointer({
        svgRef,
        scene,
        dims,
        zoom: 1,
        camRef,
        hoverTracking: false,
        partyLeader: { id: 'hero' } as Combatant,
        activeZ: 0,
      });
      return null;
    };
    renderToStaticMarkup(<Probe />);

    const center = tileCenter(2, 4, dims);
    const event = pointerEvent(center.cx, center.cy);
    pointer!.handlers.onPointerDown(event);
    pointer!.handlers.onPointerUp(event);

    expect(emitted).toEqual([{ id: 'hero', path: [{ x: 2, y: 1 }, { x: 2, y: 2 }] }]);
    vi.advanceTimersByTime(STEP_MS);
    expect(emitted[emitted.length - 1]?.path).toEqual([{ x: 2, y: 2 }, { x: 2, y: 3 }]);
    vi.advanceTimersByTime(STEP_MS);
    expect(emitted[emitted.length - 1]?.path).toEqual([{ x: 2, y: 3 }, { x: 2, y: 4 }]);
    vi.runAllTimers();

    expect(emitted).toHaveLength(3);
    expect(moveParty).toHaveBeenCalledTimes(3);
    expect(useGame.getState().partyPos).toEqual({ x: 2, y: 4 });
  });

  it('continue sans rollback après un remplacement immutable de la même scène', () => {
    vi.useFakeTimers();
    const scene = emptyScene(8, 8);
    const positions: { x: number; y: number; z?: number }[] = [];
    const moveParty = vi.fn((pos: { x: number; y: number; z?: number }) => {
      positions.push(pos);
      useGame.setState((state) => ({
        partyPos: pos,
        scene: { ...state.scene!, flags: { ...state.scene!.flags, revealed: true } },
      }));
    });
    useGame.setState({
      scene,
      mode: 'exploration',
      partyPos: { x: 2, y: 1 },
      party: [],
      dialogue: null,
      moveParty,
    });

    let pointer: StagePointer | undefined;
    const Probe = () => {
      const svgRef = useRef(null);
      const camRef = useRef({ x: 0, y: 0 });
      pointer = useStagePointer({
        svgRef,
        scene,
        dims,
        zoom: 1,
        camRef,
        hoverTracking: false,
        partyLeader: undefined,
        activeZ: 0,
      });
      return null;
    };
    renderToStaticMarkup(<Probe />);

    pointer!.portalHandlers.onPortalClick({ ...portal, to: { x: 2, y: 4 } });
    vi.runAllTimers();

    expect(positions).toEqual([{ x: 2, y: 2 }, { x: 2, y: 3 }, { x: 2, y: 4 }]);
    expect(positions.filter((position) => position.y === 4)).toHaveLength(1);
  });

  it('s’arrête avant un seuil refermé entre deux pas sans restaurer une ancienne position', () => {
    vi.useFakeTimers();
    const scene = emptyScene(8, 8);
    scene.walls = [{ x: 2, y: 3, side: 'N', door: true }];
    const positions: { x: number; y: number; z?: number }[] = [];
    const moveParty = vi.fn((pos: { x: number; y: number; z?: number }) => {
      positions.push(pos);
      useGame.setState((state) => ({
        partyPos: pos,
        scene: positions.length === 1
          ? setDoorOpen(state.scene!, 2, 3, 'N', 0, false)
          : state.scene,
      }));
    });
    useGame.setState({
      scene,
      mode: 'exploration',
      partyPos: { x: 2, y: 1 },
      party: [],
      dialogue: null,
      moveParty,
    });

    let pointer: StagePointer | undefined;
    const Probe = () => {
      const svgRef = useRef(null);
      const camRef = useRef({ x: 0, y: 0 });
      pointer = useStagePointer({
        svgRef,
        scene,
        dims,
        zoom: 1,
        camRef,
        hoverTracking: false,
        partyLeader: undefined,
        activeZ: 0,
      });
      return null;
    };
    renderToStaticMarkup(<Probe />);

    pointer!.portalHandlers.onPortalClick({ ...portal, to: { x: 2, y: 4 } });
    vi.runAllTimers();

    expect(positions).toEqual([{ x: 2, y: 2 }]);
    expect(useGame.getState().partyPos).toEqual({ x: 2, y: 2 });
  });

  it('réutilise la confirmation tactile : premier tap aperçu, second tap déplacement exact du portail', () => {
    vi.useFakeTimers();
    vi.mocked(window.matchMedia).mockReturnValue({ matches: false } as unknown as MediaQueryList);
    const scene = emptyScene(8, 8);
    const positions: { x: number; y: number; z?: number }[] = [];
    useGame.setState({
      scene,
      mode: 'exploration',
      partyPos: { x: 2, y: 1 },
      party: [],
      dialogue: null,
      moveParty: (pos) => {
        positions.push(pos);
        useGame.setState({ partyPos: pos });
      },
    });

    let pointer: StagePointer | undefined;
    const Probe = () => {
      const svgRef = useRef<SVGSVGElement>(null);
      const camRef = useRef({ x: 0, y: 0 });
      pointer = useStagePointer({
        svgRef,
        scene,
        dims,
        zoom: 1,
        camRef,
        hoverTracking: false,
        partyLeader: undefined,
        activeZ: 0,
      });
      return null;
    };
    const container = document.createElement('div');
    root = createRoot(container);
    act(() => root!.render(<Probe />));

    act(() => pointer!.portalHandlers.onPortalClick(portal));
    expect(positions).toEqual([]);
    expect(pointer!.hoveredPortal).toEqual(portal);

    act(() => pointer!.portalHandlers.onPortalClick(portal));
    act(() => vi.runAllTimers());

    expect(positions).toEqual([{ x: 2, y: 2 }]);
  });

  it('ouvre une porte extérieure fermée sans marcher puis emprunte le seuil au clic suivant', () => {
    vi.useFakeTimers();
    const scene = emptyScene(4, 3);
    scene.effectZones = [{
      id: 'room-a',
      label: 'Pièce A',
      presentation: 'interior',
      area: { kind: 'rect', x: 1, y: 1, w: 1, h: 1 },
    }];
    scene.walls = [{ x: 0, y: 1, side: 'E', door: true, closed: true }];
    const positions: { x: number; y: number; z?: number }[] = [];
    useGame.setState({
      scene,
      mode: 'exploration',
      partyPos: { x: 0, y: 1 },
      party: [],
      dialogue: null,
      moveParty: (pos) => {
        positions.push(pos);
        useGame.setState({ partyPos: pos });
      },
    });

    let pointer: StagePointer | undefined;
    const Probe = () => {
      const svgRef = useRef<SVGSVGElement>(null);
      const camRef = useRef({ x: 0, y: 0 });
      pointer = useStagePointer({
        svgRef,
        scene,
        dims,
        zoom: 1,
        camRef,
        hoverTracking: false,
        partyLeader: undefined,
        activeZ: 0,
      });
      return null;
    };
    renderToStaticMarkup(<Probe />);

    pointer!.portalHandlers.onPortalClick(closedExteriorPortal);
    vi.runAllTimers();
    expect(positions).toEqual([]);

    pointer!.portalHandlers.onPortalClick({ ...closedExteriorPortal, kind: 'door-open' });
    vi.runAllTimers();
    expect(positions).toEqual([{ x: 1, y: 1 }]);
  });

  it('anime un saut comme un unique segment engagé entre le départ et l’atterrissage', () => {
    vi.useFakeTimers();
    const scene = emptyScene(8, 8);
    scene.layers[0].tiles.fill('vide');
    scene.layers[0].tiles[1 + 1 * 8] = 'herbe';
    scene.layers[0].tiles[3 + 1 * 8] = 'herbe';
    const hero = {
      id: 'hero',
      label: 'Héros',
      kind: 'hero',
      characteristics: {
        'capacite-de-combat': 30,
        'capacite-de-tir': 30,
        force: 30,
        endurance: 30,
        initiative: 30,
        agilite: 30,
        dexterite: 30,
        intelligence: 30,
        'force-mentale': 30,
        sociabilite: 30,
      },
      wounds: { current: 10, max: 10 },
      advantage: 0,
      conditions: [],
      weapons: [],
      armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
      items: [],
      skills: [],
      talents: [],
      movement: 12,
    } as Combatant;
    const moveParty = vi.fn((pos: { x: number; y: number; z?: number }) => useGame.setState({ partyPos: pos }));
    useGame.setState({
      scene,
      mode: 'exploration',
      partyPos: { x: 1, y: 1 },
      party: [hero],
      dialogue: null,
      moveParty,
    });
    const emitted: { id: string; path: { x: number; y: number }[] }[] = [];
    unsubs.push(bus.on(EVT.ANIM_MOVE, (payload) => emitted.push(payload)));

    let pointer: StagePointer | undefined;
    const Probe = () => {
      const svgRef = useRef(stageEl());
      const camRef = useRef({ x: 0, y: 0 });
      pointer = useStagePointer({
        svgRef,
        scene,
        dims,
        zoom: 1,
        camRef,
        hoverTracking: false,
        partyLeader: hero,
        activeZ: 0,
      });
      return null;
    };
    renderToStaticMarkup(<Probe />);

    const center = tileCenter(3, 1, dims);
    const event = pointerEvent(center.cx, center.cy);
    pointer!.handlers.onPointerDown(event);
    pointer!.handlers.onPointerUp(event);

    expect(emitted).toEqual([{ id: 'hero', path: [{ x: 1, y: 1 }, { x: 3, y: 1 }] }]);
    expect(moveParty).toHaveBeenCalledOnce();
    expect(useGame.getState().partyPos).toEqual({ x: 3, y: 1 });
  });
});

/**
 * RELIEF ET ÉTAGES au pointeur — le clic doit atteindre ce que le rendu DESSINE.
 *
 * Deux vérités s'y rencontrent. (1) Une case en relief est dessinée SOULEVÉE de sa hauteur métrique
 * (`metricToLift(heightAt)`, la projection que le rendu et le curseur clavier `screenStepDot`
 * emploient) : l'inverser à plat désigne une AUTRE case. (2) Le franchissement vertical n'est plus un
 * escalier explicite mais un voisinage marchable auto-dérivé du relief (`walkNeighbors`) : le clavier
 * le franchit, la souris doit pouvoir aussi — sans que l'étage du dessus, hors de portée d'un pas, se
 * mette à voler le clic au sol qu'on foule.
 */
describe('useStagePointer — relief et franchissement d’étage à la souris', () => {
  const mountProbe = (scene: ReturnType<typeof emptyScene>, activeZ = 0) => {
    let pointer: StagePointer | undefined;
    const Probe = () => {
      const svgRef = useRef(stageEl());
      const camRef = useRef({ x: 0, y: 0 });
      pointer = useStagePointer({
        svgRef,
        scene,
        dims,
        zoom: 1,
        camRef,
        hoverTracking: false,
        partyLeader: undefined,
        activeZ,
      });
      return null;
    };
    renderToStaticMarkup(<Probe />);
    return pointer!;
  };

  const clickAt = (pointer: StagePointer, cx: number, cy: number) => {
    const event = pointerEvent(cx, cy);
    pointer.handlers.onPointerDown(event);
    pointer.handlers.onPointerUp(event);
    vi.runAllTimers();
  };

  it('vise une MARCHE au pixel où elle est dessinée, pas à son aplomb au sol', () => {
    vi.useFakeTimers();
    const scene = emptyScene(8, 8);
    scene.layers[0].height = new Array(64).fill(0);
    scene.layers[0].height![3 + 2 * 8] = 1; // marche d'1 m : rampe franchissable (STEP_MAX_M), rendue soulevée
    const moveParty = vi.fn();
    useGame.setState({ scene, mode: 'exploration', partyPos: { x: 2, y: 1 }, party: [], dialogue: null, moveParty });

    const marche = tileCenter(3, 2, dims, metricToLift(1));
    // Le piège : à plat, ce pixel désigne la case du GROUPE — le clic n'allait donc nulle part.
    expect(screenToTileAtZ(marche.cx, marche.cy, dims, 0)).toEqual({ x: 2, y: 1 });

    clickAt(mountProbe(scene), marche.cx, marche.cy);

    expect(moveParty).toHaveBeenLastCalledWith({ x: 3, y: 2 });
  });

  it('monte d’un étage en cliquant la surface voisine, comme le pas clavier la franchit', () => {
    vi.useFakeTimers();
    const scene = emptyScene(8, 8);
    scene.layers[0].height = new Array(64).fill(0);
    scene.layers[0].height![4 + 4 * 8] = 3; // haut de l'escalier : 3 m, à une marche du plancher de l'étage
    const upper = new Array(64).fill('vide');
    upper[5 + 4 * 8] = 'plancher';
    scene.layers.push({ z: 1, tiles: upper, height: new Array(64).fill(4) });
    const moveParty = vi.fn();
    useGame.setState({ scene, mode: 'exploration', partyPos: { x: 4, y: 4 }, party: [], dialogue: null, moveParty });

    const palier = tileCenter(5, 4, dims, metricToLift(4));
    // Le piège : à plat, le pixel du palier désigne une case du REZ, parfaitement marchable — c'est elle
    // que le clic servait, et l'étage restait inatteignable à la souris.
    const auSol = screenToTileAtZ(palier.cx, palier.cy, dims, 0);
    expect(auSol).toEqual({ x: 2, y: 1 });
    expect(isWalkable(scene, auSol.x, auSol.y, 0)).toBe(true);

    clickAt(mountProbe(scene), palier.cx, palier.cy);

    expect(moveParty).toHaveBeenLastCalledWith({ x: 5, y: 4, z: 1 });
  });

  it('laisse le sol qu’on foule au clic sous une surface d’étage HORS de portée d’un pas', () => {
    vi.useFakeTimers();
    const scene = emptyScene(8, 8);
    const upper = new Array(64).fill('vide');
    upper[6 + 6 * 8] = 'plancher';
    scene.layers.push({ z: 1, tiles: upper, height: new Array(64).fill(4) });
    const moveParty = vi.fn();
    useGame.setState({ scene, mode: 'exploration', partyPos: { x: 2, y: 3 }, party: [], dialogue: null, moveParty });

    const surplomb = tileCenter(6, 6, dims, metricToLift(4));
    const auSol = screenToTileAtZ(surplomb.cx, surplomb.cy, dims, 0);
    expect(auSol).toEqual({ x: 3, y: 3 });
    // 4 m au-dessus du sol : aucune rampe, donc aucun pas — ni clavier ni souris — ne l'atteint.
    expect(walkNeighbors(scene, { x: 2, y: 3 }).some((n) => (n.z ?? 0) === 1)).toBe(false);

    clickAt(mountProbe(scene), surplomb.cx, surplomb.cy);

    expect(moveParty).toHaveBeenLastCalledWith({ x: 3, y: 3 });
  });
});

/**
 * GLISSER-TOURNER au bouton MILIEU (#1176) — la 4e entrée du lacet libre. Le bouton principal marche
 * et panoramique, le droit ouvre l'attaque pertinente : la rotation à la souris n'avait plus que le
 * milieu, et elle doit suivre le pointeur AU DEGRÉ dit par `SENSIBILITE_DRAG_DEG_PX`.
 */
describe('useStagePointer — glisser-tourner au bouton MILIEU', () => {
  const monter = (scene: ReturnType<typeof emptyScene>) => {
    let pointer: StagePointer | undefined;
    const Probe = () => {
      const svgRef = useRef(stageEl());
      const camRef = useRef({ x: 0, y: 0 });
      pointer = useStagePointer({ svgRef, scene, dims, zoom: 1, camRef, hoverTracking: false, partyLeader: undefined, activeZ: 0 });
      return null;
    };
    renderToStaticMarkup(<Probe />);
    return pointer!;
  };

  /** Événement de pointeur au bouton `button` (le gabarit partagé du fichier est au principal). */
  const evBouton = (x: number, y: number, button: number) =>
    ({ ...pointerEvent(x, y), button, clientX: x, clientY: y, preventDefault: () => undefined }) as unknown as React.PointerEvent;

  afterEach(() => {
    // Lacet ET panoramique sont des modules VIVANTS partagés par la suite (`isolate: false`) : un geste
    // qui les laisse ailleurs qu'au repos décadre la vue des fichiers voisins.
    resetStageYaw();
    resetStagePan();
  });

  it('un glisser de N px au MILIEU pose le lacet à yaw0 + N × SENSIBILITE_DRAG_DEG_PX', () => {
    vi.stubGlobal('requestAnimationFrame', undefined);
    const scene = emptyScene(8, 8);
    useGame.setState({ scene, mode: 'exploration', partyPos: { x: 2, y: 1 }, party: [], dialogue: null });
    resetStageYaw();
    poserYaw(30); // on part d'un angle QUELCONQUE : le glisser est relatif à l'angle du début de geste
    const pointer = monter(scene);

    pointer.handlers.onPointerDown(evBouton(100, 100, 1));
    act(() => pointer.handlers.onPointerMove(evBouton(220, 100, 1)));

    expect(getStageYaw()).toBeCloseTo(30 + 120 * SENSIBILITE_DRAG_DEG_PX, 9);

    // Le geste reste ABSOLU : un retour en arrière ramène l'angle, il ne s'additionne pas.
    act(() => pointer.handlers.onPointerMove(evBouton(40, 100, 1)));
    expect(getStageYaw()).toBeCloseTo(30 - 60 * SENSIBILITE_DRAG_DEG_PX, 9);
    vi.unstubAllGlobals();
  });

  it('le bouton PRINCIPAL panoramique HORS du store, qui ne reçoit son commit qu’au relâchement', () => {
    vi.stubGlobal('requestAnimationFrame', undefined);
    const scene = emptyScene(8, 8);
    useGame.setState({ scene, mode: 'exploration', partyPos: { x: 2, y: 1 }, party: [], dialogue: null, camPan: { x: 0, y: 0 } });
    resetStageYaw();
    resetStagePan();
    const pointer = monter(scene);

    pointer.handlers.onPointerDown(evBouton(100, 100, 0));
    act(() => pointer.handlers.onPointerMove(evBouton(220, 100, 0)));

    expect(getStageYaw()).toBe(0);
    expect(getStagePan().x).not.toBe(0); // c'est bien un PANORAMIQUE qui a eu lieu…
    expect(useGame.getState().camPan).toEqual({ x: 0, y: 0 }); // …et le store n'en a rien su

    // Relâchement : UN commit, sur la valeur que la vue montre déjà.
    act(() => pointer.handlers.onPointerUp(evBouton(220, 100, 0)));
    expect(useGame.getState().camPan.x).toBeCloseTo(getStagePan().x, 9);
    expect(useGame.getState().camPan.x).not.toBe(0);
    vi.unstubAllGlobals();
  });
});

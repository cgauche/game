// @vitest-environment jsdom
import { act, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { screenToTileAtZ, tileCenter, type Dims } from '../../geometry/iso';
import { emptyScene, isWalkable } from '../../state/scene';
import { resolveCursorZ } from '../../state/combatCursor';
import { useGame } from '../../state/store';
import { bus, EVT } from '../../state/bus';
import { STEP_MS } from '../../geometry/walk';
import type { Combatant } from '../../engine/types';
import { useStagePointer, type StagePointer } from './useStagePointer';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const dims: Dims = { w: 8, h: 8, rot: 0, view: 'iso' };

function pointerEvent(x: number, y: number) {
  return {
    button: 0,
    clientX: x,
    clientY: y,
    pointerId: 1,
    currentTarget: { style: {} },
  } as unknown as React.PointerEvent;
}

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
      const svgRef = useRef({
        createSVGPoint: () => ({
          x: 0,
          y: 0,
          matrixTransform() {
            return { x: this.x, y: this.y };
          },
        }),
        getScreenCTM: () => ({ inverse: () => ({}) }),
        setPointerCapture: () => undefined,
        releasePointerCapture: () => undefined,
      } as unknown as SVGSVGElement);
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
      const svgRef = useRef({
        createSVGPoint: () => ({
          x: 0,
          y: 0,
          matrixTransform() {
            return { x: this.x, y: this.y };
          },
        }),
        getScreenCTM: () => ({ inverse: () => ({}) }),
        setPointerCapture: () => undefined,
        releasePointerCapture: () => undefined,
      } as unknown as SVGSVGElement);
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
      const svgRef = useRef({
        createSVGPoint: () => ({
          x: 0,
          y: 0,
          matrixTransform() {
            return { x: this.x, y: this.y };
          },
        }),
        getScreenCTM: () => ({ inverse: () => ({}) }),
        setPointerCapture: () => undefined,
        releasePointerCapture: () => undefined,
      } as unknown as SVGSVGElement);
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
      const svgRef = useRef({
        createSVGPoint: () => ({
          x: 0,
          y: 0,
          matrixTransform() {
            return { x: this.x, y: this.y };
          },
        }),
        getScreenCTM: () => ({ inverse: () => ({}) }),
        setPointerCapture: () => undefined,
        releasePointerCapture: () => undefined,
      } as unknown as SVGSVGElement);
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
      const svgRef = useRef({
        createSVGPoint: () => ({
          x: 0,
          y: 0,
          matrixTransform() {
            return { x: this.x, y: this.y };
          },
        }),
        getScreenCTM: () => ({ inverse: () => ({}) }),
        setPointerCapture: () => undefined,
        releasePointerCapture: () => undefined,
      } as unknown as SVGSVGElement);
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
      const svgRef = useRef({
        createSVGPoint: () => ({
          x: 0,
          y: 0,
          matrixTransform() {
            return { x: this.x, y: this.y };
          },
        }),
        getScreenCTM: () => ({ inverse: () => ({}) }),
        setPointerCapture: () => undefined,
        releasePointerCapture: () => undefined,
      } as unknown as SVGSVGElement);
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

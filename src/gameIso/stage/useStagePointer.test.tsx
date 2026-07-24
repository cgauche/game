// @vitest-environment jsdom
import { act, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { screenToTileAtZ, tileCenter, type Dims } from '../../geometry/iso';
import { emptyScene, isWalkable } from '../../state/scene';
import { resolveCursorZ } from '../../state/combatCursor';
import { useGame } from '../../state/store';
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

  afterEach(() => {
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
});

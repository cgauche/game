// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { EditorCanvas } from './EditorCanvas';
import { emptyScene } from '../../state/scene';
import { DEFAULT_LAYERS } from './editorState';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

/** Événement pointeur minimal — jsdom n'a pas `PointerEvent` complet ; un `MouseEvent` typé
 *  `pointerdown`/`pointermove`/`pointerup` porte les mêmes propriétés lues par les handlers
 *  (`clientX`/`clientY`/`button`), et React délègue par NOM d'événement (pas par constructeur). */
function pointerEvent(type: string, opts: { clientX?: number; clientY?: number; button?: number } = {}) {
  return new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: opts.clientX ?? 0,
    clientY: opts.clientY ?? 0,
    button: opts.button ?? 0,
  });
}

/** Props minimales requises par `EditorCanvas`, hors `scene`/`view` (fournies par le test). */
function baseProps() {
  return {
    setScene: () => {},
    setSceneNoHistory: () => {},
    pushSnapshot: () => {},
    tool: { mode: 'select' as const },
    brush: 1,
    terrainRect: false,
    encTarget: '',
    setEncTarget: () => {},
    encRef: '',
    layers: DEFAULT_LAYERS,
    sel: null,
    onSelect: () => {},
    onHover: () => {},
    currentLayer: 0,
    architectureMode: false,
    architectureBodyId: null,
    architectureZ: null,
    architectureAction: 'select' as const,
    onArchitectureActionComplete: () => {},
    traceLayer: null,
    lowerLayerOpacity: 0.22,
    traceCalibStep: 'idle' as const,
    onTraceCalibClick: () => {},
  };
}

describe('EditorCanvas — panoramique (clic-milieu / Espace + glisser)', () => {
  it(
    "un pointerMove dont le setView différé s'exécute APRÈS la remise à null du panRef (React 18 " +
      "peut rejouer l'updater APRÈS qu'un pointerUp natif ait déjà tourné) ne doit JAMAIS déréférencer `null`",
    async () => {
      let capturedUpdater: ((v: { zoom: number; x: number; y: number }) => unknown) | null = null;
      const view = {
        rot: 0 as const,
        setRot: () => {},
        viewMode: 'top' as const,
        setViewMode: () => {},
        view: { zoom: 1, x: 0, y: 0 },
        // Simule le flush DIFFÉRÉ de React 18 : capture l'updater sans l'exécuter tout de suite.
        setView: (updater: unknown) => {
          capturedUpdater = typeof updater === 'function' ? (updater as typeof capturedUpdater) : null;
        },
        zoomAt: () => {},
        spaceRef: { current: false },
        panRef: { current: null as null | { sx: number; sy: number; vx: number; vy: number } },
        canvasRef: { current: null as SVGSVGElement | null },
        stageRef: { current: { w: 100, h: 100 } },
      };

      const container = document.createElement('div');
      document.body.appendChild(container);
      const root: Root = createRoot(container);
      await act(async () => {
        root.render(<EditorCanvas scene={emptyScene()} view={view as never} {...baseProps()} />);
      });

      const svg = container.querySelector('svg.editor-iso') as SVGSVGElement;
      expect(svg).toBeTruthy();
      // jsdom n'implémente ni CTM ni `getBoundingClientRect` réel — bouchons minimaux pour le picking.
      svg.getBoundingClientRect = () =>
        ({ width: 100, height: 100, top: 0, left: 0, right: 100, bottom: 100, x: 0, y: 0, toJSON() {} }) as DOMRect;
      (svg as unknown as { getScreenCTM: () => unknown }).getScreenCTM = () => ({ inverse: () => ({}) });
      (svg as unknown as { createSVGPoint: () => unknown }).createSVGPoint = () => ({
        x: 0,
        y: 0,
        matrixTransform: () => ({ x: 0, y: 0 }),
      });

      // 1. Clic-milieu : arme le pan (panRef.current renseigné par `pointerDown`).
      await act(async () => {
        svg.dispatchEvent(pointerEvent('pointerdown', { clientX: 10, clientY: 10, button: 1 }));
      });
      expect(view.panRef.current).toEqual({ sx: 10, sy: 10, vx: 0, vy: 0 });

      // 2. Glisser : `pointerMove` PROGRAMME un `setView` (updater capturé, exécution DIFFÉRÉE).
      await act(async () => {
        svg.dispatchEvent(pointerEvent('pointermove', { clientX: 20, clientY: 20 }));
      });
      expect(capturedUpdater).toBeTruthy();

      // 3. Relâcher : `pointerUp` remet `panRef.current` à `null` — AVANT que l'updater capturé ne
      //    s'exécute (la course réelle du crash : #1 diagnostiqué dans le brief).
      await act(async () => {
        svg.dispatchEvent(pointerEvent('pointerup', { clientX: 20, clientY: 20 }));
      });
      expect(view.panRef.current).toBeNull();

      // 4. React rejoue enfin l'updater : ne doit JAMAIS planter sur `panRef.current!.vx` (null).
      expect(() => capturedUpdater!({ zoom: 1, x: 0, y: 0 })).not.toThrow();

      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  );
});

// @vitest-environment jsdom
/**
 * MÊME classe de bug que `ui/editor/EditorCanvas.test.tsx` (panRef) : un `Ref.current!` déréférencé
 * DANS un callback `setState` différé plante si le ref retombe à `null` entre-temps. Fichier séparé
 * de `MapCanvas.test.tsx` (SSR statique, environnement `node`) — celui-ci a besoin d'un DOM réel
 * (pointeurs, refs synchronisées par React) pour rejouer la course. Les `dispatchEvent` ci-dessous
 * sont volontairement TOUS synchrones (aucun `await` entre eux) : React 18 les bat en un seul lot
 * et ne rejoue les updaters `setState` qu'à la fin — exactement la fenêtre où `pinchRef.current`
 * a déjà été remis à `null` par le dernier `pointerup` (déréférencement IMPÉRATIF, pas via
 * `setState`), la course réelle du crash diagnostiqué sur `panRef` (EditorCanvas).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MapCanvas } from './MapCanvas';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

function pointerEvent(type: string, opts: { clientX: number; clientY: number; pointerId: number }) {
  const ev = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: opts.clientX, clientY: opts.clientY });
  Object.defineProperty(ev, 'pointerId', { value: opts.pointerId });
  return ev;
}

describe('MapCanvas — pinch (2 doigts)', () => {
  it("le glisser-pincer ne plante pas quand l'updater setState différé s'exécute après le pointerup qui a remis pinchRef à null", async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);
    await act(async () => {
      root.render(<MapCanvas computeFit={() => ({ z: 1, panX: 0, panY: 0 })} />);
    });

    const svg = container.querySelector('svg') as SVGSVGElement;
    expect(svg).toBeTruthy();
    svg.getBoundingClientRect = () =>
      ({ width: 100, height: 64, top: 0, left: 0, right: 100, bottom: 64, x: 0, y: 0, toJSON() {} }) as DOMRect;

    let caught: unknown = null;
    try {
      // TOUT ce lot est synchrone (aucun `await` intercalé) : pointerdown×2 arme le pinch, les 2
      // pointermove PROGRAMMENT chacun un `setView` (updater à exécution DIFFÉRÉE), les 2 pointerup
      // remettent `pinchRef.current` à `null` de façon IMPÉRATIVE — le flush React (à la fin de cet
      // `act`) rejoue ENFIN les updaters capturés, ref déjà nulle.
      await act(async () => {
        svg.dispatchEvent(pointerEvent('pointerdown', { clientX: 10, clientY: 10, pointerId: 1 }));
        svg.dispatchEvent(pointerEvent('pointerdown', { clientX: 30, clientY: 10, pointerId: 2 }));
        svg.dispatchEvent(pointerEvent('pointermove', { clientX: 12, clientY: 10, pointerId: 1 }));
        svg.dispatchEvent(pointerEvent('pointermove', { clientX: 32, clientY: 10, pointerId: 2 }));
        svg.dispatchEvent(pointerEvent('pointerup', { clientX: 12, clientY: 10, pointerId: 1 }));
        svg.dispatchEvent(pointerEvent('pointerup', { clientX: 32, clientY: 10, pointerId: 2 }));
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeNull();

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});

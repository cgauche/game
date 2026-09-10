// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { tileEdge, type Dims } from '../../geometry/iso';
import { emptyScene, type Scene } from '../../state/scene';
import { useGame } from '../../state/store';
import { ClimbOverlays } from './ClimbOverlays';

/**
 * AFFORDANCE D'ESCALADE (LDB 15 l.52-57) — ce banc dit le RÉGIME ACTUEL de l'overlay, qui n'en avait
 * aucun : quelles arêtes `climb` sont peintes, où EXACTEMENT le trait tombe, et ce qu'un appui
 * déclenche. Il est la sonde d'invariance des lots suivants de #1687 (unification des trois overlays
 * d'arête, lots 1b-3/1b-4) : le lift passé à `tileEdge` est ici l'INDEX DE COUCHE `w.z`, là où
 * `DoorOverlays` reçoit un lift MÉTRIQUE (`SurcoucheIso.tsx:148` `liftOf` → `MondeDeCampagne.tsx:181`
 * `metricToLift(heightAt(...))`). Ce test verrouille ce que le code FAIT aujourd'hui — le lot 1b-3
 * changera la géométrie avec son propre contrat.
 */

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const dims: Dims = { w: 5, h: 4, rot: 0, view: 'iso' };

/** Scène 5×4 : une arête grimpable en (1,1,E) — le mobile se tient en (1,1), la case d'en face (2,1)
 *  est 4 m plus haut — et une SECONDE arête grimpable en (3,3,E), que rien ne borde. */
function scèneGrimpable(): Scene {
  const s = emptyScene(5, 4);
  const h = new Array(5 * 4).fill(0) as number[];
  h[1 * 5 + 2] = 4; // (2,1) : le haut de la paroi
  s.layers[0].height = h;
  s.walls = [
    { x: 1, y: 1, side: 'E', climb: { kind: 'surface' } },
    { x: 3, y: 3, side: 'E', climb: { kind: 'ladder' } },
  ];
  return s;
}

const TOUT_VU = new Set(['1,1,0', '2,1,0', '3,3,0', '4,3,0']);
const MOBILE = [{ x: 1, y: 1, z: 0 }];

const peindre = (scene: Scene, visible: ReadonlySet<string>, ctrls = MOBILE): HTMLDivElement => {
  const box = document.createElement('div');
  box.innerHTML = renderToStaticMarkup(
    <svg><ClimbOverlays scene={scene} dims={dims} activeZ={0} visible={visible} ctrls={ctrls} /></svg>,
  );
  return box;
};

const CLIMB_ACROSS_VRAI = useGame.getState().climbAcross;

describe('ClimbOverlays — les arêtes qu’on peut grimper depuis là où l’on se tient', () => {
  let root: Root | null = null;

  afterEach(() => {
    if (root) {
      act(() => root!.unmount());
      root = null;
    }
    document.body.replaceChildren();
    useGame.setState({ climbAcross: CLIMB_ACROSS_VRAI });
  });

  it('peint la seule arête grimpable qui BORDE le mobile, à la géométrie de son arête', () => {
    const traits = [...peindre(scèneGrimpable(), TOUT_VU).querySelectorAll('line.climb-edge')];
    const [a, b] = tileEdge(1, 1, 'E', dims, 0);

    expect(traits, 'l’arête (3,3,E) est grimpable mais aucun mobile ne la borde').toHaveLength(1);
    expect(traits[0].getAttribute('x1')).toBe(String(a.cx));
    expect(traits[0].getAttribute('y1')).toBe(String(a.cy));
    expect(traits[0].getAttribute('x2')).toBe(String(b.cx));
    expect(traits[0].getAttribute('y2')).toBe(String(b.cy));
    expect(traits[0].getAttribute('stroke-width')).toBe('9');
    expect(traits[0].querySelector('title')?.textContent, 'la case d’en face est plus haute').toBe('Escalader');
  });

  it('ne peint rien de ce que le brouillard couvre', () => {
    expect(peindre(scèneGrimpable(), new Set()).innerHTML).toBe('<svg></svg>');
  });

  it('un appui grimpe DIRECTEMENT vers la case d’en face et retient l’événement', () => {
    const climbAcross = vi.fn();
    useGame.setState({ climbAcross });
    const versLeDocument = vi.fn();
    document.addEventListener('pointerdown', versLeDocument);
    const box = document.createElement('div');
    document.body.append(box);
    root = createRoot(box);
    act(() => root!.render(
      <svg><ClimbOverlays scene={scèneGrimpable()} dims={dims} activeZ={0} visible={TOUT_VU} ctrls={MOBILE} /></svg>,
    ));

    act(() => box.querySelector('line.climb-edge')!.dispatchEvent(new Event('pointerdown', { bubbles: true })));

    expect(climbAcross).toHaveBeenCalledWith({ x: 1, y: 1, z: 0 }, { x: 2, y: 1, z: 0 });
    expect(versLeDocument, 'l’overlay court-circuite le clic-sol du stage').not.toHaveBeenCalled();
    document.removeEventListener('pointerdown', versLeDocument);
  });
});

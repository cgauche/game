// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { tileEdge, type Dims } from '../../geometry/iso';
import { emptyScene, type Scene } from '../../state/scene';
import { useGame } from '../../state/store';
import { FallOverlays } from './FallOverlays';

/**
 * SAUT VOLONTAIRE (LDB 15 l.82) — ce banc dit le RÉGIME ACTUEL de l'overlay, qui n'en avait aucun :
 * les quatre cardinaux du mobile sont sondés par `planFall`, seul un plan `fall` est peint, et l'appui
 * appelle `fallAcross` sans laisser l'événement redescendre au sol. Sonde d'invariance des lots
 * suivants de #1687 : le lift passé à `tileEdge` est ici `activeZ` (index de COUCHE), là où
 * `DoorOverlays` reçoit un lift MÉTRIQUE (`SurcoucheIso.tsx:148`) — le lot 1b-3 changera cette
 * géométrie avec son propre contrat.
 */

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const dims: Dims = { w: 4, h: 4, rot: 0, view: 'iso' };

/** Scène 4×4 : une CORNICHE — toute la rangée y=0 à 4 m, le reste au sol, sans arête `climb` (patron de
 *  `state/fallMove.test.ts`). Depuis (2,0), seul le cardinal SUD descend : est et ouest longent la
 *  corniche à plat, le nord sort de la carte. */
function scèneDeFalaise(): Scene {
  const s = emptyScene(4, 4);
  const h = new Array(4 * 4).fill(0) as number[];
  for (let x = 0; x < 4; x += 1) h[0 * 4 + x] = 4;
  s.layers[0].height = h;
  return s;
}

const SOMMET = [{ x: 2, y: 0, z: 0 }];
const TOUT_VU = new Set(['2,0,0', '2,1,0']);

const peindre = (visible: ReadonlySet<string>): HTMLDivElement => {
  const box = document.createElement('div');
  box.innerHTML = renderToStaticMarkup(
    <svg><FallOverlays scene={scèneDeFalaise()} dims={dims} activeZ={0} visible={visible} ctrls={SOMMET} /></svg>,
  );
  return box;
};

const FALL_ACROSS_VRAI = useGame.getState().fallAcross;

describe('FallOverlays — sauter en bas depuis le bord de la falaise', () => {
  let root: Root | null = null;

  afterEach(() => {
    if (root) {
      act(() => root!.unmount());
      root = null;
    }
    document.body.replaceChildren();
    useGame.setState({ fallAcross: FALL_ACROSS_VRAI });
  });

  it('peint le seul cardinal qui descend, à la géométrie de son arête, et dit la hauteur', () => {
    const traits = [...peindre(TOUT_VU).querySelectorAll('line.fall-edge')];
    const [a, b] = tileEdge(2, 1, 'N', dims, 0);

    expect(traits, 'est et ouest longent la corniche à plat, le nord sort de la carte').toHaveLength(1);
    expect(traits[0].getAttribute('x1')).toBe(String(a.cx));
    expect(traits[0].getAttribute('y1')).toBe(String(a.cy));
    expect(traits[0].getAttribute('x2')).toBe(String(b.cx));
    expect(traits[0].getAttribute('y2')).toBe(String(b.cy));
    expect(traits[0].getAttribute('stroke-width')).toBe('9');
    expect(traits[0].querySelector('title')?.textContent).toBe('Sauter en bas (4 m)');
  });

  it('ne peint rien de ce que le brouillard couvre', () => {
    expect(peindre(new Set()).innerHTML).toBe('<svg></svg>');
  });

  it('un appui ouvre DIRECTEMENT le saut vers la case d’en bas et retient l’événement', () => {
    const fallAcross = vi.fn();
    useGame.setState({ fallAcross });
    const versLeDocument = vi.fn();
    document.addEventListener('pointerdown', versLeDocument);
    const box = document.createElement('div');
    document.body.append(box);
    root = createRoot(box);
    act(() => root!.render(
      <svg><FallOverlays scene={scèneDeFalaise()} dims={dims} activeZ={0} visible={TOUT_VU} ctrls={SOMMET} /></svg>,
    ));

    act(() => box.querySelector('line.fall-edge')!.dispatchEvent(new Event('pointerdown', { bubbles: true })));

    expect(fallAcross).toHaveBeenCalledWith({ x: 2, y: 0, z: 0 }, { x: 2, y: 1, z: 0 });
    expect(versLeDocument, 'l’overlay court-circuite le clic-sol du stage').not.toHaveBeenCalled();
    document.removeEventListener('pointerdown', versLeDocument);
  });
});

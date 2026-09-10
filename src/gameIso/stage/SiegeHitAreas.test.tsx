// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tileEdge, type Dims } from '../../geometry/iso';
import { emptyScene, type Scene } from '../../state/scene';
import { useGame, type BattleState } from '../../state/store';
import type { Combatant } from '../../engine/types';
import { SiegeHitAreas } from './SiegeHitAreas';

/**
 * FORTIFICATION D'ARÊTE COMME CIBLE (AA 10 p.120) — ce banc dit le RÉGIME ACTUEL de l'overlay, qui
 * n'en avait aucun : la hit-area transparente n'existe que pour une structure ENRÔLÉE dans la file de
 * combat, et son appui suit l'aperçu-puis-commit — le 1er arme SANS retenir l'événement (le clic-sol
 * résout un pas le long du mur), le 2e frappe et le retient. Hors combat, l'overlay n'est même pas
 * monté (`SurcoucheIso.tsx:191`, `{battle && …}`) : ce qu'il tient ici, c'est le refus d'une structure
 * non enrôlée. Sonde d'invariance des lots suivants de #1687 : le lift passé à `tileEdge` est l'INDEX
 * DE COUCHE `w.z`, là où `DoorOverlays` reçoit un lift MÉTRIQUE (`SurcoucheIso.tsx:148`).
 */

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn() });

const dims: Dims = { w: 5, h: 4, rot: 0, view: 'iso' };
const ID = 'structure-1-1-E-0';
const TOUT_VU = new Set(['1,1,0', '2,1,0']);

function scèneFortifiée(): Scene {
  const s = emptyScene(5, 4);
  s.walls = [{ x: 1, y: 1, side: 'E', structure: 'mur-a-ossature-en-bois' }];
  return s;
}

const mur = { id: ID, label: 'Mur à ossature en bois' } as unknown as Combatant;
const bataille = (combatants: Combatant[], preview: unknown = null): BattleState =>
  ({ combatants, order: [], turn: 0, preview } as unknown as BattleState);

const BATTLE_VRAI = useGame.getState().battle;
const CLICK_VRAI = useGame.getState().battleClickEntity;

/** Monte l'overlay dans le document (le `document` est le témoin de la PROPAGATION : React délègue au
 *  conteneur, donc seul un événement non retenu en sort) et rend la hit-area. */
function monter(root: { current: Root | null }, battle: BattleState): { box: HTMLDivElement; cible: Element | null } {
  const box = document.createElement('div');
  document.body.append(box);
  root.current = createRoot(box);
  act(() => root.current!.render(
    <svg><SiegeHitAreas scene={scèneFortifiée()} battle={battle} dims={dims} activeZ={0} visible={TOUT_VU} /></svg>,
  ));
  return { box, cible: box.querySelector(`[data-cid="${ID}"]`) };
}

describe('SiegeHitAreas — pilonner une enceinte est un geste délibéré', () => {
  const root: { current: Root | null } = { current: null };

  beforeEach(() => {
    vi.mocked(window.matchMedia).mockReturnValue({ matches: true } as unknown as MediaQueryList); // souris
  });

  afterEach(() => {
    if (root.current) {
      act(() => root.current!.unmount());
      root.current = null;
    }
    document.body.replaceChildren();
    useGame.setState({ battle: BATTLE_VRAI, battleClickEntity: CLICK_VRAI });
  });

  it('porte le `data-cid` du Combattant-structure sur la géométrie de son arête', () => {
    const box = document.createElement('div');
    box.innerHTML = renderToStaticMarkup(
      <svg><SiegeHitAreas scene={scèneFortifiée()} battle={bataille([mur])} dims={dims} activeZ={0} visible={TOUT_VU} /></svg>,
    );
    const cible = box.querySelector(`[data-cid="${ID}"]`)!;
    const [a, b] = tileEdge(1, 1, 'E', dims, 0);

    expect(cible.getAttribute('x1')).toBe(String(a.cx));
    expect(cible.getAttribute('y1')).toBe(String(a.cy));
    expect(cible.getAttribute('x2')).toBe(String(b.cx));
    expect(cible.getAttribute('y2')).toBe(String(b.cy));
    expect(cible.getAttribute('stroke')).toBe('transparent');
    expect(cible.getAttribute('stroke-width')).toBe('16');
    expect(cible.querySelector('title')?.textContent).toBe('Mur à ossature en bois');
  });

  it('aucune hit-area pour une structure qu’aucun Combattant ne tient', () => {
    const box = document.createElement('div');
    box.innerHTML = renderToStaticMarkup(
      <svg><SiegeHitAreas scene={scèneFortifiée()} battle={bataille([])} dims={dims} activeZ={0} visible={TOUT_VU} /></svg>,
    );
    expect(box.innerHTML).toBe('<svg></svg>');
  });

  it('le 1er appui ARME seulement, et LAISSE le clic-sol résoudre le pas', () => {
    const battleClickEntity = vi.fn();
    const battle = bataille([mur]);
    useGame.setState({ battle, battleClickEntity });
    const versLeDocument = vi.fn();
    document.addEventListener('pointerdown', versLeDocument);
    const { cible } = monter(root, battle);

    act(() => cible!.dispatchEvent(new Event('pointerdown', { bubbles: true })));

    expect(battleClickEntity).toHaveBeenCalledWith(ID, { confirm: false });
    expect(versLeDocument, 'le 1er appui ne retient pas l’événement').toHaveBeenCalledTimes(1);
    document.removeEventListener('pointerdown', versLeDocument);
  });

  it('le 2e appui sur la structure DÉJÀ armée frappe, et retient l’événement', () => {
    const battleClickEntity = vi.fn();
    const battle = bataille([mur], { kind: 'attack', targetId: ID, path: [] });
    useGame.setState({ battle, battleClickEntity });
    const versLeDocument = vi.fn();
    document.addEventListener('pointerdown', versLeDocument);
    const { cible } = monter(root, battle);

    act(() => cible!.dispatchEvent(new Event('pointerdown', { bubbles: true })));

    expect(battleClickEntity, 'souris : le survol a déjà montré la visée, le clic commet').toHaveBeenCalledWith(ID, { confirm: true });
    expect(versLeDocument).not.toHaveBeenCalled();
    document.removeEventListener('pointerdown', versLeDocument);
  });
});

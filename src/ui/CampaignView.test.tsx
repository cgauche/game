// @vitest-environment jsdom
/**
 * #1176, P2-7 / #1289 — les boutons d'ORIENTATION annoncent Q et E dans leur libellé : ils doivent donc
 * faire EXACTEMENT ce que font ces touches. Le monde est volumique (commit C5a) : la poussée pousse le
 * lacet CONTINU vers le cran DIAGONAL visé, et ne touche pas au cran du store.
 * Monté pour de VRAI (patron `createRoot`/`act` du repo) : c'est l'ÉCRAN qui est jugé, pas le prédicat.

 */
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame } from '../state/store';
import { testScene } from '../scenes/test-fixture';
import { CampaignView } from './CampaignView';
import { getStageYaw, resetStageYaw } from '../state/stageYaw';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let host: HTMLDivElement;
let root: Root;

function monter(povActive: boolean) {
  useGame.setState({ scene: testScene, mode: 'exploration', povActive, battle: null });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => { root.render(<CampaignView />); });
  return host;
}

afterEach(() => {
  act(() => { root.unmount(); });
  host.remove();
  resetStageYaw();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  useGame.setState({ povActive: false });
});

describe('CampaignView — plus aucun interrupteur de voie de rendu à l’écran (#1176 C5a)', () => {
  it('ni hors POV, ni en POV : le jeu n’a qu’un monde', () => {
    for (const pov of [false, true]) {
      const el = monter(pov);
      expect(el.querySelector('[aria-label="Monde volumique (DEV)"]')).toBeNull();
      expect(el.querySelector('[aria-label="Monde en couches SVG (DEV)"]')).toBeNull();
      act(() => { root.unmount(); });
      host.remove();
      host = document.createElement('div'); // l'`afterEach` démonte le dernier montage
      document.body.appendChild(host);
      root = createRoot(host);
    }
  });
});

describe('CampaignView — les boutons d’orientation SONT le geste de Q/E', () => {
  /** Hors navigateur, le lacet arrive tout de suite (`state/stageYaw.ts`) : la poussée se mesure sans
   *  dérouler l'approche à la frame. */
  const sansFrames = () => vi.stubGlobal('requestAnimationFrame', undefined);

  it('le bouton pousse le LACET d’un cran DIAGONAL, et ne touche pas au cran du store', () => {
    const el = monter(false);
    sansFrames();
    const cran = useGame.getState().camRot;
    act(() => { el.querySelector('[aria-label="Tourner horaire (E)"]')!.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true })); });
    expect(getStageYaw()).toBe(90); // #1289 : le geste du joueur vise un quart de tour, jamais un demi-cran de face
    expect(useGame.getState().camRot).toBe(cran);
  });

  it('…et le geste est le MÊME dans l’autre sens (aucune asymétrie de poussée)', () => {
    const el = monter(false);
    sansFrames();
    const cran = useGame.getState().camRot;
    act(() => { el.querySelector('[aria-label="Tourner anti-horaire (Q)"]')!.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true })); });
    expect(getStageYaw()).toBe(-90);
    expect(useGame.getState().camRot).toBe(cran);
  });
});

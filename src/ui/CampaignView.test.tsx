// @vitest-environment jsdom
/**
 * #1176 — l'interrupteur DEV « Monde volumique » gouverne la voie de rendu des DEUX vues du jeu : la vue
 * iso comme le POV, qui monte lui aussi `GameStage3D` en webgl (`gameIso/pov/PovStage.tsx:64`). Monté pour
 * de VRAI (patron `createRoot`/`act` du repo) : c'est l'ÉCRAN qui est jugé, pas le prédicat.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame } from '../state/store';
import { getStageBackend, setStageBackend } from '../state/stage3d';
import { testScene } from '../scenes/test-fixture';
import { CampaignView } from './CampaignView';
import { getStageYaw, resetStageYaw } from '../state/stageYaw';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

const VOLUMIQUE = 'Monde volumique (DEV)';

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
  setStageBackend('affine');
  resetStageYaw();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  useGame.setState({ povActive: false });
  setStageBackend('affine');
});

describe('CampaignView — interrupteur DEV « Monde volumique »', () => {
  it('rend le bouton volumique hors POV', () => {
    const el = monter(false);
    expect(el.querySelector(`[aria-label="${VOLUMIQUE}"]`)).not.toBeNull();
  });

  it('rend le bouton volumique ACTIF quand le POV est actif, et le clic y bascule la voie de rendu', () => {
    const el = monter(true);
    // Le POV est bien monté : c'est SA voie de rendu que l'interrupteur gouverne ici.
    expect(el.querySelector('[aria-label="Vue normale (au-dessus)"]')).not.toBeNull();
    const bouton = el.querySelector(`[aria-label="${VOLUMIQUE}"]`);
    expect(bouton).not.toBeNull();
    expect(getStageBackend()).toBe('affine');
    act(() => { bouton!.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true })); });
    expect(getStageBackend()).toBe('webgl');
    expect(el.querySelector('[aria-label="Monde en couches SVG (DEV)"]')).not.toBeNull();
  });

  it('le CLIC sur le bouton bascule la voie de rendu (le câblage part du bouton, pas du store)', () => {
    const el = monter(false);
    expect(getStageBackend()).toBe('affine');
    const bouton = el.querySelector(`[aria-label="${VOLUMIQUE}"]`)!;
    // Le contrôle agit au POINTER DOWN (`ViewControls`), pas au clic : c'est CE geste qu'on rejoue.
    act(() => { bouton.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true })); });
    expect(getStageBackend()).toBe('webgl');
    // Et l'écran suit : le bouton porte désormais le libellé de RETOUR aux couches SVG.
    expect(el.querySelector('[aria-label="Monde en couches SVG (DEV)"]')).not.toBeNull();
  });
});

/**
 * #1176, P2-7 — les boutons d'ORIENTATION annoncent Q et E dans leur libellé : ils doivent donc faire
 * EXACTEMENT ce que font ces touches. En voie volumique, la touche pousse le lacet CONTINU ; un bouton
 * resté sur `rotateCam` y sauterait d'un cran entier, voile de transition et recentrage compris.
 */
describe('CampaignView — les boutons d’orientation SONT le geste de Q/E', () => {
  /** Hors navigateur, le lacet arrive tout de suite (`state/stageYaw.ts`) : la poussée se mesure sans
   *  dérouler l'approche à la frame. */
  const sansFrames = () => vi.stubGlobal('requestAnimationFrame', undefined);

  it('voie VOLUMIQUE : le bouton pousse le LACET, et ne touche pas au cran du store', () => {
    const el = monter(false);
    setStageBackend('webgl');
    sansFrames();
    const cran = useGame.getState().camRot;
    act(() => { el.querySelector('[aria-label="Tourner horaire (E)"]')!.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true })); });
    expect(getStageYaw()).toBe(45);
    expect(useGame.getState().camRot).toBe(cran);
  });

  it('voie AFFINE : le même bouton avance d’un cran (des HUIT : coin ↔ face), et le lacet reste nul', () => {
    const el = monter(false);
    sansFrames();
    const cran = () => `${useGame.getState().camRot}${useGame.getState().camEdge ? 'e' : ''}`;
    const avant = cran();
    act(() => { el.querySelector('[aria-label="Tourner horaire (E)"]')!.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true })); });
    expect(cran()).not.toBe(avant);
    expect(getStageYaw()).toBe(0);
  });
});

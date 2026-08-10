// @vitest-environment jsdom
/**
 * #1176 — l'interrupteur DEV « Monde volumique » ne gouverne que le monde de la vue ISO : en POV, le
 * bouton serait une affordance morte (clic sans effet). Monté pour de VRAI (patron `createRoot`/`act`
 * du repo) : c'est l'ÉCRAN qui est jugé, pas le prédicat.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame } from '../state/store';
import { getStageBackend, setStageBackend } from '../state/stage3d';
import { testScene } from '../scenes/test-fixture';
import { CampaignView } from './CampaignView';

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

  it('ne rend pas le bouton volumique quand le POV est actif', () => {
    const el = monter(true);
    expect(el.querySelector(`[aria-label="${VOLUMIQUE}"]`)).toBeNull();
    // Le POV reste bien monté : c'est le bouton mort qui disparaît, pas la vue.
    expect(el.querySelector('[aria-label="Vue normale (au-dessus)"]')).not.toBeNull();
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

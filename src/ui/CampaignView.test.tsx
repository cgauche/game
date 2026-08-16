// @vitest-environment jsdom
/**
 * #1176 — les boutons d'ORIENTATION annoncent Q et E dans leur libellé : ils doivent donc faire
 * EXACTEMENT ce que font ces touches. Le lacet est LIBRE : l'appui pousse d'un PAS FIN, et ne touche
 * pas au cran du store.
 * Monté pour de VRAI (patron `createRoot`/`act` du repo) : c'est l'ÉCRAN qui est jugé, pas le prédicat.

 */
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame } from '../state/store';
import { testScene } from '../scenes/test-fixture';
import { CampaignView } from './CampaignView';
import { PAS_TAP_DEG, SEUIL_MAINTIEN_MS, getStageYaw, resetStageYaw } from '../state/stageYaw';

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
  vi.useRealTimers();
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

  it('le bouton pousse le LACET d’un pas fin, et ne touche pas au cran du store', () => {
    const el = monter(false);
    sansFrames();
    const cran = useGame.getState().camRot;
    act(() => { el.querySelector('[aria-label="Tourner horaire (E)"]')!.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true })); });
    expect(getStageYaw()).toBe(PAS_TAP_DEG);
    expect(useGame.getState().camRot).toBe(cran);
  });

  it('…et le geste est le MÊME dans l’autre sens (aucune asymétrie de poussée)', () => {
    const el = monter(false);
    sansFrames();
    const cran = useGame.getState().camRot;
    act(() => { el.querySelector('[aria-label="Tourner anti-horaire (Q)"]')!.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true })); });
    expect(getStageYaw()).toBe(-PAS_TAP_DEG);
    expect(useGame.getState().camRot).toBe(cran);
  });

  /** Pilote la boucle de frames à la main : le test décide quand chaque frame se joue. */
  function harnaisDeFrames() {
    let enAttente: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => enAttente.push(cb));
    let horloge = 0;
    return (n: number): void => {
      for (let i = 0; i < n; i++) {
        horloge += 16;
        const cb = enAttente[enAttente.length - 1];
        enAttente = [];
        cb?.(horloge);
      }
    };
  }

  it('TOUCHE TENUE : passé le seuil, l’écran fait tourner la caméra en continu', () => {
    vi.useFakeTimers();
    monter(false);
    const jouer = harnaisDeFrames();
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' })); });
    act(() => { vi.advanceTimersByTime(SEUIL_MAINTIEN_MS); }); // la touche n'est PAS relâchée
    act(() => { jouer(60); });
    expect(getStageYaw()).toBeGreaterThan(50); // bien au-delà du pas fin de l'enfoncement
  });

  it('TOUCHE RELÂCHÉE avant le seuil : la vue en reste au pas fin', () => {
    vi.useFakeTimers();
    monter(false);
    const jouer = harnaisDeFrames();
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' })); });
    act(() => { window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE' })); });
    act(() => { vi.advanceTimersByTime(10 * SEUIL_MAINTIEN_MS); });
    act(() => { jouer(60); });
    expect(getStageYaw()).toBeCloseTo(PAS_TAP_DEG, 6);
  });

  /** Le geste MAINTENU en cours, angle atteint après `frames` images de rotation continue. */
  const maintenirEtMesurer = (jouer: (n: number) => void, frames = 30): number => {
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' })); });
    act(() => { vi.advanceTimersByTime(SEUIL_MAINTIEN_MS); }); // la touche reste TENUE
    act(() => { jouer(frames); });
    const angle = getStageYaw();
    expect(angle).toBeGreaterThan(PAS_TAP_DEG);
    return angle;
  };

  it('BLUR (Alt-Tab) : le lacet en cours S’ARRÊTE, et la minuterie de maintien est désarmée', () => {
    vi.useFakeTimers();
    monter(false);
    const jouer = harnaisDeFrames();

    // 1. Un maintien EN VOL : la fenêtre perd le focus, la caméra s'arrête net et n'avance plus.
    const enVol = maintenirEtMesurer(jouer);
    act(() => { window.dispatchEvent(new Event('blur')); });
    act(() => { jouer(60); });
    expect(getStageYaw()).toBe(enVol);

    // 2. Le `keyup` qui arrive APRÈS (au retour du focus, ou jamais) ne réveille rien.
    act(() => { window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE' })); });
    act(() => { jouer(60); });
    expect(getStageYaw()).toBe(enVol);

    // 3. Minuterie DÉSARMÉE : un appui perdu AVANT le seuil ne part pas en rotation fantôme.
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' })); });
    act(() => { window.dispatchEvent(new Event('blur')); });
    act(() => { vi.advanceTimersByTime(10 * SEUIL_MAINTIEN_MS); });
    act(() => { jouer(60); });
    expect(getStageYaw()).toBeCloseTo(enVol + PAS_TAP_DEG, 6); // le pas fin de l'appui, et RIEN de plus
  });

  it('ONGLET CACHÉ (visibilitychange) : même arrêt, même désarmement', () => {
    vi.useFakeTimers();
    monter(false);
    const jouer = harnaisDeFrames();
    const cacher = (hidden: boolean) => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
      act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    };

    const enVol = maintenirEtMesurer(jouer);
    cacher(true);
    act(() => { jouer(60); });
    expect(getStageYaw()).toBe(enVol);

    // Onglet REVENU au premier plan : l'évènement ne relâche rien (il n'y a plus rien à relâcher),
    // et un nouvel appui bref repart de l'angle laissé — la vue n'a pas été recalée.
    cacher(false);
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' })); });
    act(() => { window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE' })); });
    act(() => { vi.advanceTimersByTime(10 * SEUIL_MAINTIEN_MS); });
    act(() => { jouer(60); });
    expect(getStageYaw()).toBeCloseTo(enVol + PAS_TAP_DEG, 6);
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
  });
});

// @vitest-environment jsdom
/**
 * #1176 — le lacet de caméra est LIBRE : l'appui bref pousse d'un PAS FIN, la touche TENUE fait
 * tourner en continu, et une perte de focus (Alt-Tab, onglet caché) arrête tout net.
 * Monté pour de VRAI (patron `createRoot`/`act` du repo) : c'est l'ÉCRAN qui est jugé, pas le prédicat
 * — la pure mécanique du lacet, elle, vit dans `src/state/lacet-libre.test.ts`.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame } from '../state/store';
import { testScene } from '../scenes/test-fixture';
import { CampaignView } from './CampaignView';
import { resetStageFrames } from '../gameIso/stage/stageFrames';
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
  resetStageFrames();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
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

describe('CampaignView — le geste de caméra du joueur, monté à l’écran', () => {
  /**
   * Pilote le BATTEMENT du stage à la main : le test décide quand chaque image se joue. C'est ce
   * battement qui avance le lacet (`stageYaw.avancerLacet`, tiré en prélude par l'hôte
   * `gameIso/stage/MondeDeCampagne` tant que le régime dure) — la file de `requestAnimationFrame`
   * est celle de la boucle du stage, et `performance.now` est l'horloge que le test avance, sans
   * quoi la boucle céderait le pas à l'image qu'elle vient elle-même de servir.
   */
  function harnaisDeFrames() {
    let file: FrameRequestCallback[] = [];
    let horloge = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => horloge);
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => file.push(cb));
    vi.stubGlobal('cancelAnimationFrame', () => {});
    resetStageFrames();
    return (n: number): void => {
      for (let i = 0; i < n; i++) {
        horloge += 16;
        const àServir = file;
        file = [];
        àServir.forEach((cb) => cb(horloge));
      }
    };
  }

  it('TOUCHE TENUE : passé le seuil, l’écran fait tourner la caméra en continu', () => {
    vi.useFakeTimers();
    const jouer = harnaisDeFrames();
    monter(false);
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' })); });
    act(() => { vi.advanceTimersByTime(SEUIL_MAINTIEN_MS); }); // la touche n'est PAS relâchée
    act(() => { jouer(60); });
    expect(getStageYaw()).toBeGreaterThan(50); // bien au-delà du pas fin de l'enfoncement
  });

  it('TOUCHE RELÂCHÉE avant le seuil : la vue en reste au pas fin', () => {
    vi.useFakeTimers();
    const jouer = harnaisDeFrames();
    monter(false);
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
    const jouer = harnaisDeFrames();
    monter(false);

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
    const jouer = harnaisDeFrames();
    monter(false);
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

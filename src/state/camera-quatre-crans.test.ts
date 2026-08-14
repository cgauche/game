/**
 * #1289 — la caméra de JEU ne connaît que les QUATRE vues DIAGONALES. Ce qui se mesure ici est le
 * geste RÉEL du joueur (`tournerCamera`, source unique de Q/E et des boutons d'orientation) sur les
 * deux voies de rendu, et le rattrapage d'une partie qui arriverait d'une vue de face.
 *
 * Le fait central est l'AIMANT : la cible se calcule par ARRONDI au cran, jamais par addition. Une
 * addition tient au repos (le lacet est déjà au cran) et ment EN VOL — c'est le double-appui pendant
 * l'approche qui la réfute, et c'est donc lui que la sonde ci-dessous rejoue, frame par frame.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { tournerCamera } from './keybindings';
import { getStageYaw, resetStageYaw, snapYawTarget, yawTarget } from './stageYaw';
import { readSlot, deleteSlot } from './saves';
import { testScene } from '../scenes/test-fixture';

/** Fake Storage minimal — l'environnement de test est `node` (pas de localStorage). */
function fakeStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
  } as Storage;
}

/** Pilote l'approche à la main : `requestAnimationFrame` ne rend plus la frame, il la met en attente,
 *  et le test décide QUAND et avec quel horodatage elle se joue (donc où en est le lacet). */
function harnaisDeFrames() {
  let enAttente: FrameRequestCallback[] = [];
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => enAttente.push(cb));
  return (now: number): void => {
    const cb = enAttente[enAttente.length - 1];
    enAttente = [];
    cb?.(now);
  };
}

const g = useGame.getState;

beforeEach(() => {
  resetStageYaw();
  useGame.setState({ camRot: 0, camEdge: false, camPan: { x: 0, y: 0 } });
});

afterEach(() => {
  vi.unstubAllGlobals();
  resetStageYaw();
});

describe('AIMANT — la poussée du joueur vise un cran, elle ne s’ajoute pas au lacet', () => {
  it('DOUBLE-APPUI EN VOL : la 2e poussée pendant l’approche laisse la cible sur un multiple de 90°', () => {
    const jouerFrame = harnaisDeFrames();
    tournerCamera(g, 1); // 1re poussée : cible = 90°, l'approche démarre
    jouerFrame(16); // ~14,7°
    jouerFrame(48); // ~37,2° : le lacet est EN VOL, entre deux crans
    const enVol = getStageYaw();
    expect(enVol).toBeGreaterThan(30);
    expect(enVol).toBeLessThan(45);
    expect(enVol % 90).not.toBe(0); // la sonde part bien d'un angle qui n'est pas un cran

    tournerCamera(g, 1); // 2e poussée EN VOL
    jouerFrame(10048); // frame très longue : le lacet arrive sur sa cible

    expect(getStageYaw() % 90).toBe(0); // …et cette cible est un CRAN
    expect(getStageYaw()).toBe(180); // le double-appui vaut un demi-tour, pas un demi-cran de face
    // Ce qu'une poussée ADDITIVE aurait posé depuis ce même vol : 127°, soit une vue de FACE.
    expect(yawTarget(enVol, 90, 90)).toBeCloseTo(enVol + 90, 9);
    expect((enVol + 90) % 90).not.toBe(0);
  });

  it('l’arrondi RATTRAPE un lacet quelconque : depuis 45°, la poussée tombe sur un cran', () => {
    expect(snapYawTarget(45, 45, 1)).toBe(90);
    expect(snapYawTarget(45, 45, -1)).toBe(0);
    expect(snapYawTarget(0, 0, 1)).toBe(90);
    expect(snapYawTarget(0, 0, -1)).toBe(-90);
  });

  it('l’AVANCE reste bornée EN CRANS : maintenir la touche tourne sans empiler un tour', () => {
    let cible = 0;
    for (let i = 0; i < 12; i++) cible = snapYawTarget(0, cible, 1); // 12 répétitions clavier d'affilée
    expect(cible).toBe(180);
    expect(cible % 90).toBe(0);
  });

  it('voie VOLUMIQUE, au repos : chaque poussée avance d’un quart de tour', () => {
    vi.stubGlobal('requestAnimationFrame', undefined); // hors navigateur : le lacet arrive tout de suite
    tournerCamera(g, 1);
    expect(getStageYaw()).toBe(90);
    tournerCamera(g, 1);
    expect(getStageYaw()).toBe(180);
    tournerCamera(g, -1);
    expect(getStageYaw()).toBe(90);
    expect(g().camRot).toBe(0); // le cran du store ne bouge pas en voie volumique
  });
});

describe('rotateCam — le chemin joueur saute les vues de face', () => {
  it('l’action de store avance d’un cran de 90°, camEdge jamais vrai, et la vue se RE-CENTRE (camPan)', () => {
    // `rotateCam` n'est plus le geste de l'écran de JEU (mort de la voie affine, #1176 P3-4 commit
    // C5a : le geste joueur pousse le lacet) — il reste l'action de rotation par cran des bancs et de
    // l'éditeur, et sa loi doit tenir : jamais de vue de face, re-centrage compris.
    useGame.setState({ camEdge: true, camPan: { x: 37, y: -12 } }); // vue de face héritée + décalage manuel
    g().rotateCam(1);
    expect(g().camRot).toBe(1);
    expect(g().camEdge).toBe(false);
    expect(g().camPan).toEqual({ x: 0, y: 0 }); // re-centrage conservé : sans lui, la vue reste « téléportée »
    expect(getStageYaw()).toBe(0);
  });

  it('un tour entier dans les deux sens ne pose JAMAIS la vue de face', () => {
    const crans: number[] = [];
    for (let i = 0; i < 4; i++) { g().rotateCam(1); expect(g().camEdge).toBe(false); crans.push(g().camRot); }
    expect(crans).toEqual([1, 2, 3, 0]);
    for (let i = 0; i < 4; i++) { g().rotateCam(-1); expect(g().camEdge).toBe(false); }
    expect(g().camRot).toBe(0);
  });
});

describe('RATTRAPAGE — une partie arrivée en vue de face repart d’un cran diagonal', () => {
  it('une sauvegarde qui PORTE la vue de face (camEdge sérialisé) se recharge en vue de coin', () => {
    (globalThis as { localStorage?: Storage }).localStorage = fakeStorage();
    deleteSlot(1);
    g().startScene(testScene);
    useGame.setState({ camEdge: true, battle: null });
    expect(g().saveGame(1)).toBe(true);
    expect((readSlot(1)!.data as { camEdge?: boolean }).camEdge).toBe(true); // la save porte bien la vue de face

    useGame.setState({ camEdge: true });
    expect(g().loadGame(1)).toBe(true);
    expect(g().camEdge).toBe(false);
    deleteSlot(1);
  });

  it("l'entrée de scène (transitionTo) ramène la vue au cran diagonal", () => {
    g().startScene(testScene);
    useGame.setState({ camEdge: true });
    g().transitionTo(testScene.id);
    expect(g().camEdge).toBe(false);
  });
});

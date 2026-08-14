// @vitest-environment jsdom
import { Profiler, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { useGame } from '../../state/store';
import { emptyScene } from '../../state/scene';
import { setStageBackend } from '../../state/stage3d';
import { bus, EVT } from '../../state/bus';
import { STEP_MS } from '../../geometry/walk';
import type { Combatant } from '../../engine/types';
import { IsoStage } from '../IsoStage';
import * as sceneMeshes from '../backends/webgl/sceneMeshes';
import { setStageRendererFactory, type StageRenderer } from './GameStage3D';

/**
 * LA MARCHE PILOTÉE PAR LA BOUCLE DE RENDU (#1176, P2-4). La cadence LOGIQUE d'un pas est le store
 * (160 ms) ; le GLISSEMENT, lui, est une affaire d'image. Qui PEINT décide de ce qu'une image coûte :
 * la voie affine repeint ses jetons SVG, donc elle re-rend React à chaque image ; la voie volumique a
 * sa propre boucle, lit `walksRef` elle-même, et ne re-rend RIEN à l'image.
 *
 * Elle re-rend en revanche au FRANCHISSEMENT d'une case : les vérités de PIÈCE et de DÉGAGEMENT
 * (`visualAllies` → `roomFocus`/`cleared`/`propEls`) sont des événements DISCRETS, et les laisser
 * attendre l'arrivée ferait basculer un toit une case trop tard. Un rendu par case franchie, jamais un
 * par image — c'est la cadence du PAS.
 *
 * Le battement de la marche est ISOLÉ des autres boucles rAF de l'écran (les clips de rig en affine) :
 * le tick de marche est retiré de la file au moment où il s'y inscrit, puis rejoué seul. Un commit
 * mesuré ici est donc imputable à la marche, et à rien d'autre.
 */
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Renderer de BANC : jsdom n'a aucun contexte WebGL, et depuis que la voie volumique est le défaut
 *  (#1176, P3-4) un contexte refusé REBASCULE l'écran en affine (`GameStage3D`, création de renderer).
 *  Sans banc, ce fichier mesurerait le repli au lieu de la voie volumique. */
class BancRenderer implements StageRenderer {
  shadowMap = { enabled: false, autoUpdate: true, needsUpdate: false, type: THREE.PCFShadowMap };
  capabilities = { getMaxAnisotropy: () => 1 };
  setPixelRatio(): void {}
  setClearColor(): void {}
  setSize(): void {}
  dispose(): void {}
  render(): void {}
}

beforeAll(() => setStageRendererFactory(() => new BancRenderer()));
afterAll(() => setStageRendererFactory(null));

function hero(id: string, pos: { x: number; y: number }): Combatant {
  return {
    id, label: id, kind: 'hero', pos, size: 'moyenne',
    wounds: { current: 12, max: 12 }, weapons: [],
    characteristics: {}, advantage: 0, conditions: [], armour: {},
    skills: [], talents: [], movement: 4,
  } as unknown as Combatant;
}

let root: Root | null = null;
let container: HTMLDivElement | null = null;
let horloge = 0;
let file: FrameRequestCallback[] = [];

/** Monte le stage et COMPTE les commits de son sous-arbre (aucun rendu = aucun commit). */
function monter(): { el: HTMLDivElement; commits: () => number } {
  useGame.setState({
    scene: emptyScene(8, 8),
    mode: 'exploration',
    partyPos: { x: 2, y: 2 },
    party: [hero('h1', { x: 2, y: 2 })],
    battle: null,
    dialogue: null,
    flags: {},
  });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  let n = 0;
  act(() => root!.render(<Profiler id="stage" onRender={() => { n += 1; }}><IsoStage /></Profiler>));
  return { el: container!, commits: () => n };
}

/** Déclenche une marche et EXTRAIT son tick de la file commune (cf. en-tête). */
function marcher(id: string, path: { x: number; y: number }[]): FrameRequestCallback {
  const avant = file.length;
  bus.emit(EVT.ANIM_MOVE, { id, path });
  const posés = file.splice(avant);
  expect(posés).toHaveLength(1);
  return posés[0];
}

/** Avance l'horloge de `dt` et rejoue le SEUL tick de marche ; rend celui qu'il reprogramme. */
function image(tick: FrameRequestCallback, dt: number): FrameRequestCallback | null {
  horloge += dt;
  const avant = file.length;
  act(() => { tick(horloge); });
  return file.splice(avant)[0] ?? null;
}

const transform = (el: HTMLElement) => (el.querySelector('svg.iso-stage > g') as SVGGElement).style.transform;

beforeEach(() => {
  horloge = 1000;
  file = [];
  vi.spyOn(performance, 'now').mockImplementation(() => horloge);
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => file.push(cb));
  vi.stubGlobal('cancelAnimationFrame', () => {});
});

afterEach(() => {
  if (root) { act(() => root!.unmount()); root = null; }
  if (container) { container.remove(); container = null; }
  setStageBackend('affine');
  useGame.setState({ combatCursor: null });
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** UN PAS : la case logique du sujet est déjà la destination (le store commet AVANT l'animation), la
 *  marche rejoue le trajet depuis la case quittée — le contrat de `bus.emit(ANIM_MOVE)` des deux
 *  producteurs (`combatSlice.battleClickTile`, `useStagePointer.moveAlong`). */
const CHEMIN = [{ x: 1, y: 2 }, { x: 2, y: 2 }];
/** DEUX pas d'un seul trait : ce que le combat émet (chemin ENTIER, un seul événement). */
const COURSE = [{ x: 4, y: 2 }, { x: 3, y: 2 }, { x: 2, y: 2 }];

describe('Marche — qui peint décide de ce qu’une image coûte (#1176 P2-4)', () => {
  it('voie AFFINE : chaque image de marche re-rend le stage (le contrat existant)', () => {
    setStageBackend('affine');
    const { commits } = monter();
    const avant = commits();
    let tick: FrameRequestCallback | null = marcher('h1', CHEMIN);
    for (let i = 0; i < 3; i++) tick = image(tick!, STEP_MS / 8);
    expect(commits()).toBe(avant + 3);
  });

  it('voie VOLUMIQUE : aucune IMAGE ne re-rend le stage — seul un FRANCHISSEMENT de case le fait', () => {
    setStageBackend('webgl');
    const { commits } = monter();
    const avant = commits();
    let tick: FrameRequestCallback | null = marcher('h1', CHEMIN);
    // Sept images, deux cases visuelles seulement : celle qu'on quitte (le sujet y revient à l'ouverture
    // de la marche, sa case logique étant déjà la destination) puis celle qu'on rejoint, franchie à
    // mi-pas. Les cinq autres images ne coûtent rien.
    const paliers: number[] = [];
    for (let i = 0; i < 7; i++) { tick = image(tick!, STEP_MS / 8); paliers.push(commits() - avant); }
    expect(paliers).toEqual([1, 1, 1, 2, 2, 2, 2]);
  });

  it('…et la boucle a bien LU la marche : la caméra du groupe d’overlays glisse image par image', () => {
    setStageBackend('webgl');
    const { el, commits } = monter();
    const avant = commits();
    const vues: string[] = [transform(el)];
    let tick: FrameRequestCallback | null = marcher('h1', CHEMIN);
    for (let i = 0; i < 3; i++) { tick = image(tick!, STEP_MS / 8); vues.push(transform(el)); }
    expect(commits()).toBe(avant + 1); // le seul franchissement de case, jamais une image
    expect(new Set(vues).size).toBe(vues.length); // quatre positions distinctes
  });

  it('ARRIVÉE en volumique : UN rendu re-synchronise React, et la caméra CONVERGE sur la pose committée', () => {
    setStageBackend('webgl');
    const { el, commits } = monter();
    const repos = transform(el); // la caméra de la case LOGIQUE, sans aucun glissement
    let tick: FrameRequestCallback | null = marcher('h1', CHEMIN);
    tick = image(tick!, STEP_MS / 2);
    const avant = commits();
    expect(transform(el)).not.toBe(repos); // prémisse : en plein vol, la caméra est ailleurs
    const suite = image(tick!, STEP_MS); // au-delà de la durée : la marche meurt
    expect(commits()).toBe(avant + 1);
    expect(suite).toBeNull(); // plus rien à animer : la boucle s'arrête
    // La marche n'a pas laissé la vue à côté : la caméra du dernier rendu est EXACTEMENT celle de la
    // case logique — la même chaîne (`camAt` → `stageCamTransform`) qu'au repos, sans marche vivante.
    expect(transform(el)).toBe(repos);
  });
});

/**
 * CE QUE LE POINTEUR LIT PENDANT UNE MARCHE VOLUMIQUE. L'inversion pixel→tuile (`useStagePointer`)
 * n'a qu'UNE source de caméra : la réf que le stage écrit. Tant que le rendu React était le seul à
 * l'écrire, une marche sans rendu la GELAIT — le monde glissait sous un pointeur resté à la caméra du
 * dernier rendu, et le clic visait à côté. La sonde ne bouge JAMAIS la souris : c'est le monde qui
 * bouge sous un pixel FIXE, et elle mesure ENTRE deux franchissements de case, là où AUCUN rendu ne
 * se produit — sinon c'est le rendu qui recalerait la réf, et la boucle ne serait pour rien dans le
 * verdict.
 *
 * Observable : le curseur clavier/manette (`combatCursor`), que le survol n'efface QUE lorsqu'il tombe
 * sur une AUTRE tuile que la précédente (`useStagePointer.onPointerMove`).
 */
describe('Marche volumique — le pointeur suit la caméra image par image (#1176 P2-4)', () => {
  const PIXEL = { x: 640, y: 360 };

  function bouger(el: HTMLDivElement, p: { x: number; y: number }): void {
    const svg = el.querySelector('svg.iso-stage') as SVGSVGElement;
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1280, height: 720, right: 1280, bottom: 720, x: 0, y: 0, toJSON: () => ({}) });
    act(() => { svg.dispatchEvent(new MouseEvent('pointermove', { clientX: p.x, clientY: p.y, bubbles: true })); });
  }

  const curseurPosé = () => useGame.setState({ combatCursor: { tile: { x: 0, y: 0 } } as never });
  const curseurVivant = () => useGame.getState().combatCursor !== null;

  it('la case sous un pixel FIXE change SANS aucun rendu — sinon le clic viserait à côté', () => {
    setStageBackend('webgl');
    const { el, commits } = monter();
    bouger(el, PIXEL);
    // Prémisse 1 — la sonde MORD : deux pixels distincts donnent deux tuiles distinctes, donc l'effacement.
    curseurPosé();
    bouger(el, { x: PIXEL.x + 220, y: PIXEL.y + 120 });
    expect(curseurVivant()).toBe(false);
    // On entre dans le SECOND pas de la marche : de f=0,55 à f=1,45, la case visuelle du marcheur ne
    // change pas (elle vaut 3 sur tout l'intervalle) — donc aucun rendu, et la caméra parcourt tout de
    // même les neuf dixièmes d'une case.
    let tick: FrameRequestCallback | null = marcher('h1', COURSE);
    tick = image(tick!, STEP_MS * 0.55);
    // Prémisse 2 — à cet instant, le même pixel donne deux fois la même tuile : rien ne s'efface.
    bouger(el, PIXEL);
    curseurPosé();
    bouger(el, PIXEL);
    expect(curseurVivant()).toBe(true);
    const avant = commits();
    for (let i = 0; i < 3; i++) tick = image(tick!, STEP_MS * 0.3);
    expect(commits()).toBe(avant); // prémisse 3 : la boucle SEULE a bougé la caméra, React n'a rien rendu
    // MESURE : le même pixel ne tombe plus sur la même tuile.
    bouger(el, PIXEL);
    expect(curseurVivant()).toBe(false);
  });
});

/**
 * INVARIANCE DES CANAUX LOURDS pendant une marche volumique : la cuisson du monde et le tracé des
 * billboards sont les deux passes que la position VISUELLE périmait avant ce lot. Elles ne doivent plus
 * tourner entre deux pas — ni aux images (aucun rendu ne s'y produit), ni à un rendu que le store
 * provoque EN PLEINE marche : l'identité d'un sujet porte sa case LOGIQUE, jamais le glissement.
 */
describe('Marche volumique — ni géométrie ni billboards reconstruits entre deux pas (#1176 P2-4)', () => {
  it('la cuisson du monde et le tracé des billboards ne rejouent AUCUNE fois', () => {
    const cuisson = vi.spyOn(sceneMeshes, 'bakeWorldGeometry');
    const billboards = vi.spyOn(sceneMeshes, 'actorBillboards');
    setStageBackend('webgl');
    monter();
    const cAvant = cuisson.mock.calls.length;
    const bAvant = billboards.mock.calls.length;
    expect(bAvant).toBeGreaterThan(0); // la sonde mord : le montage, lui, en a bien tracé
    let tick: FrameRequestCallback | null = marcher('h1', CHEMIN);
    for (let i = 0; i < 4; i++) tick = image(tick!, STEP_MS / 8);
    expect(cuisson.mock.calls.length).toBe(cAvant);
    expect(billboards.mock.calls.length).toBe(bAvant);
    // Un rendu EN PLEINE marche (le store bouge : ici l'orientation, que le monde volumique lit) : les
    // sujets s'y redérivent, et leur identité ne doit pas avoir bougé d'un demi-pas pour autant.
    act(() => { useGame.getState().setFacing('__sonde-orientation', 'N'); });
    expect(cuisson.mock.calls.length).toBe(cAvant);
    expect(billboards.mock.calls.length).toBe(bAvant);
  });
});

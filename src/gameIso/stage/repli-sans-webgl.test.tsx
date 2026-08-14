// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { useGame } from '../../state/store';
import { emptyScene } from '../../state/scene';
import { getStageBackend, setStageBackend } from '../../state/stage3d';
import type { Combatant } from '../../engine/types';
import { IsoStage } from '../IsoStage';
import { setStageRendererFactory, type StageRenderer } from './GameStage3D';

/**
 * REPLI SANS WEBGL (#1176, P3-4, commit C4). La voie volumique est le DÉFAUT du jeu, prod comprise :
 * un joueur dont la machine refuse le contexte (GPU sur liste noire, machine virtuelle, budget de
 * contextes épuisé) n'a plus AUCUN peintre du monde — `IsoStage` ne monte `CulledScene` que sous
 * `!webgl`. Sans repli, l'écran est nu et muet.
 *
 * Ce banc mesure l'ÉCRAN, pas l'intention : la scène peinte dans le SVG (les polygones de sols/murs
 * de `CulledScene`), sur deux montages APPARIÉS qui ne diffèrent que par la fabrique de renderer —
 * l'une jette, l'autre rend. Le contexte refusé doit produire la voie affine ET un monde peint ; le
 * contexte servi doit laisser le SVG vide de monde (c'est le canevas qui peint).
 */
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TAILLE = { w: 800, h: 600 };

function hero(id: string, pos: { x: number; y: number }): Combatant {
  return {
    id, label: id, kind: 'hero', pos, size: 'moyenne',
    wounds: { current: 12, max: 12 }, weapons: [],
    characteristics: {}, advantage: 0, conditions: [], armour: {},
    skills: [], talents: [], movement: 4,
  } as unknown as Combatant;
}

/** Renderer de banc SERVI : le contexte existe, la voie volumique tient. */
class BancRenderer implements StageRenderer {
  shadowMap = { enabled: false, autoUpdate: true, needsUpdate: false, type: THREE.PCFShadowMap };
  capabilities = { getMaxAnisotropy: () => 1 };
  setPixelRatio(): void {}
  setClearColor(): void {}
  setSize(): void {}
  dispose(): void {}
  render(): void {}
}

let root: Root | null = null;
let conteneur: HTMLDivElement | null = null;

beforeAll(() => {
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientWidth', { configurable: true, get: () => TAILLE.w });
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientHeight', { configurable: true, get: () => TAILLE.h });
});
afterAll(() => setStageRendererFactory(null));

afterEach(() => {
  if (root) { act(() => root!.unmount()); root = null; }
  if (conteneur) { conteneur.remove(); conteneur = null; }
  setStageRendererFactory(null);
  setStageBackend('webgl');
});

/** Monte l'écran de jeu en VOLUMIQUE avec la fabrique donnée, et rend le monde peint DANS LE SVG. */
function monter(fabrique: (canvas: HTMLCanvasElement) => StageRenderer): number {
  const scene = emptyScene(8, 8);
  scene.walls = [{ x: 3, y: 3, side: 'E' }];
  useGame.setState({
    scene,
    mode: 'exploration',
    partyPos: { x: 3, y: 3 },
    party: [hero('h1', { x: 3, y: 3 })],
    battle: null,
    dialogue: null,
    flags: {},
  } as never);
  setStageRendererFactory(fabrique);
  setStageBackend('webgl');
  conteneur = document.createElement('div');
  document.body.appendChild(conteneur);
  root = createRoot(conteneur);
  act(() => root!.render(<IsoStage />));
  return conteneur.querySelectorAll('svg.iso-stage polygon').length;
}

describe('Sans contexte WebGL, le joueur voit le jeu — pas un écran nu (#1176 P3-4)', () => {
  it('contexte REFUSÉ : la voie repasse en affine et le monde SVG est peint', () => {
    const monde = monter(() => { throw new Error('aucun contexte WebGL'); });
    // L'ÉCRAN d'abord : c'est ce que le joueur perd, la voie n'en est que le mécanisme.
    expect(monde, 'le monde SVG doit être PEINT, sinon l’écran reste nu').toBeGreaterThan(0);
    expect(getStageBackend(), 'le repli doit se voir dans la voie, pas seulement à la console').toBe('affine');
  });

  it('contre-épreuve APPARIÉE : contexte servi → la voie reste volumique, le SVG ne peint aucun monde', () => {
    const monde = monter(() => new BancRenderer());
    expect(getStageBackend()).toBe('webgl');
    expect(monde, 'en volumique c’est le canevas qui peint le monde').toBe(0);
  });
});

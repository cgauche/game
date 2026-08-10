// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { useGame } from '../../state/store';
import { emptyScene, type Scene } from '../../state/scene';
import { setStageBackend } from '../../state/stage3d';
import type { Combatant } from '../../engine/types';
import { IsoStage } from '../IsoStage';
import { AMBIANCE } from '../catalog/ambiance';

/**
 * PORTES DE LA MÉTÉO (#1176, P2-6) — une météo authorée a UNE expression par voie, jamais deux, et
 * jamais dedans :
 *  - voie AFFINE : le voile d'écran (`stage/WeatherVeil.tsx`), gaté sur l'ambiance comme les voiles
 *    d'ambiance le sont depuis toujours ;
 *  - voie VOLUMIQUE : le semis qui TOMBE dans le monde (`data-precip` sur le canevas), et plus de
 *    voile — la précipitation le remplace ;
 *  - INTÉRIEUR : rien, des deux côtés.
 */
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

/** Monte le stage sur une scène 8×8 dont la météo et l'ambiance sont celles du cas. */
function monter(meteo: Scene['weather'], ambiance?: Scene['ambiance']): HTMLDivElement {
  const scene = emptyScene(8, 8);
  scene.weather = meteo;
  scene.ambiance = ambiance;
  useGame.setState({
    scene,
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
  act(() => root!.render(<IsoStage />));
  return container;
}

/** Le voile d'écran de la voie affine, reconnu à ce qui le DÉFINIT : un rect peint de la TEINTE que
 *  la donnée donne à cette météo (jamais un sélecteur de position dans l'arbre, qu'un overlay voisin
 *  satisferait). */
const voile = (el: HTMLElement, meteo: Scene['weather']): Element | null => {
  const teinte = meteo && meteo !== 'clair' ? AMBIANCE.iso.weather[meteo]?.tint : undefined;
  if (!teinte) return null;
  return [...el.querySelectorAll('svg.iso-stage rect')].find((r) => r.getAttribute('fill') === teinte) ?? null;
};
/** Le semis volumique : le compte de particules inscrit par le canevas. */
const semis = (el: HTMLElement) => el.querySelector('canvas.iso-stage')?.getAttribute('data-precip') ?? null;

afterEach(() => {
  if (root) { act(() => root!.unmount()); root = null; }
  if (container) { container.remove(); container = null; }
  setStageBackend('affine');
});

describe('Météo — une expression par voie, jamais deux (#1176 P2-6)', () => {
  it('voie AFFINE, extérieur pluvieux : le VOILE est là, aucun semis (pas de canevas du tout)', () => {
    setStageBackend('affine');
    const el = monter('pluie');
    expect(voile(el, 'pluie')).not.toBeNull();
    expect(semis(el)).toBeNull();
  });

  it('voie VOLUMIQUE, extérieur pluvieux : le SEMIS tombe, et le voile d’écran ne se monte plus', () => {
    setStageBackend('webgl');
    const el = monter('pluie');
    expect(Number(semis(el))).toBeGreaterThan(0);
    expect(voile(el, 'pluie')).toBeNull();
    expect(el.querySelectorAll('.wx-p').length).toBe(0); // ni teinte, ni stries d'écran
  });

  it('INTÉRIEUR : ni voile ni semis, quelle que soit la voie et quelle que soit la météo authorée', () => {
    for (const voie of ['affine', 'webgl'] as const)
      for (const meteo of ['pluie', 'neige', 'tempete'] as const) {
        setStageBackend(voie);
        const el = monter(meteo, 'interieur');
        expect(voile(el, meteo)).toBeNull();
        expect(el.querySelectorAll('.wx-p').length).toBe(0);
        expect(semis(el)).toBeNull();
        act(() => root!.unmount());
        root = null;
        el.remove();
        container = null;
      }
  });

  it('météo CLAIRE : rien ne tombe et aucune strie ne traverse l’écran, des deux côtés', () => {
    for (const voie of ['affine', 'webgl'] as const) {
      setStageBackend(voie);
      const el = monter('clair');
      expect(semis(el)).toBeNull();
      expect(el.querySelectorAll('.wx-p').length).toBe(0);
      act(() => root!.unmount());
      root = null;
      el.remove();
      container = null;
    }
  });

  it('le BROUILLARD ne fait tomber aucune particule en volumique (il n’a pas de `precip` en donnée)', () => {
    setStageBackend('webgl');
    const el = monter('brouillard');
    expect(semis(el)).toBeNull();
    // …alors qu'en affine, ce même brouillard TEINTE bien l'écran : la donnée est le seul écart.
    act(() => root!.unmount());
    root = null;
    el.remove();
    container = null;
    setStageBackend('affine');
    expect(voile(monter('brouillard'), 'brouillard')).not.toBeNull();
  });
});

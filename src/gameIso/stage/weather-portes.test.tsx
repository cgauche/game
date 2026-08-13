// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { useGame } from '../../state/store';
import { emptyScene, type Scene } from '../../state/scene';
import { setStageBackend } from '../../state/stage3d';
import type { Combatant } from '../../engine/types';
import { IsoStage } from '../IsoStage';
import { AMBIANCE, weatherLightScalars } from '../catalog/ambiance';

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
/** Les nappes de brume MONTÉES dans le volume, et les deux traces de teinte du canevas (#1247). */
const canevas = (el: HTMLElement) => el.querySelector('canvas.iso-stage');
const nappes = (el: HTMLElement) => canevas(el)?.getAttribute('data-brume') ?? null;
const exposition = (el: HTMLElement) => Number(canevas(el)?.getAttribute('data-lum'));
const fond = (el: HTMLElement) => canevas(el)?.getAttribute('data-bg') ?? null;

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

/**
 * CE QUE LA VOIE VOLUMIQUE MONTRE (#1247) — le lot P2-6 n'exprimait que ce qui TOMBE : le brouillard
 * n'y était rien, et le ciel restait clair sous l'orage. Les contrats POSITIFS de ce lot :
 *  - le brouillard pose des NAPPES dans le volume (`data-brume`) ;
 *  - toute météo authorée assombrit la LUMIÈRE (`data-lum`) et teinte le FOND (`data-bg`) ;
 *  - et cet assombrissement est la MÊME donnée que le voile d'écran de la voie affine — pas une
 *    seconde valeur authorée, donc les deux voies ne peuvent pas diverger.
 */
const AVEC_BRUME = (['brouillard', 'tempete'] as const).filter((m) => AMBIANCE.iso.weather[m]?.brume);
const AUTHORÉES = (['pluie', 'brouillard', 'neige', 'tempete'] as const);

describe('Météo volumique — brume, lumière et fond (#1247)', () => {
  it('BROUILLARD en volumique : des nappes de brume, et toujours aucune particule', () => {
    setStageBackend('webgl');
    const el = monter('brouillard');
    expect(semis(el)).toBeNull();
    expect(Number(nappes(el)), 'le brouillard doit avoir une expression volumique').toBe(
      AMBIANCE.iso.weather.brouillard!.brume!.layers.length,
    );
  });

  it('les types SANS brume authorée n’en montent aucune (la pluie, la neige)', () => {
    for (const meteo of ['pluie', 'neige'] as const) {
      setStageBackend('webgl');
      const el = monter(meteo);
      expect(AMBIANCE.iso.weather[meteo]?.brume, 'témoin : la donnée n’en porte pas').toBeUndefined();
      expect(nappes(el)).toBeNull();
      act(() => root!.unmount());
      root = null;
      el.remove();
      container = null;
    }
  });

  it('INTÉRIEUR : aucune nappe, même sous un brouillard authoré (la porte est celle des deux voies)', () => {
    setStageBackend('webgl');
    expect(nappes(monter('brouillard', 'interieur'))).toBeNull();
  });

  it('la TEMPÊTE éteint la lumière et teinte le fond ; le beau temps ne touche ni l’un ni l’autre', () => {
    setStageBackend('webgl');
    const clair = monter('clair');
    const lumClair = exposition(clair);
    const fondClair = fond(clair);
    act(() => root!.unmount());
    root = null;
    clair.remove();
    container = null;

    const orage = monter('tempete');
    expect(exposition(orage), 'le monde s’assombrit sous l’orage').toBeLessThan(lumClair);
    expect(fond(orage), 'le ciel ne peut pas rester clair sur un monde éteint').not.toBe(fondClair);
  });

  it('PARITÉ : le voile affine et la lumière volumique sortent de la MÊME donnée, et vont dans le MÊME sens', () => {
    // Référence de beau temps, une fois pour toutes les météos.
    setStageBackend('webgl');
    const clair = monter('clair');
    const lumClair = exposition(clair);
    act(() => root!.unmount());
    root = null;
    clair.remove();
    container = null;

    for (const meteo of AUTHORÉES) {
      const { dim } = weatherLightScalars({ weather: meteo, ambiance: 'exterieur' });
      setStageBackend('affine');
      const aff = monter(meteo);
      expect(voile(aff, meteo), `voie affine : ${meteo} porte son voile`).not.toBeNull();
      act(() => root!.unmount());
      root = null;
      aff.remove();
      container = null;

      setStageBackend('webgl');
      const vol = monter(meteo);
      // Le facteur APPARIÉ EN LUMINANCE de la dérivation partagée arrive tel quel sur l'exposition de
      // la frame — c'est le câblage. Comparaison ABSOLUE au millième : la trace `data-lum` est
      // arrondie à quatre décimales, et un rapport de deux valeurs arrondies porte l'erreur des deux.
      expect(exposition(vol), `${meteo} : l’exposition suit le facteur météo dérivé`).toBeCloseTo(lumClair * dim, 3);
      // …et le SENS suit celui du voile d'écran (le contrat, mesuré à part sur les 4 météos réelles).
      expect(Math.sign(exposition(vol) - lumClair), `${meteo} : même sens que le voile affine`).toBe(Math.sign(dim - 1));
      act(() => root!.unmount());
      root = null;
      vol.remove();
      container = null;
    }
  });

  it('les types à brume sont ceux que la DONNÉE désigne — aucun nom de météo au code', () => {
    expect(AVEC_BRUME.length).toBeGreaterThan(0);
    for (const meteo of AVEC_BRUME) {
      setStageBackend('webgl');
      const el = monter(meteo);
      expect(Number(nappes(el))).toBe(AMBIANCE.iso.weather[meteo]!.brume!.layers.length);
      act(() => root!.unmount());
      root = null;
      el.remove();
      container = null;
    }
  });
});

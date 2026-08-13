// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { useGame } from '../../state/store';
import { emptyScene, sceneMetresPerTile, type Scene } from '../../state/scene';
import { setStageBackend } from '../../state/stage3d';
import { setRevealAll } from '../../state/visionState';
import { createHero } from '../../engine/character';
import { makeRNG } from '../../engine/dice';
import type { Dims } from '../../geometry/iso';
import { AMBIANCE } from '../catalog/ambiance';
import { fogCurveOf } from '../pov/camera';
import { PovStage } from '../pov/PovStage';
import { FOG_GAMMA_DEFINE, type MatériauEmbrumable } from '../backends/webgl/sceneMeshes';
import { GameStage3D, setStageRendererFactory, type StageRenderer } from './GameStage3D';

/**
 * BRUME & CIEL DE LA PREMIÈRE PERSONNE (#1176, P3-1c) — l'horizon du POV volumique cesse d'être tranché
 * net sur le fond de canevas. Ce banc mesure les quatre faits du lot sur l'écran RÉEL (le goût, lui, se
 * juge au navigateur) :
 *  1. le monde est embrumé en POV, et par la courbe du MILIEU (portée, début, couleur) ;
 *  2. DEUX couleurs — la brume des SURFACES n'est pas celle du FOND (ciel) ;
 *  3. le GAMMA de la courbe est posé sur les matériaux embrumés, milieu par milieu ;
 *  4. la vue de PLATEAU n'a pas d'horizon : aucune brume, aucun fond, aucun gamma.
 */
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TAILLE = { w: 800, h: 600 };

let root: Root | null = null;
let conteneur: HTMLDivElement | null = null;
let scènes: THREE.Scene[] = [];

class BancRenderer implements StageRenderer {
  shadowMap = { enabled: false, autoUpdate: true, needsUpdate: false, type: THREE.PCFShadowMap };
  capabilities = { getMaxAnisotropy: () => 1 };
  setPixelRatio(): void {}
  setClearColor(): void {}
  setSize(): void {}
  dispose(): void {}
  render(scene: THREE.Scene): void { scènes.push(scene); }
}

/** Pose une scène jouable au store — `interieur` bascule le MILIEU (c'est `isIndoor` qui tranche). */
function poser(ambiance: Scene['ambiance']): Scene {
  const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', rng: makeRNG(1) });
  const scene = emptyScene(12, 12);
  scene.ambiance = ambiance;
  useGame.setState({
    screen: 'campaign', mode: 'exploration', party: [hero], scene,
    partyPos: { x: 4, y: 4 }, facing: { [hero.id]: 'N' },
    dialogue: null, battle: null, povActive: true, lightLevel: 1,
  } as never);
  return scene;
}

function monter(node: JSX.Element): void {
  scènes = [];
  conteneur = document.createElement('div');
  document.body.appendChild(conteneur);
  root = createRoot(conteneur);
  act(() => root!.render(node));
}

function démonter(): void {
  if (root) { act(() => root!.unmount()); root = null; }
  if (conteneur) { conteneur.remove(); conteneur = null; }
}

const dernièreScène = () => scènes[scènes.length - 1];
const hex = (c: THREE.Color) => `#${c.getHexString(THREE.SRGBColorSpace)}`;

/** Les gammas RÉELLEMENT portés par les matériaux embrumés du monde monté. */
function gammasPosés(scene3d: THREE.Scene): Set<string | undefined> {
  const vus = new Set<string | undefined>();
  scene3d.traverse((o) => {
    const porteur = o as THREE.Mesh;
    if (!porteur.material) return;
    const mats = (Array.isArray(porteur.material) ? porteur.material : [porteur.material]) as MatériauEmbrumable[];
    for (const m of mats) if (m.fog) vus.add(m.defines?.[FOG_GAMMA_DEFINE] as string | undefined);
  });
  return vus;
}

/** Les matériaux EMBRUMÉS du monde monté, gardés en main : ils survivent au démontage de l'effet, ce
 *  qui permet de mesurer ce que son nettoyage leur laisse. */
function matériauxEmbrumés(scene3d: THREE.Scene): MatériauEmbrumable[] {
  const out: MatériauEmbrumable[] = [];
  scene3d.traverse((o) => {
    const porteur = o as THREE.Mesh;
    if (!porteur.material) return;
    const mats = (Array.isArray(porteur.material) ? porteur.material : [porteur.material]) as MatériauEmbrumable[];
    for (const m of mats) if (m.fog) out.push(m);
  });
  return out;
}

/** Les pools d'AFFORDANCE montés (surbrillances, marques dynamiques, halos), par nom. */
function chromeMonté(scene3d: THREE.Scene): { nom: string; mat: MatériauEmbrumable }[] {
  const out: { nom: string; mat: MatériauEmbrumable }[] = [];
  scene3d.traverse((o) => {
    if (!/^(marques|marquesDyn|halos):/.test(o.name)) return;
    const porteur = o as THREE.Mesh;
    if (!porteur.material) return;
    const mats = (Array.isArray(porteur.material) ? porteur.material : [porteur.material]) as MatériauEmbrumable[];
    for (const mat of mats) out.push({ nom: o.name, mat });
  });
  return out;
}

beforeAll(() => {
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientWidth', { configurable: true, get: () => TAILLE.w });
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientHeight', { configurable: true, get: () => TAILLE.h });
  setStageRendererFactory(() => new BancRenderer());
  setRevealAll(true);
});
afterAll(() => {
  setStageRendererFactory(null);
  setRevealAll(false);
});
beforeEach(() => { setStageBackend('webgl'); });
afterEach(() => {
  démonter();
  setStageBackend('affine');
});

describe('POV volumique — la BRUME du milieu (#1176 P3-1c)', () => {
  it('EXTÉRIEUR : brume des surfaces sur la courbe du dehors, fond = le dégradé de CIEL', () => {
    const scene = poser('exterieur');
    const mpt = sceneMetresPerTile(scene);
    monter(<PovStage />);
    const s = dernièreScène();
    const fog = s.fog as THREE.Fog;
    expect(fog, 'la première personne a un horizon : il lui faut une brume').toBeTruthy();
    const courbe = fogCurveOf(false);
    expect(fog.near).toBeCloseTo(courbe.start * mpt, 6);
    // …et elle s'éteint EXACTEMENT à la portée de rendu : plus rien n'arrive net à la coupure.
    expect(fog.far).toBeCloseTo(courbe.end * mpt, 6);
    expect(hex(fog.color), 'la brume des SURFACES').toBe(AMBIANCE.pov.fogOutdoorSurface.toLowerCase());

    const fond = s.background as THREE.DataTexture;
    expect(fond?.isTexture, 'le fond porte le dégradé de ciel').toBe(true);
    const d = fond.image.data as Uint8Array;
    const bas = `#${[0, 1, 2].map((k) => d[k].toString(16).padStart(2, '0')).join('')}`;
    expect(bas, 'l’horizon du fond porte la brume de CIEL, pas celle des surfaces').toBe(AMBIANCE.pov.fogOutdoor.toLowerCase());
    expect(bas).not.toBe(hex(fog.color));
  });

  it('INTÉRIEUR : brume sombre et COURTE, fond sombre (aucun ciel sous un toit)', () => {
    const scene = poser('interieur');
    const mpt = sceneMetresPerTile(scene);
    monter(<PovStage />);
    const fog = dernièreScène().fog as THREE.Fog;
    const courbe = fogCurveOf(true);
    expect(fog.near).toBeCloseTo(courbe.start * mpt, 6);
    expect(fog.far).toBeCloseTo(courbe.end * mpt, 6);
    expect(fog.far, 'plus courte que dehors').toBeLessThan(fogCurveOf(false).end * mpt);
    expect(hex(fog.color)).toBe(AMBIANCE.pov.fogIndoor.toLowerCase());
    const fond = dernièreScène().background as THREE.Color;
    expect(fond?.isColor, 'pas de dégradé de ciel en intérieur').toBe(true);
    expect(hex(fond)).toBe(AMBIANCE.pov.fogIndoor.toLowerCase());
  });

  it('le GAMMA de la courbe est posé sur TOUS les matériaux embrumés, et c’est celui du milieu', () => {
    poser('exterieur');
    monter(<PovStage />);
    expect(gammasPosés(dernièreScène())).toEqual(new Set([fogCurveOf(false).gamma.toFixed(4)]));
    démonter();

    poser('interieur');
    monter(<PovStage />);
    expect(gammasPosés(dernièreScène())).toEqual(new Set([fogCurveOf(true).gamma.toFixed(4)]));
  });

  it('le CHROME d’interface n’est PAS de la matière : les pools d’affordance montés n’ont ni brume ni gamma', () => {
    poser('exterieur');
    monter(<PovStage />);
    const chrome = chromeMonté(dernièreScène());
    expect(chrome.length, 'la scène POV monte bien des pools d’affordance (marques dynamiques, halos)').toBeGreaterThanOrEqual(12);
    expect(chrome.filter((c) => c.mat.fog).map((c) => c.nom), 'la brume délaverait une affordance lointaine').toEqual([]);
    expect(chrome.filter((c) => c.mat.defines?.[FOG_GAMMA_DEFINE] !== undefined).map((c) => c.nom)).toEqual([]);
  });

  it('à la SORTIE du POV, le gamma part AVEC la brume (nettoyage de l’effet)', () => {
    poser('exterieur');
    monter(<PovStage />);
    const scène3d = dernièreScène();
    const embrumés = matériauxEmbrumés(scène3d);
    expect(embrumés.length, 'le monde du POV a bien des matériaux embrumés').toBeGreaterThan(0);
    expect(new Set(embrumés.map((m) => m.defines?.[FOG_GAMMA_DEFINE]))).toEqual(new Set([fogCurveOf(false).gamma.toFixed(4)]));

    démonter();
    expect(scène3d.fog, 'la brume se retire au démontage').toBeNull();
    for (const m of embrumés) {
      expect(m.defines?.[FOG_GAMMA_DEFINE], 'un gamma sans brume = une clé de programme orpheline').toBeUndefined();
    }
  });
});

describe('Vue de PLATEAU — pas d’horizon, donc pas de brume (#1176 P3-1c)', () => {
  it('en affine : `scene.fog` nul, aucun fond, aucun gamma sur les matériaux', () => {
    const scene = poser('exterieur');
    const dims: Dims = { w: scene.dimensions.w, h: scene.dimensions.h, rot: 0, view: 'iso' };
    monter(
      <GameStage3D
        scene={scene}
        mpt={sceneMetresPerTile(scene)}
        frame={{ mode: 'affine', dims, cam: { x: 0, y: 0 }, zoom: 1 }}
        tintAt={() => 1}
        keepEl={() => true}
        els={{ tokens: [], props: [] }}
        actors={[]}
        gameTime={720}
        lightLevel={null}
        lights={[]}
      />,
    );
    const s = dernièreScène();
    expect(s.fog, 'une brume de distance délaverait le bord de carte').toBeNull();
    expect(s.background).toBeNull();
    expect(gammasPosés(s), 'aucun matériau ne porte de gamma en vue de plateau').toEqual(new Set([undefined]));
  });
});

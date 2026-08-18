// @vitest-environment jsdom
/**
 * UN BATTEMENT, UNE IMAGE (#1378) — l'écran volumique monté sous ses TROIS motifs continus à la fois :
 * l'averse qui tombe, la flamme qui vacille, le halo qui pulse. Chacun tenait sa propre boucle rAF
 * avec sa propre cession — quatre horloges pour un canevas, 2,2 rendus par image mesurés en rotation.
 *
 * Ce que ce banc tient, sur l'écran câblé comme en production (`VolumetricWorld` ne fournit AUCUN
 * pilote d'images : l'écran s'abonne lui-même au battement) :
 *  1. les trois motifs vivants ne posent qu'UN `requestAnimationFrame` par image et ne peignent qu'un
 *     rendu — le compteur applicatif du canevas (`data-rendus`) dit exactement ce que le renderer a
 *     reçu (un canevas WebGL n'a pas d'arbre à interroger) ;
 *  2. un battement d'une horloge TIERCE (le lacet continu, `state/stageYaw`) dans la MÊME image ne
 *     s'ajoute pas au rendu de la boucle : la cession vit au module, et nulle part ailleurs.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import type { Dims } from '../../geometry/iso';
import type { LightSource } from '../../state/vision';
import { emptyScene, sceneMetresPerTile, type Scene } from '../../state/scene';
import type { InteractionHalos } from '../builders/interactHalos';
import { GameStage3D, setStageRendererFactory, type StageRenderer, type StageWalkAnim } from './GameStage3D';
import { POINT_LIGHT_BUDGET, resolveTone } from './stagePointLights';
import { battreStageFrames, resetStageFrames } from './stageFrames';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Le canevas de jsdom n'a aucune boîte : la passe de dessin sort sur `!w || !h` sans elle. */
const TAILLE = { w: 800, h: 600 };

let scènes: THREE.Scene[] = [];
/** Les rAF POSÉS et non encore servis, et le COMPTE des poses — c'est lui qui dit combien de boucles
 *  tournent : une seule pose par image = une seule horloge. */
let rafs: (() => void)[] = [];
let posesRaf = 0;
let horloge = 0;

class BancRenderer implements StageRenderer {
  shadowMap = { enabled: false, autoUpdate: true, needsUpdate: false, type: THREE.PCFShadowMap };
  capabilities = { getMaxAnisotropy: () => 1 };
  setPixelRatio(): void {}
  setClearColor(): void {}
  setSize(): void {}
  dispose(): void {}
  render(scene: THREE.Scene): void { scènes.push(scene); }
}

/** Scène d'EXTÉRIEUR sous la pluie : c'est elle qui ouvre le semis d'intempéries (le premier motif). */
const SCENE: Scene = (() => {
  const s = emptyScene(8, 8);
  s.weather = 'pluie';
  s.ambiance = 'exterieur';
  return s;
})();
const MPT = sceneMetresPerTile(SCENE);
const NUIT = 23 * 60; // de jour les flaques retombent à 0, et rien ne vacille
/** Une source POSÉE au ton par défaut (`flamme`), donc porteuse d'un vacillement : le deuxième motif. */
const LAMPES: LightSource[] = [{ pos: { x: 4, y: 4 }, radiusTiles: 4, srcId: 'brasero' }];
/** Un décor fouillable à l'écran : le troisième motif. */
const HALOS: InteractionHalos = {
  fouilles: [{ id: 'coffre', cell: { x: 3, y: 4, z: 0 }, span: { w: 1, h: 1 }, centre: { x: 3, y: 4 }, scale: 1, hovered: false, visible: true }],
  pnjs: [],
};
/** Câblage de PRODUCTION (`VolumetricWorld`) : AUCUN pilote d'images — l'écran s'abonne lui-même au
 *  battement du module. Un `subscribe` de plus ici doublerait l'abonnement, donc les rendus. */
const ANIM: StageWalkAnim = {
  glide: () => null,
  cam: () => ({ x: 0, y: 0 }),
};

const dimsDe = (yawDeg: number): Dims => ({ w: SCENE.dimensions.w, h: SCENE.dimensions.h, rot: 0, view: 'iso', yawDeg });

/** `avecAnim` = l'hôte de JEU (qui passe un `anim` pour le glissement) ; sans lui, c'est l'ÉDITEUR
 *  (`ui/editor/EditorCanvas`), qui monte le même écran sans aucune prop d'animation. */
const écran = (yawDeg = 0, avecAnim = true): JSX.Element => (
  <GameStage3D
    scene={SCENE}
    mpt={MPT}
    frame={{ mode: 'plateau', dims: dimsDe(yawDeg), cam: { x: 0, y: 0 }, zoom: 1 }}
    tintAt={() => 1}
    keepEl={() => true}
    els={{ tokens: [], props: [] }}
    actors={[]}
    gameTime={NUIT}
    lightLevel={null}
    lights={LAMPES}
    halos={HALOS}
    {...(avecAnim ? { anim: ANIM } : {})}
  />
);

/** Les écrans MONTÉS par un test — plusieurs à la fois (deux stages coexistent : jeu et aperçu). */
let écrans: { root: Root; hôte: HTMLDivElement }[] = [];

function monter(avecAnim = true): HTMLCanvasElement {
  const hôte = document.createElement('div');
  document.body.appendChild(hôte);
  const root = createRoot(hôte);
  act(() => root.render(écran(0, avecAnim)));
  écrans.push({ root, hôte });
  return hôte.querySelector('canvas.iso-stage') as HTMLCanvasElement;
}

function démonterTout(): void {
  for (const { root, hôte } of écrans) { act(() => root.unmount()); hôte.remove(); }
  écrans = [];
}

/** UNE image du navigateur : l'horloge avance, et les rAF posés sont servis — une passe, une seule. */
function image(avanceMs = 20): void {
  horloge += avanceMs;
  const àServir = rafs.splice(0);
  act(() => àServir.forEach((cb) => cb()));
}

/** Les trois motifs sont-ils VRAIMENT vivants ? Sans ces prémisses, « une seule boucle » serait vrai
 *  du vide — un écran sans pluie, sans flamme et sans halo n'en ouvre aucune. */
function prémisses(canevas: HTMLCanvasElement): void {
  expect(Number(canevas.dataset.precip), 'aucune particule : la boucle de chute n’aurait rien à animer').toBeGreaterThan(0);
  expect(canevas.dataset.lampes, 'aucune flaque allumée : rien ne vacille').toBe(`1/${POINT_LIGHT_BUDGET}`);
  expect(resolveTone(undefined).flicker, 'le ton par défaut ne vacille pas : le deuxième motif serait éteint').toBeDefined();
  expect(HALOS.fouilles.length, 'aucun halo : le troisième motif serait éteint').toBeGreaterThan(0);
}

beforeAll(() => {
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientWidth', { configurable: true, get: () => TAILLE.w });
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientHeight', { configurable: true, get: () => TAILLE.h });
  globalThis.requestAnimationFrame = ((cb: () => void) => {
    posesRaf++;
    rafs.push(cb);
    return rafs.length;
  }) as typeof globalThis.requestAnimationFrame;
  globalThis.cancelAnimationFrame = (() => {}) as typeof globalThis.cancelAnimationFrame;
  setStageRendererFactory(() => new BancRenderer());
});

afterAll(() => setStageRendererFactory(null));

beforeEach(() => {
  scènes = [];
  rafs = [];
  posesRaf = 0;
  // ARDOISE NEUVE du battement : la suite partage ses modules (`isolate: false`) — un écran resté
  // monté dans un autre fichier tiendrait des images sur SON `requestAnimationFrame`, et la boucle ne se
  // réarmerait jamais sur celui de ce banc.
  resetStageFrames();
  // Horloge PILOTÉE, posée LOIN devant : le module partage son dernier battement avec toute la suite
  // (`isolate: false`) — une horloge qui repartirait de zéro n'aurait jamais fini de céder.
  horloge = performance.now() + 1_000_000;
  vi.spyOn(performance, 'now').mockImplementation(() => horloge);
});

afterEach(() => {
  démonterTout();
  resetStageFrames();
  vi.restoreAllMocks();
});

describe('Trois motifs continus — une seule horloge (#1378)', () => {
  it('averse + vacillement + halos : UN rAF posé par image, UN rendu par image', () => {
    const canevas = monter();
    prémisses(canevas);

    const rendusAvant = scènes.length;
    posesRaf = 0;
    const IMAGES = 6;
    for (let i = 0; i < IMAGES; i++) image();

    expect(posesRaf, `${posesRaf} rAF posés pour ${IMAGES} images`).toBe(IMAGES);
    expect(scènes.length - rendusAvant, `${scènes.length - rendusAvant} rendus pour ${IMAGES} images`).toBe(IMAGES);
    // Le compteur applicatif dit ce que le renderer a REÇU : c'est par lui que la recette navigateur
    // lit le même fait sur un canevas qui n'a pas d'arbre.
    expect(canevas.dataset.rendus, 'le compteur du canevas ne suit pas les rendus').toBe(String(scènes.length));
  });

  it('un battement du LACET dans la MÊME image ne double pas le rendu', () => {
    const canevas = monter();
    prémisses(canevas);

    const avant = scènes.length;
    act(() => battreStageFrames()); // le lacet continu bat sur SON horloge (`state/stageYaw`)
    expect(scènes.length, 'le battement doit peindre : sans cela la suite serait vraie du vide').toBe(avant + 1);

    image(1); // moins de `MEME_IMAGE_MS` : c'est la MÊME image
    expect(scènes.length, 'la boucle continue a repeint une image déjà peinte').toBe(avant + 1);

    image(20); // …et l'image SUIVANTE se peint bien
    expect(scènes.length).toBe(avant + 2);
    expect(canevas.dataset.rendus).toBe(String(scènes.length));
  });

  it('ROTATION CONTINUE : la boucle d’image ne coûte qu’un rAF et qu’un rendu par image', () => {
    const canevas = monter();
    prémisses(canevas);
    const IMAGES = 10;
    posesRaf = 0;
    let aLImage = 0;
    for (let i = 0; i < IMAGES; i++) {
      // Le lacet continu (`state/stageYaw`) pose un yaw neuf — un commit React — puis bat sur SON
      // horloge ; ce que ce contrat borne est ce que la boucle d'image ajoute PAR-DESSUS.
      act(() => écrans[0].root.render(écran(10 * (i + 1))));
      act(() => battreStageFrames());
      const avant = scènes.length;
      image();
      aLImage += scènes.length - avant;
    }

    expect(posesRaf, `${posesRaf} rAF posés pour ${IMAGES} images de rotation`).toBe(IMAGES);
    expect(aLImage, `${aLImage} rendus de boucle pour ${IMAGES} images`).toBe(IMAGES);
  });
});

/**
 * L'ÉCRAN TIENT SON DESSIN DU BATTEMENT, SANS PROP (#1378). L'éditeur monte le MÊME `GameStage3D`
 * sans aucun `anim` (`ui/editor/EditorCanvas.tsx`, sa balise n'en porte pas) : une averse qui tient le
 * battement sans que personne ne dessine, c'est une pluie armée et GELÉE.
 */
describe('Battement sans hôte — l’écran s’abonne de lui-même', () => {
  it('SANS anim : les images demandées par l’averse sont PEINTES', () => {
    const canevas = monter(false);
    expect(Number(canevas.dataset.precip), 'prémisse : il doit pleuvoir, sinon rien ne demande d’image').toBeGreaterThan(0);

    const rendusAvant = scènes.length;
    posesRaf = 0;
    const IMAGES = 6;
    for (let i = 0; i < IMAGES; i++) image();

    expect(posesRaf, 'la boucle doit être armée : sans elle, « rien ne peint » serait vrai du vide').toBe(IMAGES);
    expect(scènes.length - rendusAvant, `${scènes.length - rendusAvant} rendus pour ${IMAGES} images sans anim`).toBe(IMAGES);
    expect(canevas.dataset.rendus).toBe(String(scènes.length));
  });
});

/**
 * CESSION DU COMMIT (#1378). Un commit React redessine le stage hors du battement ; l'horloge du
 * module doit le voir, sinon la boucle repeint la même image du navigateur (mesuré avant : 4 rendus
 * dans l'image d'un commit).
 */
describe('Image peinte par un commit — la boucle cède', () => {
  it('commit puis rAF servi 2 ms après : aucun rendu de plus', () => {
    const canevas = monter();
    prémisses(canevas);
    for (let i = 0; i < 3; i++) image(); // régime établi

    horloge += 20; // image N du navigateur
    const avant = scènes.length;
    act(() => écrans[0].root.render(écran(10)));
    const aprèsCommit = scènes.length;
    expect(aprèsCommit - avant, 'le commit doit peindre : sans cela il n’y aurait rien à céder').toBeGreaterThan(0);

    horloge += 2; // MOINS de `MEME_IMAGE_MS` : la boucle sert son rAF dans la MÊME image
    const àServir = rafs.splice(0);
    act(() => àServir.forEach((cb) => cb()));

    expect(scènes.length - aprèsCommit, 'la boucle a repeint une image que le commit venait de peindre').toBe(0);
  });
});

/**
 * DEUX ÉCRANS MONTÉS (#1378). Les sources sont des clés d'INSTANCE : le même motif vivant sur deux
 * écrans en pose deux, et le démontage de l'un ne relâche jamais les images de l'autre (une clé
 * partagée — le nom du motif — les confondrait, et le second écran se figerait).
 */
describe('Deux écrans — aucun ne relâche les images de l’autre', () => {
  it('démonter le premier laisse le second recevoir ses images', () => {
    const c1 = monter();
    const c2 = monter();
    expect(Number(c1.dataset.precip), 'prémisse : les deux écrans ont bien leur averse').toBeGreaterThan(0);
    expect(Number(c2.dataset.precip)).toBeGreaterThan(0);
    image();

    const { root, hôte } = écrans.shift()!;
    act(() => root.unmount());
    hôte.remove();

    const avantC2 = Number(c2.dataset.rendus);
    image();

    expect(Number(c2.dataset.rendus) - avantC2, 'le démontage du premier a coupé les images du second').toBe(1);
  });

  it('l’écran DÉMONTÉ ne dessine plus : un seul rendu par battement', () => {
    const c1 = monter();
    const c2 = monter();
    expect(Number(c1.dataset.precip), 'prémisse : les deux écrans peignent').toBeGreaterThan(0);
    expect(Number(c2.dataset.precip)).toBeGreaterThan(0);
    image();

    const { root, hôte } = écrans.shift()!;
    act(() => root.unmount());
    hôte.remove();

    const avant = scènes.length;
    const mortAvant = Number(c1.dataset.rendus);
    horloge += 20;
    act(() => battreStageFrames());

    expect(scènes.length - avant, 'un écran démonté peint encore : son abonnement a fui').toBe(1);
    expect(Number(c1.dataset.rendus), 'l’écran mort a redessiné').toBe(mortAvant);
  });
});

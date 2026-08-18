// @vitest-environment jsdom
/**
 * UN FRANCHISSEMENT DE CRAN EST UNE REPOSE — mesuré sur l'écran monté, au chemin RÉEL de la
 * rotation en jeu (le lacet continu pose `Dims.yawDeg`, dont `artRot` PLANCHÉRISE le cran).
 *
 * Trois faits, chacun réfutable seul, et chacun avec une panne coûteuse en face :
 *  1. les quads SURVIVENT au quart de tour — aucun `dispose`, aucune identité perdue (le rebuild du
 *     groupe entier libérait matériaux et géométries de TOUT le décor à chaque quart : 55-380 ms de
 *     gel mesurés en recette) ;
 *  2. aucune rasterisation SYNCHRONE au franchissement — un cran jamais visité passe par la file
 *     cadencée du cuiseur, et le quad garde son art jusqu'à la relève ;
 *  3. après la relève, l'art montré est bien celui du NOUVEAU cran — décor (texture échangée en place)
 *     comme corps à flipbook (planche du cran choisie par l'image).
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { emptyScene, sceneMetresPerTile, type Scene } from '../../state/scene';
import { createHero } from '../../engine/character';
import { makeRNG } from '../../engine/dice';
import type { Rot } from '../../geometry/iso';
import type { PropEl } from '../builders/types';
import type { ActorPose, KeepEl, SceneBillboardEls, TintAt } from '../backends/webgl/sceneMeshes';
import { atlasLayout, billboardView } from '../backends/webgl/billboardMath';
import * as svgTexture from '../backends/webgl/svgTexture';
import * as atlasBake from '../backends/webgl/atlasBake';
import { bakeQueueLength, clearAtlasCache, resetBakeQueue } from '../backends/webgl/atlasBake';
import { GameStage3D, setStageRendererFactory, type StageFrame, type StageRenderer, type StageWalkAnim } from './GameStage3D';
import { frameRectOf } from './boardPose';
import { subscribeStageFrames } from './stageFrames';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TAILLE = { w: 800, h: 600 };
const SCENE: Scene = emptyScene(12, 12);
const MPT = sceneMetresPerTile(SCENE);
const HÉROS = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', rng: makeRNG(1) });
const ACTEURS: ActorPose[] = [{ c: HÉROS, x: 4, y: 4, z: 0, facing: 'S' }];
/** Teinte et dégagement STABLES : le groupe de billboards se rebâtit sur l'IDENTITÉ de ses entrées —
 *  une lambda par rendu le remonterait à chaque image, et la mesure porterait sur le banc. */
const TINT: TintAt = () => 1;
const KEEP: KeepEl = () => true;
/** Liste d'acteurs VIDE et stable — même raison : `[]` reforgé par rendu remonte tout le groupe. */
const SANS_ACTEUR: ActorPose[] = [];

const décor = (id: string, x: number): PropEl => ({
  kind: 'prop', source: 'entity', key: `prop:${id}`, ref: 'tonneau', facing: 'S',
  cell: { x, y: 4, z: 0 }, foot: { offX: 0, offY: 0, scale: 1 }, interact: false,
  states: { visible: true },
} as unknown as PropEl);

const ELS: SceneBillboardEls = { tokens: [], props: [décor('a', 6), décor('b', 7), décor('c', 8)] };

/** Le cadre de plateau à un LACET donné — la forme que le lacet continu passe au stage (`dimsVue`). */
const cadre = (yawDeg: number): StageFrame => ({
  mode: 'plateau',
  dims: { ...SCENE.dimensions, rot: 0, view: 'iso', yawDeg },
  cam: { x: 6, y: 6 },
  zoom: 1,
});

class BancRenderer implements StageRenderer {
  shadowMap = { enabled: false, autoUpdate: true, needsUpdate: false, type: THREE.PCFShadowMap };
  capabilities = { getMaxAnisotropy: () => 1 };
  setPixelRatio(): void {}
  setClearColor(): void {}
  setSize(): void {}
  dispose(): void {}
  render(scene: THREE.Scene): void { scènes.push(scene); }
}

let scènes: THREE.Scene[] = [];
let root: Root | null = null;
let hôte: HTMLDivElement | null = null;
let battre: (() => void) | null = null;
let urlAvant: { create: typeof URL.createObjectURL; revoke: typeof URL.revokeObjectURL } | null = null;

const anim: StageWalkAnim = {
  subscribe: (onFrame) => { battre = onFrame; return () => { battre = null; }; },
  glide: () => null,
  cam: () => ({ x: 6, y: 6 }),
};

/** Rasterisation SIMULÉE au niveau du DOM (jamais par mock de module) — sans elle, jsdom ne résout
 *  aucune texture de billboard et AUCUN board n'est monté : toute mesure porterait sur le vide. */
function simulerRasterisation(): void {
  vi.stubGlobal('Image', class {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_v: string) { queueMicrotask(() => this.onload?.()); }
  });
  urlAvant = { create: URL.createObjectURL, revoke: URL.revokeObjectURL };
  URL.createObjectURL = () => 'blob:banc';
  URL.revokeObjectURL = () => undefined;
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: () => undefined } as unknown as CanvasRenderingContext2D);
}

function vue(
  yawDeg: number,
  els: SceneBillboardEls = ELS,
  acteurs: ActorPose[] = ACTEURS,
  animUtilisée: StageWalkAnim = anim,
  keepEl: KeepEl = KEEP,
): JSX.Element {
  return (
    <GameStage3D
      scene={SCENE}
      mpt={MPT}
      frame={cadre(yawDeg)}
      tintAt={TINT}
      keepEl={keepEl}
      els={els}
      actors={acteurs}
      gameTime={720}
      lightLevel={1}
      lights={[]}
      anim={animUtilisée}
    />
  );
}

/** Laisse tourner la file du cuiseur (une rasterisation par tranche), en battant la boucle d'image. */
async function respirer(ms: number): Promise<void> {
  const fin = Date.now() + ms;
  do {
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    if (battre) act(() => battre!());
  } while (Date.now() < fin);
}

async function monter(
  els: SceneBillboardEls = ELS,
  acteurs: ActorPose[] = ACTEURS,
  animUtilisée: StageWalkAnim = anim,
): Promise<void> {
  scènes = [];
  hôte = document.createElement('div');
  document.body.appendChild(hôte);
  root = createRoot(hôte);
  await act(async () => { root!.render(vue(0, els, acteurs, animUtilisée)); });
  await respirer(40);
}

/** Tous les quads de billboard montés (les corps, jamais leurs jumeaux de silhouette). */
function quads(): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  scènes[scènes.length - 1]?.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && !m.userData.emprunte && frameRectOf(m.material as THREE.Material)) out.push(m);
  });
  return out;
}

const mapDe = (m: THREE.Mesh) => (m.material as THREE.MeshBasicMaterial).map;

beforeAll(() => {
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientWidth', { configurable: true, get: () => TAILLE.w });
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientHeight', { configurable: true, get: () => TAILLE.h });
  setStageRendererFactory(() => new BancRenderer());
});
afterAll(() => setStageRendererFactory(null));

beforeEach(() => simulerRasterisation());
afterEach(() => {
  if (root) { act(() => root!.unmount()); root = null; }
  if (hôte) { hôte.remove(); hôte = null; }
  battre = null;
  resetBakeQueue();
  clearAtlasCache();
  svgTexture.clearBillboardTextures();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  if (urlAvant) { URL.createObjectURL = urlAvant.create; URL.revokeObjectURL = urlAvant.revoke; urlAvant = null; }
});

describe('Cran franchi — les quads SURVIVENT', () => {
  it('ni matériau ni géométrie libérés, et pas un seul quad remplacé', async () => {
    await monter();
    const avant = quads();
    // PRÉMISSE — sans quads montés, « rien n'est libéré » serait vrai du vide.
    expect(avant.length, 'aucun board monté : rien à mesurer').toBeGreaterThan(0);
    const disposeMat = vi.spyOn(THREE.Material.prototype, 'dispose');
    const disposeGeo = vi.spyOn(THREE.BufferGeometry.prototype, 'dispose');

    // FRANCHISSEMENT : le lacet passe le quart (`artRot` : 100° ⇒ cran 1).
    await act(async () => { root!.render(vue(100)); });
    await respirer(60);

    expect(disposeMat, 'le groupe entier se libère au quart de tour : c’est LE gel signalé').not.toHaveBeenCalled();
    expect(disposeGeo, 'une géométrie de quad refaite au quart de tour, c’est une repose ratée').not.toHaveBeenCalled();
    const après = quads();
    expect(après.length, 'le compte de quads ne change pas d’un cran à l’autre').toBe(avant.length);
    expect(après.filter((m) => avant.includes(m)).length, 'les quads doivent être les MÊMES objets').toBe(avant.length);
  });

  it('un tour COMPLET (quatre quarts) ne libère toujours rien', async () => {
    await monter();
    const avant = quads();
    expect(avant.length).toBeGreaterThan(0);
    const disposeMat = vi.spyOn(THREE.Material.prototype, 'dispose');
    for (const yaw of [100, 190, 280, 370]) {
      await act(async () => { root!.render(vue(yaw)); });
      await respirer(40);
    }
    expect(disposeMat).not.toHaveBeenCalled();
    expect(quads().filter((m) => avant.includes(m)).length).toBe(avant.length);
  });
});

describe('Cran franchi — aucune rasterisation en rafale', () => {
  it('cache FROID : rien ne rasterise dans l’image du franchissement, tout part en FILE', async () => {
    await monter();
    const quadsAvant = quads();
    expect(quadsAvant.length).toBeGreaterThan(0);
    const artAvant = quadsAvant.map(mapDe);
    // Cache VIDÉ : le cran d'arrivée n'a plus une seule texture servie — le cas du premier passage,
    // sans le secours de la pré-chauffe.
    svgTexture.clearBillboardTextures();
    resetBakeQueue();
    // La sonde se pose sur `svgToTexture`, la couture que l'écran APPELLE : `rasterizeSvg` lui est
    // interne, donc hors de portée d'un espion de module (le dépôt le documente déjà —
    // `flipbook-frames.test.tsx`, « sa texture statique ne passe pas par ici »). Un espion posé là ne
    // verrait jamais rien, et l'assertion serait vide.
    const statique = vi.spyOn(svgTexture, 'svgToTexture');

    // Rendu SYNCHRONE : aucune tranche d'inactivité ne peut s'intercaler entre le franchissement et la
    // mesure — ce que la file a différé y est encore différé, et ce qu'elle n'aurait pas différé s'y
    // serait déjà exécuté.
    act(() => { root!.render(vue(100)); });

    expect(statique, 'une rafale de rasterisations dans l’image, c’est ~10 ms de mur chacune').not.toHaveBeenCalled();
    expect(bakeQueueLength(), 'les cuissons du cran neuf doivent être EN FILE, pas exécutées').toBeGreaterThan(0);
    // …et l'art du cran PRÉCÉDENT reste à l'écran tant que la relève n'est pas venue : rien ne clignote.
    expect(quads().map(mapDe).every((t, i) => t === artAvant[i]), 'le quad a perdu son art avant la relève').toBe(true);
    // PRÉMISSE — la sonde MORD : ces mêmes textures rasterisent bien PAR ELLE, une fois la file servie.
    await respirer(120);
    expect(statique.mock.calls.length, 'espion branché à côté : « zéro appel » ne dirait rien').toBeGreaterThan(0);
  });

  it('la file SERT ensuite : les textures du cran neuf arrivent, et l’art change', async () => {
    await monter();
    const artAvant = quads().map(mapDe);
    svgTexture.clearBillboardTextures();
    resetBakeQueue();
    await act(async () => { root!.render(vue(100)); });
    // Budget BORNÉ : la file sert une rasterisation par tranche — on la laisse tourner jusqu'à la
    // première relève, jamais au-delà de ce budget.
    let changés = 0;
    for (let i = 0; i < 20 && changés === 0; i++) {
      await respirer(20);
      changés = quads().filter((m, k) => mapDe(m) !== artAvant[k]).length;
    }
    expect(changés, 'aucune relève : le décor resterait peint au cran précédent').toBeGreaterThan(0);
  });
});

/**
 * L'ORDRE DE SERVICE de la file, sur une carte à la densité d'une vraie scène (20 décors, donc 60
 * textures de pré-chauffe en attente au moment du franchissement).
 *
 * Ce que ce contrat tient : la relève de ce que la caméra REGARDE passe DEVANT le réchauffage déjà
 * posé. La panne en face est silencieuse et coûteuse — la mémoïsation rend la promesse déjà en file
 * sans relever son rang, et le décor reste peint au cran quitté le temps que toute la pré-chauffe
 * défile (mesuré avant le lot : 56 rasterisations pour 20 utiles ; ~2 s sur une carte à 68 entités).
 */
describe('Cran franchi — la relève passe devant la pré-chauffe', () => {
  const DENSE: SceneBillboardEls = {
    tokens: [],
    props: Array.from({ length: 20 }, (_, i) => décor(`d${i}`, 2 + (i % 10))),
  };

  it('20 décors : les rasterisations servies jusqu’à la relève COMPLÈTE restent au minimum utile', async () => {
    const statique = vi.spyOn(svgTexture, 'svgToTexture');
    await monter(DENSE, SANS_ACTEUR);
    // Le montage servi, la pré-chauffe des trois autres crans est EN FILE — c'est elle que la relève
    // doit doubler.
    await respirer(80);
    const avantQuads = quads();
    expect(avantQuads.length, 'aucun décor monté : rien à mesurer').toBe(DENSE.props.length);
    expect(bakeQueueLength(), 'PRÉMISSE : la pré-chauffe doit être en file au franchissement').toBeGreaterThan(0);
    const artAvant = avantQuads.map(mapDe);
    const avant = statique.mock.calls.length;

    await act(async () => { root!.render(vue(100, DENSE, SANS_ACTEUR)); });
    let relevés = 0;
    for (let i = 0; i < 60 && relevés < artAvant.length; i++) {
      await respirer(20);
      relevés = quads().filter((m, k) => mapDe(m) !== artAvant[k]).length;
    }
    const servies = statique.mock.calls.length - avant;

    expect(relevés, 'tous les décors doivent finir relevés').toBe(artAvant.length);
    // MINIMUM UTILE = une texture par décor (moins celles que la pré-chauffe a eu le temps de servir :
    // 12 mesurées ici pour 20 décors). Le plafond tient donc au minimum utile, jamais à un défilé de
    // pré-chauffe — sans la relève de rang, la même mesure donnait 48.
    expect(servies, `${servies} rasterisations servies pour ${artAvant.length} utiles`).toBeLessThanOrEqual(artAvant.length);
  });
});

describe('Cran franchi — l’art est celui du NOUVEAU cran', () => {
  it('DÉCOR : la texture posée est celle demandée pour le cran d’arrivée', async () => {
    const servies = new Map<string, Promise<THREE.Texture>>();
    const original = svgTexture.getBillboardTexture;
    vi.spyOn(svgTexture, 'getBillboardTexture').mockImplementation((clé, faire) => {
      const p = original(clé, faire);
      servies.set(clé, p);
      return p;
    });
    await monter();
    expect(quads().length).toBeGreaterThan(0);

    await act(async () => { root!.render(vue(100)); });

    // Les décors sont les seuls sujets dont l'identité de cache porte le cran (`|r<n>`).
    const clésCran1 = () => [...servies.keys()].filter((k) => k.startsWith('prop:') && k.includes('|r1|'));
    const toutesPosées = async (): Promise<boolean> => {
      const clés = clésCran1();
      if (clés.length < ELS.props.length) return false;
      const textures = await Promise.all(clés.map((k) => servies.get(k)!));
      const posées = new Set(quads().map(mapDe));
      return textures.every((t) => posées.has(t));
    };
    // Budget BORNÉ : la file sert une rasterisation par tranche — on l'attend jusqu'à la relève des
    // trois décors, jamais au-delà.
    let relevés = false;
    for (let i = 0; i < 20 && !relevés; i++) {
      await respirer(20);
      relevés = await toutesPosées();
    }
    expect(clésCran1().length, 'aucune texture demandée au cran 1 : le décor est resté au cran 0').toBe(ELS.props.length);
    expect(relevés, 'une texture du cran 1 cuite mais jamais posée sur son quad').toBe(true);
  });

  it('CORPS À FLIPBOOK : la planche jouée est celle de la vue du cran d’arrivée', async () => {
    // Planches SERVIES SANS RASTERISATION (une cellule coûte ~10 ms de mur) : la GRILLE reste réelle.
    vi.spyOn(atlasBake, 'bakeAtlas').mockImplementation(async (_draw, _box, n) => {
      const layout = atlasLayout(24, 30, n);
      return { texture: new THREE.CanvasTexture(document.createElement('canvas')), layout, bytes: layout.texW * layout.texH * 4 };
    });
    const clés: string[] = [];
    const original = atlasBake.getCachedAtlas;
    vi.spyOn(atlasBake, 'getCachedAtlas').mockImplementation((k: string) => { clés.push(k); return original(k); });

    await monter();
    await respirer(120);
    const vueDe = (rot: Rot) => billboardView({ kind: 'ortho', yawDeg: rot * 90 }, 'S');
    const marque = (rot: Rot) => `|${vueDe(rot).view}|${vueDe(rot).mirror ? 'm' : 'd'}|`;
    // PRÉMISSE — sans elle, la mesure d'arrivée ne dirait rien : les deux crans doivent DIFFÉRER de vue.
    expect(marque(0), 'crans indiscernables : cette garde ne mordrait pas').not.toBe(marque(1));
    expect(clés.length, 'aucune planche réclamée : le corps ne joue pas').toBeGreaterThan(0);
    expect(clés[clés.length - 1], 'PRÉMISSE : le corps doit jouer la vue de son cran de montage').toContain(marque(0));

    clés.length = 0;
    await act(async () => { root!.render(vue(100)); });
    // Budget BORNÉ : la planche du cran d'arrivée est réchauffée au montage, mais la file la sert à SON
    // tour — on bat la boucle d'image jusqu'à ce que le corps la joue, jamais au-delà.
    for (let i = 0; i < 20 && !(clés[clés.length - 1] ?? '').includes(marque(1)); i++) await respirer(20);
    expect(clés.length, 'aucune planche réclamée : le corps ne joue plus').toBeGreaterThan(0);
    expect(clés[clés.length - 1], 'le corps joue encore la planche du cran quitté').toContain(marque(1));
  });
});

/**
 * LE SOL AUSSI EST REPOSÉ (#1376). Les accents de sol (touffes/mouchetis instanciés) sont montés sur
 * le SEMIS ; le franchissement d'un cran ne leur passe qu'une référence de `KeepEl` neuve, pour un
 * verdict identique. Les remonter là libérait leurs matériaux et géométries — un `deleteProgram` +
 * `linkProgram` et ~300 Ko de sommets ré-uploadés par quart de tour, mesurés au profil.
 */
describe('Cran franchi — les ACCENTS DE SOL survivent', () => {
  /** Les `InstancedMesh` du groupe accents : leur nom est la clé de lot (`type|couleur`). */
  function lotsAccents(): THREE.InstancedMesh[] {
    const out: THREE.InstancedMesh[] = [];
    scènes[scènes.length - 1]?.traverse((o) => {
      const m = o as THREE.InstancedMesh;
      if (m.isInstancedMesh && /^(tuft|speckle)\|/.test(m.name)) out.push(m);
    });
    return out;
  }

  it('ni matériau ni géométrie libérés, mêmes meshes, mêmes comptes d’instances', async () => {
    await monter();
    const avant = lotsAccents();
    // PRÉMISSE — sans semis monté, « rien n'est libéré » serait vrai du vide.
    expect(avant.length, 'aucun lot d’accents monté : rien à mesurer').toBeGreaterThan(0);
    const comptes = avant.map((m) => m.count);
    expect(comptes.reduce((a, b) => a + b, 0), 'un semis vide ne prouverait rien').toBeGreaterThan(0);
    const disposeMat = vi.spyOn(THREE.Material.prototype, 'dispose');
    const disposeGeo = vi.spyOn(THREE.BufferGeometry.prototype, 'dispose');

    // FRANCHISSEMENT tel que l'écran le sert : le dégagement est reforgé au cran (`keepEl` dépend des
    // `dims`, qui portent le lacet) — même verdict, référence NEUVE.
    await act(async () => { root!.render(vue(100, ELS, ACTEURS, anim, () => true)); });
    await respirer(60);

    expect(disposeMat, 'le semis se libère au quart de tour : c’est le relink de shader mesuré').not.toHaveBeenCalled();
    expect(disposeGeo).not.toHaveBeenCalled();
    const après = lotsAccents();
    expect(après.map((m) => m.name)).toEqual(avant.map((m) => m.name));
    expect(après.filter((m) => avant.includes(m)).length, 'les lots doivent être les MÊMES objets').toBe(avant.length);
    expect(après.map((m) => m.count)).toEqual(comptes);
  });
});

/**
 * COALESCENCE DES RELÈVES (#1376) : un board relevé demande UNE IMAGE (`demanderUneImage`), il ne
 * peint pas. Vingt boards relevés dans la même image en obtiennent une seule — là où un rendu complet
 * par board coûtait 63 rendus par franchissement en exploration (331 ms mesurés).
 */
describe('Cran franchi — N relèves, UNE image', () => {
  const DENSE: SceneBillboardEls = {
    tokens: [],
    props: Array.from({ length: 20 }, (_, i) => décor(`c${i}`, 2 + (i % 10))),
  };
  /** Câblage de PRODUCTION : le stage s'abonne au battement du module (`VolumetricWorld`). */
  const animProd: StageWalkAnim = {
    subscribe: subscribeStageFrames,
    glide: () => null,
    cam: () => ({ x: 6, y: 6 }),
  };
  /** Une image du navigateur, servie pour de bon (jsdom cadence son rAF). */
  const uneImage = async (): Promise<void> => {
    await act(async () => { await new Promise<void>((r) => requestAnimationFrame(() => r())); });
  };

  it('vingt boards relevés au cran d’arrivée ne peignent pas vingt frames', async () => {
    await monter(DENSE, SANS_ACTEUR, animProd);
    await respirer(120);
    expect(quads().length, 'aucun décor monté : rien à mesurer').toBe(DENSE.props.length);
    const artCran0 = quads().map(mapDe);
    expect(artCran0.every(Boolean), 'un décor sans art : le cran 0 n’est pas servi').toBe(true);

    // Aller au cran 1 et l'attendre COMPLET : les textures des deux crans sont alors en cache, donc
    // les vingt relèves du RETOUR tombent dans la même image — c'est la rafale qu'on mesure.
    await act(async () => { root!.render(vue(100, DENSE, SANS_ACTEUR, animProd)); });
    let relevés = 0;
    for (let i = 0; i < 60 && relevés < DENSE.props.length; i++) {
      await respirer(20);
      relevés = quads().filter((m, k) => mapDe(m) !== artCran0[k]).length;
    }
    expect(relevés, 'le cran 1 n’est pas servi en entier : le retour ne serait pas en cache').toBe(DENSE.props.length);

    const avant = scènes.length;
    await act(async () => { root!.render(vue(10, DENSE, SANS_ACTEUR, animProd)); });
    await uneImage();
    const rendus = scènes.length - avant;

    // PRÉMISSE — sans relève effective, « peu de rendus » ne dirait rien.
    expect(quads().map(mapDe), 'les vingt décors doivent être revenus au cran 0').toEqual(artCran0);
    expect(rendus, `${rendus} rendus pour ${DENSE.props.length} relèves`).toBeLessThan(DENSE.props.length);
  });
});

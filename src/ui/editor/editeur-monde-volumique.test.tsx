// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import * as THREE from 'three';
import { EditorCanvas } from './EditorCanvas';
import { DEFAULT_LAYERS } from './editorState';
import { emptyScene, type Scene } from '../../state/scene';
import { tileCenter } from '../../geometry/iso';
import { setStageBackend } from '../../state/stage3d';
import { setStageRendererFactory, type StageRenderer } from '../../gameIso/stage/GameStage3D';
import { hasSpritePicker } from '../../gameIso/stage/spritePicker';
import { buildTokens } from '../../gameIso/builders/tokens';
import { scenario as scenarioToits } from '../../scenes/test-scenarios/zones-pieces';
import type { PlanDefectAt } from '../../state/planDefects';

/**
 * L'ÉDITEUR SUR LA VOIE VOLUMIQUE (#1176, P3-3, vague A). Ce qui se mesure ici :
 *  - la voie est EXCLUSIVE (le monde se peint une fois) et le SVG d'authoring RESTE, au-dessus ;
 *  - le picking de l'éditeur ne bascule PAS : aucun picker de sprite n'est inscrit (il resterait
 *    inscrit pour le JEU — le registre est un singleton) ;
 *  - la CADENCE de la cuisson : un geste qui ne touche pas le read-set du monde n'en recuit rien, un
 *    TRAIT de pinceau reste sur la cuisson d'avant le geste, et le RELÂCHÉ en paie exactement une.
 * `data-bake` est la seule trace lisible de cette dernière : un canevas WebGL n'a pas d'arbre.
 */
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** La DERNIÈRE scène three que le renderer a reçue — par où se mesurent les faces réellement
 *  dessinées (le dégagement d'authoring compacte l'index du monde cuit, il ne le reconstruit pas). */
let derniereScene: THREE.Scene | null = null;

/** Renderer de banc : jsdom n'a aucun contexte WebGL, et cet écran n'en demande pas plus que ça. */
function rendererDeBanc(): StageRenderer {
  return {
    setPixelRatio: () => {},
    setClearColor: () => {},
    setSize: () => {},
    render: (scene: THREE.Scene) => { derniereScene = scene; },
    dispose: () => {},
    shadowMap: { enabled: false, autoUpdate: false, needsUpdate: false, type: THREE.PCFShadowMap },
    capabilities: { getMaxAnisotropy: () => 1 },
  };
}

/** FACES du monde réellement dessinées à la dernière frame : le mesh du monde porte la géométrie
 *  CUITE (marquée `emprunte`), dont `applyCutawayMask` a compacté les plages de dessin. */
function facesDessinees(): number {
  let total = 0;
  derniereScene?.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.userData.emprunte && m.geometry) total += m.geometry.groups.reduce((s, g) => s + g.count, 0);
  });
  return total;
}

beforeAll(() => setStageRendererFactory(rendererDeBanc));

/** Scène d'atelier : du sol partout (le SVG affine en peint les losanges), aucune entité — les
 *  billboards n'ont alors rien à rasteriser, ce que jsdom ne saurait pas faire. */
function sceneAtelier(): Scene {
  return emptyScene(8, 8);
}

/** La même, plus un ENNEMI D'EMBUSCADE (`hiddenUntilCombat`) ENRÔLÉ dans une rencontre — invisible EN
 *  JEU avant le combat, et dont l'auteur ne voyait plus que l'empreinte pointillée : un cadre vide. */
function sceneEmbuscade(): Scene {
  const s = emptyScene(8, 8);
  const embusque = {
    id: 'embusque-1', kind: 'personnage', pos: { x: 3, y: 3 }, ref: 'brigand',
    combat: { hiddenUntilCombat: true },
  } as unknown as Scene['entities'][number];
  const rencontre = { id: 'guet-apens', members: [{ entityId: 'embusque-1' }] } as unknown as Scene['encounters'][number];
  return { ...s, entities: [embusque], encounters: [rencontre] };
}

function baseProps() {
  return {
    pushSnapshot: () => {},
    brush: 1,
    terrainRect: false,
    encTarget: '',
    setEncTarget: () => {},
    encRef: '',
    layers: DEFAULT_LAYERS,
    sel: null,
    planFocus: null as PlanDefectAt | null,
    onSelect: () => {},
    onHover: () => {},
    stairRun: [],
    onStairTrace: () => {},
    currentLayer: 0,
    architectureMode: false,
    architectureBodyId: null,
    architectureZ: null,
    architectureAction: 'select' as const,
    onArchitectureActionComplete: () => {},
    traceLayer: null,
    lowerLayerOpacity: 0.22,
    lowerLayerMode: 'gabarit' as const,
    traceCalibStep: 'idle' as const,
    onTraceCalibClick: () => {},
  };
}

function vueTop() {
  return {
    rot: 0 as const,
    setRot: () => {},
    viewMode: 'top' as const,
    setViewMode: () => {},
    view: { zoom: 1, x: 0, y: 0 },
    setView: () => {},
    zoomAt: () => {},
    spaceRef: { current: false },
    panRef: { current: null },
    canvasRef: { current: null as SVGSVGElement | null },
    wrapRef: { current: null as HTMLElement | null },
    stageRef: { current: { w: 0, h: 0 } },
  };
}

function evenement(type: string, opts: { clientX: number; clientY: number }) {
  return new MouseEvent(type, { bubbles: true, cancelable: true, clientX: opts.clientX, clientY: opts.clientY, button: 0 });
}

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  if (root) { act(() => root!.unmount()); root = null; }
  if (container) { container.remove(); container = null; }
  setStageBackend('affine');
});

/** Monte l'éditeur, la scène suivie comme le ferait l'historique. Les options portent ce que les
 *  correctifs interrogent : scène de départ, couche éditée, mode de couche, calques d'authoring. */
async function monter(
  tool: { mode: 'tile'; terrain: 'eau' } | { mode: 'erase' } | { mode: 'select' },
  opts: { scene?: Scene; currentLayer?: number; lowerLayerMode?: 'gabarit' | 'isolee'; roofs?: boolean } = {},
) {
  let scene = opts.scene ?? sceneAtelier();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  const vue = vueTop();
  const rendre = () =>
    root!.render(
      <EditorCanvas
        scene={scene}
        view={vue as never}
        {...baseProps()}
        currentLayer={opts.currentLayer ?? 0}
        lowerLayerMode={opts.lowerLayerMode ?? 'gabarit'}
        layers={{ ...DEFAULT_LAYERS, roofs: opts.roofs ?? DEFAULT_LAYERS.roofs }}
        tool={tool as never}
        setScene={(s) => { scene = s; rendre(); }}
        setSceneNoHistory={(s) => { scene = s; rendre(); }}
      />,
    );
  await act(async () => rendre());
  // Le canevas d'un jsdom n'a AUCUNE mise en page : sans taille, la passe de dessin sort avant de
  // rendre quoi que ce soit, et rien ne serait mesurable de ce que le monde peint.
  const canvasMonte = container.querySelector('canvas.iso-stage');
  if (canvasMonte) {
    Object.defineProperty(canvasMonte, 'clientWidth', { value: 800, configurable: true });
    Object.defineProperty(canvasMonte, 'clientHeight', { value: 600, configurable: true });
    await act(async () => rendre());
  }
  const svg = container.querySelector('svg.editor-iso') as SVGSVGElement;
  const point = { x: 0, y: 0, matrixTransform: () => ({ x: point.x, y: point.y }) };
  (svg as unknown as { getScreenCTM: () => unknown }).getScreenCTM = () => ({ inverse: () => ({}) });
  (svg as unknown as { createSVGPoint: () => unknown }).createSVGPoint = () => point;
  const dims = { ...scene.dimensions, rot: 0 as const, view: 'top' as const };
  const à = (type: string, x: number, y: number) => {
    const { cx, cy } = tileCenter(x, y, dims);
    return act(async () => { svg.dispatchEvent(evenement(type, { clientX: cx, clientY: cy })); });
  };
  return {
    svg,
    el: container,
    canvas: () => container!.querySelector('canvas.iso-stage') as HTMLCanvasElement | null,
    cuissons: () => Number((container!.querySelector('canvas.iso-stage') as HTMLCanvasElement).dataset.bake),
    /** Losanges de sol peints par le SVG (`floorSvg` remplit d'un dégradé de terrain). */
    solsSvg: () => svg.querySelectorAll('path[fill^="url(#"]').length,
    down: (x: number, y: number) => à('pointerdown', x, y),
    move: (x: number, y: number) => à('pointermove', x, y),
    up: (x: number, y: number) => à('pointerup', x, y),
    /** Rendu de l'éditeur AVEC une nouvelle référence de scène qui ne change QUE les entités —
     *  ce que produit un déplacement d'entité, de zone ou de trigger au pointeur. */
    bougerUneEntite: () => act(async () => { scene = { ...scene, entities: [...scene.entities] }; rendre(); }),
    /** SUJETS de billboard que l'hôte a donnés à peindre (décor + jetons d'entité). */
    sujets: () => Number((container!.querySelector('canvas.iso-stage') as HTMLCanvasElement).dataset.sujets),
    faces: () => facesDessinees(),
  };
}

describe('Éditeur — la voie volumique monte le MÊME monde que le jeu (#1176, P3-3)', () => {
  it('voie AFFINE : aucun canevas, c’est le SVG qui peint le sol', async () => {
    setStageBackend('affine');
    const h = await monter({ mode: 'select' });
    expect(h.canvas()).toBeNull();
    expect(h.solsSvg()).toBeGreaterThan(0);
  });

  it('voie VOLUMIQUE : canevas AVANT le SVG (donc dessous), SVG au-dessus par son contexte d’empilement, et le SVG ne peint plus le sol', async () => {
    setStageBackend('webgl');
    const h = await monter({ mode: 'select' });
    const canvas = h.canvas();
    expect(canvas).not.toBeNull();
    expect(canvas!.compareDocumentPosition(h.svg) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(h.svg.getAttribute('class')).toContain('editor-iso-3d');
    expect(h.solsSvg()).toBe(0);
  });

  it('voie VOLUMIQUE : AUCUN picker de sprite inscrit — le picking de l’éditeur reste géométrique', async () => {
    setStageBackend('webgl');
    await monter({ mode: 'select' });
    expect(hasSpritePicker()).toBe(false);
  });
});

describe('Éditeur — cadence de la cuisson (#1176, P3-3)', () => {
  it('un geste qui ne touche PAS le read-set du monde (déplacement d’entité) ne recuit rien', async () => {
    setStageBackend('webgl');
    const h = await monter({ mode: 'select' });
    const avant = h.cuissons();
    await h.bougerUneEntite();
    await h.bougerUneEntite();
    expect(h.cuissons()).toBe(avant);
  });

  it('un TRAIT de pinceau reste sur la cuisson d’AVANT le geste ; le relâché en paie exactement UNE', async () => {
    setStageBackend('webgl');
    const h = await monter({ mode: 'tile', terrain: 'eau' });
    const avant = h.cuissons();
    await h.down(2, 2);
    await h.move(3, 2);
    await h.move(4, 2);
    await h.move(5, 2);
    expect(h.cuissons()).toBe(avant); // 4 cases peintes, zéro cuisson pendant le trait
    await h.up(5, 2);
    expect(h.cuissons()).toBe(avant + 1);
  });

  it('…et pendant le trait, les cases peintes se voient — aperçu WYSIWYG par le backend affine', async () => {
    setStageBackend('webgl');
    const h = await monter({ mode: 'tile', terrain: 'eau' });
    expect(h.svg.querySelector('[data-apercu-trait]')).toBeNull();
    await h.down(2, 2);
    await h.move(3, 2);
    const apercu = h.svg.querySelector('[data-apercu-trait]')!;
    expect(Number(apercu.getAttribute('data-apercu-trait'))).toBe(2);
    // Ce sont de VRAIS sols du backend affine (dégradé de terrain), pas des losanges symboliques.
    expect(apercu.querySelectorAll('path[fill^="url(#"]').length).toBeGreaterThanOrEqual(2);
    await h.up(3, 2);
    expect(h.svg.querySelector('[data-apercu-trait]')).toBeNull();
  });
});

/**
 * CE QUE L'AUTEUR DOIT VOIR — les trois trous qu'une voie volumique naïve ouvre dans l'éditeur : un
 * embusqueur sans corps, un jeton d'une couche masquée qui reste au canevas, un calque d'authoring
 * devenu inerte. Aucun ne se voit dans le SVG : ils se mesurent aux traces du canevas.
 */
describe('Éditeur — ce que le monde volumique donne à voir (#1176, P3-3)', () => {
  it('les EMBUSQUEURS ont un corps : la loi de JEU les coupe, l’authoring les montre', async () => {
    setStageBackend('webgl');
    // La loi de JEU (aucune option d'authoring) coupe bien l'entité — sans quoi ce test ne dirait rien.
    expect(buildTokens(sceneEmbuscade(), undefined, null, { activeZ: 0, viewZ: null, top: true })).toEqual([]);
    const h = await monter({ mode: 'select' }, { scene: sceneEmbuscade() });
    expect(h.sujets()).toBe(1);
    // …et l'empreinte pointillée de l'auteur reste posée par-dessus, sur le SVG.
    expect(h.svg.querySelectorAll('path[stroke-dasharray]').length).toBeGreaterThan(0);
  });

  it('mode ISOLÉ : un jeton d’une couche masquée ne reste pas au canevas (aucun corps fantôme)', async () => {
    setStageBackend('webgl');
    const gabarit = await monter({ mode: 'select' }, { scene: sceneEmbuscade(), currentLayer: 1, lowerLayerMode: 'gabarit' });
    expect(gabarit.sujets()).toBe(1); // couche du dessous : gabarit d'alignement, le corps est là
    await act(async () => root!.unmount());
    root = null;
    container!.remove();
    container = null;
    const isolee = await monter({ mode: 'select' }, { scene: sceneEmbuscade(), currentLayer: 1, lowerLayerMode: 'isolee' });
    expect(isolee.sujets()).toBe(0); // couche isolée : rien du dessous, ni décoration ni corps
  });

  it('le calque « Toits » agit sur le canevas : éteint, ses faces ne se dessinent plus', async () => {
    setStageBackend('webgl');
    const scene = scenarioToits.scene; // masure à 4 pièces sous UNE nappe à deux pans (masse z=0)
    // Couche active = 1 : la nappe du z=0 n'est plus celle qui coifferait le plan qu'on trace, donc
    // c'est bien le CALQUE, et lui seul, qui décide de la montrer.
    const avec = await monter({ mode: 'select' }, { scene, currentLayer: 1, roofs: true });
    const facesAvec = avec.faces();
    await act(async () => root!.unmount());
    root = null;
    container!.remove();
    container = null;
    const sans = await monter({ mode: 'select' }, { scene, currentLayer: 1, roofs: false });
    expect(facesAvec).toBeGreaterThan(0);
    expect(sans.faces()).toBeLessThan(facesAvec);
  });

  /**
   * LA GOMME — mesurée au CODE, pas au brief : `eraseAt` (`state/sceneEdit.ts:461`) retire une
   * ENTITÉ à la case, JAMAIS du terrain. Il n'y a donc rien à « dé-peindre » du monde cuit : ce qui
   * doit disparaître est un BILLBOARD, et il disparaît au tick, sans gel de cadence ni recuisson
   * (les entités ne sont pas dans le read-set de la cuisson).
   */
  it('la GOMME retire le sujet à l’instant du clic — sans geler la cadence, sans recuire le monde', async () => {
    setStageBackend('webgl');
    const h = await monter({ mode: 'erase' }, { scene: sceneEmbuscade() });
    const facesAvant = h.faces();
    expect(h.sujets()).toBe(1);
    await h.down(3, 3); // la case de l'embusqueur
    expect(h.sujets()).toBe(0); // le corps a quitté le canevas dans le geste, pas au relâché
    expect(h.cuissons()).toBe(1); // …et pas une seule recuisson : `entities` est hors read-set
    expect(h.faces()).toBe(facesAvant); // le terrain, lui, n'a pas bougé — la gomme n'y touche pas
    await h.up(3, 3);
    expect(h.cuissons()).toBe(1);
  });
});

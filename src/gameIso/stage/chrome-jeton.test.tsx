// @vitest-environment jsdom
import { Profiler, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { useGame, type BattleState } from '../../state/store';
import { emptyScene } from '../../state/scene';
import { setStageBackend } from '../../state/stage3d';
import { bus, EVT } from '../../state/bus';
import { STEP_MS } from '../../geometry/walk';
import type { Combatant } from '../../engine/types';
import { IsoStage } from '../IsoStage';
import { CONVENTION, setStageRendererFactory, type StageRenderer } from './GameStage3D';
import { chromeHeadPx } from './TokenChromeOverlay';
import {
  ALPHA_TEST,
  DIM_OPACITY,
  GHOST_DESAT,
  GHOST_OPACITY,
  billboardMaterial,
  luminance709,
  poseBoards,
  type Board,
  type BoardChrome,
  type FrameLights,
} from './boardPose';
import { poseDynamicMarks, type DynMarkPools } from './dynamicMarkPose';
import { buildDynamicMarkMesh } from '../backends/webgl/dynamicMarkMeshes';
import { COMBAT_TOKEN_BASE, discR, teamRingRadiusK, topRingRadiusK, type DynamicMarks } from '../builders/dynamicMarks';
import { tokenChrome } from '../builders/tokenChrome';
import { ALLY_TINT, ENEMY_TINT, NEUTRAL_TINT, hpColor } from '../teamColors';
import { combatantBodyTopFrac, combatantTokenScale } from '../sizeScale';
import { billboardHeightM } from '../backends/webgl/billboardMath';
import { ISO_PX_PER_M } from '../iso';
import { tileCenter, type Dims } from '../../geometry/iso';
import { GROUND_Y, bodyHeight } from '../rig/composeRig';
import type { Appearance } from '../rig/appearance';
import { contactShadow } from '../backends/webgl/sceneMeshes';
import type { BillboardSubject } from '../backends/webgl/sceneMeshes';

/**
 * CHROME D'ÉCRAN des jetons de combat (#1176, P3-0f) — barre de PV, icônes d'États (report « +N »),
 * pastille d'état de FIN, et l'ALLURE du corps (fantôme hors LdV, hors d'action, cible survolée).
 *
 * Ce que cette sonde mesure, c'est le PARTAGE : une seule dérivation (`builders/tokenChrome`) et un
 * seul peintre (`TokenChromeMarks`) nourrissent les deux voies — la débrancher fait perdre le chrome
 * aux DEUX. Puis l'EXCLUSIVITÉ : en volumique le chrome vit dans l'overlay projeté (le jeton affine
 * n'est plus monté), en affine il vit dans le corps du jeton et aucun overlay ne le double.
 */
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TAILLE = { w: 800, h: 600 };
/** PV du héros de la sonde : ratio 3/12 = 0,25 → zone CRITIQUE de `hpColor`. */
const PV = { current: 3, max: 12 };

function hero(id: string, pos: { x: number; y: number }): Combatant {
  return {
    id, label: id, kind: 'hero', pos, size: 'moyenne',
    wounds: { current: 12, max: 12 }, weapons: [],
    characteristics: { 'capacite-de-combat': 40, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, 'intelligence': 30, 'force-mentale': 30, sociabilite: 30 },
    advantage: 0, conditions: [], armour: {},
    skills: [], talents: [], movement: 4,
  } as unknown as Combatant;
}

/** Un héros BLESSÉ portant quatre états-drapeaux (trois montrés + un reporté), et un ennemi MORT. */
function combatChromé(): BattleState {
  return {
    combatants: [
      { ...hero('h1', { x: 3, y: 3 }), wounds: PV, defensiveStance: true, aiming: true, focus: { dr: 2 }, hunger: { days: 2, failures: 0 } },
      { ...hero('e1', { x: 5, y: 3 }), kind: 'enemy', dead: true },
    ],
    order: ['h1', 'e1'],
    turn: 0,
    round: 1,
    over: false,
    action: null,
    acted: true,
    movementUsed: 0,
    preview: null,
    reachable: new Map<string, number>(),
    zones: [],
    log: [],
  } as unknown as BattleState;
}

let root: Root | null = null;
let conteneur: HTMLDivElement | null = null;

class BancRenderer implements StageRenderer {
  shadowMap = { enabled: false, autoUpdate: true, needsUpdate: false, type: THREE.PCFShadowMap };
  capabilities = { getMaxAnisotropy: () => 1 };
  setPixelRatio(): void {}
  setClearColor(): void {}
  setSize(): void {}
  dispose(): void {}
  render(): void {}
}

/** Commits du sous-arbre du stage depuis le dernier montage — un rendu React, un commit. */
let commits = 0;
const rendus = () => commits;

function monter(backend: 'affine' | 'webgl', retouche: Record<string, unknown> = {}): HTMLDivElement {
  setStageBackend(backend);
  useGame.setState({
    scene: emptyScene(10, 10),
    mode: 'battle',
    viewMode: 'iso',
    partyPos: { x: 6, y: 6 },
    party: [hero('h1', { x: 3, y: 3 })],
    battle: combatChromé(),
    dialogue: null,
    flags: {},
    hovered: null,
    pendingAttack: null,
    ...retouche,
  } as never);
  conteneur = document.createElement('div');
  document.body.appendChild(conteneur);
  root = createRoot(conteneur);
  commits = 0;
  act(() => root!.render(<Profiler id="chrome" onRender={() => { commits += 1; }}><IsoStage /></Profiler>));
  return conteneur;
}

function démonter(): void {
  if (root) { act(() => root!.unmount()); root = null; }
  if (conteneur) { conteneur.remove(); conteneur = null; }
}

/** Les barres de PV peintes : le rect de REMPLISSAGE porte la couleur de seuil (`hpColor`), le rect
 *  de fond le noir — un seul des deux dit l'état du combattant. */
function barresPV(el: HTMLElement): Element[] {
  return [...el.querySelectorAll('svg.iso-stage rect')].filter((r) => r.getAttribute('height') === '4' && r.getAttribute('fill') !== '#000');
}

/** Les pastilles d'état de FIN, par leur `<title>` d'accessibilité. */
function pastilles(el: HTMLElement): Element[] {
  return [...el.querySelectorAll('svg.iso-stage g.token-endmark')];
}

/** Le groupe de chrome VOLUMIQUE d'un combattant (l'overlay projeté), ou `null`. */
function chromeVolumique(el: HTMLElement, cid: string): SVGGElement | null {
  return el.querySelector(`svg.iso-stage g[data-chrome-cid="${cid}"]`);
}

/** Les ancres du bloc de badges d'un chrome (PV + icônes), telles que le peintre partagé les pose. */
function badgesDe(g: SVGGElement): (string | null)[] {
  return [...g.querySelectorAll('g')].map((n) => n.getAttribute('transform')).filter((t) => t?.startsWith('translate(0,'));
}

/** L'ordonnée de l'ANCRE DE TÊTE d'un chrome peint, relue au DOM : le peintre partagé pose le bloc de
 *  badges à `ancre − 8` et la pastille de fin à `ancre − 22` — la plus HAUTE des deux redonne l'ancre. */
function ancreDe(g: SVGGElement): number {
  const ys = badgesDe(g).map((t) => Number(/^translate\(0,(-?[\d.e+-]+)\)$/.exec(t!)![1]));
  return Math.max(...ys) + 8;
}

beforeAll(() => {
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientWidth', { configurable: true, get: () => TAILLE.w });
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientHeight', { configurable: true, get: () => TAILLE.h });
  setStageRendererFactory(() => new BancRenderer());
});
afterAll(() => setStageRendererFactory(null));
afterEach(() => {
  démonter();
  setStageBackend('webgl'); // la voie du produit : un banc ne lègue pas la voie SVG au fichier suivant
});

describe('Chrome des jetons — UNE dérivation, UN peintre, deux voies (#1176 P3-0f)', () => {
  it('le chrome est peint à l’écran : une barre par combattant posté, « +1 », pastille de mort', () => {
    const el = monter('webgl');
    const barres = barresPV(el);
    expect(barres, 'une barre par combattant posté').toHaveLength(2);
    expect(barres.map((b) => b.getAttribute('fill'))).toContain(hpColor(PV.current / PV.max));
    expect([...el.querySelectorAll('svg.iso-stage text')].map((t) => t.textContent)).toContain('+1');
    const marques = pastilles(el);
    expect(marques, 'le mort porte SA pastille, et lui seul').toHaveLength(1);
    expect(marques[0].querySelector('title')?.textContent).toBe('Mort');
    expect(marques[0].getAttribute('class')).toContain('es-mort');
  });

  it('le chrome vit dans l’overlay projeté, combattant par combattant', () => {
    const el = monter('webgl');
    const h1 = chromeVolumique(el, 'h1');
    const e1 = chromeVolumique(el, 'e1');
    expect(h1, 'le héros porte son chrome au-dessus de sa tête').toBeTruthy();
    expect(e1).toBeTruthy();
    // Barre de PV au ratio du héros — la MÊME couleur de seuil que la voie affine.
    const barre = [...h1!.querySelectorAll('rect')].find((r) => r.getAttribute('fill') !== '#000');
    expect(barre?.getAttribute('fill')).toBe(hpColor(PV.current / PV.max));
    expect(Number(barre?.getAttribute('width'))).toBeCloseTo(26 * (PV.current / PV.max), 6);
    // Icônes d'États : trois montrées, la quatrième reportée en « +1 ».
    expect(h1!.querySelectorAll('g[aria-hidden="true"]')).toHaveLength(3);
    expect([...h1!.querySelectorAll('text')].map((t) => t.textContent)).toEqual(['+1']);
    // Pastille d'état de fin, avec son `<title>` — l'accessibilité ne se perd pas au changement de voie.
    expect(h1!.querySelector('g.token-endmark'), 'un héros en état n’en porte pas').toBeNull();
    const marque = e1!.querySelector('g.token-endmark');
    expect(marque?.querySelector('title')?.textContent).toBe('Mort');
    expect(marque?.getAttribute('class')).toContain('es-mort');
  });

  it('AUCUNE DOUBLE PEINTURE : tout le chrome peint vit dans l’overlay, et rien dans un corps SVG', () => {
    const webgl = monter('webgl');
    const barres = barresPV(webgl);
    expect(barres.length).toBeGreaterThan(0);
    // En volumique il n'y a plus de corps de jeton SVG : toute barre peinte appartient à l'overlay.
    expect(barres.every((b) => b.closest('g[data-chrome-cid]') !== null), 'toute barre volumique vit dans l’overlay').toBe(true);
    expect(webgl.querySelectorAll('svg.iso-stage g[data-cid]'), 'aucun corps de jeton affine monté en volumique').toHaveLength(0);
  });

  it('le chrome volumique s’ancre à la TÊTE DESSINÉE en losange, et au DISQUE-PORTRAIT en vue du dessus', () => {
    const h = combatChromé().combatants[0];
    const scaleK = combatantTokenScale(h);
    const frac = combatantBodyTopFrac(h);
    const marque = { scaleK, n: 1, bodyTopFrac: frac }; // le héros de la sonde : taille moyenne, empreinte d'une case
    const el = monter('webgl');
    const h1 = chromeVolumique(el, 'h1')!;
    const dims: Dims = { ...emptyScene(10, 10).dimensions, rot: 0, view: 'iso', edge: false } as Dims;
    const { cx, cy } = tileCenter(3, 3, dims, 0);
    expect(h1.getAttribute('transform'), 'ancré aux PIEDS de sa case, comme le jeton').toBe(`translate(${cx},${cy})`);
    // LOSANGE : la hauteur MONDE du quad, à la cadence verticale de la projection affine, RABATTUE sur
    // la part de boîte que le corps remplit — la toise du gabarit, pas le haut du cadre.
    const tête = billboardHeightM(CONVENTION, 'personnage') * scaleK * frac * ISO_PX_PER_M;
    expect(chromeHeadPx(dims, marque)).toBeCloseTo(tête, 9);
    // Le bloc de badges est posé à `badgeY − 8`, `badgeY` valant cette ancre.
    expect(badgesDe(h1)).toContain(`translate(0,${-tête - 8})`);
    démonter();

    // DESSUS : plus de tête à surmonter — le corps y est un disque-portrait, et le chrome se pose à son
    // BORD, exactement comme la voie affine (`BodyToken`, branche `flat` : `badgeY = −discR`).
    const top = monter('webgl', { viewMode: 'top' });
    const dimsTop: Dims = { ...dims, view: 'top' } as Dims;
    expect(chromeHeadPx(dimsTop, marque)).toBe(discR(1));
    expect(badgesDe(chromeVolumique(top, 'h1')!)).toContain(`translate(0,${-discR(1) - 8})`);
  });
});

describe('Chrome des jetons — la dérivation PURE que les deux voies partagent (#1176 P3-0f)', () => {
  const c = () => combatChromé().combatants[0];
  const vide = { ghostIds: new Set<string>(), hoveredId: null };

  it('hors LdV du tireur actif : le jeton est FANTÔME, et lui seul', () => {
    expect(tokenChrome(c(), { ...vide, ghostIds: new Set(['h1']) }).ghost).toBe(true);
    expect(tokenChrome(c(), vide).ghost).toBe(false);
  });

  it('survolé : la couleur de RELATION, jamais une couleur d’équipe', () => {
    const ennemi = { ...c(), id: 'e1', kind: 'enemy' } as Combatant;
    expect(tokenChrome(ennemi, { ...vide, hoveredId: 'e1' }).highlight).toBe(ENEMY_TINT);
    expect(tokenChrome(ennemi, vide).highlight).toBeNull();
  });

  it('un engin INERTE n’a pas de santé : aucune barre, aucun état de fin', () => {
    const engin = { ...c(), inert: true } as Combatant;
    expect(tokenChrome(engin, vide).hp).toBeNull();
    expect(tokenChrome(engin, vide).endState).toBeNull();
  });

  it('mort : le corps est HORS D’ACTION et porte l’état de fin', () => {
    const mort = { ...c(), dead: true } as Combatant;
    expect(tokenChrome(mort, vide).dim).toBe(true);
    expect(tokenChrome(mort, vide).endState).toBe('mort');
  });
});

describe('Chrome des jetons — l’ALLURE passe au MATÉRIAU du billboard (#1176 P3-0f)', () => {
  const CAMERA = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 100);
  const LUM = 0.5;
  const FLAQUES: FrameLights = { pool: [], slots: [], surfaceLuminance: LUM };

  function board(cid: string, ombre = false): Board {
    const material = billboardMaterial(new THREE.Texture(), 1);
    const sub: BillboardSubject = {
      identity: `sonde:${cid}`, cid, kind: 'personnage', anchor: new THREE.Vector3(0, 0, 0),
      facing: 'S', scaleK: 1, tint: 1, box: { w: 120, h: 150 }, svg: () => '',
    };
    return {
      sub,
      quad: { widthM: 2, heightM: 3, centerLiftM: 1.5 },
      mesh: new THREE.Mesh(new THREE.PlaneGeometry(2, 3), material),
      material,
      shadow: ombre ? contactShadow(sub.anchor, 2) : undefined,
    };
  }

  /** Les canaux d'allure mesurés SUR un board déjà posé. */
  function canaux(b: Board): { opacity: number; alpha: number; desat: number; color: THREE.Color; ombre: number } {
    return {
      opacity: b.material.opacity,
      alpha: (b.material.userData.allureAlpha as { value: number }).value,
      desat: (b.material.userData.desat as { value: number }).value,
      color: b.material.color,
      ombre: (b.shadow as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> | undefined)?.material.opacity ?? NaN,
    };
  }

  /** Pose UNE frame avec l'allure donnée, et rend les canaux mesurés SUR le board. */
  function allure(chrome: BoardChrome | null, ombre = false): ReturnType<typeof canaux> {
    const b = board('h1', ombre);
    poseBoards([b], CAMERA, () => null, FLAQUES, () => chrome);
    return canaux(b);
  }

  it('rien à signaler : teinte NEUTRE à l’exposition de la frame, opaque, saturé', () => {
    const a = allure(null);
    expect([a.color.r, a.color.g, a.color.b]).toEqual([LUM, LUM, LUM]);
    expect(a.alpha).toBe(1);
    expect(a.desat).toBe(0);
  });

  it('FANTÔME hors LdV : translucide ET désaturé — la teinte seule ne peut pas retirer la couleur', () => {
    const a = allure({ ghost: true, dim: false, highlight: null });
    expect(a.alpha).toBe(GHOST_OPACITY);
    expect(a.desat).toBe(GHOST_DESAT);
  });

  it('HORS D’ACTION : assombri seulement — un corps déjà tombé ne se grise pas en plus', () => {
    const a = allure({ ghost: false, dim: true, highlight: null });
    expect(a.alpha).toBe(DIM_OPACITY);
    expect(a.desat).toBe(0);
    // Hors d'action ET hors LdV : l'opacité du corps tombé prime, comme en affine.
    expect(allure({ ghost: true, dim: true, highlight: null }).alpha).toBe(DIM_OPACITY);
    expect(allure({ ghost: true, dim: true, highlight: null }).desat).toBe(0);
  });

  it('l’opacité d’allure ne passe JAMAIS par `material.opacity` : sous l’alphaTest, le sujet DISPARAÎT', () => {
    // `diffuseColor = vec4( diffuse, opacity )` × texel, PUIS `if ( a < alphaTest ) discard` : à 0,45
    // d'opacité pour 0,5 de seuil, même un texel parfaitement opaque est rejeté — le fantôme s'efface
    // en entier au lieu de pâlir. L'opacité du matériau reste donc AU-DESSUS du seuil, toujours.
    expect(GHOST_OPACITY).toBeLessThan(ALPHA_TEST); // la sonde mord : c'est bien le régime dangereux
    for (const chrome of [null, { ghost: true, dim: false, highlight: null }, { ghost: false, dim: true, highlight: null }])
      expect(allure(chrome).opacity, `allure ${JSON.stringify(chrome)}`).toBeGreaterThanOrEqual(ALPHA_TEST);
  });

  it('CIBLE SURVOLÉE : la silhouette prend la couleur de relation À LUMINANCE CONSTANTE', () => {
    // La mise en évidence ÉCLAIRE : ça se MESURE, en luminance perçue (Rec. 709) et non sur le canal le
    // plus fort — un rouge saturé y a un canal plein pour un huitième de la lumière d'un gris.
    const SOMBRE = 0.25; // exposition à laquelle les trois teintes de relation tiennent sans borner
    const flaques: FrameLights = { pool: [], slots: [], surfaceLuminance: SOMBRE };
    for (const teinte of [ENEMY_TINT, ALLY_TINT, NEUTRAL_TINT]) {
      const b = board('h1');
      poseBoards([b], CAMERA, () => null, flaques, () => ({ ghost: false, dim: false, highlight: teinte }));
      expect(luminance709(b.material.color), teinte).toBeCloseTo(SOMBRE, 6);
      // …et c'est bien la COULEUR de relation, pas un gris : les canaux gardent leur rapport.
      const brut = new THREE.Color(teinte);
      expect(b.material.color.g / b.material.color.r).toBeCloseTo(brut.g / brut.r, 6);
    }
  });

  it('…ÉCART RÉSIDUEL : une teinte saturée sombre à pleine exposition BORNE ses canaux', () => {
    const a = allure({ ghost: false, dim: false, highlight: ENEMY_TINT });
    expect(Math.max(a.color.r, a.color.g, a.color.b), 'aucun canal au-delà de 1').toBeCloseTo(1, 6);
    // Le rouge d'adversaire demanderait 1,84 de canal rouge pour tenir 0,5 de luminance : borné à 1, il
    // en rend 0,321 (déclaré au site, `boardChromeTint`) — plus du double de ce que rendait la
    // normalisation par canal max, et sans le virage de teinte qu'un re-gris aurait introduit.
    expect(luminance709(a.color)).toBeCloseTo(0.321, 3);
  });

  it('l’allure est keyée par ID : deux jetons, deux allures, chacune sur SON matériau', () => {
    const h1 = board('h1');
    const e1 = board('e1');
    const table: Record<string, BoardChrome> = {
      e1: { ghost: true, dim: false, highlight: null },
      h1: { ghost: false, dim: false, highlight: ENEMY_TINT },
    };
    poseBoards([h1, e1], CAMERA, () => null, FLAQUES, (cid) => table[cid] ?? null);
    expect(canaux(e1).alpha, 'le fantôme est celui que la table désigne').toBe(GHOST_OPACITY);
    expect(canaux(e1).desat).toBe(GHOST_DESAT);
    expect(canaux(h1).alpha).toBe(1);
    expect(canaux(h1).desat).toBe(0);
    expect(canaux(h1).color.r).toBeGreaterThan(canaux(h1).color.g); // survolé : la teinte de relation
  });

  it('l’OMBRE DE CONTACT s’estompe avec le corps qu’elle porte', () => {
    const pleine = allure(null, true).ombre;
    expect(pleine).toBeGreaterThan(0);
    expect(allure({ ghost: true, dim: false, highlight: null }, true).ombre).toBeCloseTo(pleine * GHOST_OPACITY, 9);
    expect(allure({ ghost: false, dim: true, highlight: null }, true).ombre).toBeCloseTo(pleine * DIM_OPACITY, 9);
  });

  it('l’ANNEAU D’ÉQUIPE s’estompe avec son jeton (teinte par instance du pool P3-0e)', () => {
    const mesh = buildDynamicMarkMesh('anneau');
    const anneau = (id: string, x: number, color: string) => ({
      id, cell: { x, y: 0, z: 0 }, rK: teamRingRadiusK(COMBAT_TOKEN_BASE), rTopK: topRingRadiusK(1), color,
    });
    const marques: DynamicMarks = { tethers: [], active: null, party: null, rings: [anneau('h1', 0, ALLY_TINT), anneau('e1', 3, ENEMY_TINT)] };
    const pools: DynMarkPools = { anneau: mesh };
    const counts = poseDynamicMarks(pools, marques, {
      mpt: 1.5,
      glide: () => null,
      groundM: () => 0,
      kind: 'iso',
      chromeAt: (cid) => (cid === 'e1' ? { ghost: true, dim: false, highlight: null } : null),
    });
    expect(counts.anneau).toBeGreaterThan(1);
    const c = new THREE.Color();
    mesh.getColorAt(0, c);
    expect(c.getHex(), 'le jeton en état garde sa teinte pleine').toBe(new THREE.Color(ALLY_TINT).getHex());
    mesh.getColorAt(counts.anneau - 1, c);
    const attendu = new THREE.Color(ENEMY_TINT).multiplyScalar(GHOST_OPACITY);
    expect([c.r, c.g, c.b].map((v) => Number(v.toFixed(6)))).toEqual([attendu.r, attendu.g, attendu.b].map((v) => Number(v.toFixed(6))));
  });

  it('le matériau porte ses DEUX uniformes dès son montage, et l’allure APRÈS l’alphatest', () => {
    const mat = billboardMaterial(new THREE.Texture(), 1);
    expect((mat.userData.desat as { value: number }).value).toBe(0);
    expect((mat.userData.allureAlpha as { value: number }).value).toBe(1);
    const shader = {
      uniforms: {} as Record<string, unknown>,
      fragmentShader: 'void main() {\n#include <map_fragment>\n#include <alphatest_fragment>\n}',
    };
    mat.onBeforeCompile!(shader as never, null as never);
    expect(shader.uniforms.uDesat, 'l’uniforme du matériau, pas une copie').toBe(mat.userData.desat);
    expect(shader.uniforms.uAllureAlpha).toBe(mat.userData.allureAlpha);
    expect(shader.fragmentShader).toContain('uniform float uDesat;');
    expect(shader.fragmentShader).toContain('uniform float uAllureAlpha;');
    expect(shader.fragmentShader).toContain('mix( diffuseColor.rgb');
    // ORDRE : l'alpha d'allure se multiplie APRÈS la découpe des texels — avant, il ferait basculer
    // tout le sprite sous le seuil et le ferait disparaître.
    const découpe = shader.fragmentShader.indexOf('#include <alphatest_fragment>');
    const multiplication = shader.fragmentShader.indexOf('diffuseColor.a *= uAllureAlpha;');
    expect(découpe).toBeGreaterThanOrEqual(0);
    expect(multiplication).toBeGreaterThan(découpe);
  });
});

/**
 * LA POSITION DU CHROME EST UNE AFFAIRE D'IMAGE, pas de rendu. En volumique, la marche ne re-rend rien
 * entre deux pas (`fx/useWalkAnim`, `repaint = false`) : le quad glisse dans la boucle de rendu, et un
 * chrome posé au seul rendu React resterait sur la case de départ — barre de PV et états décrochés du
 * corps pendant tout le pas. La sonde MESURE les deux ensemble : le transform du groupe de chrome
 * change image par image, ALORS QU'AUCUN commit React ne se produit.
 */
describe('Chrome des jetons — la POSITION suit la marche à la FRAME (#1176 P3-0f)', () => {
  let horloge = 0;
  let file: FrameRequestCallback[] = [];

  beforeEach(() => {
    horloge = 1000;
    file = [];
    vi.spyOn(performance, 'now').mockImplementation(() => horloge);
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => file.push(cb));
    vi.stubGlobal('cancelAnimationFrame', () => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  /** Déclenche une marche et EXTRAIT son tick de la file commune (patron `walk-frame-loop`). */
  function marcher(id: string, path: { x: number; y: number }[]): FrameRequestCallback {
    const avant = file.length;
    bus.emit(EVT.ANIM_MOVE, { id, path });
    const posés = file.splice(avant);
    expect(posés).toHaveLength(1);
    return posés[0];
  }

  /** Avance l'horloge et rejoue le SEUL tick de marche ; rend celui qu'il reprogramme. */
  function image(tick: FrameRequestCallback, dt: number): FrameRequestCallback {
    horloge += dt;
    const avant = file.length;
    act(() => { tick(horloge); });
    return file.splice(avant)[0];
  }

  const posé = (el: HTMLElement, cid: string) => chromeVolumique(el, cid)!.getAttribute('transform');

  it('le chrome GLISSE image par image, sans un seul rendu React', () => {
    const el = monter('webgl');
    const e1Avant = posé(el, 'e1');
    // DEUX pas (deux segments, donc `2 × STEP_MS` de marche). Le store a déjà commis l'arrivée (x:3) :
    // la marche rejoue le trajet depuis la case quittée.
    const DURÉE = 2 * STEP_MS;
    let tick = marcher('h1', [{ x: 1, y: 3 }, { x: 2, y: 3 }, { x: 3, y: 3 }]);
    // On mesure APRÈS le dernier franchissement de case (le seul événement discret qui re-rend le
    // stage) : de f=0,55 à f=0,70 la case visuelle vaut 2 tout du long, donc aucun commit n'est attendu.
    tick = image(tick, DURÉE * 0.55);
    const commitsAvant = rendus();
    const vues = [posé(el, 'h1')];
    tick = image(tick, DURÉE * 0.07);
    vues.push(posé(el, 'h1'));
    image(tick, DURÉE * 0.08);
    vues.push(posé(el, 'h1'));
    expect(rendus(), 'aucun rendu React entre ces trois images').toBe(commitsAvant);
    expect(new Set(vues).size, 'trois positions distinctes').toBe(3);
    // Le chrome de l'autre combattant, lui, n'a pas bougé d'un pixel : la glisse est keyée par id.
    expect(posé(el, 'e1')).toBe(e1Avant);
  });
});

describe('Ancre du chrome — la TOISE du gabarit, jamais une constante par famille (#1176 P3-0f)', () => {
  /** Espèces de RIG mesurées à l'écran par le juge de vision : leur échelle d'art vaut 1 pour les cinq
   *  (`resolveSpecies(...).scale`), et leur Taille est Moyenne — seule la TOISE de leur gabarit les
   *  sépare. Un chrome ancré au haut de boîte les posait donc TOUS à la même hauteur d'écran. */
  const ESPÈCES = ['humain', 'nain', 'halfling', 'elfe', 'gobelin'];
  const app = (sp: string) => ({ species: sp, sex: 'M', build: 0.5, seed: 1 } as unknown as Appearance);
  const perso = (sp: string): Combatant => ({ ...hero('h1', { x: 3, y: 3 }), appearance: app(sp) } as unknown as Combatant);
  const dims: Dims = { ...emptyScene(10, 10).dimensions, rot: 0, view: 'iso', edge: false } as Dims;
  /** Ancre volumique d'un combattant, par le chemin de production (builder → `chromeHeadPx`). */
  const ancreVol = (c: Combatant) => chromeHeadPx(dims, { scaleK: combatantTokenScale(c), n: 1, bodyTopFrac: combatantBodyTopFrac(c) });

  it('cinq espèces, cinq ancres : la fraction sort de `bodyHeight`, pas d’un nombre par famille', () => {
    const fracs = ESPÈCES.map((sp) => combatantBodyTopFrac(perso(sp)));
    ESPÈCES.forEach((sp, i) => {
      expect(fracs[i], sp).toBeCloseTo(Math.min(1, bodyHeight(app(sp)) / GROUND_Y), 12);
    });
    expect(new Set(fracs).size, 'cinq toises distinctes').toBe(ESPÈCES.length);
    expect(combatantBodyTopFrac(perso('nain'))).toBeLessThan(combatantBodyTopFrac(perso('humain')));
    // Et l'ancre d'écran en hérite : une par espèce, là où la constante de famille n'en donnait qu'une.
    expect(new Set(ESPÈCES.map((sp) => ancreVol(perso(sp)))).size, 'cinq ancres volumiques distinctes').toBe(ESPÈCES.length);
  });

  it('l’écart BARRE→TÊTE DESSINÉE reste sous 6 px à 100 %, pour les cinq', () => {
    for (const sp of ESPÈCES) {
      const c = perso(sp);
      // La tête DESSINÉE, sans rabat de boîte : la toise brute du gabarit à la cadence du quad.
      const têtePx = billboardHeightM(CONVENTION, 'personnage') * combatantTokenScale(c) * (bodyHeight(app(sp)) / GROUND_Y) * ISO_PX_PER_M;
      expect(Math.abs(ancreVol(c) - têtePx), `${sp} : barre → tête`).toBeLessThanOrEqual(6);
    }
  });

  it('à l’ÉCRAN, le rapport nain/humain des ancres peintes est celui des toises', () => {
    const nain = perso('nain');
    const humain = perso('humain');
    const monterAvec = (c: Combatant) => {
      const b = combatChromé();
      return monter('webgl', { battle: { ...b, combatants: [{ ...b.combatants[0], appearance: c.appearance }, b.combatants[1]] }, party: [c] });
    };

    const volNain = ancreDe(chromeVolumique(monterAvec(nain), 'h1')!);
    démonter();
    const volHumain = ancreDe(chromeVolumique(monterAvec(humain), 'h1')!);

    // La toise du gabarit, et elle seule, décide de la hauteur d'ancre : les pixels dépendent du quad,
    // la FRACTION non — c'est elle que la dérivation partagée (`combatantBodyTopFrac`) fournit.
    const attendu = combatantBodyTopFrac(nain) / combatantBodyTopFrac(humain);
    expect(volNain / volHumain, 'ancre peinte à l’écran').toBeCloseTo(attendu, 9);
    expect(attendu, 'un nain n’arrive pas à la tête d’un humain').toBeLessThan(0.7);
  });
});

// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { useGame, type BattleState } from '../../state/store';
import { emptyScene } from '../../state/scene';
import { setStageBackend } from '../../state/stage3d';
import type { Combatant } from '../../engine/types';
import { IsoStage } from '../IsoStage';
import { setStageRendererFactory, type StageRenderer } from './GameStage3D';
import { ACTIVE_HALO_TINT, ENGAGE_TINT } from '../highlightTints';
import { TH, TW } from '../../geometry/iso';
import { PARTY_FRAME_K } from '../backends/webgl/dynamicMarkMeshes';
import { RING_FRAME_K } from '../backends/webgl/highlightMeshes';

/**
 * PARITÉ DE PRÉSENCE des marques DYNAMIQUES (#1176, P3-0d) : le lien d'ENGAGEMENT, le contour de
 * l'ACTIF et le repère du GROUPE, montés une fois par voie sur le MÊME état. La voie affine les trace
 * en SVG (`stage/tokens.dynamicHighlightObjs`), la voie volumique les pose en quads au sol
 * (`stage/dynamicMarkPose`) — les deux partent de la MÊME dérivation pure (`builders/dynamicMarks`),
 * et cette sonde mesure que la voie volumique la consomme jusqu'au bout (pools montés, instances
 * écrites, comptes dessinés).
 *
 * PRÉSENCE et non compte à compte : un lien affine est UN élément `<line>` pointillé, un lien
 * volumique est le CHAPELET de quads qui en tient lieu (cf. `dynamicMarkMeshes`, pourquoi pas une
 * ligne). Ce qui doit coïncider, c'est ce qui est peint et ce qui ne l'est pas — un contour d'actif
 * par case d'empreinte, un repère de groupe hors combat, et rien du combat hors du combat.
 */
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TAILLE = { w: 800, h: 600 };

function hero(id: string, pos: { x: number; y: number }): Combatant {
  return {
    id, label: id, kind: 'hero', pos, size: 'moyenne',
    wounds: { current: 12, max: 12 }, weapons: [],
    characteristics: { 'capacite-de-combat': 40, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    advantage: 0, conditions: [], armour: {},
    skills: [], talents: [], movement: 4,
  } as unknown as Combatant;
}

/** Deux combattants au CONTACT, mutuellement Engagés — l'état que le lien de mêlée dessine. */
function combatEngagé(): BattleState {
  return {
    combatants: [
      { ...hero('h1', { x: 3, y: 3 }), engagedWith: ['e1'] },
      { ...hero('e1', { x: 4, y: 3 }), kind: 'enemy', engagedWith: ['h1'] },
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

/** État de combat (les deux Engagés) ou d'exploration (le groupe sur sa case). */
function étatDe(mode: 'battle' | 'exploration'): Record<string, unknown> {
  return {
    scene: emptyScene(10, 10),
    mode,
    partyPos: { x: 6, y: 6 },
    party: [hero('h1', { x: 6, y: 6 })],
    battle: mode === 'battle' ? combatEngagé() : null,
    dialogue: null,
    flags: {},
    hovered: null,
    pendingAttack: null,
  };
}

function monter(backend: 'affine' | 'webgl', mode: 'battle' | 'exploration', retouche: Record<string, unknown> = {}): HTMLDivElement {
  setStageBackend(backend);
  useGame.setState({ ...étatDe(mode), ...retouche } as never);
  scènes = [];
  conteneur = document.createElement('div');
  document.body.appendChild(conteneur);
  root = createRoot(conteneur);
  act(() => root!.render(<IsoStage />));
  return conteneur;
}

function démonter(): void {
  if (root) { act(() => root!.unmount()); root = null; }
  if (conteneur) { conteneur.remove(); conteneur = null; }
}

/** Ce que la voie AFFINE a peint : liens, contours d'actif, repère de groupe (lus dans le SVG monté). */
function comptesAffines(el: HTMLElement): Record<string, number> {
  const liens = [...el.querySelectorAll('svg.iso-stage line')].filter((l) => l.getAttribute('stroke') === ENGAGE_TINT);
  const contours = [...el.querySelectorAll('svg.iso-stage path')].filter(
    (p) => p.getAttribute('stroke') === ACTIVE_HALO_TINT && p.getAttribute('stroke-width') === '3',
  );
  const groupe = [...el.querySelectorAll('svg.iso-stage path')].filter(
    (p) => p.getAttribute('stroke') === ACTIVE_HALO_TINT && p.getAttribute('stroke-width') === '1.5',
  );
  return { tether: liens.length, actif: contours.length, groupe: groupe.length };
}

/** Ce que la voie VOLUMIQUE a posé : le `count` de chaque pool de la dernière frame rendue. */
function comptesVolumiques(): Record<string, number> {
  const scene = scènes[scènes.length - 1];
  const out: Record<string, number> = { tether: 0, actif: 0, groupe: 0 };
  scene.traverse((o) => {
    const m = o as THREE.InstancedMesh;
    if (!m.isInstancedMesh || !m.name.startsWith('marquesDyn:')) return;
    out[m.name.slice('marquesDyn:'.length)] = m.count;
  });
  return out;
}

/** Les pools volumiques de la dernière frame, par slot. */
function poolsVolumiques(): Record<string, THREE.InstancedMesh> {
  const out: Record<string, THREE.InstancedMesh> = {};
  scènes[scènes.length - 1].traverse((o) => {
    const m = o as THREE.InstancedMesh;
    if (m.isInstancedMesh && m.name.startsWith('marquesDyn:')) out[m.name.slice('marquesDyn:'.length)] = m;
  });
  return out;
}

/** Nombre de tirets qu'un `stroke-dasharray` peint sur SA ligne : un tiret est peint dès que son début
 *  tombe avant la fin du segment (le dernier étant clippé) — la sémantique du rendu SVG, celle que
 *  `dynamicMarkPose.tetherDashCount` reproduit dans le monde volumique. */
function tiretsAffines(el: Element): number {
  const n = (a: string) => Number(el.getAttribute(a));
  const len = Math.hypot(n('x2') - n('x1'), n('y2') - n('y1'));
  const [tiret, blanc] = (el.getAttribute('stroke-dasharray') ?? '').split(/[\s,]+/).map(Number);
  return len > 0 ? Math.max(1, Math.ceil(len / (tiret + blanc))) : 0;
}

/** Épaisseur du cadre (fraction de case) lue DANS la géométrie d'un pool de contour : le gabarit va de
 *  ±0,5 (bord externe) à ±(0,5 − k) (bord interne, cf. `highlightMeshes.tileFrameGeometry`). Un quad
 *  PLEIN n'a pas de bord interne : il n'a qu'une abscisse, et l'épaisseur y vaut la demi-case. */
function épaisseurCadre(mesh: THREE.InstancedMesh): number {
  const xs = [...new Set(Array.from(mesh.geometry.getAttribute('position').array as ArrayLike<number>).filter((_, i) => i % 3 === 0).map(Math.abs))].sort((a, b) => b - a);
  return xs.length === 1 ? xs[0] : xs[0] - xs[1];
}

beforeAll(() => {
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientWidth', { configurable: true, get: () => TAILLE.w });
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientHeight', { configurable: true, get: () => TAILLE.h });
  setStageRendererFactory(() => new BancRenderer());
});
afterAll(() => setStageRendererFactory(null));

afterEach(() => {
  démonter();
  setStageBackend('affine');
});

describe('Marques dynamiques — les deux voies peignent les mêmes repères (#1176 P3-0d)', () => {
  it('en COMBAT : le lien d’engagement et le contour de l’actif existent des DEUX côtés', () => {
    const affine = comptesAffines(monter('affine', 'battle'));
    expect(affine.tether, 'le témoin doit VRAIMENT porter un lien d’engagement').toBe(1);
    expect(affine.actif, 'le témoin doit VRAIMENT porter un contour d’actif').toBe(1);
    expect(affine.groupe, 'aucun repère de groupe en combat').toBe(0);
    démonter();

    monter('webgl', 'battle');
    const volumique = comptesVolumiques();
    expect(volumique.tether, 'le lien d’engagement n’est pas posé en volumique').toBeGreaterThan(0);
    expect(volumique.actif, 'un contour par case d’empreinte, comme en affine').toBe(affine.actif);
    expect(volumique.groupe).toBe(0);
  });

  it('HORS COMBAT : le repère de position du groupe existe des DEUX côtés, et rien du combat', () => {
    const affine = comptesAffines(monter('affine', 'exploration'));
    expect(affine.groupe, 'le témoin doit VRAIMENT porter le repère du groupe').toBe(1);
    expect(affine.tether + affine.actif).toBe(0);
    démonter();

    monter('webgl', 'exploration');
    expect(comptesVolumiques()).toEqual({ tether: 0, actif: 0, groupe: 1 });
  });

  it('en volumique, les trois pools sont montés d’emblée et portent la teinte du catalogue', () => {
    monter('webgl', 'battle');
    const scene = scènes[scènes.length - 1];
    const teintes = new Map<string, string>();
    scene.traverse((o) => {
      const m = o as THREE.InstancedMesh;
      if (!m.isInstancedMesh || !m.name.startsWith('marquesDyn:')) return;
      teintes.set(m.name, `#${(m.material as THREE.MeshBasicMaterial).color.getHexString()}`);
      expect(m.count, 'un compte dessiné borné par la capacité du pool').toBeLessThanOrEqual(m.instanceMatrix.count);
    });
    expect([...teintes.keys()].sort()).toEqual(['marquesDyn:actif', 'marquesDyn:groupe', 'marquesDyn:tether']);
    expect(teintes.get('marquesDyn:tether')).toBe(ENGAGE_TINT.toLowerCase());
    expect(teintes.get('marquesDyn:actif')).toBe(ACTIVE_HALO_TINT.toLowerCase());
    expect(teintes.get('marquesDyn:groupe')).toBe(ACTIVE_HALO_TINT.toLowerCase());
  });
});

describe('Marques dynamiques — ALLURE et EXCLUSIVITÉ des deux voies (#1176 P3-0d)', () => {
  it('un lien d’UNE case : le chapelet volumique compte autant de tirets que le pointillé affine', () => {
    const el = monter('affine', 'battle');
    const ligne = [...el.querySelectorAll('svg.iso-stage line')].find((l) => l.getAttribute('stroke') === ENGAGE_TINT)!;
    expect(ligne, 'le témoin doit VRAIMENT porter un lien d’engagement').toBeTruthy();
    // h1 (3,3) et e1 (4,3) sont voisins d’EST en OUEST : le pas de case se projette sur 35,78 px.
    expect(Math.hypot(
      Number(ligne.getAttribute('x2')) - Number(ligne.getAttribute('x1')),
      Number(ligne.getAttribute('y2')) - Number(ligne.getAttribute('y1')),
    )).toBeCloseTo(Math.hypot(TW / 2, TH / 2), 6);
    const tirets = tiretsAffines(ligne);
    expect(tirets).toBeGreaterThan(1);
    démonter();

    monter('webgl', 'battle');
    expect(comptesVolumiques().tether, 'même allure de pointillé d’une voie à l’autre').toBe(tirets);
  });

  it('AUCUNE DOUBLE PEINTURE : en webgl la voie affine n’émet pas ses marques, en affine rien n’est posé en volumique', () => {
    monter('webgl', 'battle');
    expect(comptesAffines(conteneur!), 'le SVG ne doit plus peindre les marques dynamiques en volumique').toEqual({ tether: 0, actif: 0, groupe: 0 });
    expect(comptesVolumiques().tether).toBeGreaterThan(0);
    démonter();

    monter('affine', 'battle');
    expect(scènes, 'aucune frame volumique en voie affine').toHaveLength(0);
  });

  it('une empreinte 2×2 : quatre cases de contour BOUT À BOUT, des deux côtés', () => {
    const gros = {
      ...combatEngagé(),
      combatants: [
        { ...hero('h1', { x: 3, y: 3 }), engagedWith: ['e1'], footprint: 2 },
        { ...hero('e1', { x: 5, y: 3 }), kind: 'enemy', engagedWith: ['h1'] },
      ],
    } as unknown as BattleState;
    const affine = comptesAffines(monter('affine', 'battle', { battle: gros }));
    expect(affine.actif).toBe(4);
    démonter();

    monter('webgl', 'battle', { battle: gros });
    const p = poolsVolumiques();
    expect(p.actif.count).toBe(4);
    // BOUT À BOUT : quatre cases distinctes, chacune à l'échelle d'UNE case (aucun chevauchement).
    const m = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const coins = new Set<string>();
    let côté = 0;
    for (let i = 0; i < p.actif.count; i++) {
      p.actif.getMatrixAt(i, m);
      m.decompose(pos, q, s);
      coins.add(`${pos.x.toFixed(3)},${pos.z.toFixed(3)}`);
      côté = s.x;
    }
    expect(coins.size).toBe(4);
    const xs = [...coins].map((c) => Number(c.split(',')[0])).sort((a, b) => a - b);
    expect(xs[3] - xs[0], 'deux colonnes distantes d’UNE case').toBeCloseTo(côté, 5);
  });

  it('les trois pools portent chacun SA matière : deux épaisseurs de cadre, un quad plein, trois teintes', () => {
    monter('webgl', 'exploration');
    const p = poolsVolumiques();
    expect(épaisseurCadre(p.actif), 'contour d’actif : le cadre des anneaux').toBeCloseTo(RING_FRAME_K, 5);
    expect(épaisseurCadre(p.groupe), 'repère de groupe : la MOITIÉ (1,5 px contre 3 en affine)').toBeCloseTo(PARTY_FRAME_K, 5);
    expect(PARTY_FRAME_K).toBeCloseTo(RING_FRAME_K / 2, 12);
    // le lien n'est pas un cadre mais un quad PLEIN : aucun bord interne à mesurer
    expect(épaisseurCadre(p.tether)).toBe(0.5);
    const teinte = (m: THREE.InstancedMesh) => `#${(m.material as THREE.MeshBasicMaterial).color.getHexString()}`;
    expect([teinte(p.tether), teinte(p.actif), teinte(p.groupe)]).toEqual([
      ENGAGE_TINT.toLowerCase(), ACTIVE_HALO_TINT.toLowerCase(), ACTIVE_HALO_TINT.toLowerCase(),
    ]);
    const opacité = (m: THREE.InstancedMesh) => (m.material as THREE.MeshBasicMaterial).opacity;
    expect([opacité(p.tether), opacité(p.actif), opacité(p.groupe)]).toEqual([0.6, 1, 0.5]);
  });

  it('un DIALOGUE ouvert coupe le repère du groupe dans les DEUX voies', () => {
    const affine = comptesAffines(monter('affine', 'exploration', { dialogue: { id: 'd1' } }));
    expect(affine).toEqual({ tether: 0, actif: 0, groupe: 0 });
    démonter();

    monter('webgl', 'exploration', { dialogue: { id: 'd1' } });
    expect(comptesVolumiques()).toEqual({ tether: 0, actif: 0, groupe: 0 });
  });
});

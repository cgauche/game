// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { useGame, type BattleState } from '../../state/store';
import { emptyScene, sceneMetresPerTile } from '../../state/scene';
import { setStageBackend } from '../../state/stage3d';
import type { Combatant } from '../../engine/types';
import { IsoStage } from '../IsoStage';
import { setStageRendererFactory, type StageRenderer } from './GameStage3D';
import { ACTIVE_HALO_TINT, ENGAGE_TINT } from '../highlightTints';
import { ENEMY_RING, HERO_RING, teamShape } from '../teamColors';
import { RING_A_PX, dashPattern } from '../builders/dynamicMarks';
import { ringDashes } from './dynamicMarkPose';
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

/** Ce que la voie VOLUMIQUE a posé : le `count` des trois pools de marques de la dernière frame rendue
 *  (l'anneau d'équipe se compte à part — un anneau y vaut un chapelet de cordes, cf. `anneaux`). */
function comptesVolumiques(): Record<string, number> {
  const scene = scènes[scènes.length - 1];
  const out: Record<string, number> = { tether: 0, actif: 0, groupe: 0 };
  scene.traverse((o) => {
    const m = o as THREE.InstancedMesh;
    if (!m.isInstancedMesh || !m.name.startsWith('marquesDyn:')) return;
    const slot = m.name.slice('marquesDyn:'.length);
    if (slot in out) out[slot] = m.count;
  });
  return out;
}

/** Les anneaux d'ÉQUIPE que la voie affine a peints : les ellipses de contour dont la couleur vient du
 *  catalogue d'équipe (`teamColors`) — l'art d'un rig porte, lui aussi, des ellipses de contour. */
function baguesAffines(el: HTMLElement): Element[] {
  const catalogue = new Set<string>([...HERO_RING, ENEMY_RING]);
  return [...el.querySelectorAll('svg.iso-stage ellipse')].filter(
    (e) => e.getAttribute('fill') === 'none' && catalogue.has(e.getAttribute('stroke') ?? ''),
  );
}

/** Anneaux d'équipe posés en volumique, RANGÉS PAR CENTRE : chaque corde est rattachée au jeton dont
 *  elle entoure les pieds (le plus proche), et l'on rend, par centre, le compte de cordes. Le rayon
 *  ATTENDU (mètres) est fourni par l'appelant — il vient de la formule affine, jamais de la mesure :
 *  une corde s'y confronte, elle ne s'y résume pas. C'est la parité de POPULATION : un anneau par jeton
 *  posté, comme en affine. */
function anneaux(centres: { x: number; z: number; rM: number }[]): { cordes: number }[] {
  const p = poolsVolumiques().anneau;
  const lots = centres.map(() => ({ cordes: 0 }));
  const m = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    p.getMatrixAt(i, m);
    pos.setFromMatrixPosition(m);
    let meilleur = 0;
    let d = Infinity;
    centres.forEach((c, k) => {
      const dk = Math.hypot(pos.x - c.x, pos.z - c.z);
      if (dk < d) {
        d = dk;
        meilleur = k;
      }
    });
    lots[meilleur].cordes++;
    expect(d, 'chaque corde est sur le cercle ATTENDU de son jeton').toBeCloseTo(centres[meilleur].rM, 4);
  }
  return lots;
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

  it('en volumique, les quatre pools sont montés d’emblée et portent la teinte du catalogue', () => {
    monter('webgl', 'battle');
    const scene = scènes[scènes.length - 1];
    const teintes = new Map<string, string>();
    scene.traverse((o) => {
      const m = o as THREE.InstancedMesh;
      if (!m.isInstancedMesh || !m.name.startsWith('marquesDyn:')) return;
      teintes.set(m.name, `#${(m.material as THREE.MeshBasicMaterial).color.getHexString()}`);
      expect(m.count, 'un compte dessiné borné par la capacité du pool').toBeLessThanOrEqual(m.instanceMatrix.count);
    });
    expect([...teintes.keys()].sort()).toEqual(['marquesDyn:actif', 'marquesDyn:anneau', 'marquesDyn:groupe', 'marquesDyn:tether']);
    expect(teintes.get('marquesDyn:tether')).toBe(ENGAGE_TINT.toLowerCase());
    expect(teintes.get('marquesDyn:actif')).toBe(ACTIVE_HALO_TINT.toLowerCase());
    expect(teintes.get('marquesDyn:groupe')).toBe(ACTIVE_HALO_TINT.toLowerCase());
    // L'anneau d'équipe change de couleur d'un combattant à l'autre : son matériau reste NEUTRE et la
    // teinte voyage PAR INSTANCE (`instanceColor`), comme les marques de case.
    expect(teintes.get('marquesDyn:anneau')).toBe('#ffffff');
    expect(poolsVolumiques().anneau.instanceColor, 'l’anneau porte sa teinte par instance').toBeTruthy();
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
    expect(baguesAffines(conteneur!), 'ni les anneaux d’équipe, qui vivent dans le jeton').toHaveLength(0);
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
    // Le LIEN est à PLEINE opacité côté volumique, là où l'affine le peint à 0,6 : la scène y est trois
    // fois plus claire, et c'est l'effet PERÇU qui se met en parité (`DYN_SLOT_OPACITY`).
    expect([opacité(p.tether), opacité(p.actif), opacité(p.groupe)]).toEqual([1, 1, 0.5]);
  });

  it('ANNEAUX D’ÉQUIPE : un par combattant posté des deux côtés, au MÊME rayon et au MÊME pointillé', () => {
    const bagues = baguesAffines(monter('affine', 'battle'));
    expect(bagues.map((b) => b.getAttribute('stroke')), 'un anneau par jeton, à la couleur de son équipe').toEqual([
      HERO_RING[0],
      ENEMY_RING,
    ]);
    // R9 : la FORME encode l'équipe — le héros plein, l'ennemi pointillé.
    expect(bagues.map((b) => b.getAttribute('stroke-dasharray'))).toEqual([null, teamShape(false)!]);
    const rxAffine = bagues.map((b) => Number(b.getAttribute('rx')));
    démonter();

    monter('webgl', 'battle');
    // h1 (3,3) et e1 (4,3), à `mpt` mètres par case (`emptyScene` : la valeur par défaut).
    const mpt = sceneMetresPerTile(emptyScene(10, 10));
    // Le rayon ATTENDU vient de l'ellipse AFFINE (`rx` px, à `RING_A_PX` px par case) : c'est LUI que
    // les cordes volumiques doivent retrouver, jamais leur propre moyenne.
    const rMAttendu = rxAffine.map((rx) => (rx / RING_A_PX) * mpt);
    const lots = anneaux([{ x: 3 * mpt, z: 3 * mpt, rM: rMAttendu[0] }, { x: 4 * mpt, z: 3 * mpt, rM: rMAttendu[1] }]);
    expect(lots.map((l) => l.cordes > 0), 'CHAQUE jeton posté porte son anneau').toEqual([true, true]);
    lots.forEach((lot, i) => {
      // et le chapelet compte ce que le pointillé de CETTE équipe demande : plein pour le héros,
      // pointillé « 5 3 » pour l'ennemi.
      expect(lot.cordes).toBe(ringDashes(rMAttendu[i] / mpt, i === 0 ? null : dashPattern(teamShape(false)), 'iso').length);
    });
  });

  it('HORS COMBAT, le jeton de GROUPE porte lui aussi son anneau des deux côtés', () => {
    const bagues = baguesAffines(monter('affine', 'exploration'));
    expect(bagues.map((b) => b.getAttribute('stroke'))).toEqual([HERO_RING[0]]);
    const rxAffine = Number(bagues[0].getAttribute('rx'));
    démonter();

    monter('webgl', 'exploration');
    const mpt = sceneMetresPerTile(emptyScene(10, 10));
    expect(anneaux([{ x: 6 * mpt, z: 6 * mpt, rM: (rxAffine / RING_A_PX) * mpt }])[0].cordes).toBeGreaterThan(0);
  });

  it('un MENEUR non-héros ne teinte pas le jeton de groupe en ennemi — même anneau des deux côtés', () => {
    // Le code de groupe s'en garde ailleurs (`state/partyFlow`), mais la DÉCORATION ne doit pas dépendre
    // de cette hypothèse : le jeton de groupe dit « le groupe est ici », pas « à quelle équipe ».
    const escorte = [{ ...hero('h1', { x: 6, y: 6 }), kind: 'npc' } as unknown as Combatant];
    const bagues = baguesAffines(monter('affine', 'exploration', { party: escorte }));
    expect(bagues.map((b) => b.getAttribute('stroke')), 'anneau du groupe : jamais le rouge ennemi').toEqual([HERO_RING[0]]);
    expect(bagues[0].getAttribute('stroke-dasharray'), 'ni pointillé').toBeNull();
    const rxAffine = Number(bagues[0].getAttribute('rx'));
    démonter();

    monter('webgl', 'exploration', { party: escorte });
    const mpt = sceneMetresPerTile(emptyScene(10, 10));
    const rK = rxAffine / RING_A_PX;
    const lot = anneaux([{ x: 6 * mpt, z: 6 * mpt, rM: rK * mpt }])[0];
    // trait PLEIN des deux côtés : un chapelet pointillé en compterait bien moins
    expect(lot.cordes).toBe(ringDashes(rK, null, 'iso').length);
    expect(lot.cordes).toBeGreaterThan(ringDashes(rK, dashPattern(teamShape(false)), 'iso').length);
    const teinte = new THREE.Color();
    poolsVolumiques().anneau.getColorAt(0, teinte);
    expect(`#${teinte.getHexString()}`).toBe(HERO_RING[0].toLowerCase());
  });

  it('un DIALOGUE ouvert coupe le repère du groupe dans les DEUX voies', () => {
    const affine = comptesAffines(monter('affine', 'exploration', { dialogue: { id: 'd1' } }));
    expect(affine).toEqual({ tether: 0, actif: 0, groupe: 0 });
    démonter();

    monter('webgl', 'exploration', { dialogue: { id: 'd1' } });
    expect(comptesVolumiques()).toEqual({ tether: 0, actif: 0, groupe: 0 });
  });
});

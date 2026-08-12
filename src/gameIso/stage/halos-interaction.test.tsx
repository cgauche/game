// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { useGame } from '../../state/store';
import { emptyScene, sceneMetresPerTile, type Scene, type SceneEntity } from '../../state/scene';
import { setStageBackend } from '../../state/stage3d';
import type { Combatant } from '../../engine/types';
import type { Dims } from '../../geometry/iso';
import { IsoStage } from '../IsoStage';
import { GameStage3D, setStageRendererFactory, type StageRenderer, type StageWalkAnim } from './GameStage3D';
import { HALO_SLOTS } from '../backends/webgl/interactHaloMeshes';
import { haloRadiusK, HALO_RX_PX, type InteractionHalos } from '../builders/interactHalos';
import { PING_S } from './interactHaloPose';

/**
 * HALOS D'INTERACTION dans les DEUX voies (#1176, P3-0g). Deux faits distincts s'y mesurent :
 *
 *  1. PARITÉ DE PRÉSENCE — le décor fouillable appelle le joueur des deux côtés, et le flag
 *     d'épuisement (`__fouille_<id>`) l'éteint des deux côtés. La voie affine peint des ellipses
 *     animées par CSS, la voie volumique des anneaux plats posés à la frame : ce qui doit coïncider,
 *     c'est ce qui est peint et ce qui ne l'est pas.
 *  2. PULSATION PAR FRAME — ce que le navigateur donne gratuitement à la voie affine (il rejoue ses
 *     keyframes tout seul), la voie volumique ne l'obtient que d'une fonction de l'horloge, rejouée
 *     dans la BOUCLE. Le banc n'appelle donc `root.render` qu'UNE fois : tout ce qui bouge ensuite
 *     passe par le battement, et par lui seul.
 *
 * ANGLES MORTS DÉCLARÉS. (a) Le SURVOL n'est pas posé par un vrai pointeur : jsdom n'a ni layout ni
 * géométrie, donc aucun `pointermove` n'y désigne une tuile. Il passe par la couture DEV de
 * `useStagePointer` (`__wfrpSetHover`, celle de la recette navigateur) — la chaîne pixel → tuile
 * (`stepFromScreen`) reste donc hors mesure ICI, elle est couverte par `stage/pick-parity`. (b) Ce banc
 * ne juge PAS le rendu : jsdom ne joue aucune keyframe CSS et ne rastérise rien — l'apparence des deux
 * voies (teinte, épaisseur perçue, lueur de survol) se juge au navigateur, pas ici.
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

function hero(id: string, pos: { x: number; y: number }): Combatant {
  return {
    id, label: id, kind: 'hero', pos, size: 'moyenne',
    wounds: { current: 12, max: 12 }, weapons: [],
    characteristics: { 'capacite-de-combat': 40, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    advantage: 0, conditions: [], armour: {},
    skills: [], talents: [], movement: 4,
  } as unknown as Combatant;
}

/** Un décor FOUILLABLE posé sur la carte — l'entité dont le halo est l'affordance. */
const coffre = {
  id: 'coffre',
  kind: 'prop',
  pos: { x: 3, y: 4 },
  ref: 'tonneau',
  interact: { flow: { do: [] } },
} as unknown as SceneEntity;

/** Un PNJ INTERLOCUTEUR — l'autre affordance : pas de halo permanent, un halo au SURVOL seul. */
const marchand = {
  id: 'marchand',
  kind: 'personnage',
  pos: { x: 7, y: 2 },
  dialogueId: 'd1',
} as unknown as SceneEntity;

function scèneAvecCoffre(): Scene {
  const s = emptyScene(10, 10);
  return { ...s, entities: [...s.entities, coffre, marchand] };
}

/** Pose le survol comme le fait la souris — par la couture DEV de `useStagePointer`, la même que la
 *  recette navigateur (`__wfrp.hover`) : l'état de survol vit dans ce hook, pas dans le store, et aucun
 *  `pointermove` jsdom ne le poserait (jsdom n'a ni géométrie ni `getBoundingClientRect` utile). */
function survoler(t: { x: number; y: number; z?: number } | null): void {
  const w = window as unknown as { __wfrpSetHover?: (t: unknown) => void };
  expect(w.__wfrpSetHover, 'la couture DEV de survol doit être posée').toBeTypeOf('function');
  act(() => w.__wfrpSetHover!(t));
}

function monter(backend: 'affine' | 'webgl', flags: Record<string, boolean> = {}): HTMLDivElement {
  setStageBackend(backend);
  useGame.setState({
    scene: scèneAvecCoffre(),
    mode: 'exploration',
    partyPos: { x: 6, y: 6 },
    party: [hero('h1', { x: 6, y: 6 })],
    battle: null,
    dialogue: null,
    flags,
    hovered: null,
    pendingAttack: null,
  } as never);
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

/** Ce que la voie AFFINE a peint : les groupes de halo, l'onde et l'étincelle du SVG monté. */
function comptesAffines(el: HTMLElement): { halo: number; ping: number; spark: number } {
  return {
    halo: el.querySelectorAll('svg.iso-stage g.interact-halo').length,
    ping: el.querySelectorAll('svg.iso-stage ellipse.halo-ping').length,
    spark: el.querySelectorAll('svg.iso-stage g.halo-spark').length,
  };
}

/** Les pools de halos de la dernière frame rendue, par slot. */
function poolsVolumiques(): Record<string, THREE.InstancedMesh> {
  const out: Record<string, THREE.InstancedMesh> = {};
  scènes[scènes.length - 1].traverse((o) => {
    const m = o as THREE.InstancedMesh;
    if (m.isInstancedMesh && m.name.startsWith('halos:')) out[m.name.slice('halos:'.length)] = m;
  });
  return out;
}

/** Total des instances peintes par les pools de halos. */
function totalVolumique(): number {
  const p = poolsVolumiques();
  return HALO_SLOTS.reduce((n, slot) => n + (p[slot]?.count ?? 0), 0);
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
  vi.restoreAllMocks();
});

describe('Halos d’interaction — les deux voies peignent la même affordance (#1176 P3-0g)', () => {
  it('un décor fouillable appelle le joueur des DEUX côtés', () => {
    const affine = comptesAffines(monter('affine'));
    expect(affine, 'le témoin doit VRAIMENT porter halo, onde et étincelle').toEqual({ halo: 1, ping: 1, spark: 1 });
    démonter();

    monter('webgl');
    const p = poolsVolumiques();
    expect(Object.keys(p).sort(), 'les huit pools sont montés d’emblée').toEqual(HALO_SLOTS.slice().sort().map((s) => s));
    expect(p.fouilleDisque.count, 'le disque du halo').toBe(1);
    expect(p.fouilleContour.count, 'le contour doré').toBeGreaterThan(3);
    expect(p.fouilleEtincelle.count, 'l’étincelle au-dessus du décor').toBe(1);
    expect(p.fouilleDisqueSurvol.count + p.fouilleContourSurvol.count, 'rien n’est survolé').toBe(0);
    expect(p.pnjDisque.count + p.pnjContour.count, 'aucun PNJ interlocuteur ici').toBe(0);
  });

  it('ÉPUISEMENT : le flag `__fouille_<id>` éteint le halo des DEUX côtés', () => {
    expect(comptesAffines(monter('affine', { __fouille_coffre: true })), 'un coffre vidé n’appelle plus').toEqual({ halo: 0, ping: 0, spark: 0 });
    démonter();

    monter('webgl', { __fouille_coffre: true });
    expect(totalVolumique()).toBe(0);
    démonter();

    // TÉMOIN : sans le flag, les deux voies peignent bien quelque chose (le test ci-dessus ne mesure
    // pas seulement une scène vide).
    expect(comptesAffines(monter('affine')).halo).toBe(1);
    démonter();
    monter('webgl');
    expect(totalVolumique()).toBeGreaterThan(0);
  });

  it('AUCUNE DOUBLE PEINTURE : en webgl le SVG ne peint plus les halos, en affine rien n’est posé en volumique', () => {
    monter('webgl');
    expect(comptesAffines(conteneur!)).toEqual({ halo: 0, ping: 0, spark: 0 });
    expect(totalVolumique()).toBeGreaterThan(0);
    démonter();

    monter('affine');
    expect(scènes, 'aucune frame volumique en voie affine').toHaveLength(0);
  });

  it('le halo volumique est au PIED du décor, au rayon que l’ellipse affine projette', () => {
    const el = monter('affine');
    const ellipse = el.querySelector('svg.iso-stage g.interact-halo ellipse')!;
    const rxAffine = Number(ellipse.getAttribute('rx'));
    expect(rxAffine).toBe(HALO_RX_PX); // décor 1×1, échelle 1
    démonter();

    monter('webgl');
    const mpt = sceneMetresPerTile(emptyScene(10, 10));
    const m = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    poolsVolumiques().fouilleDisque.getMatrixAt(0, m);
    pos.setFromMatrixPosition(m);
    expect(pos.x).toBeCloseTo(3 * mpt, 5);
    expect(pos.z).toBeCloseTo(4 * mpt, 5);
    // et les cordes du contour sont sur le cercle dont l'ellipse affine EST la projection
    const contour = poolsVolumiques().fouilleContour;
    const rAttendu = haloRadiusK(rxAffine) * mpt;
    for (let i = 0; i < contour.count; i++) {
      contour.getMatrixAt(i, m);
      pos.setFromMatrixPosition(m);
      expect(Math.hypot(pos.x - 3 * mpt, pos.z - 4 * mpt)).toBeCloseTo(rAttendu, 5);
    }
  });

  it('un PNJ INTERLOCUTEUR n’appelle qu’au SURVOL — et il appelle des DEUX côtés', () => {
    const el = monter('affine');
    expect(comptesAffines(el).halo, 'sans survol : le seul halo est celui du coffre').toBe(1);
    survoler({ x: marchand.pos!.x, y: marchand.pos!.y, z: 0 });
    expect(comptesAffines(el).halo, 'le PNJ survolé ajoute SON halo').toBe(2);
    survoler(null);
    expect(comptesAffines(el).halo, 'le survol retiré, le halo du PNJ tombe').toBe(1);
    démonter();

    monter('webgl');
    expect(poolsVolumiques().pnjDisque.count, 'sans survol : aucun halo de PNJ en volumique').toBe(0);
    survoler({ x: marchand.pos!.x, y: marchand.pos!.y, z: 0 });
    const p = poolsVolumiques();
    expect(p.pnjDisque.count, 'le disque du halo de PNJ').toBe(1);
    expect(p.pnjContour.count, 'et son contour doré').toBeGreaterThan(3);
    survoler(null);
    expect(poolsVolumiques().pnjDisque.count + poolsVolumiques().pnjContour.count).toBe(0);
  });

  it('SUPPRESSION : le halo retiré vide ses pools AU RENDU, sans attendre un battement', () => {
    monter('webgl');
    expect(totalVolumique(), 'témoin : le coffre appelle').toBeGreaterThan(0);
    const frames = scènes.length;
    // Le décor est fouillé : c'est le RENDU qui doit vider les pools — la boucle de pulsation ne bat
    // pas dans ce banc (aucun `requestAnimationFrame` n'est déclenché ici).
    act(() => useGame.setState({ flags: { __fouille_coffre: true } } as never));
    expect(scènes.length, 'le rendu a bien rejoué la scène volumique').toBeGreaterThan(frames);
    expect(totalVolumique(), 'et rien ne reste des instances de la frame précédente').toBe(0);
  });

  it('PARITÉ BYTE-IDENTIQUE : le markup affine du halo n’a pas bougé d’un octet', () => {
    // La voie affine est la BASE de comparaison de tout ce lot : elle ne doit rien perdre à ce que la
    // voie volumique lui emprunte (le glyphe de l'étincelle est désormais RENDU par
    // `interactHalos.sparkPathD`, partagé avec le gabarit volumique — l'octet le prouve).
    const el = monter('affine');
    const halo = el.querySelector('svg.iso-stage g.interact-halo')!.parentElement!;
    const spark = el.querySelector('svg.iso-stage g.halo-spark')!;
    expect(halo.innerHTML).toBe(
      '<g class="interact-halo">'
        + '<ellipse cx="288" cy="276" rx="17" ry="8.5" fill="#ffe27a" opacity="0.26"></ellipse>'
        + '<ellipse cx="288" cy="276" rx="17" ry="8.5" fill="none" stroke="#ffd75e" stroke-width="2" opacity="0.9"></ellipse>'
        + '</g>'
        + '<ellipse class="halo-ping" cx="288" cy="276" rx="17" ry="8.5" fill="none" stroke="#ffd75e" stroke-width="1.6"></ellipse>',
    );
    expect(spark.outerHTML).toBe(
      '<g class="halo-spark" pointer-events="none" transform="translate(297, 246)">'
        + '<path d="M0,-6 L1.7,-1.7 L6,0 L1.7,1.7 L0,6 L-1.7,1.7 L-6,0 L-1.7,-1.7 Z" fill="#ffd75e" stroke="#7a5b16" stroke-width="0.7"></path>'
        + '</g>',
    );
  });
});

// ── PULSATION PAR FRAME ────────────────────────────────────────────────────────────────────────────

const SCENE_NUE: Scene = emptyScene(10, 10);
const DIMS: Dims = { w: SCENE_NUE.dimensions.w, h: SCENE_NUE.dimensions.h, rot: 0, view: 'iso' };
const HALOS: InteractionHalos = {
  fouilles: [{ id: 'coffre', cell: { x: 3, y: 4, z: 0 }, span: { w: 1, h: 1 }, centre: { x: 3, y: 4 }, scale: 1, hovered: false, visible: true }],
  pnjs: [],
};

describe('Halos d’interaction — la pulsation se prend à la FRAME (#1176 P3-0g)', () => {
  it('un battement fait avancer la PHASE ; aucun rendu React n’y participe', () => {
    scènes = [];
    let battre: (() => void) | null = null;
    const anim: StageWalkAnim = {
      subscribe: (onFrame) => { battre = onFrame; return () => { battre = null; }; },
      glide: () => null,
      cam: () => ({ x: 0, y: 0 }),
    };
    // L'HORLOGE du banc : c'est elle, et rien d'autre, qui fait battre les halos.
    let horlogeMs = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => horlogeMs);

    conteneur = document.createElement('div');
    document.body.appendChild(conteneur);
    root = createRoot(conteneur);
    act(() => root!.render(
      <GameStage3D
        scene={SCENE_NUE}
        dims={DIMS}
        mpt={sceneMetresPerTile(SCENE_NUE)}
        cam={{ x: 0, y: 0 }}
        zoom={1}
        tintAt={() => 1}
        keepEl={() => true}
        els={{ tokens: [], props: [] }}
        actors={[]}
        gameTime={720}
        lightLevel={null}
        lights={[]}
        halos={HALOS}
        anim={anim}
      />,
    ));

    expect(battre, 'l’écran doit s’être abonné au battement').toBeTypeOf('function');
    const onde = () => poolsVolumiques().fouillePing;
    const rayonOnde = () => {
      const p = onde();
      const m = new THREE.Matrix4();
      const pos = new THREE.Vector3();
      let somme = 0;
      for (let i = 0; i < p.count; i++) {
        p.getMatrixAt(i, m);
        pos.setFromMatrixPosition(m);
        somme += Math.hypot(pos.x - 3 * sceneMetresPerTile(SCENE_NUE), pos.z - 4 * sceneMetresPerTile(SCENE_NUE));
      }
      return somme / p.count;
    };
    const opacitéHalo = () => (poolsVolumiques().fouilleDisque.material as THREE.MeshBasicMaterial).opacity;

    expect(onde().count, 'le témoin doit VRAIMENT peindre une onde').toBeGreaterThan(0);
    const r0 = rayonOnde();
    const o0 = opacitéHalo();

    // L'horloge avance SANS aucune écriture React (ni store, ni prop, ni état) : tant que la frame ne se
    // rejoue pas, la scène montée garde la pose et l'opacité précédentes.
    const rendusAvant = scènes.length;
    horlogeMs = PING_S * 1000 * 0.3;
    expect(rayonOnde()).toBe(r0);
    expect(opacitéHalo()).toBe(o0);
    expect(scènes.length, 'avancer l’horloge ne déclenche à lui seul aucune frame').toBe(rendusAvant);

    // UN battement, et rien d'autre : la pulsation suit.
    battre!();
    expect(scènes.length).toBe(rendusAvant + 1);
    expect(rayonOnde(), 'l’onde s’est élargie').toBeGreaterThan(r0);
    expect(opacitéHalo(), 'le halo a changé d’opacité').not.toBe(o0);

    // Et la phase BOUCLE : une période plus tard, on retrouve la pose de départ.
    horlogeMs = PING_S * 1000;
    battre!();
    expect(rayonOnde()).toBeCloseTo(r0, 6);
  });

  it('la BOUCLE de pulsation ne bat QUE s’il y a un halo à l’écran', () => {
    const raf = vi.spyOn(globalThis, 'requestAnimationFrame').mockReturnValue(1 as unknown as number);
    scènes = [];
    conteneur = document.createElement('div');
    document.body.appendChild(conteneur);
    root = createRoot(conteneur);
    const écran = (halos: InteractionHalos | undefined) => (
      <GameStage3D
        scene={SCENE_NUE}
        dims={DIMS}
        mpt={sceneMetresPerTile(SCENE_NUE)}
        cam={{ x: 0, y: 0 }}
        zoom={1}
        tintAt={() => 1}
        keepEl={() => true}
        els={{ tokens: [], props: [] }}
        actors={[]}
        gameTime={720}
        lightLevel={null}
        lights={[]}
        halos={halos}
      />
    );
    act(() => root!.render(écran(undefined)));
    expect(raf, 'une scène sans halo ne rejoue pas une frame de plus qu’avant ce lot').not.toHaveBeenCalled();
    act(() => root!.render(écran(HALOS)));
    expect(raf, 'un halo à l’écran ouvre la boucle').toHaveBeenCalled();
  });
});

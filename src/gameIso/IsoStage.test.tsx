// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useGame } from '../state/store';
import { emptyScene, heightAt } from '../state/scene';
import type { Combatant } from '../engine/types';
import * as propsBuilder from './builders/props';
import * as roomPortalsModule from '../state/roomPortals';
import * as roofsBuilder from './builders/roofs';
import * as wallsBuilder from './builders/walls';
import { IsoStage } from './IsoStage';
import { capsuleCenter, tileCenter, LEVEL_H, type Dims } from '../geometry/iso';
import { metricToLift } from '../state/relief';
import { actorCapsuleOf } from './stage/actorCapsule';
import { VW, VH } from './stage/useStageCamera';

/**
 * #817 — un rendu de PLUS (survol, pan caméra, tout état sans rapport avec scène/position
 * logique/pièce/étage/rotation) ne doit RIEN rebâtir : `buildProps` scanne toute la carte
 * (~2144 objets de scène sur La Diligence) et tournait jusqu'à 60×/s pendant une marche
 * (`visualAllies`/`cutawayAllies` recréés à chaque rendu → `propEls` invalidé en boucle).
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

describe('IsoStage — stabilité de propEls entre deux rendus sans changement logique (#817)', () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  afterEach(() => {
    if (root) { act(() => root!.unmount()); root = null; }
    if (container) { container.remove(); container = null; }
    vi.restoreAllMocks();
  });

  it('un second rendu sans changement de scène/position/pièce/étage/rotation ne rappelle pas buildProps', () => {
    const scene = emptyScene(6, 6);
    // Zone descriptive INTÉRIEURE (aucun onCross/perRound/crossTest/barrier/blocksLoS) englobant la
    // position du groupe : `roomFocus` devient non-null → `cutawayAllies` VAUT `visualAllies` (au lieu
    // d'`undefined`), le chemin exact où l'instabilité de référence de #817 se propageait à `propEls`.
    scene.effectZones = [{ id: 'room-a', label: 'Salle', area: { kind: 'rect', x: 0, y: 0, w: 6, h: 6 }, presentation: 'interior', tiles: [{ x: 2, y: 2 }], z: 0 }];
    const H = hero('h1', { x: 2, y: 2 });
    useGame.setState({
      scene,
      mode: 'exploration',
      partyPos: { x: 2, y: 2 },
      party: [H],
      battle: null,
      dialogue: null,
      flags: {},
    });

    const spy = vi.spyOn(propsBuilder, 'buildProps');

    container = document.createElement('div');
    root = createRoot(container);
    act(() => root!.render(<IsoStage />));
    // Le montage peut déclencher SA PROPRE re-passe interne (effet `markExplored`) — on ne fige le
    // compteur qu'UNE FOIS le montage stabilisé, pour isoler le SEUL rendu forcé qui suit.
    const afterMount = spy.mock.calls.length;
    expect(afterMount).toBeGreaterThan(0);

    // Second rendu FORCÉ (ex. re-rendu React déclenché par un état sans rapport) : aucun changement
    // logique n'a eu lieu entre les deux — `buildProps` ne doit PAS être rappelé.
    act(() => root!.render(<IsoStage />));
    expect(spy.mock.calls.length).toBe(afterMount);
  });
});

/**
 * #817 — les ACCÈS de pièce sont le poste le plus lourd du stage : hors zone intérieure,
 * `portalsForParty` teste l'accessibilité de CHAQUE porte extérieure par un BFS plein-carte
 * (`roomPortals.ts` → `pathTo`, sans borne de portée). Ses seules vraies entrées sont la SCÈNE et la
 * case de CONTRÔLE ; une image d'animation de marche (le jeton glisse, la case ne change pas) ne
 * doit en déclencher AUCUN, et un changement de case doit en déclencher UN.
 */
describe('IsoStage — accès de pièce recalculés à la case, pas à l’image (#817)', () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  afterEach(() => {
    if (root) { act(() => root!.unmount()); root = null; }
    if (container) { container.remove(); container = null; }
    vi.restoreAllMocks();
  });

  it('un rendu de plus sans changement de case ne rappelle pas portalsForParty — un pas le rappelle', () => {
    const scene = emptyScene(6, 6);
    useGame.setState({
      scene,
      mode: 'exploration',
      partyPos: { x: 2, y: 2 },
      party: [hero('h1', { x: 2, y: 2 })],
      battle: null,
      dialogue: null,
      flags: {},
    });

    const spy = vi.spyOn(roomPortalsModule, 'portalsForParty');

    container = document.createElement('div');
    root = createRoot(container);
    act(() => root!.render(<IsoStage />));
    const afterMount = spy.mock.calls.length;
    expect(afterMount).toBeGreaterThan(0);

    // Rendu FORCÉ sans changement logique : c'est le cas d'une image d'animation de marche.
    act(() => root!.render(<IsoStage />));
    expect(spy.mock.calls.length).toBe(afterMount);

    // Un vrai PAS change la case de contrôle : les accès doivent bien être recalculés (le memo ne
    // sur-cache pas — une porte devenue accessible doit apparaître).
    act(() => { useGame.setState({ partyPos: { x: 3, y: 2 } }); });
    act(() => root!.render(<IsoStage />));
    expect(spy.mock.calls.length).toBeGreaterThan(afterMount);
  });
});

/**
 * #818/#907 — le DÉGAGEMENT est UNE loi (`cutawayForSection`) sur UNE résolution (`clearedSpace` :
 * pièce occupée, et à DÉFAUT de pièce, emprise qui abrite ou coiffe l'allié). Le stage ne la
 * réimplémente pas : il lui passe les positions alliées, puis l'étend aux couvercles qui cachent le
 * groupe À L'ÉCRAN (`lidCutaway`, qui exige la projection — donc le stage, jamais le builder). Ce
 * test verrouille le CÂBLAGE : sans les positions alliées, un bâti NON ZONÉ (carte en cours
 * d'édition) ne se dégagerait jamais.
 */
describe('IsoStage — les positions alliées atteignent la loi de dégagement (#818, #907)', () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  afterEach(() => {
    if (root) { act(() => root!.unmount()); root = null; }
    if (container) { container.remove(); container = null; }
    vi.restoreAllMocks();
  });

  it('clearedSpace reçoit les positions alliées, étage compris — jamais la scène seule', () => {
    const scene = emptyScene(6, 6);
    useGame.setState({
      scene,
      mode: 'exploration',
      partyPos: { x: 4, y: 3 },
      party: [hero('h1', { x: 4, y: 3 })],
      battle: null,
      dialogue: null,
      flags: {},
    });

    const spy = vi.spyOn(roofsBuilder, 'clearedSpace');

    container = document.createElement('div');
    root = createRoot(container);
    act(() => root!.render(<IsoStage />));

    expect(spy).toHaveBeenCalled();
    const allies = spy.mock.calls[spy.mock.calls.length - 1][1];
    expect(allies).toEqual([{ x: 4, y: 3, z: 0 }]);
  });

  /** #950 — la VUE du groupe atteint la même loi : sans elle, aucune nappe ne serait régie par la
   *  vision et les toitures des corps voisins se peindraient par-dessus l'intérieur. */
  it('clearedSpace reçoit aussi les cases VUES par le groupe', () => {
    const scene = emptyScene(6, 6);
    useGame.setState({
      scene,
      mode: 'exploration',
      partyPos: { x: 4, y: 3 },
      party: [hero('h1', { x: 4, y: 3 })],
      battle: null,
      dialogue: null,
      flags: {},
      explored: {},
    });

    const spy = vi.spyOn(roofsBuilder, 'clearedSpace');

    container = document.createElement('div');
    root = createRoot(container);
    act(() => root!.render(<IsoStage />));
    act(() => root!.render(<IsoStage />)); // 2e rendu : l'exploré du 1er pas est accumulé

    const sight = spy.mock.calls[spy.mock.calls.length - 1][2];
    expect(sight).toBeInstanceOf(Set);
    expect(sight!.has('4,3,0')).toBe(true);
  });
});

/**
 * #892 — la VUE DU DESSUS est le mode TACTIQUE du jeu (et la source de la minimap) : on y regarde UN
 * plancher À LA VERTICALE. Superposer les murs du rez à ceux de l'étage rendait le plan illisible. La
 * distinction ne passe par AUCUN réglage d'affichage : l'appelant fournit le `viewZ` du pivot
 * (isolement d'un étage), et les builders continuent d'ignorer le mode de vue.
 */
describe('IsoStage — la vue du dessus isole l’étage actif (#892)', () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  afterEach(() => {
    if (root) { act(() => root!.unmount()); root = null; }
    if (container) { container.remove(); container = null; }
    vi.restoreAllMocks();
  });

  /** Auberge à deux planchers : un mur au REZ, un mur à l'ÉTAGE. */
  function twoStoreyScene() {
    const scene = emptyScene(6, 6);
    scene.layers.push({ z: 1, tiles: new Array(36).fill('herbe') });
    scene.walls = [{ x: 2, y: 2, side: 'N' }, { x: 3, y: 2, side: 'N', z: 1 }];
    return scene;
  }
  const storeysBuilt = (spy: { mock: { results: { value: unknown }[] } }) =>
    [...new Set((spy.mock.results[spy.mock.results.length - 1].value as { cell: { z: number } }[]).map((el) => el.cell.z))].sort();

  it('groupe à l’étage : l’iso dresse l’étage ET le rez ; la vue du dessus, le seul étage', () => {
    useGame.setState({
      scene: twoStoreyScene(),
      mode: 'exploration',
      partyPos: { x: 2, y: 2, z: 1 },
      party: [hero('h1', { x: 2, y: 2 })],
      battle: null,
      dialogue: null,
      flags: {},
      viewMode: 'iso',
    });
    const spy = vi.spyOn(wallsBuilder, 'buildWalls');

    container = document.createElement('div');
    root = createRoot(container);
    act(() => root!.render(<IsoStage />));
    expect(storeysBuilt(spy)).toEqual([0, 1]); // iso : le contrebas reste du contexte utile

    act(() => { useGame.setState({ viewMode: 'top' }); });
    expect(storeysBuilt(spy)).toEqual([1]); // plan : l'étage actif, et lui seul

    act(() => { useGame.setState({ viewMode: 'iso' }); });
    expect(storeysBuilt(spy)).toEqual([0, 1]); // retour en iso : rien n'a changé
  });
});

/**
 * VISÉE DU SUJET : la caméra centre le MILIEU de la capsule du sujet (`actorCapsuleOf`, celle-là même
 * que consomme l'occlusion), jamais le sol de sa case — un cadrage sur le sol pousse le viewport d'une
 * demi-capsule vers le haut de la scène, donc vers ce qui SURPLOMBE le groupe (biais × zoom).
 */
describe('IsoStage — la caméra vise le milieu de la capsule du sujet', () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  afterEach(() => {
    if (root) { act(() => root!.unmount()); root = null; }
    if (container) { container.remove(); container = null; }
    vi.restoreAllMocks();
  });

  /** Point de la SCÈNE que la transformation caméra du stage amène au CENTRE du viewport : la `matrix()`
   *  rendue par `stageCamTransform` (`stage/stageCam.ts`), simplement INVERSÉE — la loi de caméra n'est
   *  pas répliquée ici. */
  function viseOf(el: HTMLDivElement): { x: number; y: number } {
    const style = el.querySelector('svg > g')!.getAttribute('style')!;
    const m = /matrix\(([^)]+)\)/.exec(style)!;
    const [k, , , , tx, ty] = m[1].split(',').map(Number);
    return { x: (VW / 2 - tx) / k, y: (VH / 2 - ty) / k };
  }

  function mount(partyPos: { x: number; y: number; z?: number }, height?: number[]) {
    const scene = emptyScene(6, 6);
    if (height) scene.layers.push({ z: 1, tiles: new Array(36).fill('planches'), height });
    useGame.setState({
      scene,
      mode: 'exploration',
      partyPos,
      party: [hero('h1', { x: partyPos.x, y: partyPos.y })],
      battle: null,
      dialogue: null,
      flags: {},
      viewMode: 'iso',
      camPan: { x: 0, y: 0 },
    });
    container = document.createElement('div');
    root = createRoot(container);
    act(() => root!.render(<IsoStage />));
    return scene;
  }

  const cas: [string, { x: number; y: number; z?: number }, number[] | undefined][] = [
    ['au rez', { x: 2, y: 2 }, undefined],
    ['à l’étage', { x: 2, y: 2, z: 1 }, new Array(36).fill(4)],
  ];
  it.each(cas)('%s : le centre du viewport tombe sur le milieu de capsule, une demi-capsule au-dessus du sol de la case', (_où, partyPos, height) => {
    const scene = mount(partyPos, height);
    const dims: Dims = { ...scene.dimensions, rot: 0, view: 'iso', edge: false };
    const z = partyPos.z ?? 0;
    const h = heightAt(scene, partyPos.x, partyPos.y, z);
    const vise = viseOf(container!); // point de la SCÈNE amené au centre du viewport

    const milieu = capsuleCenter(actorCapsuleOf({ x: partyPos.x, y: partyPos.y, h }, dims));
    expect(vise.x).toBeCloseTo(milieu.x, 6);
    expect(vise.y).toBeCloseTo(milieu.y, 6);

    const sol = tileCenter(partyPos.x, partyPos.y, dims, metricToLift(h));
    expect(sol.cy - vise.y).toBeCloseTo(LEVEL_H / 2, 6); // demi-capsule (pieds→tête = 1 niveau)
    expect(sol.cx - vise.x).toBeCloseTo(0, 6);
  });
});

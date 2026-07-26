// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useGame } from '../state/store';
import { emptyScene } from '../state/scene';
import type { Combatant } from '../engine/types';
import * as propsBuilder from './builders/props';
import * as roomPortalsModule from '../state/roomPortals';
import * as roofsBuilder from './builders/roofs';
import { IsoStage } from './IsoStage';

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
 * #818 — le DÉGAGEMENT des toitures est une loi du BUILDER (`buildRoofs` : masse couvrant une pièce
 * occupée, et à DÉFAUT de pièce, allié sous l'emprise de la masse). Le stage ne la réimplémente pas :
 * il lui passe la VUE. Ce test verrouille le CÂBLAGE — sans les positions alliées, le builder ne peut
 * pas appliquer son repli, et un bâti NON ZONÉ (carte en cours d'édition) ne se dégagerait jamais.
 */
describe('IsoStage — la vue (alliés) est passée à buildRoofs (#818)', () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  afterEach(() => {
    if (root) { act(() => root!.unmount()); root = null; }
    if (container) { container.remove(); container = null; }
    vi.restoreAllMocks();
  });

  it('buildRoofs reçoit les positions alliées, étage compris — jamais la scène seule', () => {
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

    const spy = vi.spyOn(roofsBuilder, 'buildRoofs');

    container = document.createElement('div');
    root = createRoot(container);
    act(() => root!.render(<IsoStage />));

    expect(spy).toHaveBeenCalled();
    const view = spy.mock.calls[spy.mock.calls.length - 1][1];
    expect(view?.allies).toEqual([{ x: 4, y: 3, z: 0 }]);
  });
});

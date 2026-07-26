// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useGame } from '../state/store';
import { emptyScene } from '../state/scene';
import type { Combatant } from '../engine/types';
import * as propsBuilder from './builders/props';
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

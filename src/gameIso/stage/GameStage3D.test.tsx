// @vitest-environment jsdom
import { Profiler, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { useGame } from '../../state/store';
import { emptyScene } from '../../state/scene';
import { setStageBackend } from '../../state/stage3d';
import type { Combatant } from '../../engine/types';
import { IsoStage } from '../IsoStage';

/**
 * La voie de rendu est EXCLUSIVE : le monde se peint une fois, jamais deux. En volumique, la couche
 * monde du SVG (`CulledScene`) ne se monte PAS — et avec elle disparaissent les jetons porteurs de
 * `data-cid`, exactement ce que le picking SPRITE interroge (`useStagePointer.pickTile` →
 * `elementFromPoint().closest('[data-cid]')`). Ce test FIXE donc aussi l'état connu du mode volumique
 * en P2-2 : picking de TUILE intact (il passe par le SVG, resté monté), picking de SPRITE dégradé —
 * son re-câblage est le lot P2-3.
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

let root: Root | null = null;
let container: HTMLDivElement | null = null;

/** Monte le stage, et COMPTE les commits de son sous-arbre (`Profiler` : aucun rendu = aucun commit). */
function monter(): { el: HTMLDivElement; commits: () => number } {
  useGame.setState({
    scene: emptyScene(6, 6),
    mode: 'exploration',
    partyPos: { x: 2, y: 2 },
    party: [hero('h1', { x: 2, y: 2 })],
    battle: null,
    dialogue: null,
    flags: {},
  });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  let n = 0;
  act(() => root!.render(<Profiler id="stage" onRender={() => { n += 1; }}><IsoStage /></Profiler>));
  return { el: container, commits: () => n };
}

afterEach(() => {
  if (root) { act(() => root!.unmount()); root = null; }
  if (container) { container.remove(); container = null; }
  setStageBackend('affine');
});

describe('Voie de rendu du monde — un seul monde monté à la fois (#1176)', () => {
  it('voie AFFINE : aucun canevas volumique, et les jetons SVG (data-cid) sont là', () => {
    setStageBackend('affine');
    const { el } = monter();
    expect(el.querySelector('canvas.iso-stage')).toBeNull();
    expect(el.querySelector('svg.iso-stage')).not.toBeNull();
    expect(el.querySelectorAll('[data-cid]').length).toBeGreaterThan(0);
  });

  it('voie VOLUMIQUE : le canevas est monté SOUS le SVG, la couche monde du SVG ne l’est plus', () => {
    setStageBackend('webgl');
    const { el } = monter();
    const canvas = el.querySelector('canvas.iso-stage');
    const svg = el.querySelector('svg.iso-stage');
    expect(canvas).not.toBeNull();
    expect(svg).not.toBeNull();
    // Ordre du DOM : le canevas AVANT le SVG (donc peint dessous, overlays au-dessus).
    expect(canvas!.compareDocumentPosition(svg!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect((svg as HTMLElement).style.background).toBe('transparent');
    // La couche monde a quitté le SVG : plus aucun jeton — le picking SPRITE est donc dégradé en P2-2.
    expect(el.querySelectorAll('[data-cid]').length).toBe(0);
  });
});

/**
 * L'interrupteur AU REPOS doit être un NO-OP : rien de ce que la voie volumique consomme ne doit coûter
 * un rendu au stage affine. `facing` est le cas d'école — `setFacing` reforge la table à chaque
 * orientation (donc à chaque pas et à chaque attaque) ; lu par `IsoStage`, il re-rendait le stage
 * ENTIER, interrupteur éteint. La correction est structurelle : l'abonnement vit dans `VolumetricWorld`,
 * monté seulement en volumique. La sonde MORD des deux côtés — 0 commit en affine, au moins 1 en
 * volumique (le monde y suit bien l'orientation).
 *
 * L'orientation est posée sur un id qu'AUCUN jeton de la scène ne porte : un corps abonné à SA propre
 * orientation (`useRigAnim` : `s.facing?.[id]`) reste alors indifférent, et seul un abonnement à la
 * TABLE ENTIÈRE — celui du régressé — peut produire un commit.
 */
const SONDE = '__sonde-orientation'; // aucun jeton ne porte cet id

describe('Voie AFFINE — l’interrupteur au repos ne coûte aucun rendu (#1176)', () => {
  it('un `setFacing` ne re-rend PAS le stage en affine', () => {
    setStageBackend('affine');
    const { commits } = monter();
    const avant = commits();
    act(() => { useGame.getState().setFacing(SONDE, 'N'); });
    expect(commits()).toBe(avant);
  });

  it('…et il le re-rend bien en VOLUMIQUE (la table y est lue) — la sonde n’est pas inerte', () => {
    setStageBackend('webgl');
    const { commits } = monter();
    const avant = commits();
    act(() => { useGame.getState().setFacing(SONDE, 'O'); });
    expect(commits()).toBeGreaterThan(avant);
  });
});

// @vitest-environment jsdom
import { Profiler, StrictMode, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { useGame } from '../../state/store';
import { emptyScene } from '../../state/scene';
import { setStageBackend } from '../../state/stage3d';
import type { Combatant } from '../../engine/types';
import { IsoStage } from '../IsoStage';
import { cidUnderPointer, hasSpritePicker } from './spritePicker';

/**
 * La voie de rendu est EXCLUSIVE : le monde se peint une fois, jamais deux. En volumique, la couche
 * monde du SVG (`CulledScene`) ne se monte PAS — et avec elle disparaissent les jetons porteurs de
 * `data-cid`, ce que le hit-test natif interroge. Le picking de TUILE reste intact (il passe par le
 * SVG, resté monté et seul receveur des événements) ; le picking de SPRITE, lui, passe désormais par
 * la couture `stage/spritePicker.ts`, où cet écran INSCRIT son lancer de rayon (P2-3) — c'est
 * l'inscription, et non un drapeau de voie, qui bascule le pointeur.
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

/** Scène minimale montrable, et un conteneur frais racine du prochain montage. */
function poserEtat(): void {
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
}

/** Monte le stage, et COMPTE les commits de son sous-arbre (`Profiler` : aucun rendu = aucun commit). */
function monter(): { el: HTMLDivElement; commits: () => number } {
  poserEtat();
  let n = 0;
  act(() => root!.render(<Profiler id="stage" onRender={() => { n += 1; }}><IsoStage /></Profiler>));
  return { el: container!, commits: () => n };
}

/** Le montage RÉEL du jeu : `src/main.tsx` rend l'application sous `<React.StrictMode>`, et la voie
 *  volumique est DEV-only — le double-montage des effets est donc son chemin ordinaire, pas un cas
 *  d'école. */
function monterStrict(): HTMLDivElement {
  poserEtat();
  act(() => root!.render(<StrictMode><IsoStage /></StrictMode>));
  return container!;
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
    // La couche monde a quitté le SVG : plus aucun jeton porteur de `data-cid` n'y subsiste.
    expect(el.querySelectorAll('[data-cid]').length).toBe(0);
  });
});

/**
 * COUTURE DU HIT-TEST DE SPRITE (P2-3) : c'est le MONTAGE de la voie volumique qui bascule le
 * pointeur, rien d'autre. Sans inscription, `cidUnderPointer` retombe sur le hit-test natif — le
 * chemin de la voie affine, inchangé.
 */
describe('Hit-test de sprite — la voie qui peint est celle qui répond (#1176 P2-3)', () => {
  it('voie AFFINE : personne n’a inscrit de rayon, la question va au DOM (`data-cid`)', () => {
    setStageBackend('affine');
    const { el } = monter();
    expect(hasSpritePicker()).toBe(false);
    const jeton = el.querySelector('[data-cid]') as HTMLElement;
    const cid = jeton.getAttribute('data-cid')!;
    document.elementFromPoint = () => jeton; // jsdom n'a pas de mise en page : le hit-test natif se stubbe
    expect(cidUnderPointer(10, 10)).toBe(cid);
    delete (document as Partial<Document>).elementFromPoint;
  });

  it('voie VOLUMIQUE : le rayon est inscrit au montage et la question ne va plus au DOM', () => {
    setStageBackend('webgl');
    monter();
    expect(hasSpritePicker()).toBe(true);
    document.elementFromPoint = () => {
      throw new Error('le DOM ne doit plus être interrogé en volumique');
    };
    expect(cidUnderPointer(10, 10)).toBeNull(); // aucun contexte WebGL en jsdom : aucune frame, donc aucune caméra
    delete (document as Partial<Document>).elementFromPoint;
  });

  it('…et l’inscription MEURT avec l’écran volumique (retour à l’affine sans rien de collant)', () => {
    setStageBackend('webgl');
    monter();
    expect(hasSpritePicker()).toBe(true);
    act(() => root!.unmount());
    root = null;
    expect(hasSpritePicker()).toBe(false);
  });

  it('sous StrictMode (le montage RÉEL) : le double-montage laisse UNE inscription vivante, et rien après', () => {
    setStageBackend('webgl');
    monterStrict();
    // React monte, démonte puis remonte les effets : la désinscription du premier passage ne doit pas
    // survivre au second, ni le second laisser un répondeur mort derrière lui.
    expect(hasSpritePicker()).toBe(true);
    act(() => root!.unmount());
    root = null;
    expect(hasSpritePicker()).toBe(false);
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

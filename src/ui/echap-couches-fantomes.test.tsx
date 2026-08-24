// @vitest-environment jsdom
/**
 * AUCUNE COUCHE FANTÔME (#1476, grief du juge sur le 1ᵉʳ jet du lot).
 *
 * Une couche n'existe que si son dialogue est À L'ÉCRAN. Le défaut mesuré venait de composants
 * montés en PERMANENCE par l'écran de jeu :
 *  - `GameMenu` est toujours monté (son bouton ☰ vit dans le HUD) ; fermé, il n'avait pas d'`onClose`
 *    — et « pas d'`onClose` » veut dire couche BLOQUANTE. Une couche bloquante fantôme mangeait donc
 *    Échap pour TOUTE la session : plus rien ne désarmait, plus rien n'ouvrait le menu.
 *  - `VictoryScreen` appelle ses hooks AVANT son early-return (règle des Hooks) : hors victoire, il
 *    empilait une couche dont le congédiement COMMETTAIT (`dismissVictory`, et en coop
 *    `victoryReady(mySeat)` RÉPLIQUÉ au relais) — le 1ᵉʳ Échap de la partie validait un butin absent.
 *
 * Ce banc monte les composants PERMANENTS avec le hook clavier RÉEL : c'est le seul endroit où le
 * défaut se voit, une modale montée à la main ne le reproduit pas.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame } from '../state/store';
import { dismissStackKinds } from '../state/dismissStack';
import { resetDismissLayers } from './useDismissLayer';
import { useGameKeyboard } from './useGameKeyboard';
import { GameMenu } from './GameMenu';
import { VictoryScreen } from './VictoryScreen';

beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });

let host: HTMLDivElement;
let root: Root;

/** L'écran de jeu tel qu'il est monté en partie : le HUD porte le menu système (fermé) et l'écran de
 *  victoire (sans victoire), plus le hook clavier. Aucun des deux ne s'affiche. */
const Ecran = () => { useGameKeyboard(); return <><GameMenu time={0} onQuit={() => {}} /><VictoryScreen /></>; };

const echap = () => act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape' })); });

beforeEach(() => {
  resetDismissLayers();
  useGame.setState({
    screen: 'campaign', mode: 'battle', gameMenuOpen: false, dialogue: null,
    battle: { over: false, action: null, order: ['chef'], turn: 0, combatants: [{ id: 'chef', kind: 'hero', pos: { x: 1, y: 1 } }], movementUsed: 0, preview: null },
    net: { mode: 'local', mySeat: 0 }, combatCursor: null, preemptAiming: null,
    localIntent: { actionId: 'charge' }, pendingVictory: null,
  } as never);
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  useGame.setState({ gameMenuOpen: false, localIntent: null } as never);
});

describe('Échap — les composants PERMANENTS n’empilent rien tant qu’ils ne s’affichent pas', () => {
  it('menu système FERMÉ + écran de victoire SANS victoire ⇒ pile VIDE, et Échap désarme bien l’intention', () => {
    const dismissVictory = vi.fn();
    useGame.setState({ dismissVictory } as never);
    act(() => root.render(<Ecran />));

    expect(dismissStackKinds(), 'aucun des deux n’est à l’écran : aucune couche').toEqual([]);

    echap();
    expect(useGame.getState().localIntent, 'la touche atteint l’échelle métier (intent-cancel)').toBeNull();
    expect(dismissVictory, 'une couche fantôme de victoire aurait COMMIS ici').not.toHaveBeenCalled();
    expect(useGame.getState().gameMenuOpen, 'un appui = un échelon : le menu ne s’ouvre pas en plus').toBe(false);
  });

  it('le menu système OUVERT est une couche, et redevient RIEN une fois refermé', () => {
    act(() => root.render(<Ecran />));
    act(() => { useGame.setState({ gameMenuOpen: true } as never); });
    expect(dismissStackKinds()).toEqual(['menu-systeme']);

    echap();
    expect(useGame.getState().gameMenuOpen, 'Échap referme le menu ouvert').toBe(false);
    expect(dismissStackKinds(), 'refermé, il n’est plus une couche').toEqual([]);
  });
});

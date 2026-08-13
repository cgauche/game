// @vitest-environment jsdom
/**
 * LE DIALOGUE EST UNE DÉCISION DE GROUPE (#1262) — l'intent `chooseDialogue` est routé au siège MJ
 * quand il existe, à l'hôte sinon (`ROUTES`, `state/netOwnership`), et il est HORS `GUEST_INTENTS` :
 * le clic d'un siège non meneur mute son store local puis est écrasé au snapshot suivant. Ce test
 * mesure que la FENÊTRE dit la même chose que le routage : le meneur a des réponses armées, les
 * autres les ont désactivées et voient QUI répond.
 *
 * Patron réel du repo pour un composant interactif (`createRoot`/`act`, cf. `DialogueBox.test.tsx`).
 */
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DialogueBox } from './DialogueBox';
import { useGame } from '../state/store';
import type { GameState } from '../state/store';
import { CAMPAIGN_START } from '../engine/clock';
import type { Dialogue, Scene, SceneEntity } from '../state/scene';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

const pnj: SceneEntity = { id: 'e1', kind: 'personnage', pos: { x: 0, y: 0 }, label: 'Alice' };

const dlg: Dialogue = {
  id: 'dlg-groupe',
  start: 'n1',
  nodes: [{ id: 'n1', text: 'Que faites-vous ?', choices: [{ text: 'Attaquer' }, { text: 'Parler' }] }],
};

const scene = { id: 'scn', nom: 'Scène', description: '', size: [4, 4], entities: [pnj], dialogues: [dlg], triggers: [], encounters: [] } as unknown as Scene;

/** État réseau : deux sièges nommés, aucun héros attribué (le dialogue n'appartient à personne). */
const net = (over: Partial<GameState['net']>): GameState['net'] =>
  ({ mode: 'host', mySeat: 0, roomCode: 'ABCDEF', seatNames: { 0: 'Hôte', 1: 'Antoine' }, presence: {}, connection: 'ok', hostAway: false, ownership: {}, slots: [0, 0, 0, 0], ...over }) as GameState['net'];

const snapshot = { net: useGame.getState().net, party: useGame.getState().party };
let container: HTMLDivElement;
let root: Root;

function monte(n: GameState['net']) {
  useGame.setState({ scene, flags: {}, gameTime: CAMPAIGN_START, party: [], net: n, dialogue: { dialogue: dlg, nodeId: 'n1', speakerId: 'e1' } });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => { root.render(<DialogueBox />); });
}

const reponses = () => Array.from(container.querySelectorAll<HTMLButtonElement>('button.dlg-choice'));
const chip = () => container.querySelector('.spectator-chip');

afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
  useGame.setState({ ...snapshot, dialogue: null });
});

describe('#1262 — les réponses d’un dialogue ne sont servies qu’au siège qui DÉCIDE pour le groupe', () => {
  it('SOLO : les réponses sont armées, aucune puce de spectateur', () => {
    monte(net({ mode: 'local' }));
    expect(reponses()).toHaveLength(2);
    expect(reponses().every((b) => !b.disabled)).toBe(true);
    expect(chip()).toBeNull();
  });

  it('COOP hôte (aucun MJ désigné) : l’hôte répond', () => {
    monte(net({ mode: 'host', mySeat: 0 }));
    expect(reponses().every((b) => !b.disabled)).toBe(true);
    expect(chip()).toBeNull();
  });

  it('COOP invité : réponses DÉSACTIVÉES et le meneur est NOMMÉ', () => {
    monte(net({ mode: 'guest', mySeat: 1 }));
    expect(reponses()).toHaveLength(2);
    expect(reponses().every((b) => b.disabled), 'un clic d’invité est écrasé au snapshot : aucune réponse cliquable').toBe(true);
    expect(chip()?.textContent).toContain('Hôte');
  });

  it('rôle MJ posé sur le siège 1 : le meneur bascule — l’invité répond, l’hôte regarde', () => {
    monte(net({ mode: 'guest', mySeat: 1, gmSeat: 1 }));
    expect(reponses().every((b) => !b.disabled)).toBe(true);
    expect(chip()).toBeNull();
    act(() => { root.unmount(); });
    container.remove();
    monte(net({ mode: 'host', mySeat: 0, gmSeat: 1 }));
    expect(reponses().every((b) => b.disabled)).toBe(true);
    expect(chip()?.textContent).toContain('Antoine');
  });
});

// @vitest-environment jsdom
/**
 * SOCLE clavier de `Modal` : Entrée SOUMET la boîte, y compris depuis un champ de saisie — c'est le
 * submit de formulaire attendu par les modales qui n'ont qu'un champ et un bouton (nom de campagne →
 * « Enregistrer », mise de taverne → « Jouer », semaine en mer → « Valider la semaine »).
 *
 * La frontière est LOCALE, jamais globale : un champ dont Entrée a un sens PROPRE (le sélecteur de dé
 * de `ForcedRollPicker` : Entrée y pose le dé) la CONSOMME chez lui — `stopPropagation` empêche
 * l'écouteur de document de la voir. Contrat monté bout-en-bout dans `forcedDieRow.pre-roll.test.tsx`.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Modal } from './Modal';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let host: HTMLDivElement;
let root: Root;
let clicks: number;

/** jsdom ne calcule aucune géométrie : `getClientRects()` y est vide, donc le bouton primaire
 *  serait jugé invisible par la garde de `Modal`. On lui donne un rect non nul. */
function makeVisible(el: HTMLElement) {
  el.getClientRects = (() => [{ width: 80, height: 24 }] as unknown as DOMRectList) as HTMLElement['getClientRects'];
}

/** `swallow` = le champ CONSOMME Entrée chez lui (le geste du sélecteur de dé). */
function mount(swallow = false) {
  clicks = 0;
  act(() =>
    root.render(
      <Modal title="Saisie" variant="plain">
        <input
          className="champ"
          type="number"
          onKeyDown={swallow ? (e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); } } : undefined}
        />
        <div className="modal-actions">
          <button className="btn btn-primary" onClick={() => { clicks += 1; }}>Appliquer</button>
        </div>
      </Modal>,
    ),
  );
  const primary = host.querySelector<HTMLElement>('.btn-primary')!;
  makeVisible(primary);
  return { input: host.querySelector<HTMLInputElement>('input.champ')!, primary };
}

const pressEnter = (from: EventTarget) =>
  act(() => { from.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); });

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('Modal — Entrée soumet la boîte', () => {
  it('Entrée depuis un champ de saisie DÉCLENCHE l’action primaire (submit de la boîte)', () => {
    const { input } = mount();
    input.focus();
    expect(document.activeElement).toBe(input);
    pressEnter(input);
    expect(clicks, 'une modale « un champ + un bouton » doit se valider au clavier').toBe(1);
  });

  it('Entrée hors champ déclenche toujours l’action primaire', () => {
    mount();
    (document.activeElement as HTMLElement | null)?.blur();
    expect(document.activeElement).toBe(document.body);
    pressEnter(document.body);
    expect(clicks).toBe(1);
  });

  it('un champ qui CONSOMME Entrée garde son geste : l’action primaire ne part pas en plus', () => {
    const { input } = mount(true);
    input.focus();
    pressEnter(input);
    expect(clicks, 'la protection est LOCALE au champ, pas une exception déclarée dans Modal').toBe(0);
  });
});

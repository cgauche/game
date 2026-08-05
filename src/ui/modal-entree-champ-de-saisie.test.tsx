// @vitest-environment jsdom
/**
 * SOCLE clavier de `Modal` : Entrée SOUMET la boîte, y compris depuis un champ de saisie — c'est le
 * submit de formulaire attendu par les modales qui n'ont qu'un champ et un bouton (nom de campagne →
 * « Enregistrer », mise de taverne → « Jouer », semaine en mer → « Valider la semaine »).
 *
 * La frontière est LOCALE, jamais globale : un champ dont Entrée a un sens PROPRE (le sélecteur de dé
 * de `ForcedRollPicker` : Entrée y pose le dé) la CONSOMME chez lui — `stopPropagation` empêche
 * l'écouteur de document de la voir. Contrat monté bout-en-bout dans `forcedDieRow.pre-roll.test.tsx`.
 *
 * ET la frontière du DIALOGUE n'est PAS le containment DOM : un contrôle porté par PORTAL
 * (`createPortal(document.body)` — popover de règle, menu…) vit hors de la boîte tout en étant à
 * l'écran par-dessus elle. `document.activeElement` étant global, un bouton focalisé possède sa
 * touche où qu'il vive.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createPortal } from 'react-dom';
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

/**
 * Recette B3a, captures 13b/13c — Entrée sur « Ouvrir la fiche » (bouton du popover de règle, rendu
 * en PORTAL) RÉSOLVAIT la cascade : le prédicat `box.contains(ae)` jugeait le bouton « hors boîte »
 * et retombait sur le primaire (« Tout lancer »). Structure REPRODUITE ici : boîte + primaire, et un
 * bouton porté sur `document.body`, focalisé.
 */
describe('Modal — un contrôle porté par PORTAL possède ses touches (frontière ≠ containment)', () => {
  let portalClicks: number;
  let escapes: number;

  function mountWithPortal() {
    clicks = 0;
    portalClicks = 0;
    escapes = 0;
    act(() =>
      root.render(
        <Modal title="Jet" variant="roll" onClose={() => { escapes += 1; }}>
          <div className="modal-actions">
            <button className="btn btn-primary" onClick={() => { clicks += 1; }}>Tout lancer</button>
          </div>
          {createPortal(
            <button className="porte" onClick={() => { portalClicks += 1; }}>Ouvrir la fiche</button>,
            document.body,
          )}
        </Modal>,
      ),
    );
    const primary = host.querySelector<HTMLElement>('.btn-primary')!;
    makeVisible(primary);
    return { primary, porte: document.querySelector<HTMLButtonElement>('button.porte')! };
  }

  it('Entrée sur le bouton PORTÉ l’active lui — le primaire de la boîte n’est PAS cliqué', () => {
    const { porte } = mountWithPortal();
    porte.focus();
    expect(document.activeElement, 'le bouton porté doit tenir le focus').toBe(porte);
    pressEnter(porte);
    // Activation NATIVE : jsdom ne la simule pas depuis un keydown — ce qui se mesure ici est que la
    // boîte N'A PAS détourné la touche vers son action primaire (le symptôme exact de la recette).
    expect(clicks, '« Tout lancer » a été déclenché à la place du bouton focalisé').toBe(0);
    // Et le bouton porté reste bien activable (son clic natif fonctionne, focus intact).
    act(() => porte.click());
    expect(portalClicks).toBe(1);
  });

  it('Échap avec le focus sur la surface PORTÉE ne ferme PAS la boîte (congédiement en couches)', () => {
    const { porte } = mountWithPortal();
    porte.focus();
    act(() => { porte.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    expect(escapes, 'la surface portée se referme d’abord, la modale reste ouverte').toBe(0);
  });

  it('flèches : la boîte ne rove PAS par-dessus un contrôle porté focalisé', () => {
    const { porte } = mountWithPortal();
    porte.focus();
    act(() => { porte.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })); });
    expect(document.activeElement, 'le roving de la boîte a volé le focus du popover').toBe(porte);
  });

  it('RÉGRESSION — focus DANS la boîte : le comportement d’origine est intact', () => {
    const { primary } = mountWithPortal();
    // Focus nulle part → repli sur le primaire (contrat historique).
    (document.activeElement as HTMLElement | null)?.blur();
    pressEnter(document.body);
    expect(clicks).toBe(1);
    // Échap depuis la boîte ferme toujours.
    act(() => { primary.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    expect(escapes).toBe(1);
  });
});

// @vitest-environment jsdom
/**
 * `GatedAction` — la DESCRIPTION accessible d'un contrôle refusé. Le contrat mesuré ici : ce que
 * `aria-describedby` désigne EXISTE et porte du texte. Un refus sans raison (l'appelant calcule une
 * chaîne qui se trouve vide) ne doit laisser NI le `<p>` vide NI l'attribut qui le vise : un lecteur
 * d'écran annoncerait une description muette, pire qu'aucune description.
 */
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { GatedAction } from './GatedAction';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let container: HTMLDivElement;
let root: Root;

function mount(node: React.ReactElement) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => { root.render(node); });
}

afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
});

const bouton = () => container.querySelector('button')!;

describe('GatedAction — `aria-describedby` ne vise que du texte RÉEL', () => {
  it('refusé AVEC raison : la copie hors écran existe et l’attribut la vise', () => {
    mount(<GatedAction id="acte" label="Entrer" enabled={false} reason="Le port est fermé" onClick={() => {}} />);
    const p = container.querySelector('p#acte-reason');
    expect(p, 'la copie accessible de la raison a disparu').toBeTruthy();
    expect(p!.textContent).toBe('Le port est fermé');
    expect(p!.className).toBe('hors-ecran');
    expect(bouton().getAttribute('aria-describedby')).toBe('acte-reason');
    expect(bouton().getAttribute('aria-disabled')).toBe('true');
  });

  it('refusé SANS raison : ni `<p>` vide, ni `aria-describedby` fantôme', () => {
    mount(<GatedAction id="acte" label="Entrer" enabled={false} reason="" onClick={() => {}} />);
    expect(container.querySelector('p'), 'un `<p>` vide est rendu sous le bouton').toBeNull();
    expect(bouton().getAttribute('aria-describedby'), 'l’attribut vise une description inexistante').toBeNull();
    // Le refus reste ATTEIGNABLE : `aria-disabled`, jamais `disabled` (contrat de la primitive).
    expect(bouton().getAttribute('aria-disabled')).toBe('true');
    expect(bouton().hasAttribute('disabled')).toBe(false);
  });

  it('forme `reasonId` : l’attribut vise l’id de l’appelant, sans conteneur', () => {
    mount(<GatedAction id="acte" label="Entrer" enabled={false} reasonId="cause-commune" onClick={() => {}} />);
    expect(bouton().getAttribute('aria-describedby')).toBe('cause-commune');
    expect(container.querySelector('.gated-action')).toBeNull();
  });

  it('autorisé : aucune description, aucun `aria-disabled`', () => {
    mount(<GatedAction id="acte" label="Entrer" enabled reason="Le port est fermé" onClick={() => {}} />);
    expect(bouton().getAttribute('aria-describedby')).toBeNull();
    expect(bouton().getAttribute('aria-disabled')).toBeNull();
  });
});

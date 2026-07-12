// @vitest-environment jsdom
/**
 * Recette #343 : en mode EMPILÉ (≤700px), une liste longue peut placer le détail hors-vue après
 * sélection — le clic « ne semble rien faire ». `MasterDetail` doit scroller le détail en vue,
 * SEULEMENT en mode empilé et SEULEMENT pour une activation d'un contrôle de sélection (jamais un
 * clic dans un champ de recherche de la liste, jamais depuis le slot détail lui-même).
 */
import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MasterDetail } from './MasterDetail';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

function mockMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

async function flushRaf() {
  await act(async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  });
}

describe('MasterDetail — scroll vers le détail en mode empilé (#343)', () => {
  let container: HTMLDivElement;
  let root: Root;
  const scrollSpy = vi.fn();
  const originalMatchMedia = window.matchMedia;
  const originalScrollIntoView = Element.prototype.scrollIntoView;

  function mount(node: React.ReactElement) {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => { root.render(node); });
  }

  afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
    // Assignations DIRECTES (pas `vi.spyOn`) — `vi.restoreAllMocks` ne les couvrirait pas ;
    // restauration manuelle explicite (`isolate: false`, `vite.config.ts`, exige zéro fuite
    // inter-fichiers d'un test à l'autre dans le même worker).
    window.matchMedia = originalMatchMedia;
    Element.prototype.scrollIntoView = originalScrollIntoView;
    scrollSpy.mockClear();
  });

  it('clic sur un bouton de la liste, mode EMPILÉ (≤700px) : scrollIntoView du détail', async () => {
    mockMatchMedia(true);
    Element.prototype.scrollIntoView = scrollSpy;
    mount(
      <MasterDetail
        listLabel="Entrées"
        list={<button type="button">Entrée A</button>}
        detail={<div>Détail A</div>}
      />,
    );
    const btn = container.querySelector('button')!;
    act(() => { btn.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    await flushRaf();
    expect(scrollSpy).toHaveBeenCalledTimes(1);
    expect(scrollSpy).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
  });

  it('mode côte-à-côte (> breakpoint) : le clic ne scrolle pas', async () => {
    mockMatchMedia(false);
    Element.prototype.scrollIntoView = scrollSpy;
    mount(
      <MasterDetail
        list={<button type="button">Entrée A</button>}
        detail={<div>Détail A</div>}
      />,
    );
    const btn = container.querySelector('button')!;
    act(() => { btn.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    await flushRaf();
    expect(scrollSpy).not.toHaveBeenCalled();
  });

  it('clic dans un champ de recherche de la liste (non actionnable) : pas de scroll, même empilé', async () => {
    mockMatchMedia(true);
    Element.prototype.scrollIntoView = scrollSpy;
    mount(
      <MasterDetail
        list={<input type="search" aria-label="Rechercher" />}
        detail={<div>Détail A</div>}
      />,
    );
    const input = container.querySelector('input')!;
    act(() => { input.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    await flushRaf();
    expect(scrollSpy).not.toHaveBeenCalled();
  });

  it('activation clavier (Enter) d’un bouton de liste, mode empilé : scrollIntoView du détail', async () => {
    mockMatchMedia(true);
    Element.prototype.scrollIntoView = scrollSpy;
    mount(
      <MasterDetail
        list={<button type="button">Entrée A</button>}
        detail={<div>Détail A</div>}
      />,
    );
    const btn = container.querySelector('button')!;
    act(() => { btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); });
    await flushRaf();
    expect(scrollSpy).toHaveBeenCalledTimes(1);
  });

  it('clic dans le slot DÉTAIL : pas de scroll (le conteneur écouté est la liste, pas le détail)', async () => {
    mockMatchMedia(true);
    Element.prototype.scrollIntoView = scrollSpy;
    mount(
      <MasterDetail
        list={<button type="button">Entrée A</button>}
        detail={<button type="button">Action du détail</button>}
      />,
    );
    const detailBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Action du détail')!;
    act(() => { detailBtn.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    await flushRaf();
    expect(scrollSpy).not.toHaveBeenCalled();
  });
});

// @vitest-environment jsdom
/**
 * Recette #535 (verdict utilisateur, cue DYNAMIQUE) : `MasterDetail` stampe `data-at-top`/
 * `data-at-bottom` sur `.master-detail-list` — UN SEUL mécanisme de mesure de bord de scroll,
 * partagé par tous ses écrans (le rendu du voile reste scopé créateur, `creator.css`, hors
 * périmètre de ce fichier). jsdom ne fait pas de vrai layout : `scrollTop`/`clientHeight`/
 * `scrollHeight` sont posés en dur par élément (patron ci-dessous), `ResizeObserver` est ABSENT de
 * jsdom (vérifié) — seuls les chemins `scroll`/`resize` fenêtre sont testables ici ; le chemin
 * `ResizeObserver` (contenu qui grandit sans événement `scroll`, ex. cérémonie de dés) sera
 * re-prouvé par la mini-recette navigateur annoncée par le coordinateur.
 */
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MasterDetail } from './MasterDetail';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

/** jsdom ne calcule aucune géométrie réelle — pose `scrollTop`/`clientHeight`/`scrollHeight` en
 *  dur sur L'ÉLÉMENT (getters/setter, patron standard de test de scroll en jsdom). */
function mockGeometry(el: HTMLElement, { scrollTop, clientHeight, scrollHeight }: { scrollTop: number; clientHeight: number; scrollHeight: number }) {
  let top = scrollTop;
  Object.defineProperty(el, 'scrollTop', { configurable: true, get: () => top, set: (v) => { top = v; } });
  Object.defineProperty(el, 'clientHeight', { configurable: true, get: () => clientHeight });
  Object.defineProperty(el, 'scrollHeight', { configurable: true, get: () => scrollHeight });
}

async function flushRaf() {
  await act(async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  });
}

describe('MasterDetail — data-at-top/data-at-bottom du rail scrollable (#535, cue dynamique)', () => {
  let container: HTMLDivElement;
  let root: Root;

  function mount() {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(<MasterDetail list={<button type="button">Entrée A</button>} detail={<div>Détail A</div>} />);
    });
    return container.querySelector('.master-detail-list') as HTMLElement;
  }

  afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
  });

  it('rail EN DÉBORDEMENT, scrollTop=0 au montage : `data-at-top` posé, `data-at-bottom` absent', async () => {
    const list = mount();
    mockGeometry(list, { scrollTop: 0, clientHeight: 300, scrollHeight: 900 });
    act(() => { list.dispatchEvent(new Event('scroll')); }); // relance la mesure une fois la géométrie posée
    await flushRaf();
    expect(list.hasAttribute('data-at-top')).toBe(true);
    expect(list.hasAttribute('data-at-bottom')).toBe(false);
  });

  it('scroll jusqu’au FOND (`scrollTop + clientHeight ≈ scrollHeight`) : `data-at-bottom` posé, `data-at-top` retiré', async () => {
    const list = mount();
    mockGeometry(list, { scrollTop: 0, clientHeight: 300, scrollHeight: 900 });
    act(() => { list.dispatchEvent(new Event('scroll')); });
    await flushRaf();
    list.scrollTop = 600; // 600 + 300 = 900 = scrollHeight
    act(() => { list.dispatchEvent(new Event('scroll')); });
    await flushRaf();
    expect(list.hasAttribute('data-at-bottom')).toBe(true);
    expect(list.hasAttribute('data-at-top')).toBe(false);
  });

  it('scroll AU MILIEU : ni `data-at-top` ni `data-at-bottom` (les DEUX voiles restent visibles)', async () => {
    const list = mount();
    mockGeometry(list, { scrollTop: 0, clientHeight: 300, scrollHeight: 900 });
    list.scrollTop = 300; // ni bord haut ni bord bas (300+300=600 < 900)
    act(() => { list.dispatchEvent(new Event('scroll')); });
    await flushRaf();
    expect(list.hasAttribute('data-at-top')).toBe(false);
    expect(list.hasAttribute('data-at-bottom')).toBe(false);
  });

  it('rail SANS débordement (contenu ≤ viewport) : les DEUX attributs sont posés — aucun voile à montrer', async () => {
    const list = mount();
    mockGeometry(list, { scrollTop: 0, clientHeight: 300, scrollHeight: 200 });
    act(() => { list.dispatchEvent(new Event('scroll')); });
    await flushRaf();
    expect(list.hasAttribute('data-at-top')).toBe(true);
    expect(list.hasAttribute('data-at-bottom')).toBe(true);
  });

  it('mesure INITIALE posée au montage sans attendre un premier événement `scroll` (pas de flash de cue)', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(<MasterDetail list={<button type="button">Entrée A</button>} detail={<div>Détail A</div>} />);
    });
    const list = container.querySelector('.master-detail-list') as HTMLElement;
    // Géométrie par défaut de jsdom (0/0/0, aucun débordement réel) : la mesure au montage doit
    // malgré tout avoir posé LES DEUX attributs (0<=EPS et 0+0>=0-EPS sont vrais), jamais rien.
    expect(list.hasAttribute('data-at-top')).toBe(true);
    expect(list.hasAttribute('data-at-bottom')).toBe(true);
  });
});

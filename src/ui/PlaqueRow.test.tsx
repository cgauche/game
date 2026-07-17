// @vitest-environment jsdom
/**
 * #535 : la rangée ACTIVE (`rolling`) se ramène dans le viewport du rail scrollable —
 * `PlaqueRow` pose `scrollIntoView({ block: 'nearest', behavior: 'smooth' })` quand elle bascule
 * `rolling`, jamais au montage ni quand une autre rangée change d'état. `attention` (DoD #535,
 * première rangée d'allocation NON SOLDÉE) partage le MÊME mécanisme (un seul front montant
 * `rolling || attention` → un seul scroll), posé par l'écran appelant.
 */
import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { PlaqueRow } from './PlaqueRow';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

describe('PlaqueRow — scroll vers la rangée roulante (#535)', () => {
  let container: HTMLDivElement;
  let root: Root;
  const scrollSpy = vi.fn();
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
    Element.prototype.scrollIntoView = originalScrollIntoView;
    scrollSpy.mockClear();
  });

  it('rangée montée directement en `rolling` : scrollIntoView appelé', () => {
    Element.prototype.scrollIntoView = scrollSpy;
    mount(<PlaqueRow name="Force" rolling />);
    expect(scrollSpy).toHaveBeenCalledTimes(1);
    expect(scrollSpy).toHaveBeenCalledWith({ block: 'nearest', behavior: 'smooth' });
  });

  it('rangée montée SANS `rolling` : pas de scroll', () => {
    Element.prototype.scrollIntoView = scrollSpy;
    mount(<PlaqueRow name="Force" />);
    expect(scrollSpy).not.toHaveBeenCalled();
  });

  it('bascule `rolling` false → true : scrollIntoView déclenché', () => {
    Element.prototype.scrollIntoView = scrollSpy;
    mount(<PlaqueRow name="Force" rolling={false} />);
    expect(scrollSpy).not.toHaveBeenCalled();
    act(() => { root.render(<PlaqueRow name="Force" rolling />); });
    expect(scrollSpy).toHaveBeenCalledTimes(1);
  });

  it('rangée qui reste `rolling` sur un re-render : pas de nouvel appel', () => {
    Element.prototype.scrollIntoView = scrollSpy;
    mount(<PlaqueRow name="Force" rolling value={12} />);
    expect(scrollSpy).toHaveBeenCalledTimes(1);
    act(() => { root.render(<PlaqueRow name="Force" rolling value={13} />); });
    expect(scrollSpy).toHaveBeenCalledTimes(1);
  });

  it('bascule `attention` false → true : scrollIntoView déclenché (MÊME mécanisme que `rolling`)', () => {
    Element.prototype.scrollIntoView = scrollSpy;
    mount(<PlaqueRow name="Force" attention={false} />);
    expect(scrollSpy).not.toHaveBeenCalled();
    act(() => { root.render(<PlaqueRow name="Force" attention />); });
    expect(scrollSpy).toHaveBeenCalledTimes(1);
    expect(scrollSpy).toHaveBeenCalledWith({ block: 'nearest', behavior: 'smooth' });
  });

  it('`rolling` puis `attention` (fronts successifs) : un scroll par front, pas de doublon sur un re-render inchangé', () => {
    Element.prototype.scrollIntoView = scrollSpy;
    mount(<PlaqueRow name="Force" rolling />);
    expect(scrollSpy).toHaveBeenCalledTimes(1);
    act(() => { root.render(<PlaqueRow name="Force" rolling={false} />); }); // rolling→false : combiné retombe à false
    act(() => { root.render(<PlaqueRow name="Force" rolling={false} attention />); }); // false→true (via attention)
    expect(scrollSpy).toHaveBeenCalledTimes(2);
    act(() => { root.render(<PlaqueRow name="Force" rolling={false} attention />); }); // inchangé : pas de 3ᵉ appel
    expect(scrollSpy).toHaveBeenCalledTimes(2);
  });
});

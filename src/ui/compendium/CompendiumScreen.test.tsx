// @vitest-environment jsdom
/**
 * #399 : replier/déplier un cluster (`<details className="fold">`) de la barre de catégories ne
 * doit jamais crasher — `toggle` sur `<details>` ne bulle pas (spec HTML), React l'écoute donc en
 * DIRECT sur le nœud (hors flush synchrone du batching d'événement délégué). Le natif remet
 * `currentTarget` à `null` dès la fin du `dispatchEvent` ; lire `e.currentTarget.open` depuis le
 * CORPS d'un updater `setState` (appliqué plus tard, au rendu suivant) au lieu de le capturer
 * SYNCHRONEMENT dans le handler lève `Cannot read properties of null (reading 'open')`.
 */
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { Component, type ReactNode, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { CompendiumScreen } from './CompendiumScreen';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

class Boundary extends Component<{ children: ReactNode }, { error: unknown }> {
  state: { error: unknown } = { error: null };
  static getDerivedStateFromError(error: unknown) {
    return { error };
  }
  render() {
    return this.state.error ? null : this.props.children;
  }
}

describe('CompendiumScreen — toggle des clusters repliables (#399)', () => {
  let container: HTMLDivElement;
  let root: Root;
  let boundary: Boundary;
  const originalOnError = window.onerror;

  afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
    window.onerror = originalOnError;
  });

  it('replier/déplier un cluster de la famille Tables ne crashe pas (currentTarget lu APRÈS reset natif)', async () => {
    window.onerror = () => true; // React reporte l'erreur non-attrapée via window.onerror en jsdom
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    let boundaryRef: Boundary | null = null;
    act(() => {
      root.render(
        <Boundary ref={(r) => { boundaryRef = r; }}>
          <CompendiumScreen />
        </Boundary>,
      );
    });
    boundary = boundaryRef!;

    const groupBtns = [...container.querySelectorAll('.codex-groups button')] as HTMLButtonElement[];
    const tablesBtn = groupBtns.find((b) => b.textContent?.trim() === 'Tables')!;
    act(() => { tablesBtn.dispatchEvent(new MouseEvent('click', { bubbles: true })); });

    const fold = container.querySelector('details.fold') as HTMLDetailsElement;
    const wasOpen = fold.open;

    // Dispatch HORS `act` synchrone : laisse le natif terminer (et nuller `currentTarget`) avant
    // que le prochain tick applique l'updater `setManualOpen` en file — reproduit la fenêtre où
    // le crash a été vu en production (mise à jour d'état DÉFÉRÉE au-delà de la fin du dispatch).
    fold.open = !wasOpen;
    fold.dispatchEvent(new Event('toggle', { bubbles: false }));
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });

    expect(boundary.state.error).toBeNull();
    expect(fold.open).toBe(!wasOpen);
  });
});

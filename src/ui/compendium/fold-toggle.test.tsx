// @vitest-environment jsdom
/**
 * #1526 : le cluster repliable de la barre de catégories du Codex (`<details className="fold">`,
 * `CompendiumScreen.tsx`) est un `<details>` CONTRÔLÉ (`open={open}` piloté par `setManualOpen`).
 * Un clic sur son titre (`.fold-title`, DANS le `<summary>`) doit basculer l'état AUX DEUX SENS et
 * SURVIVRE au rendu React qui suit : si l'activation native était annulée (`preventDefault` sur le
 * summary) ou si l'état n'était pas repiqué, le rendu contrôlé suivant remettrait `open` à sa
 * valeur d'avant le clic — repli silencieux, invisible à l'œil d'un test de structure.
 */
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { CompendiumScreen } from './CompendiumScreen';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

describe('Codex — le clic sur le titre replie/déplie le cluster (#1526)', () => {
  let container: HTMLDivElement;
  let root: Root;

  afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
  });

  it('un clic sur `.fold-title` bascule `open` aux DEUX SENS (activation native non annulée, état repiqué)', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => { root.render(<CompendiumScreen />); });

    // Famille « Tables » : la seule dont la barre de catégories porte des clusters repliables.
    const groupBtns = [...container.querySelectorAll('.codex-groups [role="tab"]')] as HTMLButtonElement[];
    const tablesBtn = groupBtns.find((b) => b.textContent?.trim() === 'Tables')!;
    expect(tablesBtn, 'onglet « Tables » introuvable').toBeTruthy();
    act(() => { tablesBtn.dispatchEvent(new MouseEvent('click', { bubbles: true })); });

    const fold = container.querySelector('details.fold') as HTMLDetailsElement;
    expect(fold, 'aucun cluster `details.fold`').toBeTruthy();
    const titre = fold.querySelector('.fold-title') as HTMLElement;
    expect(titre, '`.fold-title` introuvable dans le cluster').toBeTruthy();

    const avant = fold.open;
    const clic = async () => {
      titre.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    };

    await clic();
    expect(fold.open, 'premier clic : le cluster n\'a pas basculé').toBe(!avant);

    await clic();
    expect(fold.open, 'second clic : le cluster ne revient pas à son état initial').toBe(avant);
  });
});

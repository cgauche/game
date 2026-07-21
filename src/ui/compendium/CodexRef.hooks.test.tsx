// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { CodexRef } from './CodexRef';

const mount = (node: React.ReactElement) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => { root.render(node); });
  return { container, root };
};

describe('CodexRef — Rules of Hooks (régression crash "Rendered fewer hooks than expected")', () => {
  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });
  let container: HTMLDivElement;
  let root: Root;
  afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
  });

  it('entrée ABSENTE du catalogue : rend le repli sans crash', () => {
    ({ container, root } = mount(
      <CodexRef category="creatures" id="id-bidon-absent-xyz" label="Bidon" />,
    ));
    expect(container.textContent).toContain('Bidon');
  });

  it('re-rendu TROUVÉ → ABSENT sur le même arbre : le nombre de Hooks ne varie pas', () => {
    ({ container, root } = mount(
      <CodexRef category="creatures" id="cheval" label="Cheval" />,
    ));
    expect(container.textContent).toContain('Cheval');

    expect(() => {
      act(() => {
        root.render(<CodexRef category="creatures" id="id-bidon-absent-xyz" label="Bidon" />);
      });
    }).not.toThrow();
    expect(container.textContent).toContain('Bidon');
  });
});

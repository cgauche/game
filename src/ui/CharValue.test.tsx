import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CharValue } from './CharValue';

describe('CharValue — caractéristique isolée', () => {
  it('libellé court + valeur, popover Codex sur le libellé', () => {
    const html = renderToStaticMarkup(<CharValue charKey="CC" value={45} />);
    expect(html).toContain('CC');
    expect(html).toContain('45');
    expect(html).toContain('codex-ref'); // popover de la caractéristique
    expect(html).not.toContain('B4'); // pas de bonus si non fourni
  });

  it('bonus optionnel affiché « BN »', () => {
    const html = renderToStaticMarkup(<CharValue charKey="F" value={38} bonus={3} />);
    expect(html).toContain('B3');
  });
});

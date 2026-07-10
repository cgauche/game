import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CHAR_ABR } from '../data';
import { CharValue } from './CharValue';

describe('CharValue — caractéristique isolée', () => {
  it('libellé court + valeur, popover Codex sur le libellé', () => {
    const html = renderToStaticMarkup(<CharValue charKey="capacite-de-combat" value={45} />);
    expect(html).toContain('CC');
    expect(html).toContain('45');
    expect(html).toContain('codex-ref'); // popover de la caractéristique
    expect(html).not.toContain('B4'); // pas de bonus si non fourni
  });

  it('bonus optionnel affiché « BN »', () => {
    const html = renderToStaticMarkup(<CharValue charKey="force" value={38} bonus={3} />);
    expect(html).toContain('B3');
  });

  it('le libellé court suit la DONNÉE (CHAR_ABR), jamais la clé littérale — altère le dataset réel', () => {
    const original = CHAR_ABR['capacite-de-combat'];
    try {
      CHAR_ABR['capacite-de-combat'] = 'ZZ';
      const html = renderToStaticMarkup(<CharValue charKey="capacite-de-combat" value={45} />);
      expect(html).toContain('ZZ');
      expect(html).not.toContain('>CC<');
    } finally {
      CHAR_ABR['capacite-de-combat'] = original;
    }
  });
});

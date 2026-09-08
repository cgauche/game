import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { characteristics } from '../data';
import { setDataset } from '../data/overrides';
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

  it('le libellé court suit la DONNÉE (charAbr), jamais la clé littérale — altère le dataset réel', () => {
    const livrees = [...characteristics];
    try {
      setDataset('characteristics', characteristics.map((c) => (c.id === 'capacite-de-combat' ? { ...c, abr: 'ZZ' } : c)));
      const html = renderToStaticMarkup(<CharValue charKey="capacite-de-combat" value={45} />);
      expect(html).toContain('ZZ');
      expect(html).not.toContain('>CC<');
    } finally {
      setDataset('characteristics', livrees);
    }
  });
});

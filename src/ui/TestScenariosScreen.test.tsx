import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TestScenariosScreen } from './TestScenariosScreen';

describe('TestScenariosScreen (rendu)', () => {
  it('liste chaque scénario (titre + bouton Lancer)', () => {
    const html = renderToStaticMarkup(<TestScenariosScreen />);
    expect(html).toContain('Tir &amp; Rechargement'); // 01 (& échappé en HTML)
    expect(html).toContain('Embuscade'); // 02 (l'apostrophe est échappée &#x27; → on teste le radical)
    expect(html).toContain('Magie');
    expect(html).toContain('Lancer');
    expect(html).toContain('Retour');
  });
});

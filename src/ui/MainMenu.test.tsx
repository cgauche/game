import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MainMenu } from './MainMenu';

/** Vérifie que l'écran AFFICHE bien ses libellés (résolus du catalogue i18n) — pas seulement que les
 *  clés existent (typecheck). Rendu réel en HTML (renderToStaticMarkup), comme GameMenu.test. */
describe('MainMenu — rendu des libellés i18n', () => {
  it('affiche titre, sous-titre, boutons, atelier et note de bas de page', () => {
    const html = renderToStaticMarkup(<MainMenu />);
    expect(html).toContain('Warhammer Fantasy');
    expect(html).toContain('Tactique au tour par tour');
    expect(html).toContain('Nouvelle partie');
    expect(html).toContain('Charger une partie');
    expect(html).toContain('Jouer en ligne');
    expect(html).toContain('Règles maison');
    expect(html).toContain('Compendium');
    expect(html).toContain('Atelier');
    expect(html).toContain('Éditeur de niveau');
    expect(html).toContain('Scénarios de test');
    expect(html).toMatch(/Galeries d\S*art/); // apostrophe échappée en &#x27; par renderToStaticMarkup
    expect(html).toMatch(/Archives de l\S*Empire/);
  });

  it('infobulles présentes (attributs title résolus)', () => {
    const html = renderToStaticMarkup(<MainMenu />);
    expect(html).toContain('Activer les règles optionnelles du Livre de base');
    expect(html).toContain('bestiaire et lore');
  });
});

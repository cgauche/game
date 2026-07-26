import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MainMenu } from './MainMenu';
import { OptionsScreen } from './OptionsScreen';

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
    expect(html).toContain('Options');
    expect(html).toContain('Compendium');
    expect(html).toContain('Atelier');
    expect(html).toContain('Éditeur de niveau');
    expect(html).toContain('Scénarios de test');
    expect(html).toMatch(/Galeries d\S*art/); // apostrophe échappée en &#x27; par renderToStaticMarkup
    expect(html).toMatch(/Archives de l\S*Empire/);
  });

  it('infobulles présentes (attributs title résolus)', () => {
    const html = renderToStaticMarkup(<MainMenu />);
    expect(html).toContain('Clavier, audio, confort de jeu et règles optionnelles');
    expect(html).toContain('bestiaire et lore');
  });

  it('l’entrée Options ouvre l’écran PARTAGÉ à quatre onglets (le même qu’en jeu, #839)', () => {
    const html = renderToStaticMarkup(<OptionsScreen onClose={() => {}} />);
    for (const onglet of ['Clavier', 'Audio', 'Confort', 'Règles maison']) {
      expect(html, `onglet manquant : ${onglet}`).toContain(`>${onglet}<`);
    }
    expect((html.match(/role="tab"/g) ?? []).length).toBe(4);
    expect(html).toMatch(/role=.tablist./); // primitive Tabs, jamais un tablist recodé
    expect(html).toContain('Retour'); // en-tête MenuSubScreen partagé avec le menu système
  });
});

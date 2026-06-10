import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CharacterCreator } from './CharacterCreator';

describe('CharacterCreator (assistant) — rendu statique', () => {
  it('étape 1 : barre d\'étapes, choix d\'espèce et tirage d100 (+20 PX)', () => {
    const html = renderToStaticMarkup(<CharacterCreator />);
    expect(html).toContain('Créateur de personnage');
    expect(html).toContain('1. Espèce');
    expect(html).toContain('7. Récapitulatif');
    expect(html).toContain('Humains (Reiklander)');
    expect(html).toContain('Tirer l&#x27;espèce (d100)');
    expect(html).toContain('PX bonus de création');
    // Navigation : Suivant actif dès l'étape 1 (aucun choix obligatoire).
    expect(html).toContain('Suivant →');
  });
});

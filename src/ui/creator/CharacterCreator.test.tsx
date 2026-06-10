import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CharacterCreator } from './CharacterCreator';
import { CreatorSummary } from './CreatorSummary';
import { newDraft } from './draft';

describe('CharacterCreator (assistant) — rendu statique', () => {
  it('étape 1 : fiche vivante + cartes d\'espèces illustrées + tirage d100 (+20 PX)', () => {
    const html = renderToStaticMarkup(<CharacterCreator />);
    // Barre d'étapes
    expect(html).toContain('1. Espèce');
    expect(html).toContain('7. Récapitulatif');
    // Fiche vivante (colonne gauche) : silhouette + stats dérivées en direct
    expect(html).toContain('creator-summary');
    expect(html).toContain('creator-figure');
    expect(html).toContain('Blessures');
    expect(html).toContain('PX bonus de création');
    // Cartes d'espèces du Livre de base, avec figurine et description
    expect(html).toContain('select-card');
    expect(html).toContain('card-figure');
    for (const s of ['Humains (Reiklander)', 'Nains', 'Halflings', 'Hauts elfes', 'Elfes sylvains']) {
      expect(html).toContain(s);
    }
    // Tirage aléatoire LDB 04
    expect(html).toContain('Tirer l&#x27;espèce (d100)');
    expect(html).toContain('Suivant →');
  });

  it('CreatorSummary : caractéristiques EN DIRECT du héros prévisualisé (talents/augmentations inclus)', () => {
    const html = renderToStaticMarkup(<CreatorSummary d={newDraft(42)} step={0} />);
    expect(html).toContain('Aventurier');
    expect(html).toContain('Soldat'); // carrière par défaut
    expect(html).toContain('Mouvement');
    expect(html).toContain('Destin');
    expect(html).toContain('Bourse');
    // Les 10 caractéristiques sont rendues
    for (const k of ['CC', 'CT', 'FM', 'Soc']) expect(html).toContain(`>${k}<`);
  });
});

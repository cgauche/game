import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CharacterCreator } from './CharacterCreator';
import { CreatorSummary } from './CreatorSummary';
import { newDraft } from './draft';

describe('CharacterCreator (assistant) — rendu statique', () => {
  it('étape 1 : trois zones (rail de sélection, profil, fiche vivante) + tirage d100', () => {
    const html = renderToStaticMarkup(<CharacterCreator />);
    // Barre d'étapes
    expect(html).toContain('1. Espèce');
    expect(html).toContain('7. Récapitulatif');
    // Coquille 3 zones : rail (liste de sélection), détail, fiche vivante
    expect(html).toContain('creator-shell');
    expect(html).toContain('creator-rail');
    expect(html).toContain('creator-main');
    expect(html).toContain('creator-summary');
    expect(html).toContain('pick-row selected');
    expect(html).toContain('Blessures');
    expect(html).toContain('PX bonus de création');
    // Espèces du Livre de base listées + profil chiffré de la sélection
    for (const s of ['Humains (Reiklander)', 'Nains', 'Halflings', 'Hauts elfes', 'Elfes sylvains']) {
      expect(html).toContain(s);
    }
    expect(html).toContain('Caractéristiques de base');
    expect(html).toContain('Compétences d&#x27;espèce');
    // Tirage aléatoire LDB 04
    expect(html).toContain('Tirer l&#x27;espèce (d100)');
    expect(html).toContain('Suivant →');
  });

  it('CreatorSummary : caractéristiques EN DIRECT du héros prévisualisé (talents/augmentations inclus)', () => {
    const d = newDraft(42);
    const html = renderToStaticMarkup(<CreatorSummary d={d} step={0} />);
    expect(html).toContain('Aventurier');
    expect(html).toContain(d.careerLabel); // carrière par défaut dérivée des données
    expect(html).toContain('Mouvement');
    expect(html).toContain('Destin');
    expect(html).toContain('Bourse');
    // Les 10 caractéristiques sont rendues
    for (const k of ['CC', 'CT', 'FM', 'Soc']) expect(html).toContain(`>${k}<`);
  });
});

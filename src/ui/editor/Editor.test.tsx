import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Editor } from './Editor';

/** Test de fumée du rendu de l'éditeur (garde du découpage Palette / Inspector / canvas). */
describe('Editor (rendu)', () => {
  const html = renderToStaticMarkup(<Editor />);

  it('rend la barre d’outils (Nouveau / Importer / Exporter / Tester / undo-redo)', () => {
    expect(html).toContain('Éditeur de niveau');
    expect(html).toContain('Nouveau');
    expect(html).toContain('Importer');
    expect(html).toContain('Exporter JSON');
    expect(html).toContain('▶ Tester');
    expect(html).toContain('↶ Annuler');
    expect(html).toContain('↷ Rétablir');
  });

  it('rend la palette (onglets + outils Carte par défaut)', () => {
    expect(html).toContain('🗺️ Carte');
    expect(html).toContain('⚙️ Logique');
    expect(html).toContain('📄 Scène');
    expect(html).toContain('Calques');
    expect(html).toContain('Pinceau');
    expect(html).toContain('↖ Sélection / Déplacer');
    expect(html).toContain('Gomme');
    expect(html).toContain('Dessiner une zone (trigger)');
    expect(html).toContain('Placer des ennemis');
  });

  it('rend le canvas iso (SVG) et l’inspecteur par défaut', () => {
    expect(html).toContain('editor-iso');
    expect(html).toContain('viewBox');
    expect(html).toContain('Inspecteur');
    expect(html).toContain('Sélectionnez un élément sur la carte');
  });

  it('rend la scène par défaut (« La Diligence » : entités + triggers du tome 1)', () => {
    // tome1Intro a des entités et des zones → le canvas doit contenir des losanges de trigger.
    expect(html).toContain('strokeDasharray="4 3"'.replace('strokeDasharray', 'stroke-dasharray'));
  });
});

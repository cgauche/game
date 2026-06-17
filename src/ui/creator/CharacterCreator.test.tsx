import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CharacterCreator, PettySpellsSection } from './CharacterCreator';
import { CreatorSummary } from './CreatorSummary';
import { newDraft, withCareer } from './draft';
import { findCareerById } from '../../data';

describe('CharacterCreator (assistant) — rendu statique', () => {
  it('étape 1 : trois zones (rail de sélection, profil, fiche vivante) + tirage d100', () => {
    const html = renderToStaticMarkup(<CharacterCreator />);
    // Barre d'étapes — le signe astral (ADE2, règle activée par défaut) insère une étape après Caractéristiques.
    expect(html).toContain('1. Race');
    expect(html).toContain('4. Signe astral');
    expect(html).toContain('8. Récapitulatif');
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
    expect(html).toContain('Compétences de race');
    // Tirage aléatoire LDB 04
    expect(html).toContain('Tirer la race (d100)');
    expect(html).toContain('Suivant →');
  });

  it('étape 4 — Magie mineure choisie : la section des sorts inclus apparaît (compteur n/BFM)', () => {
    const d = { ...withCareer(newDraft(7), 'Sorcier'), careerTalent: 'Magie mineure' };
    const html = renderToStaticMarkup(<PettySpellsSection d={d} setD={() => {}} />);
    expect(html).toContain('Sorts de Magie mineure (inclus au Talent)');
    expect(html).toContain('Fléchette'); // la liste des sorts de Magie mineure est proposée
    expect(html).toMatch(/0\/\d/); // compteur de quota (BFM)
    // Sans le Talent : aucune section.
    expect(renderToStaticMarkup(<PettySpellsSection d={withCareer(newDraft(7), 'soldat')} setD={() => {}} />)).toBe('');
  });

  it('CreatorSummary : caractéristiques EN DIRECT du héros prévisualisé (talents/augmentations inclus)', () => {
    const d = newDraft(42);
    const html = renderToStaticMarkup(<CreatorSummary d={d} step={0} />);
    expect(html).toContain('Aventurier');
    expect(html).toContain(findCareerById(d.careerId)!.label); // carrière par défaut dérivée des données
    expect(html).toContain('Mouvement');
    expect(html).toContain('Destin');
    expect(html).toContain('Bourse');
    // Les 10 caractéristiques sont rendues
    for (const k of ['CC', 'CT', 'FM', 'Soc']) expect(html).toContain(`>${k}<`);
  });
});

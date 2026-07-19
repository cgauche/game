import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { CreaturePreview } from './CreaturePreview';
import type { EntityAppearance } from '../../engine/authoringAppearance';

const render = (label: string, appearance?: EntityAppearance) =>
  renderToStaticMarkup(React.createElement(CreaturePreview, { label, appearance }));

describe('CreaturePreview — aperçu rendu de créature (Codex / éditeur)', () => {
  it('bipède → SVG non vide, face + profil', () => {
    const html = render('Mutant', { species: 'Humain' });
    expect((html.match(/<svg/g) ?? []).length).toBe(2);
    expect(html).toContain('<path');
  });

  it("reflète l'apparence éditée EN DIRECT (un trait ajouté change le rendu)", () => {
    const without = render('Mutant', { species: 'Humain' });
    const withEars = render('Mutant', { species: 'Humain', features: ['oreilles-pointues'] });
    expect(withEars).not.toBe(without);
    expect(withEars).toContain('M-8 7 Q-15 4 -14 -3'); // path d'oreille pointue du catalogue
  });

  it('non-bipède → rendu par son gabarit (pas vide)', () => {
    expect(render('Loup')).toContain('<svg');
  });
});

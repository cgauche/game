import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppearancePanel } from './AppearancePanel';
import type { Appearance } from '../gameIso/rig/appearance';

const app: Appearance = { species: 'Humain', sex: 'F', build: 0.4, seed: 2 };

describe('AppearancePanel', () => {
  it('rend un aperçu de rig + les contrôles sexe/morpho', () => {
    const html = renderToStaticMarkup(
      <AppearancePanel value={app} equip={{ weapons: [], armour: [] }} career="Soldat" onChange={vi.fn()} />,
    );
    expect(html).toContain('data-bone='); // aperçu RigSprite présent
    expect(html).toContain('<select'); // sélecteur de sexe
    expect(html).toContain('type="range"'); // slider morphologie
    expect(html).toContain('Masculin');
    expect(html).toContain('Féminin');
  });
});

import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { RigSprite } from './composeRig';
import type { Appearance, RigSpeciesId } from './appearance';
import type { EquipCtx } from './parts/equipment';
import type { Weapon } from '../../engine/types';

const app: Appearance = { species: 'Humain' as RigSpeciesId, sex: 'M', build: 0.5, seed: 7 };

describe('RigSprite (rendu headless)', () => {
  it('émet un <g data-bone> par os avec une matrice de transform', () => {
    const html = renderToStaticMarkup(
      <svg>
        <RigSprite appearance={app} equip={{ weapons: [], armour: [] }} career="Soldat" />
      </svg>,
    );
    expect(html).toContain('data-bone="torse"');
    expect(html).toContain('data-bone="tete"');
    expect(html).toContain('transform="matrix(');
    // part symétrique (bras) rendue en miroir côté droit
    expect(html).toContain('scale(-1,1)');
  });

  it('affiche une arme quand une est équipée', () => {
    const equip: EquipCtx = { weapons: [{ label: 'Hache', type: 'melee', damage: { plusBF: false, flat: 4 }, qualities: [] } as Weapon], armour: [] };
    const html = renderToStaticMarkup(
      <svg><RigSprite appearance={app} equip={equip} career="Soldat" /></svg>,
    );
    expect(html).toContain('data-bone="arme"');
  });
});

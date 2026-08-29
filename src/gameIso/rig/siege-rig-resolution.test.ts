import { describe, it, expect } from 'vitest';
import { siegeEngines } from '../../data';
import { defById } from './creatures';
import { enginArtOf } from './engin/composeEngin';
import { MISSING_ART } from './viewArt';

/**
 * #1536 — tout `siegeRig` de la donnée résout une `CreatureDef` de plan NON bipède : c'est la
 * condition que `bodyPlan` (branche affût) exige pour rendre l'engin par son gabarit `engin`.
 * Sans def, le repli rend l'affût en humanoïde — échec NOMINATIF par engin ci-dessous.
 */
describe('siegeRig → CreatureDef de rendu', () => {
  const rigs = [...new Set(siegeEngines.map((t) => t.siegeRig as string))].sort();

  it('la donnée porte bien des engins à affût', () => {
    expect(rigs.length).toBeGreaterThan(0);
  });

  for (const rig of rigs) {
    it(`« ${rig} » a une def de plan engin (jamais un repli bipède)`, () => {
      const d = defById(rig);
      expect(d, `aucune CreatureDef pour siegeRig « ${rig} » (creatures/defs manquante)`).toBeTruthy();
      expect(d!.plan, `siegeRig « ${rig} » : plan « ${d!.plan} » — un affût ne se rend pas en bipède`).not.toBe('biped');
      expect(enginArtOf(rig), `siegeRig « ${rig} » : aucun art d'engin dédié (repli visible #223)`).not.toBe(MISSING_ART);
    });
  }
});

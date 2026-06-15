import type { CreatureDef } from '../types';
import { OV_CORNES_GOR, OV_GRIFFES } from '../../parts/monstrous';
import { scalesPatch } from '../../parts/textures';

// Urzo (Compagnon T1 ch.12, cage 1) : homme-bête massif « presque de la taille d'un ogre »,
// tête de chèvre à cornes impressionnantes, pattes à sabots, « peau recouverte de plaques
// cornées comme celles d'un tatou » (Armure 3), mains à écraser un crâne. Vieux et miteux.
// Stats = source de campagne → CustomStatblock en scène.
export const creature: CreatureDef = {
  name: 'Urzo',
  plan: 'biped',
  race: 'Homme-bête', // « urzo » = le nom (limite de mot)

  perso: {
    gabarit: 'brute',
    scale: 1.25, // presque ogre (+ trait Taille (Grande) au statbloc)
    colors: { peau: '#7d6f55', cheveux: '#46392a' }, // pelage terne de vieille bête malade
    features: [
      { bone: 'tete', svg: OV_CORNES_GOR, layer: -2 },
      { bone: 'mainG', svg: OV_GRIFFES },
      { bone: 'mainD', svg: OV_GRIFFES },
      // plaques cornées de tatou (bandes d'écailles sur le torse et les épaules)
      { bone: 'torse', svg: scalesPatch(-9, 9, -14, 6, 4.2), scale: 'bone', layer: 62 },
      { bone: 'epauleG', svg: scalesPatch(-3, 3, 0, 18, 3.4), scale: 'bone', layer: 62 },
      { bone: 'epauleD', svg: scalesPatch(-3, 3, 0, 18, 3.4), scale: 'bone', layer: 62 },
    ],
  },
};

import type { CreatureDef } from '../types';
import { GRIFFES_ART } from '../../parts/elements/defs/griffes';
import { appendageFeature } from '../../parts/appendages';
import { scalesPatch } from '../../parts/textures';

// Urzo (Compagnon T1 ch.12, cage 1) : homme-bête massif « presque de la taille d'un ogre »,
// tête de chèvre à cornes impressionnantes, pattes à sabots, « peau recouverte de plaques
// cornées comme celles d'un tatou » (Armure 3), mains à écraser un crâne. Vieux et miteux.
// Stats = source de campagne → CustomStatblock en scène.
export const creature: CreatureDef = {
  label: 'Urzo',
  id: "urzo",
  plan: 'biped',
  race: 'Homme-bête', // « urzo » = le nom (limite de mot)

  perso: {
    gabarit: 'brute',
    scale: 1.25, // presque ogre (+ trait Taille (Grande) au statbloc)
    extremites: 'griffues', // griffes aux mains (#736 Lot 2) ; race Homme-bête partagée (Gor/Ungor lisses)
    colors: { peau: '#7d6f55', cheveux: '#46392a' }, // pelage terne de vieille bête malade
    features: [
      appendageFeature('cornes-gor'),
      { bone: 'mainG', svg: GRIFFES_ART },
      { bone: 'mainD', svg: GRIFFES_ART },
      // plaques cornées de tatou (bandes d'écailles sur le torse et les épaules)
      { bone: 'torse', svg: scalesPatch(-9, 9, -14, 6, 4.2), scale: 'bone', layer: 62 },
      { bone: 'epauleG', svg: scalesPatch(-3, 3, 0, 18, 3.4), scale: 'bone', layer: 62 },
      { bone: 'epauleD', svg: scalesPatch(-3, 3, 0, 18, 3.4), scale: 'bone', layer: 62 },
    ],
  },
};

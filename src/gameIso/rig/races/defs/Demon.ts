// Démon : élancé nerveux, membres longs.
import type { RaceDef } from '../types';
import { OV_CORNES_DEMON } from '../../parts/monstrous';

// Définition musculaire sur la chair rouge (« peau dure comme l'airain, forgée sur l'enclume
// de guerres incessantes » LDB 84) : pectoraux, ligne médiane, abdominaux — en ombres @peauO.
// Remplace les anciens membres-rouges/stries, INVISIBLES sur un corps déjà rouge.
const OV_MUSCLES_TORSE =
  `<path d="M-8.5 -15 Q-4 -11.5 0 -12 Q4 -11.5 8.5 -15" stroke="@peauO" stroke-width="1" fill="none" opacity="0.8"/>`
  + `<path d="M0 -11.5 L0 9" stroke="@peauO" stroke-width="0.9" fill="none" opacity="0.7"/>`
  + `<path d="M-4.5 -5 Q0 -3.6 4.5 -5 M-4.2 1 Q0 2.4 4.2 1 M-3.8 7 Q0 8.4 3.8 7" stroke="@peauO" stroke-width="0.8" fill="none" opacity="0.65"/>`
  + `<path d="M-9 -18 Q-7 -12 -8.5 -6 M9 -18 Q7 -12 8.5 -6" stroke="@peauO" stroke-width="0.8" fill="none" opacity="0.55"/>`;

export const race: RaceDef = {
  id: 'Démon',
  gabarit: 'elance',
  gabaritOverride: { sl: 1.06, legs: 1.06 },
  palette: { peau: "#9a201a", peauO: "#601010", peauH: "#c4382c", cheveux: "#1a1410", cheveuxO: "#0a0806", cheveuxH: "#2c2620" },
  career: 'Nu',
  head: 'demon',
  legs: 'chevre', // jambes digitigrades (illustration LDB p.337 : sabots/pattes bestiales)
  features: [
    { bone: 'tete',  svg: OV_CORNES_DEMON,  scale: 'bone', layer: -2 },
    { bone: 'torse', svg: OV_MUSCLES_TORSE, scale: 'bone', layer: 60 },
  ],
};

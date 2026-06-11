import type { CreatureDef } from '../types';
import { OV_GRIFFES } from '../../parts/monstrous';

// Sanguinaire de Khorne (LDB 84 + illustration p.337) : « dents pointues et acérées […]
// monstrueux visage cornu ; peau rouge-sang dure comme l'airain » + trait Arme (griffes).
// Tête/cornes/musculature/jambes caprines via la race Démon ; griffes ADDITIVES aux mains ;
// PAGNE loqueteux gris ceinturé (sa « tenue », illustration) en features sur le corps nu.
// La Lame des Enfers = l'arme équipée en scène.
// Repère TORSE (zone basse y 8..28) — sur l'os bassin il serait peint SOUS le torse nu.
const OV_PAGNE_SANGUINAIRE =
  `<path d="M-10.5 9 Q0 11.5 10.5 9 L10 15 L11.5 24 L7.5 21 L5.5 26.5 L2 22 L0 28 L-3 22.5 L-6 26 L-8 21 L-11.5 23.5 Z" fill="#7d766a" stroke="#4a443a" stroke-width="0.7" stroke-linejoin="round"/>`
  + `<path d="M-5 11.5 L-6.5 22 M0.5 12 L0 24 M5.5 11.5 L7 21" stroke="#4a443a" stroke-width="0.5" opacity="0.5" fill="none"/>`
  + `<path d="M-10.5 8.2 Q0 10.6 10.5 8.2 L10.5 11 Q0 13.2 -10.5 11 Z" fill="#4a3424" stroke="#2c1e12" stroke-width="0.5"/>`
  + `<rect x="4.6" y="11.4" width="3.8" height="5.2" rx="0.8" fill="#5a4430" stroke="#2c1e12" stroke-width="0.5"/>`;

export const creature: CreatureDef = {
  name: "Démon",
  plan: 'biped',
  matchPriority: 38,
  match: "sanguinaire|khorne",
  perso: {
    features: [
      { bone: 'mainG', svg: OV_GRIFFES },
      { bone: 'mainD', svg: OV_GRIFFES },
      { bone: 'torse', svg: OV_PAGNE_SANGUINAIRE, scale: 'bone', layer: 60 },
    ],
  },
};

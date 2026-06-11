// Ogre : brute colossale, épaules larges, jambes courtes.
import type { RaceDef } from '../types';
export const race: RaceDef = {
  id: 'Ogre',
  gabarit: 'brute',
  palette: { peau: "#c9966a", peauO: "#9a6c48", peauH: "#e0b48a", cheveux: "#3a281a", cheveuxO: "#241810", cheveuxH: "#4c3624" },
  career: 'Nu',
  head: 'ogre',
  features: [
    // Panse + plastron central métallique qui REMPLIT le ventre (scale:'bone' → suit l'épaisseur du torse brute).
    { bone: 'torse', scale: 'bone', layer: 50, svg:
      '<g>'
      + '<ellipse cx="0" cy="6" rx="15" ry="16" fill="@peau" stroke="@peauO" stroke-width="0.8"/>'
      + '<path d="M-11 -3 Q0 -7 11 -3 L9 19 Q0 24 -9 19 Z" fill="@metal" stroke="#3a4048" stroke-width="1"/>'
      + '<circle cx="0" cy="8" r="3.2" fill="#5a6068" stroke="#3a4048" stroke-width="0.6"/>'
      + '<circle cx="-6.5" cy="1" r="1.2" fill="#3a4048"/><circle cx="6.5" cy="1" r="1.2" fill="#3a4048"/>'
      + '<circle cx="-6.5" cy="16" r="1.2" fill="#3a4048"/><circle cx="6.5" cy="16" r="1.2" fill="#3a4048"/>'
      + '</g>' },
    // Épaulière de CUIR (illustration LDB p.314 : peaux et lanières, PAS de plates grises —
    // les manches d'armure complètes lisaient « armoire » ; le heaume cornu inventé est retiré,
    // le crâne de l'ogre est nu). Haut de bras seul, avant-bras NU avec bandes de poignet.
    { bone: 'epauleG', scale: 'bone', layer: 60, svg:
      '<g stroke-linejoin="round">'
      + '<path d="M-9.5 -5 Q0 -9.5 9.5 -5 Q10.5 2 8.5 7 L7 12 Q0 14.5 -7 12 L-8.5 7 Q-10.5 2 -9.5 -5 Z" fill="@cuir" stroke="#2c1e12" stroke-width="0.9"/>'
      + '<path d="M-8.5 1 Q0 -2 8.5 1 M-7.6 7 Q0 4.6 7.6 7" stroke="#2c1e12" stroke-width="0.7" fill="none" opacity="0.8"/>'
      + '<circle cx="-5" cy="-2.4" r="0.9" fill="#3a4048"/><circle cx="5" cy="-2.4" r="0.9" fill="#3a4048"/>'
      + '</g>' },
    { bone: 'epauleD', scale: 'bone', layer: 60, svg:
      '<g stroke-linejoin="round">'
      + '<path d="M-9.5 -5 Q0 -9.5 9.5 -5 Q10.5 2 8.5 7 L7 12 Q0 14.5 -7 12 L-8.5 7 Q-10.5 2 -9.5 -5 Z" fill="@cuir" stroke="#2c1e12" stroke-width="0.9"/>'
      + '<path d="M-8.5 1 Q0 -2 8.5 1 M-7.6 7 Q0 4.6 7.6 7" stroke="#2c1e12" stroke-width="0.7" fill="none" opacity="0.8"/>'
      + '<circle cx="-5" cy="-2.4" r="0.9" fill="#3a4048"/><circle cx="5" cy="-2.4" r="0.9" fill="#3a4048"/>'
      + '</g>' },
  ],
  pose: { torse: 6, cou: 6, tete: -4 },
};

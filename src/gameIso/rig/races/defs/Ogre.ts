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
    // Heaume cornu DERRIÈRE la tête (layer négatif) : cornes ivoire + rebord métal.
    { bone: 'tete', scale: 'bone', layer: -1, svg:
      '<g>'
      + '<path d="M-12 -6 Q-19 -15 -15 -23 Q-10 -15 -7 -9 Z" fill="#cabfae" stroke="#3a3026" stroke-width="0.8"/>'
      + '<path d="M12 -6 Q19 -15 15 -23 Q10 -15 7 -9 Z" fill="#cabfae" stroke="#3a3026" stroke-width="0.8"/>'
      + '<path d="M-11 -7 Q0 -20 11 -7 L11 -2 Q0 -10 -11 -2 Z" fill="@metal" stroke="#3a4048" stroke-width="1"/>'
      + '</g>' },
    // Brassard de plates : manche d'armure complète épaule→poignet (sinon le bras-moignon trapu
    // de l'ogre lit comme une « dalle » nue à l'échelle brute). Symétrique → mêmes lames G/D.
    { bone: 'epauleG', scale: 'bone', layer: 60, svg:
      '<g>'
      + '<path d="M-10 -5 Q0 -10 10 -5 Q11 3 9 8 L8 44 Q0 47 -8 44 L-9 8 Q-11 3 -10 -5 Z" fill="@metal" stroke="#3a4048" stroke-width="1"/>'
      + '<path d="M-9 8 L9 8 M-8.5 17 L8.5 17 M-8 26 L8 26 M-7.5 35 L7.5 35" stroke="#3a4048" stroke-width="0.8" opacity="0.85"/>'
      + '<path d="M-6 -2 Q0 -6 6 -2" fill="none" stroke="#6a7078" stroke-width="1"/>'
      + '</g>' },
    { bone: 'epauleD', scale: 'bone', layer: 60, svg:
      '<g>'
      + '<path d="M-10 -5 Q0 -10 10 -5 Q11 3 9 8 L8 44 Q0 47 -8 44 L-9 8 Q-11 3 -10 -5 Z" fill="@metal" stroke="#3a4048" stroke-width="1"/>'
      + '<path d="M-9 8 L9 8 M-8.5 17 L8.5 17 M-8 26 L8 26 M-7.5 35 L7.5 35" stroke="#3a4048" stroke-width="0.8" opacity="0.85"/>'
      + '<path d="M-6 -2 Q0 -6 6 -2" fill="none" stroke="#6a7078" stroke-width="1"/>'
      + '</g>' },
  ],
  pose: { torse: 6, cou: 6, tete: -4 },
};

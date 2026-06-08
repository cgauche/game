// Guerrier du Chaos : humanoïde massif en armure de plates sombre, heaume cornu.
// Race dédiée — sans ça il lit comme un simple soldat humain.
import type { RaceDef } from '../types';
export const race: RaceDef = {
  id: 'Guerrier du Chaos',
  gabarit: 'trapu-massif',
  career: 'Soldat',                              // tenue de plates, recolorée sombre ci-dessous
  palette: { peau: '#b7a596', peauO: '#8c7b6e', peauH: '#cdbcab', cheveux: '#1a1410', cheveuxO: '#0a0806', cheveuxH: '#2c2620' },
  colors: { vet1: '#2a2230', vet2: '#171018', cuir: '#140f12', metal: '#3a3a46' }, // plates sombres
  pose: { torse: 6, cou: 5, tete: -3 },          // léger surplomb menaçant
  features: [
    // Plastron de plates SOMBRE couvrant le torse (masque le tabard rayé clair du Soldat → lit
    // « armure de plaques du Chaos », pas « soldat de l'Empire »). Étoile du Chaos en relief.
    { bone: 'torse', scale: 'bone', layer: 55, svg:
      '<g>'
      + '<path d="M-12 -9 Q0 -13 12 -9 L11 23 Q0 28 -11 23 Z" fill="@metal" stroke="#0c0c12" stroke-width="1.3"/>'
      + '<path d="M0 -11 L0 25" stroke="#0c0c12" stroke-width="1"/>'
      + '<path d="M-9 -1 L9 -1 M-9 9 L9 9 M-8 17 L8 17" stroke="#0c0c12" stroke-width="0.8" opacity="0.7"/>'
      + '<g stroke="#0c0c12" stroke-width="1.1" fill="none"><path d="M0 1 L0 13 M-5 7 L5 7 M-4 3 L4 11 M4 3 L-4 11"/></g>'
      + '</g>' },
    // Cornes noires DERRIÈRE la tête/heaume — tell du Chaos.
    { bone: 'tete', scale: 'bone', layer: -1, svg:
      '<g>'
      + '<path d="M-11 -5 Q-20 -14 -17 -26 Q-12 -16 -8 -9 Z" fill="#15100c" stroke="#000" stroke-width="0.6"/>'
      + '<path d="M11 -5 Q20 -14 17 -26 Q12 -16 8 -9 Z" fill="#15100c" stroke="#000" stroke-width="0.6"/>'
      + '</g>' },
  ],
};

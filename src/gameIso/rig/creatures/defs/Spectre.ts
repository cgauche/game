import type { CreatureDef } from '../types';

// Morts-vivants SPECTRAUX — monolithique pour l'instant (gabarit « spectral » = rig bipède + bas
// vaporeux, à venir). Def de ROUTAGE (remplace EXOTIC_RE) ; passera plan:'spectral' une fois le
// gabarit posé, sans rien changer ailleurs.
export const creature: CreatureDef = {
  name: 'Spectre',
  plan: 'monolithic',
  aliases: ['spectre', 'fantome', 'banshee', 'necarque', 'revenant', 'apparition', 'ombre'],
};

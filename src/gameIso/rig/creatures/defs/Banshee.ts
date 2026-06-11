import type { CreatureDef } from '../types';

// Banshee — gabarit spectral : tête NUE au visage hurlant (LDB 82 l.13 « hurlements
// déchirants… arrêter leur cœur », Terreur 3 l.17), suaire VIOLET SOMBRE saturé de Dhar
// (« imprégnés de l'énergie fétide de Dhar » l.13) à contour quasi noir et veines de lueur
// pâle — la menace passe par la noirceur (vs Fantôme bleu-blanc glacé, Spectre vert à
// capuche+crâne) et les yeux luisants flambent sur la face obscure. NB : hood:true
// masquerait le cri (la capuche ignore `face`).
export const creature: CreatureDef = {
  name: 'Banshee',
  plan: 'spectral',
  aliases: ['banshee', 'pleureuse'],
  spectre: {
    sl: 0.96, hood: false, face: 'cri',
    stored: { corps: '#63507f', corpsO: '#1a1226', corpsH: '#c7b3ef', cheveux: '#241b38', cheveuxO: '#140e22', cuir: '#4a3a66' },
  },
};

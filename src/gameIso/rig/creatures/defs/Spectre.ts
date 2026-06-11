import type { CreatureDef } from '../types';

// Spectre (de cairn) — gabarit spectral : esprit d'aspirant nécromancien (LDB 82 l.57-58
// « restes spectraux d'aspirants nécromanciens… volonté malveillante »), Éthéré + Étreinte
// glaciale + Terreur 3 (LDB 82 l.62). Capuche-suaire quasi noire à regard luisant (le vide
// sous la capuche — hood:true masque `face`), robe spectrale verdâtre à lueur nécromantique :
// le contraste suaire sombre / lueur verte le distingue du Fantôme (bleu-blanc) et de la
// Banshee (violette), tous deux tête nue.
export const creature: CreatureDef = {
  name: 'Spectre',
  plan: 'spectral',
  aliases: ['spectre', 'cairn', 'necarque', 'revenant', 'apparition', 'ombre', 'wraith'],
  spectre: {
    sl: 0.98, hood: true, face: 'crane',
    stored: { corps: '#8cbda2', corpsO: '#1d2820', corpsH: '#defbe9', cheveux: '#2e3a34', cheveuxO: '#1a221e', cuir: '#5f8472' },
  },
};

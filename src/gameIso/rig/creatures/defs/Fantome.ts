import type { CreatureDef } from '../types';

// Fantôme — gabarit spectral : tête nue translucide, bouche béante d'âme tourmentée (LDB 82
// « esprits d'âmes tourmentées… répandent la peur »), voile glacé bleu-blanc quasi immatériel
// (trait Éthéré, LDB 85). Tête nue + pâleur le distinguent de la Banshee (capuche violacée)
// et du Spectre de cairn (capuche + crâne verdâtre).
export const creature: CreatureDef = {
  name: 'Fantôme',
  plan: 'spectral',
  aliases: ['fantome'],
  spectre: {
    sl: 0.95, hood: false, face: 'cri',
    stored: { corps: '#cce2f0', corpsO: '#7fa2b6', corpsH: '#f4fcff', cheveux: '#3a4a54', cheveuxO: '#222e34', cuir: '#9cbccd' },
  },
};

import type { CreatureDef } from '../types';

// Manticore : corps de lion + ailes membraneuses (cuir) + queue à toupet → gabarit AILÉ
// (réutilise feline + ours + leonine + membrane, distinct du griffon : ailes de CUIR vs
// plumes, tête de fauve vs aigle). Recatégorisée depuis monolithique (jalon 3).
export const creature: CreatureDef = {
  name: 'Manticore',
  plan: 'winged',
  quad: {
    sl: 1.1, build: 'feline', girth: 0.98, bodyLen: 1.02, neckLen: 0.6, neckAngle: -30, legLen: 0.98,
    head: 'ours', tail: 'leonine', ears: 'rondes', foot: 'patte', wings: 'membrane',
    stored: { corps: '#9a4636', corpsO: '#682c20', corpsH: '#bd6450', cheveux: '#3a241a', cheveuxO: '#241410', cuir: '#caa23a' },
  },
};

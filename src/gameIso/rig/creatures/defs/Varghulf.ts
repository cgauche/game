import type { CreatureDef } from '../types';

// Varghulf (chauve-souris vampire géante) : bête ailée à grandes ailes membraneuses →
// gabarit AILÉ (corps canin sombre + tête museau + ailes de cuir). Recatégorisée depuis
// monolithique. `aliases` couvre le libellé bestiaire « Chauve-souris vampire ».
export const creature: CreatureDef = {
  name: 'Varghulf',
  plan: 'winged',
  aliases: ['chauve-souris', 'chauve souris', 'chauve.?souris'],
  quad: {
    sl: 1.1, build: 'canine', girth: 0.9, bodyLen: 0.98, neckLen: 0.5, neckAngle: -18, legLen: 0.88,
    head: 'loup', tail: 'fouet', ears: 'pointues', foot: 'patte', wings: 'membrane',
    stored: { corps: '#4a4640', corpsO: '#2c2a26', corpsH: '#6a655c', cheveux: '#241f1a', cheveuxO: '#141210', cuir: '#3a2a24' },
  },
};

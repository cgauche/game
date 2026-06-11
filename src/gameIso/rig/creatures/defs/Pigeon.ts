import type { CreatureDef } from '../types';

// Pigeon / petit oiseau (gabarit aviaire) — dodeline, recolore en corbeau/rouge-gorge. 1 fichier.
export const creature: CreatureDef = {
  name: 'Pigeon',
  plan: 'avian',
  aliases: ['pigeon', 'oiseau', 'corbeau', 'colombe', 'moineau', 'corneille'],
  bird: {
    sl: 0.62, girth: 1.15, // jabot plein du pigeon biset
    // Plumage gris-bleu, reflet irisé vert au cou (corpsH), pattes/bec rouge-rosé (cuir)
    stored: { corps: '#7e8da1', corpsO: '#46505e', corpsH: '#9dc7b8', cheveux: '#3a444e', cheveuxO: '#222a30', cuir: '#c2545e' },
  },
};

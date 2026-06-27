import type { CreatureDef } from '../types';

// Cockatrice (ZI) — hybride oiseau-reptile ailé. Gabarit AILÉ (quad + ailes emplumées) : corps
// svelte de rapace, tête 'aigle', queue 'reptile' écailleuse, pieds 'serre'. Plumage vert-jaune maladif.
export const creature: CreatureDef = {
  name: 'Cockatrice',
  plan: 'winged',
  quad: {
    sl: 0.9, build: 'draconic', girth: 0.9, bodyLen: 0.95, neckLen: 0.72, neckAngle: -34, legLen: 0.86,
    head: 'aigle', tail: 'reptile', mane: 'sans', ears: 'pointues', foot: 'serre', wings: 'plumes', wingSpan: 1.0, headScale: 1.0, tailLen: 1.05,
    stored: { corps: '#8a8a3e', corpsO: '#454618', corpsH: '#c8cc78', cheveux: '#5a5a26', cheveuxO: '#2e2e12', cuir: '#c87a2a' },
  },
};

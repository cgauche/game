import type { CreatureDef } from '../types';

// Pigeon VOYAGEUR (gabarit aviaire, réf. art LDB 79 p.318) — message roulé sur le dos,
// clochette dorée à la patte, gorge irisée vert/violet (mode `messenger` du plan avian).
export const creature: CreatureDef = {
  label: 'Pigeon',
  plan: 'avian',
  bird: {
    sl: 0.62, girth: 1.15, // jabot plein du pigeon biset
    messenger: true,
    // Plumage gris-violet aux reflets irisés (corpsH vert sur poitrail/cou), pattes rouge-rosé (cuir)
    stored: { corps: '#8b89a6', corpsO: '#45415c', corpsH: '#5fb083', cheveux: '#3a3550', cheveuxO: '#221f33', cuir: '#c2545e' },
  },
};

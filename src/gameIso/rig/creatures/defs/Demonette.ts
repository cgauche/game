import type { CreatureDef } from '../types';
import { lateralPair } from '../../parts/parallax';

// Démonette de Slaanesh — calée sur l'ILLUSTRATION LDB p.337 : peau LILAS pâle, crête
// indigo sombre, bras finis en PINCES de chitine sombre (les deux), grands yeux noir de
// jais (texte l.38), jambes digitigrades. Son ÉQUIPEMENT (corset liseré d'or + jupe à
// pans) = tenue de carrière « Démonette » (registre, bareFoot). EXCEPTION : les brassards
// restent ici en features — le slot bras de la tenue serait écrasé par les bras-pinces.
const OV_BRASSARD =
  `<path d="M-4.6 1 Q0 -0.6 4.6 1 L4.3 4.6 Q0 6 -4.3 4.6 Z" fill="#1f1c30" stroke="#c8a23c" stroke-width="0.6"/>`;

export const creature: CreatureDef = {
  name: 'Démonette',
  plan: 'biped',
  matchPriority: 39, // proche de Démon (38) ; « demonette »/« slaanesh » ne chevauchent pas Khorne
  aliases: ['slaanesh'],
  perso: {
    tenue: 'Démonette',
    sex: 'F',
    monster: { brasG: 'griffe', brasD: 'griffe', jambes: 'chevre' },
    eyes: { G: 'noir', D: 'noir' },
    parts: { cheveux: 4 }, // crinière épaisse qui épouse le crâne (épinglée, pas au seed)
    colors: { peau: '#cfc4dc', cheveux: '#232a4e' }, // lilas pâle + crête indigo (illustration)
    features: [
      // cornes par-VUE : paire de face/dos ; de PROFIL une seule corne balayée en arrière
      // + exemplaire lointain (lateralPair) — l'art de face plaqué donnait deux anses.
      { bone: 'tete', svg: `<path d="M5 4 Q11.5 -1 12.4 -10.5 Q12.8 -16 9.8 -18.5 Q11.4 -13.5 10 -8.5 Q8 -2 2.6 2.4 Z" fill="#3a2a3a" stroke="#1c1220" stroke-width="0.5"/><path d="M-5 4 Q-11.5 -1 -12.4 -10.5 Q-12.8 -16 -9.8 -18.5 Q-11.4 -13.5 -10 -8.5 Q-8 -2 -2.6 2.4 Z" fill="#3a2a3a" stroke="#1c1220" stroke-width="0.5"/>`, layer: -2, view: 'front' },
      { bone: 'tete', svg: `<path d="M5 4 Q11.5 -1 12.4 -10.5 Q12.8 -16 9.8 -18.5 Q11.4 -13.5 10 -8.5 Q8 -2 2.6 2.4 Z" fill="#3a2a3a" stroke="#1c1220" stroke-width="0.5"/><path d="M-5 4 Q-11.5 -1 -12.4 -10.5 Q-12.8 -16 -9.8 -18.5 Q-11.4 -13.5 -10 -8.5 Q-8 -2 -2.6 2.4 Z" fill="#3a2a3a" stroke="#1c1220" stroke-width="0.5"/>`, layer: -2, view: 'back' },
      { bone: 'tete', svg: lateralPair(`<path d="M4 1 Q-2 -4 -6.5 -10 Q-9.5 -14.5 -8 -19 Q-8.2 -14 -4.8 -9 Q-1.2 -3.8 5 -0.8 Z" fill="#3a2a3a" stroke="#1c1220" stroke-width="0.5"/>`, { dx: 4 }), layer: -2, view: 'profile' },
      { bone: 'tete', svg: `<path d="M-1.8 11.3 Q0 10.4 1.8 11.3 Q0 13.2 -1.8 11.3 Z" fill="#7c2040" stroke="#4a1226" stroke-width="0.3"/>`, layer: 50, view: 'front' },
      { bone: 'epauleG', svg: OV_BRASSARD, scale: 'bone', layer: 60 },
      { bone: 'epauleD', svg: OV_BRASSARD, scale: 'bone', layer: 60 },
    ],
  },
};

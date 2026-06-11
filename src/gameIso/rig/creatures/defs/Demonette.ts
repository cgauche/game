import type { CreatureDef } from '../types';
import { lateralPair } from '../../parts/parallax';

// Démonette de Slaanesh — calée sur l'ILLUSTRATION LDB p.337 : peau LILAS pâle, crête
// indigo sombre, CORSET noir-indigo liseré d'or + jupe à pans ornés + brassard (sa tenue,
// en features sur le corps nu), bras finis en PINCES de chitine sombre (les deux),
// grands yeux noir de jais (texte l.38), jambes digitigrades (monster.jambes).
const OV_CORSET =
  `<path d="M-10 -14 Q0 -11.5 10 -14 L11 8 Q0 12 -11 8 Z" fill="#1f1c30" stroke="#0e0c1a" stroke-width="0.7" stroke-linejoin="round"/>`
  + `<path d="M-10 -13.6 Q0 -11 10 -13.6" stroke="#c8a23c" stroke-width="1" fill="none"/>`
  + `<path d="M-10.6 7.4 Q0 11 10.6 7.4" stroke="#c8a23c" stroke-width="1" fill="none"/>`
  + `<path d="M0 -11.5 L0 10" stroke="#c8a23c" stroke-width="0.6" opacity="0.8"/>`
  + `<path d="M-5 -12.6 L-5.6 9 M5 -12.6 L5.6 9" stroke="#0e0c1a" stroke-width="0.6" opacity="0.7"/>`;
// Repère TORSE (zone basse y 8..30) — sur l'os bassin elle serait peinte SOUS le torse nu.
const OV_JUPE_PANS =
  `<path d="M-10 9 Q0 11.5 10 9 L9 28 Q6 31.5 3 28.5 L3.4 12 L-3.4 12 L-3 28.5 Q-6 31.5 -9 28 Z" fill="#1f1c30" stroke="#0e0c1a" stroke-width="0.7" stroke-linejoin="round"/>`
  + `<path d="M-10 8.4 Q0 10.8 10 8.4 L10 11.2 Q0 13.4 -10 11.2 Z" fill="#2a2438" stroke="#c8a23c" stroke-width="0.6"/>`
  + `<path d="M-6.8 15 q1.6 2.4 0 4.8 q1.8 2 0.5 4.6 M6.8 15 q-1.6 2.4 0 4.8 q-1.8 2 -0.5 4.6" stroke="#c8a23c" stroke-width="0.5" fill="none" opacity="0.85"/>`;
const OV_BRASSARD =
  `<path d="M-4.6 1 Q0 -0.6 4.6 1 L4.3 4.6 Q0 6 -4.3 4.6 Z" fill="#1f1c30" stroke="#c8a23c" stroke-width="0.6"/>`;

export const creature: CreatureDef = {
  name: 'Démonette',
  plan: 'biped',
  matchPriority: 39, // proche de Démon (38) ; « demonette »/« slaanesh » ne chevauchent pas Khorne
  match: 'demonette|slaanesh',
  perso: {
    career: 'Nu',
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
      { bone: 'torse', svg: OV_CORSET, scale: 'bone', layer: 60 },
      { bone: 'torse', svg: OV_JUPE_PANS, scale: 'bone', layer: 60 },
      { bone: 'epauleG', svg: OV_BRASSARD, scale: 'bone', layer: 60 },
      { bone: 'epauleD', svg: OV_BRASSARD, scale: 'bone', layer: 60 },
    ],
  },
};

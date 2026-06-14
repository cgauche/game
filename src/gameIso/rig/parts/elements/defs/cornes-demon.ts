import type { AppearanceElement } from '../types';
import { OV_CORNES_DEMON } from '../../monstrous';
import { lateralPair } from '../../parallax';

// Corne de PROFIL du Démon : UNE corne balayée vers l'arrière (paire proche/lointaine via lateralPair).
const CORNE_DEMON_PROFIL =
  `<path d="M6 -5 Q0 -9 -4.5 -13.5 Q-8.5 -18 -7.5 -23 Q-6.8 -25.8 -4.2 -26.6 Q-6.4 -22.8 -4.8 -18.8 Q-2.8 -13.8 1.6 -10 Q3.6 -8.2 6 -7 Z" fill="#1a1410" stroke="#000" stroke-width="0.5"/>`
  + `<path d="M-3.4 -14.5 q-1.8 -1 -2.4 -2.6 M-5.4 -19.5 q-1.4 -0.8 -1.7 -2.2" stroke="#3a3026" stroke-width="0.6" fill="none"/>`;

export const element: AppearanceElement = {
  key: 'cornes-demon', label: 'Cornes de démon', category: 'trait',
  overlays: [
    { bone: 'tete', svg: OV_CORNES_DEMON, scale: 'bone', layer: -2, view: 'front' },
    { bone: 'tete', svg: OV_CORNES_DEMON, scale: 'bone', layer: -2, view: 'back' },
    { bone: 'tete', svg: lateralPair(CORNE_DEMON_PROFIL, { dx: 4 }), scale: 'bone', layer: -2, view: 'profile' },
  ],
};

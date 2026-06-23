import type { AppearanceElement } from '../types';

// Visage sans traits : une plaque de chair nue et lisse recouvre tout l'avant du visage (ni yeux, ni
// nez, ni bouche), avec un léger modelé de surface pour lire « peau tendue » (mutation Visage sans
// traits, EDOC). Posée devant le visage en os tête, face.
const LISSE = '<g data-mut="visage-sans-traits">'
  // panneau de chair couvrant l'ovale du visage (yeux→menton)
  + '<path d="M-6 -3 Q-6.6 6 -3 12 Q0 14.4 3 12 Q6.6 6 6 -3 Q0 -1 -6 -3 Z" fill="#c9a07a" stroke="#a07a52" stroke-width="0.5" stroke-linejoin="round"/>'
  // ombre douce centrale (relief lisse, aucune ouverture)
  + '<path d="M0 -1 Q1.4 5 0 11" stroke="#b3855f" stroke-width="0.5" fill="none" opacity="0.5" stroke-linecap="round"/>'
  + '<path d="M-3 1 Q-3.6 6 -2.4 10" stroke="#d6b394" stroke-width="0.5" fill="none" opacity="0.5" stroke-linecap="round"/>'
  + '</g>';

export const element: AppearanceElement = {
  key: 'visage-sans-traits', label: 'Visage sans traits', category: 'mutation',
  overlays: [{ bone: 'tete', svg: LISSE, view: 'front' }],
};

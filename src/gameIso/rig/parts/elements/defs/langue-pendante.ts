import type { AppearanceElement } from '../types';

// Langue rose pendant de la bouche jusque sous le menton.
const LANGUE = '<g data-mut="langue-pendante">'
  + '<path d="M-1.2 11 Q-1.6 16 0 19.5 Q1.8 16.5 1.4 11 Z" fill="#c46a76" stroke="#8a3a46" stroke-width="0.5"/>'
  + '<path d="M0.1 12 Q0 15.5 0.2 18" stroke="#8a3a46" stroke-width="0.5" fill="none" opacity="0.7"/>'
  + '</g>';

export const element: AppearanceElement = {
  key: 'langue-pendante', label: 'Langue pendante', category: 'mutation',
  overlays: [{ bone: 'tete', svg: LANGUE, view: 'front' }],
};

import type { AppearanceElement } from '../types';

// Bouche parasite béante SUR LA PEAU VISIBLE — en travers du front (le RAW tire une Localisation
// au hasard mais ne fait pas surgir la bouche À TRAVERS les vêtements) : lèvres charnues, dents sur
// les deux mâchoires, langue, filet de bave.
const BOUCHE = '<g data-mut="bouche-supplementaire">'
  + '<g transform="rotate(-9 0 1)">'
  + '<path d="M-3.2 0.8 Q0 -1.4 3.2 1 Q0.2 3.4 -3.2 0.8 Z" fill="#5a1010" stroke="#2e0808" stroke-width="0.5"/>'
  + '<path d="M-0.8 2 Q0.4 2.6 1.6 1.9 Q0.6 2.9 -0.8 2 Z" fill="#b04a4a"/>'
  + '<path d="M-2.4 0.4 l0.7 0.9 l0.6 -1 l0.7 0.9 l0.6 -1 l0.7 0.9 l0.6 -0.9" stroke="#f4ecd8" stroke-width="0.6" fill="none"/>'
  + '<path d="M-1.6 2.1 l0.6 -0.8 l0.6 0.9 l0.6 -0.8 l0.6 0.8" stroke="#e8dcc0" stroke-width="0.55" fill="none"/>'
  + '<path d="M2.8 1.6 q0.4 1.6 -0.1 3" stroke="#c8d0b0" stroke-width="0.45" fill="none" opacity="0.8"/>'
  + '</g>'
  + '</g>';

export const element: AppearanceElement = {
  key: 'bouche-supplementaire', label: 'Bouche supplémentaire', category: 'mutation',
  overlays: [{ bone: 'tete', svg: BOUCHE, view: 'front' }],
};

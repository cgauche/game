import type { AppearanceElement } from '../types';

// Éclats spéculaires (lumière de bougie) sur la PEAU VISIBLE : front/pommette + dos de main. La peau
// recolorée corps entier passe par `appearance.colors` (pas un calque).
const LUSTRE_VISAGE = '<g data-mut="peau-brillante">'
  + '<path d="M-4.6 1.6 q1.8 -1.6 4 -1.2 M3.2 4.6 q1.2 1 1 2.6" stroke="#ffffff" stroke-width="0.9" fill="none" opacity="0.6" stroke-linecap="round"/>'
  + '</g>';
const LUSTRE_MAIN = '<g data-mut="peau-brillante">'
  + '<path d="M-1.6 1.2 q1.4 -0.9 3 -0.4" stroke="#ffffff" stroke-width="0.7" fill="none" opacity="0.6" stroke-linecap="round"/>'
  + '</g>';

export const element: AppearanceElement = {
  key: 'peau-brillante', label: 'Peau brillante', category: 'mutation',
  overlays: [
    { bone: 'tete', svg: LUSTRE_VISAGE, view: 'front' },
    { bone: 'mainG', svg: LUSTRE_MAIN },
    { bone: 'mainD', svg: LUSTRE_MAIN },
  ],
};

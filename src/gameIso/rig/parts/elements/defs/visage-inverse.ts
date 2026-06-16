import type { AppearanceElement } from '../types';

/** Difformité morpho (Tableau de Corruption LDB 19) : le vrai visage retourné tête en bas
 *  (flip vertical du slot `visage` dans resolveRig via `Appearance.faceFlip`). */
export const element: AppearanceElement = {
  key: 'visage-inverse', label: 'Visage inversé', category: 'mutation', faceFlip: true,
};

import type { AppearanceElement } from '../types';

/** Difformité morpho (Tableau de Corruption LDB 19) : carrure accrue (+0.2 build, clampé 0..1).
 *  Pas de calque — la morpho est appliquée par `featureMorpho` (combatantAppearance). */
export const element: AppearanceElement = {
  key: 'corpulent', label: 'Corpulent', category: 'mutation', build: 0.2,
};

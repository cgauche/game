import type { CreatureDef } from '../types';

// Démonette de Slaanesh : daemon HUMANOÏDE → bipède (réutilise cornes + bras-griffe + peau
// mauve via colors). Recatégorisée depuis monolithique (jalon 3).
export const creature: CreatureDef = {
  name: 'Démonette',
  plan: 'biped',
  matchPriority: 39, // proche de Démon (38) ; « demonette »/« slaanesh » ne chevauchent pas Khorne
  match: 'demonette|slaanesh',
  // Espèce NON-canonique : baseSpeciesOf('Démonette')→'Démon' (carrure/palette du daemon). Sa config
  // distincte (cornes + bras-griffe + peau mauve, sans tête de Khorne) vit sur le perso et SURCHARGE
  // intégralement le monster de la race Démon — pour ne pas polluer la race partagée.
  perso: {
    career: 'Nu',
    monster: { cornes: true, brasD: 'griffe' },
    colors: { peau: '#bd7aa6' }, // mauve Slaanesh (ombres/reflets dérivés auto)
  },
};

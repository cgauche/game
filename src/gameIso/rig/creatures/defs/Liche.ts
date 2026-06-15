import type { CreatureDef } from '../types';

// Liche : nécromancien mort-vivant = humanoïde SQUELETTIQUE → bipède (réutilise la tenue
// ossuaire + crâne du squelette). Recatégorisée depuis « monolithique » (jalon 3).
export const creature: CreatureDef = {
  name: 'Liche',
  plan: 'biped',
  // Espèce NON-canonique : baseSpeciesOf('Liche')→'Humain'. Sa config distincte (tenue ossuaire +
  // crâne, comme le squelette) vit sur le perso, pour ne pas polluer la race Humain partagée.
  perso: { tenue: 'Squelette', monster: { tete: 'crane' } },
};

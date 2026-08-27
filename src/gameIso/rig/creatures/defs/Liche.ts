import type { CreatureDef } from '../types';

// Liche : nécromancien mort-vivant = humanoïde SQUELETTIQUE → bipède (réutilise la tenue
// ossuaire + crâne du squelette). Recatégorisée depuis « monolithique » (jalon 3).
export const creature: CreatureDef = {
  label: 'Liche',
  id: "liche",
  plan: 'biped',
  // Espèce NON-canonique : baseSpeciesOf('Liche')→'humain'. Sa config distincte (tenue ossuaire +
  // crâne, comme le squelette) vit sur le perso, pour ne pas polluer la race Humain partagée — y
  // compris `extremites` : sa tenue 'squelette' ne chausse pas (#736 Lot 1), mais Humain reste
  // 'lisses' (défaut pour les Humains qui retombent sur la tenue 'Nu') → surcharge ICI.
  perso: { tenue: 'squelette', monster: { tete: 'crane' }, extremites: 'griffues' },
};

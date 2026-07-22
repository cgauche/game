import type { CreatureDef } from '../types';

// Choses du Bois Mort (Zoo Impérial — pas d'illustration : d'après la description) : anciens VILLAGEOIS
// revenus CHANGÉS et corrompus, couverts de mutations, en proie à une rage incontrôlable. PAS des
// morts-vivants → humain corrompu/mutant (race Humain, PAS de crâne ni race Zombie). Le TELL de
// silhouette est la carrure VOÛTÉE (`trapu-voute`) + la peau gris malade + les loques de paysan.
// Les MUTATIONS (cornes, langue, tentacule) sont posées par l'orchestrateur en `appearance.features`
// (canal qui honore `replace` : le tentacule remplace un bras).
// Tenue `mendiant` : guenilles de miséreux (loques déchirées), l'habit le plus proche du villageois
// tombé dans la misère et la corruption — pas de vêture de paysan « propre ».

export const creature: CreatureDef = {
  label: 'Choses du Bois Mort',
  id: 'choses-du-bois-mort',
  plan: 'biped', // race par défaut = Humain (baseSpeciesOf)
  perso: {
    gabarit: 'trapu-voute', // carrure voûtée trapue = le tell du villageois corrompu
    sex: 'M',
    tenue: 'mendiant', // guenilles de miséreux (ex-villageois corrompu en loques)
    extremites: 'griffues', // griffes (« armes rouillées ou griffes », #736 Lot 2) ; race Humain partagée
    monster: { griffes: true }, // griffes (« armes rouillées ou griffes »)
    colors: { peau: '#9a9d88', cheveux: '#39332a' }, // chair gris malade + cheveux ternes
  },
};

import type { CreatureDef } from '../types';

// Choses du Bois Mort (Zoo Impérial — pas d'illustration : d'après la description) : anciens VILLAGEOIS
// revenus CHANGÉS et corrompus, couverts de mutations, en proie à une rage incontrôlable. PAS des
// morts-vivants → humain corrompu/mutant (race Humain, PAS de crâne ni race Zombie). Le TELL de
// silhouette est la carrure VOÛTÉE (`trapu-voute`) + la peau gris malade + les loques de paysan.
// Les MUTATIONS (cornes, langue, tentacule) sont posées par l'orchestrateur en `appearance.features`
// (canal qui honore `replace` : le tentacule remplace un bras).
// NB : pas de tenue « mendiant » au registre → archétype paysan le plus proche = `Ruraux` (bure brune).

export const creature: CreatureDef = {
  label: 'Choses du Bois Mort',
  id: 'choses-du-bois-mort',
  plan: 'biped', // race par défaut = Humain (baseSpeciesOf)
  perso: {
    gabarit: 'trapu-voute', // carrure voûtée trapue = le tell du villageois corrompu
    sex: 'M',
    tenue: 'ruraux', // loques de paysan (pas de tenue « mendiant » dédiée)
    monster: { griffes: true }, // griffes (« armes rouillées ou griffes »)
    colors: { peau: '#9a9d88', cheveux: '#39332a' }, // chair gris malade + cheveux ternes
  },
};

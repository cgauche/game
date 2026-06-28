import type { CreatureDef } from '../types';

// Sirène (Zoo Impérial — pas d'illustration : d'après la description) : au-dessus du torse, une
// damoiselle humaine/elfe à la peau pâle ; en dessous, un corps de POISSON écailleux. Dents pointues
// de requin, griffes acérées. La QUEUE (qui EFFACE les jambes) est posée par l'orchestrateur en
// `appearance.features:["queue-de-poisson"]` (seul ce canal honore `replace`). Ici : le BUSTE de
// damoiselle (race Humain, sex F, nue) + griffes + crocs de requin.

// Dents pointues de requin — petite rangée à la bouche (face seule ; détail de zoom).
const SHARK_TEETH =
  '<g data-mut="dents-requin">'
  + '<path d="M-2.4 11.4 L2.4 11.4 L1.8 13.6 L1.2 11.8 L0.6 13.4 L0 11.8 L-0.6 13.4 L-1.2 11.8 L-1.8 13.6 Z" fill="#f1ece0" stroke="#b8a888" stroke-width="0.25"/>'
  + '</g>';

export const creature: CreatureDef = {
  name: 'Sirène',
  id: 'sirene',
  plan: 'biped', // race par défaut = Humain (baseSpeciesOf) ; buste de damoiselle
  perso: {
    sex: 'F',
    tenue: 'Nu', // buste nu (la queue prend le bas du corps)
    monster: { griffes: true }, // griffes acérées aux mains
    colors: { peau: '#d3d4c0', cheveux: '#46715f' }, // chair pâle verdâtre + chevelure vert-de-mer
    features: [
      { bone: 'tete', svg: SHARK_TEETH, layer: 52, view: 'front' },
    ],
  },
};

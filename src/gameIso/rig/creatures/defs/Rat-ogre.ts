import type { CreatureDef } from '../types';
import { OV_GRIFFES } from '../../parts/monstrous';

// Rat ogre (LDB, Taille Grande) : BRUTE de chair skaven — morphologie À PART (retour
// utilisateur : il rendait comme un skaven famélique, avalé par la regex du def Skaven).
// Race Skaven (tête de rat, queue, fourrure) mais gabarit BRUTE-BRAS-LONGS (masse voûtée,
// bras tombants) + corps nu (career Nu : chair/fourrure, pas de tenue).
export const creature: CreatureDef = {
  name: 'Rat ogre',
  plan: 'biped',
  matchPriority: 10, // AVANT le def Skaven générique
  match: 'rat.?ogre',
  race: 'Skaven',
  perso: {
    career: 'Nu',
    gabarit: 'brute-bras-longs',
    sex: 'M',
    // griffes ADDITIVES (features, pas monster : monster remplacerait toute la structure
    // de race — tête de rat + queue perdues)
    features: [{ bone: 'mainG', svg: OV_GRIFFES }, { bone: 'mainD', svg: OV_GRIFFES }],
    colors: { peau: '#5a4b3c', cheveux: '#241b12' }, // fourrure brun sombre de fosse
  },
};

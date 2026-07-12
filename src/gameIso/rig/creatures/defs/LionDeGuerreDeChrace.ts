import type { CreatureDef } from '../types';

// Lion de Guerre de Chrace (ZI, artwork p.86) : grand lion PÂLE blanc-gris à crinière HÉRISSÉE
// blanche, gueule rugissante à crocs de sabre. Tête 'felin' (couronne de crinière rayonnante +
// gueule ouverte, le langage Manticore/Chimère) portée GROSSE (headScale), crinière 'hirsute'
// prolongée sur l'encolure et le dos, silhouette féline MASSIVE (girth/bodyLen hauts, membres
// ramassés = fauve tapi, pas lévrier). Robe blanc-gris froide, rehauts ivoire doré (les seules
// touches chaudes de l'artwork, sur la face), crinière blanche cernée de gris.
export const creature: CreatureDef = {
  name: 'Lion de Guerre de Chrace',
  plan: 'quadruped',
  quad: {
    sl: 1.12, build: 'feline', girth: 1.18, bodyLen: 1.1, neckLen: 0.62, neckAngle: -8, legLen: 0.78,
    head: 'felin', headScale: 1.35, tail: 'leonine', tailLen: 1.3, ears: 'rondes', foot: 'patte', mane: 'hirsute',
    stored: {
      corps: '#d7d3c6', corpsO: '#7e7868', corpsH: '#f3ecd6', // robe pâle blanc-gris, rehaut ivoire doré (face)
      cheveux: '#eae7dc', cheveuxO: '#85887e', // crinière blanche hérissée, cernée gris froid
      cuir: '#4a463c',
    },
  },
};

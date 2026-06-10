import type { TraitDef } from '../types';

// LDB 85 p.340 : fin de Round Engagé avec un adversaire d'Avantage supérieur → perd la différence
// d'Avantage en PB ; à 0 PB, elle « meurt ».
export const trait: TraitDef = { key: 'Instable', unstable: true };

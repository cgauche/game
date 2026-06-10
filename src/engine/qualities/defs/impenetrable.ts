import type { QualityDef } from '../types';

// LDB 63 (Qualités des armures) : « Toutes les Blessures Critiques causées par un nombre impair
// pour vous toucher, tel que 11 ou 33, sont ignorées. » Consommé par applyHit (Coup Critique
// annulé si le jet de toucher est impair et que la localisation porte une pièce Impénétrable).
export const quality: QualityDef = { key: 'Impénétrable', type: 'Atout', subType: 'Armure', critImmuneOdd: true };

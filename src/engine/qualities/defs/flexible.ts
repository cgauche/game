import type { QualityDef } from '../types';

// LDB 63 (Qualités des armures) : « Une armure Flexible peut être portée sous une couche d'armure
// non Flexible si vous le souhaitez. Si c'est le cas, vous gagnez les bénéfices des deux. »
// Consommé par items.recomputeLoadout (cumul rigide + flexible par localisation).
export const quality: QualityDef = { key: 'Flexible', type: 'Atout', subType: 'Armure', layerable: true };

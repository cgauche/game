import type { QualityDef } from '../types';

// Qualité MAGIQUE (ADE2 « 04 - Un peu de magie.md » l.228 : « De plaies atroces : … Elle possède
// l'Atout Dévastatrice. »). Même mécanique que Dévastatrice (dmgDRMode 'maxUnits' : DR-dégâts pris à
// max(DR, dé des unités)). Une arme magique peut ainsi porter une qualité d'Atout normale en plus.
export const quality: QualityDef = { key: 'De plaies atroces', type: 'Atout', subType: 'Arme', dmgDRMode: 'maxUnits' };

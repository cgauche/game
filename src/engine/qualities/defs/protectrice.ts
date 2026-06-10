import type { QualityDef } from '../types';

// LDB 62 l.306-307 : « Si vous utilisez cette arme pour opposer une attaque, vous êtes considéré
// comme ayant Indice PA à tous les endroits de votre corps. Si votre arme possède un Indice
// Protectrice de 2 ou plus, vous pouvez aussi opposer des projectiles tirés dans votre Ligne de Vue. »
export const quality: QualityDef = { key: 'Protectrice', type: 'Atout', subType: 'Arme', parryAP: true };

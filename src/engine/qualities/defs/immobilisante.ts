import type { QualityDef } from '../types';

// LDB 62 l.289-290 : « N'importe quel adversaire touché avec succès par votre arme gagne un État
// Empêtré avec une Force égale à votre Caractéristique de Force. » (L'évasion est le Test opposé
// de Force contre la SOURCE — LDB 16 l.61 — d'où le `sourceId` posé par combatFlow, comme pour le
// trait Constricteur. La restriction « vous ne pouvez par ailleurs pas utiliser l'arme pour
// toucher » est journalisée, non contrainte.)
export const quality: QualityDef = { key: 'Immobilisante', type: 'Atout', subType: 'Arme', onHitEntangle: true };

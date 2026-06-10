import type { QualityDef } from '../types';

// LDB 62 l.264-265 : « Votre arme contient Indice munitions, automatiquement rechargées après
// chaque coup que vous tirez. Lorsque vous avez utilisé toutes vos munitions, vous devez recharger
// entièrement l'arme en utilisant les règles normales. » (Chargeur — cf. combatFlow : compteur
// `Combatant.chambered`, rempli à l'issue du Test étendu de Recharge.)
export const quality: QualityDef = { key: 'À Répétition', type: 'Atout', subType: 'Arme', magazine: true };

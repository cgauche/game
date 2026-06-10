import type { QualityDef } from '../types';

// LDB 62 l.318-321 : « Le porteur d'une arme Rapide peut choisir d'attaquer avec l'arme Rapide en
// dehors de l'ordre d'Initiative normale » (pré-emption d'initiative, gratuite — cf. turnEconomy).
// « De plus, tous les Tests de Corps à corps pour se défendre contre des armes Rapides subissent
// une pénalité de -10 si votre adversaire utilise une arme sans l'Atout Rapide ; les autres
// Compétences défendent normalement. » (Parade seulement — l'Esquive défend normalement.)
export const quality: QualityDef = { key: 'Rapide', type: 'Atout', subType: 'Arme', fastStrike: true };

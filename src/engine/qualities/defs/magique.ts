import type { QualityDef } from '../types';

// « Magique » — arme considérée comme Magique : ses attaques comptent comme magiques et
// blessent l'Éthéré (LDB 85 p.339 « ne peut être blessée que par les Attaques magiques »).
// Posé par les ENCHANTEMENTS temporisés (op enchantWeapon — Bénédiction de Droiture « l'arme
// de votre cible est considérée comme Magique », Marteau ardent de Sigmar, Arme aethyrique,
// LDB 41/42/47) ou par un objet légendaire curé. Aucun autre effet propre.
export const quality: QualityDef = { key: 'Magique', type: 'Atout', subType: 'Arme', magic: true };

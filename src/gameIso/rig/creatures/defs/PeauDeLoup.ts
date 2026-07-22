import type { CreatureDef } from '../types';

// Peau-de-Loup (ZI) — loup-garou : « l'humain sort à coups de griffes », Frénésie permanente,
// Griffes + Morsure. Corps humanoïde musclé à TÊTE DE LOUP (perso.head='chien' = canidé) + pelage
// gris-brun. Bipède anthropomorphe (PAS le quadrupède loup ni le Varghulf ailé). Sans ce def, le
// record (sp=—) était rendu en Humain générique tenant une épée.
export const creature: CreatureDef = {
  label: 'Peau-de-Loup',
  id: "peau-de-loup",
  plan: 'biped',
  perso: {
    head: 'chien', // tête de canidé sur corps humanoïde
    gabarit: 'brute', // carrure massive et voûtée
    tenue: 'nu', // bête féroce : pas d'armure/casque, le pelage à nu
    extremites: 'griffues', // « l'humain sort à coups de griffes » (creatures.json: Griffes, #736 Lot 2) ; race Humain partagée
    colors: { peau: '#6a5e4c', cheveux: '#352c22' }, // pelage gris-brun
  },
};

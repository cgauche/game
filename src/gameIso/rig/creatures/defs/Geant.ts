import type { CreatureDef } from '../types';

// Géant : humanoïde COLOSSAL → bipède. Sa stature vient de sa TAILLE (Énorme → sizeTokenScale) ;
// le perso.scale n'exprime que la NUANCE intra-catégorie (il dépasse un « Énorme » standard).
// L'ex-scale 2.4 datait d'AVANT le système de Taille et se MULTIPLIAIT avec lui (rendu ×6.2 !).
// Brute en habits dépareillés (tenue 'Géant' : pagne + baudrier + blasons pillés) sur carrure
// massive ('brute'). Recatégorisé depuis monolithique (jalon 3).
export const creature: CreatureDef = {
  label: 'Géant',
  id: "geant",
  plan: 'biped',
  // Espèce NON-canonique : baseSpeciesOf('Géant')→'Humain'. Sa config distincte (M, carrure brute,
  // tenue de géant pillard) vit sur le perso, pour ne pas polluer la race Humain partagée.
  perso: { tenue: 'geant', gabarit: 'brute', sex: 'M', scale: 1.2 }, // nuance intra-Énorme (final ≈ ×2.4 humain)
};

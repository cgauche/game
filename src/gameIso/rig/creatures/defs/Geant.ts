import type { CreatureDef } from '../types';

// Géant : humanoïde COLOSSAL → bipède. Sa stature vient de sa TAILLE (Énorme → sizeTokenScale) ;
// le perso.scale n'exprime que la NUANCE intra-catégorie (il dépasse un « Énorme » standard).
// L'ex-scale 2.4 datait d'AVANT le système de Taille et se MULTIPLIAIT avec lui (rendu ×6.2 !).
// Brute torse-nu (tenue Nu). Recatégorisé depuis monolithique (jalon 3).
export const creature: CreatureDef = {
  name: 'Géant',
  plan: 'biped',
  matchPriority: 46,
  // Espèce NON-canonique : baseSpeciesOf('Géant')→'Humain'. Sa config distincte (M, torse nu)
  // vit sur le perso, pour ne pas polluer la race Humain partagée.
  perso: { tenue: 'Nu', sex: 'M', scale: 1.2 }, // nuance intra-Énorme (final ≈ ×2.4 humain)
};

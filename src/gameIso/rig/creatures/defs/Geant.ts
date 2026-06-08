import type { CreatureDef } from '../types';

// Géant : humanoïde COLOSSAL → bipède à grande échelle (token-scale ×2.4, sinon il déborderait
// la boîte 120×150). Brute torse-nu (career Nu). Recatégorisé depuis monolithique (jalon 3 :
// pièce manquante = l'échelle de token bipède, ajoutée comme pour quad/ailé).
export const creature: CreatureDef = {
  name: 'Géant',
  plan: 'biped',
  matchPriority: 46,
  match: '\\bgeant',
  // Espèce NON-canonique : baseSpeciesOf('Géant')→'Humain'. Sa config distincte (échelle ×2.4,
  // M, torse nu) vit sur le perso, pour ne pas polluer la race Humain partagée.
  perso: { career: 'Nu', sex: 'M', scale: 2.4 }, // brute torse-nu (M par défaut, pas de couettes)
};

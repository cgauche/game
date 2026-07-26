import type { CreatureDef } from '../types';

// Géant : humanoïde COLOSSAL → bipède. Sa stature vient de sa TAILLE (Énorme → sizeTokenScale) ;
// le perso.scale n'exprime que la NUANCE intra-catégorie (il dépasse un « Énorme » standard).
// Un `scale` de def se MULTIPLIE avec `sizeTokenScale` : il reste donc proche de 1.
// Brute en habits dépareillés (tenue 'Géant' : pagne + baudrier + blasons pillés) sur carrure
// massive ('brute').
export const creature: CreatureDef = {
  label: 'Géant',
  id: "geant",
  plan: 'biped',
  // Espèce NON-canonique : baseSpeciesOf('Géant')→'Humain'. Sa config distincte (M, carrure brute,
  // tenue de géant pillard) vit sur le perso, pour ne pas polluer la race Humain partagée — y
  // compris `extremites` : sa tenue 'geant' ne chausse pas (#736 Lot 1), mais Humain reste 'lisses'
  // (défaut pour les Humains qui retombent sur la tenue 'Nu') → surcharge ICI, pas sur la race.
  perso: { tenue: 'geant', gabarit: 'brute', sex: 'M', scale: 1.2, extremites: 'griffues' }, // nuance intra-Énorme (final ≈ ×2.4 humain)
};

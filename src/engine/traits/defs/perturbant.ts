import type { TraitDef } from '../types';

// LDB 85 p.341 : « Toute personne se trouvant à un nombre de mètres égal à son Bonus d'Endurance
// obtient une pénalité de -20 à tous ses Tests » (non cumulable entre Perturbants).
export const trait: TraitDef = { key: 'Perturbant', perturbingAura: true };

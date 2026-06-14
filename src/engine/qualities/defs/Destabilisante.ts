import type { QualityDef } from '../types';

// Déstabilisante (Aux Armes p.89) : après une touche, dépense de 2 Avantages + Test opposé
// Force/Athlétisme ; en cas de victoire la cible est mise À Terre (montée : chute de 2 m puis À Terre).
export const quality: QualityDef = {
  key: 'Déstabilisante', type: 'Atout', subType: 'Arme',
  onHitKnockdown: { advantageCost: 2, char: 'F', skill: 'Athlétisme', condition: 'À Terre' },
};

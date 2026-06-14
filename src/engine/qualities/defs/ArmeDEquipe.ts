import type { QualityDef } from '../types';

// Arme d'équipe (Indice) (Aux Armes p.124) : arme de siège conçue pour une équipe d'Indice servants.
// Notre jeu ne modélise pas d'équipe → toujours maniée en sous-effectif (1 servant) : Indice ≥ 3 →
// Imprécise (-1 DR), Indice ≥ 4 → Dangereuse (Maladresse sur 9). Lu par attackDRAdjust/dangerousNine.
export const quality: QualityDef = { key: "Arme d'équipe", type: 'Défaut', subType: 'Arme', crewedTeam: true };

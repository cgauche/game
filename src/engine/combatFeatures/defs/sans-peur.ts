import type { CombatFeature } from '../types';

// LDB 10 l.859 « Sans Peur (Ennemi) » : « Avec un seul Test de Calme Accessible (+20), vous pouvez
// ignorer les effets d'Intimidation, de Peur ou de Terreur de l'ennemi spécifié quand vous le
// rencontrez. » Modélisé : immunité Peur/Terreur vs l'Ennemi spécifié (ctx.spec, groupMatch) —
// le Test d'activation est supposé réussi (simplification, comme les soins prolongés) ;
// l'Intimidation n'est pas modélisée. Accordé SANS spec par un sort (Flambeau de Vertu,
// Cœurs ardents — LDB 42/47) → toutes sources.
export const feature: CombatFeature = { key: 'Sans peur', kind: 'talent', fearImmune: true };

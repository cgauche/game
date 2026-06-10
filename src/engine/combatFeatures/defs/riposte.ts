import type { CombatFeature } from '../types';

// LDB 10 : « Si votre arme possède l'Atout Rapide, vous pouvez infliger des Dégâts quand vous êtes attaqué, comme si c'était votre Action. »
export const feature: CombatFeature = { key: 'Riposte', kind: 'talent', riposte: true };

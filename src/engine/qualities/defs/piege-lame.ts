import type { QualityDef } from '../types';

// LDB 62 l.292-294 : « Si vous obtenez un Critique quand vous vous défendez contre une attaque
// provenant d'une arme possédant une lame, vous pouvez choisir de la piéger plutôt que de causer
// un Coup Critique. Si vous choisissez cela, effectuez un Test opposé de Force, en ajoutant votre
// DR obtenu au précédent Test de Corps à corps. Si vous l'emportez, votre adversaire laisse tomber
// la lame qui lui est arrachée. Si vous obtenez un Succès Stupéfiant, […] la force de votre
// manœuvre brise la lame à moins qu'elle ne possède l'Atout Incassable. »
export const quality: QualityDef = { key: 'Piège-lame', type: 'Atout', subType: 'Arme', bladeTrap: true };

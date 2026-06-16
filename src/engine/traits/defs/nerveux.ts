import type { TraitDef } from '../types';

// LDB 85 p.340 : « facilement effrayée par la magie ou les bruits forts → +3 État Brisé. » Effet
// migré en donnée éditable (`traits.json` → effects onStartled) ; def réduite à la clé canonique.
export const trait: TraitDef = { key: 'Nerveux' };

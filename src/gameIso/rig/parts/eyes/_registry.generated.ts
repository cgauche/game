// ⚠️ GÉNÉRÉ par scripts/gen-registry.mjs — NE PAS ÉDITER À LA MAIN.
// Ajouter une entrée = déposer un fichier dans defs/ puis `npm run gen`.
import type { EyeDef } from './types';
import { eye as e0 } from './defs/cache-oeil';
import { eye as e1 } from './defs/caprin';
import { eye as e2 } from './defs/chat';
import { eye as e3 } from './defs/enorme';
import { eye as e4 } from './defs/noir';
import { eye as e5 } from './defs/perdu';
import { eye as e6 } from './defs/reptilien';
import { eye as e7 } from './defs/rouge';
import { eye as e8 } from './defs/verre';

export const EYE_DEFS: EyeDef[] = [e0, e1, e2, e3, e4, e5, e6, e7, e8];

/** Union GÉNÉRÉE des `id` déclarés dans les defs — le typage réel des consommateurs. */
export type EyeId =
  | 'cache-oeil'
  | 'caprin'
  | 'chat'
  | 'enorme'
  | 'noir'
  | 'perdu'
  | 'reptilien'
  | 'rouge'
  | 'verre';

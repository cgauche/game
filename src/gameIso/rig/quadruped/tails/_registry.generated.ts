// GÉNÉRÉ par scripts/gen-registry.mjs — NE PAS ÉDITER À LA MAIN.
// Ajouter une entrée = déposer un fichier dans defs/ puis `npm run gen`.
import type { QuadTailDef } from './types';
import { quadTail as e0 } from './defs/courte';
import { quadTail as e1 } from './defs/crin';
import { quadTail as e2 } from './defs/dard';
import { quadTail as e3 } from './defs/dressee';
import { quadTail as e4 } from './defs/enroulee';
import { quadTail as e5 } from './defs/fouet';
import { quadTail as e6 } from './defs/leonine';
import { quadTail as e7 } from './defs/nue';
import { quadTail as e8 } from './defs/reptile';
import { quadTail as e9 } from './defs/sans';
import { quadTail as e10 } from './defs/touffe-basse';
import { quadTail as e11 } from './defs/touffe';

export const QUAD_TAIL_DEFS: QuadTailDef[] = [e0, e1, e2, e3, e4, e5, e6, e7, e8, e9, e10, e11];

/** Union GÉNÉRÉE des `key` déclarés dans les defs — le typage réel des consommateurs. */
export type QuadTailId =
  | 'courte'
  | 'crin'
  | 'dard'
  | 'dressee'
  | 'enroulee'
  | 'fouet'
  | 'leonine'
  | 'nue'
  | 'reptile'
  | 'sans'
  | 'touffe'
  | 'touffe-basse';

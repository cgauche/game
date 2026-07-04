// ⚠️ GÉNÉRÉ par scripts/gen-registry.mjs — NE PAS ÉDITER À LA MAIN.
// Ajouter une entrée = déposer un fichier dans defs/ puis `npm run gen`.
import type { ProsthesisDef } from './types';
import { prosthesis as e0 } from './defs/cecite';
import { prosthesis as e1 } from './defs/crochet';
import { prosthesis as e2 } from './defs/jambe-de-bois';
import { prosthesis as e3 } from './defs/main-mecanique';
import { prosthesis as e4 } from './defs/moignon';
import { prosthesis as e5 } from './defs/nez-ampute';
import { prosthesis as e6 } from './defs/nez-dore';

export const PROSTHESIS_DEFS: ProsthesisDef[] = [e0, e1, e2, e3, e4, e5, e6];

/** Union GÉNÉRÉE des `id` déclarés dans les defs — le typage réel des consommateurs. */
export type ProsthesisId =
  | 'cecite'
  | 'crochet'
  | 'jambe-de-bois'
  | 'main-mecanique'
  | 'moignon'
  | 'nez-ampute'
  | 'nez-dore';

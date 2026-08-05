// GÉNÉRÉ par scripts/gen-registry.mjs — NE PAS ÉDITER À LA MAIN.
// Ajouter une entrée = déposer un fichier dans defs/ puis `npm run gen`.
import type { QuadManeDef } from './types';
import { quadMane as e0 } from './defs/crin';
import { quadMane as e1 } from './defs/hirsute';
import { quadMane as e2 } from './defs/sans';

export const QUAD_MANE_DEFS: QuadManeDef[] = [e0, e1, e2];

/** Union GÉNÉRÉE des `key` déclarés dans les defs — le typage réel des consommateurs. */
export type QuadManeId =
  | 'crin'
  | 'hirsute'
  | 'sans';

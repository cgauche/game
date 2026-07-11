// GÉNÉRÉ par scripts/gen-registry.mjs — NE PAS ÉDITER À LA MAIN.
// Ajouter une entrée = déposer un fichier dans defs/ puis `npm run gen`.
import type { WingDef } from './types';
import { wing as e0 } from './defs/cuir';
import { wing as e1 } from './defs/plumes';

export const WING_DEFS: WingDef[] = [e0, e1];

/** Union GÉNÉRÉE des `id` déclarés dans les defs — le typage réel des consommateurs. */
export type WingId =
  | 'cuir'
  | 'plumes';

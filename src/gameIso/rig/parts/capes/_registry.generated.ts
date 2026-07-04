// ⚠️ GÉNÉRÉ par scripts/gen-registry.mjs — NE PAS ÉDITER À LA MAIN.
// Ajouter une entrée = déposer un fichier dans defs/ puis `npm run gen`.
import type { CapeDef } from './types';
import { cape as e0 } from './defs/voyage';

export const CAPE_DEFS: CapeDef[] = [e0];

/** Union GÉNÉRÉE des `id` déclarés dans les defs — le typage réel des consommateurs. */
export type CapeId =
  | 'voyage';

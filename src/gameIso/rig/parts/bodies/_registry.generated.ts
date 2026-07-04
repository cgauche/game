// ⚠️ GÉNÉRÉ par scripts/gen-registry.mjs — NE PAS ÉDITER À LA MAIN.
// Ajouter une entrée = déposer un fichier dans defs/ puis `npm run gen`.
import type { BodyDef } from './types';
import { body as e0 } from './defs/nu';

export const BODY_DEFS: BodyDef[] = [e0];

/** Union GÉNÉRÉE des `id` déclarés dans les defs — le typage réel des consommateurs. */
export type BodyId =
  | 'nu';

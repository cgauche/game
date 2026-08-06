// GÉNÉRÉ par scripts/gen-registry.mjs — NE PAS ÉDITER À LA MAIN.
// Ajouter une entrée = déposer un fichier dans defs/ puis `npm run gen`.
import type { QuadHarnaisDef } from './types';
import { quadHarnais as e0 } from './defs/sellerie-imperiale';

export const QUAD_HARNAIS_DEFS: QuadHarnaisDef[] = [e0];

/** Union GÉNÉRÉE des `id` déclarés dans les defs — le typage réel des consommateurs. */
export type QuadHarnaisId =
  | 'sellerie-imperiale';

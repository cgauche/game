// GÉNÉRÉ par scripts/gen-registry.mjs — NE PAS ÉDITER À LA MAIN.
// Ajouter une entrée = déposer un fichier dans defs/ puis `npm run gen`.
import type { QuadHarnaisDef } from './types';
import { quadHarnais as e0 } from './defs/collier-dore-pegase';
import { quadHarnais as e1 } from './defs/harnais-de-guerre-canin';
import { quadHarnais as e2 } from './defs/sellerie-imperiale';

export const QUAD_HARNAIS_DEFS: QuadHarnaisDef[] = [e0, e1, e2];

/** Union GÉNÉRÉE des `id` déclarés dans les defs — le typage réel des consommateurs. */
export type QuadHarnaisId =
  | 'collier-dore-pegase'
  | 'harnais-de-guerre-canin'
  | 'sellerie-imperiale';

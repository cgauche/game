/** Type d'une entrée du registre de schémas (`_registry.generated.ts`) — 1 dataset `src/data/*.json`. */
import type { z } from 'zod';

export interface SchemaDef {
  /** Nom de fichier du dataset (`src/data/<file>`), tel qu'exporté par le module `defs/<nom>.ts`. */
  file: string;
  /** Schéma zod STRICT du dataset (racine = le tableau/objet exact du JSON). */
  schema: z.ZodTypeAny;
}

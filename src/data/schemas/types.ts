/** Type d'une entrée du registre de schémas (`_registry.generated.ts`) — 1 dataset authoré. */
import type { z } from 'zod';

/** Racine d'un document authoré. Le registre couvre `src/data` (catalogues de jeu) ; la racine
 *  `src/scenes` (documents de campagne) est déclarée ici et peuplée quand le schéma de scène entre
 *  au registre (#1466). */
export type RacineDocument = 'src/data' | 'src/scenes';

export interface SchemaDef {
  /** Nom de fichier du dataset (`<root>/<file>`), tel qu'exporté par le module `defs/<nom>.ts`. */
  file: string;
  /** Racine du dataset — émise par `scripts/gen-registry.mjs`, jamais déclarée par le def. */
  root: RacineDocument;
  /** Schéma zod STRICT du dataset (racine = le tableau/objet exact du JSON). */
  schema: z.ZodTypeAny;
}

/**
 * Schéma de `obsessions.json` — Tableau des Obsessions (EDOC 12, folio 69). Fichier NON-tableau
 * (objet `{ source, ref, table }`), dérivé de `ObsessionTableFile`/`ObsessionEntry`
 * (`src/data/obsessions.ts:14-24`). `source` a la MÊME forme que `sourceRefSchema` mais le type
 * consommateur (`{ book: string; page: number }` inline, pas `import(...).SourceRef`) — repris
 * directement (candidat à mutualisation avec `sourceRefSchema`, cf. rendu final).
 */
import { z } from 'zod';
import { sourceRefSchema } from '../common';

export const file = 'obsessions.json';

export const schema = z.strictObject({
  source: sourceRefSchema,
  ref: z.string(),
  table: z.array(
    z.strictObject({
      id: z.string(),
      min: z.number(),
      max: z.number(),
      label: z.string(),
    }),
  ),
});

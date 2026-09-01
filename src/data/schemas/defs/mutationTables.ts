/**
 * Schéma de `mutationTables.json` — Tableaux de Corruption (LDB 19, EDOC…), miroir de `MutationTable`
 * (`src/data/mutations.ts`). Plages d100 → référence de mutation par id (`ranges[].mutation`).
 * Inventaire réel (17 tables) : `id`/`label`/`ranges[{min,max,mutation}]` seulement.
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { plageSchema } from '../grammaire/valeurs';

export const file = 'mutationTables.json';
export const famille = 'entite';

const doc = document(
  'mutationTables',
  famille,
  {
    ranges: z.array(
      z.strictObject({
        ...plageSchema.shape,
        /** id d'une entrée de `mutations.json` (résolu par `rollMutation`/`BY_ID`). */
        mutation: z.string(),
      }),
    ),
  },
  {
    ranges: { label: 'Plages de tirage', hint: 'Bandes d100 associant chacune une plage à une Mutation par identifiant' },
  },
  {
    codex: { keys: ['mutationTables'] },
    edit: { dataset: 'mutationTables' },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;

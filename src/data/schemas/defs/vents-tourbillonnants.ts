/**
 * Schéma de `vents-tourbillonnants.json` — Tableau des Vents Tourbillonnants (LDB 46 l.183-190),
 * consommé par `src/engine/windsOfMagic.ts` (`{ table: WindsEntry[] }`, lookup `findTableEntry` sur 1d10).
 */
import { z } from 'zod';
import { document } from '../grammaire/document';

export const file = 'vents-tourbillonnants.json';
export const famille = 'config';

const doc = document(
  'vents-tourbillonnants',
  famille,
  {
    entries: z.array(
      z.strictObject({
        id: z.string(),
        min: z.number(),
        max: z.number(),
        mod: z.number(),
        label: z.string(),
      }),
    ),
  },
  {
    entries: { label: 'Force des Vents', hint: 'Rangées du 1d10, bornes min/max inclusives ; `mod` = modificateur d’Incantation' },
  },
  {
    codex: { keys: ['ventsTourbillonnants'] },
    edit: {
      none: 'édité par TABLEAU NICHÉ : la catégorie Codex `ventsTourbillonnants` édite le champ `entries` de ce document, jamais le document entier (CodexEdit.CATEGORY_DATASET)',
    },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

/**
 * Schéma de `rencontres-edoc.json` — Rencontres de voyage EDOC 8 (d100, 3 tables), miroir de
 * `TravelTableEntry` (`src/engine/travelTables.ts`) + l'enveloppe `{ id, label, die, source,
 * tables }` (voir `EncounterCategory` de `travelTables.ts`).
 *
 * `travelTableEntrySchema` est PROMU dans `grammaire/mecanique.ts` — MÊME forme que les entrées de
 * `incidents-monture.json`/`problemes-vehicule.json` (les trois miroitent `TravelTableEntry`).
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { travelTableEntrySchema } from '../grammaire/mecanique';

export const file = 'rencontres-edoc.json';
export const famille = 'config';

const doc = document(
  'rencontres-edoc',
  famille,
  {
    die: z.string(),
    tables: z.strictObject({
      positives: z.array(travelTableEntrySchema),
      fortuites: z.array(travelTableEntrySchema),
      dangereuses: z.array(travelTableEntrySchema),
    }),
  },
  {
    die: { label: 'Dé de tirage', hint: 'Expression du dé lancé pour tirer une rencontre (d100)' },
    tables: { label: 'Rencontres par catégorie', hint: 'Trois tables sœurs : positives, fortuites, dangereuses' },
  },
  {
    codex: { keys: ['rencontresPositives', 'rencontresFortuites', 'rencontresDangereuses'] },
    edit: {
      none: 'édité par TABLEAUX NICHÉS : les 3 catégories Codex `rencontresPositives`/`rencontresFortuites`/`rencontresDangereuses` éditent chacune une sous-table de `tables`, jamais le document entier (CodexEdit.CATEGORY_DATASET)',
    },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

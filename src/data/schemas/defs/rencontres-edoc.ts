/**
 * Schéma de `rencontres-edoc.json` — Rencontres de voyage EDOC 8 (d100, 3 tables), miroir de
 * `TravelTableEntry` (`src/engine/travelTables.ts`) + l'enveloppe `{ id, label, die, source,
 * tables }` (voir `EncounterCategory` de `travelTables.ts`).
 *
 * `travelTableEntrySchema` est PROMU dans `grammaire/mecanique.ts` — MÊME forme que les entrées de
 * `incidents-monture.json`/`problemes-vehicule.json` (les trois miroitent `TravelTableEntry`).
 */
import { z } from 'zod';
import { sourceRefSchema } from '../grammaire/valeurs';
import { travelTableEntrySchema } from '../grammaire/mecanique';

export const file = 'rencontres-edoc.json';
export const famille = 'table';

export const schema = z.strictObject({
  id: z.string(),
  label: z.string(),
  die: z.string(),
  source: sourceRefSchema,
  tables: z.strictObject({
    positives: z.array(travelTableEntrySchema),
    fortuites: z.array(travelTableEntrySchema),
    dangereuses: z.array(travelTableEntrySchema),
  }),
});

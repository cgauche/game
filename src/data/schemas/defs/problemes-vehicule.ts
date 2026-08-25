/**
 * Schéma de `problemes-vehicule.json` — Problèmes de véhicule EDOC 7 (d100), miroir de la forme
 * enveloppe `TravelTable` (`src/engine/travelTables.ts`) portant des `TravelTableEntry`
 * (`.../travelTables.ts`), PROMU dans `grammaire/mecanique.ts` (`travelTableEntrySchema`/`stageOutcomeSchema`
 * — partagé avec `rencontres-edoc.ts`/`incidents-monture.ts`).
 */
import { z } from 'zod';
import { sourceRefSchema } from '../grammaire/valeurs';
import { travelTableEntrySchema } from '../grammaire/mecanique';

export const file = 'problemes-vehicule.json';
export const famille = 'table';

export const schema = z.strictObject({
  id: z.string(),
  label: z.string(),
  die: z.string(),
  source: sourceRefSchema,
  entries: z.array(travelTableEntrySchema),
});

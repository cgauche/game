/**
 * Schéma de `incidents-monture.json` — Incidents de monte EDOC 7 (d100), miroir de la forme
 * enveloppe `TravelTable` (`src/engine/travelTables.ts`) portant des `TravelTableEntry`
 * (`.../travelTables.ts`), PROMU dans `common.ts` (`travelTableEntrySchema`/`stageOutcomeSchema`
 * — partagé avec `rencontres-edoc.ts`/`problemes-vehicule.ts`). Aucune entrée ne
 * porte `stageOutcome`/`vehicleWounds`/`occupantOps` (propres aux deux autres tables) — champs quand
 * même déclarés `.optional()` dans le schéma commun, sans conséquence ici.
 */
import { z } from 'zod';
import { sourceRefSchema, travelTableEntrySchema } from '../common';

export const file = 'incidents-monture.json';

export const schema = z.strictObject({
  id: z.string(),
  label: z.string(),
  die: z.string(),
  source: sourceRefSchema,
  entries: z.array(travelTableEntrySchema),
});

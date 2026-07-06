/**
 * Schéma de `problemes-vehicule.json` — Problèmes de véhicule EDOC ch.4 (d100), miroir de la forme
 * enveloppe `TravelTable` (`src/engine/travelTables.ts:28`) portant des `TravelTableEntry`
 * (`.../travelTables.ts:15-26`), PROMU dans `common.ts` (`travelTableEntrySchema`/`stageOutcomeSchema`
 * — ex-dupliqué à l'identique dans `rencontres-edoc.ts`/`incidents-monture.ts`).
 */
import { z } from 'zod';
import { sourceRefSchema, travelTableEntrySchema } from '../common';

export const file = 'problemes-vehicule.json';

export const schema = z.strictObject({
  id: z.string(),
  label: z.string(),
  die: z.string(),
  source: sourceRefSchema,
  entries: z.array(travelTableEntrySchema),
});

export type ProblemesVehiculeData = z.infer<typeof schema>;

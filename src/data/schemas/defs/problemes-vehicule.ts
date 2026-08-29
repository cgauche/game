/**
 * Schéma de `problemes-vehicule.json` — Problèmes de véhicule EDOC 7 (d100), miroir de la forme
 * enveloppe `TravelTable` (`src/engine/travelTables.ts`) portant des `TravelTableEntry`
 * (`.../travelTables.ts`), PROMU dans `grammaire/mecanique.ts` (`travelTableEntrySchema`/`stageOutcomeSchema`
 * — partagé avec `rencontres-edoc.ts`/`incidents-monture.ts`).
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { travelTableEntrySchema } from '../grammaire/mecanique';

export const file = 'problemes-vehicule.json';
export const famille = 'config';

const doc = document(
  'problemes-vehicule',
  famille,
  {
    die: z.string(),
    entries: z.array(travelTableEntrySchema),
  },
  {
    die: { label: 'Dé de tirage', hint: 'Expression du dé lancé pour tirer un problème (d100)' },
    entries: { label: 'Problèmes de véhicule', hint: 'Rangées de la table, bornes min/max inclusives sur le dé de tirage' },
  },
  {
    codex: { keys: ['problemesVehicule'] },
    edit: { niche: { categories: ['problemesVehicule'] } },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;

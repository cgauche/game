/**
 * Schéma de `structure-criticals.json` — Blessures critiques sur une Structure (Aux Armes, p.120).
 * Reflet de `StructureCritEntry` (`src/data/structureCriticals.ts`), 3ᵉ famille du modèle de coque
 * (Structure/Véhicule/Navire, AA 10 l.13/116).
 */
import { z } from 'zod';
import { sourceRefSchema } from '../common';

export const file = 'structure-criticals.json';

const structureCritEntrySchema = z.strictObject({
  min: z.number(),
  max: z.number(),
  id: z.string(),
  label: z.string(),
  /** Blessures supplémentaires de la Structure (0 = Triviale ; null = détruite). */
  wounds: z.union([z.number(), z.null()]),
  trivial: z.boolean().optional(),
  destroyed: z.boolean().optional(),
  note: z.string(),
});

export const schema = z.strictObject({
  id: z.string(),
  label: z.string(),
  die: z.string(),
  source: sourceRefSchema,
  entries: z.array(structureCritEntrySchema),
});

export type StructureCriticalsData = z.infer<typeof schema>;

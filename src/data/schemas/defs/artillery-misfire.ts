/**
 * Schéma de `artillery-misfire.json` — Incidents de Tir d'Artillerie par Salve (Aux Armes, AA
 * l.3940-3946). Reflet de `ArtilleryMisfireEntry` (`src/data/artilleryMisfire.ts`), table SŒUR de
 * `structure-criticals.json` (même patron `{id,label,die,source,entries}`).
 */
import { z } from 'zod';
import { sourceRefSchema } from '../common';

export const file = 'artillery-misfire.json';

const artilleryMisfireEntrySchema = z.strictObject({
  min: z.number(),
  max: z.number(),
  id: z.string(),
  name: z.string(),
  location: z.enum(['brasPrincipal', 'random']),
  /** L'effet se répète une fois PAR Indice de Salve restant (lignes 8-10). */
  perSalveIndex: z.boolean(),
  /** La pièce d'artillerie est détruite (lignes 1-9). */
  destroyed: z.boolean(),
  /** Ligne 10, « tir perdu » — pas de Dégâts directs à l'équipe. */
  strayFire: z.boolean().optional(),
  note: z.string(),
});

export const schema = z.strictObject({
  id: z.string(),
  label: z.string(),
  die: z.string(),
  source: sourceRefSchema,
  entries: z.array(artilleryMisfireEntrySchema),
});

export type ArtilleryMisfireData = z.infer<typeof schema>;

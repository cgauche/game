/**
 * Schéma de `river-criticals.json` — Critiques de coque fluviale (Mort sur le Reik Compagnon ch.5,
 * p.29). MÊME patron que `ship-criticals.json` (`ShipCritSet`, `src/data/shipCriticals.ts`), PROMU
 * dans `common.ts` (`shipCritEntrySchema`/`shipCrewTestSchema`), mais 5 Localisations DISTINCTES
 * (greement/avirons/gouvernail/coque/superstructure — pas de cargaison ni d'équipements côté
 * fluvial) et sans `die` (absent du JSON, à la différence du jeu MDG).
 */
import { z } from 'zod';
import { gameOpSchema, sourceRefSchema, shipCritEntrySchema } from '../common';

export const file = 'river-criticals.json';

export const schema = z.strictObject({
  id: z.string(),
  label: z.string(),
  source: sourceRefSchema,
  shrapnelHit: z.array(gameOpSchema),
  tables: z.strictObject({
    greement: z.array(shipCritEntrySchema),
    avirons: z.array(shipCritEntrySchema),
    gouvernail: z.array(shipCritEntrySchema),
    coque: z.array(shipCritEntrySchema),
    superstructure: z.array(shipCritEntrySchema),
  }),
});

export type RiverCriticalsData = z.infer<typeof schema>;

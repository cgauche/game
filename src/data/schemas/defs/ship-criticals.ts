/**
 * Schéma de `ship-criticals.json` — Critiques de coque navale (MDG 13, p.124). Reflet de
 * `ShipCritEntry`/`ShipCritSet` (`src/data/shipCriticals.ts`), PROMU dans `common.ts`
 * (`shipCritEntrySchema`/`shipCrewTestSchema` — ex-dupliqué à l'identique dans `river-criticals.ts`).
 * Jeu MDG : 5 Localisations (cargaison/greement/coque/avirons/equipements).
 */
import { z } from 'zod';
import { gameOpSchema, sourceRefSchema, shipCritEntrySchema } from '../common';

export const file = 'ship-criticals.json';

export const schema = z.strictObject({
  id: z.string(),
  label: z.string(),
  die: z.string(),
  source: sourceRefSchema,
  shrapnelHit: z.array(gameOpSchema),
  tables: z.strictObject({
    cargaison: z.array(shipCritEntrySchema),
    greement: z.array(shipCritEntrySchema),
    coque: z.array(shipCritEntrySchema),
    avirons: z.array(shipCritEntrySchema),
    equipements: z.array(shipCritEntrySchema),
  }),
});

export type ShipCriticalsData = z.infer<typeof schema>;

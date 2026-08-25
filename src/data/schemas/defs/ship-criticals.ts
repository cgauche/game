/**
 * Schéma de `ship-criticals.json` — Critiques de coque navale (MDG 13, p.124). Reflet de
 * `ShipCritEntry`/`ShipCritSet` (`src/data/shipCriticals.ts`), PROMU dans `common.ts`
 * (`shipCritEntrySchema`/`shipCrewTestSchema` — partagé avec `river-criticals.ts`).
 * Jeu MDG : 5 Localisations (cargaison/greement/coque/avirons/equipements).
 */
import { z } from 'zod';
import { sourceRefSchema } from '../grammaire/valeurs';
import { gameOpSchema, shipCritEntrySchema } from '../grammaire/mecanique';

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

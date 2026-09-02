/**
 * Schéma de `river-criticals.json` — Critiques de coque fluviale (Mort sur le Reik Compagnon ch.5,
 * p.29). MÊME patron que `ship-criticals.json` (`ShipCritSet`, `src/data/shipCriticals.ts`), PROMU
 * dans `grammaire/mecanique.ts` (`shipCritEntrySchema`/`shipCrewHitSchema`), mais 5 Localisations DISTINCTES
 * (greement/avirons/gouvernail/coque/superstructure — pas de cargaison ni d'équipements côté
 * fluvial) et sans `die` (absent du JSON, à la différence du jeu MDG).
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { gameOpSchema, shipCritEntrySchema } from '../grammaire/mecanique';

export const file = 'river-criticals.json';
export const famille = 'config';

const doc = document(
  'river-criticals',
  famille,
  {
    shrapnelHit: z.array(gameOpSchema),
    tables: z.strictObject({
      greement: z.array(shipCritEntrySchema),
      avirons: z.array(shipCritEntrySchema),
      gouvernail: z.array(shipCritEntrySchema),
      coque: z.array(shipCritEntrySchema),
      superstructure: z.array(shipCritEntrySchema),
    }),
  },
  {
    shrapnelHit: { label: 'Éclats', hint: 'Effets posés sur les occupants touchés par les éclats' },
    tables: { label: 'Critiques par Localisation', hint: 'Cinq tables sœurs : gréement, avirons, gouvernail, coque, superstructure' },
  },
  {
    codex: { keys: ['riverCriticalsGreement', 'riverCriticalsAvirons', 'riverCriticalsGouvernail', 'riverCriticalsCoque', 'riverCriticalsSuperstructure'] },
    edit: { niche: { categories: ['riverCriticalsGreement', 'riverCriticalsAvirons', 'riverCriticalsGouvernail', 'riverCriticalsCoque', 'riverCriticalsSuperstructure'] } },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;

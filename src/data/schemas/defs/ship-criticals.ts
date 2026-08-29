/**
 * Schéma de `ship-criticals.json` — Critiques de coque navale (MDG 13, p.124). Reflet de
 * `ShipCritEntry`/`ShipCritSet` (`src/data/shipCriticals.ts`), PROMU dans `grammaire/mecanique.ts`
 * (`shipCritEntrySchema`/`shipCrewTestSchema` — partagé avec `river-criticals.ts`).
 * Jeu MDG : 5 Localisations (cargaison/greement/coque/avirons/equipements).
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { gameOpSchema, shipCritEntrySchema } from '../grammaire/mecanique';

export const file = 'ship-criticals.json';
export const famille = 'config';

const doc = document(
  'ship-criticals',
  famille,
  {
    die: z.string(),
    shrapnelHit: z.array(gameOpSchema),
    tables: z.strictObject({
      cargaison: z.array(shipCritEntrySchema),
      greement: z.array(shipCritEntrySchema),
      coque: z.array(shipCritEntrySchema),
      avirons: z.array(shipCritEntrySchema),
      equipements: z.array(shipCritEntrySchema),
    }),
  },
  {
    die: { label: 'Dé de tirage', hint: 'Expression du dé lancé pour tirer un critique de coque' },
    shrapnelHit: { label: 'Éclats', hint: 'Effets posés sur les occupants touchés par les éclats' },
    tables: { label: 'Critiques par Localisation', hint: 'Cinq tables sœurs : cargaison, gréement, coque, avirons, équipements' },
  },
  {
    codex: { keys: ['shipCriticalsCargaison', 'shipCriticalsGreement', 'shipCriticalsCoque', 'shipCriticalsAvirons', 'shipCriticalsEquipements'] },
    edit: { niche: { categories: ['shipCriticalsCargaison', 'shipCriticalsGreement', 'shipCriticalsCoque', 'shipCriticalsAvirons', 'shipCriticalsEquipements'] } },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;

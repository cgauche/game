/**
 * Schéma de `artillery-misfire.json` — Incidents de Tir d'Artillerie par Salve (Aux Armes, AA
 * l.3940-3946). Reflet de `ArtilleryMisfireEntry` (`src/data/artilleryMisfire.ts`), table SŒUR de
 * `structure-criticals.json` (même patron `{enveloppe, die, entries}`).
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { plageSchema } from '../grammaire/valeurs';

export const file = 'artillery-misfire.json';
export const famille = 'config';

const artilleryMisfireEntrySchema = z.strictObject({
  ...plageSchema.shape,
  id: z.string(),
  label: z.string(),
  location: z.enum(['brasPrincipal', 'random']),
  /** L'effet se répète une fois PAR Indice de Salve restant (lignes 8-10). */
  perSalveIndex: z.boolean(),
  /** La pièce d'artillerie est détruite (lignes 1-9). */
  destroyed: z.boolean(),
  /** Ligne 10, « tir perdu » — pas de Dégâts directs à l'équipe. */
  strayFire: z.boolean().optional(),
  note: z.string(),
});

const doc = document(
  'artillery-misfire',
  famille,
  {
    die: z.string(),
    entries: z.array(artilleryMisfireEntrySchema),
  },
  {
    die: { label: 'Dé de tirage', hint: 'Expression du dé lancé pour tirer un incident (ex. « 1d10 »)' },
    entries: { label: 'Incidents', hint: 'Rangées de la table, bornes min/max inclusives sur le dé de tirage' },
  },
  {
    codex: { keys: ['artilleryMisfire'] },
    edit: { niche: { categories: ['artilleryMisfire'] } },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;

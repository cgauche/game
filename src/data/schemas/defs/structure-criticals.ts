/**
 * Schéma de `structure-criticals.json` — Blessures critiques sur une Structure (Aux Armes, p.120).
 * Reflet de `StructureCritEntry` (`src/data/structureCriticals.ts`), 3ᵉ famille du modèle de coque
 * (Structure/Véhicule/Navire, AA 10 l.13/116).
 */
import { z } from 'zod';
import { document } from '../grammaire/document';

export const file = 'structure-criticals.json';
export const famille = 'config';

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

const doc = document(
  'structure-criticals',
  famille,
  {
    die: z.string(),
    entries: z.array(structureCritEntrySchema),
  },
  {
    die: { label: 'Dé de tirage', hint: 'Expression du dé lancé pour tirer un critique de Structure' },
    entries: { label: 'Critiques de Structure', hint: 'Rangées de la table, bornes min/max inclusives sur le dé de tirage' },
  },
  {
    codex: { keys: ['structureCriticals'] },
    edit: {
      none: 'édité par TABLEAU NICHÉ : la catégorie Codex `structureCriticals` édite le champ `entries` de ce document, jamais le document entier (CodexEdit.CATEGORY_DATASET)',
    },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

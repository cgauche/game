/**
 * Schéma de `driving-mishap.json` — Tableau des Accidents de Conduite d'attelage EN SCÈNE
 * (LDB 09 l.140-149), 1d10. Reflet de `MishapEntry`/`DrivingMishapOutcome`. L'ISSUE tirée est
 * `outcome` — graphie du dépôt pour une issue de table (`sea-navigation.json::orientation.reperes`,
 * `mecanique.ts::travelTableEntry.mount.outcome`), la MÉCANIQUE exécutable restant `ops`
 * (`src/engine/drivingMishap.ts`).
 */
import { z } from 'zod';
import { document } from '../grammaire/document';

export const file = 'driving-mishap.json';
export const famille = 'config';

const doc = document(
  'driving-mishap',
  famille,
  {
    entries: z.array(
      z.strictObject({
        id: z.string(),
        min: z.number(),
        max: z.number(),
        label: z.string(),
        outcome: z.enum(['harness', 'jolt', 'wheel', 'crash']),
        desc: z.string(),
      }),
    ),
  },
  {
    entries: { label: 'Accidents', hint: 'Rangées du 1d10, bornes min/max inclusives ; `outcome` = id de l’issue tirée' },
  },
  {
    codex: { keys: ['drivingMishap'] },
    edit: {
      none: 'édité par TABLEAU NICHÉ : la catégorie Codex `drivingMishap` édite le champ `entries` de ce document, jamais le document entier (CodexEdit.CATEGORY_DATASET)',
    },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

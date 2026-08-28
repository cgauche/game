/**
 * Schéma de `drunkenness.json` — Tableau d'Ivresse (LDB 09 l.475-481), consommé par
 * `src/engine/drunkenness.ts` (`{ table: DrunkEntry[] }`, lookup `findTableEntry` sur 1d10).
 * `outcome` = id STABLE de l'ISSUE tirée (Mouvement OU Action de « piece-tourne » lu par `drunkStaggers` ;
 * gueule de bois de « blackout » résolue par `soberUp`). La MÉCANIQUE exécutable (Bravoure/meilleur
 * ami/belligérant) est `ops` (`GameOp[]`, langue unique — `applyOps`), absent = rien d'exécutable.
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { gameOpSchema } from '../grammaire/mecanique';

export const file = 'drunkenness.json';
export const famille = 'config';

const doc = document(
  'drunkenness',
  famille,
  {
    entries: z.array(
      z.strictObject({
        id: z.string(),
        min: z.number(),
        max: z.number(),
        label: z.string(),
        outcome: z.enum(['bravoure', 'ami', 'staggering', 'belligerent', 'blackout']),
        desc: z.string(),
        ops: z.array(gameOpSchema).optional(),
      }),
    ),
  },
  {
    entries: { label: 'Paliers d’Ivresse', hint: 'Rangées du 1d10, bornes min/max inclusives ; `ops` = la mécanique exécutable' },
  },
  {
    codex: { keys: ['drunkenness'] },
    edit: {
      none: 'édité par TABLEAU NICHÉ : la catégorie Codex `drunkenness` édite le champ `entries` de ce document, jamais le document entier (CodexEdit.CATEGORY_DATASET)',
    },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

/**
 * Schéma de `astrology.json` — Demeures célestes (ADE II 3 l.502-512). Dérivé du contenu RÉEL
 * (5 demeures) et de `CelestialHouseData` (`src/data/index.ts`).
 */
import { z } from 'zod';
import { document } from '../grammaire/document';

export const file = 'astrology.json';
export const famille = 'entite';

const doc = document(
  'astrology',
  famille,
  {
    rand: z.number(),
  },
  {
    rand: { label: 'Seuil aléatoire (d100)' },
  },
  {
    codex: { keys: ['celestialHouses'] },
    edit: { dataset: 'celestialHouses' },
  },
  { exiges: ['desc', 'source'] },
);

export const schema = doc.schema;
export const meta = doc.meta;

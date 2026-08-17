/**
 * Schéma de `qualityTypes.json` — miroir de `QualityTypeData` (`src/data/index.ts:1600-1601`) : les 2
 * entrées présentes dans le JSON (`atout`/`defaut`) — grandes familles de Qualités d'objet.
 */
import { z } from 'zod';

export const file = 'qualityTypes.json';

export const schema = z.array(
  z.strictObject({
    id: z.string(),
    label: z.string(),
  }),
);

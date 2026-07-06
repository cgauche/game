/**
 * Schéma de `breath-types.json` — Types de Souffle (Feu/Froid/Corrosif/Électrique/Poison/Fumée),
 * argument du Trait Souffle. Reflet de `BreathTypeData` (`src/data/index.ts`).
 */
import { z } from 'zod';

export const file = 'breath-types.json';

export const schema = z.array(
  z.strictObject({
    id: z.string(),
    label: z.string(),
  }),
);

export type BreathTypesData = z.infer<typeof schema>;

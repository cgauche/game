/**
 * Schéma de `lightLevels.json` — paliers de lumière (jour/couvert/crépuscule/nuit/ténèbres) consommés
 * comme `LightLevelDef[]` (`src/data/index.ts:1355`) : `{ id, label, scalar, baseSightTiles }`.
 */
import { z } from 'zod';

export const file = 'lightLevels.json';

export const schema = z.array(
  z.strictObject({
    id: z.string(),
    label: z.string(),
    scalar: z.number(),
    baseSightTiles: z.number(),
  }),
);

export type LightLevelsData = z.infer<typeof schema>;

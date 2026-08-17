/**
 * Schéma de `damage-types.json` — registre des types de Dégâts (Immunité aux Dégâts,
 * `src/data/index.ts:1653-1657`, `DamageTypeData`). 4 entrées présentes : poison/feu/electrique/magique.
 */
import { z } from 'zod';

export const file = 'damage-types.json';

export const schema = z.array(
  z.strictObject({
    id: z.string(),
    label: z.string(),
  }),
);

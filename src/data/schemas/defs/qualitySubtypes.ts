/**
 * Schéma de `qualitySubtypes.json` — miroir de `QualitySubtypeData` (`src/data/index.ts:1588-1589`) :
 * les 3 entrées présentes dans le JSON (`arme`/`armure`/`objet`) — sous-type d'objet porteur de Qualité.
 */
import { z } from 'zod';

export const file = 'qualitySubtypes.json';

export const schema = z.array(
  z.strictObject({
    id: z.string(),
    label: z.string(),
  }),
);

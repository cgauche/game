/**
 * Schéma de `crew-test-types.json` — types de Test d'équipage (MDG ch.14) : rôles contributeurs +
 * rôle ESSENTIEL (son DR compte double). Consommé par `src/data/index.ts:1327` (`CrewTestTypeData`),
 * `findCrewTestTypeById`) et `src/engine/crewMorale.ts`/`src/state/shipCrew.ts`.
 */
import { z } from 'zod';

export const file = 'crew-test-types.json';

export const schema = z.array(
  z.strictObject({
    id: z.string(),
    label: z.string(),
    roles: z.array(z.string()),
    essential: z.string(),
  }),
);

export type CrewTestTypesData = z.infer<typeof schema>;

/**
 * Schéma de `crew-test-types.json` — types de Test d'équipage (MDG 14) : rôles contributeurs +
 * rôle ESSENTIEL (son DR compte double). Consommé par `src/data/index.ts:1327` (`CrewTestTypeData`),
 * `findCrewTestTypeById`) et `src/engine/crewMorale.ts`/`src/state/shipCrew.ts`.
 */
import { z } from 'zod';
import { sourceRefSchema } from '../common';

export const file = 'crew-test-types.json';

export const schema = z.strictObject({
  types: z.array(
    z.strictObject({
      id: z.string(),
      label: z.string(),
      roles: z.array(z.string()),
      essential: z.string(),
      /** ENJEU (#331) : ce que l'échec du Test coûte, verbatim MDG 14 (règle 5) — surfacé sous le
       *  titre d'étape de cascade. Optionnel (une entrée sans enjeu documenté n'affiche rien). */
      enjeu: z.string().optional(),
      source: sourceRefSchema,
    }),
  ),
});

export type CrewTestTypesData = z.infer<typeof schema>;

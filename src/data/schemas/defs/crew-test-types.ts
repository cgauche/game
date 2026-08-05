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
      /** Fiche `regles.json` portant le VERBATIM MDG 14 du Test (règle-cadre « ce Test peut être
       *  remplacé par un Test d'équipage »). L'enjeu AFFICHÉ vient de `voyage-stakes.json`. */
      rule: z.string().optional(),
      source: sourceRefSchema,
    }),
  ),
});

export type CrewTestTypesData = z.infer<typeof schema>;

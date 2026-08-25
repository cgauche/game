/**
 * Schéma de `crew-test-types.json` — types de Test d'équipage (MDG 14) : rôles contributeurs +
 * rôle ESSENTIEL (son DR compte double). Consommé par `src/data/index.ts` (`CrewTestTypeData`),
 * `findCrewTestTypeById`) et `src/engine/crewMorale.ts`/`src/state/shipCrew.ts`.
 */
import { z } from 'zod';
import { sourceRefSchema } from '../grammaire/valeurs';

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
      /** Un total NÉGATIF de ce Test retire autant de Moral à l'équipage (MDG 14 l.110, Rude épreuve). */
      moraleOnNegativeDR: z.boolean().optional(),
      /** Ce Test d'équipage est celui qui DIRIGE le navire : les Traits/Améliorations de coque qui
       *  modifient le Test de Navigation pour diriger (MSRC 12 l.66/140) s'y appliquent, et l'empêtrement le grève. */
      steering: z.boolean().optional(),
      source: sourceRefSchema,
    }),
  ),
});

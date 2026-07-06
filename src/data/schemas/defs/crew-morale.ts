/**
 * Schéma de `crew-morale.json` — MORAL d'un équipage (MDG ch.14). Consommé par
 * `src/engine/crewMorale.ts` : `base` (score de départ), `factors` (MODIFICATEURS DE MORAL — `effect`
 * = dés signés texte, ex. « +2d10 », « -3d10 », lus par `rollExpr`), `bands` (EFFETS DU MORAL — bornes
 * de bande, ±DR de Commandement/Tests d'équipage, seuil de désertion optionnel).
 */
import { z } from 'zod';

export const file = 'crew-morale.json';

export const schema = z.strictObject({
  base: z.number(),
  factors: z.array(
    z.strictObject({
      id: z.string(),
      label: z.string(),
      /** Dés signés texte (ex. « +2d10 », « -3d10 ») — lu par `rollExpr` (`src/engine/dice.ts`). */
      effect: z.string(),
    }),
  ),
  bands: z.array(
    z.strictObject({
      min: z.number(),
      max: z.number(),
      id: z.string(),
      captainCmdDR: z.number(),
      crewTestDR: z.number(),
      /** Absent si aucune désertion pour cette bande (« Mené de main de maître », « Excellent équipage »). */
      desertionRoll: z.number().optional(),
      desc: z.string(),
    }),
  ),
});

export type CrewMoraleData = z.infer<typeof schema>;

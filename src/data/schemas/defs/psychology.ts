/**
 * Schéma de `psychology.json` — États PSYCHOLOGIQUES (LDB 21), miroir de `PsychologyData extends
 * StatusData` (`src/data/index.ts`). Inventaire réel (9 entrées) : `gating` (hérité
 * de `StatusData`) n'est utilisé par AUCUNE entrée aujourd'hui — modélisé quand même (reflet de
 * l'interface), simplement optionnel et jamais peuplé en pratique.
 */
import { z } from 'zod';
import { sourceRefSchema, difficultySchema, stakeFormSchema } from '../grammaire/valeurs';
import { gameOpSchema, triggeredEffectSchema } from '../grammaire/mecanique';

export const file = 'psychology.json';

export const schema = z.array(
  z.strictObject({
    id: z.string(),
    label: z.string(),
    desc: z.string(),
    source: sourceRefSchema,
    passive: z.array(gameOpSchema).optional(),
    effects: z.array(triggeredEffectSchema).optional(),
    gating: z
      .strictObject({
        action: z.literal('none').optional(),
        movement: z.enum(['none', 'half', 'crawl']).optional(),
        cannotDefend: z.literal(true).optional(),
      })
      .optional(),
    icon: z.string().optional(),
    psychImmune: z.boolean().optional(),
    targeted: z.boolean().optional(),
    endedByOtherPsych: z.boolean().optional(),
    immuneToFromTarget: z.array(z.string()).optional(),
    attackDR: z.strictObject({ amount: z.number(), vs: z.enum(['source', 'group', 'any']) }).optional(),
    immuneWhileActive: z.array(z.string()).optional(),
    containedSocialMod: z.number().optional(),
    targetCauses: z.strictObject({ kind: z.string(), indice: z.number() }).optional(),
    triggerOn: z.enum(['encounter', 'threatened']).optional(),
    /** ENJEU du Test de Psychologie (#1117 L2) — porté par l'ENTRÉE, pas par un gabarit de `kind` :
     *  les conséquences diffèrent d'une entrée à l'autre (`resolution`/`failCondition`/`failAmount`/
     *  `becomes`), donc un texte au `kind` serait tautologique. Patron `ActivityDef.stake` : l'entité
     *  qui PORTE la règle porte aussi ce que son jet met en jeu. `{indice}` = trou rempli par le flux. */
    stake: z.string().optional(),
    /** FORME DÉCLARÉE du `stake` (même contrat que `night-stakes`/`flow-stakes`/`activities`). */
    stakeForm: stakeFormSchema.optional(),
    resolution: z.enum(['extended', 'terreur', 'binary']).optional(),
    failCondition: z.string().optional(),
    failAmount: z
      .strictObject({
        base: z.union([z.literal('indice'), z.number()]).optional(),
        perDegreeOfFailure: z.number().optional(),
      })
      .optional(),
    becomes: z.string().optional(),
    test: z.strictObject({ skill: z.string().optional(), difficulty: difficultySchema.optional() }).optional(),
  }),
);

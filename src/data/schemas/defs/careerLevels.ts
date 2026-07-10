/**
 * Schéma de `careerLevels.json` — dérivé du contenu RÉEL (384 entrées, script d'inventaire) et de
 * `CareerLevelData` (`src/data/index.ts:180`). `skills`/`talents` = `AdvancementRef[]`
 * (`src/data/index.ts:1757` : {ref}/{wildcard}+specOptions/{choice}/{random}), `trappings` =
 * `TrappingRef[]`, `characteristics` = `CharKey[]`. Ces 3 formes (Ref/TrappingRef/AdvancementRef)
 * et l'énum `CharKey` sont PROMUES dans `common.ts` (ex-dupliquées avec `species.ts`/`classes.ts`).
 *
 * ANOMALIE DE DONNÉE relevée (à corriger séparément, PAS ici) : `careerLevels.json`, carrière
 * `nautonier` niveau 2 (label « Nautonier »), `status: "Agent 1"` — typo pour « Argent 1 »
 * (les 3 échelons canon sont Bronze/Argent/Or, cf. toutes les autres 383 entrées).
 */
import { z } from 'zod';
import { charKeySchema, advancementRefSchema, trappingRefSchema } from '../common';

export const file = 'careerLevels.json';

export const schema = z.array(
  z.strictObject({
    label: z.string(),
    /** Forme féminine d'AFFICHAGE du niveau — MAISON (le LDB n'imprime que le masculin) ;
     *  omis = forme épicène (identique au masculin). */
    labelF: z.string().optional(),
    /** `id` de la Carrière (`CareerData.id`). */
    career: z.string(),
    level: z.number(),
    skills: z.array(advancementRefSchema),
    talents: z.array(advancementRefSchema),
    trappings: z.array(trappingRefSchema),
    characteristics: z.array(charKeySchema),
    /** Échelon de statut (« Bronze/Argent/Or N ») — VERBATIM du livre. Une occurrence porte le
     *  typo « Agent 1 » (cf. anomalie ci-dessus) : gardé z.string() libre (pas d'enum fermée), la
     *  faute de frappe ne doit pas faire échouer le schéma — elle se corrige au JSON, pas ici. */
    status: z.string(),
  }),
);

export type CareerLevelsData = z.infer<typeof schema>;

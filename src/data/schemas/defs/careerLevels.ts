/**
 * Schéma de `careerLevels.json` — dérivé du contenu RÉEL (432 entrées, script d'inventaire) et de
 * `CareerLevelData` (`src/data/index.ts`). `skills`/`talents` = `AdvancementRef[]`
 * (`src/data/index.ts` : {ref}/{wildcard}+specOptions/{choice}/{random}), `trappings` =
 * `TrappingRef[]`, `characteristics` = `CharKey[]`. Ces 3 formes (Ref/TrappingRef/AdvancementRef)
 * et l'énum `CharKey` vivent dans la grammaire (`grammaire/reference.ts`, `grammaire/valeurs.ts`),
 * partagées avec `species.ts`/`classes.ts`.
 */
import { z } from 'zod';
import { charKeySchema, sourceRefSchema } from '../grammaire/valeurs';
import { advancementRefSchema, trappingRefSchema } from '../grammaire/reference';

export const file = 'careerLevels.json';
export const famille = 'entite';

export const schema = z.array(
  z.strictObject({
    /** Identité du niveau — composite `<career>-<level>` (`agitateur-1`), 432/432 distincts. */
    id: z.string().min(1),
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
    /** Échelon de statut (« Bronze/Argent/Or N ») — VERBATIM du livre : chaîne libre, 432/432 entrées
     *  conformes à la graphie Bronze/Argent/Or + échelon. */
    status: z.string(),
    /** Dérivé de `CareerData.source` (#309) : chaque niveau appartient à une Carrière déjà citée ;
     *  ancre retenue = folio de la Carrière parente (LDB 7-08, blocs par Carrière). */
    source: sourceRefSchema.optional(),
  }),
);

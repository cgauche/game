/**
 * Schéma de `pregens.json` — dérivé du contenu RÉEL (8 entrées, script d'inventaire) et de
 * `PregenDef` (`src/data/pregens.ts:14`). Personnages pré-tirés APP-OWNED (flavor : motivation,
 * ambitions LDB 05 l.710-717) ; la fabrique (`createHero`) résout `species`/`career` (ids stables)
 * et `spells` (libellés → ids au chargement).
 */
import { z } from 'zod';

export const file = 'pregens.json';

export const schema = z.array(
  z.strictObject({
    name: z.string(),
    /** `id` STABLE de l'espèce (`SpeciesData.id`). */
    species: z.string(),
    /** `id` STABLE de la carrière (`CareerData.id`). */
    career: z.string(),
    seed: z.number(),
    motivation: z.string(),
    /** Ambitions à court/long terme (LDB 05 l.710-717) — flavor du pré-tiré. */
    ambitionShort: z.string().optional(),
    ambitionLong: z.string().optional(),
    /** Âge (LDB 05 étape 6) — absent sur toutes les entrées observées (pas de tirage moteur côté pré-tiré). */
    age: z.number().optional(),
    /** Talent de carrière CHOISI (libellé concret) — sans lui, `createHero` prend la 1ʳᵉ entrée du Niveau. */
    careerTalent: z.string().optional(),
    /** Sorts/prières connus (libellés de `spells.json`, résolus en ids au chargement). */
    spells: z.array(z.string()).optional(),
    /** Sexe visuel (cosmétique). Défaut 'M'. */
    sex: z.enum(['M', 'F']).optional(),
    /** Morphologie 0..1 (cosmétique). Défaut 0.5. */
    build: z.number().optional(),
  }),
);

export type PregensData = z.infer<typeof schema>;

/**
 * Schéma de `structures.json` — structures DESTRUCTIBLES de siège (ADE II ch.08 « Le théâtre de la
 * guerre », table « Barricades et protections typiques »). Dérivé de l'interface `StructureData`
 * (`src/engine/types.ts:170`) et du contenu RÉEL (5 entrées : 3 portes, 2 murs — inventaire exhaustif
 * par script, `char`/`traits`/`source` toujours présents, `fortified` présent sur 2/5 seulement).
 */
import { z } from 'zod';

export const file = 'structures.json';

/** Réf de Trait de structure (Résistant / Impénétrable, ADE II ch.08) — `{id}` seul observé dans les
 *  5 entrées ; `value` resterait possible (parallèle à `QualityRef`) mais aucune preuve dans la donnée. */
const structureTraitRefSchema = z.strictObject({
  id: z.string(),
  value: z.number().optional(),
});

export const schema = z.array(
  z.strictObject({
    id: z.string(),
    label: z.string(),
    kind: z.enum(['porte', 'mur']),
    /** RENDU (pas règle) : fortification de siège (rempart de pierre) vs cloison ordinaire. */
    fortified: z.boolean().optional(),
    char: z.strictObject({ BE: z.number(), B: z.number() }),
    traits: z.array(structureTraitRefSchema),
    /** Réf de source à granularité CHAPITRE (≠ `sourceRefSchema` commun qui est `{book,page}`) — les 5
     *  entrées ne portent qu'un `chapter`, jamais de `page`. Candidat à mutualisation si un 2e dataset
     *  porte la même forme `{book, chapter}`. */
    source: z.strictObject({ book: z.string(), chapter: z.number() }),
    desc: z.string().optional(),
  }),
);

export type StructuresData = z.infer<typeof schema>;

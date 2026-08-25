/**
 * Schéma de `mutations.json` — Mutations (entités, LDB 19 p.184-185 + suppléments), miroir de
 * `MutationData = Omit<Mutation, 'roll'>` (`src/data/mutations.ts`, `Mutation` définie
 * `src/engine/corruption.ts`). `roll` (jet d100, traçabilité de tirage) n'appartient PAS à
 * l'entité éditable — porté seulement par l'INSTANCE tirée à l'exécution (hors dataset).
 */
import { z } from 'zod';
import { sourceRefSchema, entityAppearanceSchema } from '../grammaire/valeurs';
import { gameOpSchema } from '../grammaire/mecanique';

export const file = 'mutations.json';
export const famille = 'entite';

export const schema = z.array(
  z.strictObject({
    id: z.string(),
    label: z.string(),
    desc: z.string(),
    kind: z.enum(['physique', 'mentale']),
    passive: z.array(gameOpSchema).optional(),
    note: z.string().optional(),
    source: sourceRefSchema.optional(),
    nonVisual: z.boolean().optional(),
    /** id d'une autre entrée `mutations.json` (Tête bestiale EDOC → sous-table alignée, `rollMutation`). */
    subTable: z.string().optional(),
    appearance: entityAppearanceSchema.optional(),
  }),
);

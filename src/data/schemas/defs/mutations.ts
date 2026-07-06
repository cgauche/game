/**
 * Schéma de `mutations.json` — Mutations (entités, LDB 19 p.184-185 + suppléments), miroir de
 * `MutationData = Omit<Mutation, 'roll'>` (`src/data/mutations.ts:21`, `Mutation` définie
 * `src/engine/corruption.ts:51-82`). `roll` (jet d100, traçabilité de tirage) n'appartient PAS à
 * l'entité éditable — porté seulement par l'INSTANCE tirée à l'exécution (hors dataset).
 *
 * ANOMALIE relevée (à rapporter, PAS corrigée ici) : l'entrée `longues-jambes` porte
 * `appearance: { legs: 1.3 }` — `legs` n'existe PAS sur `EntityAppearance`
 * (`src/state/scene.ts:87-110` : seed/monster/colors/parts/sex/build/species/tenue/eyes/features).
 * Le champ `legs` (facteur d'échelle des jambes) est bien un mécanisme RÉEL du rig (lu par
 * `combatantVisuals.ts` sur le type `Appearance`, PAS `EntityAppearance`), mais l'interface de donnée
 * ne le déclare pas : soit `EntityAppearance` doit gagner un `legs?: number`, soit cette entrée est
 * une fuite d'un type voisin. Modélisé ici tel quel (preuve JSON) pour ne pas faire échouer le contrat
 * sur une donnée réellement consommée par le rig — la correction de l'interface reste à faire ailleurs.
 */
import { z } from 'zod';
import { sourceRefSchema, gameOpSchema, entityAppearanceSchema as entityAppearanceSchemaBase } from '../common';

export const file = 'mutations.json';

/** `EntityAppearance` (`common.ts`, miroir `src/state/scene.ts:87-110`) + `legs` (anomalie ci-dessus,
 *  cf. commentaire de tête) — SEULE ce dataset porte cette extension, non remontée au commun. */
const entityAppearanceSchema = entityAppearanceSchemaBase.extend({
  /** ANOMALIE — absent de `EntityAppearance` (cf. commentaire de tête). Vu sur `longues-jambes` seul. */
  legs: z.number().optional(),
});

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

export type MutationsData = z.infer<typeof schema>;

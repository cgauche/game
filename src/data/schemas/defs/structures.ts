/**
 * Schéma de `structures.json` — structures DESTRUCTIBLES de siège (ADE II ch.08 « Le théâtre de la
 * guerre », table « Barricades et protections typiques » ; AA « Tableau des Structures Courantes »,
 * AA 10 l.26-92). Dérivé de l'interface `StructureData` (`src/engine/types.ts:191`) et du contenu
 * RÉEL (23 entrées : 5 ADE II à 2 colonnes BE/B, 18 AA à profil 5 colonnes ENC/Limite d'Encombrement/
 * Endurance-BE/Blessures/Pénalité de Couvert — `enc`/`encLimit`/`couvertPenalty` optionnels, N/A côté
 * ADE II ou pour les entrées AA sans cette colonne, ex. Herse/Solide porte en bois sans Couvert).
 */
import { z } from 'zod';
import { difficultySchema } from '../common';

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
    /** Profil AA (AA 10 l.28-52) — absents des 5 entrées ADE II ; N/A pour certaines entrées AA
     *  elles-mêmes (Herse/Solide porte en bois sans Pénalité de Couvert, Structures fixes sans ENC). */
    enc: z.number().optional(),
    encLimit: z.number().optional(),
    couvertPenalty: difficultySchema.optional(),
    /** Réf de source à granularité CHAPITRE (≠ `sourceRefSchema` commun qui est `{book,page}`) — les
     *  entrées ne portent qu'un `chapter`, jamais de `page`. Candidat à mutualisation si un 2e dataset
     *  porte la même forme `{book, chapter}`. */
    source: z.strictObject({ book: z.string(), chapter: z.number() }),
    desc: z.string().optional(),
  }),
);

export type StructuresData = z.infer<typeof schema>;

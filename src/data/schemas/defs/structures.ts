/**
 * Schéma de `structures.json` — structures DESTRUCTIBLES de siège (ADE II 8 « Le théâtre de la
 * guerre », table « Barricades et protections typiques » ; AA « Tableau des Structures Courantes »,
 * AA 10 l.26-92). Dérivé de l'interface `StructureData` (`src/engine/types.ts`) et du contenu
 * RÉEL (24 entrées : 5 ADE II à 2 colonnes BE/B, 19 AA à profil 5 colonnes ENC/Limite d'Encombrement/
 * Endurance-BE/Blessures/Pénalité de Couvert — `enc`/`encLimit`/`couvertPenalty` optionnels, N/A côté
 * ADE II ou pour les entrées AA sans cette colonne, ex. Herse/Solide porte en bois sans Couvert).
 * Folios : ADE II 89 ; AA 119-120 (`src/data/structures-folio.test.ts` les confronte à `auditFolio`).
 */
import { z } from 'zod';
import { difficultySchema, sourceRefSchema } from '../grammaire/valeurs';

export const file = 'structures.json';
export const famille = 'entite';

/** Réf de Trait de structure (Résistant / Impénétrable, ADE II 8) — `{id}` seul observé dans les
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
    /** Nature d'AUTHORING (posable sur une arête) — redéfinit `kind` quand il diverge (Herse, #830). */
    edgeKind: z.enum(['porte', 'mur']).optional(),
    /** Véhicule (AA 10) : partage la mécanique de PV mais n'est jamais posable sur une arête (#830). */
    vehicle: z.boolean().optional(),
    /** RENDU (pas règle) : fortification de siège (rempart de pierre) vs cloison ordinaire. */
    fortified: z.boolean().optional(),
    char: z.strictObject({ BE: z.number(), B: z.number() }),
    traits: z.array(structureTraitRefSchema),
    /** Profil AA (AA 10 l.28-52) — absents des 5 entrées ADE II ; N/A pour certaines entrées AA
     *  elles-mêmes (Herse/Solide porte en bois sans Pénalité de Couvert, Structures fixes sans ENC). */
    enc: z.number().optional(),
    encLimit: z.number().optional(),
    couvertPenalty: difficultySchema.optional(),
    source: sourceRefSchema,
    desc: z.string().optional(),
  }),
);

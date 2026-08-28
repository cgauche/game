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
import { difficultySchema } from '../grammaire/valeurs';
import { document } from '../grammaire/document';

export const file = 'structures.json';
export const famille = 'entite';

/** Réf de Trait de structure (Résistant / Impénétrable, ADE II 8) — `{id}` seul observé dans les
 *  5 entrées ; `value` resterait possible (parallèle à `QualityRef`) mais aucune preuve dans la donnée. */
const structureTraitRefSchema = z.strictObject({
  id: z.string(),
  value: z.number().optional(),
});

const doc = document(
  'structures',
  famille,
  {
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
  },
  {
    kind: { label: 'Nature de la Structure', hint: 'Porte ou Mur, pour la résolution mécanique' },
    edgeKind: { label: 'Nature d’authoring', hint: 'Redéfinit kind quand elle diverge à la pose sur une arête' },
    vehicle: {
      label: 'Véhicule (partage la mécanique)',
      hint: 'Partage la mécanique de Points de Vie d’une Structure mais jamais posable sur une arête',
    },
    fortified: { label: 'Fortification (rendu)', hint: 'Rendu visuel seulement — jamais une règle' },
    char: { label: 'Blessures et Bonus d’Endurance' },
    traits: { label: 'Traits de Structure' },
    enc: {
      label: 'Encombrement',
      hint: 'Absent des entrées ADE II, et N/A pour certaines entrées AA (Structures fixes sans ENC)',
    },
    encLimit: { label: 'Limite d’Encombrement', hint: 'Encombrement maximal que la Structure peut recevoir' },
    couvertPenalty: { label: 'Pénalité de Couvert' },
  },
  {
    codex: { keys: ['structures'] },
    edit: { dataset: 'structures' },
  },
  { exiges: ['source'] },
);

export const schema = doc.schema;
export const meta = doc.meta;

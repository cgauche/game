/**
 * Schéma de `gods.json` — dérivé du contenu RÉEL (41 entrées, script d'inventaire) et de
 * `GodData` (`src/data/index.ts`). `blessings`/`miracles`/`chaosSpells` = `Ref[]` (par id de
 * sort) — même petite forme que `TrappingRef`/`AdvancementRef`, PROMUE dans `grammaire/reference.ts`.
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { refSchema } from '../grammaire/reference';

export const file = 'gods.json';
export const famille = 'entite';

const doc = document(
  'gods',
  famille,
  {
    /** Ids de `groups.json` accordés au fidèle de ce culte — poussés par un Talent qui porte
     *  `grantSpecGroups` et dont le `spec` nomme ce dieu (`groupsFor`). Absent = aucun Groupe. */
    grantGroups: z.array(z.string()).optional(),
    title: z.string().optional(),
    blessings: z.array(refSchema),
    miracles: z.array(refSchema),
    /** Sorts du Chaos accordés (LDB 10 « Magie du Chaos »/Domaine du Chaos) — 3/41 dieux (Nurgle/
     *  Slaanesh/Tzeentch). */
    chaosSpells: z.array(refSchema).optional(),
    /** VERROU de Péché (MDG 11 l.148, Stromfels) : seuil de Points de Péché retirant l'usage du
     *  Talent de Prière (Béni/Invocation). 1/41 dieu observé (Stromfels). */
    sinLocks: z.strictObject({ beni: z.number().optional(), invocation: z.number().optional() }).optional(),
  },
  {
    grantGroups: { label: 'Groupes accordés' },
    title: { label: 'Épithète', hint: 'Sous-titre affiché sous le nom du dieu' },
    blessings: { label: 'Bénédictions' },
    miracles: { label: 'Miracles' },
    chaosSpells: { label: 'Sorts du Chaos accordés' },
    sinLocks: {
      label: 'Verrou de Péché',
      hint: 'Seuil de Points de Péché à partir duquel le dieu retire l’usage d’un Talent de Prière',
    },
  },
  {
    codex: { keys: ['gods'] },
    edit: { dataset: 'gods' },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;

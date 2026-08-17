/**
 * Schéma de `peripeties.json` — Table des Péripéties de voyage (1d10, `Source/…/51 - Magie du
 * Chaos.md` l.210-221 — le fichier mélange 2 chapitres réels du LDB post-ré-extraction Marker, cette
 * table appartient au conseil MJ « Voyage », pas aux sorts du Chaos, #309 phase 3), miroir strict de
 * `Peripetie` (`src/data/peripeties.ts:20-25`). 10 entrées, une par face du d10.
 */
import { z } from 'zod';
import { sourceRefSchema } from '../common';

export const file = 'peripeties.json';

export const schema = z.array(
  z.strictObject({
    id: z.string(),
    roll: z.number(),
    label: z.string(),
    /** Ce que le MOTEUR sait jouer sans rien inventer (cf. `src/data/peripeties.ts:11-16`). */
    kind: z.enum(['reposant', 'narratif', 'ereintant', 'attaque']),
    text: z.string(),
    source: sourceRefSchema.optional(),
  }),
);

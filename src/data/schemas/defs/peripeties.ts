/**
 * Schéma de `peripeties.json` — Table des Péripéties de voyage (1d10, LDB « Magie du Chaos » l.241-252),
 * miroir strict de `Peripetie` (`src/data/peripeties.ts:20-25`). 10 entrées, une par face du d10.
 */
import { z } from 'zod';

export const file = 'peripeties.json';

export const schema = z.array(
  z.strictObject({
    roll: z.number(),
    label: z.string(),
    /** Ce que le MOTEUR sait jouer sans rien inventer (cf. `src/data/peripeties.ts:11-16`). */
    kind: z.enum(['reposant', 'narratif', 'ereintant', 'attaque']),
    text: z.string(),
  }),
);

export type PeripetiesData = z.infer<typeof schema>;

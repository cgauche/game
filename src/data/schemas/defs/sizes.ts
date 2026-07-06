/**
 * Schéma de `sizes.json` — modificateur de tir selon la Taille de la CIBLE (LDB 14 l.151-170),
 * consommé par `src/engine/size.ts:33-34` (`SIZE_RANGED_MOD`, clé = `SizeCategory`). Les 7 clés
 * sont les 7 catégories RAW (Minuscule → Monstrueuse, `SizeCategory` dans `size.ts:14-21`).
 */
import { z } from 'zod';

export const file = 'sizes.json';

export const schema = z.strictObject({
  rangedMod: z.strictObject({
    minuscule: z.number(),
    tresPetite: z.number(),
    petite: z.number(),
    moyenne: z.number(),
    grande: z.number(),
    enorme: z.number(),
    monstrueuse: z.number(),
  }),
});

export type SizesData = z.infer<typeof schema>;

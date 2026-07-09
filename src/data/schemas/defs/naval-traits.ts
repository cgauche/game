/**
 * Schéma de `naval-traits.json` — Traits/Améliorations navals (MDG ch.12), catalogue par id STABLE
 * (`NavalTraitRef.id`). Dérivé de l'interface `NavalTraitData` (`src/data/index.ts:1265`, + `NavalInstall`/
 * `InstallBand`/`ShipSize` co-localisées) et du contenu RÉEL (20 entrées : `id`/`label`/`kind`/`desc`
 * toujours présents ; `source` 19/20 (#221 : Proue-idole de Stromfels = `maison`, pas de folio RAW) ;
 * `install` 15/20 ; `ranked` 4/20 ; `passive` 7/20 ; `ram` 1/20 ; `deckCover` 2/20 ; `maison` 1/20).
 */
import { z } from 'zod';
import { gameOpSchema } from '../common';

export const file = 'naval-traits.json';

const shipSizeSchema = z.enum(['minuscule', 'tres-petite', 'petite', 'moyenne', 'grande', 'enorme', 'monstrueuse']);

const installBandSchema = z.strictObject({
  min: shipSizeSchema.optional(),
  max: shipSizeSchema.optional(),
  value: z.number(),
});

const installCostSchema = z.union([
  z.strictObject({ bands: z.array(installBandSchema), per: z.enum(['5m', 'unite']).optional() }),
  z.literal('modele'),
]);

const navalInstallSchema = z.strictObject({
  cost: installCostSchema,
  weightEnc: installCostSchema.optional(),
});

export const schema = z.array(
  z.strictObject({
    id: z.string(),
    label: z.string(),
    kind: z.enum(['trait', 'amelioration']),
    source: z.strictObject({ book: z.string(), page: z.number() }).optional(),
    desc: z.string(),
    install: navalInstallSchema.optional(),
    ranked: z.boolean().optional(),
    passive: z.array(gameOpSchema).optional(),
    /** Bélier (MDG ch.12 l.221) : bonus de collision — sous-système navire hors vocabulaire combattant. */
    ram: z.strictObject({ ic: z.number(), ap: z.number() }).optional(),
    deckCover: z.boolean().optional(),
    /** #221 : même champ `maison` que `traumas.json` (`src/data/schemas/defs/traumas.ts:32`). */
    maison: z.string().optional(),
  }),
);

export type NavalTraitsData = z.infer<typeof schema>;

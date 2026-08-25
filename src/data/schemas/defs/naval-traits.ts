/**
 * Schéma de `naval-traits.json` — Traits/Améliorations navals (MDG 12, MSRC 12), catalogue par id
 * STABLE (`NavalTraitRef.id`). Dérivé de l'interface `NavalTraitData` (`src/data/index.ts`, +
 * `NavalInstall`/`InstallBand` co-localisées — bandes par PALIER DE LONGUEUR, #277) et du contenu RÉEL
 * (26 entrées : `id`/`label`/`kind`/`desc`
 * toujours présents ; `source` 25/26 (#221 : Proue-idole de Stromfels = `maison`, pas de folio RAW) ;
 * `install` 20/26 ; `ranked` 4/26 ; `passive` 8/26 ; `ram` 1/26 ; `deckCover` 3/26 ; `navTestMod` 2/26 ; `maison` 1/26).
 */
import { z } from 'zod';
import { sourceRefSchema, secondarySourceRefSchema } from '../grammaire/valeurs';
import { gameOpSchema } from '../grammaire/mecanique';

export const file = 'naval-traits.json';
export const famille = 'entite';

const installBandSchema = z.strictObject({
  maxLengthM: z.number().nullable(),
  value: z.number(),
  maison: z.string().optional(),
});

const installCostSchema = z.union([
  z.strictObject({ bands: z.array(installBandSchema), per: z.enum(['5m', '10m', 'unite']).optional() }),
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
    source: sourceRefSchema.optional(),
    /** Emplacement SECONDAIRE (#563) — `murs-blindes` prose folio 66 (ancre) ET bloc Coût/Poids
     *  folio 65 (`alsoIn[0].quote`). */
    alsoIn: z.array(secondarySourceRefSchema).optional(),
    desc: z.string(),
    install: navalInstallSchema.optional(),
    ranked: z.boolean().optional(),
    passive: z.array(gameOpSchema).optional(),
    /** Bélier (MDG 12 l.221) : bonus de collision — sous-système navire hors vocabulaire combattant. */
    ram: z.strictObject({ ic: z.number(), ap: z.number() }).optional(),
    /** Couvert de pont GRADUÉ (`DeckCoverClass`) : `totale` (Sabord/Murs blindés) ou `moyenne` (Plat-bord). */
    deckCover: z.enum(['imparfaite', 'moyenne', 'totale']).optional(),
    /** Modificateur (points) au Test de Navigation POUR DIRIGER le bateau (MSRC 12 l.66 Bouteur +20 ;
     *  l.137 Gréement de course −10) — sous-système manœuvre hors vocabulaire combattant (`navalNavTestDR`). */
    navTestMod: z.number().optional(),
    /** #221 : même champ `maison` que `traumas.json` (`src/data/schemas/defs/traumas.ts`). */
    maison: z.string().optional(),
  }),
);

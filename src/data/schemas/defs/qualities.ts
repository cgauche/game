/**
 * Schéma de `qualities.json` — Atouts/Défauts d'arme/armure/objet (LDB 62-63), `QualityData`
 * (`src/data/index.ts`). `capabilities` = `QualityCapabilities` (drapeaux IRRÉDUCTIBLES,
 * `src/data/index.ts`) ; `effects`/`passive` = MÊME vocabulaire `TriggeredEffect`/`GameOp` que
 * les Traits et les sorts, PROMU dans `common.ts` (`conditionSchema`/`flowSchema`/`triggeredEffectSchema`
 * — partagés avec `maneuvers.ts`).
 */
import { z } from 'zod';
import { sourceRefSchema, secondarySourceRefSchema } from '../grammaire/valeurs';
import { gameOpSchema, triggeredEffectSchema } from '../grammaire/mecanique';

export const file = 'qualities.json';

/** `QualityCapabilities` (`src/data/index.ts`) — clés OBSERVÉES dans `qualities.json` (52
 *  entrées) sauf `slowStrike`/`layerable`/`apIgnoredOnImpaleCrit` (présents dans l'interface, absents
 *  des 52 entrées actuelles — conservés car le TYPE source fait foi, pas l'échantillon courant). */
const qualityCapabilities = z.strictObject({
  fastStrike: z.boolean().optional(),
  slowStrike: z.boolean().optional(),
  fumbleOn9: z.boolean().optional(),
  fumbleDigits: z.array(z.number()).optional(),
  pushback: z.boolean().optional(),
  bladeTrap: z.boolean().optional(),
  damagesArmour: z.boolean().optional(),
  firearm: z.boolean().optional(),
  canFireWhileEngaged: z.boolean().optional(),
  magazine: z.boolean().optional(),
  salvo: z.boolean().optional(),
  areaFire: z.boolean().optional(),
  explosion: z.boolean().optional(),
  crewedTeam: z.boolean().optional(),
  parryAP: z.boolean().optional(),
  encDelta: z.number().optional(),
  layerable: z.boolean().optional(),
  critImmuneOdd: z.boolean().optional(),
  apIgnoredOnEven: z.boolean().optional(),
  apIgnoredOnImpaleCrit: z.boolean().optional(),
  siege: z.boolean().optional(),
  ram: z.boolean().optional(),
  unbreakable: z.boolean().optional(),
  magic: z.boolean().optional(),
  withheldOnRestraint: z.boolean().optional(),
  beats: z.array(z.string()).optional(),
});

export const schema = z.array(
  z.strictObject({
    id: z.string(),
    label: z.string(),
    /** `type` observé : 'atout' | 'defaut' (52/52). */
    type: z.enum(['atout', 'defaut']),
    /** `subType` observé : 'arme' | 'armure' | 'objet' (52/52) ; `QualityData.subType` autorise aussi
     *  `null` (TS `string | null`), non vu dans les 52 entrées actuelles mais le type source fait foi. */
    subType: z.enum(['arme', 'armure', 'objet']).nullable(),
    desc: z.string(),
    source: sourceRefSchema,
    /** Emplacements SECONDAIRES (#563) — ex. `tir-de-zone` AA folio 89 ET MDG folio 102 (réimprime
     *  AA verbatim). NON migré ici (Lot 0 primitive only). */
    alsoIn: z.array(secondarySourceRefSchema).optional(),
    effects: z.array(triggeredEffectSchema).optional(),
    passive: z.array(gameOpSchema).optional(),
    capabilities: qualityCapabilities.optional(),
    /** Cette qualité est INDICÉE (LDB 60 p.286) — MÊME forme que `TraitData.indice`/`traits.ts`. */
    indice: z.strictObject({ label: z.string() }).optional(),
  }),
);

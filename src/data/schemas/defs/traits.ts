/**
 * Schéma de `traits.json` — Traits de créature (LDB 85 + suppléments/frenchy.bzh), miroir de
 * `TraitData` (`src/data/index.ts:792-844`) + `TraitCapabilities` (`:730-790`).
 */
import { z } from 'zod';
import { sourceRefSchema, secondarySourceRefSchema, gameOpSchema, refSchema, entityAppearanceSchema, triggeredEffectSchema, charKeySchema } from '../common';

export const file = 'traits.json';

const specsSourceSchema = z.enum([
  'weaponGroupsMelee',
  'weaponGroupsRanged',
  'winds',
  'arcaneDomains',
  'cultBlessings',
  'cultMiracles',
  'cultChaos',
  'seaShanties',
  'groups',
  'diseases',
  'sizes',
  'mutations',
  'breathTypes',
  'damageTypes',
  'weaponsMelee',
  'weaponsRanged',
]);

/** `TraitCapabilities` (`src/data/index.ts:730-790`) — clés OBSERVÉES dans `traits.json` (31/54 déclarées
 *  sur l'interface ; les autres appartiennent aux capabilities de qualités/symptômes ou sont réservées
 *  au bestiaire lu ailleurs). Schéma reflète l'INTERFACE complète (toutes optionnelles), pas seulement
 *  le sous-ensemble vu aujourd'hui — une future entrée peut légitimement en ajouter. */
const traitCapabilitiesSchema = z.strictObject({
  bonusWoundsBE: z.boolean().optional(),
  mutationAtSpawn: z.enum(['physique', 'mentale']).optional(),
  swarm: z.boolean().optional(),
  naturalWeapon: z.strictObject({ ranged: z.boolean().optional() }).optional(),
  spellcaster: z.boolean().optional(),
  undead: z.boolean().optional(),
  wardSave: z.boolean().optional(),
  magicResistance: z.boolean().optional(),
  damageImmunity: z.boolean().optional(),
  spellDomainImmunity: z.string().optional(),
  counterOnDefenseWin: z.boolean().optional(),
  counterRequiresFastParry: z.boolean().optional(),
  unstable: z.boolean().optional(),
  painless: z.boolean().optional(),
  psychImmuneIfAhead: z.boolean().optional(),
  psychType: z.enum(['peur', 'terreur', 'animosite', 'haine', 'prejuge', 'amour', 'camaraderie', 'phobie']).optional(),
  psychImmune: z.boolean().optional(),
  psychIndice: z.number().optional(),
  frenzyCapable: z.boolean().optional(),
  mindless: z.boolean().optional(),
  woundsUseForce: z.boolean().optional(),
  freeTrample: z.boolean().optional(),
  bestial: z.boolean().optional(),
  coldBlooded: z.boolean().optional(),
  stupid: z.boolean().optional(),
  rage: z.boolean().optional(),
  territorial: z.boolean().optional(),
  skittishMount: z.boolean().optional(),
  structResistant: z.boolean().optional(),
  structImpenetrable: z.boolean().optional(),
  fly: z.boolean().optional(),
  leap: z.boolean().optional(),
  stride: z.boolean().optional(),
  autoClimb: z.boolean().optional(),
  climbFullSpeed: z.boolean().optional(),
  noRun: z.boolean().optional(),
  seesInDark: z.boolean().optional(),
  darkSightTiles: z.number().optional(),
  wakelessBite: z.boolean().optional(),
});

export const schema = z.array(
  z.strictObject({
    id: z.string(),
    label: z.string(),
    indice: z.strictObject({ label: z.string() }).optional(),
    range: z.boolean().optional(),
    specsSource: specsSourceSchema.optional(),
    specsOpen: z.boolean().optional(),
    specsMulti: z.boolean().optional(),
    desc: z.string(),
    source: sourceRefSchema,
    /** Emplacements SECONDAIRES (#563, doctrine « jamais 2 talents différents ») — ex. `fouissement`
     *  ZI folio 23 ET 134, deux définitions complètes du même Trait. NON migré ici (Lot 0 primitive
     *  only) : `allLocations`/`sourceBooks` (`src/data/sourceRefs.ts`). */
    alsoIn: z.array(secondarySourceRefSchema).optional(),
    effects: z.array(triggeredEffectSchema).optional(),
    grantsManeuvers: z.array(refSchema).optional(),
    passive: z.array(gameOpSchema).optional(),
    appearance: entityAppearanceSchema.optional(),
    capabilities: traitCapabilitiesSchema.optional(),
    suppressesCapabilities: z.array(z.string()).optional(),
    aura: z
      .strictObject({
        rangeChar: charKeySchema.optional(),
        rangeMeters: z.number().optional(),
        affects: z.enum(['enemies', 'allies', 'all']).optional(),
        passive: z.array(gameOpSchema),
      })
      .optional(),
    standard: z.boolean().optional(),
  }),
);

export type TraitsData = z.infer<typeof schema>;

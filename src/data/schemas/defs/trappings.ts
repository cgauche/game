/**
 * Schéma de `trappings.json` — vocabulaire UNIFIÉ des objets (armes/armures/munitions/possessions/
 * consommables/véhicules-marqueur), 403 entrées. Dérivé de l'interface `TrappingData` EXISTANTE
 * (`src/data/index.ts:385`, + `QualityRef`/`ItemCapabilities`/`Weapon`/`WeaponDamageSpec`/
 * `WeaponRangeSpec`/`AmmoRangeMod`/`ConsumableDuration`/`Formula`/`Flow`/`EffectOp` co-localisées dans
 * engine) et d'un inventaire EXHAUSTIF par script (histogramme des 403 entrées, cf. preuve du rendu).
 */
import { z } from 'zod';
import { gameOpSchema, sourceRefSchema, secondarySourceRefSchema, formulaSchema, flowSchema, triggeredEffectSchema } from '../common';

/** `SizeCategory` (`src/engine/size.ts`) — réf par id, jamais un enum parallèle. */
const sizeCategorySchema = z.enum(['minuscule', 'tresPetite', 'petite', 'moyenne', 'grande', 'enorme', 'monstrueuse']);

export const file = 'trappings.json';

/** Prix (LDB 74/etc., colonne « Coût ») — `{gold,silver,bronze}` tous `number`. Objet sans prix
 *  numérique fixe (RAW « ND »/« Variable »/« – » : Mains nues, Arme improvisée, Rocher, Bijoux,
 *  Licence de Guilde…) → `price: null` au niveau de l'entrée (cf. `filet`, déjà ce modèle). */
const moneySchema = z.strictObject({
  gold: z.number(),
  silver: z.number(),
  bronze: z.number(),
});

/** `QualityRef` (`Ref` + Indice éventuel) — shapes réellement observées : `{id}`, `{id,value}`, `{id,spec}`. */
const qualityRefSchema = z.strictObject({
  id: z.string(),
  spec: z.string().optional(),
  value: z.number().optional(),
});

/** `WeaponDamageSpec` (`src/engine/types.ts:235`) : `{literal}` OU `{plusBF,flat,bare?}` (`plusBF`
 *  toujours explicite — cf. `filet`/`lance-harpon`/`piege-a-chaines`, ZI). */
const weaponDamageSpecSchema = z.union([
  z.strictObject({ literal: z.string() }),
  z.strictObject({ plusBF: z.boolean(), flat: z.number(), bare: z.literal(true).optional() }),
]);

/** `WeaponRangeSpec` : mètres fixes, ou Bonus de Force × bf (armes de jet). */
const weaponRangeSpecSchema = z.union([z.number(), z.strictObject({ bf: z.number() })]);

/** `AmmoRangeMod` : fraction de la Portée de l'arme, ou ± mètres. */
const ammoRangeModSchema = z.union([z.strictObject({ mult: z.number() }), z.strictObject({ add: z.number() })]);

/** `ItemCapabilities` (`src/data/index.ts:357`) — sac de drapeaux IRRÉDUCTIBLES, tous optionnels. */
const itemCapabilitiesSchema = z.strictObject({
  preventForcedDrop: z.boolean().optional(),
  weatherProtection: z.boolean().optional(),
  isShelter: z.boolean().optional(),
  isRations: z.boolean().optional(),
  isGrimoire: z.boolean().optional(),
  lockpicks: z.boolean().optional(),
  scurvyGuard: z.boolean().optional(),
  sealskin: z.boolean().optional(),
  shipParts: z.boolean().optional(),
  disarmImmune: z.boolean().optional(),
  ropeMode: z.boolean().optional(),
  waterContainer: z.boolean().optional(),
});

/** `Weapon` (`src/engine/types.ts:268`) — reflet des seuls champs pertinents en DONNÉE `derivedWeapon`
 *  (prothèse-arme, LDB 73 : « le Crochet est considéré comme une Dague »). `Weapon` porte aussi des
 *  champs runtime-only (`uid`, `hand`…) absents de la donnée d'auteur — non repris ici (jamais observés). */
const weaponSchema = z.strictObject({
  label: z.string(),
  type: z.enum(['melee', 'ranged']),
  damage: weaponDamageSpecSchema,
  reach: z.union([z.string(), z.null()]).optional(),
  range: z.union([weaponRangeSpecSchema, z.null()]).optional(),
  qualities: z.array(z.strictObject({ id: z.string(), value: z.number().optional() })),
  subType: z.string().optional(),
  weaponGroup: z.string().optional(),
  soloSimple: z.boolean().optional(),
  indirect: z.boolean().optional(),
  /** LDB 62 l.292 — approximation MAISON (le RAW ne liste pas les armes à lame), éditable. */
  bladed: z.boolean().optional(),
  /** LDB 47 — approximation MAISON (matière du projectile, non tabulée par le RAW), éditable. */
  organicProjectile: z.boolean().optional(),
  hands: z.union([z.literal(1), z.literal(2)]).optional(),
});

/** `ConsumableDuration` (`src/engine/consumables.ts:17`) — UNE durée par objet (minutes/heures/jours). */
const consumableDurationSchema = z.strictObject({
  minutes: formulaSchema.optional(),
  hours: formulaSchema.optional(),
  days: formulaSchema.optional(),
});

export const schema = z.array(
  z.strictObject({
    id: z.string(),
    label: z.string(),
    hands: z.union([z.literal(1), z.literal(2)]).optional(),
    packSize: z.number().optional(),
    type: z.enum(['melee', 'ranged', 'ammunition', 'armor', 'trapping', 'vehicle']),
    subType: z.union([z.string(), z.null()]),
    weaponGroup: z.string().optional(),
    soloSimple: z.boolean().optional(),
    indirect: z.boolean().optional(),
    /** LDB 62 l.292 — approximation MAISON (le RAW ne liste pas les armes à lame), éditable. */
    bladed: z.boolean().optional(),
    /** LDB 47 — approximation MAISON (matière du projectile, non tabulée par le RAW), éditable. */
    organicProjectile: z.boolean().optional(),
    /** Effets « à la touche » en DONNÉE (`TriggeredEffect[]`) — Canon à flammes nain (ADE II 8 l.243). */
    onHitEffects: z.array(triggeredEffectSchema).optional(),
    /** PORTÉE MINIMALE de tir (bande) — machines de siège à distance (ADE II 8 l.251/253). */
    minRangeBand: z.enum(['bout-portant', 'courte', 'moyenne', 'longue', 'extreme']).optional(),
    siegeRig: z.string().optional(),
    siegeFootprint: z.number().optional(),
    /** Munition REPRÉSENTATIVE d'une arme de siège (`id` de trapping `type:'ammunition'`) — discrimine
     *  pierrier/canon/baliste/mortier là où `subType`='armes-de-siege' seul ne le fait pas (hint joueur,
     *  `ammoFamilyLabel`). */
    defaultAmmo: z.string().optional(),
    shape: z.string().optional(),
    formChoices: z.array(z.string()).optional(),
    requiresMastery: z.boolean().optional(),
    /** Absent (pas seulement `null`) sur 5 entrées — reflet du contenu réel. */
    enc: z.union([z.number(), z.literal('ND'), z.literal('Variable'), z.null()]).optional(),
    /** Taille PRÉVUE (ADE II 2 l.706-710) — version « taille ogre » d'une possession ordinaire. */
    sizeFor: sizeCategorySchema.optional(),
    availability: z.union([z.string(), z.null()]),
    /** `reach`/`loc`/`pa`/`damage` : présents sur 375/403 entrées (armes/armures) — ABSENTS (pas
     *  seulement `null`) sur les 28 consommables/potions sans profil d'arme (`optional()` en plus de
     *  `null`, reflet du contenu réel). */
    reach: z.union([z.string(), z.null()]).optional(),
    range: z.union([weaponRangeSpecSchema, z.null()]).optional(),
    ammoRangeMod: z.union([ammoRangeModSchema, z.null()]).optional(),
    loc: z.union([z.string(), z.null()]).optional(),
    pa: z.union([z.number(), z.null()]).optional(),
    damage: z.union([weaponDamageSpecSchema, z.null()]).optional(),
    qualities: z.array(qualityRefSchema),
    desc: z.union([z.string(), z.null()]),
    consumable: flowSchema.optional(),
    consumableDuration: consumableDurationSchema.optional(),
    container: z.strictObject({ capacity: z.number() }).optional(),
    /** `null` = objet sans prix numérique fixe (RAW « ND »/« Variable »/« – »). */
    price: z.union([moneySchema, z.null()]),
    source: sourceRefSchema,
    /** Emplacements SECONDAIRES (#563) — ex. `cimeterre` prose folio 90 (ancre) ET ligne de stats
     *  folio 91 (`alsoIn[0].quote`, la table n'imprime pas la desc). NON migré ici (Lot 0 primitive
     *  only). */
    alsoIn: z.array(secondarySourceRefSchema).optional(),
    derivedWeapon: weaponSchema.optional(),
    capabilities: itemCapabilitiesSchema.optional(),
    passive: z.array(gameOpSchema).optional(),
    /** Tarif de SERVICE (LDB 66 p.302 : chambre/écurie) — pas un objet possédable, cf. `TrappingData.service`. */
    service: z.boolean().optional(),
  }),
);

export type TrappingsData = z.infer<typeof schema>;

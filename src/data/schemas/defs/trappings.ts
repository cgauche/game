/**
 * Schéma de `trappings.json` — vocabulaire UNIFIÉ des objets (armes/armures/munitions/possessions/
 * consommables/véhicules-marqueur). Dérivé de l'interface `TrappingData` EXISTANTE
 * (`src/data/index.ts:385`, + `QualityRef`/`ItemCapabilities`/`Weapon`/`WeaponDamageSpec`/
 * `WeaponRangeSpec`/`AmmoRangeMod`/`ConsumableDuration`/`Formula`/`Flow`/`EffectOp` co-localisées dans
 * engine) et d'un inventaire EXHAUSTIF par script (histogramme de TOUTES les entrées du dataset).
 */
import { z } from 'zod';
import { gameOpSchema, sourceRefSchema, secondarySourceRefSchema, formulaSchema, flowSchema, triggeredEffectSchema } from '../common';
import { REACH_LABELS, REACH_VARIABLE } from '../../../engine/types';

/** `SizeCategory` (`src/engine/size.ts`) — réf par id, jamais un enum parallèle. */
const sizeCategorySchema = z.enum(['minuscule', 'tresPetite', 'petite', 'moyenne', 'grande', 'enorme', 'monstrueuse']);

export const file = 'trappings.json';

/** Montant CHIFFRÉ de la colonne « Prix »/« Coût » (LDB 62 l.20, LDB 68 l.7) — `{gold,silver,bronze}`
 *  tous `number`. Les formes NON chiffrées de cette colonne vivent sur le champ `price` lui-même. */
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

/** `ReachValue` (`src/engine/types.ts`) : les SEPT longueurs de l'axe d'Allonge (LDB 62 l.156-164) ou
 *  « Variable » (Arme improvisée, l.31). Vocabulaire FERMÉ, validé au CHARGEMENT (fail-fast) : hors de
 *  cette liste, `reachIdOf` ne rendrait aucun rang et toute règle d'Allonge se tairait en silence. */
const reachSchema = z.enum([REACH_VARIABLE, ...Object.values(REACH_LABELS)]);

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
  reach: z.union([reachSchema, z.null()]).optional(),
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
    /** Vocabulaire FERMÉ, validé au CHARGEMENT (fail-fast). Deux formes, telles que le livre les
     *  imprime — mesure sur tout le corpus FR : `\bND\b` y a EXACTEMENT 4 occurrences, toutes en
     *  cellule de tableau, sans aucune légende ni définition (LDB 62 l.28 Prix, l.31 Prix + Disponibilité,
     *  LDB 68 l.11 Prix + Disponibilité, LDB 69 l.9 Enc).
     *  - une des 4 classes (LDB 59 l.15 : « Toutes les Possessions possèdent une Disponibilité :
     *    Commune, Limitée, Rare ou Exotique. ») ;
     *  - `'ND'` — la MARQUE imprimée par le livre (LDB 62 l.31, LDB 68 l.11). Son sigle n'est développé
     *    nulle part dans le corpus FR : son sigle porte sur le COMPORTEMENT seul (champ `maison`), jamais sur
     *    le sens du mot — hors du commerce ordinaire (`isTradable`, engine/disponibilite) ;
     *  - `null` — le livre n'imprime AUCUNE valeur : tiret en Disponibilité (LDB 62 l.28, Mains nues) ou
     *    entrée hors table d'équipement (malepierre LDB 44 l.113-119, sel sacré MDG 10 l.112). */
    availability: z.union([z.enum(['Commune', 'Limitée', 'Rare', 'Exotique']), z.literal('ND'), z.null()]),
    /** `reach`/`loc`/`pa`/`damage` : portés par les armes/armures — ABSENTS (pas seulement `null`) sur
     *  les consommables/potions sans profil d'arme (`optional()` en plus de `null`, contenu réel). */
    reach: z.union([reachSchema, z.null()]).optional(),
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
    /** NI d'énergie magique qu'UN GRAMME de cet objet apporte à un Test d'Incantation/Focalisation en
     *  malepierre (`VDM 02 l.165` : « 1 gramme de malepierre équivaut à 20 NI »). Éditable — jamais une
     *  constante de code. Absent = objet non consommable comme réserve de NI. */
    niPerGram: z.number().optional(),
    /** Taux de consommation de la réserve de NI par point de DR bonus accordé (`VDM 02 l.163-165` ne
     *  fixe aucune formule de consommation) — arbitrage documenté par l'entrée elle-même (`maison`
     *  ci-dessous). Éditable. Absent = 1 (défaut). */
    niConsumedPerDR: z.number().optional(),
    /** Arbitrage NON-verbatim (même patron que `ActivityData.maison`/`CreatureData.maison`) —
     *  ex. le taux `niConsumedPerDR` d'une malepierre, ou le doublement plein sur réserve partielle. */
    maison: z.string().optional(),
    /** Vocabulaire FERMÉ, validé au CHARGEMENT (fail-fast). Trois formes, telles que le livre les
     *  imprime en colonne « Prix »/« Coût » — MÊME traitement que `enc`, qui porte déjà ses marques :
     *  - un montant chiffré (`moneySchema`) ;
     *  - `'ND'` — la MARQUE imprimée par le livre (LDB 62 l.28 Mains nues, l.31 Arme improvisée,
     *    LDB 68 l.11 Licence de Guilde). Son sigle n'est développé nulle part dans le corpus FR :
     *    aucune expansion n'est déclarée ici. COMPORTEMENT seul — zéro sou au calcul monétaire
     *    (`priceToMoney`, engine/money), marque rendue telle quelle au Compendium ;
     *  - `null` — le livre n'imprime AUCUNE valeur : entrée hors table d'équipement (malepierre
     *    LDB 44 l.113-119, sel sacré MDG 10 l.112, carte marine MDG 15 l.290). */
    price: z.union([moneySchema, z.literal('ND'), z.null()]),
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

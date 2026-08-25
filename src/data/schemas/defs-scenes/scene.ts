/**
 * Schémas zod des formes d'une SCÈNE (`src/state/scene.ts`) — racine de documents `src/scenes`.
 *
 * ORDRE DU SEAM : ces schémas voient la scène telle qu'elle arrive du JSON, AVANT `normalizeScene`
 * (`src/state/scene.ts`, appelée en fin de `parseProject`). Les collections que `normalizeScene`
 * comble (`layers`/`entities`/`dialogues`/`triggers`/`encounters`/`flags`) sont donc OPTIONNELLES
 * ici, alors que le type manuscrit les déclare requises : un document ancien n'en porte pas.
 *
 * `Effect` et `Flow` restent des `z.custom<T>()` annotés du type manuscrit (#1466 T3-a) : leur
 * schéma zod est le lot T3-b. Import de TYPE seul — aucun import runtime de `src/state`.
 */
import { z } from 'zod';
import { difficultySchema, entityAppearanceSchema } from '../grammaire/valeurs';
import { conditionSchema, flowTestSchema, gameOpSchema } from '../grammaire/mecanique';
import type { CustomStatblock, Effect } from '../../../state/scene';
import type { Flow } from '../../../state/flow';
import type { AuthoredShipPoste } from '../../../engine/types';
import type { OptionalEntry } from '../../../engine/statEntry';

/** `Effect` (`state/scene.ts`) — union des 57 variantes d'effet de scène. Schéma zod = lot T3-b. */
export const effectSchema = z.custom<Effect>();
/** `Flow` de scène (`state/flow.ts` = `Flow<Effect>`). Schéma zod = lot T3-b. */
export const sceneFlowSchema = z.custom<Flow>();

/** `Dir8` (`state/dir8.ts`) — orientation MONDE éditable, projetée au rendu. */
export const dir8Schema = z.enum(['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO']);
/** `WallSide` (`state/scene.ts`) — arête canonique N/E, diagonales `\` (NO→SE) et `/` (NE→SO). */
export const wallSideSchema = z.enum(['N', 'E', '\\', '/']);
/** `Pt` (`state/path.ts`) — case, `z` = couche d'empilement (absent = base). */
export const ptSchema = z.strictObject({ x: z.number(), y: z.number(), z: z.number().optional() });
/** Rectangle de zone/déclencheur — `z` = étage (défaut 0). */
export const rectSchema = z.strictObject({ x: z.number(), y: z.number(), w: z.number(), h: z.number(), z: z.number().optional() });
/** Bourse (`gold`/`silver`/`brass`) d'un coût ou d'un octroi. */
export const moneySchema = z.strictObject({ gold: z.number().optional(), silver: z.number().optional(), brass: z.number().optional() });
/** Offre de couchage d'une scène/zone (`RestPlaces` sans `bord`, réservé au navire de campagne). */
export const restPlacesSchema = z.strictObject({ auberge: z.boolean().optional(), maison: z.boolean().optional(), camp: z.boolean().optional() });

/** `CustomStatblock` (`engine/statblock.ts`) — profil PNJ/bête custom d'éditeur. T3-b. */
export const customStatblockSchema = z.custom<CustomStatblock>();
/** `AuthoredShipPoste` (`engine/types.ts`) — pièce d'artillerie MONTÉE, hydratée au spawn. T3-b. */
export const authoredShipPosteSchema = z.custom<AuthoredShipPoste>();
/** `NavalTraitRef` (`engine/types.ts`) — Amélioration d'INSTANCE d'un navire (MDG 12). */
export const navalTraitRefSchema = z.strictObject({ id: z.string(), value: z.number().optional() });
/** `OptionalEntry` (`engine/statEntry.ts`) — `TraitInstance` OU note composée. T3-b. */
export const optionalEntrySchema = z.custom<OptionalEntry>();
/** `SkillRef` (`src/data/index.ts`) — réf de Compétence à valeur. */
export const skillRefSchema = z.strictObject({ id: z.string(), spec: z.string().optional(), value: z.number() });

// ── Entité de scène ─────────────────────────────────────────────────────────────────────────────

/** `EntityKind` — `personnage` = tout être animé (fusion des anciens `pnj`/`ennemi`). */
export const entityKindSchema = z.enum(['heroStart', 'personnage', 'prop']);

/** `SceneEntity` (`state/scene.ts:41`). `id` = identité STABLE partagée avec le `Combatant` au spawn. */
export const sceneEntitySchema = z.strictObject({
  id: z.string(),
  kind: entityKindSchema,
  pos: z.strictObject({ x: z.number(), y: z.number() }),
  /** Couche d'empilement (cf. `layers`) : 0/absent = couche de base. */
  z: z.number().optional(),
  facing: dir8Schema.optional(),
  label: z.string().optional(),
  /** Réf au bestiaire (personnage) ou au catalogue de décor (prop). */
  ref: z.string().optional(),
  statblock: customStatblockSchema.optional(),
  /** Id d'un preset de `narratif.presetsPnj` — FK intra-document (vérifiée par `projetSchema`). */
  presetId: z.string().optional(),
  crewIds: z.array(z.string()).optional(),
  postes: z.array(authoredShipPosteSchema).optional(),
  upgrades: z.array(navalTraitRefSchema).optional(),
  dialogueId: z.string().optional(),
  /** Décor INTERACTIF : `flow` exécuté une fois ; `consume` = le décor disparaît quand pris. */
  interact: z.strictObject({ flow: sceneFlowSchema, consume: z.boolean().optional() }).optional(),
  appearance: entityAppearanceSchema.optional(),
  /** Animation d'ambiance en boucle (clé de `AMBIENT_CLIPS`). */
  anim: z.string().optional(),
  /** Arme ÉQUIPÉE — `trappingId` STABLE du catalogue d'armes, résolue par `weaponFromId`. */
  weapon: z.string().optional(),
  /** Empreinte multi-cases (décor statique). Défaut 1×1. */
  foot: z.strictObject({ w: z.number(), h: z.number() }).optional(),
  /** Source de lumière : rayon en cases ; `tone` = id d'un `lightTones` (apparence seule). */
  light: z.strictObject({ radiusTiles: z.number(), tone: z.string().optional() }).optional(),
  /** Marchand : archétype + surcharges de prix et des 3 règles maison Marché (LDB 59/60). */
  merchant: z
    .strictObject({
      archetype: z.string(),
      settlement: z.enum(['village', 'ville', 'cite']).optional(),
      resaleRate: z.number().optional(),
      buyMarkup: z.number().optional(),
      restockDays: z.number().optional(),
      guild: z.boolean().optional(),
      marketMode: z.enum(['complet', 'sans-disponibilite', 'sans-marchandage', 'simplifie']).optional(),
      tenirComptes: z.boolean().optional(),
    })
    .optional(),
  /** JOUEUR de taverne (`NADJ 04 l.72`) : `gameId` de `tavernGames.json`, mise de DÉPART en sous. */
  tavernGame: z.strictObject({ gameId: z.string(), stakeBrass: z.number().optional() }).optional(),
  /** RÔLE combat optionnel : ce que l'auteur choisit pour CETTE personne au combat. */
  combat: z
    .strictObject({
      /** OPTIONNELS choisis (`LDB 76 l.45`). */
      optionals: z.array(optionalEntrySchema).optional(),
      spells: z.array(z.string()).optional(),
      /** Caractéristiques aléatoires au spawn (`LDB 77 l.108`). */
      randomChars: z.boolean().optional(),
      skills: z.array(skillRefSchema).optional(),
      /** Invisible en EXPLORATION (embuscade) : n'apparaît qu'au combat. */
      hiddenUntilCombat: z.boolean().optional(),
    })
    .optional(),
});

// ── Architecture ────────────────────────────────────────────────────────────────────────────────

/** `ArchitectureRect` — emprise rectangulaire d'une part/masse. */
export const architectureRectSchema = z.strictObject({ x: z.number(), y: z.number(), w: z.number(), h: z.number() });
/** `ArchitectureEdgeRef` — arête porteuse d'une façade/d'un ornement. */
export const architectureEdgeRefSchema = z.strictObject({ x: z.number(), y: z.number(), side: wallSideSchema, z: z.number().optional() });
/** `ArchitecturePart` — empreinte nommée d'un étage. */
export const architecturePartSchema = z.strictObject({ id: z.string(), foot: architectureRectSchema });
/** `ArchitectureStorey` — un étage : ses parts et les zones-pièces qu'il couvre. */
export const architectureStoreySchema = z.strictObject({
  id: z.string(),
  z: z.number(),
  parts: z.array(architecturePartSchema),
  roomZoneIds: z.array(z.string()),
});
/** `FacadeFeature` — ornement posé sur une arête de façade. */
export const facadeFeatureSchema = z.strictObject({
  id: z.string(),
  kind: z.enum(['gable', 'stone-entry', 'chimney', 'sign', 'window-band', 'belfry']),
  edge: architectureEdgeRefSchema,
  offset: z.number().optional(),
  width: z.number().optional(),
  appearance: z.string().optional(),
});
/** `FacadeSection` — pan de façade d'un étage. */
export const facadeSectionSchema = z.strictObject({
  id: z.string(),
  z: z.number(),
  edges: z.array(architectureEdgeRefSchema),
  appearance: z.string(),
  roomZoneIds: z.array(z.string()).optional(),
  features: z.array(facadeFeatureSchema).optional(),
});
/** Profil de toiture d'une masse/d'une intention de toiture. */
export const roofProfileSchema = z.enum(['gable', 'hip', 'shed', 'flat']);
/** Côté d'égout bas (OBLIGATOIRE pour `shed`, ignoré sinon). */
export const eaveSideSchema = z.enum(['N', 'E', 'S', 'O']);
/** `BuildingMass` (#823) — l'INTENTION de toiture, jamais la géométrie du toit (dérivée par
 *  `gameIso/builders/roofs.ts`). `pitchDeg` est en DEGRÉS ; `derived` marque une masse posée par
 *  la dérivation (`deriveArchitectureMasses`), donc re-calculable, jamais une surcharge d'auteur. */
export const buildingMassSchema = z.strictObject({
  id: z.string(),
  z: z.number(),
  footprint: z.array(architectureRectSchema),
  levels: z.number(),
  profile: roofProfileSchema,
  pitchDeg: z.number(),
  material: z.string(),
  /** Axe de faîtage — OBLIGATOIRE si la masse est carrée (ambigu). Sans effet sur `shed`/`flat`. */
  ridge: z.enum(['x', 'y']).optional(),
  eaveSide: eaveSideSchema.optional(),
  derived: z.literal(true).optional(),
});
/** `RoofDefaults` (#829) — intention de toiture des masses DÉRIVÉES d'un corps. */
export const roofDefaultsSchema = z.strictObject({
  profile: roofProfileSchema,
  /** Pente POSÉE par l'auteur : elle ne s'adapte JAMAIS à la portée. Absente → `fittedPitchDeg`. */
  pitchDeg: z.number().optional(),
  material: z.string(),
  eaveSide: eaveSideSchema.optional(),
  /** BORNE de comble en hauteurs d'ÉTAGE (#947). Sans effet dès que `pitchDeg` est posé. */
  riseMaxStoreys: z.number().optional(),
});
/** `ArchitectureBody` — corps architectural authoré (volumes, façades, toitures). */
export const architectureBodySchema = z.strictObject({
  id: z.string(),
  label: z.string().optional(),
  style: z.string(),
  storeys: z.array(architectureStoreySchema),
  facades: z.array(facadeSectionSchema),
  /** SURCHARGES (#829) — la dérivation couvre le reste. */
  masses: z.array(buildingMassSchema),
  roofDefaults: roofDefaultsSchema.optional(),
  /** Surcharge NÉGATIVE (#829) : cases à NE JAMAIS couvrir, par étage. */
  roofExclusions: z.array(z.strictObject({ z: z.number(), rect: architectureRectSchema })).optional(),
});

// ── Dialogue ────────────────────────────────────────────────────────────────────────────────────

/** `DialogueChoice` — `when` gate l'AFFICHAGE, `cost` est débité AVANT le flow. */
export const dialogueChoiceSchema = z.strictObject({
  text: z.string(),
  /** Icône d'affordance (registre `src/ui/icons`), jamais un emoji collé au `text` (#290). */
  icon: z.string().optional(),
  when: conditionSchema.optional(),
  cost: moneySchema.optional(),
  flow: sceneFlowSchema.optional(),
  next: z.string().optional(),
});
/** `DialogueNode` — `speakerId` = entité de la scène dont le portrait/nom porte CE nœud. */
export const dialogueNodeSchema = z.strictObject({
  id: z.string(),
  speakerId: z.string().optional(),
  text: z.string(),
  choices: z.array(dialogueChoiceSchema),
});
/** `Dialogue` — arbre de nœuds, `start` = id du nœud d'entrée. */
export const dialogueSchema = z.strictObject({
  id: z.string(),
  start: z.string(),
  nodes: z.array(dialogueNodeSchema),
});

// ── Déclencheur ─────────────────────────────────────────────────────────────────────────────────

/** `Trigger` — `rect` (avec son étage `z`, #803) ET `when` en ET, évalués à l'entrée dans la zone. */
export const triggerSchema = z.strictObject({
  id: z.string(),
  rect: rectSchema,
  once: z.boolean().optional(),
  when: conditionSchema.optional(),
  flow: sceneFlowSchema,
});

// ── Rencontre ───────────────────────────────────────────────────────────────────────────────────

/** Camp d'un membre/d'une circonstance de rencontre. */
export const campSchema = z.enum(['party', 'enemies']);
/** `ThreatTier` (`engine/advantagePool.ts`) — palier de Menace (`AA 11 l.53-65`). */
export const threatTierSchema = z.enum(['dangereuse', 'tresDangereuse', 'extreme']);

/** `VictoryCondition` — objectif de victoire ; absent sur la rencontre = `allEnemiesDead`. */
export const victoryConditionSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('allEnemiesDead') }),
  z.strictObject({ type: z.literal('destroyStructure'), edge: architectureEdgeRefSchema }),
  z.strictObject({ type: z.literal('surviveRounds'), rounds: z.number() }),
  z.strictObject({
    type: z.literal('reachZone'),
    rect: z.strictObject({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }),
    camp: campSchema.optional(),
  }),
  /** Reddition à seuil de dommage partiel (#215) — `targetId` = `SceneEntity.id`. */
  z.strictObject({ type: z.literal('woundsThreshold'), targetId: z.string(), belowPercent: z.number() }),
  /** Duel judiciaire (`NADJ 06 l.175-177`) — `threshold` ÉDITABLE, défaut 3. */
  z.strictObject({ type: z.literal('firstBlood'), threshold: z.number().optional() }),
]);

/** `EncounterMember` — RÉFÉRENCE une `SceneEntity` ; n'ajoute que le contexte de CETTE rencontre. */
export const encounterMemberSchema = z.strictObject({
  entityId: z.string(),
  /** Camp au spawn — défaut 'enemy'. */
  side: z.enum(['enemy', 'ally']).optional(),
  /** PNJ allié piloté par l'IA (`Combatant.aiControlled`). Sans effet sur un membre 'enemy'. */
  ai: z.boolean().optional(),
  /** Combat monté (`LDB 14`) : acteur rideable. */
  mount: z.boolean().optional(),
  ridesEntityId: z.string().optional(),
});

/** `EncounterDef` — les circonstances d'Avantage initial (`AA 11 l.53-65`) et la fin de combat. */
export const encounterSchema = z.strictObject({
  id: z.string(),
  members: z.array(encounterMemberSchema).optional(),
  onVictory: sceneFlowSchema.optional(),
  victoryCondition: victoryConditionSchema.optional(),
  /** Camp pris en EMBUSCADE au début du combat (`LDB 13 l.52-81`). */
  surprise: campSchema.optional(),
  maneuverability: campSchema.optional(),
  threat: z.strictObject({ camp: campSchema, tier: threatTierSchema }).optional(),
  terrain: z.strictObject({ camp: campSchema, heavy: z.boolean().optional() }).optional(),
  /** Armes à distance interdites (#471, `NADJ 06 l.181`) — défaut résolu par `banRangedActive`. */
  banRanged: z.boolean().optional(),
});

// ── Couches, zones, murs ────────────────────────────────────────────────────────────────────────

/** `Layer` — `tiles` aplatie (y·w+x), `height` PARALLÈLE en MÈTRES (`LDB 15 l.12`),
 *  `crenellated` parallèle aussi (RENDU PUR : ni passabilité ni LdV). */
export const layerSchema = z.strictObject({
  z: z.number(),
  tiles: z.array(z.string()),
  height: z.array(z.number()).optional(),
  crenellated: z.array(z.string().nullable()).optional(),
});

/** `ZoneArea` — rectangle ou disque de Chebyshev (rayon en CASES). */
export const zoneAreaSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('rect'), x: z.number(), y: z.number(), w: z.number(), h: z.number() }),
  z.strictObject({ kind: z.literal('disc'), cx: z.number(), cy: z.number(), radius: z.number() }),
]);

/** `SceneEffectZone` — sans aucun champ mécanique la zone est DESCRIPTIVE (#782, `isDescriptiveZone`). */
export const sceneEffectZoneSchema = z.strictObject({
  id: z.string(),
  label: z.string(),
  area: zoneAreaSchema,
  presentation: z.enum(['interior', 'exterior']).optional(),
  /** EMPRISE EXACTE (pièce en L) : `area` n'est alors que la boîte englobante (`sceneZoneTiles`). */
  tiles: z.array(ptSchema).optional(),
  blocksLoS: z.boolean().optional(),
  /** Payload `GameOp[]` — vocabulaire UNIQUE partagé avec les zones de Sort (`applyOps`). */
  onCross: z.array(gameOpSchema).optional(),
  perRound: z.array(gameOpSchema).optional(),
  crossTest: flowTestSchema.optional(),
  /** BARRIÈRE : `blockGroups` vide/absent = bloque tout le monde ; sinon ids de Groupes. */
  barrier: z.strictObject({ blockGroups: z.array(z.string()).optional() }).optional(),
  z: z.number().optional(),
});

/** `WallClimb` — nature d'une arête grimpable (`LDB 15 l.53-57`). */
export const wallClimbSchema = z.strictObject({
  kind: z.enum(['ladder', 'surface']),
  difficulty: difficultySchema.optional(),
  /** Surface « bien trop compliquée » sans le Talent Grimpeur (`LDB 15 l.57`). */
  requiresGrimpeur: z.boolean().optional(),
});

/** `WallSeg` — cloison sur ARÊTE. `window` est DÉCORATIF (le mur reste plein). */
export const wallSegSchema = z.strictObject({
  x: z.number(),
  y: z.number(),
  side: wallSideSchema,
  z: z.number().optional(),
  door: z.boolean().optional(),
  /** Porte FERMÉE à l'ouverture de la scène. Absent = ouverte. */
  closed: z.boolean().optional(),
  /** Structure destructible posée SUR l'arête (id de `structures.json`). */
  structure: z.string().optional(),
  appearance: z.string().optional(),
  window: z.boolean().optional(),
  climb: wallClimbSchema.optional(),
});

/** `SceneStationAnchor` — ancre d'une Scène de bataille sur le plan (S2, `battleScenesToStations`). */
export const sceneStationAnchorSchema = z.strictObject({
  sceneId: z.string(),
  pos: z.strictObject({ x: z.number(), y: z.number(), z: z.number().optional() }),
});

// ── La scène ────────────────────────────────────────────────────────────────────────────────────

/**
 * `Scene` (`state/scene.ts:683`) — l'agrégat. Les collections `layers`/`entities`/`dialogues`/
 * `triggers`/`encounters`/`flags`, requises sur le type manuscrit, sont OPTIONNELLES ici : le
 * schéma voit le document AVANT `normalizeScene`, qui les comble au SEUL point d'entrée.
 */
export const sceneSchema = z.strictObject({
  id: z.string(),
  nom: z.string(),
  description: z.string(),
  dimensions: z.strictObject({ w: z.number(), h: z.number() }),
  /** Échelle métrique d'une CASE (m/case) — défaut 2 ; ≥ 4 = Scène MER (`isMerScene`). */
  metresPerTile: z.number().optional(),
  ambiance: z.enum(['interieur', 'exterieur']).optional(),
  /** Classification écologique lue par les attributs de Domaine (`LDB 48 l.690`). */
  environment: z.enum(['rural', 'urbain', 'sauvage']).optional(),
  /** Météo (`LDB 14 l.68-82`) — défaut 'clair', lue par `sceneCombatModifiers`. */
  weather: z.enum(['clair', 'pluie', 'brouillard', 'neige', 'tempete']).optional(),
  /** Id d'un `lightLevels`, ou `'auto'`/absent = suit l'horloge via `ambiance`. */
  ambientLight: z.string().optional(),
  /** NORD de la carte — rotation horaire en degrés `[0,360[` du nord réel (posé par `setNorthDeg`). */
  northDeg: z.number().optional(),
  rest: z
    .strictObject({
      auberge: z.boolean().optional(),
      maison: z.boolean().optional(),
      camp: z.boolean().optional(),
      quality: z.enum(['normale', 'pietre']).optional(),
    })
    .optional(),
  /** Offre de repos PAR ZONE — prioritaire sur `rest` là où le groupe se tient. */
  restZones: z
    .array(
      z.strictObject({
        rect: rectSchema,
        places: restPlacesSchema,
        quality: z.enum(['normale', 'pietre']).optional(),
      }),
    )
    .optional(),
  effectZones: z.array(sceneEffectZoneSchema).optional(),
  /** Ids de pistes du registre audio ; `null` = SILENCE forcé, absent = AUTOMATIQUE. */
  music: z.strictObject({ ambient: z.string().nullable().optional(), combat: z.string().nullable().optional() }).optional(),
  layers: z.array(layerSchema).optional(),
  walls: z.array(wallSegSchema).optional(),
  entities: z.array(sceneEntitySchema).optional(),
  architecture: z.array(architectureBodySchema).optional(),
  dialogues: z.array(dialogueSchema).optional(),
  triggers: z.array(triggerSchema).optional(),
  encounters: z.array(encounterSchema).optional(),
  stations: z.array(sceneStationAnchorSchema).optional(),
  flags: z.record(z.string(), z.boolean()).optional(),
  /** Points d'arrivée nommés — `z` = étage visé (défaut 0, #835 FU-5). */
  entryPoints: z.record(z.string(), z.strictObject({ x: z.number(), y: z.number(), z: z.number().optional() })).optional(),
  startMessage: z.string().optional(),
});

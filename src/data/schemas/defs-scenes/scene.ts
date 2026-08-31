/**
 * Schémas zod des formes d'une SCÈNE (`src/state/scene.ts`) — racine de documents `src/scenes`.
 *
 * ORDRE DU SEAM : ces schémas voient la scène telle qu'elle arrive du JSON, AVANT `normalizeScene`
 * (`src/state/scene.ts`, appelée en fin de `parseProject`). Les collections que `normalizeScene`
 * comble (`layers`/`entities`/`dialogues`/`triggers`/`encounters`/`flags`) sont donc OPTIONNELLES
 * ici, alors que le type manuscrit les déclare requises : un document ancien n'en porte pas.
 *
 * `Effect` et son `Flow` vivent dans `./effets.ts` (les 57 variantes) ; le vocabulaire feuille
 * partagé avec elles vit dans `./communs.ts`. Import de TYPE seul depuis `src/state` — aucun import
 * runtime de la couche state.
 *
 * Une scène est un DOCUMENT EMBARQUÉ du document de projet : elle S'ANNONCE dans la donnée
 * (`type: 'scene'`) et le schéma l'EXIGE (#1552) — même régime que le statbloc embarqué
 * (`./communs.ts` `customStatblockSchema`, `type: 'statblock'`). Son identité est NOMINALE, jamais
 * positionnelle : mesuré sur les 2 racines de `src/scenes` (4 projets, 28 scènes), 28/28 portent
 * `id` ET `label`, et le jeu résout une scène PAR ID — `sceneRegistry` (`src/state/store.ts:182-183`,
 * `registerScene`), le delta d'instance persisté par `sceneId` (`src/state/sceneInstance.ts:9`),
 * l'effet `transition: { scene }` et `worldMap.places[].scene`. Le `type` est posé sur la donnée
 * existante par `PROJECT_MIGRATIONS[6]` (`src/state/worldMap.ts`, `schema` 6 → 7).
 */
import { z } from 'zod';
import { difficultySchema, entityAppearanceSchema } from '../grammaire/valeurs';
import { conditionSchema, flowTestSchema, gameOpSchema } from '../grammaire/mecanique';
import { customStatblockSchema, moneySchema, ptSchema, skillRefSchema, wallSideSchema } from './communs';
import { sceneFlowSchema } from './effets';
import type { AuthoredShipPoste } from '../../../engine/types';
import type { OptionalEntry } from '../../../engine/statEntry';

/** `Dir8` (`state/dir8.ts`) — orientation MONDE éditable, projetée au rendu. */
export const dir8Schema = z.enum(['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO']);
/** Rectangle de zone/déclencheur — `z` = étage (défaut 0). */
export const rectSchema = z.strictObject({ x: z.number(), y: z.number(), w: z.number(), h: z.number(), z: z.number().optional() });
/** Offre de couchage d'une scène/zone (`RestPlaces` sans `bord`, réservé au navire de campagne). */
export const restPlacesSchema = z.strictObject({ auberge: z.boolean().optional(), maison: z.boolean().optional(), camp: z.boolean().optional() });

/** `AuthoredShipPoste` (`engine/types.ts`) — pièce d'artillerie MONTÉE, hydratée au spawn. T3-b. */
export const authoredShipPosteSchema = z.custom<AuthoredShipPoste>();
/** `NavalTraitRef` (`engine/types.ts`) — Amélioration d'INSTANCE d'un navire (MDG 12). */
export const navalTraitRefSchema = z.strictObject({ id: z.string(), value: z.number().optional() });
/** `OptionalEntry` (`engine/statEntry.ts`) — `TraitInstance` OU note composée. T3-b. */
export const optionalEntrySchema = z.custom<OptionalEntry>();
/** `SeatOccupant` (`state/seating.ts:53`) — un RANG du groupe (jamais un id de héros) ou un PNJ de la scène. */
export const seatOccupantSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('party'), rang: z.number() }),
  z.strictObject({ kind: z.literal('entity'), entityId: z.string() }),
]);

// ── Entité de scène ─────────────────────────────────────────────────────────────────────────────

/** Rôle d'une entité de scène. `personnage` = tout être animé (apparence libre via `ref` +
 *  dialogue/quête optionnel) — fusion des anciens `pnj`/`ennemi`, que le combat (encounters) et
 *  l'interaction (dialogueId) ne distinguaient pas. */
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
  /** Empreinte D'INSTANCE d'un projet pré-migration : fossile TOLÉRÉ au parse, DÉPOUILLÉ au
   *  chargement par `stripLegacyFoot` (`src/state/scene.ts`) — jamais une donnée de scène, jamais
   *  lue par le moteur (la physique d'un décor vient de `PropData.foot`). Meurt au reset des saves.
   *  La garde #841 lit ce tag, GATÉ par sa liste nominative (`FOSSILES`, `sceneFieldEditability.mjs`) :
   *  le champ est hors périmètre éditable, et un tag posé sans entrée au registre est ROUGE.
   *  @fossile */
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
/** MASSE de bâtiment (#823, remplace `RoofSection` authoré à la main) : l'INTENTION, jamais la
 *  géométrie du toit — `gameIso/builders/roofs.ts` DÉRIVE pans/faîte/noues/croupes par une formule
 *  UNIQUE (`hauteur(case) = hauteurÉgout + distance(case, bord de la masse) × métresParCase ×
 *  tan(pente)`), et `roomZoneIds` par intersection avec `Scene.effectZones` (plus de redistribution
 *  manuelle). `z` = étage du PLANCHER SOMMET couvert par le toit (le dessous immédiat de la masse) ;
 *  c'est la COUCHE sur laquelle se lit la cote du plancher, jamais l'altitude elle-même : l'égout vaut
 *  la cote la plus HAUTE que `heightAt` porte sous l'emprise à cet étage + `WALL_H_M` — le toit
 *  s'assoit sur le sommet des murs, qui s'assoient sur le relief de LEUR case (cf. `resolveMass`,
 *  `buildWalls`). `levels` = nombre de niveaux couverts DEPUIS `z`
 *  en descendant : il désigne la PLAGE d'étages que la masse coiffe (`roomZoneIds`, couverture,
 *  chevauchement), jamais une hauteur. `footprint` doit être CONTIGU (4-connexe) et
 *  coïncider EXACTEMENT avec le plancher intérieur réel à l'étage `z` — fail-fast dans `buildScene`
 *  sinon (`validateBuildingMasses`, `state/mapSpec.ts`), pas une redevance silencieuse.
 *
 *  Note #829 : `ArchitectureBody.masses` déclarées ici sont des SURCHARGES, plus la règle. Par défaut,
 *  `buildScene` DÉRIVE les masses manquantes depuis le plancher réel (`deriveArchitectureMasses`,
 *  `state/sceneEdit.ts`) — éditer un mur/une pièce fait suivre la toiture sans redéclaration. Une masse
 *  authorée ici CORRIGE la dérivation là où elle se trompe (passage couvert, appentis,
 *  cour à ne pas coiffer via `ArchitectureBody.roofExclusions`, encorbellement voulu). */
export const buildingMassSchema = z.strictObject({
  id: z.string(),
  z: z.number(),
  footprint: z.array(architectureRectSchema),
  levels: z.number(),
  profile: roofProfileSchema,
  /** Pente en DEGRÉS (jamais des mètres par case — c'est cette unité qui a écrasé les toits d'un
   *  facteur deux, #825). */
  pitchDeg: z.number(),
  material: z.string(),
  /** Axe de faîtage (gable/hip) — optionnel, défaut = le long axe de la masse ; OBLIGATOIRE si la
   *  masse est carrée (ambigu, fail-fast plutôt que deviner). Sans effet sur `shed`/`flat`. */
  ridge: z.enum(['x', 'y']).optional(),
  /** Côté d'égout bas — OBLIGATOIRE pour `shed` (aucun défaut deviné), ignoré sinon. */
  eaveSide: eaveSideSchema.optional(),
  /** Masse POSÉE par la dérivation (`deriveArchitectureMasses`, `state/sceneEdit.ts`) et non par un
   *  auteur : re-calculable à volonté — toute re-dérivation jette ces masses et les refait depuis le
   *  plan et `ArchitectureBody.roofDefaults`. Une masse SANS ce drapeau est une SURCHARGE authorée,
   *  jamais écrasée. C'est ce qui rend la dérivation IDEMPOTENTE, donc rejouable dans l'éditeur
   *  (#841) : l'intention de toiture y produit un effet immédiat sur le rendu, qui ne lit QUE les
   *  masses matérialisées. */
  derived: z.literal(true).optional(),
});
/** Intention de toiture pour les masses DÉRIVÉES d'un corps (#829) — réglée dans l'outil Architecture
 *  de l'éditeur ; défaut si absent : `gable`/`ardoise`, pente ADAPTÉE à la portée sous la borne de
 *  comble (cf. `DEFAULT_ROOF_DEFAULTS`/`fittedPitchDeg`, `sceneEdit.ts`).
 *  Cette intention s'applique telle quelle à CHAQUE corps : le plancher réel se décompose en
 *  composantes 4-connexes, et chacune reçoit UNE masse (`deriveArchitectureMasses`, `sceneEdit.ts`),
 *  faîtage le long de sa plus grande dimension. Le profil déclaré ici PRIME sur la lecture de portée
 *  (`ROOF_GABLE_SPAN_MAX_M`) qui, à défaut, choisit entre pignon et croupe. */
export const roofDefaultsSchema = z.strictObject({
  profile: roofProfileSchema,
  /** Pente en DEGRÉS POSÉE par l'auteur : elle ne s'adapte JAMAIS à la portée. ABSENTE : la
   *  dérivation calcule la pente de CHAQUE masse par `fittedPitchDeg` (`sceneEdit.ts`) — pente de
   *  référence rabattue jusqu'à ce que le comble tienne dans `riseMaxStoreys` (#947). */
  pitchDeg: z.number().optional(),
  material: z.string(),
  /** Côté d'égout bas des masses dérivées — OBLIGATOIRE dès que `profile` vaut `shed` (le côté bas
   *  d'un appentis est une intention d'AUTEUR, aucun défaut deviné ; même contrat que
   *  `BuildingMass.eaveSide`, que la dérivation recopie depuis ici). Ignoré par les autres profils. */
  eaveSide: eaveSideSchema.optional(),
  /** BORNE de comble des masses dérivées, en hauteurs d'ÉTAGE (`METRES_PER_LEVEL`) : c'est elle qui
   *  fait s'adapter la PENTE à la portée (#947) — un corps profond porte un toit plus PLAT, sa
   *  couverture ne se découpe jamais. Absente = `DEFAULT_ROOF_DEFAULTS.riseMaxStoreys`. Sans effet
   *  dès que `pitchDeg` est posé : l'intention de l'auteur passe avant la borne. */
  riseMaxStoreys: z.number().optional(),
});
/** `ArchitectureBody` — corps architectural authoré (volumes, façades, toitures). */
export const architectureBodySchema = z.strictObject({
  id: z.string(),
  label: z.string().optional(),
  style: z.string(),
  storeys: z.array(architectureStoreySchema),
  facades: z.array(facadeSectionSchema),
  /** SURCHARGES (#829, cf. doc `buildingMassSchema`) — jamais l'obligation de couvrir tout le bâti à
   *  la main : la dérivation couvre le reste. */
  masses: z.array(buildingMassSchema),
  /** Intention des masses DÉRIVÉES par défaut (#829) — absent = `DEFAULT_ROOF_DEFAULTS`. */
  roofDefaults: roofDefaultsSchema.optional(),
  /** Cases à NE JAMAIS couvrir par la dérivation par défaut (cour intérieure à ciel ouvert…), par
   *  étage — surcharge NÉGATIVE (#829), symétrique des `masses` (surcharge positive). */
  roofExclusions: z.array(z.strictObject({ z: z.number(), rect: architectureRectSchema })).optional(),
});

// ── Dialogue ────────────────────────────────────────────────────────────────────────────────────

/** `DialogueChoice` — `when` gate l'AFFICHAGE, `cost` est débité AVANT le flow. */
export const dialogueChoiceSchema = z.strictObject({
  /** LIBELLÉ du choix — rôle libellé de l'enveloppe (`label`), pas de la prose : c'est l'étiquette
   *  du bouton que le joueur clique, et l'archive de dialogue la stocke comme telle. */
  label: z.string(),
  /** Icône d'affordance (registre `src/ui/icons/`, rendue par `<Icon>` dans `DialogueBox`) — jamais
   *  un emoji collé au `label` (#290, doctrine anti-emoji). Id de string brute (couture UI hors de
   *  `src/state`, cf. CLAUDE.md : la logique reste pure, `<Icon>` valide l'id au rendu). */
  icon: z.string().optional(),
  /** Condition d'AFFICHAGE du choix (algèbre `Condition`, cf. `evalCondition`). Absente = toujours visible. */
  when: conditionSchema.optional(),
  /** Prix de l'option (service payant : auberge, péage, pot-de-vin…). Le choix est RÉPÉTABLE mais
   *  désactivé si on ne peut pas payer ; à la sélection, le montant est débité AVANT le flow. */
  cost: moneySchema.optional(),
  /** LOGIQUE exécutée à la sélection : séquence d'effets + branches `if`/`test` (exécutée par `runFlow`). */
  flow: sceneFlowSchema.optional(),
  /** Id du nœud suivant. */
  next: z.string().optional(),
});
/** `DialogueNode` — `speakerId` = entité de la scène dont le portrait/nom porte CE nœud. */
export const dialogueNodeSchema = z.strictObject({
  id: z.string(),
  /** Id d'une `SceneEntity` de la scène courante → son PORTRAIT et son NOM (label) pour CE nœud.
   *  Permet d'alterner les interlocuteurs dans une même conversation. À défaut, l'interlocuteur de
   *  SESSION (`state.dialogue.speakerId`, posé par `interactEntity` ou `startDialogue.speakerId`). */
  speakerId: z.string().optional(),
  desc: z.string(),
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
  /** Zone du déclencheur — son étage est `rect.z` (défaut 0, rez), comme `SceneEffectZone.z` (#782) :
   *  sans lui, un trigger posé au rez se déclenche depuis/vers l'étage au-dessus (`checkTriggers`, #803). */
  rect: rectSchema,
  once: z.boolean().optional(),
  /** Condition d'ENTRÉE (algèbre `Condition`, cf. `evalCondition`) — combinée en ET avec le `rect` et
   *  évaluée à l'entrée dans la zone. Absente = pas de garde (un pur événement horaire sans position =
   *  `delayedEffect`). Remplace les anciens `condition`/`temporalCondition`. */
  when: conditionSchema.optional(),
  /** LOGIQUE exécutée à l'entrée : séquence d'effets + branches `if`/`test` (exécutée par `runFlow`). */
  flow: sceneFlowSchema,
});

// ── Rencontre ───────────────────────────────────────────────────────────────────────────────────

/** Camp d'un membre/d'une circonstance de rencontre. */
export const campSchema = z.enum(['party', 'enemies']);
/** `ThreatTier` (`engine/advantagePool.ts`) — palier de Menace (`AA 11 l.53-65`). */
export const threatTierSchema = z.enum(['dangereuse', 'tresDangereuse', 'extreme']);

/** OBJECTIF de victoire d'une rencontre (#197) — AUTHORABLE en donnée, lu par `checkBattleOver`.
 *  Absent = `allEnemiesDead` (comportement HISTORIQUE, tous les scénarios existants inchangés).
 *  `destroyStructure` référence l'arête par son identifiant STABLE (x/y/side/z), le même couple que
 *  `structureIsDown`/`Combatant.structureEdge` (bélier-porte, `AA 10 p.120-121`) — la victoire se déclenche
 *  à la BRÈCHE, indépendamment du sort des combattants. `surviveRounds` : victoire posée au début du
 *  Round `rounds + 1` (le groupe a tenu N Rounds complets). `reachZone` réutilise le rectangle de zone
 *  des `Trigger`/`SceneEffectZone` (`inRect`, `combatGeometry.ts`) — aucun 2e mécanisme de zone.
 *  `woundsThreshold` (#215) : REDDITION à seuil de dommage partiel — `targetId` référence l'id
 *  STABLE d'une entité de scène (`SceneEntity.id` = `Combatant.id` au spawn, identité unifiée).
 *  Le RAW ne chiffre AUCUN seuil de reddition (silence confirmé) ; seul précédent chiffré, la
 *  reddition d'un monstre marin à mi-Blessures (`MDG 15 l.143`, `l.166-168`). `belowPercent` reste
 *  une valeur ÉDITABLE par rencontre, sans seuil RAW imposé (CLAUDE.md règle 7).
 *  `firstBlood` (#471) : DUEL JUDICIAIRE — « le premier sang est la première attaque qui cause une
 *  perte de plus de 3 Blessures […] ; un adversaire est incapable de continuer lorsqu'il est réduit
 *  à 0 Blessure » (`NADJ 06 l.175-177`) — les DEUX fins restent actives en parallèle, la seconde étant
 *  la fin standard (0 Blessure, `isOutOfAction`) déjà couverte hors `VictoryCondition`. `threshold`
 *  reste ÉDITABLE (défaut 3, seule valeur chiffrée par le RAW) — sévérité de la charge, CLAUDE.md
 *  règle 7. Testé PAR-COUP (`resolveFirstBlood`, combatFlow.ts) — pas un seuil cumulatif comme
 *  `woundsThreshold`. */
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

/** Membre d'une rencontre : RÉFÉRENCE une `SceneEntity` (kind 'personnage') de la scène — c'est
 *  ELLE qui porte le profil (ref/statblock/apparence/arme/label/facing/combat). Le membre n'ajoute
 *  que le contexte propre à CETTE rencontre (camp, monture). */
export const encounterMemberSchema = z.strictObject({
  /** id de la `SceneEntity` enrôlée. */
  entityId: z.string(),
  /** Camp au spawn : 'ally' pose un combattant du côté des héros (ex. monture prêtée). Défaut 'enemy'. */
  side: z.enum(['enemy', 'ally']).optional(),
  /** PNJ allié piloté par l'IA (`Combatant.aiControlled`) : un allié qui AGIT SEUL (défenseur de siège,
   *  équipage d'une pièce…) au lieu d'être contrôlé par le joueur. Sans effet sur un membre 'enemy'. */
  ai: z.boolean().optional(),
  /** Combat monté (`LDB 14`) : cet acteur est une MONTURE rideable (peut être enfourché). */
  mount: z.boolean().optional(),
  /** id d'entité de la monture chevauchée au spawn (pré-monté) — réf stable (≠ ancien index `rides`). */
  ridesEntityId: z.string().optional(),
});

/** `EncounterDef` — les circonstances d'Avantage initial (`AA 11 l.53-65`) et la fin de combat. */
export const encounterDefSchema = z.strictObject({
  id: z.string(),
  /** Membres référençant des entités de la scène (peuplés par l'éditeur, ou à l'authoring via
   *  `buildEncounter`). SOURCE UNIQUE lue par le runtime — chaque membre pointe une `SceneEntity`
   *  'personnage' qui porte tout le profil (ref/statblock/apparence/arme/`combat.hiddenUntilCombat`). */
  members: z.array(encounterMemberSchema).optional(),
  /** Scène/flag déclenché à la victoire — Flow (UN seul format avec `Trigger.flow`/`DialogueChoice.flow`).
   *  Aplati en `Effect[]` par `finishVictory` (la déférence transition/dialogue + la mesure de récompense
   *  restent sur la séquence plate). */
  onVictory: sceneFlowSchema.optional(),
  /** Objectif de victoire (#197). Absent = `allEnemiesDead` (défaut historique). */
  victoryCondition: victoryConditionSchema.optional(),
  /** Surprise (`LDB 13 l.52-81`) : camp pris en EMBUSCADE au début du combat. Les combattants de ce camp
   *  font un Test opposé de Perception vs la meilleure Discrétion des embusqueurs ; les vaincus gagnent
   *  l'État `Surpris`. Absent = personne n'est surpris. */
  surprise: campSchema.optional(),
  /** Avantage initial — Manœuvrabilité (`AA 11 l.53-65`) : le camp indiqué possède un avantage de
   *  mouvement au début du combat (monté, terrain arboricole/aérien favorable…) → +2 à sa réserve
   *  d'Avantage en mode « Avantage de groupe » (`startAdvantagePools`). Absent = pas de circonstance. */
  maneuverability: campSchema.optional(),
  /** Avantage initial — Menace (`AA 11 l.53-65`) : le camp `camp` représente une menace notoire pour
   *  l'autre camp (`tier` : dangereuse +1, très dangereuse +3, extrême +5) → crédite sa réserve
   *  d'Avantage en mode groupe. Absent = pas de circonstance. */
  threat: z.strictObject({ camp: campSchema, tier: threatTierSchema }).optional(),
  /** Avantage initial — Terrain (`AA 11 l.53-65`) : le camp `camp` tient une position avantageuse
   *  (fortification/couvert léger/hauteur → +1 ; `heavy` : couvert lourd/position décisive type pont
   *  → +2) → crédite sa réserve d'Avantage en mode groupe. Absent = pas de circonstance. */
  terrain: z.strictObject({ camp: campSchema, heavy: z.boolean().optional() }).optional(),
  /** Restriction d'armes à DISTANCE (#471) — Duel judiciaire (`NADJ 06 l.181`) : « les parties concernées
   *  […] ont normalement le libre choix des armes bien que la plupart des lois locales interdisent de
   *  faire appel à des projectiles. » DÉFAUT SÉMANTIQUE (#471 défaut 1) : « la plupart » = interdit PAR
   *  DÉFAUT quand `victoryCondition.type === 'firstBlood'` — champ ABSENT sur un duel = armes à distance
   *  INTERDITES ; l'auteur DÉROGE explicitement en posant `banRanged: false` (« pas toutes »). Champ
   *  SÉPARÉ de `victoryCondition` (une variante locale peut l'imposer à une rencontre qui n'est pas un
   *  `firstBlood`, valeur explicite `true`). Hors `firstBlood`, champ absent = armes à distance autorisées
   *  (défaut historique). Défaut résolu par `banRangedActive` (SEUL point), consommé par
   *  `resolveAttack`/`firedAttackBlock` (joueur ET IA). */
  banRanged: z.boolean().optional(),
});

// ── Couches, zones, murs ────────────────────────────────────────────────────────────────────────

/** Une COUCHE d'empilement de la scène : son index discret `z` (0 = couche de base) — identité
 *  d'empilement, clé de pathfinding ET clé de tri de profondeur — et sa grille de tuiles (w×h aplatie).
 *  `height[]` est PARALLÈLE à `tiles` (indexation y·w+x) : la hauteur RÉELLE de la surface, en MÈTRES
 *  (échelle RAW 2 m/case, `LDB 15 l.12`). Absent = tout à 0 m. PORTEUSE (plus cosmétique) : pilote la
 *  marchabilité (rampe/falaise via `surfaceLink`), la distance/−10 en combat et la chute. Le RENDU pose
 *  la tuile au lift métrique (`metricToLift(height)`) ; le TRI garde `z` (occlusion dessus/dessous). */
export const layerSchema = z.strictObject({
  z: z.number(),
  tiles: z.array(z.string()),
  height: z.array(z.number()).optional(),
  /** CRÉNELURE (RENDU PUR) : parallèle à `tiles` (`y·w+x`). `null` = pas de crénelure ; une chaîne = id de
   *  structure crénelée (`structureAppearance.json`) → le crest builder (`crestGeometry`) en dérive des MERLONS
   *  sur le PÉRIMÈTRE (arête dont le voisin même-z n'est pas crénelé) — jamais à l'intérieur. Marqueur de
   *  DÉCORATION seulement (comme un toit auto-dessiné) : n'affecte NI la passabilité NI la LdV plongeante. */
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

/** Nature d'une arête grimpable (`WallSeg.climb`). */
export const wallClimbSchema = z.strictObject({
  /** `ladder` = échelle ou surface facile (pas de Test, `LDB 15 l.53`) ; `surface` = paroi à prises
   *  (Test d'Escalade, `l.57`). */
  kind: z.enum(['ladder', 'surface']),
  /** Surface uniquement — difficulté du Test d'Escalade. `LDB 15 l.57` la laisse « définie par le MJ » ;
   *  sans MJ (règle 7) c'est un arbitrage ÉDITABLE par arête. Absent = `intermediaire` (défaut moteur). */
  difficulty: difficultySchema.optional(),
  /** Surface uniquement — paroi « bien trop compliquée » sans le Talent Grimpeur (`LDB 15 l.57`). */
  requiresGrimpeur: z.boolean().optional(),
});

/** `WallSeg` — cloison sur ARÊTE. `door` = franchissable (porte) ; `z` = étage. */
export const wallSegSchema = z.strictObject({
  x: z.number(),
  y: z.number(),
  side: wallSideSchema,
  z: z.number().optional(),
  door: z.boolean().optional(),
  /** Porte FERMÉE par défaut à l'ouverture de la scène (bloque vue+passage tant qu'on ne l'ouvre pas).
   *  Absent = ouverte par défaut (comportement historique : une porte est une ouverture franchissable). */
  closed: z.boolean().optional(),
  /** Structure destructible posée SUR l'arête (id de `structures.json`, ex. `porte-de-ville`). Tant
   *  qu'elle tient, l'arête bloque passage+vue comme un mur plein ; une fois ABATTUE (`structureIsDown`),
   *  l'arête devient une BRÈCHE franchissable et transparente. */
  structure: z.string().optional(),
  /** Apparence de rendu (`structureAppearance.json`) indépendante de `structure`. N'affecte ni
   *  résistance, ni couvert, ni collision : absent = apparence dérivée de la structure/façade. */
  appearance: z.string().optional(),
  /** DÉCORATIF uniquement : l'arête porte une FENÊTRE (croisée vitrée) au rendu. Un mur fenêtré reste un
   *  mur PLEIN (vitre SERTIE, pas une ouverture) — il bloque passage/vue/vision/marchabilité EXACTEMENT
   *  comme un mur nu (`window` n'est lu par AUCUNE règle de combat : ni `wallIsOpen`, ni `vision`, ni
   *  `isWalkable`). N'affecte que l'apparence iso + POV (nuit : vitre ambrée émissive). */
  window: z.boolean().optional(),
  /** ESCALADABLE (`LDB 15 l.53-57`) : l'arête sépare deux surfaces de hauteurs différentes (une FALAISE au
   *  sens `surfaceLink` — infranchissable à pied) qu'un Personnage peut GRIMPER.
   *  Bloque toujours passage+vue comme un mur PLEIN (une falaise n'est pas une ouverture) : la grimpe est
   *  un geste EXPLICITE, pas un franchissement de pathfinding. Résolu par `state/climbMove`. */
  climb: wallClimbSchema.optional(),
});

/** Ancre AUTHORÉE d'une Scène de bataille (S2) sur le plan : `MassBattleState.pool` = l'id d'une
 *  Scène de bataille, `ActivityDef` contexte 'bataille-round', posée sur une case de la carte. La
 *  Puissance des armées reste une abstraction NON rendue — seul l'emplacement de l'ACTION est posé.
 *  Consommé par `battleScenesToStations` (state/stations.ts) ; absence d'ancre → repli déterministe
 *  côté consommateur. */
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
  type: z.literal('scene'),
  id: z.string(),
  label: z.string(),
  /** Prose de la Scène — `.min(1).optional()`, comme l'enveloppe de document
   *  (`grammaire/document.ts`) : une prose ABSENTE est une CLÉ ABSENTE, jamais une chaîne vide (le
   *  troisième état, vu « présent » par les uns et « absent » par les autres). */
  desc: z.string().min(1).optional(),
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
  /** `SeatAssignments` (`state/seating.ts:65`) — `propId → slotId → occupant` (rang du groupe ou entité). */
  seatAssignments: z.record(z.string(), z.record(z.string(), seatOccupantSchema)).optional(),
  architecture: z.array(architectureBodySchema).optional(),
  dialogues: z.array(dialogueSchema).optional(),
  triggers: z.array(triggerSchema).optional(),
  encounters: z.array(encounterDefSchema).optional(),
  stations: z.array(sceneStationAnchorSchema).optional(),
  flags: z.record(z.string(), z.boolean()).optional(),
  /** Points d'arrivée nommés — `z` = étage visé (défaut 0, #835 FU-5). */
  entryPoints: z.record(z.string(), z.strictObject({ x: z.number(), y: z.number(), z: z.number().optional() })).optional(),
  startMessage: z.string().optional(),
});

/**
 * Accès typé à NOTRE base de jeu — APP-OWNED et ÉDITABLE (éditeur de données DEV in-app,
 * écran 'dataEditor'). Les *.json de ce dossier sont la SOURCE CANONIQUE app-owned, curée à la main :
 * aucune migration ne les régénère.
 */
import type { EntityAppearance } from '../engine/authoringAppearance';
import type { RigSpeciesId } from '../gameIso/rig/appearance';
import type { SourceRef, SecondaryRef, RaceKey, RefCareerId } from './schemas/common';
import { slugId } from './slug';
import { norm } from '../lib/normalize';
import characteristicsJson from './characteristics.json';
import speciesJson from './species.json';
import classesJson from './classes.json';
import careersJson from './careers.json';
import careerLevelsJson from './careerLevels.json';
import skillsJson from './skills.json';
import talentsJson from './talents.json';
import etatsJson from './etats.json';
import psychologyJson from './psychology.json';
import maladiesJson from './maladies.json';
import traitsJson from './traits.json';
import qualitiesJson from './qualities.json';
import mutationsJson from './mutations.json';
import mutationTablesJson from './mutationTables.json';
import trappingsJson from './trappings.json';
import vehiclesJson from './vehicles.json';
import structuresJson from './structures.json';
import structureAppearanceJson from './structureAppearance.json';
import reliefMaterialsJson from './reliefMaterials.json';
import roofMaterialsJson from './roofMaterials.json';
import ambianceJson from './ambiance.json';
import navalTraitsJson from './naval-traits.json';
import navalPortsJson from './naval-ports.json';
import lieuxServicesJson from './lieux-services.json';
import seaShantiesJson from './sea-shanties.json';
import crewRolesJson from './crew-roles.json';
import crewTestTypesJson from './crew-test-types.json';
import weaponGroupsJson from './weaponGroups.json';
import qualitySubtypesJson from './qualitySubtypes.json';
import qualityTypesJson from './qualityTypes.json';
import groupsJson from './groups.json';
import breathTypesJson from './breath-types.json';
import damageTypesJson from './damage-types.json';
import creaturesJson from './creatures.json';
import spellsJson from './spells.json';
import maneuversJson from './maneuvers.json';
import domainsJson from './domains.json';
import lightLevelsJson from './lightLevels.json';
import propsJson from './props.json';
import eyesJson from './eyes.json';
import hairsJson from './hairs.json';
import calendarMonthsJson from './calendarMonths.json';
import calendarIntercalaryJson from './calendarIntercalary.json';
import calendarWeekdaysJson from './calendarWeekdays.json';
import calendarPhasesJson from './calendarPhases.json';
import weatherJson from './weather.json';
import ventsTourbillonnantsJson from './vents-tourbillonnants.json';
import symptomsJson from './symptoms.json';
import detailsJson from './details.json';
import starsJson from './stars.json';
import astrologyJson from './astrology.json';
import locationsJson from './locations.json';
import booksJson from './books.json';
import namesJson from './names.json';
import raceAppearanceJson from './raceAppearance.json';
import godsJson from './gods.json';
import pregensJson from './pregens.json';
import oupsJson from './oups.json';
import interludeEventsJson from './interludeEvents.json';
import peripetiesJson from './peripeties.json';
import massBattleJson from './mass-battle.json';
import grappleJson from './grapple.json';
import reglesJson from './regles.json';
import disponibiliteJson from './disponibilite.json';
import waterExposureJson from './water-exposure.json';
import nightStakesJson from './night-stakes.json';
import axesJson from './axes.json';
import navalProgressionJson from './naval-progression.json';
import seaNavigationJson from './sea-navigation.json';
import seaPerilsJson from './sea-perils.json';
import seaWeatherJson from './sea-weather.json';
import shipConstructionJson from './ship-construction.json';
import riverNavigationJson from './river-navigation.json';
import { CharKey, CHAR_LABELS, Weapon, VehicleData, StructureData, Availability } from '../engine/types';
import type { MutationData, MutationTable } from './mutations'; // type-only (évite le cycle data→mutations→engine→data)
import type { DiseaseDef } from '../engine/disease'; // type-only (le runtime de disease.ts importe `maladies` d'ici)
import type { PowerEstimateRow, MightModifierRow, WarMachineRow, StructureRow as MassBattleStructureRow, HazardRow } from '../engine/massBattle'; // type-only (le runtime de massBattle.ts importe ces tableaux d'ici)
import { type DiceSpec, formatDice } from '../engine/dice';
import { SIZE_LABEL, sizeFromTalents } from '../engine/size'; // runtime : registre feuille (data/sizes.json + engine/qualities/ids), sans cycle vers data/index
import type { PregenDef } from './pregens'; // type-only (pregens.ts importe la donnée d'ici)
import type { OupsRow } from './oups';
import type { InterludeEvent } from './interludeEvents';
import type { Peripetie } from './peripeties';
import type { CharacteristicsData } from './schemas/defs/characteristics';
import type { AxesData } from './schemas/defs/axes';
import type { NavalProgressionData } from './schemas/defs/naval-progression';
import type { SeaNavigationData } from './schemas/defs/sea-navigation';
import type { SeaPerilsData } from './schemas/defs/sea-perils';
import type { SeaWeatherData } from './schemas/defs/sea-weather';
import type { ShipConstructionData } from './schemas/defs/ship-construction';
import type { RiverNavigationData } from './schemas/defs/river-navigation';

/** Règle d'EMPOIGNADE en DONNÉE (LDB 14 l.155-169) : `init` = ops à la touche d'une Empoignade déclarée
 *  (Empêtré + relation via le flag `grapple`) ; `win` = les 3 options du Test opposé GAGNÉ (l.161), appliquées
 *  avec `ctx.sl = DR`. La mécanique vit ICI (GameOp éditables), le flux `pendingGrapple` n'orchestre que le choix. */
export interface GrappleRule {
  init: import('../engine/ops').GameOp[];
  win: { damage: import('../engine/ops').GameOp[]; entangle: import('../engine/ops').GameOp[]; free: import('../engine/ops').GameOp[] };
  source?: SourceRef;
}
export const GRAPPLE = grappleJson as GrappleRule;

/** Mode d'exposition hydrique (MSRC 16 p.91) : ingestion volontaire (« boit de l'eau de rivière sans
 *  la faire bouillir ») ou immersion (chute/nage — « uniquement à l'immersion » pour le tableau 2). */
export type WaterExposureMode = 'ingestion' | 'immersion';
/** Dérivation AUTOMATIQUE d'un modificateur d'exposition depuis le Combatant (tableau 2 « Blessures et
 *  États », MSRC p.91) : PB restants/perdus, PAR pion d'un État, présence d'un État. */
export type WaterExposureAuto =
  | { kind: 'woundsRemaining'; op: '<='; value: number }
  | { kind: 'woundsLost'; op: '>='; value: number }
  | { kind: 'woundsLost'; op: 'between'; min: number; max: number }
  | { kind: 'perCondition'; condition: string }
  | { kind: 'hasCondition'; condition: string };
/** Un modificateur d'exposition hydrique : tableau 1 « Source d'eau » (choix d'AUTEUR de la zone d'eau)
 *  ou tableau 2 « Blessures et États » (dérivé du Combatant via `auto`). « Tous les modificateurs
 *  peuvent être cumulés » (MSRC p.91). NB : « Par État Assommé » (MSRC) → id LDB `sonne` (le LDB 16 n'a
 *  pas d'État « Assommé » ; le même chapitre écrit « État *Sonné* » p.92 — glissement de traduction). */
export interface WaterExposureModifier {
  id: string;
  label: string;
  mod: number;
  appliesTo: WaterExposureMode[];
  table: 'source-d-eau' | 'blessures-et-etats';
  auto?: WaterExposureAuto;
}
/** Tables d'exposition hydrique (MSRC 16 p.91) : Test de Résistance Intermédiaire modifié ; raté →
 *  d100 « +10 pour chaque DR négatif » → maladie CONTRACTÉE (le Test d'exposition EST le test — pas de
 *  second Test de Contraction). `rerollUnlessWounded` : « Relancez si le Personnage n'est pas blessé ». */
export interface WaterExposureData {
  id: string;
  label: string;
  desc: string;
  test: { skillId: string; difficulty: import('../engine/types').Difficulty };
  rollModPerNegativeSL: number;
  modifiers: WaterExposureModifier[];
  diseases: { min: number; max: number; disease: string; rerollUnlessWounded?: boolean }[];
  source: SourceRef;
}
export const WATER_EXPOSURE = waterExposureJson as WaterExposureData;

/** Enjeu VERBATIM (règle 5, #331) d'un `kind` d'étape de la cascade de nuit (`src/state/restFlow.ts`
 *  `nightStake`) — un `kind` absent du catalogue n'affiche rien (surfaçage progressif). */
export interface NightStakeEntry {
  /** Identité STABLE + libellé FR (#422, exposition Codex) — distincts de `kind` (vocabulaire lu par
   *  `nightStake`), ajoutés pour la navigation/l'édition. */
  id: string;
  label: string;
  kind: string;
  stake: string;
  source: SourceRef;
}
export const NIGHT_STAKES = nightStakesJson as NightStakeEntry[];

export interface SpeciesData {
  /** id STABLE (slug du libellé) — cible de `Combatant.species`, pregens, draft. Le `label` ne sert
   *  qu'à l'affichage (`speciesSingular`). */
  id: string;
  label: string;
  /** Race (famille d'espèces) pour le groupage d'affichage : « Humains (Middenheim) » → « Humains ».
   *  DONNÉE requise (garde-fou data-wellformed) — plus aucune dérivation regex du libellé. */
  family: string;
  /** Variante régionale/sous-espèce (« Middenheim », « Norse »…) — absent pour l'espèce nominale. */
  variant?: string;
  /** id STABLE (`RaceKey`, #313) — colonne des tables Âge/Taille/Yeux/Cheveux (`ageBase`/`ageRoll`/
   *  `heightBase`/`heightRoll`/`hairs.color`/`eyes.color`). */
  refChar: RaceKey;
  /** id STABLE (`RefCareerId`, #313) — colonne du Tableau des Classes et Carrières aléatoires
   *  (`CareerData.rand`). */
  refCareer: RefCareerId;
  rand: number;
  desc: string;
  movement: number;
  fate: { fate: number; resilience: number; extra: number };
  baseChar: Partial<Record<CharKey, number>>;
  /** Compétences d'espèce (`AdvancementRef[]` ; positionnel +5/+3 — lu via `advancementLabel`). */
  skills: AdvancementRef[];
  /** Talents d'espèce (`AdvancementRef[]` : {ref}, {choice} « A ou B », {random} « N aléatoire », {wildcard}). */
  talents: AdvancementRef[];
  source: SourceRef;
  /** Racial de Groupe ÉDITABLE (Traits psy ciblés, LDB 21) — surcharge la dérivation par label
   *  (`engine/groups`). Absent = racial auto-dérivé du `label` d'espèce. */
  group?: string;
  /** Seuil d100 de mutation PHYSIQUE (LDB 19 l.87-91 : d100 ≤ seuil → corps, sinon esprit) :
   *  Elfe 0, Nain 5, Halfling 10, Humain 50. Ogre 10 (ADE II « Ogres et Mutations »). ABSENT = défaut
   *  Humain (50) — le Gnome y est rattaché par NADJ « Gnomes et Corruption » (« mutent comme les humains »). */
  mutationBodyMax?: number;
  /** Habillage de l'APERÇU (créateur, carte de race #431) — id de carrière ICONIQUE et COMMUNE à
   *  l'espèce (flavor de vitrine, pas une règle) : la tuile de famille montre un personnage vêtu
   *  plutôt qu'une tunique nue. Absent = pas de tenue (repli existant). */
  preview?: { career?: string };
  /** Trait RACIAL de l'espèce (#572) — MÊME forme structurée que les Traits de créature du bestiaire
   *  (`import('../engine/statEntry').TraitInstance`, jamais une glose de règle en `desc`) : Ogre porte
   *  `{id:'ogre'}` (ADE2 « Ogres et Mutations » l.708 « Un Lourd Fardeau », encombrance/consommation
   *  ×2 lues par `traitEncumbranceFactor`/`traitConsumptionFactor` sur `Combatant.traits`). La Taille
   *  (LDB 05 p.342) N'EST PAS un trait — elle est portée par le TALENT Massif/Petit (déjà présent
   *  dans `talents`, lu par `createHero`). Posé sur `Combatant.traits` à `createHero`. Absent = aucun
   *  trait racial mécanique (espèce sans règle raciale hors talents/skills). */
  traits?: import('../engine/statEntry').TraitInstance[];
}
export interface ClassData {
  /** id STABLE (slug du libellé) — cible de `CareerData.class`. */
  id: string;
  label: string;
  /** Possessions de départ (`TrappingRef` : id du catalogue + quantité, ou `{text}` flavor hors catalogue). */
  trappings: TrappingRef[];
  desc: string;
  source: SourceRef;
}
export interface CareerData {
  /** id STABLE (slug du libellé) — cible de `Combatant.career`, `CareerLevelData.career`, pregens. */
  id: string;
  label: string;
  /** Forme féminine d'AFFICHAGE (le LDB n'imprime que le masculin — féminisation standard MAISON) ;
   *  absent = forme épicène (identique au masculin). Lu par `careerLabelFor` (bord UI). */
  labelF?: string;
  /** `id` de la Classe (`ClassData.id`) — réf d'entité, ≠ libellé. */
  class: string;
  /** id d'une tenue spécifique (`TENUE_BY_ID`) réutilisée par cette carrière quand son rendu
   *  reprend la tenue d'une autre carrière (variants MDG « (Côtier) », MDG 09 l.255/343/458). */
  tenue?: string;
  /** Tableau des Classes et Carrières aléatoires (LDB 05 l.197+) : borne haute d100 par colonne
   *  d'espèce (`SpeciesData.refCareer`). Clé ABSENTE = carrière INDISPONIBLE pour cette espèce (l.360). */
  rand: Partial<Record<RefCareerId, number | null>>;
  desc: string;
  source: SourceRef;
}
export interface CareerLevelData {
  label: string;
  /** Forme féminine d'AFFICHAGE du niveau (MAISON, cf. `CareerData.labelF`) ; absent = épicène. */
  labelF?: string;
  /** `id` de la Carrière (`CareerData.id`) — réf d'entité, ≠ libellé. */
  career: string;
  level: number;
  /** Compétences/talents d'emplacement (`AdvancementRef[]` : {ref}/{wildcard}/{choice}) — lus via
   *  `advancementLabel` (slotsOfLevel) ou structure. */
  skills: AdvancementRef[];
  talents: AdvancementRef[];
  /** Possessions de niveau (`TrappingRef` : id catalogue + quantité « (3) », ou `{text}` flavor). */
  trappings: TrappingRef[];
  /** Caractéristiques de carrière (clés `CharKey` — « CT », « F »… ; pas de libellé, multilangue). */
  characteristics: CharKey[];
  status: string;
}
/** Entrée `specs[]` d'une Compétence/Talent — id STABLE (résolu par `specLabel`, cf. `langue`/
 *  `chevaucher`/`discretion`/`art`/talent `resistance`) + libellé d'affichage FR. Un domaine
 *  `specsSource` n'a PAS de `specs[]` (le pool DÉRIVE du registre partagé, cf. `specIdsOf`). */
export type SpecEntry = { id: string; label: string };
/** id d'une entrée `specs[]`. */
export function specEntryId(e: SpecEntry): string {
  return e.id;
}
/** Libellé d'affichage d'une entrée `specs[]`. */
export function specEntryLabel(e: SpecEntry): string {
  return e.label;
}
/** Registre partagé qui DÉRIVE le pool d'ids d'une `specs[]` (résolu en libellé par `specLabel`, énuméré
 *  par `wildcardSpecs`) — chaque valeur pointe UNE entrée du catalogue `SPEC_SOURCES` (SSOT, fin des
 *  `specs[]` maintenues à la main qui dérivaient) : `weaponGroupsMelee`/`weaponGroupsRanged` (Corps à
 *  corps / Projectiles — ids de `weaponGroups.json` filtrés par `combat`), `winds` (Focalisation —
 *  Domaines à `wind` de `domains.json`, AFFICHE le Vent), `arcaneDomains` (Magie des Arcanes — Domaines
 *  `arcane` de `domains.json`, AFFICHE le Lore), `cultBlessings`/`cultMiracles`/`cultChaos` (Béni /
 *  Invocation / Magie du Chaos — `gods.id` filtrés par `blessings`/`miracles`/`chaosSpells`, AFFICHE le
 *  nom du dieu), `seaShanties` (Chanson de marin — ids de `sea-shanties.json`). Sources d'ARGUMENT de Trait
 *  (Immunité, Peur, Vulnérabilité, Mutation, Souffle…) : `groups` (Groupe d'appartenance — `groups.json`),
 *  `diseases` (Maladie — `maladies.json`), `sizes` (catégorie de Taille — `engine/size`), `mutations`
 *  (Mutation — `mutations.json`), `breathTypes` (Type de Souffle — `breath-types.json`), `damageTypes`
 *  (Immunité aux Dégâts — `damage-types.json`, matché aussi par `unlessImmune` des Flows), `weaponsMelee`/
 *  `weaponsRanged` (Arme / À distance, LDB 85 l.338 — `arg` = une arme PRÉCISE du catalogue `trappings`
 *  filtrée par `type`, `specsOpen` car ces traits acceptent aussi une attaque naturelle/générique hors
 *  catalogue). Absent = specs inline (`SpecEntry[]`). */
export type SpecsSource =
  | 'weaponGroupsMelee'
  | 'weaponGroupsRanged'
  | 'winds'
  | 'arcaneDomains'
  | 'cultBlessings'
  | 'cultMiracles'
  | 'cultChaos'
  | 'seaShanties'
  | 'groups'
  | 'diseases'
  | 'sizes'
  | 'mutations'
  | 'breathTypes'
  | 'damageTypes'
  | 'weaponsMelee'
  | 'weaponsRanged';
export interface SkillData {
  /** Identifiant STABLE (slug du libellé d'origine) — cible des références structurées, robuste au
   *  renommage du `label`. Source unique pour `findSkillById`. */
  id: string;
  label: string;
  characteristic: import('../engine/types').CharKey;
  type: string;
  /** Spécialisations inline (`SpecEntry[]`) — ABSENT quand `specsSource` est présent (le pool DÉRIVE
   *  alors du registre partagé, cf. `specIdsOf` : plus de liste maintenue à la main). */
  specs?: SpecEntry[];
  /** Source du pool de spéc (via `SPEC_SOURCES`/`specIdsOf`/`specLabel`) : FERMÉE. Si présent, les `spec`
   *  des instances de cette Compétence sont des ids résolus via ce registre partagé — `weaponGroupsMelee`/
   *  `weaponGroupsRanged` (Corps à corps / Projectiles → ids de `weaponGroups.json` filtrés par `combat`)
   *  ou `winds` (Focalisation → Domaines à Vent de `domains.json`, AFFICHE le Vent) — et `specs[]` est
   *  ABSENT. Sans `specsSource` = specs inline (`SpecEntry[]`). */
  specsSource?: SpecsSource;
  /** Le domaine accepte-t-il un TEXTE LIBRE hors `specs[]` (Métier, Savoir-région) ? `true` = OUVERT —
   *  `specs[]` n'est qu'un historique/suggestions, pas une liste fermée. Absent/`false` = FERMÉ — la
   *  valeur `spec` d'une instance DOIT être un id de `specs[]` (garde-fou `refs-migrated.test.ts`). */
  specsOpen?: boolean;
  desc: string;
  source: SourceRef;
  /** Test « impliquant un déplacement » (LDB 16 l.37/85) : ciblé par les pénalités d'État À Terre /
   *  Empêtré (`movementOnly`). Classification de COMPÉTENCE portée par la DONNÉE (éditable au Codex),
   *  lue par `engine/conditions.testStatePenalty` — plus de liste d'ids en dur. */
  movement?: boolean;
  /** Test « impliquant l'audition » (LDB 16 l.29) : ciblé par la pénalité d'État Assourdi (`hearingOnly`).
   *  Classification de COMPÉTENCE portée par la DONNÉE (Perception — l'ouïe est un de ses sens), lue par
   *  `engine/conditions.testStatePenalty`. Approximation assumée : le −10 d'Assourdi ne s'applique qu'aux
   *  Tests des Compétences marquées `hearing` (faute d'un tag « ce Test précis fait appel à l'ouïe »). */
  hearing?: boolean;
  /** Application de COMBAT « cumuler l'Avantage » (LDB 09 l.60/305-308) : passer son tour à réussir un Test
   *  de cette Compétence donne +1 Avantage, jusqu'à un maximum égal au Bonus de la Caractéristique `cap`
   *  (Intuition/Savoir/Survie → Int ; Prière → Soc). Lu par `engine/skillCombatApps.skillAdvantageCap`. */
  combatAdvantage?: { cap: CharKey };
  /** Substitution en COMBAT d'une Compétence sociale à la Compétence de combat (LDB 09) : Intimidation
   *  « à la place de Corps à corps … face à ceux qui ont peur de vous » (l.287), Dressage « au lieu de
   *  Corps à corps » après avoir instillé la peur (l.207). `role` = défense / attaque / les deux ; `gate`
   *  = condition d'accès (`fear` : l'adversaire est sous une Peur/intimidation SOURCÉE par ce personnage).
   *  Lu par `engine/skillCombatApps`. */
  combatSubstitute?: { role: 'defense' | 'attack' | 'both'; gate: 'fear' };
  /** OUTIL requis par la Compétence (Crochetage → outils de crochetage, LDB 09 l.168 : « Les Niveaux de
   *  Difficulté supposent l'utilisation d'outils de crochetage. Des crochets improvisés… peuvent être
   *  utilisés avec une pénalité de -10 ») : `capability` = clé `ItemCapabilities` que doit porter un
   *  objet POSSÉDÉ de l'acteur (lecture NON gatée sur le port, comme `isRations`) ; sans un tel objet,
   *  `withoutMod` s'applique au Test (`testValue`). GÉNÉRIQUE — toute compétence-à-outil se déclare en
   *  donnée (skills.json), zéro code par objet. */
  tool?: { capability: keyof ItemCapabilities; withoutMod: number };
}
/** UN « matcher » de Test (recodage de la ligne « Tests : » du livre, cf. `TalentTest`) : à quel(s)
 *  Test(s) le talent se rapporte. `skill` (id de Compétence, XOR `char`) OU `char` (Caractéristique nue).
 *  `spec` = spécialisation FIXE ; `specFromInstance` = « (Au choix) » → matche la spec CHOISIE de
 *  l'instance (`t.spec`). `when` = contexte MÉCANISABLE (Condition combat — auto si vraie) ; `manual` =
 *  contexte NARRATIF inmécanisable (« quand vous soulevez ») → advisory, JAMAIS auto-appliqué. */
export interface TestMatch {
  skill?: string;
  char?: import('../engine/types').CharKey;
  spec?: string;
  specFromInstance?: boolean;
  /** EXCLUT une spécialisation (matche toute spec SAUF celle-ci) — Linguistique « Langue (toutes) » qui
   *  « ne fonctionne pas avec Langue (Magick) » : `{ skill:'langue', exceptSpec:'magick' }` (id, Phase 3). */
  exceptSpec?: string;
  when?: import('../state/flow').Condition;
  manual?: boolean;
}
/** Champ « Tests » d'un Talent (LDB 10 : +1 DR/niveau sur un Test lié RÉUSSI). `raw` = la ligne du livre
 *  VERBATIM (affichage Codex, rule 5) ; `matches` = la forme STRUCTURÉE id-based lue par la logique
 *  (`talentTestSLBonus`/`castTestTalentDR`) — la logique ne lit JAMAIS `raw`. */
export interface TalentTest {
  raw: string;
  matches: TestMatch[];
}
export interface TalentData {
  /** Identifiant STABLE (slug du libellé d'origine) — cible des références structurées, robuste au
   *  renommage du `label`. Source unique pour `findTalentById`. */
  id: string;
  label: string;
  /** Maxi d'acquisitions (LDB 10 « Schéma des Talents ») : un nombre fixe, ou le BONUS d'une
   *  caractéristique (`{bonusOf}`, structuré — remplace la chaîne « Bonus de X » re-parsée par regex),
   *  ou `null` = sans limite (ex-« Aucun »). */
  max: number | { bonusOf: import('../engine/types').CharKey } | null;
  /** Ligne « Tests » recodée : `{ raw verbatim (Codex), matches[] structuré (logique) }`. `null` = le
   *  talent ne se rapporte à aucun Test. */
  test: TalentTest | null;
  desc: string;
  /** Lecture ALTERNATIVE « Avantage de groupe » (Aux Armes, Annexe III — l.4347-4442), verbatim. Affichée
   *  à la place de `desc` quand la règle `combat-aa-avantage-groupe` est active (Compendium/Codex). Le champ
   *  MÉCANIQUE correspondant est `combat.aa`. Absent = le Talent ne change pas en mode groupe. */
  descAA?: string;
  specs?: SpecEntry[];
  /** Catégorie de Taille CONFÉRÉE par le talent (Massif → `grande`, Petit → `petite`, LDB 05 p.342) —
   *  lue par `createHero` (#572), même vocabulaire que la Taille de créature (`SizeCategory`). */
  size?: import('../engine/size').SizeCategory;
  /** Source du pool de spéc (via `SPEC_SOURCES`/`specIdsOf`/`specLabel`) : `arcaneDomains` (Magie des
   *  Arcanes → Domaines `arcane` de `domains.json`, AFFICHE le Lore), `cultBlessings`/`cultMiracles`/
   *  `cultChaos` (Béni / Invocation / Magie du Chaos → `gods.id` filtrés, AFFICHE le nom du dieu) ou
   *  `seaShanties` (Chanson de marin). Quand présent, `specs[]` est ABSENT (le pool dérive). */
  specsSource?: SpecsSource;
  /** Le domaine de ce Talent accepte-t-il un TEXTE LIBRE hors `specs[]` ? Même sémantique que
   *  `SkillData.specsOpen` (absent/`false` = FERMÉ, `spec` DOIT être un id de `specs[]`). */
  specsOpen?: boolean;
  /** Borne haute de plage d100 sur le Tableau des Talents aléatoires (null = hors table). */
  rand?: number | null;
  source: SourceRef;
  /** Effets MÉCANIQUES authorés (déclencheur → ops du Flow) — Talents « effet sur événement » (Assaut
   *  féroce `onHit`, Frappe réactive `onCharged`…), appliqués par `state/triggeredEffects` exactement comme
   *  les traits. Type-only (le moteur reste pur). Édité au Codex par `TriggeredEffectsField`. */
  effects?: import('../state/flow').TriggeredEffect[];
  /** Modificateurs PASSIFS continus (Coup puissant, Dur à cuire…) en `GameOp[]` — MÊME vocabulaire que les
   *  sorts/traits, lus par le collecteur passif (`talentPassiveMods` → `passiveMods`, kind `intrinsèque`,
   *  répété par niveau). Édité au Codex par `GameOpEditor`. L'octroi d'attaque gratuite (Frénésie) vit ici :
   *  `grantFreeAttack{when:'available'}`, lu par `availableAttacks`. */
  passive?: import('../engine/ops').GameOp[];
  /** Capacités de combat/jeu (LDB 10) en DONNÉE : sac de flags lu par `featuresOf`/`dispatch` (Coup
   *  puissant `meleeDamageBonus`, Riposte, Tueur, castingKind…). Remplace les `combatFeatures/defs/*.ts`. */
  combat?: import('../engine/combatFeatures/types').CombatFeature;
  /** `true` = contenu de RÉFÉRENCE (PNJ/campagne scriptée), pas un Talent de progression PJ standard —
   *  le RAW lui-même le dit explicite (« ne sont pas accessibles à d'autres personnes dans des
   *  circonstances normales », EDOC 13 l.83 ; « Carrière destinée uniquement aux PNJ … avec la
   *  permission du MJ », EDOC 13 l.137 ; lignage Éonir Harioth hors espèces jouables, ADE I ch.6 l.185).
   *  Lu par `computeObtainability` (`scripts/data/lib/obtainabilityGraph.ts`, #326) pour exempter la
   *  garde `obtainability-guard.test.ts` — jamais un silence sur un Talent sans chemin d'octroi PJ. */
  codexOnly?: true;
}
/** Capacités IRRÉDUCTIBLES d'un objet (drapeaux NON exprimables en GameOp) — canal `capabilities`, MÊME
 *  logique que `TraitCapabilities`/`QualityCapabilities` : règles que le moteur INTERROGE par id, jamais
 *  par le nom FR de l'objet. Lues par `engine/capabilities` (`itemCapability` par-objet, `hasCapability`
 *  agrégat par-personnage cross-source). */
export interface ItemCapabilities {
  /** Gantelet verrouillé (AA folio 94) : le porteur NE LÂCHE PAS l'arme tenue dans la main gantée la 1re
   *  fois que les circonstances l'y forceraient (désarmement / Piège-lame) — lu par `applyBladeTrap`
   *  (GATÉ sur le port). */
  preventForcedDrop?: boolean;
  /** Protège des intempéries (Cape/Manteau, LDB 65 l.44) — annule le malus de Test d'Exposition au
   *  froid (GATÉ sur le port). */
  weatherProtection?: boolean;
  /** Abri de campement (Tente, LDB p.308) — annule/atténue l'Exposition d'une nuit dehors (NON gaté). */
  isShelter?: boolean;
  /** Ration de voyage (« Ration (1 jour) », LDB p.302) — consommée par l'entretien de Faim (NON gaté). */
  isRations?: boolean;
  /** Grimoire / livre de Sorts (LDB 47 l.34) — un Sort non mémorisé du Domaine peut y être lu (NON gaté). */
  isGrimoire?: boolean;
  /** Outils de crochetage (LDB 67 l.66 : « nécessaire pour utiliser la Compétence Crochetage sans
   *  pénalité ») — consommé par `SkillData.tool` (crochetage → −10 sans outil, LDB 09 l.168). NON gaté
   *  sur le port : les posséder suffit (on les sort pour s'en servir, comme `isRations`). */
  lockpicks?: boolean;
  /** Soupe de chou fermenté (MDG 14 l.230) : le Test de contraction du scorbut passe à Facile (+40)
   *  « si le Personnage mange régulièrement de la soupe » — NON gaté (posséder ses rations suffit). */
  scurvyGuard?: boolean;
  /** Peau de phoque (MDG 14 l.277-279) : « +1 DR sur les Tests de Résistance effectués pour supporter
   *  l'exposition au froid » — GATÉ sur le port (c'est un pardessus). */
  sealskin?: boolean;
  /** Pièces détachées de navire (MDG 14 l.281-283) : « consommées quand vous entreprenez l'Activité
   *  Entretien du navire » — NON gaté (stock de cale). */
  shipParts?: boolean;
  /** Arme SOLIDEMENT FIXÉE au porteur (Poing de fer ogre, ADE II 02 l.694-698 : « il ne pourra pas en
   *  être désarmé ») — immunité PERMANENTE et INCONDITIONNELLE au retrait (`case 'disarm'`, `engine/ops.ts`),
   *  distincte du Gantelet verrouillé (`preventForcedDrop`, AA folio 94 : protection À USAGE UNIQUE par
   *  période avec pénalité de -20). Lue par-objet (`itemCapability`), pas gatée sur le port : l'arme est
   *  fixée à la main qui la tient. */
  disarmImmune?: boolean;
  /** Arme à corde séparable (Lance-harpon, ADE II 02 l.677 : « Si la corde est séparée de la flèche, la
   *  portée passe à 60 et l'arme ne possède plus l'Atout Immobilisante ») — active le mode de tir
   *  `WeaponContext.harpoonRopeCut` (`effectiveWeapon`, `state/combatFlow.ts` `weaponContextOf`), choisi
   *  par le joueur avant le jet (`PendingAttack.harpoonRopeCut`). Lue par-objet (`itemCapability`). */
  ropeMode?: boolean;
  /** Contenant d'eau (Outre à eau/Seau, LDB p.301/303) : consommé par l'action de combat « Asperger
   *  d'eau » (MDG 16 l.19, #497) qui pose `Combatant.wateredThisRound` sur une Créature marine
   *  adjacente hors de l'eau — NON gaté sur le port (on le sort du sac, comme `isRations`). */
  waterContainer?: boolean;
}
export interface TrappingData {
  /** id STABLE (slug du libellé) — cible des `TrappingRef`, robuste au renommage. */
  id: string;
  label: string;
  /** Latéralité TYPÉE (LDB 62) : `2` = arme à deux mains, absent = une main. Remplace l'ancien marqueur
   *  d'affichage `(2M)` re-parsé par regex — source de vérité unique, multilangue-safe. */
  hands?: 1 | 2;
  /** Taille TYPÉE du paquet de munitions (« 12 flèches », LDB 290) : remplace l'ancien marqueur `(12)`. */
  packSize?: number;
  type: string;
  /** `id` du Groupe d'objet (`WeaponGroupData.id`) : Groupe d'arme (Base/Escrime…), famille de munition
   *  (Arc/Poudre noire…), type d'armure (Plate/Mailles…) ou catégorie d'inventaire — réf d'entité, ≠ libellé. */
  subType: string | null;
  /** Groupe de Projectiles qui OPÈRE une arme de siège (`WeaponGroupData.id` : arbalete/catapulte/ingenierie/
   *  poudre-noire, AA p.122 l.3848-3863) quand `subType` = catégorie de catalogue (« armes-de-siege »). Pilote
   *  la Spé de tir (`acceptableSpecs`) et le décompte d'équipage (Projectiles appropriée, l.3900). */
  weaponGroup?: string;
  /** Pièce d'artillerie « relativement simple » (la baliste, AA p.122 l.3818) : tirée par UN seul servant
   *  valide → perd tous ses Atouts (garde ses Défauts). Lu par `crewedFireWeapon`. */
  soloSimple?: boolean;
  /** Pièce à TIR INDIRECT (mortier/catapulte — « arc élevé », AA p.122-123) : peut viser une CASE au sol.
   *  Propagé Trapping → ItemInstance → Weapon (`indirect`) ; lu par `availableAttacks`. Canon/baliste = direct. */
  indirect?: boolean;
  /** Effets DÉCLENCHÉS « à la touche » portés en DONNÉE (`TriggeredEffect[]`, MÊME vocabulaire que les
   *  enchantements d'arme et les traits) : Canon à flammes nain — « 2 + DR États En flammes à chaque cible
   *  affectée » (ADE II 8 l.243). Propagé Trapping → ItemInstance → Weapon (`onHitEffects`), dispatché
   *  par `fireTriggers('onHit')` sur la cible primaire ET les cibles de la zone d'Explosion. */
  onHitEffects?: import('../engine/flowCore').TriggeredEffect[];
  /** PORTÉE MINIMALE de tir (bande) : la cible plus proche que cette bande REFUSE le tir (≠ malus). Machines
   *  de siège à distance = `'courte'` (pas de Bout Portant, ADE II 8 l.253) ; trébuchet/mortier =
   *  `'moyenne'` (« distance inférieure à leur Portée Courte » interdite, l.251). Propagé jusqu'à `Weapon`,
   *  lu par `firedAttackBlock` (`belowMinRangeBand`). Absent = pas de minimale. */
  minRangeBand?: import('../engine/types').RangeBandId;
  /** Engin de siège POSABLE : id de la def rig `creatures/defs/<Engin>.ts` (plan 'engin') dessinant
   *  l'affût rendu en emplacement. Pur ROUTAGE D'APPARENCE (≠ règle), comme `shape` route l'art d'arme.
   *  Absent ⇒ l'arme n'est pas posable comme emplacement (pas d'art d'affût). */
  siegeRig?: string;
  /** `id` de munition REPRÉSENTATIVE (`TrappingData.id`, `type:'ammunition'`) d'une arme de siège — les
   *  familles `armes-de-siege`/`munition-de-siege` (`ammoFamily`) regroupent des munitions non-interchangeables
   *  (carreau de baliste ≠ boulet de canon ≠ bombe de mortier ≠ balles de pierrier, MDG 12 p.106) ; le
   *  `subType` seul ne discrimine pas la bonne famille pour le hint joueur. Propagé jusqu'à `Weapon`,
   *  résolu en libellé FR par `ammoFamilyLabel`. Absent = hint générique de la famille (`ammoFamilyLabel`). */
  defaultAmmo?: string;
  /** EMPREINTE de grille (côté N×N) de l'affût POSÉ en combat — recopiée sur `Combatant.footprint`
   *  (`footprintN`), MÊME champ que `VehicleData.ship.footprint`. ADE II 8 l.239/258 (profil + description
   *  physique du tronc suspendu sur portique à roues) ne chiffre aucune Taille en cases : la valeur posée
   *  en donnée (2, belier-ade2, #210) reste éditable au Compendium plutôt que codée en dur ailleurs. Absent
   *  = empreinte 1 (affûts compacts type baliste/canon). */
  siegeFootprint?: number;
  /** Slug de FORME (`WeaponDef`/`ShieldDef.slug`) — id STABLE de routage de l'art d'arme/bouclier (rig),
   *  ≠ libellé. Posé à la migration par jointure `norm(label)` → forme. Absent pour munitions/armes de
   *  siège/Mains nues (aucune silhouette tenue). Propagé sur `ItemInstance.shape` puis `Weapon.shape`. */
  shape?: string;
  /** Formes choisibles (slugs `WeaponDef.slug`) d'une arme ABSTRAITE (« Arme simple » → épée/hache/
   *  masse/marteau de guerre/demi-lance). Le picker pose le choix sur `ItemInstance.shape` ; défaut =
   *  `shape` du trapping. Absent pour une arme à forme unique. */
  formChoices?: string[];
  /** Arme INHABITUELLE (ACE 12 l.17 « Entraînement avec une arme inhabituelle ») : exige la
   *  maîtrise (`Combatant.masteredWeapons`) pour être maniée avec la Compétence du Groupe. Flag
   *  d'AUTEUR (artefacts uniques : « le couteau de lancer de Harald L'Infâme ») — éditable au Codex. */
  requiresMastery?: boolean;
  /** Encombrement (Points d'Encombrement). Honnête : la donnée porte aussi des STRINGS pour des cas
   *  NON-ENCOMBRANTS / non chiffrés — `'ND'` (ateliers : on ne les transporte pas) et `'Variable'`
   *  (arme improvisée). Ces strings sont traitées comme 0 au calcul (`itemFromTrappingById`). */
  enc: number | 'ND' | 'Variable' | null;
  /** Taille PRÉVUE pour l'objet (ADE II 2 l.706-710) — présente sur la version « taille ogre » d'une
   *  possession ordinaire (`enc` reste la valeur CLASSIQUE, doublée au runtime, `totalEncumbrance`). Absente
   *  sur le catalogue NATIVEMENT ogre (massue ogre, pansière ogre… l.604 : Enc déjà entré à sa valeur pleine,
   *  pas de doublement). Propagée à `ItemInstance.sizeFor` / `Weapon.sizeFor`. */
  sizeFor?: import('../engine/size').SizeCategory;
  availability: string | null;
  /** Allonge de MÊLÉE — UNIQUEMENT un libellé d'ordre de portée whitelisté (Personnelle / Très courte /
   *  Courte / Moyenne / Longue / Très longue / Considérable / Variable) ou null. NE conflate PLUS aucune
   *  Portée de tir : ni nombre, ni formule « BFx3 » (→ `range:{bf}`), ni modificateur de munition
   *  « Moitié de l'arme »/« +50 »/« Comme l'arme » (→ `ammoRangeMod`). */
  reach: string | null;
  /** Portée de TIR — SPEC non résolue (`WeaponRangeSpec`) : `number` = mètres FIXES (arc/arbalète/
   *  pistolet…), `{bf}` = Bonus de Force × bf mètres (armes de JET — javelot/bombe…). Absent/null pour
   *  la mêlée et les munitions (qui héritent de l'arme). Résolue à l'usage par `effectiveRange`. */
  range?: import('../engine/types').WeaponRangeSpec | null;
  /** MUNITION : modificateur STRUCTURÉ de la Portée de l'arme de tir (`AmmoRangeMod` : `{mult}` fraction /
   *  `{add}` mètres ±). Appliqué en combat (`effectiveWeaponRange`) à l'arme qui tire cette munition. « Comme
   *  l'arme » = absent/null (Portée de l'arme inchangée). Sorti de `reach` (qui n'est qu'une Allonge mêlée). */
  ammoRangeMod?: import('../engine/types').AmmoRangeMod | null;
  loc: string | null;
  pa: number | null;
  /** Dégâts d'arme STRUCTURÉS (cf. `WeaponDamageSpec`) — remplace la chaîne « +BF+4 » re-parsée au runtime. */
  damage: import('../engine/types').WeaponDamageSpec | null;
  /** Qualités d'arme/armure (`QualityRef` : id + Indice éventuel « Solide 3 » → value, spec = arg éventuel). */
  qualities: QualityRef[];
  desc: string | null;
  /** Effet d'un CONSOMMABLE (potion/drogue/bandage — LDB 71/72/67) en **Flow** (noyau `engine/flowCore`) :
   *  feuilles `do` d'ops (MÊME vocabulaire que sorts/passifs), branches `if` (Fleur de lune par race),
   *  nœuds `test` pour les Tests « au boire » (Brise-cœur/Belladone/Nécessaire antipoison), résolus
   *  cadence-aware par le runner state (`runConsumable`). Édité au Codex via `FlowEditor` (comme les
   *  effets d'un sort). Copié sur `ItemInstance.consumable` à la construction. */
  consumable?: import('../engine/flowCore').Flow;
  /** Durée d'HORLOGE des effets durables du consommable (LDB 71/72 « Durée : … ») — résolue AU BOIRE
   *  (dés tirés une fois), les ops durables du Flow expirent à l'échéance (`purgeClockEffects`). */
  consumableDuration?: import('../engine/consumables').ConsumableDuration;
  /** Contenant (LDB 64) : capacité de rangement (« Contenu », en Enc). Sacs/sacoches/sac à dos. */
  container?: { capacity: number };
  /** `null` = objet sans prix numérique fixe (RAW « ND »/« Variable »/« – » : Mains nues, Arme
   *  improvisée, Rocher, Bijoux, Licence de Guilde, Filet…). */
  price: { gold: number; silver: number; bronze: number } | null;
  source: SourceRef;
  /** Emplacement SECONDAIRE (#563) — même objet réimprimé/à cheval prose⇄ligne-de-stats ailleurs
   *  (ex. Cimeterre : prose AA 90, ligne de stats AA 91). Accessors `allLocations`/`sourceBooks`
   *  (`src/data/sourceRefs.ts`), aucun lecteur n'inline `alsoIn`. */
  alsoIn?: SecondaryRef[];
  /** Arme DÉRIVÉE conférée tant que l'objet est ÉQUIPÉ (prothèse-arme, LDB 73 : le Crochet « est
   *  considéré comme une Dague » en mêlée). Lue par recomputeLoadout : ajouter une prothèse-arme =
   *  remplir ce champ dans la donnée, plus de name-match `i.name === 'Crochet'`. */
  derivedWeapon?: Weapon;
  /** Capacités IRRÉDUCTIBLES de l'objet (drapeaux NON exprimables en GameOp) — canal `capabilities`,
   *  MÊME logique que `TraitCapabilities`/`QualityCapabilities` : règles que le moteur INTERROGE par id
   *  (`engine/capabilities`), jamais par le nom FR de l'objet. Couvre les 5 marqueurs de catégorie :
   *  `weatherProtection` (Cape/Manteau), `isShelter` (Tente), `isRations` (Ration), `isGrimoire`
   *  (Grimoire), `preventForcedDrop` (Gantelet verrouillé). Édité au Compendium. */
  capabilities?: ItemCapabilities;
  /** Modificateurs PASSIFS continus de l'objet (GameOp[], MÊME vocabulaire que traits/qualités/sorts) —
   *  appliqués tant que l'objet est PORTÉ ou TENU (collecteur `passiveMods`). Ex. Bésicles → `skillMod`
   *  +20 Langue/Perception (LDB 67). */
  passive?: import('../engine/ops').GameOp[];
  /** Tarif d'un SERVICE (LDB p.302 : chambre/écurie…), pas un objet possédable — Enc « – » dans la
   *  source (≠ 0, RAW ne le compte même pas comme non-encombrant). N'entre JAMAIS en stock marchand
   *  (`computeFreshStockLines`), ni en inventaire (`itemFromTrappingById` refuse bruyamment) ; reste
   *  la source de PRIX pour son consommateur (référencée par id) et visible au Codex/Compendium. */
  service?: boolean;
}
/** Groupe d'objet (taxonomie `subType` id-ifiée) : Groupe d'ARME (Base, Escrime, Deux-mains, Armes
 *  d'hast…), famille de MUNITION (Arc, Arbalète, Poudre noire…), type d'ARMURE (Plate, Mailles, Cuir
 *  souple/bouilli) ou catégorie d'INVENTAIRE (Outils, Possessions diverses…). `id` = cible de
 *  `Trapping/Weapon/ItemInstance.subType` (réf, ≠ libellé) ; `kind` = métadonnée d'affichage. */
export interface WeaponGroupData {
  id: string;
  label: string;
  kind: 'weapon' | 'ammo' | 'armour' | 'inventory';
  /** Matériau d'une armure (groupes `kind:'armour'`) — source TYPÉE des exemptions de Magie des Arcanes
   *  (Chamon/Azyr ignorent le métal, Ghur le cuir, LDB 46 l.188). Remplace la devinette par regex sur le nom. */
  material?: 'metal' | 'leather';
  /** Sous-ensemble de COMBAT d'un Groupe d'arme (`kind:'weapon'`/`'ammo'`) : `melee` = Spé de Corps à corps,
   *  `ranged` = Spé de Projectiles. SOURCE des pools `weaponGroupsMelee`/`weaponGroupsRanged` (SPEC_SOURCES)
   *  — fin des `specs[]` maintenues à la main sur `corps-a-corps`/`projectiles`. */
  combat?: 'melee' | 'ranged';
}
/** Groupe d'APPARTENANCE (WFRP4, Traits psy ciblés — LDB 21) : identité CANONIQUE i18n-safe.
 *  `id` STABLE (jamais traduit) ; `label` = rendu FR localisable. Registre SSOT (`groups.json`),
 *  référencé par les cibles de Traits psy et les filtres `onlyGroups`/`exceptGroups`/zones. */
export interface GroupData {
  id: string;
  label: string;
}
/** Rareté de récolte/trophée = `Availability` (LDB 59) ÉTENDUE de `'Unique'` (pièce de bestiaire singulière). */
export type HarvestRarity = Availability | 'Unique';
export type HarvestDanger = 'Inoffensive' | 'Inquiétante' | 'Menaçante' | 'Mortelle';

export interface CreatureData {
  /** `id` STABLE (slug) — clé de résolution runtime/données (scènes, encounters, rig). « Plus de label » :
   *  les références pointent l'id (robuste au renommage/multilangue) ; le `label` ne sert qu'à l'affichage. */
  id: string;
  label: string;
  title: string | null;
  /** `true` = individu NOMMÉ (vs rôle générique / espèce de bestiaire) ; absent/`false` = générique.
   *  SOURCE UNIQUE de la nommé-ité — ne PAS l'inférer de `title`. Éditable au Codex. */
  named?: boolean;
  folder: string | null;
  char: Record<string, number | null>;
  /** Traits STRUCTURÉS (`TraitInstance[]`) — source app-owned migrée du parsing de chaînes (de-POC).
   *  Lus sans aucun parsing (`resolveTraits`/`hasTraitKey`) ; plus de chaîne legacy. */
  traits: import('../engine/statEntry').TraitList;
  /** OPTIONNELS (LDB 76) — affichés au Codex, choisissables au spawn : `TraitInstance` ordinaires OU
   *  NOTES composées (joker « tous les traits », variante « remplacer des Traits par un bonus », ZI). */
  optionals: import('../engine/statEntry').OptionalEntry[];
  /** Compétences STRUCTURÉES (`SkillRef` par id stable + valeur de Test imprimée) — fin du parsing
   *  de chaînes « Calme 58 ». Le bestiaire stocke des refs ; `skillRefLabel` reformate à l'affichage. */
  skills: SkillRef[];
  /** Talents STRUCTURÉS (`TalentRef` par id stable + niveau/spécialisation) — fin du parsing de chaînes
   *  « Maîtrise du combat 2 », « Magie des Arcanes (Ghur) ». `talentRefLabel` reformate à l'affichage ;
   *  au spawn, `talentsFromBook` reconstruit le libellé canonique AVEC sa spec (clé du registre). */
  talents: TalentRef[];
  /** Possessions (`TrappingRef` : id catalogue + quantité, ou `{text}` narratif — « collection d'alcool »). */
  trappings: TrappingRef[];
  /** Sorts connus (`Ref` par id de sort). */
  spells: Ref[];
  desc: string | null;
  source: SourceRef;
  /** Apparence par défaut UNIFIÉE (plan P2) — UN seul bloc éditable porté par l'enregistrement :
   *  espèce, tenue, parts monstrueux, couleurs, coiffure, sexe/carrure, yeux. Le rig la lit comme
   *  couche de défaut (sous une éventuelle surcharge de scène). Même format que `EntityAppearance`
   *  (éditeur de scène) → une SEULE structure d'apparence dans toute l'app. */
  appearance?: EntityAppearance;
  /** Récolte « Précieuses Entrailles » (ZI) : rareté + dangerosité (→ coût par Enc des pièces,
   *  cf. engine/harvest) et usages supposés des organes. Porté par la créature (pas de table //). */
  harvest?: { rarity: HarvestRarity; danger: HarvestDanger; uses: string };
  /** Catégorie de Groupe ÉDITABLE (Traits psy ciblés, LDB 21) — surcharge la dérivation par folder
   *  (`engine/groups`). Absent = catégorie auto-dérivée du `folder`. */
  group?: string;
  /** Cette entrée du bestiaire suit-elle les règles de PERSONNAGE (#143/#152 — Corruption LDB 19,
   *  composant d'incantation LDB 46, Tests de fin de combat Maladie/Corruption LDB 18/20) ? Rétro-flag
   *  du bestiaire HUMAIN (Cultiste, Brigand, Voleur… — ce sont des Personnages, pas des créatures
   *  génériques) ; propagé au spawn par `creatureToCombatant` (même prédicat unique `followsCharacterRules`,
   *  `engine/relations.ts`, que `CustomStatblock.followsCharacterRules` côté éditeur). Absent = créature. */
  followsCharacterRules?: boolean;
}
/** Base PARTAGÉE d'un STATUT porté pilotant des effets en DONNÉES — soit un État (LDB 16, `EtatData`), soit
 *  un état psychologique (LDB 21, `PsychologyData`). Porte le vocabulaire commun : modificateurs PASSIFS
 *  (`passive: GameOp[]`, MÊME éditeur `GameOpEditor` que traits/atouts) ET effets DÉCLENCHÉS
 *  (`effects: TriggeredEffect[]`). Folding UNIQUE : `passiveMods` (passifs) + `fireStatusEffects` (déclenchés)
 *  itèrent indifféremment États et états psy → zéro duplication de schéma ni de collecteur. */
export interface StatusData {
  /** id STABLE (slug du libellé) — cible des instances (`ConditionInstance.name` / `PsychAffliction.type`). */
  id: string;
  label: string;
  desc: string;
  source: SourceRef;
  /** Modificateurs PASSIFS continus (pénalité de Test, `incomingAttackMod`, `sbBonus`…) en `GameOp[]`, lus
   *  par `passiveMods` (kind `etat` : pool non-cumul, le pire seul, LDB 16 l.20). MÊME éditeur GameOpEditor. */
  passive?: import('../engine/ops').GameOp[];
  /** Effets DÉCLENCHÉS (dégâts par round → `onRoundEnd` ; sortie de Frénésie → `onTurnStart`…) en
   *  `TriggeredEffect[]`, diffusés par `fireStatusEffects` — le même cœur `applyTriggeredEffects`. */
  effects?: import('../state/flow').TriggeredEffect[];
  /** Restriction d'Action / de Mouvement / de défense imposée par le STATUT (États : À Terre/Sonné/
   *  Inconscient/Surpris/Empêtré ; et Psychologie — « Etat comme Psy »), lue en DONNÉES par les prédicats
   *  moteur `canTakeAction`/`effectiveMovement`/`cannotDefend` via le collecteur `conditionGating` (plus de
   *  branche par-nom). Sur `StatusData` → partagée par `EtatData` ET `PsychologyData`. */
  gating?: { action?: 'none'; movement?: 'none' | 'half' | 'crawl'; cannotDefend?: true };
}

export interface EtatData extends StatusData {
  /** Les magnitudes du `passive` sont-elles multipliées par le nombre de pions (Exténué −10/pion, LDB 16
   *  l.89) ? Appliqué à l'émission par le collecteur `passiveMods`. Défaut (absent) : magnitude fixe. */
  perStack?: boolean;
  /** Le nombre de pions vu par les `effects` (le `{stacks:'self'}` des dégâts par-round) est RÉDUIT du
   *  niveau de cette capacité de combat chez la cible — ex. Hémorragique réduit par Endurci (`bleedIgnore`,
   *  LDB 10). Clé de `CombatFeature` ; lu génériquement par `fireConditionEffects` (jamais codé par-nom). */
  stacksReducedBy?: string;
  /** Récupération de l'État par une ACTION (LDB 16 : Empêtré « se libérer » l.61 = Test OPPOSÉ de Force
   *  contre la source de l'empêtrement ; En flammes « se rouler » l.77 = Test d'Athlétisme simple). Lue par
   *  l'action `recover` (IA inline ET flux joueur — SOURCE UNIQUE `resolveRecoverTest`) au lieu des branches
   *  par-nom. `opposedBy:'source'` → opposé contre la Force d'entrave : `escapeStrength` FIGÉE en priorité
   *  (vaut même source absente), sinon Force de la source VIVANTE. Retire 1 + DR pions sur succès. */
  recover?: { skill?: string; characteristic?: import('../engine/types').CharKey; opposedBy?: 'source'; difficulty?: import('../engine/types').Difficulty };
  /** Cet État VERROUILLE l'Action : le Mouvement + l'Action doivent servir à fuir/se cacher (Brisé, LDB 16
   *  l.55). Drapeau DÉCLARATIF lu en DONNÉES par `isActionLocked`/`restrictingConditions` (engine/conditions),
   *  partagé par le gate de hotbar (`battleSelectAction`) ET l'IA (dépense PROACTIVE de Détermination pour se
   *  ressaisir) — plus de nom d'État en dur. */
  restrictsAction?: boolean;
  /** AFFICHAGE (couche UI, hors RAW LDB 16) : icône du registre `<Icon>` (id `famille/nom`) + sévérité
   *  0-100 (≥50 = incapacitant → créneau unique de l'ordre de bataille). Lus par `effectIcons.conditionMeta`. */
  icon?: string;
  severity?: number;
  /** Dangerosité IA de l'État infligé, en « Blessures espérées » (contrôle > simple malus) — lue par
   *  `aiSpellValue.opValue` (`op:'condition'`). Absente → menace mineure (1). */
  aiThreat?: number;
}

/** État PSYCHOLOGIQUE en DONNÉES (LDB 21) — `id` = `PsychType` (`frenesie`, à terme `peur`/`terreur`/…).
 *  Étend `StatusData` (passive/effects mutualisés) ; n'ajoute que la capacité propre à la psychologie. */
export interface PsychologyData extends StatusData {
  /** AFFICHAGE (couche UI, hors RAW LDB 21) : icône du registre `<Icon>` (id `famille/nom`), à l'égal
   *  d'`EtatData.icon`. Lu par `CIBLE_LABEL` (engine/psychology.ts). */
  icon?: string;
  /** Porter cet état psy IMMUNISE à la Psychologie (Frénésie, LDB 21 l.34) — lu GÉNÉRIQUEMENT par
   *  `isPsychImmune` (jamais codé par-nom), à l'égal du drapeau de trait « Immunité (Psychologie) ». */
  psychImmune?: boolean;
  /** Trait psychologique CIBLÉ (Animosité/Haine/Préjugé/Amour/Camaraderie/Phobie, LDB 21) : résolution
   *  binaire de Calme pilotée par un Groupe-Cible. Dérive `CIBLE_TYPES` de la donnée (plus de Set codé). */
  targeted?: boolean;
  /** RAW LDB 21 : cette affliction CIBLÉE cesse dès que son porteur tombe sous un AUTRE effet psychologique
   *  « dominant » (Peur/Terreur/Haine…) — « Animosité est annulé par Peur et Terreur » ; Préjugé idem. */
  endedByOtherPsych?: boolean;
  /** RAW LDB 21 : tant que cette affliction CIBLÉE est active, son porteur est IMMUNISÉ aux KINDS psy listés
   *  causés par un membre de sa Cible (Haine → ['peur'], « mais pas Terreur »). Lu par `fearSourceFor`. */
  immuneToFromTarget?: string[];
  /** Contribution de cet état psy au DEGRÉ DE RÉUSSITE de l'ATTAQUE de son porteur (LDB 21, ±1 DR) — lu
   *  par `psychDRAdjust` (plus de ±1 codé par-nom). `vs:'source'` = Peur vs sa source (active non vaincue,
   *  l.29) ; `vs:'group'` = Haine/Animosité vs le groupe ciblé actif (l.22/41) ; `vs:'any'` = Amour/
   *  Camaraderie en défense, dès lors qu'actif (l.77/82). */
  attackDR?: { amount: number; vs: 'source' | 'group' | 'any' };
  /** Actif, cet état ANNULE le malus de Peur de l'attaquant (Amour : « immunisé à la Peur tant que vous
   *  défendez les êtres aimés », LDB 21 l.77) — généralise, hors-groupe, l'immunité `immuneToFromTarget`. */
  cancelsFear?: boolean;
  /** Mode de RÉSOLUTION du Test de Psychologie (LDB 21), lu par l'applier GÉNÉRIQUE `combatPsych` (plus de
   *  dispatch `kind === 'terreur'` codé) : `'extended'` = Test ÉTENDU de Calme cumulant le DR vers l'Indice
   *  (Peur, l.27) ; `'terreur'` = Test BINAIRE dont l'échec inflige `failCondition` (Indice + |DR négatifs|)
   *  puis pose l'état `becomes` (Terreur → Peur, l.55-57) ; `'binary'` = Test BINAIRE activant l'affliction
   *  CIBLÉE (traits ciblés). Absent (Frénésie/trauma) = pas de Test de résolution surmontable. */
  resolution?: 'extended' | 'terreur' | 'binary';
  /** (résolution `'terreur'`) État infligé à l'ÉCHEC (l'id de l'état, p.ex. `'brise'`) ; la QUANTITÉ est
   *  déclarée par `failAmount` (défaut = Indice + |DR négatifs|, LDB 21 l.57). */
  failCondition?: string;
  /** (résolution `'terreur'`) QUANTITÉ d'état infligée à l'échec, EN DONNÉES (`failConditionAmount`) :
   *  `base` (l'Indice de l'affliction via `'indice'`, ou un nombre FIXE) + `perDegreeOfFailure` par DR
   *  négatif. Défauts `{ base:'indice', perDegreeOfFailure:1 }` = la règle Brisé Terreur — plus de calcul
   *  codé : un nouvel État/Psy déclare ICI sa quantité (fixe, ou par degrés seuls). */
  failAmount?: { base?: 'indice' | number; perDegreeOfFailure?: number };
  /** (résolution `'terreur'`) État psychologique SUBSÉQUENT au Test (la Terreur devient une Peur, l.55). */
  becomes?: string;
  /** Paramètres du Test de Psychologie (LDB 21) : `skill` (compétence stable, défaut `calme` — la valeur
   *  NUE est lue par `skillBaseValue`) + `difficulty` (défaut Intermédiaire +0). Lu par `psychStepFor`/
   *  l'encounter, plus de Calme/Intermédiaire codé : un nouvel État/Psy déclare ICI son Test (ex. testé en
   *  Résistance, ou à une difficulté propre). « Sans Peur (Ennemi) » force Accessible à part (par-combattant). */
  test?: { skill?: string; difficulty?: import('../engine/types').Difficulty };
}
/** Tables Couleur des Yeux / Cheveux (LDB 05 l.698-744) : 2d10, par colonne `RaceKey` (#313). */
export interface DetailColorData {
  id: string;
  label: string;
  /** Borne haute 2d10 (incluse). */
  rand: number;
  /** Override de `rand` PAR RACE (`RaceKey`, #313) quand une édition utilise d'autres bornes que le
   *  LDB (ex. gnome NADJ, #420) ; défaut = `rand`. Lu par `rollDetail`. */
  randByRace?: Partial<Record<RaceKey, number>>;
  color: Partial<Record<RaceKey, string>>;
}
/** Texte d'aide (LDB 05 « Détails ») : global + par espèce (clé OUVERTE — libellé, saisie libre à
 *  l'édition Codex, hors périmètre #313 : pas un catalogue fermé). */
export interface DetailText {
  all: string;
  bySpecies: Record<string, string>;
}
/** Formules d'Âge/Taille (LDB 05 l.691-707) : « base + N d10 », par colonne `RaceKey` (#313) —
 *  + textes d'aide (conventions de noms, espérance de vie, tailles moyennes, Ambitions). */
export interface DetailsData {
  ageBase: Partial<Record<RaceKey, number>>;
  ageRoll: Partial<Record<RaceKey, number>>;
  heightBase: Partial<Record<RaceKey, number>>;
  heightRoll: Partial<Record<RaceKey, number>>;
  texts: {
    nom: DetailText;
    age: DetailText;
    taille: DetailText;
    ambitionShort: DetailText;
    ambitionLong: DetailText;
  };
}
/** MANŒUVRE de combat (attaque naturelle activée — LDB 85) — ENTITÉ ÉDITABLE de PREMIÈRE CLASSE (au
 *  même titre qu'un Sort) : son propre dataset `maneuvers.json`, sa catégorie Codex, ses effets
 *  AUTHORÉS en GameOp (`effects`). Un trait l'OCTROIE (`TraitData.grantsManeuvers`) ; le résolveur
 *  générique (`state/combatManeuvers.resolveManeuver`) la joue ENTIÈREMENT depuis cette donnée — plus
 *  de table en dur ni d'applier par type. `kind` ne sert QU'À l'anim/pose/icône (jamais à résoudre).
 *  La géométrie/portée/opposition restent moteur (règle 3) ; Dégâts (`wounds`) + États = data. */
/** Mesure de géométrie de manœuvre en MÈTRES (Portée/Souffle) : `bonus(ref)` de la carac `bonusOf` (référent
 *  = Attaquant pour la Portée, Cible au centre pour le Souffle, RAW l.251) + constante `plus`. Résolue par
 *  `measureMeters` (`combatManeuvers`) — remplace la formule-chaîne FR re-parsée par regex au runtime. */
export interface ManeuverMeasure {
  bonusOf?: CharKey;
  plus?: number;
}
export interface ManeuverDef {
  id: string;
  label: string;
  /** Anim/pose/icône SEULEMENT (pas la résolution) — type d'attaque naturelle (geste distinct). */
  kind: import('../engine/creatureAttacks').AttackKind;
  /** Déclenchement RAW : Action normale, gratuite (coût d'Avantage), ou gratuite à la Charge. */
  activation: 'action' | 'free' | 'charge';
  advantageCost: number;
  /** Gestion de l'Avantage dépensé : `fixed` = `advantageCost` (défaut) ; `variable` = le joueur
   *  CHOISIT (Regard : +1 DR par Avantage, LDB 85 l.238) ; `all` = dépense tout (Hurlement, l.135). */
  advantageMode?: 'fixed' | 'variable' | 'all';
  /** Caractéristique du jet de l'attaquant (capacite-de-combat mêlée / capacite-de-tir distance·zone) ;
   *  absent = AUCUN jet d'attaquant (Hurlement : chaque cible teste sa Résistance). */
  stat?: 'capacite-de-combat' | 'capacite-de-tir';
  /** Défense opposée : Esquive / Parade, Initiative (Regard), Résistance/auto sans opposition. */
  defense?: 'esquive' | 'parade' | 'init' | 'resist' | 'auto';
  /** Mode de ciblage (le résolveur en dérive la géométrie moteur). `self` = capacité SUR SOI (pas de
   *  cible adverse ni d'opposition — transformation, mue, auto-buff) : les `effects` s'appliquent au porteur. */
  targeting: 'melee' | 'ranged' | 'zone' | 'allFoes' | 'self';
  /** Portée / Souffle STRUCTURÉS (`ManeuverMeasure`) — mètres = `bonus(ref) + plus`. `range` résolu contre
   *  l'Attaquant, `blast` contre la cible au centre (RAW l.251). Remplace la formule-chaîne re-parsée au runtime. */
  range?: ManeuverMeasure;
  blast?: ManeuverMeasure;
  /** Attaque magique (Souffle, Étreinte glaciale) → soumise à la Résistance à la Magie, etc. */
  magic?: boolean;
  /** Effets AUTHORÉS (Dégâts `wounds` + États) appliqués quand la manœuvre touche (`onHit`) — MÊME
   *  vocabulaire que les sorts (Flow d'ops), exécutés par `applyTriggeredEffects`. */
  effects?: import('../state/flow').TriggeredEffect[];
  desc?: string;
  source?: SourceRef;
  /** Pertinence de BASE pour le scoreur d'attaque (clic droit joueur ET décision IA) : POIDS ÉDITABLE,
   *  plus haut = choisie plus volontiers. Combinée aux bonus situationnels AUTO (dégâts attendus,
   *  multi-cible, état onHit applicable). Défaut 1 ; 0 = jamais auto-choisie (reste manuelle). */
  priority?: number;
}
/** Drapeaux de CAPACITÉ IRRÉDUCTIBLES d'un trait (LDB 85) — décisions d'IA/psychologie, règles de
 *  résolution de combat, capacités de construction/déplacement/vision : NI un modificateur (`passive`)
 *  NI un effet déclenché (`effects`), mais une règle que le moteur INTERROGE. Édité au Codex. Le
 *  seuil/type éventuel (Démoniaque 8+, Immunité (Poison)) vient de l'INDICE/arg de l'INSTANCE, pas d'ici. */
export interface TraitCapabilities {
  // Construction / spawn
  bonusWoundsBE?: boolean;
  mutationAtSpawn?: 'physique' | 'mentale';
  /** Tirage PLURIEL et ALTERNÉ de Mutations au spawn (Marque de Tzeentch, EDOC 13 l.522-524 : « gagne
   *  1d10/3 Mutations (arrondi à l'entier supérieur), alternant entre Mutations mentales et
   *  physiques » sur la colonne du dieu). `countDie`/`countDivide` = la formule de comptage (⌈1d`countDie`
   *  / `countDivide`⌉) ; `first` = la nature du 1er tirage (RAW liste « mentales et physiques » en premier) ;
   *  `mentalTable`/`physTable` = ids de `mutationTables.json` (colonne du dieu). Distinct de `mutationAtSpawn`
   *  (singulier, table générique 'physique'/'mentale') — les deux capacités coexistent sans collision. */
  markMutations?: { countDie: number; countDivide: number; first: 'physique' | 'mentale'; mentalTable: string; physTable: string };
  swarm?: boolean;
  /** Attaque NATURELLE (LDB 85) : le trait EST une arme (morsure, cornes, tentacules…) — pas d'objet
   *  tenu par le rig. Remplace l'ancienne reconnaissance par découpe du libellé + Map FR au runtime
   *  (`statEntry` interdit le parsing de chaîne au runtime). `ranged` pour les attaques à distance (crachat). */
  naturalWeapon?: { ranged?: boolean };
  /** Lanceur de Sorts (LDB 85 l.182-183 : « La créature peut lancer des Sorts ») — autorise
   *  l'incantation SANS Compétence avancée (statblocs du bestiaire), lu par `knowsCastingSkill`. */
  spellcaster?: boolean;
  /** Porte le Trait Mort-vivant (LDB 85 p.340, lu par Hurlement fantomatique LDB 85 l.170 :
   *  « créatures vivantes (ne possédant pas le trait Mort-vivant) ») — le TRAIT, PAS le Groupe
   *  bestiaire (un folder « Morts sans repos » sans ce Trait, ex. Goule de crypte, N'EST PAS visé). */
  undead?: boolean;
  // Résolution de combat (seuil/type éventuel depuis l'instance)
  wardSave?: boolean;
  magicResistance?: boolean;
  damageImmunity?: boolean;
  /** Manifestation de Ghur (bestiaire de Middenheim) : le porteur est IMMUNISÉ aux effets des Sorts
   *  du Domaine d'id donné (« bete » = Domaine de la Bête / Ghur). Lu PAR ID par le chemin
   *  d'incantation (`immuneToSpellDomain` → `applyCast`) : les effets d'un Sort de ce Domaine ne
   *  s'appliquent pas au porteur. NB : la clause RAW de vulnérabilité aux dégâts supplémentaires
   *  anti-démon/mort-vivant (hors Bête) n'est PAS modélisée — le moteur n'a aucun concept de créature
   *  « vulnérable comme un démon/mort-vivant » (les riders de Domaine ciblent l'appartenance LITTÉRALE
   *  à un Groupe/Trait), donc rien d'inventé. */
  spellDomainImmunity?: string;
  /** Contre-attaque en gagnant un Test opposé de défense (Champion LDB 85). MÊME capacité GÉNÉRIQUE que
   *  le talent Riposte (`CombatFeature.counterOnDefenseWin`) — un seul concept pour traits ET talents. */
  counterOnDefenseWin?: boolean;
  counterRequiresFastParry?: boolean;
  unstable?: boolean;
  painless?: boolean;
  /** Se cabrer (LDB 85 l.314) : « Pour une Action de Mouvement, la créature peut effectuer une Attaque
   *  de Piétinement si elle est plus grande que son adversaire » — SANS le coût d'1 Avantage de l'Action
   *  gratuite générique (LDB 85 l.387, déjà câblée pour toute créature plus grande). Lu par le coût de
   *  l'attaque gratuite `pietinement` (`aiCreatureFreeAttacks`) : la condition de Taille reste celle du
   *  Piétinement générique (`trampleTarget`), inchangée. */
  freeTrample?: boolean;
  // Psychologie / IA
  psychImmuneIfAhead?: boolean;
  /** Psychologie portée par le trait (LDB 21), lue par `parsePsychTraits` (data-driven). L'Indice
   *  (Peur/Terreur) vient de l'instance (`value`) ; la Cible (Animosité…) de l'instance (`arg`). */
  psychType?: 'peur' | 'terreur' | 'animosite' | 'haine' | 'prejuge' | 'amour' | 'camaraderie' | 'phobie';
  psychImmune?: boolean; // Immunité (Psychologie) — annule Peur/Terreur (LDB 85 l.143-144)
  psychIndice?: number; // Indice FIXE si absent de l'instance (Phobie = 1, Effrayé = 0)
  /** Cible FIXE (id de `groups.json`) d'un `psychType` CIBLÉ quand elle est imposée par le RAW du trait
   *  lui-même, pas choisie à l'instanciation (Marque de Khorne « envers ceux qui sont ouvertement des
   *  suivants de Slaanesh », MDG 07 l.250 — ≠ Animosité (au choix)). Fallback SEULEMENT si
   *  l'instance ne porte pas d'`arg` (`parsePsychTraits`). */
  psychCible?: string;
  /** Ids de Groupe (`groups.json`) ACCORDÉS au porteur de ce Trait, en plus de sa dérivation
   *  habituelle (folder/espèce/carrière…) — patron `psychCible` : la Cible d'une Animosité RÉCIPROQUE
   *  ailleurs sur le bestiaire (« les suivants de Slaanesh éprouvent Animosité envers la créature »,
   *  Marque de Khorne, MDG 07 l.250) a besoin d'un Groupe à VISER ; sans ce Trait, aucun `groupMatch`
   *  ne peut cibler le porteur. Lu par `groupsFor` (SOURCE UNIQUE des groupes d'un combattant). */
  grantGroups?: string[];
  /** Peut entrer en Frénésie (LDB 21 l.31 / LDB 85 l.150 Trait « Frénésie » / LDB 10 l.506 Talent
   *  « Frénésie »), lu par `isFrenzyCapable` (une des 3 sources : Trait, Talent, Trait psy octroyé). */
  frenzyCapable?: boolean;
  mindless?: boolean;
  /** Blessures calculées avec le Bonus de FORCE au lieu du Bonus de Force Mentale (Fabriqué, LDB 85
   *  l.142 : « au lieu d'utiliser son bonus de Force Mentale, utilisez son bonus de Force »). Lu par
   *  `maxWounds`/`effectiveMaxWounds` — capacité DISTINCTE de `mindless` (qui porte l'auto-réussite
   *  des Tests d'Int/FM/Soc et le profil IA « horde »), un autre trait pourrait un jour substituer la
   *  même formule sans être Fabriqué. */
  woundsUseForce?: boolean;
  bestial?: boolean;
  coldBlooded?: boolean;
  stupid?: boolean;
  rage?: boolean;
  territorial?: boolean;
  /** Monture trop ombrageuse pour agir seule (Nerveux, LDB 14 l.221) : MONTÉE, elle ne consacre pas sa
   *  propre Action à attaquer (une monture SANS ce drapeau est « un combattant à part entière »). Lu par
   *  l'IA de combat monté — drapeau de donnée, plus de test par-nom du trait. */
  skittishMount?: boolean;
  // Structure de siège (ADE II 8) — Atouts de la table « Barricades et protections typiques »
  structResistant?: boolean;    // Résistant : imparable par une Arme à DISTANCE sans l'Atout Siège (ADE II 8 l.296)
  structImpenetrable?: boolean; // Impénétrable : imparable par TOUTE Arme sans l'Atout Siège (ADE II 8 l.300)
  // Déplacement / vision
  fly?: boolean;
  leap?: boolean;
  stride?: boolean;
  /** Grimpant (LDB 85 l.160-162) : « réussit automatiquement tous ses Tests d'Escalade » — le geste
   *  d'escalade (échelle/arête `WallSeg.climb`) se résout SANS jet (pas un jet silencieux : aucun jet).
   *  Lu par `state/climbMove` (`planClimb`) et `state/path` (pathing/IA, `MoveEnv.traverse`). */
  autoClimb?: boolean;
  /** Grimpant (LDB 85 l.160-162) : « avance à sa vitesse maximale de Mouvement sur toutes les surfaces
   *  appropriées » — coût de Mouvement NORMAL (1 case) au lieu de la ½ vitesse du Talent Grimpeur
   *  (`climbMovementCost`, joueur, LDB 15 l.53). Orthogonal à `autoClimb` (accueille une future capacité
   *  qui réussirait automatiquement sans pour autant grimper à pleine vitesse). */
  climbFullSpeed?: boolean;
  /** Rampant (MSRC 15) : la créature ne peut PAS réaliser d'Action de Course (budget de Course nul). */
  noRun?: boolean;
  seesInDark?: boolean;
  /** Portée de vision dans le noir, en cases (Vision nocturne 20 m/niv = 10 — `LDB 11 l.176` ;
   *  Infravision = illimité, grande valeur — `LDB 85 l.165`). Lue par `darkSightTiles`. */
  darkSightTiles?: number;
  /** Salive analgésique (MSRC 15) : la morsure INDOLORE de la créature ne RÉVEILLE pas une proie
   *  endormie (Inconscient magique) — elle s'y accroche sans être détectée. Lu par le modifier `wake-sleeper`. */
  wakelessBite?: boolean;
  /** Encombrement portable ×N (ADE II 2 l.708, folio 31 : « un ogre peut porter deux fois
   *  l'Encombrement normal d'un humain : (Bonus de Force + Bonus d'Endurance) × 2 ») — porté par le
   *  Trait racial ogre, lu par `traitEncumbranceFactor` (`combatFeatures/dispatch.ts`), composé au PLUS GRAND
   *  facteur avec `talentEncumbranceFactor` (talents, `combatFeatures/dispatch.ts`) dans `maxEncumbrance`
   *  (`items.ts`) — jamais cumulatif. */
  encumbranceFactor?: number;
  /** Consommation de vivres/eau ×N (ADE II 2 l.708, folio 31 : « les ogres doivent manger et boire
   *  au moins deux fois plus qu'un humain en une journée ») — porté par le Trait racial ogre, lu par
   *  `traitConsumptionFactor` (`engine/provisions.ts`). */
  consumptionFactor?: number;
}
/** Trait de créature (LDB 85) : libellé canonique + desc VERBATIM (affichée à l'inspecteur). */
export interface TraitData {
  /** Identifiant STABLE (slug du libellé) — clé d'instance/lookup, indépendant de la langue. */
  id: string;
  label: string;
  /** Sens de la valeur NUMÉRIQUE `value` de l'instance (Difficulté, Indice, Degré…) — `label` affiché
   *  devant/autour du nombre. Absent = le trait ne porte pas de valeur numérique. */
  indice?: { label: string };
  /** L'instance porte-t-elle un champ `range` (portée en mètres/cases : Souffle, Aura…) ? Absent/`false` = non. */
  range?: boolean;
  /** Registre de l'ARGUMENT `arg` du trait (catalogue `SPEC_SOURCES` : `groups`/`diseases`/`sizes`/
   *  `mutations`/`breathTypes`/`weaponGroups*`…). Le pool DÉRIVE alors du registre — plus de liste en dur. */
  specsSource?: SpecsSource;
  /** L'`arg` accepte un TEXTE LIBRE (argument authentiquement descriptif, hors registre). Absent/`false`
   *  = FERMÉ (l'`arg` DOIT être un id du pool `specsSource`). */
  specsOpen?: boolean;
  /** L'`arg` peut être une LISTE d'ids jointe par virgules (« Immunité (Feu, Poison) »). Absent/`false`
   *  = un seul id. */
  specsMulti?: boolean;
  desc: string;
  source: SourceRef;
  /** Emplacement SECONDAIRE (#563) — même Trait réimprimé/à cheval ailleurs (ex. Fouissement : ZI 23
   *  ET 134). Accessors `allLocations`/`sourceBooks` (`src/data/sourceRefs.ts`). */
  alsoIn?: SecondaryRef[];
  /** Effets MÉCANIQUES authorés (déclencheur → ops du Flow) — Traits « effet sur événement » (Toile,
   *  Sang corrosif, Régénération…) appliqués par `state/triggeredEffects`, plus de handler en dur.
   *  Type-only (le moteur reste pur : la donnée référence le Flow sans en dépendre à l'exécution). */
  effects?: import('../state/flow').TriggeredEffect[];
  /** Manœuvres OCTROYÉES par ce trait (Morsure, Attaque caudale, Souffle…) — `Ref[]` vers le dataset
   *  `maneuvers`. Un trait d'attaque naturelle octroie sa/ses manœuvre(s) ; `engine/creatureAttacks`
   *  les résout par id (`findManeuverById`). Le trait Souffle en octroie plusieurs (un par Type). */
  grantsManeuvers?: Ref[];
  /** Modificateurs de PROFIL PASSIFS (Élite +20 CC/CT/FM, Brutal −1 M…) en `GameOp[]` — le MÊME vocabulaire
   *  d'ops que les sorts et `Trauma.ops`, CONTINUS (sans wrapper Flow/déclencheur, ≠ `effects`) : édités par
   *  `GameOpEditor` (le composant de liste d'ops existant), lus par le collecteur passif (`traitPassiveMods`
   *  → liveTraits) qui leur AFFECTE le `kind` `intrinsèque` (comme la séquelle dérive le sien). */
  passive?: import('../engine/ops').GameOp[];
  /** Apparence COSMÉTIQUE déclarée en DONNÉE (calques du catalogue via `features` + `colors` + `eyes`) —
   *  fusionnée sur le rig quand le trait est présent (cf. `combatantVisuals`). Même fragment éditable
   *  (`AppearanceField`) que les créatures/mutations. */
  appearance?: EntityAppearance;
  /** Drapeaux de CAPACITÉ irréductibles (décisions IA/psy, résolution, build/déplacement/vision) —
   *  migrés des `defs/` mécaniques, lus PAR ID par `engine/traits/dispatch`. Édité au Codex. */
  capabilities?: TraitCapabilities;
  /** Capacités d'AUTRES traits du même porteur ANNULÉES par ce trait (« entraîné à IGNORER son Trait
   *  X » — LDB 85 : Dressé (Dompté) ignore Bestial). Mécanisme GÉNÉRIQUE de suppression, lu par
   *  `traitCapability` : une capacité supprimée par n'importe quel trait porté répond false. */
  suppressesCapabilities?: (keyof TraitCapabilities)[];
  /** AURA de combat : projette des `passive` GameOp[] sur les combattants À PORTÉE (Perturbant : −20 aux
   *  Tests à `rangeChar` mètres, LDB 85 p.341 ; `affects` = qui est touché). Recalculée chaque Round par le
   *  hook GÉNÉRIQUE `recompute-auras`, accumulée dans `Combatant.auraMods` (lu par `passiveMods`, kind `etat`
   *  NON-CUMUL — « une seule fois, peu importe le nombre d'ennemis Perturbants »). Aucun code par-nom. */
  aura?: { rangeChar?: CharKey; rangeMeters?: number; affects?: 'enemies' | 'allies' | 'all'; passive: import('../engine/ops').GameOp[] };
  /** Trait STANDARD (LDB 76 l.28-31 : « ajoutés à la liste Facultative de TOUTES les créatures ») —
   *  proposé par le picker de Traits facultatifs sur n'importe quel bestiaire. Édité au Codex. */
  standard?: boolean;
}
/** Drapeaux/marqueurs de CAPACITÉ IRRÉDUCTIBLES d'une qualité d'arme/armure/objet (LDB 62-63) — règles
 *  que le moteur INTERROGE (résolution de combat, économie d'artisanat) : NI un modificateur (`passive`)
 *  NI un effet déclenché (`effects`). Migrés des `defs/` mécaniques, lus PAR ID par `engine/qualities/dispatch`.
 *  Les INDICES (Salve N, Protectrice N, Arme d'équipe N…) restent lus du RUNTIME string (`parseQuality().indice`)
 *  — la capability n'est qu'un marqueur de PRÉSENCE, jamais le porteur de l'Indice. Édité au Codex. */
export interface QualityCapabilities {
  // Résolution de combat (mêlée)
  fastStrike?: boolean;   // Rapide : pré-emption d'initiative + −10 parade adverse non-Rapide
  slowStrike?: boolean;   // Lente : frappe en dernier
  fumbleOn9?: boolean;    // Dangereuse : Maladresse sur tout Test raté incluant un 9
  fumbleDigits?: number[]; // Seuil de Maladresse paramétrable (chiffre en dizaines OU unités) — AA 08 l.544
  pushback?: boolean;     // Perturbante : repousse au lieu de blesser
  bladeTrap?: boolean;    // Piège-lame : piéger/briser une lame sur un Critique défensif
  damagesArmour?: boolean;// Taille : endommage l'armure/le bouclier frappé
  // (Taillade « État sur Critique » n'est PLUS une capability : `effects:[{trigger:'onCrit'}]` data-driven.)
  // Armes à feu / chargeurs
  firearm?: boolean;            // Poudre noire / Explosion : Incident de Tir + terreur (Nerveux)
  canFireWhileEngaged?: boolean;// Pistolet : tir au contact
  magazine?: boolean;           // À Répétition : chargeur (Indice)
  salvo?: boolean;              // Salve : chargeur (Indice)
  areaFire?: boolean;           // Tir de zone : nuage de projectiles (Indice)
  explosion?: boolean;          // À Explosion : tous à Indice m du point cible subissent DR+Dégâts + États de l'arme (LDB p.298)
  crewedTeam?: boolean;         // Arme d'équipe : sous-effectif (Indice)
  parryAP?: boolean;            // Protectrice : Indice PA en opposant (Indice)
  // Objet / artisanat (LDB 60)
  encDelta?: number;            // Léger −1 / Volumineux +1 Encombrement
  // Armure (LDB 63)
  layerable?: boolean;          // Flexible : superposition sous une couche non Flexible
  critImmuneOdd?: boolean;      // Impénétrable : Critiques sur jet impair ignorés
  apIgnoredOnEven?: boolean;    // Partielle : PA ignorés sur jet pair ou Critique
  apIgnoredOnImpaleCrit?: boolean; // Points faibles : PA ignorés sur Critique Empaleuse
  // Siège (ADE II 8)
  siege?: boolean;              // Atout Siège : double les Dégâts aux structures, outrepasse Résistant/Impénétrable
  ram?: boolean;                // Bélier : la pièce n'endommage QUE les portes (ADE II 8 l.249) — lu par engine/structures
  // Marqueurs
  unbreakable?: boolean;        // Incassable : insensible aux dégâts/destruction
  magic?: boolean;              // Magique : attaques magiques (blesse l'Éthéré)
  /** Préséance : cette qualité l'emporte sur les `beats` (ids) si toutes deux présentes (Imprécise > Précise, Lente > Rapide). */
  beats?: string[];
}
/** Atout/Défaut d'arme (LDB 62-63) : libellé + desc VERBATIM + effets déclenchés authorés (mêmes
 *  `TriggeredEffect` que les Traits — un Atout « à la touche : 1d10 + Empêtré » s'édite au Codex). */
export interface QualityData {
  /** id STABLE (slug du libellé) — cible des `Ref` de qualité, robuste au renommage. */
  id: string;
  label: string;
  type: string;
  subType: string | null;
  desc: string;
  /** Emplacement SECONDAIRE (#563) — même Qualité réimprimée/à cheval ailleurs (ex. Tir de zone :
   *  AA 89 + MDG 102). Accessors `allLocations`/`sourceBooks` (`src/data/sourceRefs.ts`). */
  alsoIn?: SecondaryRef[];
  effects?: import('../state/flow').TriggeredEffect[];
  /** Modificateurs PASSIFS continus (objet Laid : −10 aux Tests de Soc ; PASSIFS d'arme : weaponRollMod/
   *  weaponDamageMod/armourPierce/critOnRoll) en `GameOp[]` — MÊME vocab/éditeur (`GameOpEditor`) que les
   *  traits et les sorts ; lus par `engine/qualities/dispatch` (par id) et le collecteur passif. */
  passive?: import('../engine/ops').GameOp[];
  /** Drapeaux/marqueurs de CAPACITÉ irréductibles (résolution combat, artisanat) — migrés des `defs/`,
   *  lus PAR ID par `engine/qualities/dispatch`. Édité au Codex. */
  capabilities?: QualityCapabilities;
}
/** Capacités IRRÉDUCTIBLES d'un symptôme de maladie — drapeaux lus par la machinerie de cycle
 *  (`engine/disease`), pour les comportements non exprimables en GameOp continu. */
export interface SymptomCapabilities {
  blocksHealing?: boolean;   // « Blessé »/Gangrène : bloque la guérison d'1 PB par symptôme (LDB 20 l.145)
  amputation?: boolean;      // Gangrène : Test quotidien, échecs > BE → Localisation perdue (l.176)
  stickyExtenue?: boolean;   // Malaise : État Exténué collant tant que la maladie dure (l.188)
  contagious?: boolean;      // Toux & éternuements : expose l'entourage (l.206)
  nausea?: boolean;          // Nausée : Sonné sur Test de déplacement raté en combat (l.194)
  endTest?: boolean;         // Persistant : Test de fin de Durée (difficulté portée par l'instance, l.200)
  persistentActive?: boolean; // Vers de carie : la phase active NE guérit JAMAIS naturellement (dégénérescence quotidienne jusqu'à la Mort, MSRC 16 l.90-101)
}
/** Symptôme de maladie (LDB 20) — entité de DONNÉE éditable au Codex, mécaniques en GameOp / 3 canaux
 *  (comme un trait/qualité). `passive` = pénalités continues (charMod) ; `severePassive` = variante
 *  appliquée quand l'instance porte `severity` (Convulsions −20) ; `onTick` = Test de cycle quotidien +
 *  conséquence GameOp appliquée par la cascade (différée/influençable) ; `capabilities` = règles
 *  irréductibles lues par la machinerie de maladie. */
export interface SymptomData {
  id: string;
  label: string;
  desc: string;
  source?: SourceRef;
  passive?: import('../engine/ops').GameOp[];
  severePassive?: import('../engine/ops').GameOp[];
  /** Effets DÉCLENCHÉS du symptôme (MÊME `TriggeredEffect` que Traits/Atouts/États) — dispatchés par
   *  `fireTriggers` quand le porteur est actif (Crampes abdominales : `onOwnTestFailed` → Sonné/FM/
   *  Inconscient par paliers de `slThreshold`, MSRC 16 l.152-158). Source du dispatcher via
   *  `effectSourcesOf` (les symptômes ACTIFS deviennent une source, comme les États). */
  effects?: import('../state/flow').TriggeredEffect[];
  /** `difficultyBySeverity` : la difficulté du Test de cycle est INDEXÉE sur la sévérité de l'instance
   *  (Toxine, LDB 20 l.215 : Modéré→Facile, Grave→Accessible) — clé absente pour la sévérité portée
   *  = `difficulty` de base inchangée. Lu par `symptomOnTick`. `afterDays`/`once` cadencent le cycle sur
   *  la phase ACTIVE (Vers de carie : Test d'Endurance quotidien À PARTIR de J+7, MSRC 16 l.90 ; Vers du
   *  Reik : éclatement UNE fois au 7ᵉ jour, MSRC 16 l.142). `difficulty` ABSENTE = conséquence
   *  INCONDITIONNELLE (pas de jet — l'éclatement du Vers du Reik est d'issue invariante). */
  onTick?: {
    difficulty?: import('../engine/types').Difficulty;
    difficultyBySeverity?: Partial<Record<'moderee' | 'grave', import('../engine/types').Difficulty>>;
    onFail: import('../engine/ops').GameOp[];
    /** Ne se déclenche qu'à partir du Nᵉ jour de PHASE ACTIVE (1 = premier jour actif). Absent = dès le 1ᵉʳ. */
    afterDays?: number;
    /** UNE seule fois, au jour `afterDays` exact (Vers du Reik) ; absent/false = quotidien (Vers de carie). */
    once?: boolean;
  };
  /** Passifs conditionnés à la VISIBILITÉ de la lésion (Vers du Reik : « si l'ampoule se trouve à un endroit
   *  visible… −10 Sociabilité », MSRC 16 l.140) — appliqués SEULEMENT si la localisation tirée à l'entrée en
   *  phase active (`Disease.blisterLocation`) ∈ `visibleLocations`. Jet de Localisation canonique (`hitLocation`). */
  visiblePassive?: import('../engine/ops').GameOp[];
  /** Localisations comptées comme VISIBLES (arbitrage `maison` : tête/bras visibles, corps/jambes couverts) —
   *  gate de `visiblePassive`. Éditable au Codex. */
  visibleLocations?: import('../engine/types').HitLocation[];
  capabilities?: SymptomCapabilities;
}
/** Domaine de magie (Couleur, LDB 48) : ses ATTRIBUTS éditables au Codex — riders « à la touche »
 *  (`effects`, gatés par les Conditions Flow `relation`/`has`), mitigation de Projectile
 *  (`missile`), ops post-incantation au lanceur (`casterOps`). Le `label` correspond au `subType`
 *  d'un Sort d'Arcane (`domainOf`). */
export interface DomainData {
  id: string;
  label: string;
  desc?: string;
  source?: SourceRef;
  /** Vent de Magie (Couleur) du Domaine, EXTRAIT du `desc` (« Domaine du Feu (Aqshy) », LDB 48) — source
   *  d'AFFICHAGE de la Compétence Focalisation (spécialisée par Vent) et clé de `findDomainByWind`. Les 8
   *  Domaines élémentaires + Dhar en portent un ; les Domaines dérivés (Sorcellerie/Nécromancie/
   *  Démonologie/Magie naturelle, homebrew Skaven…) n'ont pas de Vent propre (ils canalisent Dhar ou un
   *  Vent élémentaire). Édité au Codex. */
  wind?: string;
  /** Domaine ENSEIGNABLE via le Talent Magie des Arcanes (LDB 48) : SOURCE du pool `arcaneDomains`
   *  (SPEC_SOURCES) — fin de la liste `specs[]` maintenue à la main sur `magie-des-arcanes`. Les Lores de
   *  sorts non-arcanes (ex. Magie des mers de Triton) ne le portent pas. */
  arcane?: boolean;
  /** Effets DÉCLENCHÉS « à la touche » sur une cible d'un Sort du Domaine (Feu → En flammes…) — MÊMES
   *  `TriggeredEffect` éditables que Traits/Atouts, gatés par les Conditions Flow `relation`/`has`. */
  effects?: import('../state/flow').TriggeredEffect[];
  /** Mitigation des Projectiles : ignore les PA d'une matière (`metal`/`nonMagic`) ; `bonusFromBypass`
   *  les ajoute aussi aux Dégâts (Métal). */
  missile?: { bypass: 'metal' | 'nonMagic'; bonusFromBypass?: boolean };
  /** Ops appliquées AU LANCEUR après une incantation réussie (ex. Bête → Peur 1 pendant 1d10 Rounds).
   *  Canal CAPABILITY (pas passive ni effects) : l'effet cible le lanceur lui-même, non une cible.
   *  Exécutées par `domainCasterOps` (engine/domainAttributes) via `applyOps`. */
  casterOps?: import('../engine/ops').GameOp[];
  /** Élément du Souffle conféré par le Talent Magie des Arcanes du Domaine (Cieux → Électricité,
   *  Métal → Corrosif, Ombres → Fumée, Feu → Feu) — lu par le résolveur de Souffle. */
  breathType?: string;
  /** Bonus d'incantation CONDITIONNEL (Aqshy l.157) : +`bonus` par État `perCondition` porté par un
   *  combattant situé à `radiusStat` (Bonus de carac.) mètres du lanceur (géométrie résolue par state).
   *  CAPABILITY irréductible : modifie le JET d'incantation via la géométrie de l'arène → hors GameOp
   *  (cf. 3 canaux passive / effects / capabilities). */
  castBonus?: { perCondition: string; radiusStat: import('../engine/types').CharKey; bonus: number };
  /** Caractéristique des Tests d'Incantation (Langue (Magick)) des Sorts de ce Domaine, à la place de la
   *  carac par défaut (ADE II 2 l.728 : la Magie de la Gueule, réservée aux ogres, se lance sur l'Endurance).
   *  Lue par `castingValue` — porté par la DONNÉE du domaine, aucun sniff d'espèce dans le moteur. */
  castingChar?: import('../engine/types').CharKey;
  /** Bonus d'incantation lié à l'ENVIRONNEMENT (LDB 48 l.690, Vie/Ghyran : +10 pour Incanter ou
   *  Focaliser dans un environnement rural ou sauvage). `environments` = classifications de Scène
   *  (`Scene.environment`) qui déclenchent le bonus ; `mod` = valeur. Lu par `domainEnvironmentBonus`. */
  environmentBonus?: { environments: string[]; mod: number };
  /** Domaine de la SORCELLERIE (LDB 49) : marqueur DONNÉE. Un Sort dont le `domainId` porte ce marqueur
   *  active le mode Sorcellerie (composant obligatoire sinon Imparfaite Mineure systématique, +1 Corruption
   *  par jet d'Imparfaite, État Hémorragique possible) — gated par la règle optionnelle `magic-sorcellerie`. */
  sorcery?: boolean;
  /** Modificateur des Vents de Magie EN MER (MDG 02 l.178-186). Règle d'application (l.178) :
   *  « Les modificateurs suivants s'appliquent aux tentatives de Focalisation et d'Incantation en mer. »
   *  Seuls 4 Domaines en portent un (Bête/Feu/Cieux/Vie). Lu par `domainSea*` (`engine/domainAttributes`),
   *  consommé par `resolveFocus`/`resolveCasting`/`evaluateCasting` (`engine/magic`) via un contexte
   *  `{ atSea, wind }` fourni par l'appelant (état — géométrie/météo hors du moteur pur). */
  seaModifier?: {
    /** Feu (Aqshy, l.182) : DR de Focalisation en mer. */
    focalisationDR?: number;
    /** Vie (Ghyran, l.186) : le DR de Focalisation en mer est DOUBLÉ. */
    focalisationDrDoubled?: boolean;
    /** Vie (Ghyran, l.186) : Focalisation Critique en mer → Imparfaite MAJEURE (au lieu de Mineure). */
    focusCritMiscastMajeure?: boolean;
    /** Cieux (Azyr, l.184) : DR d'Incantation en mer pendant une Violente tempête / en Calme plat. */
    incantationStormDR?: number;
    incantationCalmDR?: number;
    /** Bête (Ghur, l.180) : Critique/Maladresse déclenchés aussi sur un résultat finissant par 0. */
    critFumbleOnTens?: boolean;
  };
}
export interface SpellData {
  /** id STABLE (slug du libellé) — cible des `Ref` de sort (sorts de créature, bénédictions/miracles). */
  id: string;
  label: string;
  type: string;
  subType: string | null;
  /** id STABLE du Domaine de magie (= `DomainData.id`, ex. « feu ») — source RUNTIME du chemin
   *  sort→domaine (attributs LDB 48). Dérivé du `subType` (libellé) à l'authoring ; le runtime ne
   *  lit QUE l'id. Absent = Sort sans Domaine (Magie Mineure, Prière…). */
  domainId?: string;
  /** Prière (Béni/Invocation) plutôt qu'un Sort arcanique : branche d'incantation (Test de Prière,
   *  pas de Niveau d'Incantation, non dissipable) lue PAR LA DONNÉE — cf. `castInfo`/`isArcaneSpell`. */
  isPrayer?: boolean;
  /** Famille d'incantation STABLE (id, multilangue) — DISCRIMINANT moteur (familyOf / isArcaneSpell /
   *  canCastFromGrimoire / Chaos) ; `type` ci-dessus n'est plus qu'un libellé d'affichage. */
  family: import('../engine/combatFeatures/types').CastingKind;
  /** Niveau d'Incantation (NI). `null` pour les Prières (Béni/Invocation). */
  cn: number | null;
  /** Portée STRUCTURÉE (LDB 46/47) — d'où le sort peut être lancé. `null` = donnée absente (homebrew
   *  non extrait). Remplace l'ancienne prose re-parsée au runtime ; l'affichage est DÉRIVÉ
   *  (`engine/spellRangeFormat`). */
  range: import('../engine/spellRange').SpellRange | null;
  /** Cible STRUCTURÉE (LDB 47) — qui/quoi est affecté (compte, ZONE par rayon/diamètre, cône, spécial).
   *  `null` = donnée absente. L'aire (ex-`zdeRadiusMeters`) vit désormais ICI (source unique). */
  target: import('../engine/spellRange').SpellTarget | null;
  /** Durée STRUCTURÉE (LDB 47) — instant/Rounds/horloge/lever-du-soleil/spécial. `null` = donnée absente.
   *  L'échelle Rounds (ex-`durationRounds`) vit désormais ICI (source unique). */
  duration: import('../engine/spellDuration').SpellDuration | null;
  desc: string;
  /** Projectile magique (Dégâts résolus façon attaque) — DONNÉE (multilangue ; remplace la regex
   *  `/projectile magique/` sur la desc). `damage` = bonus ADDITIF (+ DR + BFM, LDB 46) ; `ignorePA`/
   *  `ignoreBE` = ignore les PA / le Bonus d'Endurance de la cible. Lus par `evaluateMissile`/IA. */
  missile?: boolean;
  damage?: number;
  ignorePA?: boolean;
  ignoreBE?: boolean;
  // ── MÉTADONNÉES DE RÉSOLUTION (migrées depuis src/data/spellspecs/*.ts — migration #5) ──────────
  // Ces champs sont multilingue-safe (ids/formules, jamais du texte d'affichage).
  // Présents sur toutes les entrées OFFICIELLES (curated:true) ; absents sur les sorts homebrew (frenchy.bzh).
  /** Vrai pour une entrée curée de la base officielle. Absent/false pour les sorts homebrew (frenchy.bzh).
   *  Permet au test de couverture de vérifier que TOUS les sorts officiels ont une spec complète. */
  curated?: boolean;
  // POUSSÉE / TÉLÉPORTATION / ATTAQUES EN CHAÎNE : effets POSITIONNELS désormais portés par des ops
  // IMPURES (`push`/`teleport`/`chain`, on:'caster') dans `effects`, résolus par combatFlow (cf. engine/ops).
  /** Sort « Souffle » (LDB 47 p.244) : délégué à l'attaque de ZONE du Trait Souffle. */
  breathAttack?: true;
  /** OPPOSITION de la cible (multijet dans la modale d'incantation).
   *  `resist` : Test opposé par la caractéristique/compétence `char`/`skill` de la cible.
   *  `contact` : Sort de Portée Contact — frappe via Test opposé de Corps à corps (Bagarre). */
  opposed?: {
    kind: 'resist' | 'contact';
    /** Caractéristique opposée (`resist` uniquement). */
    char?: import('../engine/types').CharKey;
    /** Compétence opposée en libellé (`resist` uniquement, rare — FM, Intelligence, Calme…). */
    skill?: string;
  };
  /**
   * EFFETS du sort — `Flow` ÉDITABLE (système logique unique : `do`/`if`/`test`), source des effets
   * mécaniques appliqués à l'incantation (feuilles EffectOp `{type:'ops', on:'target'|'caster', ops}`).
   * Édité dans le Compendium (CodexEdit → FlowEditor), exécuté par `runCombatFlow`. SOURCE UNIQUE des
   * effets. Import TYPE seul (effacé à la compilation) → la couche data NE dépend PAS d'une valeur
   * de `state` (pureté préservée). Absent = aucun effet mécanique (narratif).
   */
  effects?: import('../state/flow').Flow;
  source: SourceRef;
  /** Emplacement SECONDAIRE (#563) — même Sort à cheval prose⇄stat-bloc ailleurs (ex. Maître de la
   *  bête : prose LDB 246, stat-bloc NI/Portée/Cible/Durée LDB 245). Accessors `allLocations`/
   *  `sourceBooks` (`src/data/sourceRefs.ts`). */
  alsoIn?: SecondaryRef[];
}

/** Signe astral (ADE II) : table d100 (`rand` = borne haute cumulée), flavor + effet de création. */
export interface StarData {
  /** id STABLE (slug du libellé) — `Combatant.star` le stocke, le runtime résout par `findStarById`
   *  (≠ libellé — multilangue-safe). */
  id: string;
  label: string;
  rand: number;
  signe: string | null;
  classique: string | null;
  ascendant: string | null;
  dates: string | null;
  dieux: string | null;
  apparence: string | null;
  /** Effet ADE II appliqué AUX ATTRIBUTS DE DÉPART (ch.03 l.38) — donnée éditable au Codex
   *  (`GameOpEditor`) : `charMod` (±carac) et/ou `grantTalent` (talent octroyé). Appliqué une
   *  fois à la création (cf. `applyStarEffect`), pas collecté en passif continu. */
  effect?: import('../engine/ops').GameOp[];
  /** L'Étoile du Sorcier (ADE II 3 l.63) : fourchette du 1d10 interne `[min, max]` parmi les variantes
   *  partageant `rand:100`. Absent = pas de sous-tirage (signe simple). */
  sub?: [number, number];
  desc: string | null;
  source: SourceRef;
}
/** Demeure céleste (ADE II ch.03 l.502-512) : section du ciel gouvernée par un signe — thème astral
 *  facultatif de la création (flavor pur). `desc` = VERBATIM de la source ; `rand` = borne haute 1d10. */
export interface CelestialHouseData {
  /** id STABLE (slug du libellé) — `HeroDetails.dwellings[].house` stocke cet ID (libellé à l'affichage). */
  id: string;
  label: string;
  rand: number;
  desc: string;
  source: SourceRef;
}
/** Lieu (Glorieux Reikland, LDB) : hiérarchie par `parent` (label d'un autre lieu). */
export interface LocationData {
  /** id STABLE (slug du libellé) — cible de `parent` (réf id, ≠ libellé) et des réfs inverses. */
  id: string;
  label: string;
  /** `id` du lieu parent (`LocationData.id`), ou null si racine — réf d'entité, ≠ libellé. */
  parent: string | null;
  prefix: string | null;
  suffix: string | null;
  desc: string | null;
  source: SourceRef;
}
/** Ouvrage WFRP4 référencé (bibliographie). `desc` = présentation en texte/Markdown (règle 5). */
export interface BookData {
  id: string;
  label: string;
  abbr: string;
  dir?: string | null;
  language: string | null;
  folder: string | null;
  desc: string | null;
}
/**
 * Apparence de base d'une espèce de rig (Humain, Ogre, Skaven…) — éditable dans le Compendium.
 * PAR RÉFÉRENCE : `featureKeys` (catalogue d'éléments, résolus par `feat()`), ids de gabarit/tête/
 * jambes, libellé de tenue, couleurs. Les SVG/gabarits restent des registres CODE (résolus par le
 * rig). Le rig (`raceById`) lit ce dataset comme SOURCE et le résout en `RaceDef`.
 */
export interface RaceAppearanceData {
  id: string;
  gabarit: string;
  gabaritOverride?: Record<string, number>;
  palette?: Record<string, string>;
  paletteF?: Record<string, string>;
  head?: string;
  legs?: string;
  armG?: string;
  armD?: string;
  dropHeadgear?: boolean;
  featureKeys?: string[];
  pose?: Record<string, number>;
  tenue?: string;
  colors?: Record<string, string>;
  sex?: 'M' | 'F';
  parts?: { cheveux?: number; visage?: number };
  scale?: number;
  eyes?: { G?: string; D?: string };
}
/** Banque de noms par race (clé : « Humain », « Nain »…) : prénoms M/F + noms de famille (LDB 05). */
export interface NamePool {
  maleFirstNames: string[];
  femaleFirstNames: string[];
  lastNames: string[];
  /** Suffixes de patronyme par sexe du PERSONNAGE (Nain, LDB 05 l.622 : « –sson » fils de…, « –snev »
   *  neveu de…, « –sdottir » fille de…, « –sniz » nièce de…) — le nom de famille est généré depuis le
   *  parent + suffixe quand `lastNames` est vide. Absent = pas de génération par suffixe. */
  lastNameSuffixes?: { M: string[]; F: string[] };
}

export const characteristics = characteristicsJson as CharacteristicsData;
/** Abréviation FR AFFICHÉE d'une caractéristique à jet (« CC », « Ag »…), dérivée de `characteristics.json`
 *  par `id` (jamais recopiée en dur dans l'UI — `CharKey` reste un id opaque, cf. engine/types.ts). */
export const CHAR_ABR: Record<CharKey, string> = Object.fromEntries(
  characteristics.filter((c) => c.type === 'roll').map((c) => [c.id, c.abr]),
) as Record<CharKey, string>;
export const species = speciesJson as SpeciesData[];
export const classes = classesJson as ClassData[];
export const careers = careersJson as CareerData[];
export const careerLevels = careerLevelsJson as CareerLevelData[];
export const skills = skillsJson as SkillData[];
export const talents = talentsJson as TalentData[];
export const etats = etatsJson as EtatData[];
/** Procédures / options de jeu (Sombre Pacte, modes d'attaque/défense, Empoignade, Focalisation
 *  étendue…) — texte VERBATIM du Source (règle stricte 5), app-owned éditable au Codex. Routées en
 *  tooltip `CodexRef` (catégorie `regles`). */
export interface RegleData {
  id: string;
  label: string;
  desc: string;
  source: SourceRef;
}
export const regles = reglesJson as RegleData[];
/** Tables numériques de Disponibilité & de Troc (LDB 59 « Faire son marché » p.290-291) — app-owned
 *  éditable ; consommé par `engine/disponibilite` (mêmes références). */
export interface DispoPctRow { availability: 'Limitée' | 'Rare'; pct: Record<'village' | 'ville' | 'cite', number>; source: SourceRef }
export interface BarterRatioRow { give: Availability; ratios: Record<Availability, { give: number; get: number }>; source: SourceRef }
export interface DispoData { dispoPct: DispoPctRow[]; barterRatios: BarterRatioRow[] }
export const disponibilite = disponibiliteJson as DispoData;
/** Maladies (LDB 20) — app-owned éditable au Codex ; le COMPORTEMENT (cycle/symptômes) vit dans
 *  `engine/disease`. `DiseaseDef` (type) y est défini ; ici on n'expose que la DONNÉE. */
export const maladies = maladiesJson as DiseaseDef[];
const DISEASE_BY_ID = new Map(maladies.map((m) => [m.id, m]));
/** Résout une Maladie par son `id` STABLE. */
export function findDiseaseById(id: string): DiseaseDef | undefined {
  return DISEASE_BY_ID.get(id);
}
/** Libellé d'affichage d'une Maladie par son id (repli sur l'id). */
export function diseaseLabel(id: string): string {
  return DISEASE_BY_ID.get(id)?.label ?? id;
}
// Traits app-owned (officiels + homebrew frenchy.bzh Aura de Dhar/Mort, Charnier + suppléments
// Redoutable/Fouissement ZI) — TOUT dans `traits.json` (l'ex-`frenchy-traits.json`, fichier de
// migration one-shot, a été FONDU ici ; chaque entrée garde sa vraie `source` : ZI, frenchy.bzh…).
export const traits = traitsJson as TraitData[];
/** Index des Traits par libellé canonique — lecture des `effects` au runtime (state/triggeredEffects). */
export const traitByLabel: Map<string, TraitData> = new Map(traits.map((t) => [t.label, t]));
/** Index des Traits par `id` STABLE (slug) — lookup runtime indépendant de la langue. */
export const traitById: Map<string, TraitData> = new Map(traits.map((t) => [t.id, t]));
export const findTraitById = (id: string): TraitData | undefined => traitById.get(id);
export const qualities = qualitiesJson as QualityData[];
/** Index des Atouts/Défauts par libellé — lecture des `effects` déclenchés au runtime (triggeredEffects). */
export const qualityByLabel: Map<string, QualityData> = new Map(qualities.map((q) => [q.label, q]));
/** Index des Atouts/Défauts par `id` STABLE (slug) — lookup runtime indépendant de la langue (dispatch). */
export const qualityById: Map<string, QualityData> = new Map(qualities.map((q) => [q.id, q]));
/** Symptômes de maladie (LDB 20) — entités de DONNÉE éditables au Codex (passive/onTick/capabilities). */
export const symptoms = symptomsJson as SymptomData[];
export const symptomById: Map<string, SymptomData> = new Map(symptoms.map((s) => [s.id, s]));
export const findSymptomById = (id: string): SymptomData | undefined => symptomById.get(id);
/** Libellé FR d'un symptôme par son id (repli sur l'id si inconnu). */
export const symptomLabel = (id: string): string => symptomById.get(id)?.label ?? id;
/** Mutations (entités) + Tables de Corruption (plages d100 → réf), DÉCOUPLÉES (cf. data/mutations.ts) —
 *  app-owned éditables au Codex. Le runtime du tirage (`rollMutation`) vit dans `mutations.ts`. */
export const mutations = mutationsJson as MutationData[];
export const mutationTables = mutationTablesJson as MutationTable[];
/** Tables d'EFFETS référençables (`tables.json`, tirées par l'op `rollTable` variante `tableId`) —
 *  loader + lookup fail-fast dans `data/effectTables.ts` (importe le type `GameOp` du moteur, réservé). */
export { effectTables, findEffectTableById, type EffectTable, type EffectTableRow } from './effectTables';
const MUTATION_BY_ID = new Map(mutations.map((m) => [m.id, m]));
/** Résout une Mutation (entité) par son `id` STABLE — lookup DONNÉE sans cycle (le résolveur de tirage
 *  `mutationById` de `data/mutations` importe le moteur → réservé au runtime de corruption). */
export function findMutationById(id: string | null | undefined): MutationData | undefined {
  return id ? MUTATION_BY_ID.get(id) : undefined;
}
/** Libellé d'affichage d'une Mutation par son id (repli sur l'id). SOURCE UNIQUE du nom. */
export function mutationLabel(id: string | null | undefined): string {
  return id ? (MUTATION_BY_ID.get(id)?.label ?? id) : '';
}
export const trappings = trappingsJson as TrappingData[];
/** Engins de siège POSABLES = trappings portant un art d'affût (`siegeRig`). FOYER UNIQUE du filtre,
 *  partagé par l'outil emplacement de l'éditeur (`SIEGE_ENGINES`) ET la catégorie Codex « Engins de siège »
 *  — plus de `trappings.filter(siegeRig)` dupliqué à deux endroits. */
export const siegeEngines = trappings.filter((t) => !!t.siegeRig);
/** Véhicules / embarcations à coque — FOYER UNIQUE app-owned (data-driven). Trois facettes par
 *  enregistrement (achat / voyage / coque) ; cf. `VehicleData`. La facette `travel` est lue par
 *  `engine/travel` ; les facettes `purchase`/`hull` par le marché et les incidents/combat. */
export const vehicles = vehiclesJson as VehicleData[];
export const vehicleById: Map<string, VehicleData> = new Map(vehicles.map((v) => [v.id, v]));
export const findVehicleById = (id: string): VehicleData | undefined => vehicleById.get(id);

/** Structures destructibles de siège (ADE II 8) — catalogue app-owned éditable au Codex. Modèle à PV
 *  calqué sur la facette `hull` des véhicules ; lu par `engine/structures.ts` (`structureCombatant`). */
export const structures = structuresJson as StructureData[];
export const structureById: Map<string, StructureData> = new Map(structures.map((s) => [s.id, s]));
export const findStructureById = (id: string): StructureData | undefined => structureById.get(id);
/** Apparence de RENDU des structures (murs/portes) — donnée pure, découplée des règles ci-dessus. */
export const structureAppearances = structureAppearanceJson as import('../gameIso/catalog/structures/types').StructureAppearanceDef[];

/** Combat de masse / Puissance de Bataille (ADE II 8, l.13-321) — 5 tables verbatim NICHÉES dans
 *  UN seul fichier (`mass-battle.json`, pas un tableau plat par table) : exposées ICI (facade) pour que
 *  le Codex/l'éditeur DEV les édite comme n'importe quel autre dataset (seam `overrides.ts`) ; le moteur
 *  pur (`engine/massBattle.ts`) les relit d'ICI (types définis là-bas, réimportés en `import type` —
 *  même patron que `maladies`/`DiseaseDef`). Noms préfixés `massBattle*` : `structures` est déjà pris par
 *  le catalogue de structures de siège JOUABLES ci-dessus (schéma différent : BE/B structuré + traits
 *  `{id}[]`, quand mass-battle.json reste `be`/`wounds`/`traits` en chaîne verbatim imprimée). */
export const massBattlePowerEstimate = massBattleJson.powerEstimate as PowerEstimateRow[];
export const massBattleMightModifiers = massBattleJson.mightModifiers as MightModifierRow[];
export const massBattleWarMachines = massBattleJson.warMachines as WarMachineRow[];
export const massBattleStructures = massBattleJson.structures as MassBattleStructureRow[];
export const massBattleHazards = massBattleJson.hazards as HazardRow[];
/** Objet racine (mêmes références vivantes que les 5 tableaux ci-dessus) — cible de sérialisation PLEINE
 *  au save d'une entrée d'un sous-tableau (l'éditeur ne doit PAS écrire QUE le tableau touché, sous peine
 *  de perdre les 4 autres sections du fichier). Cf. `data/overrides.ts::NESTED_ARRAY_FILE`. */
export const massBattleData = massBattleJson;

/** Apparence de RENDU du relief (falaises/rampes/tabliers/piliers/POV) — donnée pure. */
export const reliefMaterials = reliefMaterialsJson as import('../gameIso/catalog/relief/types').ReliefMaterialDef[];

/** Apparence de RENDU des toits (matériaux de couverture + plan vu du dessus) — donnée pure. */
export const roofMaterials = roofMaterialsJson as import('../gameIso/catalog/roofs/types').RoofMaterialDef[];

/** AMBIANCE de rendu partagée iso ⇄ POV (ciel/brumes/vignette/voile chaud/filtre d'étage) — donnée pure. */
export const ambiance = ambianceJson as import('../gameIso/catalog/ambiance').AmbianceDef;

/** Traits & Améliorations de navire (MDG 12) — catalogue app-owned éditable au Codex. La DONNÉE (`desc`
 *  verbatim + effet) vit ici ; `engine/navalTraits.ts` ne fait que la LIRE (aucune valeur codée en dur).
 *  `kind` distingue Trait (construction) et Amélioration (ajout/retrait) ; `ranked` = prend un Indice
 *  (« Renforcé 2 », « Peu maniable 1 »). L'EFFET mécanique passe par la langue UNIQUE `GameOp[]` (`passive`,
 *  MÊME vocabulaire/éditeur que traits & mutations) — `ap` (Blindage → PA de coque), `moveMod` (Lissage → M),
 *  `skillDRBonus` (Peu maniable → DR des Tests de Voile/Ramer). Restent en CHAMP DE DOMAINE les sous-systèmes
 *  navire hors vocabulaire combattant : `ram` (Bélier → collision proue/frontale) et `deckCover` (Sabord →
 *  couvert de pont). Absent = pas d'effet mécanisé (Robuste déféré) ou déjà baké dans les colonnes du véhicule
 *  (Renforcé/Solide → E/B). */
/** Taille de navire MDG (catégorie dérivée de la LONGUEUR, tableau CARACTÉRISTIQUES DE BATEAU STANDARD,
 *  MDG 12 l.120-129 : 1-10 m Minuscule … 81 m+ Monstrueuse) — ids stables des bandes d'installation. */
export type ShipSize = 'minuscule' | 'tres-petite' | 'petite' | 'moyenne' | 'grande' | 'enorme' | 'monstrueuse';
/** Palier de LONGUEUR d'un tarif d'installation (#277 : MSRC 12 l.54-135 tarife par TYPE de navire à
 *  longueurs explicites — barque 5 m et esquif 10 m tombent dans la MÊME `ShipSize` « minuscule » avec des
 *  tarifs DIFFÉRENTS, la Taille ne peut donc pas discriminer). `maxLengthM` = borne haute inclusive du
 *  palier (`null` = bande OUVERTE au-delà — le dernier élément du tableau, triés par longueur croissante) ;
 *  `value` = CO (coût) ou Enc (poids) selon le champ porteur ; `maison` = réf nue du tarif au-delà de la
 *  dernière borne chiffrée par le livre porté sur la bande concernée. */
export interface InstallBand { maxLengthM: number | null; value: number; maison?: string }
/** Coût / Poids d'INSTALLATION d'une Amélioration navale (MDG 12, lignes « Coût : / Poids : » de chaque
 *  Amélioration, l.195-364 ; MSRC 12 l.1-140) — VERBATIM structuré par paliers de LONGUEUR. `per: '5m'` =
 *  « par tranche de 5 m de Taille » (Blindage, Lissage) ; `per: 'unite'` = « par cabine » (Cabine de luxe) ;
 *  `'modele'` = ceux du modèle embarqué (Embarcation de bord). `weightEnc` absent = aucun poids (Lissage).
 *  Donnée consommée par le chantier construction/réparation navale (lot systèmes) — aucune valeur codée en
 *  dur. */
export interface NavalInstall {
  cost: { bands: InstallBand[]; per?: '5m' | '10m' | 'unite' } | 'modele';
  weightEnc?: { bands: InstallBand[]; per?: '5m' | '10m' | 'unite' } | 'modele';
}
export interface NavalTraitData {
  /** id STABLE (slug) — la clé d'appariement avec `ship.traits`/`Combatant.upgrades` (`NavalTraitRef.id`). */
  id: string;
  /** Libellé VERBATIM de BASE (sans Indice) — affichage seul, résolu par `findNavalTrait(id)?.label`. */
  label: string;
  kind: 'trait' | 'amelioration';
  source?: SourceRef;
  /** Emplacement SECONDAIRE (#563) — même Trait/Amélioration à cheval prose⇄bloc Coût/Poids ailleurs
   *  (ex. Murs blindés : prose T2C 66, bloc Coût/Poids T2C 65). Accessors `allLocations`/
   *  `sourceBooks` (`src/data/sourceRefs.ts`). */
  alsoIn?: SecondaryRef[];
  desc: string;
  /** Coût/Poids d'installation (Améliorations seulement) — cf. `NavalInstall`. */
  install?: NavalInstall;
  /** Prend un Indice (le libellé authoré peut être « Renforcé 2 ») — l'effet `passive` est répété par niveau. */
  ranked?: boolean;
  /** Effet mécanique en `GameOp[]` (langue unique) — lu par `navalPassiveOps` puis filtré par effet
   *  (`ap`/`moveMod`/`skillDRBonus`), répété ×Indice si `ranked`. MÊME éditeur `GameOpEditor` que les traits. */
  passive?: import('../engine/ops').GameOp[];
  /** Bélier (MDG 12 l.221) : bonus de COLLISION (géométrie proue/frontale) — sous-système navire hors
   *  vocabulaire combattant (≠ `ap` qui mitige TOUT) → injecté dans `resolveCollision` via `belierRam`. */
  ram?: { ic: number; ap: number };
  /** Couvert de pont GRADUÉ (`DeckCoverClass`) offert par l'Amélioration à ses postes — Sabord/Murs blindés
   *  = `totale` (MDG 12 l.364 / MSRC 12 l.85), Plat-bord = `moyenne` (MSRC 12 l.111). Géométrie de Pont,
   *  consommée par `effectiveDeckPostes`/le rendu du Pont. Sous-système navire, hors vocabulaire combattant. */
  deckCover?: import('../engine/types').DeckCoverClass;
  /** Modificateur (points) au Test de Navigation POUR DIRIGER le bateau — Bouteur +20 (MSRC 12 l.66),
   *  Gréement de course −10 (l.137). Sous-système manœuvre, converti en DR d'équipage par `navalNavTestDR`. */
  navTestMod?: number;
  /** #221 : même champ `maison` que `TraumaFiche` (`src/data/schemas/defs/traumas.ts:32`). */
  maison?: string;
}
export const NAVAL_TRAITS = navalTraitsJson as NavalTraitData[];
const navalTraitById = new Map(NAVAL_TRAITS.map((t) => [t.id, t]));
/** Entrée du catalogue pour une réf par id STABLE (`NavalTraitRef.id`) — l'Indice vit dans `NavalTraitRef.value`,
 *  PAS dans la clé (plus de parsing de libellé « Renforcé 2 »). PUR. */
export function findNavalTrait(id: string): NavalTraitData | undefined {
  return navalTraitById.get(id);
}
/** Index des ports de la Mer des Griffes (#217, MDG 15 l.439-506) — catalogue app-owned éditable au
 *  Codex, consommé PAR RÉFÉRENCE depuis un lieu de la carte du monde (`MapPlace.port.ref`,
 *  `state/worldMap.ts`). `production`/`surplus`/`demande` sont keyés par id de `sea-cargo.json`
 *  (+ marqueurs `commerce`/`minimum-vital`), même vocabulaire que `PortProfile` (`engine/seaVoyage.ts`). */
export interface NavalPortData {
  id: string;
  label: string;
  /** Région/nation de la colonne « Lieu » de l'Index (regroupement RAW, ex. « Nordland », « Tilée »). */
  region: string;
  taille: number;
  richesse: number;
  production?: string[];
  surplus?: Record<string, number>;
  demande?: Record<string, number>;
  /** Grand port cosmopolite (Marienburg/Lothern, MDG 15 l.343-349). */
  cosmopolite?: boolean;
  /** Colonne Dirigeant, verbatim. */
  dirigeant?: string;
  /** Colonne Notes, verbatim Markdown. */
  desc?: string;
  source: SourceRef;
}
export const navalPorts = navalPortsJson as NavalPortData[];
const navalPortById = new Map(navalPorts.map((p) => [p.id, p]));
export function findNavalPortById(id: string): NavalPortData | undefined {
  return navalPortById.get(id);
}

/** LOT 1 #422 : 5 datasets NAVAUX de contenu (tables MDG 12/13/15) exposés au Codex — mêmes garanties
 *  de référence LIVE (singleton ESM, même fichier physique relu par `engine/shipNavigation.ts`,
 *  `engine/seaNavigation.ts`, `engine/seaPerils.ts`, `engine/seaWeather.ts`, `engine/shipBuild.ts`) que
 *  `WATER_EXPOSURE` ci-dessus. Types réutilisés DEPUIS le schéma zod (`schemas/defs/*`, patron
 *  `CharacteristicsData`/`AxesData`) — pas de redéclaration divergente. */
export const navalProgression = navalProgressionJson as NavalProgressionData;
export const seaNavigation = seaNavigationJson as SeaNavigationData;
export const seaPerils = seaPerilsJson as SeaPerilsData;
export const seaWeather = seaWeatherJson as SeaWeatherData;
export const shipConstruction = shipConstructionJson as ShipConstructionData;

/** LOT 2 #422 : Navigation fluviale (MSRC 7) — pendant fluvial de `seaNavigation`, même patron
 *  d'export (référence LIVE au même fichier physique relu par `engine/riverNavigation.ts`). */
export const riverNavigation = riverNavigationJson as RiverNavigationData;

/** Vocabulaire des SERVICES de lieu (#343, `lieux-services.json`) — catalogue EXTENSIBLE consommé par
 *  référence (`MapPlace.services[].kind`) et résolu par `placeServices` (`src/state/worldMap.ts`).
 *  `port`/`marché` gardent leur propre schéma riche ; ce catalogue couvre le RESTE (auberge/temple/
 *  forgeron/guilde…) — id STABLE → libellé/icône d'affichage du hub de lieu. */
export interface LieuServiceData {
  id: string;
  label: string;
  icon?: string;
  desc?: string;
  /** Réplique de boniment (saveur maison) du bandeau d'interlocuteur statique (`SpeakerBanner`). */
  hostLine?: string;
  /** Bande d'ambiance par défaut (id du registre `src/ui/backdrops`). */
  backdrop?: string;
  /** Archétype marchand ouvert par ce service (`src/state/merchants/defs/*.ts`, #369). */
  merchantArchetype?: string;
}
export const lieuxServices = lieuxServicesJson as LieuServiceData[];
const lieuServiceById = new Map(lieuxServices.map((s) => [s.id, s]));
export function findLieuServiceById(id: string): LieuServiceData | undefined {
  return lieuServiceById.get(id);
}
/** Chanson de marins (MDG 09 l.218-248, payload du Talent Chanson de marin) — catalogue app-owned.
 *  `crewOps` = effet exprimé dans la langue UNIQUE `GameOp[]`, appliqué à CHAQUE membre d'équipage pendant
 *  l'effet (3 min + DR du Test de Divertissement (Chant) en minutes, 1 chanson par quart — activation
 *  `battleSingShanty`, state/combatSlice). `captainOps` = ops appliquées au seul CAPITAINE (titulaire du
 *  rôle — « Suivez le capitaine », l.246-248). `note` = clause RAW laissée à l'arbitrage MJ (intention/
 *  conséquence de Test non suivies par le moteur) — affichée, jamais un effet inventé. */
export interface SeaShantyData {
  id: string;
  label: string;
  desc: string;
  crewOps?: import('../engine/ops').GameOp[];
  captainOps?: import('../engine/ops').GameOp[];
  note?: string;
  source: SourceRef;
}
export const seaShanties = seaShantiesJson as SeaShantyData[];
const seaShantyById = new Map(seaShanties.map((s) => [s.id, s]));
export function findSeaShantyById(id: string): SeaShantyData | undefined {
  return seaShantyById.get(id);
}
/** Rôles d'équipage naval (MDG 14 « Tests d'équipage ») — catalogue app-owned éditable au Codex.
 *  Chaque rôle mappe une (ou plusieurs, ex. Mousse = Voile/Ramer → meilleure) Compétence par `id` STABLE
 *  (+ `spec` pour Artilleur/Cuisinier/Chansonnier). Le `desc` est le verbatim de la colonne « Tâches ». */
/** Solde d'un rôle (MDG 14 l.293-302 « Exemples de mercenaires ») : coûts quotidien/hebdomadaire
 *  verbatim ; `source` = correspondance RAW explicite, `maison` = correspondance arbitrée. #216 */
export interface CrewWage {
  daily: { gold: number; silver: number; bronze: number };
  weekly: { gold: number; silver: number; bronze: number };
  source?: SourceRef;
  maison?: string;
}
export interface CrewRoleData {
  id: string;
  label: string;
  skills: { skillId: string; spec?: string }[];
  desc: string;
  wage?: CrewWage;
}
/** Type de Test d'équipage (MDG 14) : rôles contributeurs + rôle ESSENTIEL (son DR compte double). */
export interface CrewTestTypeData {
  id: string;
  label: string;
  roles: string[];
  essential: string;
  /** ENJEU du Test (#331) : ce que l'échec coûte, verbatim MDG 14 — surfacé sous le titre d'étape. */
  enjeu?: string;
}
export const crewRoles = crewRolesJson as CrewRoleData[];
const crewRoleById = new Map(crewRoles.map((r) => [r.id, r]));
export const findCrewRoleById = (id: string): CrewRoleData | undefined => crewRoleById.get(id);
export const crewTestTypes = (crewTestTypesJson as { types: CrewTestTypeData[] }).types;
const crewTestTypeById = new Map(crewTestTypes.map((t) => [t.id, t]));
export const findCrewTestTypeById = (id: string): CrewTestTypeData | undefined => crewTestTypeById.get(id);
/** Groupes d'objet app-owned (taxonomie `subType` id-ifiée) — éditable au Codex. */
export const weaponGroups = weaponGroupsJson as WeaponGroupData[];
export const groups = groupsJson as GroupData[];
// Bestiaire APP-OWNED : officiel + complément « frenchy.bzh » INTÉGRÉ directement dans creatures.json
// (fusionné 2026-06-15, espèce explicite posée) — plus de dataset frenchy séparé à merger.
export const creatures = creaturesJson as CreatureData[];
// Sorts app-owned — officiels + homebrew « frenchy.bzh » des casters (Magie Mineure/Arcanes,
// Bénédictions, Miracles…) TOUT dans `spells.json` (l'ex-`frenchy-spells.json`, migration one-shot,
// a été FONDU ici ; chaque sort garde sa `source`, dont `frenchy.bzh` pour le homebrew).
export const spells = spellsJson as SpellData[];
/** Manœuvres app-owned (attaques naturelles activées — LDB 85) : ENTITÉ de 1ʳᵉ classe éditable au Codex,
 *  effets en GameOp. Octroyées aux créatures via `TraitData.grantsManeuvers` ; résolues par id. */
export const maneuvers = maneuversJson as ManeuverDef[];
/** Niveaux de lumière ambiante app-owned (brouillard de guerre) : `scalar` 0..1 (assombrissement du
 *  rendu) + `baseSightTiles` (rayon de vue de base en cases — réglage MAISON : le LDB ne stat pas la
 *  portée de vue). Édité au Codex. `Scene.ambientLight` réfère un `id` (ou `auto` = suit l'horloge). */
export interface LightLevelDef { id: string; label: string; scalar: number; baseSightTiles: number }
export const lightLevels = lightLevelsJson as LightLevelDef[];
export const LIGHT_LEVEL_BY_ID = new Map(lightLevels.map((l) => [l.id, l]));
export const findLightLevelById = (id: string): LightLevelDef | undefined => LIGHT_LEVEL_BY_ID.get(id);
/** Type de PROP/décor app-owned : couche SÉMANTIQUE (physique `solid`, opacité `opaque`, classe de
 *  `cover`, émission de lumière `light`) — le rendu SVG/label reste dans le catalogue gameIso. Lu par
 *  la walkability (`sceneRules`), la Ligne de Vue/couvert (`lineOfSight`) et la lumière (`vision`).
 *  Édité au Codex. Un prop ABSENT de ce dataset = passable, transparent, sans couvert ni lumière. */
export interface PropData { id: string; solid?: boolean; opaque?: boolean; cover?: 'imparfaite' | 'moyenne' | 'totale'; light?: { radiusTiles: number } }
export const props = propsJson as PropData[];
export const PROP_BY_ID = new Map(props.map((p) => [p.id, p]));
export const findPropById = (id: string): PropData | undefined => PROP_BY_ID.get(id);
/** Domaines de magie app-owned (LDB 48) — ENTITÉ éditable au Codex (attributs en données : onHit,
 *  projectile, post-incantation). Le RUNTIME résout par `id` STABLE (= `SpellData.domainId`, cf.
 *  `findDomainById`) ; `domainByLabel`/`findDomain` restent pour l'authoring/affichage. */
export const domains = domainsJson as DomainData[];
export const domainByLabel: Map<string, DomainData> = new Map(domains.map((d) => [d.label, d]));
export const findDomain = (label: string | null | undefined): DomainData | undefined => (label ? domainByLabel.get(label) : undefined);
/** Index des Domaines par `id` STABLE — lookup RUNTIME indépendant de la langue (sort→domaine). */
export const domainById: Map<string, DomainData> = new Map(domains.map((d) => [d.id, d]));
export const findDomainById = (id: string | null | undefined): DomainData | undefined => (id ? domainById.get(id) : undefined);
/** Index des Domaines par `wind` (Vent de Magie) — résout un Vent (Ghur, Aqshy, Dhar…) vers son Domaine.
 *  SOURCE de la Compétence Focalisation (spécialisée par Vent) : un `focalisation.spec` porte l'id du
 *  Domaine et AFFICHE le Vent ; ce lookup fait l'inverse (authoring/migration Vent → id). */
export const domainByWind: Map<string, DomainData> = new Map(domains.filter((d) => d.wind).map((d) => [d.wind as string, d]));
export const findDomainByWind = (wind: string | null | undefined): DomainData | undefined => (wind ? domainByWind.get(wind) : undefined);
/** Un axe du catalogue `axes.json` (#409) — vue TS de son schéma zod. */
export type AxisData = AxesData[number];
/** Catalogue des axes de forces/faiblesses (mécanique MAISON, #409) : socle de base (`core`) +
 *  exemples de scénario (négoce/ingénierie/navigation). `derivation` liste des ids STABLES de
 *  `skills.json`/`talents.json` — résolus par `axisScore` (`src/engine/axes.ts`). Intégrité des ids
 *  vérifiée par `axes-integrity.test.ts` (patron `book-source-integrity.test.ts`). */
export const allAxes = axesJson as AxisData[];
const AXIS_BY_ID = new Map(allAxes.map((a) => [a.id, a]));
export const findAxisById = (id: string): AxisData | undefined => AXIS_BY_ID.get(id);
/** Socle par défaut d'une campagne SANS `activeAxes` déclaré (`WorldMap.activeAxes`). */
export const CORE_AXIS_IDS: string[] = allAxes.filter((a) => a.core).map((a) => a.id);
export const eyes = eyesJson as DetailColorData[];
export const hairs = hairsJson as DetailColorData[];
/** Calendrier impérial — tables de CONTENU éditables au Codex (cf. `engine/clock.ts` pour la mécanique). */
export const calendarMonths = calendarMonthsJson as { id: string; name: string; days: number }[];
export const calendarIntercalary = calendarIntercalaryJson as { id: string; name: string; afterMonth: number }[];
export const calendarWeekdays = calendarWeekdaysJson as { id: string; name: string }[];
export const calendarPhases = calendarPhasesJson as { key: string; start: number; label: string; icon: string }[];
/** Table de Météo de voyage TERRESTRE (EDOC 8). `seasons` = plages d100 → météo par saison ;
 *  `conditions` = EFFETS par météo (mêmes formes de donnée que `sea-weather.json`). Éditable au Codex. */
const weatherData = weatherJson as {
  seasons: { id: string; label: string; ranges: { max: number; weather: string }[] }[];
  physicalTestChars: string[];
  conditions: {
    id: string; label: string; desc?: string;
    visibiliteM?: number; rangedMod?: number; rangedUseless?: boolean; powderUseless?: boolean;
    physicalTestMod?: number; movementWalkOnly?: boolean; lightningNervous?: boolean;
    resistanceTest?: { difficulty: string; onFail: 'extenue'; enjeu?: string };
  }[];
};
/** 1 entrée par saison, `ranges` = plages d100 → météo (lecture par `rollStageWeather`). */
export const weather = weatherData.seasons;
/** Effets par météo (visibilité, mods de tir, poudre, Tests physiques, plafond de mouvement…). */
export const weatherConditions = weatherData.conditions;
/** Caractéristiques réputées « physiques » (liste MAISON, EDOC 8 l.82 non chiffrée). */
export const weatherPhysicalTestChars = weatherData.physicalTestChars;
/** Tableau des Vents Tourbillonnants (LDB 46 l.183-190, option `vents-tourbillonnants`) — tirage 1d10
 *  (`engine/windsOfMagic.ts`, lecture JSON directe comme `drunkenness.ts`) ; réexporté ICI pour le
 *  Codex (`ventsTourbillonnants`, `ui/compendium/registry.ts`). */
export const windsOfMagicTable = (ventsTourbillonnantsJson as { table: { id: string; min: number; max: number; mod: number; label: string }[] }).table;
export const details = detailsJson as DetailsData;
export const stars = starsJson as StarData[];
/** Les 5 demeures célestes (ADE II ch.03 l.502-512, « Déterminer les demeures célestes ») — ossature
 *  narrative du thème astral (flavor pur, aucun effet mécanique). `rand` = borne haute du 1d10. */
export const celestialHouses = astrologyJson as CelestialHouseData[];
/** Apparences d'espèce de rig (app-owned, éditable) — SOURCE lue+résolue par `raceById` (rig). */
export const raceAppearance = raceAppearanceJson as RaceAppearanceData[];
export const locations = locationsJson as LocationData[];
const LOCATION_BY_ID = new Map(locations.map((l) => [l.id, l]));
/** Résout un Lieu par son `id` STABLE (cible de `LocationData.parent`). Le libellé ne sert qu'à l'affichage. */
export function findLocationById(id: string | null | undefined): LocationData | undefined {
  return id ? LOCATION_BY_ID.get(id) : undefined;
}
export const books = booksJson as BookData[];
const BOOK_BY_ID = new Map<string, BookData>(books.map((b) => [b.id, b]));
/** Résout un Livre par son `id` STABLE (cible de `source.book`) — `abbr`/`label` ne servent qu'à l'affichage. */
export function findBookById(id: string | null | undefined): BookData | undefined {
  return id ? BOOK_BY_ID.get(id) : undefined;
}
/** Acronyme d'un livre depuis l'`id` porté par `source.book` (fallback = l'id si inconnu). */
export function bookAbr(id: string | null | undefined): string {
  if (!id) return '';
  return BOOK_BY_ID.get(id)?.abbr ?? id;
}
/** Culte/Dieu (LDB 41) : `id` = slug STABLE (« sigmar »), `label` = nom affiché (« Sigmar »), Bénédictions/
 *  Miracles en `Ref[]` (sorts par id), desc = lore HTML (Codex). Dataset éditable (Compendium) — remplace
 *  les `cults/defs/*.ts` (codegen retiré). */
export interface GodData {
  id: string;
  label: string;
  title?: string;
  blessings: Ref[];
  miracles: Ref[];
  /** Sorts du Chaos accordés par ce Dieu Sombre (LDB 10 « Magie du Chaos » : « Domaine du Chaos » de
   *  Nurgle/Slaanesh/Tzeentch), IDS de sort — l'analogue de `blessings`/`miracles` pour la 3e famille de
   *  lanceur. SOURCE d'identité (le grimoire compare par id) ; le `subType` du sort ne sert qu'à l'affichage. */
  chaosSpells?: Ref[];
  desc?: string;
  source?: SourceRef;
  /** VERROU de Péché du culte (MDG 11 l.142, Stromfels : « retire à un suivant la capacité d'utiliser le
   *  Talent *Invocation* s'il possède au moins deux Points de Péché et celle d'utiliser le Talent *Béni*
   *  s'il possède au moins cinq Points de Péché ») — seuil de Points de Péché à partir duquel le dieu
   *  RETIRE l'usage du Talent de Prière (clé = famille d'incantation). GÉNÉRIQUE : aucun culte LDB n'en
   *  porte (LDB 40 ne connaît que la Colère au dé des unités) ; consommé par le flux de Prière
   *  (`prayerSinLock`, engine/magic). */
  sinLocks?: { beni?: number; invocation?: number };
}
export const gods = godsJson as GodData[];
export const names = namesJson as Record<string, NamePool>;
/** Pont id→libellé pour `names.json` (SEUL espace resté label-keyé — #313, exception documentée
 *  `schemas/defs/names.ts`) — conversion au SEUL point d'appel (`engine/names.generateName`), jamais
 *  ré-inventée ailleurs. */
export const RACE_KEY_LABEL: Record<RaceKey, string> = {
  humain: 'Humain', halfling: 'Halfling', nain: 'Nain', gnome: 'Gnome', ogre: 'Ogre',
  'haut-elfe': 'Haut Elfe', 'elfe-sylvain': 'Elfe Sylvain',
};
/** Personnages pré-tirés (DÉFINITIONS) — app-owned éditable au Codex ; la FABRIQUE (`createHero`)
 *  vit dans `pregens.ts`, qui consomme CE tableau (même référence → mutation live de l'éditeur). */
export const pregens = pregensJson as PregenDef[];
/** Tableau des Oups ! (LDB Maladresses) — app-owned éditable ; consommé par `oups.ts` (même référence). */
export const oups = oupsJson as OupsRow[];
/** Événements « Entre deux aventures » (LDB d100) — app-owned éditable ; consommé par `interludeEvents.ts`. */
export const interludeEvents = interludeEventsJson as InterludeEvent[];
/** Péripéties de voyage (1d10) — app-owned éditable ; consommé par `peripeties.ts` (même référence). */
export const peripeties = peripetiesJson as Peripetie[];

const ETAT_BY_ID = new Map(etats.map((e) => [e.id, e]));
/** Résout un État par son `id` STABLE (`ConditionId`). */
export function findConditionById(id: string): EtatData | undefined {
  return ETAT_BY_ID.get(id);
}

/** États PSYCHOLOGIQUES (LDB 21) — base app-owned éditable au Codex. Données de Frénésie aujourd'hui ;
 *  Peur/Terreur/Animosité/Haine à migrer (chantier psychologie data-driven). */
export const psychologies = psychologyJson as PsychologyData[];
const PSYCH_BY_ID = new Map(psychologies.map((p) => [p.id, p]));
/** Résout un état psychologique par son `id` STABLE (`PsychType`). Absent → undefined (folding inerte). */
export function findPsychologyById(id: string): PsychologyData | undefined {
  return PSYCH_BY_ID.get(id);
}
/** Libellé d'affichage d'un État par son id (repli sur l'id). SOURCE UNIQUE du nom d'État affiché. */
export function conditionLabel(id: string): string {
  return ETAT_BY_ID.get(id)?.label ?? id;
}
/** Libellé d'affichage d'un état psychologique par son `id` (`PsychType`), repli sur l'id — délègue au
 *  résolveur de libellé GÉNÉRIQUE (`refLabel`), plus de copie locale du motif `MAP.get(id)?.label ?? id`. */
export function psychologyLabel(id: string): string {
  return refLabel('psychology', { id });
}
const ETAT_ID_BY_LABEL = new Map(etats.map((e) => [e.label.toLowerCase(), e.id]));
/** Résout un `id` d'État depuis un LIBELLÉ (authoring : parsing de desc/texte) — insensible à la casse. */
export function conditionIdByLabel(label: string): string | undefined {
  return ETAT_ID_BY_LABEL.get(label.toLowerCase());
}
/** Inverse de `CHAR_LABELS` (engine/types) : nom FR complet (« Force Mentale ») → `CharKey` (« FM »).
 *  Couture UNIQUE label→id des Caractéristiques — consommée par `engine/spellRange.ts` pour parser
 *  la prose des Portées/ZdE de sort (« (Bonus de Force Mentale) mètres »), jamais recopiée ailleurs. */
const CHAR_KEY_BY_LABEL = new Map<string, CharKey>((Object.entries(CHAR_LABELS) as [CharKey, string][]).map(([k, v]) => [v, k]));
export function charKeyByLabel(label: string): CharKey | undefined {
  return CHAR_KEY_BY_LABEL.get(label);
}
const SPECIES_BY_ID = new Map(species.map((s) => [s.id, s]));
/** Résout une Espèce par son `id` STABLE (slug du libellé) — réf runtime/données (Combatant.species,
 *  pregens, draft). Le libellé ne sert qu'à l'affichage (`speciesSingular`). */
export function findSpeciesById(id: string | undefined): SpeciesData | undefined {
  return id ? SPECIES_BY_ID.get(id) : undefined;
}
/** Taille CONFÉRÉE par les talents d'espèce FIXES (`{ref}`, jamais `{choice}`/`{wildcard}`/`{random}`
 *  résiduels — chip décoratif du créateur avant résolution complète, #572). Même vocabulaire que
 *  `sizeFromTalents` (engine/character.ts) : la plus grande catégorie parmi `TalentData.size`. */
export function speciesSize(sp: SpeciesData): import('../engine/size').SizeCategory {
  const ids = sp.talents.filter((t): t is { ref: Ref } => 'ref' in t).map((t) => t.ref.id);
  return sizeFromTalents(ids, (id) => findTalentById(id)?.size);
}
/** id d'espèce RIG (slug, clé `appearance.species`) dérivé d'un id d'espèce RULES (ou chaîne libre) :
 *  slug du LIBELLÉ d'espèce. Pont UNIQUE rules→rig (pregens/draft/creator/defaultAppearance). Défaut Humain.
 *  Invariant : `slugId(label) === id` pour TOUTE entrée de species.json → la sortie est un id species.json
 *  (vocabulaire canonique d'`appearance.species`, gardé par `refs-migrated.test.ts`). */
export function rigSpeciesId(rulesId: string | undefined): RigSpeciesId {
  return slugId(findSpeciesById(rulesId)?.label ?? rulesId ?? 'Humain') as RigSpeciesId;
}
/** Seuil d100 de mutation PHYSIQUE d'une espèce par `id` (LDB 19 l.87-91). Défaut **50** = colonne
 *  Humain (LDB) — couvre aussi le Gnome (NADJ « Gnomes et Corruption » : « mutent comme les humains »)
 *  et toute espèce hors Tableau. Les valeurs ≠ 50 (Elfe 0, Nain 5, Halfling 10, Ogre 10) sont en donnée. */
export function mutationBodyMaxForSpecies(id: string | undefined): number {
  return findSpeciesById(id)?.mutationBodyMax ?? 50;
}

/** Affichage SINGULIER de l'espèce d'un INDIVIDU : les `label` du catalogue sont des libellés de
 *  CATÉGORIE au pluriel (« Nains », « Humains (Reiklander) ») ; un personnage est un individu (B1).
 *  Mappe le groupe pluriel → singulier en conservant la sous-espèce entre parenthèses. Repli = tel quel. */
const SPECIES_SINGULAR: Record<string, string> = {
  Humains: 'Humain',
  Halflings: 'Halfling',
  Nains: 'Nain',
  Gnomes: 'Gnome',
  Ogres: 'Ogre',
  'Hauts elfes': 'Haut elfe',
  'Elfes sylvains': 'Elfe sylvain',
};
export function speciesSingular(label: string | undefined): string {
  if (!label) return '';
  const i = label.indexOf('(');
  const group = (i >= 0 ? label.slice(0, i) : label).trim();
  const suffix = i >= 0 ? ' ' + label.slice(i).trim() : '';
  return (SPECIES_SINGULAR[group] ?? group) + suffix;
}
/**
 * Carrières accessibles à une espèce (Tableau des Classes et Carrières aléatoires, LDB 05
 * l.197+ : « certaines ont des restrictions liées à la Race », l.360). `ignoreRestrictions`
 * = option « Mais je veux jouer un elfe sylvain Flagellant ! » (l.362, accord du MJ).
 */
export function careersForSpecies(refCareer: RefCareerId, ignoreRestrictions = false): CareerData[] {
  if (ignoreRestrictions) return careers;
  return careers.filter((c) => c.rand?.[refCareer] != null);
}
const CAREER_BY_ID = new Map(careers.map((c) => [c.id, c]));
/** Résout une Carrière par son `id` STABLE. Le libellé ne sert qu'à l'affichage. */
export function findCareerById(id: string | undefined): CareerData | undefined {
  return id ? CAREER_BY_ID.get(id) : undefined;
}
/** Choix d'AFFICHAGE masculin/féminin (source unique) : `labelF` si sexe F et disponible, sinon
 *  `label`. Le sexe vit dans l'apparence cosmétique (`Combatant.appearance.sex`), jamais dans le moteur. */
export function displayLabelForSex(sex: 'M' | 'F' | undefined, label: string, labelF?: string): string {
  return sex === 'F' && labelF ? labelF : label;
}
/** Libellé de Carrière à AFFICHER pour un personnage (forme féminine si sexe F). Bord UI — le
 *  retour est du texte d'affichage, JAMAIS une clé. */
export function careerLabelFor(c: { career?: string; appearance?: { sex?: 'M' | 'F' } }): string {
  const career = findCareerById(c.career);
  if (!career) return c.career ?? '';
  return displayLabelForSex(c.appearance?.sex, career.label, career.labelF);
}
const CLASS_BY_ID = new Map(classes.map((c) => [c.id, c]));
/** Résout une Classe par son `id` STABLE (= `CareerData.class`). */
export function findClassById(id: string | undefined): ClassData | undefined {
  return id ? CLASS_BY_ID.get(id) : undefined;
}
export function levelsForCareer(careerId: string): CareerLevelData[] {
  return careerLevels.filter((c) => c.career === careerId).sort((a, b) => a.level - b.level);
}
export function firstLevel(careerId: string): CareerLevelData | undefined {
  return levelsForCareer(careerId)[0];
}
export function findSkill(label: string): SkillData | undefined {
  // Exact d'abord, puis casse ignorée (les statblocs de campagne écrivent « Corps à Corps »).
  return skills.find((s) => s.label === label) ?? skills.find((s) => s.label.toLowerCase() === label.toLowerCase());
}
const SKILL_BY_ID = new Map(skills.map((s) => [s.id, s]));
/** Résout une Compétence par son `id` STABLE (référence structurée — fin du lookup par libellé parsé). */
export function findSkillById(id: string): SkillData | undefined {
  return SKILL_BY_ID.get(id);
}
/** Noyau de RÉFÉRENCE structurée par `id` STABLE — partagé par toutes les refs de la donnée
 *  (compétences, talents, sorts, qualités, possessions, bénédictions…). `id` = slug du libellé
 *  (robuste au renommage) ; `spec` = spécialisation/type concret libre (« Ghur », « Reikland »), non un id. */
export interface Ref {
  id: string;
  spec?: string;
}
/** Référence STRUCTURÉE à une Compétence (`Ref` + valeur de Test IMPRIMÉE) — fin des chaînes « Calme 58 ». */
export interface SkillRef extends Ref {
  value: number;
}
/** Libellé d'affichage d'une `SkillRef` : « Langue (Magick) 63 » (base+spec via `refLabel`, + valeur). */
export function skillRefLabel(ref: SkillRef): string {
  return `${refLabel('skills', ref)} ${ref.value}`;
}
export function findTalent(label: string): TalentData | undefined {
  return talents.find((t) => t.label === label);
}
const TALENT_BY_ID = new Map(talents.map((t) => [t.id, t]));
/** Résout un Talent par son `id` STABLE (référence structurée — fin du lookup par libellé parsé). */
export function findTalentById(id: string): TalentData | undefined {
  return TALENT_BY_ID.get(id);
}
/** Référence STRUCTURÉE à un Talent (`Ref` + niveau `times` ≥2) — fin des chaînes « Maîtrise du combat 2 ». */
export interface TalentRef extends Ref {
  times?: number;
}
/** Libellé d'affichage d'une `TalentRef` : « Magie des Arcanes (Ghur) », « Maîtrise du combat 2 »
 *  (base+spec via `refLabel`, + niveau si ≥2). La spec RESTE dans le libellé (clé du registre combatFeatures). */
export function talentRefLabel(ref: TalentRef): string {
  return refLabel('talents', ref) + (ref.times && ref.times > 1 ? ` ${ref.times}` : '');
}
/** Sous-type d'une QUALITÉ (classification RAW : qualités d'Arme LDB 62, d'Armure LDB 63, d'Objet). */
export interface QualitySubtypeData { id: string; label: string; }
export const qualitySubtypes = qualitySubtypesJson as QualitySubtypeData[];
const QUALITY_SUBTYPE_BY_ID = new Map(qualitySubtypes.map((s) => [s.id, s]));
/** Résout un sous-type de Qualité par son `id` STABLE (= `QualityData.subType`). */
export function findQualitySubtypeById(id: string | null | undefined): QualitySubtypeData | undefined {
  return id ? QUALITY_SUBTYPE_BY_ID.get(id) : undefined;
}
/** Libellé d'affichage d'un sous-type de Qualité par son id (repli sur l'id). SOURCE UNIQUE du nom. */
export function qualitySubtypeLabel(id: string | null | undefined): string {
  return id ? (QUALITY_SUBTYPE_BY_ID.get(id)?.label ?? id) : '';
}
/** Type d'une QUALITÉ : Atout (bénéfique) / Défaut (handicap) — classification RAW (LDB 62/63). */
export interface QualityTypeData { id: string; label: string; }
export const qualityTypes = qualityTypesJson as QualityTypeData[];
const QUALITY_TYPE_BY_ID = new Map(qualityTypes.map((t) => [t.id, t]));
/** Résout un type de Qualité par son `id` STABLE (= `QualityData.type`). */
export function findQualityTypeById(id: string | null | undefined): QualityTypeData | undefined {
  return id ? QUALITY_TYPE_BY_ID.get(id) : undefined;
}
/** Libellé d'affichage d'un type de Qualité par son id (repli sur l'id). SOURCE UNIQUE du nom. */
export function qualityTypeLabel(id: string | null | undefined): string {
  return id ? (QUALITY_TYPE_BY_ID.get(id)?.label ?? id) : '';
}
const WEAPON_GROUP_BY_ID = new Map(weaponGroups.map((g) => [g.id, g]));
/** Résout un Groupe d'objet par son `id` STABLE (= `subType` d'un trapping/Weapon/ItemInstance). */
export function findWeaponGroupById(id: string | null | undefined): WeaponGroupData | undefined {
  return id ? WEAPON_GROUP_BY_ID.get(id) : undefined;
}
/** Libellé d'affichage d'un Groupe d'objet par son id (repli sur l'id). SOURCE UNIQUE du nom de Groupe. */
export function weaponGroupLabel(id: string | null | undefined): string {
  return id ? (WEAPON_GROUP_BY_ID.get(id)?.label ?? id) : '';
}
const WEAPON_GROUP_ID_BY_LABEL = new Map(weaponGroups.map((g) => [g.label.toLowerCase(), g.id]));
/** Résout un `id` de Groupe depuis un LIBELLÉ (authoring/données de Sort « subType » par libellé) —
 *  insensible à la casse. Renvoie l'id si déjà un id connu, sinon résout le libellé. */
export function weaponGroupIdByLabel(label: string | null | undefined): string | undefined {
  if (!label) return undefined;
  if (WEAPON_GROUP_BY_ID.has(label)) return label; // déjà un id
  return WEAPON_GROUP_ID_BY_LABEL.get(label.toLowerCase());
}
const GROUP_BY_ID = new Map(groups.map((g) => [g.id, g]));
/** Résout un Groupe d'APPARTENANCE par son `id` STABLE (cible de Trait psy, filtre onlyGroups/exceptGroups). */
export function findGroupById(id: string | null | undefined): GroupData | undefined {
  return id ? GROUP_BY_ID.get(id) : undefined;
}
/** Libellé d'affichage d'un Groupe d'appartenance par son id (repli sur l'id). SOURCE UNIQUE du nom de Groupe. */
export function groupLabel(id: string | null | undefined): string {
  return id ? (GROUP_BY_ID.get(id)?.label ?? id) : '';
}
/** Type de Souffle d'une créature (Feu/Froid/Corrosif/Électrique/Poison/Fumée) — argument du Trait Souffle,
 *  aligné sur les manœuvres `souffle-*`. Registre SSOT (`breath-types.json`). */
export interface BreathTypeData { id: string; label: string; }
export const breathTypes = breathTypesJson as BreathTypeData[];
const BREATH_TYPE_BY_ID = new Map(breathTypes.map((b) => [b.id, b]));
/** Résout un Type de Souffle par son `id` STABLE. */
export function findBreathTypeById(id: string | null | undefined): BreathTypeData | undefined {
  return id ? BREATH_TYPE_BY_ID.get(id) : undefined;
}
/** Libellé d'affichage d'un Type de Souffle par son id (repli sur l'id). SOURCE UNIQUE du nom. */
export function breathTypeLabel(id: string | null | undefined): string {
  return id ? (BREATH_TYPE_BY_ID.get(id)?.label ?? id) : '';
}
/** Type de Dégâts ignoré par le Trait Immunité (LDB 85 : « poison, magiques ou électriques ») — argument du
 *  Trait Immunité (multi-valeurs) ET référent des `unlessImmune` des Flows (Venin (Poison)…). Registre SSOT
 *  (`damage-types.json`, éditable). */
export interface DamageTypeData { id: string; label: string; }
export const damageTypes = damageTypesJson as DamageTypeData[];
const DAMAGE_TYPE_BY_ID = new Map(damageTypes.map((t) => [t.id, t]));
/** Résout un Type de Dégâts par son `id` STABLE. */
export function findDamageTypeById(id: string | null | undefined): DamageTypeData | undefined {
  return id ? DAMAGE_TYPE_BY_ID.get(id) : undefined;
}
/** Libellé d'affichage d'un Type de Dégâts par son id (repli sur l'id). SOURCE UNIQUE du nom. */
export function damageTypeLabel(id: string | null | undefined): string {
  return id ? (DAMAGE_TYPE_BY_ID.get(id)?.label ?? id) : '';
}
const CREATURE_BY_ID = new Map(creatures.map((c) => [c.id, c]));
/** Résout une créature par son `id` STABLE — référence runtime/données (scènes, encounters, rig). */
export function findCreatureById(id: string | undefined): CreatureData | undefined {
  return id ? CREATURE_BY_ID.get(id) : undefined;
}
/** Libellé d'affichage d'une créature par son id (repli sur l'id si introuvable). */
export function creatureLabel(id: string): string {
  return CREATURE_BY_ID.get(id)?.label ?? id;
}
/** Seul lecteur autorisé de la nommé-ité (jamais via `title`) : `true` si la créature est un individu nommé. */
export function isNamed(c: CreatureData): boolean {
  return c.named === true;
}
/** Lookup par LIBELLÉ — réservé à l'AUTHORING/affichage (picker éditeur, Codex) ; le runtime résout par id. */
export function findCreature(label: string): CreatureData | undefined {
  return creatures.find((c) => c.label === label);
}
export function findSpell(label: string): SpellData | undefined {
  return spells.find((s) => s.label === label);
}
/** Signe astral par LIBELLÉ — bord AUTHORING/affichage (l'éditeur, le tirage qui produit un libellé). */
export function findStar(label: string): StarData | undefined {
  return stars.find((s) => s.label === label);
}
const STAR_BY_ID = new Map(stars.map((s) => [s.id, s]));
/** Signe astral par `id` STABLE — lookup RUNTIME indépendant de la langue (`Combatant.star` = id). */
export function findStarById(id: string | null | undefined): StarData | undefined {
  return id ? STAR_BY_ID.get(id) : undefined;
}

const TRAPPING_BY_ID = new Map(trappings.map((t) => [t.id, t]));
/** Résout une Possession par son `id` STABLE (référence structurée — ≠ `findTrapping` par libellé, authoring). */
export function findTrappingById(id: string): TrappingData | undefined {
  return TRAPPING_BY_ID.get(id);
}
const TRAPPING_BY_NORM_LABEL = new Map(trappings.map((t) => [norm(t.label), t] as const));
/** Résout une Possession par LIBELLÉ normalisé — bord AUTHORING (texte libre saisi par l'auteur : override
 *  de scène `weapon:'X'`, fixtures de test), JAMAIS au runtime moteur (qui reste sur `findTrappingById`,
 *  seule la couture label→id à l'authoring/chargement est tolérée, cf. CLAUDE.md règle stricte 7). */
export function findTrappingByLabel(label: string): TrappingData | undefined {
  return TRAPPING_BY_NORM_LABEL.get(norm(label));
}
/** Résout une Qualité par son `id` STABLE. */
export function findQualityById(id: string): QualityData | undefined {
  return qualityById.get(id);
}
const SPELL_BY_ID = new Map(spells.map((s) => [s.id, s]));
/** Résout un Sort par son `id` STABLE. */
export function findSpellById(id: string): SpellData | undefined {
  return SPELL_BY_ID.get(id);
}
export const MANEUVER_BY_ID = new Map(maneuvers.map((m) => [m.id, m]));
/** Résout une Manœuvre par son `id` STABLE (réf `TraitData.grantsManeuvers` → résolveur générique). */
export function findManeuverById(id: string): ManeuverDef | undefined {
  return MANEUVER_BY_ID.get(id);
}
const GOD_BY_ID = new Map(gods.map((g) => [g.id, g]));
/** Résout un Culte/Dieu par son id STABLE (« sigmar »). */
export function findGodById(id: string): GodData | undefined {
  return GOD_BY_ID.get(id);
}
/** Libellé affiché d'un Culte/Dieu (id → « Sigmar ») ; id inconnu → l'id lui-même. */
export function godLabel(id: string): string {
  return findGodById(id)?.label ?? id;
}
/** Ids des cultes À BÉNÉDICTIONS, triés — DÉRIVÉ de la donnée (choix de culte du joker
 *  « Béni (Au choix) » à la création/avancement). Les fiches de SAVEUR (dieux nains/elfes/halflings,
 *  provinciaux, Puissances de la Ruine) n'accordent ni Bénédictions ni Miracles (LDB 37 l.17,
 *  LDB 36 l.9) → exclues de tout choix de Prière. */
export const CULT_IDS: string[] = gods.filter((g) => g.blessings.length > 0).map((g) => g.id).sort();
/** Les six Bénédictions d'un culte, IDS de sort (le runtime/grimoire compare par id ; l'UI résout en
 *  libellé). Culte inconnu → []. */
export function blessingsOf(cult: string): string[] {
  return (findGodById(cult)?.blessings ?? []).map((r) => r.id);
}
/** Les Miracles d'un culte, IDS de sort. Culte inconnu → []. */
export function miraclesOf(cult: string): string[] {
  return (findGodById(cult)?.miracles ?? []).map((r) => r.id);
}
/** Les Sorts du Chaos accordés par un Dieu Sombre, IDS de sort (le grimoire compare par id). Dieu inconnu → []. */
export function chaosSpellsOf(god: string): string[] {
  return (findGodById(god)?.chaosSpells ?? []).map((r) => r.id);
}

/** Référence à une Qualité d'objet (`Ref` + Indice éventuel : « Solide 3 » → value 3). */
export interface QualityRef extends Ref {
  value?: number;
}
/** Quantité d'une possession conférée : nombre fixe (« (3) ») ou jet de dés structuré (« (1d10) »). */
export type CountSpec = { fixed: number } | { roll: DiceSpec };
/** Référence à une Possession : par `id` du catalogue (+ quantité éventuelle) OU texte NARRATIF hors
 *  catalogue (statblocs de créature : « collection d'alcool sans pareille »). */
export type TrappingRef = (Ref & { count?: CountSpec }) | { text: string; count?: CountSpec };
/** EMPLACEMENT d'avancement (espèce/carrière) : un espace de CHOIX, pas une instance résolue —
 *  ref simple, joker « (Au choix) » (+ specs restreintes « Fléau ou À deux mains »), choix « A ou B »,
 *  ou tirage aléatoire (« N Talent aléatoire »). Chaque branche concrète EST un `Ref`. */
export type AdvancementRef =
  | { ref: Ref }
  | { wildcard: Ref; specOptions?: string[] }
  | { choice: AdvancementRef[] }
  | { random: number };

/** Résout une entrée de dataset par (catégorie, `id`) — rendu/lookup des refs structurées. */
export function findById(category: string, id: string): { label: string } | undefined {
  switch (category) {
    case 'skills': return findSkillById(id);
    case 'talents': return findTalentById(id);
    case 'trappings': return findTrappingById(id);
    case 'weaponGroups': return findWeaponGroupById(id);
    case 'qualitySubtypes': return findQualitySubtypeById(id);
    case 'breathTypes': return findBreathTypeById(id);
    case 'damageTypes': return findDamageTypeById(id);
    case 'qualityTypes': return findQualityTypeById(id);
    case 'groups': return findGroupById(id);
    case 'qualities': return findQualityById(id);
    case 'spells': return findSpellById(id);
    case 'maneuvers': return findManeuverById(id);
    case 'careers': return findCareerById(id);
    case 'classes': return findClassById(id);
    case 'races': return findSpeciesById(id);
    case 'etats': return findConditionById(id);
    case 'psychology': return findPsychologyById(id);
    case 'maladies': return findDiseaseById(id) ? { label: findDiseaseById(id)!.label } : undefined;
    default: return undefined;
  }
}
/** CATALOGUE des sources de spéc partagées (SSOT) : `pool()` = ids DÉRIVÉS du registre (énumérés par
 *  `wildcardSpecs`, fin des `specs[]` maintenues à la main), `label(id)` = leur rendu FR. Chaque
 *  `SpecsSource` a exactement UNE entrée — ajouter une source = l'ajouter ICI, jamais un `if` par-source. */
/** UNE source de spéc : `pool()` = ids CHOISISSABLES par un joueur (registre FILTRÉ — 8 Vents+Dhar, Groupes
 *  de mêlée…) ; `label()` = affichage d'un id ; `resolves()` = l'id existe-t-il dans le REGISTRE sous-jacent
 *  (que `label` interroge). VALIDITÉ (resolves) ⊇ POOL : un statbloc de créature RAW peut porter une spéc HORS
 *  du pool joueur mais RÉELLE — ex. le Triton FOCALISE « Magie des mers de Triton » (un domaine, hors des Vents
 *  canalisables par un PC). Le pool borne le CHOIX joueur ; resolves borne la VALIDITÉ des données. */
export const SPEC_SOURCES: Record<SpecsSource, { pool(): string[]; label(id: string): string; resolves(id: string): boolean }> = {
  weaponGroupsMelee:  { pool: () => weaponGroups.filter((g) => g.combat === 'melee').map((g) => g.id),  label: (id) => weaponGroupLabel(id), resolves: (id) => !!findWeaponGroupById(id) },
  weaponGroupsRanged: { pool: () => weaponGroups.filter((g) => g.combat === 'ranged').map((g) => g.id), label: (id) => weaponGroupLabel(id), resolves: (id) => !!findWeaponGroupById(id) },
  winds:         { pool: () => domains.filter((d) => d.wind).map((d) => d.id),   label: (id) => findDomainById(id)?.wind ?? findDomainById(id)?.label ?? id, resolves: (id) => !!findDomainById(id) },
  arcaneDomains: { pool: () => domains.filter((d) => d.arcane).map((d) => d.id), label: (id) => findDomainById(id)?.label ?? id, resolves: (id) => !!findDomainById(id) },
  cultBlessings: { pool: () => gods.filter((g) => g.blessings.length).map((g) => g.id).sort(),  label: (id) => godLabel(id), resolves: (id) => !!findGodById(id) },
  cultMiracles:  { pool: () => gods.filter((g) => g.miracles.length).map((g) => g.id).sort(),   label: (id) => godLabel(id), resolves: (id) => !!findGodById(id) },
  cultChaos:     { pool: () => gods.filter((g) => (g.chaosSpells?.length ?? 0) > 0).map((g) => g.id).sort(), label: (id) => godLabel(id), resolves: (id) => !!findGodById(id) },
  seaShanties:   { pool: () => seaShanties.map((s) => s.id), label: (id) => findSeaShantyById(id)?.label ?? id, resolves: (id) => !!findSeaShantyById(id) },
  groups:        { pool: () => groups.map((g) => g.id),       label: (id) => groupLabel(id),       resolves: (id) => !!findGroupById(id) },
  diseases:      { pool: () => maladies.map((m) => m.id),     label: (id) => diseaseLabel(id),     resolves: (id) => !!findDiseaseById(id) },
  sizes:         { pool: () => Object.keys(SIZE_LABEL),       label: (id) => (SIZE_LABEL as Record<string, string>)[id] ?? id, resolves: (id) => id in SIZE_LABEL },
  mutations:     { pool: () => mutations.map((m) => m.id),    label: (id) => mutationLabel(id),    resolves: (id) => !!findMutationById(id) },
  breathTypes:   { pool: () => breathTypes.map((b) => b.id),  label: (id) => breathTypeLabel(id),  resolves: (id) => !!findBreathTypeById(id) },
  damageTypes:   { pool: () => damageTypes.map((t) => t.id),  label: (id) => damageTypeLabel(id),  resolves: (id) => !!findDamageTypeById(id) },
  weaponsMelee:  { pool: () => trappings.filter((t) => t.type === 'melee').map((t) => t.id),  label: (id) => findTrappingById(id)?.label ?? id, resolves: (id) => findTrappingById(id)?.type === 'melee' },
  weaponsRanged: { pool: () => trappings.filter((t) => t.type === 'ranged').map((t) => t.id), label: (id) => findTrappingById(id)?.label ?? id, resolves: (id) => findTrappingById(id)?.type === 'ranged' },
};
/** Ids de spéc d'une def (Compétence/Talent) : pool DÉRIVÉ du registre partagé si `specsSource` (SSOT
 *  `SPEC_SOURCES`), sinon les ids de ses `specs[]` inline. SOURCE UNIQUE du pool — consommée par
 *  `wildcardSpecs` (créateur/avancement), `resolveSpecId` (round-trip label→id) et l'affichage Compendium. */
export function specIdsOf(def: { specsSource?: SpecsSource; specs?: SpecEntry[] }): string[] {
  return def.specsSource ? SPEC_SOURCES[def.specsSource].pool() : (def.specs ?? []).map(specEntryId);
}
/** Libellé d'affichage d'une spéc (`Ref.spec`) : si la def désigne une `specsSource`, résout via le
 *  catalogue `SPEC_SOURCES` (registre partagé d'ids : Groupe d'arme → libellé, Vent, Lore, dieu, chanson) ;
 *  sinon cherche l'id dans `def.specs` (`SpecEntry[]`, résolu en label FR) ; sinon verbatim (texte
 *  libre / id inconnu — jamais d'erreur d'affichage). SOURCE UNIQUE de résolution de spéc. */
export function specLabel(category: string, refId: string, specId: string): string {
  const def = category === 'skills' ? findSkillById(refId) : category === 'talents' ? findTalentById(refId) : undefined;
  if (def?.specsSource) return SPEC_SOURCES[def.specsSource].label(specId);
  const entry = def?.specs?.find((s) => specEntryId(s) === specId);
  return entry ? specEntryLabel(entry) : specId;
}
/** Libellé CONCRET d'une `Ref` : « Magie des Arcanes (Ghur) » — base (repli sur l'id) + spec. SOURCE
 *  UNIQUE du nom affiché ET de la clé runtime (combatFeatures/grimoire). */
export function refLabel(category: string, ref: Ref): string {
  const base = findById(category, ref.id)?.label ?? ref.id;
  return ref.spec ? `${base} (${specLabel(category, ref.id, ref.spec)})` : base;
}
/** Copie une `QualityRef` de catalogue en `QualityInstance` RUNTIME FRAÎCHE (`{id, value?}`) — objet neuf
 *  (le runtime mute `qualities` : enchantements, munitions). Plus d'aplatissement en chaîne « id value ». */
export function qualityInstance(q: QualityRef): import('../engine/types').QualityInstance {
  return q.value != null ? { id: q.id, value: q.value } : { id: q.id };
}
/** Libellé d'affichage d'une `QualityRef` (ou `QualityInstance` runtime) : « Solide 3 », « Tranchante ». */
export function qualityRefLabel(q: QualityRef): string {
  return q.value != null ? `${refLabel('qualities', q)} ${q.value}` : refLabel('qualities', q);
}
/** Libellé d'affichage d'une `SkillInstance` (id+spec → « Langue (Magick) »). Repli sur l'id. */
export function skillInstanceLabel(s: { skillId: string; spec?: string }): string {
  return refLabel('skills', { id: s.skillId, spec: s.spec });
}
/** Libellé CONCRET d'une `TalentInstance` (id+spec → « Magie des Arcanes (Bête) ») — clé du registre
 *  combatFeatures + affichage. Repli sur l'id. */
export function talentConcrete(t: { talentId: string; spec?: string }): string {
  return refLabel('talents', { id: t.talentId, spec: t.spec });
}
/** Libellé d'affichage/clé concrète d'un `AdvancementRef` : « Savoir (Au choix) », « A ou B »,
 *  « 3 Talent aléatoire », « Magie des Arcanes (Bête) ». SOURCE UNIQUE (Codex + résolution création). */
export function advancementLabel(category: string, a: AdvancementRef): string {
  if ('ref' in a) return refLabel(category, a.ref);
  if ('wildcard' in a) return a.specOptions?.length
    ? `${refLabel(category, a.wildcard)} (${a.specOptions.join(' ou ')})`
    : `${refLabel(category, a.wildcard)} (Au choix)`;
  if ('choice' in a) return a.choice.map((x) => advancementLabel(category, x)).join(' ou ');
  return a.random === 1 ? 'Talent aléatoire' : `${a.random} Talent aléatoire`;
}
/** id de base d'un `AdvancementRef` simple (ref/wildcard) — pour matcher par id une compétence/un talent
 *  POSSÉDÉ (ex. compétence de revenus). undefined pour choice/random (pas un id unique). */
export function advancementBaseId(a: AdvancementRef): string | undefined {
  if ('ref' in a) return a.ref.id;
  if ('wildcard' in a) return a.wildcard.id;
  return undefined;
}
/** Libellé d'affichage d'une `TrappingRef` : « Marteau », « Pamphlétaire (3) », « Chiffon (1d10) », ou
 *  texte narratif hors catalogue. SOURCE UNIQUE (Codex, créateur, marchand, inventaire). */
export function trappingRefLabel(ref: TrappingRef): string {
  const base = 'text' in ref ? ref.text : (findTrappingById(ref.id)?.label ?? ref.id);
  const count = ref.count ? ('fixed' in ref.count ? ` (${ref.count.fixed})` : ` (${formatDice(ref.count.roll)})`) : '';
  return base + count;
}

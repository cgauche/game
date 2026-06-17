/**
 * Accès typé à NOTRE base de jeu — désormais APP-OWNED et ÉDITABLE (éditeur de données DEV in-app,
 * écran 'dataEditor'). Les *.json de ce dossier sont la SOURCE CANONIQUE app-owned : la migration
 * `build:data` (re-seed depuis Source/all-data.json) a été RETIRÉE — elle écrasait nos données curées.
 */
import type { EntityAppearance } from '../state/scene';
import characteristicsJson from './characteristics.json';
import speciesJson from './species.json';
import classesJson from './classes.json';
import careersJson from './careers.json';
import careerLevelsJson from './careerLevels.json';
import skillsJson from './skills.json';
import talentsJson from './talents.json';
import etatsJson from './etats.json';
import maladiesJson from './maladies.json';
import traitsJson from './traits.json';
import qualitiesJson from './qualities.json';
import mutationsJson from './mutations.json';
import mutationTablesJson from './mutationTables.json';
import trappingsJson from './trappings.json';
import weaponGroupsJson from './weaponGroups.json';
import creaturesJson from './creatures.json';
import frenchyTraitsJson from './frenchy-traits.json';
import frenchySpellsJson from './frenchy-spells.json';
import spellsJson from './spells.json';
import maneuversJson from './maneuvers.json';
import domainsJson from './domains.json';
import eyesJson from './eyes.json';
import hairsJson from './hairs.json';
import detailsJson from './details.json';
import starsJson from './stars.json';
import locationsJson from './locations.json';
import booksJson from './books.json';
import namesJson from './names.json';
import raceAppearanceJson from './raceAppearance.json';
import godsJson from './gods.json';
import { CharKey, Weapon } from '../engine/types';
import type { MutationData, MutationTable } from './mutations'; // type-only (évite le cycle data→mutations→engine→data)
import type { DiseaseDef } from '../engine/disease'; // type-only (le runtime de disease.ts importe `maladies` d'ici)

export interface SpeciesData {
  /** id STABLE (slug du libellé) — cible de `Combatant.species`, pregens, draft. Le `label` ne sert
   *  qu'à l'affichage (`speciesSingular`). */
  id: string;
  label: string;
  refChar: string;
  refCareer: string;
  rand: number;
  desc: string;
  movement: number;
  fate: { fate: number; resilience: number; extra: number };
  small: boolean;
  baseChar: Partial<Record<CharKey, number>>;
  /** Compétences d'espèce (`AdvancementRef[]` ; positionnel +5/+3 — lu via `advancementLabel`). */
  skills: AdvancementRef[];
  /** Talents d'espèce (`AdvancementRef[]` : {ref}, {choice} « A ou B », {random} « N aléatoire », {wildcard}). */
  talents: AdvancementRef[];
  source: { book: string; page: number };
}
export interface ClassData {
  /** id STABLE (slug du libellé) — cible de `CareerData.class`. */
  id: string;
  label: string;
  /** Possessions de départ (`TrappingRef` : id du catalogue + quantité, ou `{text}` flavor hors catalogue). */
  trappings: TrappingRef[];
  desc: string;
  source: { book: string; page: number };
}
export interface CareerData {
  /** id STABLE (slug du libellé) — cible de `Combatant.career`, `CareerLevelData.career`, pregens. */
  id: string;
  label: string;
  /** `id` de la Classe (`ClassData.id`) — réf d'entité, ≠ libellé. */
  class: string;
  /** Tableau des Classes et Carrières aléatoires (LDB 05 l.197+) : borne haute d100 par colonne
   *  d'espèce (`SpeciesData.refCareer`). null = carrière INDISPONIBLE pour cette espèce (l.360). */
  rand: Record<string, number | null>;
  desc: string;
  source: { book: string; page: number };
}
export interface CareerLevelData {
  label: string;
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
export interface SkillData {
  /** Identifiant STABLE (slug du libellé d'origine) — cible des références structurées, robuste au
   *  renommage du `label`. Source unique pour `findSkillById`. */
  id: string;
  label: string;
  characteristic: string;
  type: string;
  specs: string[];
  desc: string;
  source: { book: string; page: number };
}
export interface TalentData {
  /** Identifiant STABLE (slug du libellé d'origine) — cible des références structurées, robuste au
   *  renommage du `label`. Source unique pour `findTalentById`. */
  id: string;
  label: string;
  /** Maxi d'acquisitions (LDB 10 « Schéma des Talents ») : 1, « Bonus de X », « Aucun » ou null. */
  max: string | number | null;
  test: string | null;
  desc: string;
  /** Compétence ajoutée à « n'importe quelle Carrière que vous entamez » (LDB 10 : Maître
   *  artisan, Oreille absolue, Sorcier !, Voyageur aguerri, Artiste). */
  addSkill?: string | null;
  /** Caractéristique/attribut modifié à l'acquisition (LDB 10 : « +5 à votre Caractéristique de
   *  départ », Blessure, Chance, Détermination, Mouvement, Corruption). Libellé long. */
  addCharacteristic?: string | null;
  /** Talent conféré (LDB 10 : Flagellant → Frénésie). */
  addTalent?: string | null;
  specs?: string[];
  /** Borne haute de plage d100 sur le Tableau des Talents aléatoires (null = hors table). */
  rand?: number | null;
  source: { book: string; page: number };
}
export interface TrappingData {
  /** id STABLE (slug du libellé) — cible des `TrappingRef`, robuste au renommage. */
  id: string;
  label: string;
  prefix: string | null;
  type: string;
  /** `id` du Groupe d'objet (`WeaponGroupData.id`) : Groupe d'arme (Base/Escrime…), famille de munition
   *  (Arc/Poudre noire…), type d'armure (Plate/Mailles…) ou catégorie d'inventaire — réf d'entité, ≠ libellé. */
  subType: string | null;
  enc: number | null;
  availability: string | null;
  reach: string | null;
  loc: string | null;
  pa: number | null;
  damage: string | null;
  /** Qualités d'arme/armure (`QualityRef` : id + Indice éventuel « Solide 3 » → value, spec = arg éventuel). */
  qualities: QualityRef[];
  desc: string | null;
  price: { gold: number; silver: number; bronze: number };
  source: { book: string; page: number };
  /** Arme DÉRIVÉE conférée tant que l'objet est ÉQUIPÉ (prothèse-arme, LDB 73 : le Crochet « est
   *  considéré comme une Dague » en mêlée). Lue par recomputeLoadout : ajouter une prothèse-arme =
   *  remplir ce champ dans la donnée, plus de name-match `i.name === 'Crochet'`. */
  derivedWeapon?: Weapon;
}
/** Groupe d'objet (taxonomie `subType` id-ifiée) : Groupe d'ARME (Base, Escrime, Deux-mains, Armes
 *  d'hast…), famille de MUNITION (Arc, Arbalète, Poudre noire…), type d'ARMURE (Plate, Mailles, Cuir
 *  souple/bouilli) ou catégorie d'INVENTAIRE (Outils, Possessions diverses…). `id` = cible de
 *  `Trapping/Weapon/ItemInstance.subType` (réf, ≠ libellé) ; `kind` = métadonnée d'affichage. */
export interface WeaponGroupData {
  id: string;
  label: string;
  kind: 'weapon' | 'ammo' | 'armour' | 'inventory';
}
export type HarvestRarity = 'Commune' | 'Limitée' | 'Rare' | 'Exotique' | 'Unique';
export type HarvestDanger = 'Inoffensive' | 'Inquiétante' | 'Menaçante' | 'Mortelle';

export interface CreatureData {
  /** `id` STABLE (slug) — clé de résolution runtime/données (scènes, encounters, rig). « Plus de label » :
   *  les références pointent l'id (robuste au renommage/multilangue) ; le `label` ne sert qu'à l'affichage. */
  id: string;
  label: string;
  title: string | null;
  folder: string | null;
  char: Record<string, number | null>;
  /** Traits STRUCTURÉS (`TraitInstance`) — source app-owned migrée du parsing de chaînes (de-POC).
   *  Union transitoire : chaînes legacy tolérées et normalisées par `asTrait` à la consommation. */
  traits: import('../engine/statEntry').TraitList;
  /** Traits FACULTATIFS (`TraitInstance` structurés) — affichés au Codex, choisissables au spawn. */
  optionals: import('../engine/statEntry').TraitInstance[];
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
  source: { book: string; page: number };
  /** Apparence par défaut UNIFIÉE (plan P2) — UN seul bloc éditable porté par l'enregistrement :
   *  espèce, tenue, parts monstrueux, couleurs, coiffure, sexe/carrure, yeux. Le rig la lit comme
   *  couche de défaut (sous une éventuelle surcharge de scène). Même format que `EntityAppearance`
   *  (éditeur de scène) → une SEULE structure d'apparence dans toute l'app. */
  appearance?: EntityAppearance;
  /** Récolte « Précieuses Entrailles » (ZI) : rareté + dangerosité (→ coût par Enc des pièces,
   *  cf. engine/harvest) et usages supposés des organes. Porté par la créature (pas de table //). */
  harvest?: { rarity: HarvestRarity; danger: HarvestDanger; uses: string };
}
export interface EtatData {
  /** id STABLE (slug du libellé) — `ConditionId` ; cible de `ConditionInstance.name` et des ops condition. */
  id: string;
  label: string;
  desc: string;
  source: { book: string; page: number };
}
/** Tables Couleur des Yeux / Cheveux (LDB 05 l.698-744) : 2d10, libellé par refChar. */
export interface DetailColorData {
  label: string;
  /** Borne haute 2d10 (incluse). */
  rand: number;
  color: Record<string, string>;
}
/** Texte d'aide (LDB 05 « Détails ») : global + par colonne refChar (HTML léger des données). */
export interface DetailText {
  all: string;
  bySpecies: Record<string, string>;
}
/** Formules d'Âge/Taille (LDB 05 l.691-707) : « base + N d10 », par colonne refChar —
 *  + textes d'aide (conventions de noms, espérance de vie, tailles moyennes, Ambitions). */
export interface DetailsData {
  ageBase: Record<string, number>;
  ageRoll: Record<string, number>;
  heightBase: Record<string, number>;
  heightRoll: Record<string, number>;
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
  /** Caractéristique du jet de l'attaquant (CC mêlée / CT distance·zone) ; absent = AUCUN jet
   *  d'attaquant (Hurlement : chaque cible teste sa Résistance). */
  stat?: 'CC' | 'CT';
  /** Défense opposée : Esquive / Parade, Initiative (Regard), Résistance/auto sans opposition. */
  defense?: 'esquive' | 'parade' | 'init' | 'resist' | 'auto';
  /** Mode de ciblage (le résolveur en dérive la géométrie moteur). */
  targeting: 'melee' | 'ranged' | 'zone' | 'allFoes';
  /** Portée / Souffle (formules-chaînes résolues par le résolveur, ex. « Bonus d'Endurance + 20 mètres »). */
  range?: string;
  blast?: string;
  /** Attaque magique (Souffle, Étreinte glaciale) → soumise à la Résistance à la Magie, etc. */
  magic?: boolean;
  /** Effets AUTHORÉS (Dégâts `wounds` + États) appliqués quand la manœuvre touche (`onHit`) — MÊME
   *  vocabulaire que les sorts (Flow d'ops), exécutés par `applyTriggeredEffects`. */
  effects?: import('../state/flow').TriggeredEffect[];
  desc?: string;
  source?: { book: string; page: number };
  /** Pertinence de BASE pour le scoreur d'attaque (clic droit joueur ET décision IA) : POIDS ÉDITABLE,
   *  plus haut = choisie plus volontiers. Combinée aux bonus situationnels AUTO (dégâts attendus,
   *  multi-cible, état onHit applicable). Défaut 1 ; 0 = jamais auto-choisie (reste manuelle). */
  priority?: number;
}
/** Trait de créature (LDB 85) : libellé canonique + desc VERBATIM (affichée à l'inspecteur). */
export interface TraitData {
  /** Identifiant STABLE (slug du libellé) — clé d'instance/lookup, indépendant de la langue. */
  id: string;
  label: string;
  /** Squelette d'arguments du libellé (« (Indice) (Portée) »…), null si aucun. */
  prefix: string | null;
  desc: string;
  source: { book: string; page: number };
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
  effects?: import('../state/flow').TriggeredEffect[];
  /** Modificateurs PASSIFS continus (objet Laid : −10 aux Tests de Soc) en `GameOp[]` — MÊME vocab/éditeur
   *  (`GameOpEditor`) que les traits et les sorts ; lus par `qualitySocMod`/le collecteur passif. */
  passive?: import('../engine/ops').GameOp[];
}
/** Domaine de magie (Couleur, LDB 48) : ses ATTRIBUTS éditables au Codex — riders « à la touche »
 *  (`onHitEffects`, gatés par les Conditions Flow `relation`/`has`), mitigation de Projectile
 *  (`missile`), effet post-incantation (`afterCast`). Le `label` correspond au `subType` d'un Sort
 *  d'Arcane (`domainOf`). */
export interface DomainData {
  id: string;
  label: string;
  desc?: string;
  source?: { book: string; page: number };
  /** Effets DÉCLENCHÉS « à la touche » sur une cible d'un Sort du Domaine (Feu → En flammes…) — MÊMES
   *  `TriggeredEffect` éditables que Traits/Atouts, gatés par les Conditions Flow `relation`/`has`. */
  effects?: import('../state/flow').TriggeredEffect[];
  /** Mitigation des Projectiles : ignore les PA d'une matière (`metal`/`nonMagic`) ; `bonusFromBypass`
   *  les ajoute aussi aux Dégâts (Métal). */
  missile?: { bypass: 'metal' | 'nonMagic'; bonusFromBypass?: boolean };
  /** Effet appliqué au LANCEUR après une incantation réussie (Bête : `grantTrait` pendant 1d`durationDice` Rounds). */
  afterCast?: { grantTrait?: string; durationDice?: number };
  /** Élément du Souffle conféré par le Talent Magie des Arcanes du Domaine (Cieux → Électricité,
   *  Métal → Corrosif, Ombres → Fumée, Feu → Feu) — lu par le résolveur de Souffle. */
  breathType?: string;
  /** Bonus d'incantation CONDITIONNEL (Aqshy l.157) : +`bonus` par État `perCondition` porté par un
   *  combattant situé à `radiusStat` (Bonus de carac.) mètres du lanceur (géométrie résolue par state). */
  castBonus?: { perCondition: string; radiusStat: import('../engine/types').CharKey; bonus: number };
}
export interface SpellData {
  /** id STABLE (slug du libellé) — cible des `Ref` de sort (sorts de créature, bénédictions/miracles). */
  id: string;
  label: string;
  type: string;
  subType: string | null;
  /** Niveau d'Incantation (NI). `null` pour les Prières (Béni/Invocation). */
  cn: number | null;
  range: string;
  target: number | string;
  duration: string;
  desc: string;
  /**
   * EFFETS du sort — `Flow` ÉDITABLE (système logique unique : `do`/`if`/`test`), source des effets
   * mécaniques appliqués à l'incantation (feuilles EffectOp `{type:'ops', on:'target'|'caster', ops}`).
   * Édité dans le Compendium (CodexEdit → FlowEditor), exécuté par `runSpellFlow`. SOURCE UNIQUE des
   * effets — les MÉTADONNÉES de résolution (durée/ZdE/opposition/invocation/métamorphose) restent dans
   * la spec engine curée (`spellSpecFor`). Import TYPE seul (effacé à la compilation) → la couche data
   * NE dépend PAS d'une valeur de `state` (pureté préservée). Absent = aucun effet mécanique (narratif).
   */
  effects?: import('../state/flow').Flow;
  source: { book: string; page: number };
}

/** Signe astral (ADE2) : table d100 (`rand` = borne haute cumulée), flavor + effet de création. */
export interface StarData {
  label: string;
  rand: number;
  signe: string | null;
  classique: string | null;
  ascendant: string | null;
  dates: string | null;
  dieux: string | null;
  apparence: string | null;
  /** Effet ADE2 appliqué AUX ATTRIBUTS DE DÉPART (ch.03 l.38) — donnée éditable au Codex
   *  (`GameOpEditor`) : `charMod` (±carac) et/ou `grantTalent` (talent octroyé). Appliqué une
   *  fois à la création (cf. `applyStarEffect`), pas collecté en passif continu. */
  effect?: import('../engine/ops').GameOp[];
  /** L'Étoile du Sorcier (ADE2 l.62) : fourchette du 1d10 interne `[min, max]` parmi les variantes
   *  partageant `rand:100`. Absent = pas de sous-tirage (signe simple). */
  sub?: [number, number];
  desc: string | null;
  source: { book: string; page: number };
}
/** Lieu (Glorieux Reikland, LDB) : hiérarchie par `parent` (label d'un autre lieu). */
export interface LocationData {
  label: string;
  parent: string | null;
  prefix: string | null;
  suffix: string | null;
  desc: string | null;
  source: { book: string; page: number };
}
/** Ouvrage WFRP4 référencé (bibliographie). `desc` = HTML de présentation. */
export interface BookData {
  label: string;
  abr: string | null;
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
}

export const characteristics = characteristicsJson as any[];
export const species = speciesJson as SpeciesData[];
export const classes = classesJson as ClassData[];
export const careers = careersJson as CareerData[];
export const careerLevels = careerLevelsJson as CareerLevelData[];
export const skills = skillsJson as SkillData[];
export const talents = talentsJson as TalentData[];
export const etats = etatsJson as EtatData[];
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
  return DISEASE_BY_ID.get(id)?.name ?? id;
}
const DISEASE_ID_BY_LABEL = new Map(maladies.map((m) => [m.name.toLowerCase(), m.id]));
/** Résout un `id` de Maladie depuis un LIBELLÉ (authoring/parsing) — insensible à la casse. */
export function diseaseIdByLabel(label: string): string | undefined {
  return DISEASE_ID_BY_LABEL.get(label.toLowerCase());
}
// Traits app-owned + traits curés hors-extraction mergés ici : homebrew frenchy.bzh (Aura de Dhar/
// Mort, Charnier) + traits de suppléments autorisés référencés par le bestiaire mais absents
// d'all-data.json (Redoutable, ZI).
export const traits = [...(traitsJson as TraitData[]), ...(frenchyTraitsJson as TraitData[])];
/** Index des Traits par libellé canonique — lecture des `effects` au runtime (state/triggeredEffects). */
export const traitByLabel: Map<string, TraitData> = new Map(traits.map((t) => [t.label, t]));
/** Index des Traits par `id` STABLE (slug) — lookup runtime indépendant de la langue. */
export const traitById: Map<string, TraitData> = new Map(traits.map((t) => [t.id, t]));
export const findTraitById = (id: string): TraitData | undefined => traitById.get(id);
export const qualities = qualitiesJson as QualityData[];
/** Index des Atouts/Défauts par libellé — lecture des `effects` déclenchés au runtime (triggeredEffects). */
export const qualityByLabel: Map<string, QualityData> = new Map(qualities.map((q) => [q.label, q]));
/** Mutations (entités) + Tables de Corruption (plages d100 → réf), DÉCOUPLÉES (cf. data/mutations.ts) —
 *  app-owned éditables au Codex. Le runtime du tirage (`rollMutation`) vit dans `mutations.ts`. */
export const mutations = mutationsJson as MutationData[];
export const mutationTables = mutationTablesJson as MutationTable[];
export const trappings = trappingsJson as TrappingData[];
/** Groupes d'objet app-owned (taxonomie `subType` id-ifiée) — éditable au Codex. */
export const weaponGroups = weaponGroupsJson as WeaponGroupData[];
// Bestiaire APP-OWNED : officiel + complément « frenchy.bzh » INTÉGRÉ directement dans creatures.json
// (fusionné 2026-06-15, espèce explicite posée) — plus de dataset frenchy séparé à merger.
export const creatures = creaturesJson as CreatureData[];
// Sorts app-owned + sorts homebrew « frenchy.bzh » des casters (Magie Mineure/Arcanes, Bénédictions,
// Miracles…) mergés ici ; le nom listé par une créature résout.
export const spells = [...(spellsJson as SpellData[]), ...(frenchySpellsJson as SpellData[])];
/** Manœuvres app-owned (attaques naturelles activées — LDB 85) : ENTITÉ de 1ʳᵉ classe éditable au Codex,
 *  effets en GameOp. Octroyées aux créatures via `TraitData.grantsManeuvers` ; résolues par id. */
export const maneuvers = maneuversJson as ManeuverDef[];
/** Domaines de magie app-owned (LDB 48) — ENTITÉ éditable au Codex (attributs en données : onHit,
 *  projectile, post-incantation). Résolus par LIBELLÉ (= `subType` du Sort, cf. `domainOf`). */
export const domains = domainsJson as DomainData[];
export const domainByLabel: Map<string, DomainData> = new Map(domains.map((d) => [d.label, d]));
export const findDomain = (label: string | null | undefined): DomainData | undefined => (label ? domainByLabel.get(label) : undefined);
export const eyes = eyesJson as DetailColorData[];
export const hairs = hairsJson as DetailColorData[];
export const details = detailsJson as DetailsData;
export const stars = starsJson as StarData[];
/** Apparences d'espèce de rig (app-owned, éditable) — SOURCE lue+résolue par `raceById` (rig). */
export const raceAppearance = raceAppearanceJson as RaceAppearanceData[];
export const locations = locationsJson as LocationData[];
export const books = booksJson as BookData[];
/** Culte/Dieu (LDB 41) : `key` = clé STABLE (« Sigmar »), Bénédictions/Miracles en `Ref[]` (sorts par id),
 *  desc = lore HTML (Codex). Dataset éditable (Compendium) — remplace les `cults/defs/*.ts` (codegen retiré). */
export interface GodData {
  key: string;
  title?: string;
  blessings: Ref[];
  miracles: Ref[];
  desc?: string;
  source?: { book: string; page: number };
}
export const gods = godsJson as GodData[];
export const names = namesJson as Record<string, NamePool>;

const ETAT_BY_ID = new Map(etats.map((e) => [e.id, e]));
/** Résout un État par son `id` STABLE (`ConditionId`). */
export function findConditionById(id: string): EtatData | undefined {
  return ETAT_BY_ID.get(id);
}
/** Libellé d'affichage d'un État par son id (repli sur l'id). SOURCE UNIQUE du nom d'État affiché. */
export function conditionLabel(id: string): string {
  return ETAT_BY_ID.get(id)?.label ?? id;
}
const ETAT_ID_BY_LABEL = new Map(etats.map((e) => [e.label.toLowerCase(), e.id]));
/** Résout un `id` d'État depuis un LIBELLÉ (authoring : parsing de desc/texte) — insensible à la casse. */
export function conditionIdByLabel(label: string): string | undefined {
  return ETAT_ID_BY_LABEL.get(label.toLowerCase());
}
const SPECIES_BY_ID = new Map(species.map((s) => [s.id, s]));
/** Résout une Espèce par son `id` STABLE (slug du libellé) — réf runtime/données (Combatant.species,
 *  pregens, draft). Le libellé ne sert qu'à l'affichage (`speciesSingular`). */
export function findSpeciesById(id: string | undefined): SpeciesData | undefined {
  return id ? SPECIES_BY_ID.get(id) : undefined;
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
export function careersForSpecies(refCareer: string, ignoreRestrictions = false): CareerData[] {
  if (ignoreRestrictions) return careers;
  return careers.filter((c) => c.rand?.[refCareer] != null);
}
const CAREER_BY_ID = new Map(careers.map((c) => [c.id, c]));
/** Résout une Carrière par son `id` STABLE. Le libellé ne sert qu'à l'affichage. */
export function findCareerById(id: string | undefined): CareerData | undefined {
  return id ? CAREER_BY_ID.get(id) : undefined;
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
const CREATURE_BY_ID = new Map(creatures.map((c) => [c.id, c]));
/** Résout une créature par son `id` STABLE — référence runtime/données (scènes, encounters, rig). */
export function findCreatureById(id: string | undefined): CreatureData | undefined {
  return id ? CREATURE_BY_ID.get(id) : undefined;
}
/** Libellé d'affichage d'une créature par son id (repli sur l'id si introuvable). */
export function creatureLabel(id: string): string {
  return CREATURE_BY_ID.get(id)?.label ?? id;
}
/** Lookup par LIBELLÉ — réservé à l'AUTHORING/affichage (picker éditeur, Codex) ; le runtime résout par id. */
export function findCreature(label: string): CreatureData | undefined {
  return creatures.find((c) => c.label === label);
}
export function findSpell(label: string): SpellData | undefined {
  return spells.find((s) => s.label === label);
}
export function findStar(label: string): StarData | undefined {
  return stars.find((s) => s.label === label);
}
export function findLocation(label: string): LocationData | undefined {
  return locations.find((l) => l.label === label);
}
export function findBook(label: string): BookData | undefined {
  return books.find((b) => b.label === label || b.abr === label);
}

const TRAPPING_BY_ID = new Map(trappings.map((t) => [t.id, t]));
/** Résout une Possession par son `id` STABLE (référence structurée — ≠ `findTrapping` par libellé, authoring). */
export function findTrappingById(id: string): TrappingData | undefined {
  return TRAPPING_BY_ID.get(id);
}
const QUALITY_BY_ID = new Map(qualities.map((q) => [q.id, q]));
/** Résout une Qualité par son `id` STABLE. */
export function findQualityById(id: string): QualityData | undefined {
  return QUALITY_BY_ID.get(id);
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
const GOD_BY_KEY = new Map(gods.map((g) => [g.key, g]));
/** Résout un Culte/Dieu par sa clé STABLE (« Sigmar »). */
export function findGodById(key: string): GodData | undefined {
  return GOD_BY_KEY.get(key);
}
/** Clés de culte disponibles, triées (choix de divinité à la création, joker « Béni (Au choix) »). */
export const CULT_KEYS: string[] = gods.map((g) => g.key).sort();
/** Les six Bénédictions d'un culte, IDS de sort (le runtime/grimoire compare par id ; l'UI résout en
 *  libellé). Culte inconnu → []. */
export function blessingsOf(cult: string): string[] {
  return (findGodById(cult)?.blessings ?? []).map((r) => r.id);
}
/** Les Miracles d'un culte, IDS de sort. Culte inconnu → []. */
export function miraclesOf(cult: string): string[] {
  return (findGodById(cult)?.miracles ?? []).map((r) => r.id);
}

/** Référence à une Qualité d'objet (`Ref` + Indice éventuel : « Solide 3 » → value 3). */
export interface QualityRef extends Ref {
  value?: number;
}
/** Quantité d'une possession conférée : nombre fixe (« (3) ») ou jet (« (1d10) »). */
export type CountSpec = { fixed: number } | { roll: string };
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
    case 'qualities': return findQualityById(id);
    case 'spells': return findSpellById(id);
    case 'maneuvers': return findManeuverById(id);
    case 'careers': return findCareerById(id);
    case 'classes': return findClassById(id);
    case 'races': return findSpeciesById(id);
    case 'etats': return findConditionById(id);
    case 'maladies': return findDiseaseById(id) ? { label: findDiseaseById(id)!.name } : undefined;
    default: return undefined;
  }
}
/** Libellé CONCRET d'une `Ref` : « Magie des Arcanes (Ghur) » — base (repli sur l'id) + spec. SOURCE
 *  UNIQUE du nom affiché ET de la clé runtime (combatFeatures/grimoire). */
export function refLabel(category: string, ref: Ref): string {
  const base = findById(category, ref.id)?.label ?? ref.id;
  return ref.spec ? `${base} (${ref.spec})` : base;
}
/** Forme RUNTIME d'une qualité (Weapon/ItemInstance.qualities) : id STABLE, + Indice « id 3 ».
 *  Le moteur (`parseQuality`) la relit par id ; l'affichage la repasse en libellé. PAS le libellé. */
export function qualityRuntime(q: QualityRef): string {
  return q.value != null ? `${q.id} ${q.value}` : q.id;
}
/** Libellé d'affichage d'une `QualityRef` : « Solide 3 », « Tranchante » (id → libellé + Indice). */
export function qualityRefLabel(q: QualityRef): string {
  return q.value != null ? `${refLabel('qualities', q)} ${q.value}` : refLabel('qualities', q);
}
/** Libellé d'affichage d'une `SkillInstance` (id+spec → « Langue (Magick) »). Repli sur l'id. */
export function skillInstanceLabel(s: { skillId: string; spec?: string }): string {
  return refLabel('skills', { id: s.skillId, spec: s.spec });
}
/** Libellé CONCRET d'une `TalentInstance` (id+spec → « Magie des Arcanes (Ghur) ») — clé du registre
 *  combatFeatures + affichage. Repli sur l'id. */
export function talentConcrete(t: { talentId: string; spec?: string }): string {
  return refLabel('talents', { id: t.talentId, spec: t.spec });
}
/** Libellé d'affichage/clé concrète d'un `AdvancementRef` : « Savoir (Au choix) », « A ou B »,
 *  « 3 Talent aléatoire », « Magie des Arcanes (Ghur) ». SOURCE UNIQUE (Codex + résolution création). */
export function advancementLabel(category: string, a: AdvancementRef): string {
  if ('ref' in a) return refLabel(category, a.ref);
  if ('wildcard' in a) return a.specOptions?.length
    ? `${refLabel(category, a.wildcard)} (${a.specOptions.join(' ou ')})`
    : `${refLabel(category, a.wildcard)} (Au choix)`;
  if ('choice' in a) return a.choice.map((x) => advancementLabel(category, x)).join(' ou ');
  return a.random === 1 ? 'Talent aléatoire' : `${a.random} Talent aléatoire`;
}
/** Libellé d'affichage d'une `TrappingRef` : « Marteau », « Pamphlétaire (3) », « Chiffon (1d10) », ou
 *  texte narratif hors catalogue. SOURCE UNIQUE (Codex, créateur, marchand, inventaire). */
export function trappingRefLabel(ref: TrappingRef): string {
  const base = 'text' in ref ? ref.text : (findTrappingById(ref.id)?.label ?? ref.id);
  const count = ref.count ? ('fixed' in ref.count ? ` (${ref.count.fixed})` : ` (${ref.count.roll})`) : '';
  return base + count;
}

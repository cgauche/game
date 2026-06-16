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
import traitsJson from './traits.json';
import qualitiesJson from './qualities.json';
import trappingsJson from './trappings.json';
import creaturesJson from './creatures.json';
import frenchyTraitsJson from './frenchy-traits.json';
import frenchySpellsJson from './frenchy-spells.json';
import spellsJson from './spells.json';
import eyesJson from './eyes.json';
import hairsJson from './hairs.json';
import detailsJson from './details.json';
import starsJson from './stars.json';
import locationsJson from './locations.json';
import booksJson from './books.json';
import namesJson from './names.json';
import raceAppearanceJson from './raceAppearance.json';
import { CharKey, Weapon } from '../engine/types';

export interface SpeciesData {
  label: string;
  refChar: string;
  refCareer: string;
  rand: number;
  desc: string;
  movement: number;
  fate: { fate: number; resilience: number; extra: number };
  small: boolean;
  baseChar: Partial<Record<CharKey, number>>;
  /** Compétences d'espèce (Livre de base) : 3 reçoivent +5, 3 reçoivent +3. */
  skills: string[];
  /** Talents d'espèce : « A ou B » (choix), fixes, « N Talent aléatoire » (table d100). */
  talents: string[];
  source: { book: string; page: number };
}
export interface ClassData {
  label: string;
  trappings: string[];
  desc: string;
  source: { book: string; page: number };
}
export interface CareerData {
  label: string;
  class: string;
  /** Tableau des Classes et Carrières aléatoires (LDB 05 l.197+) : borne haute d100 par colonne
   *  d'espèce (`SpeciesData.refCareer`). null = carrière INDISPONIBLE pour cette espèce (l.360). */
  rand: Record<string, number | null>;
  desc: string;
  source: { book: string; page: number };
}
export interface CareerLevelData {
  label: string;
  career: string;
  level: number;
  skills: string[];
  talents: string[];
  trappings: string[];
  characteristics: string[];
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
  label: string;
  prefix: string | null;
  type: string;
  subType: string | null;
  enc: number | null;
  availability: string | null;
  reach: string | null;
  loc: string | null;
  pa: number | null;
  damage: string | null;
  qualities: string[];
  desc: string | null;
  price: { gold: number; silver: number; bronze: number };
  source: { book: string; page: number };
  /** Arme DÉRIVÉE conférée tant que l'objet est ÉQUIPÉ (prothèse-arme, LDB 73 : le Crochet « est
   *  considéré comme une Dague » en mêlée). Lue par recomputeLoadout : ajouter une prothèse-arme =
   *  remplir ce champ dans la donnée, plus de name-match `i.name === 'Crochet'`. */
  derivedWeapon?: Weapon;
}
export type HarvestRarity = 'Commune' | 'Limitée' | 'Rare' | 'Exotique' | 'Unique';
export type HarvestDanger = 'Inoffensive' | 'Inquiétante' | 'Menaçante' | 'Mortelle';

export interface CreatureData {
  label: string;
  title: string | null;
  folder: string | null;
  char: Record<string, number | null>;
  /** Traits STRUCTURÉS (`TraitInstance`) — source app-owned migrée du parsing de chaînes (de-POC).
   *  Union transitoire : chaînes legacy tolérées et normalisées par `asTrait` à la consommation. */
  traits: import('../engine/statEntry').TraitList;
  optionals: string[];
  /** Compétences STRUCTURÉES (`SkillRef` par id stable + valeur de Test imprimée) — fin du parsing
   *  de chaînes « Calme 58 ». Le bestiaire stocke des refs ; `skillRefLabel` reformate à l'affichage. */
  skills: SkillRef[];
  /** Talents STRUCTURÉS (`TalentRef` par id stable + niveau/spécialisation) — fin du parsing de chaînes
   *  « Maîtrise du combat 2 », « Magie des Arcanes (Ghur) ». `talentRefLabel` reformate à l'affichage ;
   *  au spawn, `talentsFromBook` reconstruit le libellé canonique AVEC sa spec (clé du registre). */
  talents: TalentRef[];
  trappings: string[];
  spells: string[];
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
/** Profil d'une MANŒUVRE de combat (attaque naturelle activée — LDB 85) : ce qui pilotait la table en
 *  dur `engine/creatureAttacks.RULES`, désormais en DONNÉE éditable. `activation` (déclenchement) +
 *  `advantageCost` (coût d'Avantage de l'attaque gratuite) + `kind` (routage IA/poses/galerie) ;
 *  `aoe`/`magic`/`perTentacle` qualifient la résolution moteur. Les Dégâts (Indice) restent lus de
 *  l'INSTANCE du trait (« Morsure +10 »). */
export interface ManeuverProfile {
  kind: import('../engine/creatureAttacks').AttackKind;
  activation: 'action' | 'free' | 'charge';
  advantageCost: number;
  aoe?: boolean;
  magic?: boolean;
  perTentacle?: boolean;
}
/** Trait de créature (LDB 85) : libellé canonique + desc VERBATIM (affichée à l'inspecteur). */
export interface TraitData {
  label: string;
  /** Squelette d'arguments du libellé (« (Indice) (Portée) »…), null si aucun. */
  prefix: string | null;
  desc: string;
  source: { book: string; page: number };
  /** Effets MÉCANIQUES authorés (déclencheur → ops du Flow) — Traits « effet sur événement » (Toile,
   *  Sang corrosif, Régénération…) appliqués par `state/triggeredEffects`, plus de handler en dur.
   *  Type-only (le moteur reste pur : la donnée référence le Flow sans en dépendre à l'exécution). */
  effects?: import('../state/flow').TriggeredEffect[];
  /** Profil de MANŒUVRE si ce trait est une attaque naturelle activée (Morsure, Attaque caudale,
   *  Souffle…) — lu par `engine/creatureAttacks` (remplace la table `RULES`). */
  maneuver?: ManeuverProfile;
}
/** Atout/Défaut d'arme (LDB 62-63) : libellé + desc VERBATIM + effets déclenchés authorés (mêmes
 *  `TriggeredEffect` que les Traits — un Atout « à la touche : 1d10 + Empêtré » s'édite au Codex). */
export interface QualityData {
  label: string;
  type: string;
  subType: string | null;
  desc: string;
  effects?: import('../state/flow').TriggeredEffect[];
}
export interface SpellData {
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

/** Signe astral (ADE2) : table d100 (`rand` = borne haute cumulée), flavor + faits. */
export interface StarData {
  label: string;
  rand: number;
  signe: string | null;
  classique: string | null;
  ascendant: string | null;
  dates: string | null;
  dieux: string | null;
  apparence: string | null;
  characteristics: string | null;
  talent: string | null;
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
// Traits officiels (build:data) + traits curés hors-extraction (mergés ici pour survivre à build:data
// qui ne réécrit que traits.json) : homebrew frenchy.bzh (Aura de Dhar/Mort, Charnier) + traits de
// suppléments autorisés référencés par le bestiaire mais absents d'all-data.json (Redoutable, ZI).
export const traits = [...(traitsJson as TraitData[]), ...(frenchyTraitsJson as TraitData[])];
/** Index des Traits par libellé canonique — lecture des `effects` au runtime (state/triggeredEffects). */
export const traitByLabel: Map<string, TraitData> = new Map(traits.map((t) => [t.label, t]));
export const qualities = qualitiesJson as QualityData[];
/** Index des Atouts/Défauts par libellé — lecture des `effects` déclenchés au runtime (triggeredEffects). */
export const qualityByLabel: Map<string, QualityData> = new Map(qualities.map((q) => [q.label, q]));
export const trappings = trappingsJson as TrappingData[];
// Bestiaire APP-OWNED : officiel + complément « frenchy.bzh » INTÉGRÉ directement dans creatures.json
// (fusionné 2026-06-15, espèce explicite posée) — plus de dataset frenchy séparé à merger.
export const creatures = creaturesJson as CreatureData[];
// Sorts officiels (build:data) + sorts homebrew « frenchy.bzh » des casters (Magie Mineure/Arcanes,
// Bénédictions, Miracles…) — mergés ici pour survivre à build:data ; le nom listé par une créature résout.
export const spells = [...(spellsJson as SpellData[]), ...(frenchySpellsJson as SpellData[])];
export const eyes = eyesJson as DetailColorData[];
export const hairs = hairsJson as DetailColorData[];
export const details = detailsJson as DetailsData;
export const stars = starsJson as StarData[];
/** Apparences d'espèce de rig (app-owned, éditable) — SOURCE lue+résolue par `raceById` (rig). */
export const raceAppearance = raceAppearanceJson as RaceAppearanceData[];
export const locations = locationsJson as LocationData[];
export const books = booksJson as BookData[];
export const names = namesJson as Record<string, NamePool>;

export function findSpecies(label: string) {
  return species.find((s) => s.label === label);
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
export function findCareer(label: string): CareerData | undefined {
  return careers.find((c) => c.label === label);
}
export function levelsForCareer(career: string): CareerLevelData[] {
  return careerLevels.filter((c) => c.career === career).sort((a, b) => a.level - b.level);
}
export function firstLevel(career: string): CareerLevelData | undefined {
  return levelsForCareer(career)[0];
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
/** Référence STRUCTURÉE à une Compétence (par `id` stable) + sa valeur de Test IMPRIMÉE et une
 *  spécialisation éventuelle — remplace les chaînes parsées « Calme 58 » dans la donnée du bestiaire. */
export interface SkillRef {
  skillId: string;
  value: number;
  spec?: string;
}
/** Libellé d'affichage d'une `SkillRef` : « Langue (Magick) 63 » — repli sur l'id si la Compétence
 *  a disparu du catalogue. Source UNIQUE du formatage (statbloc éditeur, Codex, chips). */
export function skillRefLabel(ref: SkillRef): string {
  const n = findSkillById(ref.skillId)?.label ?? ref.skillId;
  return n + (ref.spec ? ` (${ref.spec})` : '') + ` ${ref.value}`;
}
export function findTalent(label: string): TalentData | undefined {
  return talents.find((t) => t.label === label);
}
const TALENT_BY_ID = new Map(talents.map((t) => [t.id, t]));
/** Résout un Talent par son `id` STABLE (référence structurée — fin du lookup par libellé parsé). */
export function findTalentById(id: string): TalentData | undefined {
  return TALENT_BY_ID.get(id);
}
/** Référence STRUCTURÉE à un Talent (par `id` stable) + son niveau (`times`, ≥2) et une spécialisation
 *  éventuelle — remplace les chaînes parsées « Maîtrise du combat 2 », « Magie des Arcanes (Ghur) »
 *  dans la donnée du bestiaire. */
export interface TalentRef {
  talentId: string;
  times?: number;
  spec?: string;
}
/** Libellé d'affichage d'une `TalentRef` : « Magie des Arcanes (Ghur) », « Maîtrise du combat 2 » —
 *  repli sur l'id si le Talent a disparu du catalogue. Source UNIQUE du formatage (statbloc éditeur,
 *  Codex, chips). La spec entre parenthèses RESTE dans le libellé (clé du registre combatFeatures). */
export function talentRefLabel(ref: TalentRef): string {
  const n = findTalentById(ref.talentId)?.label ?? ref.talentId;
  return n + (ref.spec ? ` (${ref.spec})` : '') + (ref.times && ref.times > 1 ? ` ${ref.times}` : '');
}
export function findTrapping(label: string): TrappingData | undefined {
  return trappings.find((t) => t.label.toLowerCase() === label.toLowerCase());
}
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

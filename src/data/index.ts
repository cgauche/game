/**
 * Accès typé à NOTRE base de jeu — désormais APP-OWNED et ÉDITABLE (éditeur de données DEV in-app,
 * écran 'dataEditor'). Les *.json de ce dossier sont la SOURCE CANONIQUE ; `scripts/build-data.ts`
 * n'est plus qu'un IMPORTEUR ponctuel (re-seed depuis Source/all-data.json à la demande).
 */
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
import spellsJson from './spells.json';
import eyesJson from './eyes.json';
import hairsJson from './hairs.json';
import detailsJson from './details.json';
import starsJson from './stars.json';
import locationsJson from './locations.json';
import booksJson from './books.json';
import namesJson from './names.json';
import { CharKey } from '../engine/types';

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
  label: string;
  characteristic: string;
  type: string;
  specs: string[];
  desc: string;
  source: { book: string; page: number };
}
export interface TalentData {
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
}
export interface CreatureData {
  label: string;
  title: string | null;
  folder: string | null;
  char: Record<string, number | null>;
  traits: string[];
  optionals: string[];
  skills: string[];
  talents: string[];
  trappings: string[];
  spells: string[];
  desc: string | null;
  source: { book: string; page: number };
  /** Espèce d'apparence EXPLICITE (clé `CreatureDef`, bipèdes) — remplace le match-par-nom POC du rig
   *  (plan P1). Figée depuis la résolution actuelle ; le rig la lit, repli sur le nom si absente. */
  species?: string;
  /** Tenue d'apparence EXPLICITE (bipèdes) — remplace le match-par-nom POC `ROLE_CAREERS`
   *  (plan P1). Figée depuis la résolution actuelle ; le rig la lit (source unique de la tenue). */
  tenue?: string;
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
/** Trait de créature (LDB 85) : libellé canonique + desc VERBATIM (affichée à l'inspecteur). */
export interface TraitData {
  label: string;
  /** Squelette d'arguments du libellé (« (Indice) (Portée) »…), null si aucun. */
  prefix: string | null;
  desc: string;
  source: { book: string; page: number };
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
export const traits = traitsJson as TraitData[];
export const qualities = qualitiesJson as any[];
export const trappings = trappingsJson as TrappingData[];
export const creatures = creaturesJson as CreatureData[];
export const spells = spellsJson as SpellData[];
export const eyes = eyesJson as DetailColorData[];
export const hairs = hairsJson as DetailColorData[];
export const details = detailsJson as DetailsData;
export const stars = starsJson as StarData[];
export const locations = locationsJson as LocationData[];
export const books = booksJson as BookData[];
export const names = namesJson as Record<string, NamePool>;

export function findSpecies(label: string) {
  return species.find((s) => s.label === label);
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
export function findTalent(label: string): TalentData | undefined {
  return talents.find((t) => t.label === label);
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

/**
 * Accès typé à NOTRE base de jeu (générée par `npm run build:data`).
 * Ne jamais éditer les *.json à la main : ils sont régénérés depuis les sources.
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
  max: string | null;
  test: string | null;
  desc: string;
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
}
export interface EtatData {
  label: string;
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

export const characteristics = characteristicsJson as any[];
export const species = speciesJson as SpeciesData[];
export const classes = classesJson as ClassData[];
export const careers = careersJson as CareerData[];
export const careerLevels = careerLevelsJson as CareerLevelData[];
export const skills = skillsJson as SkillData[];
export const talents = talentsJson as TalentData[];
export const etats = etatsJson as EtatData[];
export const traits = traitsJson as any[];
export const qualities = qualitiesJson as any[];
export const trappings = trappingsJson as TrappingData[];
export const creatures = creaturesJson as CreatureData[];
export const spells = spellsJson as SpellData[];

export function findSpecies(label: string) {
  return species.find((s) => s.label === label);
}
export function careersForSpecies(refCareer: string): CareerData[] {
  // Toutes les carrières du Livre de base sont accessibles ; le tirage aléatoire
  // d'espèce (refCareer) sert aux tables, mais on autorise le choix libre.
  return careers;
}
export function levelsForCareer(career: string): CareerLevelData[] {
  return careerLevels.filter((c) => c.career === career).sort((a, b) => a.level - b.level);
}
export function firstLevel(career: string): CareerLevelData | undefined {
  return levelsForCareer(career)[0];
}
export function findSkill(label: string): SkillData | undefined {
  return skills.find((s) => s.label === label);
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

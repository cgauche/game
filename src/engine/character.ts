/**
 * Création de personnage (héros) — Livre de base, chapitre Personnage.
 *
 * Étapes implémentées :
 *  3) Attributs : Caractéristique = base d'espèce + 2d10 (ou saisie manuelle).
 *  4) Compétences/Talents de carrière : 8 compétences, 40 augmentations
 *     réparties (par défaut +5 chacune), 1 talent au choix.
 *  5) Possessions : équipement de classe + de carrière.
 *  Blessures, Mouvement, Destin/Résilience selon le Tableau des Attributs.
 *
 * Les compétences/talents *raciaux* (listés en prose, hors all-data.json) ne
 * sont pas appliqués automatiquement afin de ne rien inventer hors sources.
 */
import { RNG, defaultRNG, roll } from './dice';
import { maxWounds } from './characteristics';
import { CharKey, CHAR_KEYS, Characteristics, ArmourPoints, Combatant, Weapon, SkillInstance, TalentInstance, HitLocation } from './types';
import {
  SpeciesData,
  findSpecies,
  firstLevel,
  findSkill,
  findTrapping,
  classes,
  careers,
} from '../data';

const SKILL_CHAR: Record<string, CharKey> = {
  'Capacité de Combat': 'CC',
  'Capacité de Tir': 'CT',
  Force: 'F',
  Endurance: 'E',
  Initiative: 'I',
  Agilité: 'Ag',
  Dextérité: 'Dex',
  Intelligence: 'Int',
  'Force Mentale': 'FM',
  Sociabilité: 'Soc',
};

/** Sépare « Corps à corps (Base) » → { name:'Corps à corps', spec:'Base' }. */
export function parseSkillRef(s: string): { name: string; spec?: string } {
  const m = s.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  if (m) return { name: m[1].trim(), spec: m[2].trim() };
  return { name: s.trim() };
}

function skillCharacteristic(name: string): CharKey {
  const data = findSkill(name);
  if (data && SKILL_CHAR[data.characteristic]) return SKILL_CHAR[data.characteristic];
  return 'Dex'; // repli prudent
}

export interface CreateHeroOptions {
  speciesLabel: string;
  careerLabel: string;
  name: string;
  /** Caractéristiques saisies manuellement (sinon tirage base + 2d10). */
  manualChars?: Partial<Characteristics>;
  /** Talent de carrière choisi (sinon le premier proposé). */
  careerTalent?: string;
  /** Répartition des 40 augmentations (sinon +5 par compétence). */
  skillAdvances?: Record<string, number>;
  /** Répartition des points supplémentaires Destin/Résilience. */
  fateSplit?: { fate: number; resilience: number };
  motivation?: string;
  rng?: RNG;
  id?: string;
}

let heroCounter = 0;

export function rollCharacteristics(sp: SpeciesData, rng: RNG = defaultRNG): Characteristics {
  const chars = {} as Characteristics;
  for (const k of CHAR_KEYS) {
    const base = sp.baseChar[k] ?? 20;
    chars[k] = base + roll(2, 10, rng);
  }
  return chars;
}

export function createHero(opts: CreateHeroOptions): Combatant {
  const rng = opts.rng ?? defaultRNG;
  const sp = findSpecies(opts.speciesLabel);
  if (!sp) throw new Error(`Espèce inconnue : ${opts.speciesLabel}`);
  const level = firstLevel(opts.careerLabel);

  // 3) Attributs
  const chars = rollCharacteristics(sp, rng);
  if (opts.manualChars) for (const k of CHAR_KEYS) if (opts.manualChars[k] != null) chars[k] = opts.manualChars[k]!;

  // 4) Compétences de carrière : 40 augmentations, +5 par défaut sur 8.
  const skills: SkillInstance[] = (level?.skills ?? []).map((raw) => {
    const { name, spec } = parseSkillRef(raw);
    const adv = opts.skillAdvances?.[raw] ?? 5;
    return { name, spec, characteristic: skillCharacteristic(name), advances: adv };
  });

  // Talents : un seul au choix à la création.
  const talentChoices = level?.talents ?? [];
  const chosenTalent = opts.careerTalent ?? talentChoices[0];
  const talents: TalentInstance[] = chosenTalent ? [{ name: chosenTalent, times: 1 }] : [];

  // 5) Possessions : classe + carrière.
  const classTrappings = classForCareer(opts.careerLabel)?.trappings ?? [];
  const trappingNames = [...classTrappings, ...(level?.trappings ?? [])];

  const weapons = deriveWeapons(trappingNames, chars);
  const armour = deriveArmour(trappingNames);

  const small = sp.small;
  const wmax = maxWounds(chars, small);

  // Destin / Résilience
  const fateBase = sp.fate;
  const split = opts.fateSplit ?? autoFateSplit(fateBase.extra);
  const fate = fateBase.fate + split.fate;
  const resilience = fateBase.resilience + split.resilience;

  heroCounter += 1;
  return {
    id: opts.id ?? `hero-${heroCounter}`,
    name: opts.name,
    kind: 'hero',
    species: sp.label,
    career: opts.careerLabel,
    characteristics: chars,
    wounds: { current: wmax, max: wmax },
    advantage: 0,
    conditions: [],
    weapons,
    armour,
    skills,
    talents,
    movement: sp.movement,
    fate,
    fortune: fate,
    resilience,
    resolve: resilience,
    motivation: opts.motivation,
  };
}

function autoFateSplit(extra: number): { fate: number; resilience: number } {
  const fate = Math.ceil(extra / 2);
  return { fate, resilience: extra - fate };
}

function classForCareer(careerLabel: string) {
  // careerLevels n'a pas la classe ; on la retrouve via la carrière.
  const c = careers.find((x) => x.label === careerLabel);
  return c ? classes.find((cl) => cl.label === c.class) : undefined;
}

const ARMOUR_LOC_MAP: Record<string, HitLocation[]> = {
  Tête: ['tete'],
  Bras: ['brasG', 'brasD'],
  Mains: ['brasG', 'brasD'],
  Corps: ['corps'],
  Jambes: ['jambeG', 'jambeD'],
};

function emptyArmour(): ArmourPoints {
  return { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 };
}

export function deriveArmour(trappingNames: string[]): ArmourPoints {
  const ap = emptyArmour();
  for (const name of trappingNames) {
    const t = findTrapping(parseSkillRef(name).name);
    if (!t || t.type !== 'armor' || !t.pa || !t.loc) continue;
    for (const part of t.loc.split(',').map((s) => s.trim())) {
      const locs = ARMOUR_LOC_MAP[part];
      if (locs) for (const l of locs) ap[l] = Math.max(ap[l], t.pa);
    }
  }
  return ap;
}

export function deriveWeapons(trappingNames: string[], chars: Characteristics): Weapon[] {
  const weapons: Weapon[] = [];
  for (const name of trappingNames) {
    const t = findTrapping(parseSkillRef(name).name);
    if (!t || (t.type !== 'melee' && t.type !== 'ranged')) continue;
    weapons.push({
      name: t.label,
      type: t.type,
      damage: t.damage ?? '+BF',
      reach: t.reach,
      range: t.type === 'ranged' ? Number(t.reach) || null : null,
      qualities: t.qualities,
    });
  }
  // Tout le monde peut frapper à mains nues (Livre de base : « l'arme est votre corps »).
  weapons.push({ name: 'Mains nues', type: 'melee', damage: '+BF-2', reach: 'Très courte', qualities: [] });
  return weapons;
}

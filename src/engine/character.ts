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
 * Les compétences/talents *raciaux* sont appliqués (Livre de base, étape 4,
 * l.510) : 3 Compétences d'espèce à +5 et 3 à +3 ; Talents d'espèce résolus
 * (choix « A ou B », fixes, et « N Talent aléatoire » tirés sur le Tableau des
 * Talents aléatoires d100 — données issues de Source/all-data.json).
 */
import { RNG, defaultRNG, roll } from './dice';
import { maxWounds } from './characteristics';
import { buildInventory, recomputeLoadout, emptyArmour } from './items';
import { CharKey, CHAR_KEYS, Characteristics, ArmourPoints, Combatant, Weapon, SkillInstance, TalentInstance, HitLocation } from './types';
import {
  SpeciesData,
  findSpecies,
  firstLevel,
  findSkill,
  findTrapping,
  classes,
  careers,
  talents as talentTable,
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

/**
 * Augmentations de Compétences d'espèce (Livre de base l.510) : 3 Compétences
 * reçoivent +5, 3 autres +3. Par défaut les 3 premières / 3 suivantes de la
 * liste d'espèce ; surchargeable.
 */
export function speciesSkillAdvanceMap(
  sp: SpeciesData,
  override?: { plus5: string[]; plus3: string[] },
): Record<string, number> {
  const plus5 = override?.plus5 ?? sp.skills.slice(0, 3);
  const plus3 = override?.plus3 ?? sp.skills.slice(3, 6);
  const map: Record<string, number> = {};
  for (const s of plus5) map[s] = (map[s] ?? 0) + 5;
  for (const s of plus3) map[s] = (map[s] ?? 0) + 3;
  return map;
}

/** Tableau des Talents aléatoires (Livre de base) : talents avec borne d100, triés. */
function randomTalentTable() {
  return talentTable.filter((t) => t.rand != null).sort((a, b) => (a.rand as number) - (b.rand as number));
}

/**
 * Tire un Talent sur le Tableau des Talents aléatoires (1d100). Relance si le
 * talent est déjà possédé (Livre de base : « vous pouvez relancer »).
 */
export function rollRandomTalent(rng: RNG, owned: Set<string>): string | null {
  const table = randomTalentTable();
  if (!table.length) return null;
  for (let attempt = 0; attempt < 100; attempt++) {
    const r = roll(1, 100, rng);
    const entry = table.find((t) => r <= (t.rand as number));
    if (entry && !owned.has(entry.label)) return entry.label;
  }
  return null;
}

/**
 * Résout les Talents d'espèce : « A ou B » → choix (défaut : le 1er), Talents
 * fixes ajoutés tels quels, « N Talent aléatoire » → N tirages distincts sur
 * le Tableau des Talents aléatoires.
 */
export function resolveSpeciesTalents(
  sp: SpeciesData,
  opts: { rng?: RNG; choices?: Record<string, string>; owned?: Iterable<string> } = {},
): string[] {
  const rng = opts.rng ?? defaultRNG;
  const owned = new Set<string>(opts.owned ?? []);
  const result: string[] = [];
  const add = (name: string) => {
    result.push(name);
    owned.add(name);
  };
  for (const entry of sp.talents) {
    const e = entry.trim();
    const mRand = e.match(/^(\d+)\s+Talents?\s+al[ée]atoires?$/i);
    if (mRand) {
      const n = parseInt(mRand[1], 10);
      for (let i = 0; i < n; i++) {
        const t = rollRandomTalent(rng, owned);
        if (t) add(t);
      }
      continue;
    }
    if (/\sou\s/i.test(e)) {
      const options = e.split(/\s+ou\s+/i).map((s) => s.trim());
      add(opts.choices?.[e] ?? options[0]);
      continue;
    }
    add(e);
  }
  return result;
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
  /** Compétences d'espèce recevant +5/+3 (défaut : 3 premières / 3 suivantes de la liste). */
  speciesSkillAdvances?: { plus5: string[]; plus3: string[] };
  /** Pour les Talents d'espèce « A ou B » : le talent choisi, par entrée. */
  speciesTalentChoices?: Record<string, string>;
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

  // 4b) Compétences d'espèce (Livre de base l.510) : 3 à +5, 3 à +3 ; les
  // augmentations s'ajoutent à celles de carrière si la compétence est partagée.
  for (const [raw, adv] of Object.entries(speciesSkillAdvanceMap(sp, opts.speciesSkillAdvances))) {
    const { name, spec } = parseSkillRef(raw);
    const existing = skills.find((s) => s.name === name && (s.spec ?? '') === (spec ?? ''));
    if (existing) existing.advances += adv;
    else skills.push({ name, spec, characteristic: skillCharacteristic(name), advances: adv });
  }

  // Talents : un seul de carrière au choix à la création.
  const talentChoices = level?.talents ?? [];
  const chosenTalent = opts.careerTalent ?? talentChoices[0];
  const talents: TalentInstance[] = chosenTalent ? [{ name: chosenTalent, times: 1 }] : [];

  // 4c) Talents d'espèce : choix « A ou B », fixes, et « N Talent aléatoire ».
  for (const name of resolveSpeciesTalents(sp, {
    rng,
    choices: opts.speciesTalentChoices,
    owned: talents.map((t) => t.name),
  })) {
    const existing = talents.find((t) => t.name === name);
    if (existing) existing.times += 1;
    else talents.push({ name, times: 1 });
  }

  // 5) Possessions : classe + carrière → inventaire à stats, armes/armures équipées.
  const classTrappings = classForCareer(opts.careerLabel)?.trappings ?? [];
  const trappingNames = [...classTrappings, ...(level?.trappings ?? [])];
  const items = buildInventory(trappingNames);

  const small = sp.small;
  const wmax = maxWounds(chars, small);

  // Destin / Résilience
  const fateBase = sp.fate;
  const split = opts.fateSplit ?? autoFateSplit(fateBase.extra);
  const fate = fateBase.fate + split.fate;
  const resilience = fateBase.resilience + split.resilience;

  heroCounter += 1;
  const hero: Combatant = {
    id: opts.id ?? `hero-${heroCounter}`,
    name: opts.name,
    kind: 'hero',
    species: sp.label,
    career: opts.careerLabel,
    characteristics: chars,
    wounds: { current: wmax, max: wmax },
    advantage: 0,
    conditions: [],
    weapons: [],
    armour: emptyArmour(),
    items,
    skills,
    talents,
    movement: sp.movement,
    fate,
    fortune: fate,
    resilience,
    resolve: resilience,
    motivation: opts.motivation,
    // Avancement : aucune Augmentation de Caractéristique à la création (création = espèce + 2d10) ;
    // les PX sont attribués en jeu, on démarre Niveau de Carrière 1.
    xp: 0,
    charAdvances: {},
    careerLevel: 1,
  };
  recomputeLoadout(hero); // dérive weapons/armour/encombrement de l'équipement
  return hero;
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

export function deriveWeapons(trappingNames: string[], _chars: Characteristics): Weapon[] {
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

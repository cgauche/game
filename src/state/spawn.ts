/**
 * Construction de Combattants depuis le bestiaire (réf.) ou un statblock
 * personnalisé d'une scène. Sert au combat tactique.
 */
import { Combatant, Characteristics, CHAR_KEYS, Weapon, ArmourPoints } from '../engine/types';
import { findCreature, CreatureData } from '../data';
import { CustomStatblock, EntityAppearance } from './scene';
import { emptyArmour } from '../engine/items';
import { riggedAppearance, weaponFromLabel } from '../gameIso/rig/enemyProfile';
import { hashSeed } from '../gameIso/appearance';

function charsFrom(src: Partial<Record<string, number | null>>, fallback = 30): Characteristics {
  const chars = {} as Characteristics;
  for (const k of CHAR_KEYS) {
    const v = src[k];
    chars[k] = typeof v === 'number' ? v : fallback;
  }
  return chars;
}

const normTrait = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

/**
 * Attaques NATURELLES (FR) : pas d'arme tenue par le rig (la « part » du corps fait
 * foi — griffes, morsure, tentacule…). Le rendu n'affiche donc pas d'objet en main.
 */
const NATURAL_WEAPON = new Set([
  'morsure', 'griffes', 'griffe', 'poings', 'mains nues', 'tentacule', 'tentacules',
  'bec', 'dard', 'corne', 'cornes', 'queue', 'pietinement', 'crachat',
]);

/**
 * Parse UN trait d'arme WFRP4 (français) en arme jouable, ou null. Gère le TYPE
 * entre parenthèses (l'armement des monstres est dans les Traits) :
 *   « Arme +7 », « Arme (Épée) +7 », « Arme (Dague) +4 », « Arme (griffes) »,
 *   « À distance (Arbalète) +9 (60) », « À distance +8 (50) », « Morsure +9 ».
 * Le `name` = le TYPE quand il est manufacturé (→ le rig tient cette arme) ; sinon
 * une étiquette naturelle (→ weaponFamily renvoie '' = aucune arme dessinée).
 */
export function weaponFromTrait(t: string): Weapon | null {
  let m: RegExpMatchArray | null;
  if ((m = t.match(/^À distance(?:\s*\(([^)]+)\))?\s*\+(\d+)(?:\s*\((\d+)\))?/i))) {
    const type = m[1]?.trim();
    const w: Weapon = { name: type && !NATURAL_WEAPON.has(normTrait(type)) ? type : 'Attaque à distance', type: 'ranged', damage: `+${m[2]}`, qualities: [] };
    if (m[3]) w.range = Number(m[3]);
    return w;
  }
  if ((m = t.match(/^Arme(?:\s*\(([^)]+)\))?\s*(?:\+(\d+))?/i))) {
    const type = m[1]?.trim();
    const damage = m[2] ? `+${m[2]}` : '+BF';
    if (type && NATURAL_WEAPON.has(normTrait(type))) return { name: type, type: 'melee', damage, qualities: [] };
    return { name: type ?? 'Arme', type: 'melee', damage, qualities: [] };
  }
  if ((m = t.match(/^(Morsure|Griffes?|Tentacules?|Bec|Dard|Cornes?|Queue|Pi[ée]tinement|Crachat)\s*\+?(\d+)?/i))) {
    const ranged = /crachat/i.test(m[1]);
    return { name: m[1], type: ranged ? 'ranged' : 'melee', damage: m[2] ? `+${m[2]}` : '+BF', qualities: [] };
  }
  return null;
}

/** Parse les traits d'arme d'une créature en armes jouables (mêlée + distance). */
function weaponsFromTraits(traits: string[]): Weapon[] {
  const weapons: Weapon[] = [];
  for (const t of traits) {
    const w = weaponFromTrait(t);
    if (w) weapons.push(w);
  }
  if (weapons.length === 0) weapons.push({ name: 'Arme', type: 'melee', damage: '+BF', qualities: [] });
  return weapons;
}

function armourFromTraits(traits: string[]): ArmourPoints {
  for (const t of traits) {
    const m = t.match(/^Armure\s*\(?\+?(\d+)\)?/i);
    if (m) return emptyArmour(Number(m[1]));
  }
  return emptyArmour(0);
}

export function creatureToCombatant(creature: CreatureData, id: string, pos: { x: number; y: number }): Combatant {
  const chars = charsFrom(creature.char);
  const wounds = typeof creature.char.B === 'number' ? creature.char.B : 10;
  const movement = typeof creature.char.M === 'number' ? creature.char.M : 4;
  return {
    id,
    name: creature.label,
    kind: 'enemy',
    characteristics: chars,
    wounds: { current: wounds, max: wounds },
    advantage: 0,
    conditions: [],
    weapons: weaponsFromTraits(creature.traits),
    armour: armourFromTraits(creature.traits),
    skills: [],
    talents: [],
    movement,
    pos,
  };
}

export function statblockToCombatant(sb: CustomStatblock, id: string, pos: { x: number; y: number }): Combatant {
  const chars = charsFrom(sb.char as any);
  const wounds = typeof sb.char.B === 'number' ? (sb.char.B as number) : 10;
  const movement = typeof sb.char.M === 'number' ? (sb.char.M as number) : 4;
  return {
    id,
    name: sb.name,
    kind: 'enemy',
    characteristics: chars,
    wounds: { current: wounds, max: wounds },
    advantage: 0,
    conditions: [],
    // Armes : depuis les Traits si fournis (« Arme (Épée) +7 », « À distance (Arbalète) +9 (60) »),
    // sinon une arme générique au dégât indiqué.
    weapons: sb.traits?.length ? weaponsFromTraits(sb.traits) : [{ name: 'Arme', type: 'melee', damage: sb.weaponDamage ?? '+BF', qualities: [] }],
    armour: emptyArmour(sb.armour ?? 0),
    skills: [],
    talents: [],
    movement,
    pos,
  };
}

export function spawnEnemy(
  ref: string | undefined,
  statblock: CustomStatblock | undefined,
  id: string,
  pos: { x: number; y: number },
  opts?: { appearance?: EntityAppearance; weapon?: string },
): Combatant {
  let c: Combatant;
  if (statblock) c = statblockToCombatant(statblock, id, pos);
  else if (ref && findCreature(ref)) c = creatureToCombatant(findCreature(ref)!, id, pos);
  else c = statblockToCombatant({ name: ref ?? 'Ennemi', char: { B: 10 } }, id, pos); // repli

  // COSMÉTIQUE — identité visuelle traversant explo↔combat à l'identique :
  // parts monstrueux (mutant modulaire) + arme équipée affichée par le rig.
  if (opts?.appearance?.monster) {
    c.appearance = riggedAppearance(c.name, opts.appearance.seed ?? hashSeed(id), opts.appearance.monster);
  }
  if (opts?.weapon) {
    c.weapons = [weaponFromLabel(opts.weapon), ...c.weapons];
  }
  return c;
}

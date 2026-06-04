/**
 * Construction de Combattants depuis le bestiaire (réf.) ou un statblock
 * personnalisé d'une scène. Sert au combat tactique.
 */
import { Combatant, Characteristics, CHAR_KEYS, CharKey, Weapon, ArmourPoints } from '../engine/types';
import { findCreature, CreatureData } from '../data';
import { CustomStatblock } from './scene';

function emptyArmour(ap = 0): ArmourPoints {
  return { tete: ap, brasG: ap, brasD: ap, corps: ap, jambeG: ap, jambeD: ap };
}

function charsFrom(src: Partial<Record<string, number | null>>, fallback = 30): Characteristics {
  const chars = {} as Characteristics;
  for (const k of CHAR_KEYS) {
    const v = src[k];
    chars[k] = typeof v === 'number' ? v : fallback;
  }
  return chars;
}

/** Parse les traits d'arme d'une créature en armes jouables. */
function weaponsFromTraits(traits: string[]): Weapon[] {
  const weapons: Weapon[] = [];
  for (const t of traits) {
    const melee = t.match(/^Arme\s*\+(\d+)/i);
    if (melee) weapons.push({ name: 'Arme naturelle', type: 'melee', damage: `+${melee[1]}`, qualities: [] });
    const ranged = t.match(/^À distance\s*\+(\d+)\s*\((\d+)\)/i);
    if (ranged)
      weapons.push({ name: 'Attaque à distance', type: 'ranged', damage: `+${ranged[1]}`, range: Number(ranged[2]), qualities: [] });
  }
  if (weapons.length === 0)
    weapons.push({ name: 'Arme', type: 'melee', damage: '+BF', qualities: [] });
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
    weapons: [{ name: 'Arme', type: 'melee', damage: sb.weaponDamage ?? '+BF', qualities: [] }],
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
): Combatant {
  if (statblock) return statblockToCombatant(statblock, id, pos);
  if (ref) {
    const c = findCreature(ref);
    if (c) return creatureToCombatant(c, id, pos);
  }
  // Repli : un humain de base.
  return statblockToCombatant({ name: ref ?? 'Ennemi', char: { B: 10 } }, id, pos);
}

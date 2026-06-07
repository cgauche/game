/**
 * Construction de Combattants depuis le bestiaire (réf.) ou un statblock
 * personnalisé d'une scène. Sert au combat tactique.
 */
import { Combatant, Characteristics, CHAR_KEYS, Weapon, ArmourPoints } from '../engine/types';
import { findCreature, CreatureData } from '../data';
import { CustomStatblock, EntityAppearance } from './scene';
import { emptyArmour } from '../engine/items';
import { maxWounds } from '../engine/characteristics';
import { parseSizeLabel, SizeCategory } from '../engine/size';
import { norm as normTrait } from '../lib/normalize';
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

/** Catégorie de Taille depuis le trait « Taille (X) » (LDB 85), ou null si absent.
 *  Une plage (« Taille (de Petite à Énorme) ») est résolue à sa borne haute par `parseSizeLabel`. */
export function sizeFromTraits(traits: string[]): SizeCategory | null {
  for (const t of traits) {
    const m = t.match(/^Taille\s*\(([^)]+)\)/i);
    if (m) {
      const cat = parseSizeLabel(m[1]);
      if (cat) return cat;
    }
  }
  return null;
}

export function creatureToCombatant(creature: CreatureData, id: string, pos: { x: number; y: number }): Combatant {
  const chars = charsFrom(creature.char);
  const size = sizeFromTraits(creature.traits) ?? 'moyenne';
  // char.B (bestiaire) = la valeur livre (déjà formule × Taille) → fait office de base/surcharge ; sinon formule.
  const wounds = typeof creature.char.B === 'number' ? creature.char.B : maxWounds(chars, size);
  const movement = typeof creature.char.M === 'number' ? creature.char.M : 4;
  return {
    id,
    name: creature.label,
    kind: 'enemy',
    characteristics: chars,
    wounds: { current: wounds, max: wounds, base: wounds },
    advantage: 0,
    conditions: [],
    weapons: weaponsFromTraits(creature.traits),
    armour: armourFromTraits(creature.traits),
    size,
    traits: creature.traits, // conservés → attaques gratuites de créature en combat
    skills: [],
    talents: [],
    movement,
    pos,
  };
}

export function statblockToCombatant(sb: CustomStatblock, id: string, pos: { x: number; y: number }): Combatant {
  const chars = charsFrom(sb.char as any);
  const size = sb.size ?? sizeFromTraits(sb.traits ?? []) ?? 'moyenne';
  // Blessures : surcharge explicite `char.B` si fournie, sinon formule par Taille (vide ⇒ formule, LDB 85).
  const wounds = typeof sb.char.B === 'number' ? (sb.char.B as number) : maxWounds(chars, size);
  const movement = typeof sb.char.M === 'number' ? (sb.char.M as number) : 4;
  return {
    id,
    name: sb.name,
    kind: 'enemy',
    characteristics: chars,
    wounds: { current: wounds, max: wounds, base: wounds },
    advantage: 0,
    conditions: [],
    // Armes : depuis les Traits si fournis (« Arme (Épée) +7 », « À distance (Arbalète) +9 (60) »),
    // sinon une arme générique au dégât indiqué.
    weapons: sb.traits?.length ? weaponsFromTraits(sb.traits) : [{ name: 'Arme', type: 'melee', damage: sb.weaponDamage ?? '+BF', qualities: [] }],
    armour: emptyArmour(sb.armour ?? 0),
    size,
    traits: sb.traits, // conservés → attaques gratuites de créature en combat
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
  // parts monstrueux (mutant modulaire) + couleurs (palette) + arme équipée.
  if (opts?.appearance?.monster || opts?.appearance?.colors || opts?.appearance?.parts) {
    c.appearance = riggedAppearance(c.name, opts.appearance.seed ?? hashSeed(id), {
      monster: opts.appearance.monster,
      colors: opts.appearance.colors,
      parts: opts.appearance.parts,
      sex: opts.appearance.sex,
      build: opts.appearance.build,
    });
  }
  if (opts?.weapon) {
    c.weapons = [weaponFromLabel(opts.weapon), ...c.weapons];
  }
  return c;
}

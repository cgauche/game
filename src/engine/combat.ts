/**
 * Résolution du Combat — Livre de base, chapitre « Combat » (p. 158-161).
 *
 * Étapes : 1) Toucher (Test opposé de Corps à corps / Test de Projectiles)
 *          2) Localisation (jet du toucher inversé)
 *          3) Dégâts = Dégâts d'arme + DR
 *          4) Application = Dégâts − (Bonus d'Endurance + PA de la localisation)
 */
import { RNG, defaultRNG } from './dice';
import { rollTest, resolveOpposed } from './tests';
import { bonus, effectiveChar } from './characteristics';
import { agilityTestPenalty } from './encumbrance';
import { Combatant, HitLocation, Weapon } from './types';

/** Dégâts d'arme : « +BF+4 » → BF + 4, « +9 » → 9. */
export function parseWeaponDamage(damage: string, strengthBonus: number): number {
  if (damage == null) return 0;
  const usesBF = /BF/i.test(damage);
  const rest = damage.replace(/BF/gi, '');
  const nums = rest.match(/[+-]?\d+/g) ?? [];
  const sum = nums.reduce((a, n) => a + parseInt(n, 10), 0);
  return Math.max(0, (usesBF ? strengthBonus : 0) + sum);
}

/** Inverse le jet du toucher (23 → 32 ; « 00 » → 100). */
export function reverseRoll(r: number): number {
  const n = r % 100; // 100 → 0
  const t = Math.floor(n / 10);
  const o = n % 10;
  let rev = o * 10 + t;
  if (rev === 0) rev = 100;
  return rev;
}

/** Tableau de Localisation (Livre de base p. 159). */
export function hitLocation(reversed: number): HitLocation {
  if (reversed <= 9) return 'tete';
  if (reversed <= 24) return 'brasG';
  if (reversed <= 44) return 'brasD';
  if (reversed <= 79) return 'corps';
  if (reversed <= 89) return 'jambeG';
  return 'jambeD';
}

const tens = (n: number) => Math.floor(n / 10);

/** Valeur de Compétence de combat (Caractéristique + avances pertinentes). */
export function combatValue(c: Combatant, kind: 'melee' | 'ranged'): number {
  const charKey = kind === 'melee' ? 'CC' : 'CT';
  const base = effectiveChar(c, charKey);
  const skillName = kind === 'melee' ? 'corps à corps' : 'projectiles';
  const sk = c.skills.find((s) => s.name.toLowerCase().includes(skillName));
  return base + (sk?.advances ?? 0);
}

/**
 * Valeur de défense (Parade = Corps à corps ; Esquive = Agilité + avances).
 * L'Esquive subit la pénalité d'Agilité d'Encombrement (Surchargé, LDB p.295).
 */
export function defenseValue(c: Combatant, mode: 'parade' | 'esquive'): number {
  if (mode === 'parade') return combatValue(c, 'melee');
  const sk = c.skills.find((s) => s.name.toLowerCase().includes('esquive'));
  return effectiveChar(c, 'Ag') + (sk?.advances ?? 0) + agilityTestPenalty(c);
}

export interface AttackResult {
  hit: boolean;
  attackerRoll: number;
  defenderRoll?: number;
  netSL: number;
  location?: HitLocation;
  damage?: number; // dégâts bruts (avant mitigation)
  woundsLost?: number; // Blessures réellement perdues
  critical: boolean;
  /** +1 Avantage gagné par l'attaquant (true) ou le défenseur (false), null = aucun. */
  advantageTo: 'attacker' | 'defender' | null;
  defenderDefeated: boolean;
  log: string;
}

export interface AttackOptions {
  defense?: 'parade' | 'esquive' | 'none';
}

/** Résout une attaque de mêlée (Test opposé de Corps à corps). */
export function resolveMelee(
  attacker: Combatant,
  defender: Combatant,
  weapon: Weapon,
  rng: RNG = defaultRNG,
  opts: AttackOptions = {},
): AttackResult {
  const defenseMode = opts.defense ?? 'parade';
  const atkVal = combatValue(attacker, 'melee');
  const atk = rollTest(atkVal, 'intermediaire', rng);

  if (defenseMode === 'none') {
    // Cible sans défense : un simple succès suffit à toucher.
    if (!atk.success) {
      return miss(attacker, defender, atk.roll, 'defender');
    }
    return applyHit(attacker, defender, weapon, atk.roll, atk.sl, atk.isDouble && atk.success);
  }

  const defVal = defenseValue(defender, defenseMode);
  const def = rollTest(defVal, 'intermediaire', rng);
  const opp = resolveOpposed(atk, def);

  if (opp.winner === 'defender') {
    return {
      hit: false,
      attackerRoll: atk.roll,
      defenderRoll: def.roll,
      netSL: opp.netSL,
      critical: false,
      advantageTo: 'defender',
      defenderDefeated: false,
      log: `${attacker.name} rate son attaque ; ${defender.name} gagne +1 Avantage.`,
    };
  }
  if (opp.winner === 'tie') {
    // Égalité parfaite (DR et valeurs cibles) : statu quo, personne ne l'emporte.
    return {
      hit: false,
      attackerRoll: atk.roll,
      defenderRoll: def.roll,
      netSL: 0,
      critical: false,
      advantageTo: null,
      defenderDefeated: false,
      log: `Échange neutre : ni ${attacker.name} ni ${defender.name} ne prend l'avantage.`,
    };
  }
  const critical = atk.isDouble && atk.success;
  const res = applyHit(attacker, defender, weapon, atk.roll, opp.netSL, critical);
  res.defenderRoll = def.roll;
  return res;
}

/** Résout une attaque à distance (Test de Projectiles, non opposé). */
export function resolveRanged(
  attacker: Combatant,
  defender: Combatant,
  weapon: Weapon,
  rng: RNG = defaultRNG,
): AttackResult {
  const atkVal = combatValue(attacker, 'ranged');
  const atk = rollTest(atkVal, 'intermediaire', rng);
  if (!atk.success) {
    return {
      hit: false,
      attackerRoll: atk.roll,
      netSL: atk.sl,
      critical: false,
      advantageTo: null, // pas d'Avantage au défenseur en combat à distance
      defenderDefeated: false,
      log: `${attacker.name} manque sa cible.`,
    };
  }
  return applyHit(attacker, defender, weapon, atk.roll, atk.sl, atk.isDouble && atk.success);
}

function applyHit(
  attacker: Combatant,
  defender: Combatant,
  weapon: Weapon,
  attackerRoll: number,
  dr: number,
  critical: boolean,
): AttackResult {
  const loc = hitLocation(reverseRoll(attackerRoll));
  const sb = bonus(effectiveChar(attacker, 'F'));
  const weaponDmg = parseWeaponDamage(weapon.damage, sb);
  const damage = weaponDmg + Math.max(0, dr);
  const tb = bonus(effectiveChar(defender, 'E'));
  const ap = defender.armour[loc] ?? 0;
  const woundsLost = Math.max(1, damage - (tb + ap));
  const newWounds = defender.wounds.current - woundsLost;
  const defeated = newWounds <= 0;
  // Blessure critique + À Terre : « si le nombre de Points de Blessure perdus
  // est supérieur au total de Points de Blessure de l'adversaire » (13 - Combat.md).
  // → quand les dégâts d'UN coup dépassent les Blessures MAX (pas le réservoir
  // courant). Corrigé suite à l'audit de fidélité.
  const isCritical = critical || woundsLost > defender.wounds.max;
  return {
    hit: true,
    attackerRoll,
    netSL: dr,
    location: loc,
    damage,
    woundsLost,
    critical: isCritical,
    advantageTo: 'attacker',
    defenderDefeated: defeated,
    log:
      `${attacker.name} touche ${defender.name} (${locLabel(loc)}) : ` +
      `${damage} dégâts − ${tb + ap} (BE+PA) = ${woundsLost} Blessures` +
      (isCritical ? ' — CRITIQUE !' : '') +
      '.',
  };
}

function miss(
  attacker: Combatant,
  defender: Combatant,
  roll: number,
  advantageTo: 'attacker' | 'defender' | null,
): AttackResult {
  return {
    hit: false,
    attackerRoll: roll,
    netSL: 0,
    critical: false,
    advantageTo,
    defenderDefeated: false,
    log: `${attacker.name} manque ${defender.name}.`,
  };
}

function locLabel(l: HitLocation): string {
  return {
    tete: 'Tête',
    brasG: 'Bras gauche',
    brasD: 'Bras droit',
    corps: 'Corps',
    jambeG: 'Jambe gauche',
    jambeD: 'Jambe droite',
  }[l];
}

/** Ordre d'initiative : Initiative décroissante, départage par Agilité. */
export function initiativeOrder(combatants: Combatant[]): Combatant[] {
  return [...combatants].sort((a, b) => {
    const ia = a.initiative ?? a.characteristics.I;
    const ib = b.initiative ?? b.characteristics.I;
    if (ib !== ia) return ib - ia;
    return b.characteristics.Ag - a.characteristics.Ag;
  });
}

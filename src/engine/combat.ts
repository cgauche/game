/**
 * Résolution du Combat — Livre de base, chapitre « Combat » (p. 158-161).
 *
 * Étapes : 1) Toucher (Test opposé de Corps à corps / Test de Projectiles)
 *          2) Localisation (jet du toucher inversé)
 *          3) Dégâts = Dégâts d'arme + DR
 *          4) Application = Dégâts − (Bonus d'Endurance + PA de la localisation)
 */
import { RNG, defaultRNG } from './dice';
import { rollTest, resolveOpposed, TestResult } from './tests';
import { bonus, effectiveChar } from './characteristics';
import { agilityTestPenalty } from './encumbrance';
import { Combatant, HitLocation, Weapon } from './types';
import { combatTestPenalty, meleeAttackerBonus, cannotDefend } from './conditions';

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
  /** Localisation visée (Complexe -10 au Test ; sinon localisation = jet inversé). */
  location?: HitLocation;
}

/** Une arme possède-t-elle l'Atout/Défaut `q` (insensible à la casse ; ignore l'Indice). */
const hasQ = (w: Weapon | undefined, q: string): boolean =>
  !!w && w.qualities.some((x) => x.toLowerCase().startsWith(q.toLowerCase()));

/** Jet de l'ATTAQUANT seul (Précise +10, viser -10, Avantage×10, États) — n'inclut
 *  PAS le jet de défense : sert au flux par modale (jet figé, appelé UNE fois). */
export function rollMeleeAttacker(
  attacker: Combatant,
  defender: Combatant,
  weapon: Weapon,
  rng: RNG = defaultRNG,
  location?: HitLocation,
): TestResult {
  const atkVal = combatValue(attacker, 'melee');
  const precise = hasQ(weapon, 'Précise') ? 10 : 0; // Atout Précise : +10 au Test (l.304)
  const aimed = location ? -10 : 0; // viser une localisation = Complexe -10 (LDB Combat l.104)
  return rollTest(atkVal, 'intermediaire', rng, attacker.advantage * 10 + combatTestPenalty(attacker) + meleeAttackerBonus(defender) + precise + aimed);
}

/** Jet du DÉFENSEUR seul (Parade = Corps à corps, Esquive = Agilité + avances ;
 *  « Sur la défensive » +20). C'est le SEUL jet relancé par un point de Chance. */
export function rollMeleeDefender(
  defender: Combatant,
  mode: 'parade' | 'esquive',
  rng: RNG = defaultRNG,
): TestResult {
  const defVal = defenseValue(defender, mode);
  return rollTest(defVal, 'intermediaire', rng, defender.advantage * 10 + combatTestPenalty(defender) + (defender.defensiveStance ? 20 : 0));
}

/** Jet de Corps à corps « brut » d'un combattant pour le Test opposé de Désengagement
 *  (LDB 15-Dépl l.89 « Esquive/Corps à corps »). Inclut l'Avantage×10 et les pénalités
 *  d'États, mais PAS les Atouts d'arme ni les bonus de cible (ce n'est pas une attaque portée). */
export function rollDisengageAttack(foe: Combatant, rng: RNG = defaultRNG): TestResult {
  return rollTest(combatValue(foe, 'melee'), 'intermediaire', rng, foe.advantage * 10 + combatTestPenalty(foe));
}

/** Combine un jet d'attaque et un jet de défense DÉJÀ obtenus en AttackResult
 *  (Test opposé). drAdjust : Défensive (déf.) +1 DR / À Enroulement (att.) -1 DR,
 *  en Parade uniquement. */
export function finishMelee(
  attacker: Combatant,
  defender: Combatant,
  weapon: Weapon,
  atk: TestResult,
  def: TestResult,
  defenseMode: 'parade' | 'esquive',
  location?: HitLocation,
): AttackResult {
  // Atouts qui modulent le DR du Test opposé (uniquement en Parade — Corps à corps) :
  // Défensive (arme du défenseur) +1 DR (l.273), À Enroulement (arme de l'attaquant) -1 DR (l.259).
  const drAdjust = defenseMode === 'parade' ? (hasQ(defender.weapons[0], 'Défensive') ? 1 : 0) - (hasQ(weapon, 'À Enroulement') ? 1 : 0) : 0;
  const opp = resolveOpposed(atk, drAdjust ? { ...def, sl: def.sl + drAdjust } : def);

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
  const res = applyHit(attacker, defender, weapon, atk.roll, opp.netSL, critical, location);
  res.defenderRoll = def.roll;
  return res;
}

/** Issue d'une attaque de mêlée SANS défense (Surpris, ou « Subir ») à partir
 *  d'un jet d'attaque déjà obtenu : un simple succès suffit à toucher. */
export function resolveMeleePassive(
  attacker: Combatant,
  defender: Combatant,
  weapon: Weapon,
  atk: TestResult,
  location?: HitLocation,
): AttackResult {
  if (!atk.success) return miss(attacker, defender, atk.roll, 'defender');
  return applyHit(attacker, defender, weapon, atk.roll, atk.sl, atk.isDouble && atk.success, location);
}

/** Résout une attaque de mêlée (Test opposé de Corps à corps). Orchestrateur :
 *  jet d'attaque PUIS jet de défense (ordre RNG inchangé) ; voie instantanée. */
export function resolveMelee(
  attacker: Combatant,
  defender: Combatant,
  weapon: Weapon,
  rng: RNG = defaultRNG,
  opts: AttackOptions = {},
): AttackResult {
  const defenseMode = cannotDefend(defender) ? 'none' : opts.defense ?? 'parade';
  const atk = rollMeleeAttacker(attacker, defender, weapon, rng, opts.location);
  if (defenseMode === 'none') return resolveMeleePassive(attacker, defender, weapon, atk, opts.location);
  const def = rollMeleeDefender(defender, defenseMode, rng);
  return finishMelee(attacker, defender, weapon, atk, def, defenseMode, opts.location);
}

/**
 * Modificateur de portée d'un tir (LDB « Difficultés de Combat ») : Bout portant
 * (≤ Portée÷10) +60, Courte (≤ Portée÷2) +40, Moyenne/Longue (≤ Portée×2) +0,
 * Extrême (≤ Portée×3) -30 ; au-delà = hors de portée (null). Échelle 1 case = 2 m
 * (LDB Déplacement l.55). `rangeMeters` = Portée de l'arme en mètres.
 */
export function rangeBandModifier(distanceTiles: number, rangeMeters: number): number | null {
  const m = distanceTiles * 2;
  if (m <= rangeMeters / 10) return 60;
  if (m <= rangeMeters / 2) return 40;
  if (m <= rangeMeters * 2) return 0;
  if (m <= rangeMeters * 3) return -30;
  return null;
}

/** Résout une attaque à distance (Test de Projectiles, non opposé). */
export function resolveRanged(
  attacker: Combatant,
  defender: Combatant,
  weapon: Weapon,
  rng: RNG = defaultRNG,
  distanceTiles?: number,
  location?: HitLocation,
): AttackResult {
  const atkVal = combatValue(attacker, 'ranged');
  let bandMod = 0;
  if (distanceTiles != null && weapon.range) {
    const m = rangeBandModifier(distanceTiles, weapon.range);
    if (m == null)
      return { hit: false, attackerRoll: 0, netSL: 0, critical: false, advantageTo: null, defenderDefeated: false, log: `${attacker.name} : cible hors de portée.` };
    bandMod = m;
  }
  const precise = hasQ(weapon, 'Précise') ? 10 : 0;
  const aimed = location ? -10 : 0;
  const atk = rollTest(atkVal, 'intermediaire', rng, attacker.advantage * 10 + combatTestPenalty(attacker) + bandMod + precise + aimed);
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
  return applyHit(attacker, defender, weapon, atk.roll, atk.sl, atk.isDouble && atk.success, location);
}

function applyHit(
  attacker: Combatant,
  defender: Combatant,
  weapon: Weapon,
  attackerRoll: number,
  dr: number,
  critical: boolean,
  forcedLoc?: HitLocation,
): AttackResult {
  const loc = forcedLoc ?? hitLocation(reverseRoll(attackerRoll));
  const sb = bonus(effectiveChar(attacker, 'F'));
  const weaponDmg = parseWeaponDamage(weapon.damage, sb);
  const effDR = dr + (hasQ(weapon, 'Pointue') ? 1 : 0); // Atout Pointue : +1 DR sur une touche (l.301)
  const damage = weaponDmg + Math.max(0, effDR);
  const tb = bonus(effectiveChar(defender, 'E'));
  // Atout Perforante : ignore le premier point d'armure (l.316 ; le distinguo
  // métal/non-métal n'est pas modélisé — l'armure est un PA unique par localisation).
  const ap = Math.max(0, (defender.armour[loc] ?? 0) - (hasQ(weapon, 'Perforante') ? 1 : 0));
  const woundsLost = Math.max(1, damage - (tb + ap));
  const newWounds = defender.wounds.current - woundsLost;
  const defeated = newWounds <= 0;
  // Blessure critique : double réussi (déjà dans `critical`), Atout Empaleuse sur un
  // multiple de 10 (l.282), ou Blessures perdues > Blessures MAX (13 - Combat.md).
  const empale = hasQ(weapon, 'Empaleuse') && attackerRoll % 10 === 0;
  const isCritical = critical || empale || woundsLost > defender.wounds.max;
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

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

/** Détail d'un jet (pour l'affichage : base, modificateurs, cible, d100 et DR). */
export interface RollBreakdown {
  /** Intitulé du jet : 'Corps à corps' / 'Parade' / 'Esquive' / 'Projectiles'. */
  label: string;
  /** Valeur de Compétence/Caractéristique de base (avant modificateurs). */
  base: number;
  /** Somme des modificateurs appliqués (Avantage, viser, États, portée, Atouts…). */
  modifier: number;
  /** Valeur cible effective (= base + modificateurs) : on réussit si jet ≤ cible. */
  target: number;
  roll: number;
  success: boolean;
  /** Degrés de Réussite de CE jet (positif = réussite). */
  sl: number;
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
  /** Détail du jet d'attaque (cible, d100, DR) — pour la modale. */
  attackerDetail?: RollBreakdown;
  /** Détail du jet de défense en Test opposé (cible, d100, DR) — absent si non opposé. */
  defenderDetail?: RollBreakdown;
  log: string;
}

const bd = (label: string, base: number, t: TestResult): RollBreakdown => ({
  label,
  base,
  modifier: t.target - base,
  target: t.target,
  roll: t.roll,
  success: t.success,
  sl: t.sl,
});
const DEFENSE_LABEL: Record<'parade' | 'esquive', string> = { parade: 'Parade', esquive: 'Esquive' };

export interface AttackOptions {
  defense?: 'parade' | 'esquive' | 'none';
  /** Localisation visée (Complexe -10 au Test ; sinon localisation = jet inversé). */
  location?: HitLocation;
}

/** Une arme possède-t-elle l'Atout/Défaut `q` (insensible à la casse ; ignore l'Indice). */
const hasQ = (w: Weapon | undefined, q: string): boolean =>
  !!w && w.qualities.some((x) => x.toLowerCase().startsWith(q.toLowerCase()));

/** Atout Pistolet (LDB « Les armes » l.297-298 : « Vous pouvez utiliser cette arme pour attaquer
 *  en Combat rapproché »). Seule une arme à distance possédant cet Atout peut tirer en étant
 *  Engagé / au contact ; les autres armes à distance (arc, arbalète…) ne le peuvent pas. */
export function canFireWhileEngaged(weapon: Weapon): boolean {
  return weapon.type === 'ranged' && hasQ(weapon, 'Pistolet');
}

/** Choisit l'arme adaptée à la distance de la cible : au CONTACT (Combat rapproché) on privilégie
 *  une arme de mêlée — une arme à distance n'y tire qu'avec l'Atout Pistolet (l.297-298) ; à
 *  DISTANCE on privilégie une arme à distance. Dernier recours : la première arme. */
export function attackWeapon(weapons: Weapon[], targetAdjacent: boolean): Weapon {
  if (targetAdjacent) {
    return weapons.find((w) => w.type === 'melee') ?? weapons.find(canFireWhileEngaged) ?? weapons[0];
  }
  return weapons.find((w) => w.type === 'ranged') ?? weapons[0];
}

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

/** Attaque gratuite « dans le dos » lors d'une Fuite (LDB 15-Dépl l.101,107) : Test de Corps
 *  à corps NON opposé, +20 au toucher (dos tourné), DR = Dégâts comme d'habitude. */
export function resolveBackstabAttack(foe: Combatant, target: Combatant, rng: RNG = defaultRNG): AttackResult {
  const atk = rollTest(combatValue(foe, 'melee'), 'intermediaire', rng, foe.advantage * 10 + combatTestPenalty(foe) + 20);
  return resolveMeleePassive(foe, target, foe.weapons[0], atk);
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
  const atkBd = bd('Corps à corps', combatValue(attacker, 'melee'), atk);
  const defBd = bd(DEFENSE_LABEL[defenseMode], defenseValue(defender, defenseMode), def);

  if (opp.winner === 'defender') {
    return {
      hit: false,
      attackerRoll: atk.roll,
      defenderRoll: def.roll,
      netSL: opp.netSL,
      critical: false,
      advantageTo: 'defender',
      defenderDefeated: false,
      attackerDetail: atkBd,
      defenderDetail: defBd,
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
      attackerDetail: atkBd,
      defenderDetail: defBd,
      log: `Échange neutre : ni ${attacker.name} ni ${defender.name} ne prend l'avantage.`,
    };
  }
  const critical = atk.isDouble && atk.success;
  const res = applyHit(attacker, defender, weapon, atkBd, opp.netSL, critical, location);
  res.defenderRoll = def.roll;
  res.defenderDetail = defBd;
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
  const atkBd = bd('Corps à corps', combatValue(attacker, 'melee'), atk);
  if (!atk.success) return miss(attacker, defender, atkBd, 'defender');
  return applyHit(attacker, defender, weapon, atkBd, atk.sl, atk.isDouble && atk.success, location);
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
  const atkBd = bd('Projectiles', atkVal, atk);
  if (!atk.success) {
    return {
      hit: false,
      attackerRoll: atk.roll,
      attackerDetail: atkBd,
      netSL: atk.sl,
      critical: false,
      advantageTo: null, // pas d'Avantage au défenseur en combat à distance
      defenderDefeated: false,
      log: `${attacker.name} manque sa cible.`,
    };
  }
  return applyHit(attacker, defender, weapon, atkBd, atk.sl, atk.isDouble && atk.success, location);
}

function applyHit(
  attacker: Combatant,
  defender: Combatant,
  weapon: Weapon,
  atkBd: RollBreakdown,
  dr: number,
  critical: boolean,
  forcedLoc?: HitLocation,
): AttackResult {
  const loc = forcedLoc ?? hitLocation(reverseRoll(atkBd.roll));
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
  // Coup Critique : double réussi (déjà dans `critical`) ou Atout Empaleuse sur un multiple de
  // 10 (l.282). L'OVERKILL (Blessures perdues > PB COURANTS, LDB 18-Traumatisme l.30) est désormais
  // géré par le STORE (pipeline de critique), car il dépend des PB courants de la cible — pas des PB max.
  const empale = hasQ(weapon, 'Empaleuse') && atkBd.roll % 10 === 0;
  const isCritical = critical || empale;
  return {
    hit: true,
    attackerRoll: atkBd.roll,
    attackerDetail: atkBd,
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
  atkBd: RollBreakdown,
  advantageTo: 'attacker' | 'defender' | null,
): AttackResult {
  return {
    hit: false,
    attackerRoll: atkBd.roll,
    attackerDetail: atkBd,
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

/**
 * Re-dérive une attaque NON opposée (tir OU mêlée passive) à partir d'un jet d'attaque DÉJÀ figé
 * — pour la Chance « +1 DR » (ch.17 l.26) : le DR voulu est porté par `atk.sl`, on NE relance PAS
 * le d100 (le succès reste celui du jet propre) et on recalcule uniquement les Dégâts.
 */
export function rederivePassiveAttack(
  attacker: Combatant,
  defender: Combatant,
  weapon: Weapon,
  atk: TestResult,
  kind: 'melee' | 'ranged',
  location?: HitLocation,
): AttackResult {
  const atkBd = bd(kind === 'ranged' ? 'Projectiles' : 'Corps à corps', combatValue(attacker, kind), atk);
  if (!atk.success) {
    return {
      hit: false,
      attackerRoll: atk.roll,
      attackerDetail: atkBd,
      netSL: atk.sl,
      critical: false,
      advantageTo: kind === 'ranged' ? null : 'defender',
      defenderDefeated: false,
      log: kind === 'ranged' ? `${attacker.name} manque sa cible.` : `${attacker.name} manque ${defender.name}.`,
    };
  }
  return applyHit(attacker, defender, weapon, atkBd, atk.sl, atk.isDouble && atk.success, location);
}

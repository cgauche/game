import { describe, it, expect } from 'vitest';
import { makeRNG, RNG } from './dice';
import { addCondition, combatTestPenalty, meleeAttackerBonus, cannotDefend } from './conditions';
import { parseQualityInstance } from './qualities/normalize';
import { evaluateTest, resolveOpposed } from './tests';
import { bonus, maxWounds } from './characteristics';
import { effectiveWeaponDamage } from './weaponDamage';
import {
  reverseRoll,
  hitLocation,
  hitLocationByShape,
  locationLabel,
  resolveMelee,
  rangeBandModifier,
  rollMeleeAttacker,
  rollMeleeDefender,
  finishMelee,
  resolveMeleePassive,
} from './combat';

describe('Portée des tirs (table des Difficultés, 14 - _GoBack.md l.82-118 ; 1 case = 2 m)', () => {
  it('Bout portant +40, Courte +20, Moyenne +0, Longue −10, Extrême −30, au-delà = null', () => {
    const R = 50; // Arc : Portée 50 m
    expect(rangeBandModifier(2, R)).toBe(40); // 4 m ≤ 5 (÷10) — Bout portant
    expect(rangeBandModifier(10, R)).toBe(20); // 20 m ≤ 25 (÷2) — Courte
    expect(rangeBandModifier(24, R)).toBe(0); // 48 m ≤ 50 (×1) — Moyenne
    expect(rangeBandModifier(40, R)).toBe(-10); // 80 m ≤ 100 (×2) — Longue (l.99)
    expect(rangeBandModifier(70, R)).toBe(-30); // 140 m ≤ 150 (×3) — Extrême (l.118)
    expect(rangeBandModifier(80, R)).toBeNull(); // 160 m > 150 → hors de portée
  });
});

describe("Atouts d'arme (LDB Les armes)", () => {
  const rngOf = (roll: number): RNG => ({ int: () => roll });
  const fighter = (cc: number, weapon: Partial<Weapon> = {}): Combatant =>
    ({
      id: 'a',
      name: 'a',
      kind: 'enemy',
      characteristics: { CC: cc, CT: cc, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
      wounds: { current: 20, max: 20 },
      advantage: 0,
      conditions: [],
      weapons: [{ name: 'W', type: 'melee', damage: { plusBF: false, flat: 5 }, qualities: [], ...weapon } as Weapon],
      armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
      skills: [],
      talents: [],
      movement: 4,
    }) as unknown as Combatant;

  it('Perforante ignore 1 PA (→ +1 Blessure)', () => {
    const def = fighter(30);
    def.armour.brasD = 3; // jet 44 → reverseRoll 44 → Bras droit
    const hit = (q: string[]) => {
      const atk = fighter(50, { qualities: q.map((s) => parseQualityInstance(s)!), damage: { plusBF: false, flat: 10 } });
      return resolveMelee(atk, def, atk.weapons[0], rngOf(44), { defense: 'none' });
    };
    expect(hit(['Perforante']).woundsLost! - hit([]).woundsLost!).toBe(1);
  });
  it('Pointue : +1 DR sur une touche (→ +1 Blessure)', () => {
    const def = fighter(30);
    const hit = (q: string[]) => {
      const atk = fighter(50, { qualities: q.map((s) => parseQualityInstance(s)!) });
      return resolveMelee(atk, def, atk.weapons[0], rngOf(44), { defense: 'none' });
    };
    expect(hit(['Pointue']).woundsLost! - hit([]).woundsLost!).toBe(1);
  });
  it('Empaleuse : Critique sur un multiple de 10', () => {
    const emp = fighter(60, { qualities: [{ id: 'empaleuse' }] });
    const r = resolveMelee(emp, fighter(30), emp.weapons[0], rngOf(20), { defense: 'none' });
    expect(r.hit).toBe(true);
    expect(r.critical).toBe(true);
    const plain = fighter(60);
    expect(resolveMelee(plain, fighter(30), plain.weapons[0], rngOf(20), { defense: 'none' }).critical).toBe(false);
  });
  it("Précise : +10 au Test (touche là où l'arme nue échoue, même jet)", () => {
    const def = fighter(30);
    const plain = fighter(40); // CC 40, jet 45 → échec
    const prec = fighter(40, { qualities: [{ id: 'precise' }] }); // +10 → cible 50, jet 45 → réussite
    expect(resolveMelee(plain, def, plain.weapons[0], rngOf(45), { defense: 'none' }).hit).toBe(false);
    expect(resolveMelee(prec, def, prec.weapons[0], rngOf(45), { defense: 'none' }).hit).toBe(true);
  });
});

describe('Découpe de la résolution de mêlée (split attaquant/défenseur)', () => {
  const fighter = (cc: number, weapon: Partial<Weapon> = {}): Combatant =>
    ({
      id: 'x',
      name: 'x',
      kind: 'enemy',
      characteristics: { CC: cc, CT: cc, F: 30, E: 30, I: 30, Ag: 35, Dex: 30, Int: 30, FM: 30, Soc: 30 },
      wounds: { current: 20, max: 20 },
      advantage: 0,
      conditions: [],
      weapons: [{ name: 'W', type: 'melee', damage: { plusBF: false, flat: 5 }, qualities: [], ...weapon } as Weapon],
      armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
      skills: [],
      talents: [],
      movement: 4,
    }) as unknown as Combatant;

  it('resolveMelee ≡ rollMeleeAttacker → rollMeleeDefender → finishMelee (Parade, même seed, même ordre RNG)', () => {
    const a = fighter(55);
    const d = fighter(45);
    const full = resolveMelee(a, d, a.weapons[0], makeRNG(7), { defense: 'parade' });
    const rng = makeRNG(7);
    const atk = rollMeleeAttacker(a, d, a.weapons[0], rng);
    const def = rollMeleeDefender(d, 'parade', rng);
    expect(finishMelee(a, d, a.weapons[0], atk, def, 'parade')).toEqual(full);
  });
  it('resolveMelee ≡ split (Esquive)', () => {
    const a = fighter(55);
    const d = fighter(45);
    const full = resolveMelee(a, d, a.weapons[0], makeRNG(11), { defense: 'esquive' });
    const rng = makeRNG(11);
    const atk = rollMeleeAttacker(a, d, a.weapons[0], rng);
    const def = rollMeleeDefender(d, 'esquive', rng);
    expect(finishMelee(a, d, a.weapons[0], atk, def, 'esquive')).toEqual(full);
  });
  it('le jet d’attaque est FIGÉ : même atk + def différents → même attackerRoll, defenderRoll différents', () => {
    const a = fighter(55);
    const d = fighter(45);
    const atk = rollMeleeAttacker(a, d, a.weapons[0], makeRNG(3));
    const def1 = rollMeleeDefender(d, 'parade', makeRNG(20));
    const def2 = rollMeleeDefender(d, 'parade', makeRNG(99));
    const r1 = finishMelee(a, d, a.weapons[0], atk, def1, 'parade');
    const r2 = finishMelee(a, d, a.weapons[0], atk, def2, 'parade');
    expect(r1.attackerRoll).toBe(atk.roll);
    expect(r2.attackerRoll).toBe(atk.roll); // l'attaque ne change pas quand on relance la défense
    expect(r1.defenderRoll).not.toBe(r2.defenderRoll);
  });
  it('resolveMeleePassive : un succès touche, un échec rate (Avantage au défenseur)', () => {
    const a = fighter(80);
    const d = fighter(30);
    const hit = resolveMeleePassive(a, d, a.weapons[0], { roll: 5, target: 80, success: true, sl: 7, isDouble: false });
    expect(hit.hit).toBe(true);
    const miss = resolveMeleePassive(a, d, a.weapons[0], { roll: 95, target: 80, success: false, sl: -2, isDouble: false });
    expect(miss.hit).toBe(false);
    expect(miss.advantageTo).toBe('defender');
  });
});

describe('Sur la défensive (+20 en défense, LDB Combat l.118)', () => {
  const rngOf = (roll: number): RNG => ({ int: () => roll });
  const mk = (cc: number, opts: Partial<Combatant> = {}): Combatant =>
    ({
      id: 'c',
      name: 'c',
      kind: 'enemy',
      characteristics: { CC: cc, CT: cc, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
      wounds: { current: 20, max: 20 },
      advantage: 0,
      conditions: [],
      weapons: [{ name: 'W', type: 'melee', damage: { plusBF: false, flat: 5 }, qualities: [] }],
      armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
      skills: [],
      talents: [],
      movement: 4,
      ...opts,
    }) as unknown as Combatant;
  it('un défenseur sur la défensive est plus dur à toucher (même jet)', () => {
    const atk = mk(50);
    const open = mk(30); // Parade = CC 30
    const guard = mk(30, { defensiveStance: true }); // +20 → 50
    expect(resolveMelee(atk, open, atk.weapons[0], rngOf(40), { defense: 'parade' }).hit).toBe(true);
    expect(resolveMelee(atk, guard, atk.weapons[0], rngOf(40), { defense: 'parade' }).hit).toBe(false);
  });
});

describe('États en combat (LDB ch.16)', () => {
  const mkc = (): Combatant => ({ conditions: [] } as unknown as Combatant);
  it('pénalité de combat non-cumul : la pire pénalité d’un seul État', () => {
    const c = mkc();
    addCondition(c, 'extenue', 3); // -30
    addCondition(c, 'aveugle'); // -10
    expect(combatTestPenalty(c)).toBe(-30); // pas -40 (non-cumul)
  });
  it('bonus d’attaquant : À Terre +20 prime sur Aveuglé +10', () => {
    const t = mkc();
    addCondition(t, 'a-terre');
    addCondition(t, 'aveugle');
    expect(meleeAttackerBonus(t)).toBe(20);
  });
  it('Surpris empêche de se défendre', () => {
    const t = mkc();
    addCondition(t, 'surpris');
    expect(cannotDefend(t)).toBe(true);
  });
  it('Empoisonné : endOfRound n’applique PLUS les dégâts (migrés en données — effects onRoundEnd → wounds {stacks})', () => {
    const c = { name: 'x', conditions: [], characteristics: { E: 30 }, skills: [], wounds: { current: 10, max: 10 } } as unknown as Combatant;
    addCondition(c, 'empoisonne', 2);
    endOfRound(c);
    // Dégâts de poison désormais data-driven (etats.json + fireConditionEffects, cf. state/etat-perround.test) :
    // endOfRound ne les applique plus → PB inchangés ici.
    expect(c.wounds.current).toBe(10);
  });
  it('En Flammes : endOfRound n’applique PLUS les dégâts (migrés en données — effects onRoundEnd → wounds {sum})', () => {
    const c = {
      name: 'x',
      conditions: [],
      characteristics: { E: 70 },
      armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
      wounds: { current: 20, max: 20 },
    } as unknown as Combatant;
    addCondition(c, 'en-flammes', 3);
    endOfRound(c, { int: () => 4 }); // dégâts de feu désormais data-driven (cf. state/etat-perround.test)
    expect(c.wounds.current).toBe(20); // endOfRound seul : aucun dégât de feu
  });
  it('Sonné : endOfRound NE touche plus le Sonné — Test de Résistance migré en DONNÉES (l.125-127)', () => {
    const c = {
      name: 'x',
      conditions: [],
      skills: [],
      characteristics: { E: 50 },
      armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
      wounds: { current: 10, max: 10 },
    } as unknown as Combatant;
    addCondition(c, 'sonne', 2);
    endOfRound(c, { int: () => 5 }); // la Résistance au Sonné est `effects: onRoundEnd test` (etats.json), résolue par le dispatcher
    expect(c.conditions.some((x) => x.name === 'sonne')).toBe(true);   // endOfRound ne retire aucun pion (cf. state/round-upkeep-cascade.test)
    expect(c.conditions.some((x) => x.name === 'extenue')).toBe(false);
  });
});

describe('Avantage en combat (LDB Déplacement l.37 : +10 par point)', () => {
  const rngOf = (roll: number): RNG => ({ int: () => roll });
  const mk = (cc: number, advantage = 0): Combatant => ({
    id: 'c',
    name: 'c',
    kind: 'enemy',
    characteristics: { CC: cc, CT: cc, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
    wounds: { current: 10, max: 10 },
    advantage,
    conditions: [],
    weapons: [{ name: 'Épée', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [] }],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [],
    talents: [],
    movement: 4,
  });
  it('1 Avantage (+10) fait toucher là où 0 Avantage échoue (cible nue, même jet)', () => {
    const target = mk(30);
    // CC 40, jet 45 : sans Avantage cible=40 → échec ; +1 Avantage cible=50 → réussite.
    const a0 = resolveMelee(mk(40, 0), target, mk(40).weapons[0], rngOf(45), { defense: 'none' });
    const a1 = resolveMelee(mk(40, 1), target, mk(40).weapons[0], rngOf(45), { defense: 'none' });
    expect(a0.hit).toBe(false);
    expect(a1.hit).toBe(true);
  });
});
import { createHero } from './character';
import { DIFFICULTY_MODIFIERS } from './types';
import type { ActiveEffect, Characteristics, Combatant, SkillInstance, Weapon } from './types';
import { effectiveChar } from './characteristics';
import { endOfRound } from './conditions';
import {
  castInfo,
  castingValue,
  missileDamage,
  durationClockMinutes,
  isMagicMissile,
  isArcaneSpell,
  knowsCastingSkill,
  resolveCasting,
  resolveMagicMissile,
  resolveFocus,
  castTestTalentDR,
  resolveCounterspell,
  isDispellableSpell,
  type SpellLike,
} from './magic';
import { rollMiscast } from './miscast';

describe('Tests & DR', () => {
  it('réussite si jet ≤ cible, DR = différence des dizaines', () => {
    // cible 45, jet 23 → succès, DR = 4 - 2 = 2
    const r = evaluateTest(23, 45);
    expect(r.success).toBe(true);
    expect(r.sl).toBe(2);
  });
  it('échec donne un DR négatif', () => {
    const r = evaluateTest(67, 45); // dizaines 4 - 6 = -2
    expect(r.success).toBe(false);
    expect(r.sl).toBe(-2);
  });
  it('détecte les doubles', () => {
    expect(evaluateTest(33, 50).isDouble).toBe(true);
    expect(evaluateTest(34, 50).isDouble).toBe(false);
    expect(evaluateTest(100, 50).isDouble).toBe(true);
  });
});

describe('Bonus & Blessures', () => {
  it('bonus = chiffre des dizaines', () => {
    expect(bonus(37)).toBe(3);
    expect(bonus(40)).toBe(4);
  });
  it('Blessures = BF + 2×BE + BFM', () => {
    const chars = { F: 35, E: 40, FM: 30 } as Characteristics;
    expect(maxWounds(chars)).toBe(3 + 2 * 4 + 3); // 14
  });
  it('Halfling (Petit) = 2×BE + BFM', () => {
    const chars = { F: 30, E: 40, FM: 30 } as Characteristics;
    expect(maxWounds(chars, 'petite')).toBe(2 * 4 + 3); // 11
  });
});

describe('Localisation', () => {
  it('inverse le jet du toucher', () => {
    expect(reverseRoll(23)).toBe(32);
    expect(reverseRoll(5)).toBe(50);
    expect(reverseRoll(100)).toBe(100);
  });
  it('mappe sur le Tableau de Localisation', () => {
    expect(hitLocation(5)).toBe('tete'); // 01-09
    expect(hitLocation(32)).toBe('brasD'); // 25-44
    expect(hitLocation(60)).toBe('corps'); // 45-79
    expect(hitLocation(95)).toBe('jambeD'); // 90-00
  });
});

describe('Localisation par forme du corps (LDB « Point d’Impact des Créatures » p.312)', () => {
  it('humanoïde / quadrupède / oiseau partagent le tableau humanoïde (mêmes cases)', () => {
    for (const r of [5, 18, 32, 60, 85, 95]) {
      expect(hitLocationByShape(r, 'quadrupede')).toBe(hitLocation(r));
      expect(hitLocationByShape(r, 'oiseau')).toBe(hitLocation(r));
      expect(hitLocationByShape(r)).toBe(hitLocation(r)); // défaut humanoïde
    }
  });
  it('serpent : Localisations Alternatives 01-19 Tête, 20-00 Corps', () => {
    expect(hitLocationByShape(1, 'serpent')).toBe('tete');
    expect(hitLocationByShape(19, 'serpent')).toBe('tete');
    expect(hitLocationByShape(20, 'serpent')).toBe('corps');
    expect(hitLocationByShape(100, 'serpent')).toBe('corps');
  });
  it('araignée : 01-09 Tête, 10-79 Pattes (Tableau des Jambes), 80-00 Abdomen (Tableau du Corps)', () => {
    expect(hitLocationByShape(9, 'araignee')).toBe('tete');
    expect(hitLocationByShape(10, 'araignee')).toBe('jambeD'); // Pattes → Tableau des Jambes
    expect(hitLocationByShape(79, 'araignee')).toBe('jambeD');
    expect(hitLocationByShape(80, 'araignee')).toBe('corps'); // Abdomen → Tableau du Corps
    expect(hitLocationByShape(100, 'araignee')).toBe('corps');
  });
  it('étiquettes propres à la forme (description)', () => {
    expect(locationLabel('brasD', 'quadrupede')).toBe('Membre antérieur droit');
    expect(locationLabel('jambeG', 'quadrupede')).toBe('Membre postérieur gauche');
    expect(locationLabel('brasG', 'oiseau')).toBe('Aile gauche');
    expect(locationLabel('jambeD', 'araignee')).toBe('Patte');
    expect(locationLabel('corps', 'araignee')).toBe('Abdomen');
    expect(locationLabel('tete', 'serpent')).toBe('Tête'); // inchangé
    expect(locationLabel('corps')).toBe('Corps'); // défaut humanoïde
  });
});

describe('Dégâts d’arme (parsing via effectiveWeaponDamage)', () => {
  it('+BF+4 avec BF=3 → 7', () => {
    expect(effectiveWeaponDamage({ name: 'x', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] }, 3)).toBe(7);
  });
  it('+9 (distance) ignore BF', () => {
    expect(effectiveWeaponDamage({ name: 'x', type: 'ranged', damage: { plusBF: false, flat: 9 }, qualities: [] }, 3)).toBe(9);
  });
});

function dummy(name: string, chars: Partial<Characteristics>, wounds: number, weapon: Weapon): Combatant {
  const base: Characteristics = { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 };
  return {
    id: name,
    name,
    kind: 'enemy',
    characteristics: { ...base, ...chars },
    wounds: { current: wounds, max: wounds },
    advantage: 0,
    conditions: [],
    weapons: [weapon],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [],
    talents: [],
    movement: 4,
  };
}

describe('Résolution de mêlée', () => {
  it('produit un résultat cohérent et déterministe avec une graine', () => {
    const rng = makeRNG(42);
    const sword: Weapon = { name: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] };
    const a = dummy('Attaquant', { CC: 60, F: 40 }, 15, sword);
    const d = dummy('Défenseur', { CC: 25, E: 30 }, 12, sword);
    const res = resolveMelee(a, d, sword, rng);
    expect(typeof res.hit).toBe('boolean');
    if (res.hit) {
      expect(res.woundsLost).toBeGreaterThanOrEqual(1);
      expect(res.location).toBeDefined();
    }
  });
});

// --- Corrections issues de l'audit de fidélité ---------------------------
describe('Difficulté (canon : Accessible/Complexe/Difficile)', () => {
  it('table conforme au Livre de base', () => {
    expect(DIFFICULTY_MODIFIERS.accessible).toBe(20);
    expect(DIFFICULTY_MODIFIERS.complexe).toBe(-10);
    expect(DIFFICULTY_MODIFIERS.difficile).toBe(-20); // pas -10
    const keys = Object.keys(DIFFICULTY_MODIFIERS);
    expect(keys).not.toContain('moyen');
    expect(keys).not.toContain('epique');
  });
});

describe('Test opposé (départage canon)', () => {
  it('égalité de DR : la valeur cible la plus haute l’emporte (sans priorité attaquant)', () => {
    const att = evaluateTest(13, 45); // sl = 4 - 1 = 3, cible 45
    const def = evaluateTest(23, 55); // sl = 5 - 2 = 3, cible 55 > 45
    const r = resolveOpposed(att, def);
    expect(att.sl).toBe(def.sl);
    expect(r.winner).toBe('defender'); // cible 55 > 45 l'emporte
  });
  it('DR ET valeur cible égaux → statu quo (tie), aucun vainqueur', () => {
    const att = evaluateTest(23, 45); // sl 2, cible 45
    const def = evaluateTest(21, 45); // sl 2, cible 45
    const r = resolveOpposed(att, def);
    expect(r.winner).toBe('tie');
    expect(r.attackerWins).toBe(false);
  });
});

describe('Coup Critique au niveau moteur (LDB 18-Traumatisme : double uniquement)', () => {
  it('le moteur ne marque le critique que sur un double — l’OVERKILL est posé par le store (sur PB courants)', () => {
    const heavy: Weapon = { name: 'Maillet', type: 'melee', damage: { plusBF: true, flat: 20 }, qualities: [] };
    const a = dummy('Brute', { CC: 90, F: 40 }, 20, heavy);
    const d = dummy('Frêle', { CC: 20, E: 20 }, 3, heavy); // Blessures max 3
    const res = resolveMelee(a, d, heavy, makeRNG(1), { defense: 'none' });
    expect(res.hit).toBe(true);
    expect(res.woundsLost!).toBeGreaterThan(d.wounds.max); // gros coup → overkill géré par le STORE, plus par applyHit
    // `critical` du moteur = uniquement un double réussi (l'arme n'a pas l'Atout Empaleuse).
    expect(res.critical).toBe(res.attackerRoll % 11 === 0 || res.attackerRoll === 100);
  });
});

// --- Magie -----------------------------------------------------------------
function caster(chars: Partial<Characteristics>, skills: SkillInstance[] = [], wounds = 12): Combatant {
  const base: Characteristics = { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 };
  return {
    id: 'c',
    name: 'Mage',
    kind: 'hero',
    characteristics: { ...base, ...chars },
    wounds: { current: wounds, max: wounds },
    advantage: 0,
    conditions: [],
    weapons: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills,
    talents: [],
    movement: 4,
  };
}

const FLECHETTE: SpellLike = { label: 'Fléchette', type: 'Magie mineure', family: 'mineure', missile: true, damage: 0, cn: 0, duration: { kind: 'instant' }, desc: 'Il s’agit d’un Projectile magique avec Dégât +0.' };
const PRIERE: SpellLike = { label: 'Bénédiction de Bataille', type: 'Béni', family: 'beni', isPrayer: true, cn: null, duration: { kind: 'rounds', value: 6 }, desc: 'Votre cible gagne +10 en Capacité de Combat.' };
const ARCANE: SpellLike = { label: 'Boule de feu', type: 'Magie des Arcanes', family: 'arcane', cn: 8, duration: { kind: 'instant' }, desc: 'Projectile magique avec Dégâts +8.' };

describe('Magie — routage du test par branche', () => {
  it('les Prières (Béni/Invocation) utilisent Prière (Soc), sans NI', () => {
    const info = castInfo(PRIERE);
    expect(info.skill).toBe('priere');
    expect(info.requireNI).toBe(false);
  });
  it('les Sorts utilisent Langue (Magick) (Int), avec NI', () => {
    const info = castInfo(ARCANE);
    expect(info.skill).toBe('langue');
    expect(info.spec).toBe('Magick');
    expect(info.requireNI).toBe(true);
  });
  it('isArcaneSpell distingue Arcane/Domaine de la Magie mineure et des Prières', () => {
    expect(isArcaneSpell(ARCANE)).toBe(true);
    expect(isArcaneSpell(FLECHETTE)).toBe(false);
    expect(isArcaneSpell(PRIERE)).toBe(false);
  });
});

describe('Magie — analyse des descriptions', () => {
  it('missileDamage lit les champs de données (Dégâts / ignore PA / ignore BE)', () => {
    const sp = (o: Partial<SpellLike>): SpellLike => ({ label: 'X', type: 'T', cn: 0, desc: '', ...o });
    expect(missileDamage(sp({ missile: true, damage: 8 }))).toEqual({ damage: 8, ignorePA: false, ignoreBE: false });
    expect(missileDamage(sp({ missile: true, damage: 0, ignorePA: true }))).toEqual({ damage: 0, ignorePA: true, ignoreBE: false });
    expect(missileDamage(sp({ missile: true, damage: 10, ignorePA: true, ignoreBE: true }))).toEqual({ damage: 10, ignorePA: true, ignoreBE: true });
    expect(missileDamage(sp({ missile: false }))).toBeNull();
  });
  it('isMagicMissile détecte les Projectiles magiques', () => {
    expect(isMagicMissile(FLECHETTE)).toBe(true);
    expect(isMagicMissile(PRIERE)).toBe(false);
  });
  // (parseDurationRounds/buffDurationRounds supprimés : la durée Rounds vient de la donnée structurée
  //  `SpellDuration`, dont le parser est testé dans spellDuration.test.ts.)
});

describe('Magie — valeur d’incantation', () => {
  it('Langue (Magick) = Int + avances', () => {
    const c = caster({ Int: 40 }, [{ skillId: 'langue', spec: 'Magick', characteristic: 'Int', advances: 15 }]);
    expect(castingValue(c, 'langue', 'Magick')).toBe(55);
  });
  it('Prière = Soc + avances', () => {
    const c = caster({ Soc: 35 }, [{ skillId: 'priere', characteristic: 'Soc', advances: 10 }]);
    expect(castingValue(c, 'priere')).toBe(45);
  });
  it('sans la compétence, la Caractéristique seule est utilisée', () => {
    const c = caster({ Int: 33 });
    expect(castingValue(c, 'langue', 'Magick')).toBe(33);
  });
});

describe('Magie — résolution de l’incantation', () => {
  it('un Sort réussi mais avec DR < NI n’est pas lancé', () => {
    // Valeur 95 → réussite quasi certaine, mais DR max ~9 < NI 20.
    const c = caster({ Int: 95 }, [{ skillId: 'langue', spec: 'Magick', characteristic: 'Int', advances: 1 }]);
    const spell: SpellLike = { ...ARCANE, cn: 20 };
    const res = resolveCasting(c, spell, makeRNG(3));
    expect(res.cast).toBe(false);
  });
  it('cohérence : lancé ⇔ réussite et DR ≥ NI', () => {
    const c = caster({ Int: 60 }, [{ skillId: 'langue', spec: 'Magick', characteristic: 'Int', advances: 1 }]);
    for (let seed = 0; seed < 20; seed++) {
      const res = resolveCasting(c, FLECHETTE, makeRNG(seed));
      const success = res.roll <= res.target;
      expect(res.cast).toBe(success && res.sl >= 0);
    }
  });
  it('une Prière réussie est lancée sans seuil de NI', () => {
    const c = caster({ Soc: 99 }, [{ skillId: 'priere', characteristic: 'Soc', advances: 1 }]);
    const res = resolveCasting(c, PRIERE, makeRNG(2));
    expect(res.cast).toBe(res.roll <= res.target);
  });
});

describe('Magie — Projectile magique', () => {
  it('Dégâts = Dégâts du sort + DR + BFM, Localisation = jet inversé', () => {
    const c = caster({ Int: 80, FM: 40 }, [{ skillId: 'langue', spec: 'Magick', characteristic: 'Int', advances: 1 }]);
    const target = caster({ E: 30 }, [], 15);
    const spell: SpellLike = { ...FLECHETTE, damage: 4 };
    const res = resolveMagicMissile(c, target, spell, makeRNG(5));
    if (res.hit) {
      expect(res.location).toBe(hitLocation(reverseRoll(res.roll)));
      expect(res.damage).toBe(4 + Math.max(0, res.sl) + 4); // +4 sort, DR, BFM 4
      expect(res.woundsLost).toBe(Math.max(1, res.damage! - 3)); // BE 3, PA 0
    }
  });
});

describe('Magie — Focalisation', () => {
  it('cumule un DR positif sur réussite', () => {
    const c = caster({ FM: 90 }, [{ skillId: 'focalisation', spec: 'Aqshy', characteristic: 'FM', advances: 1 }]);
    const res = resolveFocus(c, ARCANE, makeRNG(4));
    expect(res.dr).toBeGreaterThanOrEqual(0);
    if (res.roll <= 90) expect(res.dr).toBe(Math.max(0, Math.floor(90 / 10) - Math.floor(res.roll / 10)));
  });
});

describe('Magie — effets actifs (buffs temporisés)', () => {
  it('effectiveChar applique le meilleur bonus, sans cumul', () => {
    const c = caster({ CC: 35 });
    c.activeEffects = [
      { label: 'A', char: 'CC', bonus: 10, duration: { scale: 'rounds', left: 6 } },
      { label: 'B', char: 'CC', bonus: 20, duration: { scale: 'rounds', left: 6 } },
    ];
    expect(effectiveChar(c, 'CC')).toBe(55); // 35 + max(10,20)
  });
  it('endOfRound décrémente et dissipe les effets expirés', () => {
    const c = caster({ CC: 35 });
    const eff: ActiveEffect = { label: 'Bénédiction de Bataille', char: 'CC', bonus: 10, duration: { scale: 'rounds', left: 1 } };
    c.activeEffects = [eff];
    endOfRound(c);
    expect(c.activeEffects.length).toBe(0);
    expect(effectiveChar(c, 'CC')).toBe(35);
  });
  // Pénalités (omission-majeure corrigée) : meilleur bonus + pire pénalité, sommés.
  it('effectiveChar applique le meilleur bonus ET la pire pénalité (l.168)', () => {
    const c = caster({ Ag: 40 });
    c.activeEffects = [
      { label: 'buff', char: 'Ag', bonus: 10, duration: { scale: 'rounds', left: 6 } },
      { label: 'autre buff', char: 'Ag', bonus: 20, duration: { scale: 'rounds', left: 6 } },
      { label: 'Écorce', char: 'Ag', bonus: -10, duration: { scale: 'rounds', left: 6 } },
    ];
    expect(effectiveChar(c, 'Ag')).toBe(50); // 40 + max(10,20) + min(-10) = 40+20-10
  });
  it('effectiveChar garde la pénalité la PIRE entre deux malus', () => {
    const c = caster({ Dex: 45 });
    c.activeEffects = [
      { label: 'a', char: 'Dex', bonus: -10, duration: { scale: 'rounds', left: 6 } },
      { label: 'b', char: 'Dex', bonus: -20, duration: { scale: 'rounds', left: 6 } },
    ];
    expect(effectiveChar(c, 'Dex')).toBe(25); // 45 + 0 - 20
  });
});

describe('Magie — correctifs de fidélité (audit)', () => {
  // B1 — Projectile ignorant le Bonus d'Endurance : le BE n'est pas déduit.
  it('B1 : un Projectile « ignore le Bonus d’Endurance » ne déduit pas le BE', () => {
    const c = caster({ Int: 80, FM: 30 }, [{ skillId: 'langue', spec: 'Magick', characteristic: 'Int', advances: 1 }]);
    const target = caster({ E: 39 }, [], 20); // BE 3
    const spell: SpellLike = {
      label: 'Vortex d’âmes',
      type: 'Magie des Arcanes',
      cn: 0,
      duration: { kind: 'instant' },
      missile: true,
      damage: 10,
      ignorePA: true,
      ignoreBE: true,
      desc: 'Projectile magique avec Dégâts +10 qui ignore le Bonus d’Endurance et les PA.',
    };
    const res = resolveMagicMissile(c, target, spell, makeRNG(5));
    if (res.hit) {
      // mitigation BE+PA = 0 → toutes les Blessures passent.
      expect(res.woundsLost).toBe(res.damage);
    }
  });

  // A4 (cascade #T3) — durées d'HORLOGE (LDB 47) : minutes/heures/jours/« lever du soleil », depuis la
  // durée STRUCTURÉE. (L'échelle Rounds est portée par `{kind:'rounds'}`, hors de durationClockMinutes.)
  it('durationClockMinutes : clock littéral/(Bonus de X)/(X), untilDawn ; null hors-horloge', () => {
    const c = caster({ FM: 45, Int: 38 }); // BFM 4 ; Int 38
    expect(durationClockMinutes({ kind: 'clock', value: 1, unit: 'hours' }, c, 0)).toBe(60);
    expect(durationClockMinutes({ kind: 'clock', value: { bonusOf: 'FM' }, unit: 'days' }, c, 0)).toBe(4 * 24 * 60);
    expect(durationClockMinutes({ kind: 'clock', value: { bonusOf: 'FM' }, unit: 'minutes' }, c, 0)).toBe(4);
    expect(durationClockMinutes({ kind: 'clock', value: { charOf: 'Int' }, unit: 'minutes' }, c, 0)).toBe(38); // carac PLEINE
    // « Jusqu'au lever du soleil » : prochaine aube (05:00) ; à l'aube pile → un cycle entier.
    expect(durationClockMinutes({ kind: 'untilDawn' }, c, 0)).toBe(5 * 60);
    expect(durationClockMinutes({ kind: 'untilDawn' }, c, 5 * 60)).toBe(24 * 60);
    // Hors-horloge : Rounds (échelle tactique), Instantané, Spécial → null (rien d'inventé).
    expect(durationClockMinutes({ kind: 'rounds', value: 6 }, c, 0)).toBeNull();
    expect(durationClockMinutes({ kind: 'instant' }, c, 0)).toBeNull();
    expect(durationClockMinutes({ kind: 'special', text: 'Spécial' }, c, 0)).toBeNull();
  });
});

describe('Magie — compétences Avancées (gating)', () => {
  it('knowsCastingSkill exige au moins 1 augmentation', () => {
    const sansSkill = caster({ Int: 80 });
    const zero = caster({ Int: 80 }, [{ skillId: 'langue', spec: 'Magick', characteristic: 'Int', advances: 0 }]);
    const ok = caster({ Int: 80 }, [{ skillId: 'langue', spec: 'Magick', characteristic: 'Int', advances: 1 }]);
    expect(knowsCastingSkill(sansSkill, 'langue', 'Magick')).toBe(false);
    expect(knowsCastingSkill(zero, 'langue', 'Magick')).toBe(false);
    expect(knowsCastingSkill(ok, 'langue', 'Magick')).toBe(true);
  });
  it('un Sort est refusé sans la compétence Avancée (pas de repli sur la Caractéristique)', () => {
    const c = caster({ Int: 95 }); // aucune compétence Langue
    const res = resolveCasting(c, FLECHETTE, makeRNG(1));
    expect(res.cast).toBe(false);
    expect(res.log).toContain('ne maîtrise pas');
  });
  it('Talents liés au Test (LDB 10 l.20) : +1 DR par acquisition sur Test d’incantation RÉUSSI (Diction instinctive)', () => {
    const skills = [{ skillId: 'langue', spec: 'Magick', characteristic: 'Int' as const, advances: 10 }];
    const sans = caster({ Int: 80 }, skills);
    const avec = caster({ Int: 80 }, skills);
    avec.talents = [{ talentId: 'diction-instinctive', times: 2 }];
    expect(castTestTalentDR(avec, 'Langue (Magick)')).toBe(2);
    expect(castTestTalentDR(sans, 'Langue (Magick)')).toBe(0);
    // même graine = même d100 : sur un jet RÉUSSI, le DR final diffère exactement du niveau du Talent
    for (let seed = 1; seed <= 6; seed++) {
      const a = resolveCasting(sans, FLECHETTE, makeRNG(seed));
      const b = resolveCasting(avec, FLECHETTE, makeRNG(seed));
      expect(b.sl).toBe(a.sl + (a.roll <= a.target ? 2 : 0));
    }
  });

  it('un Talent lié à une AUTRE Langue ne booste pas l’incantation (Langue (Magick) exigé)', () => {
    const c = caster({ Int: 80 });
    c.talents = [{ talentId: 'linguistique', times: 3 }]; // test data : « Langue (Toutes) » ? — ne doit pas matcher Magick
    expect(castTestTalentDR(c, 'Langue (Magick)')).toBe(0);
  });

  it('Harmonisation aethyrique ×N : +N DR aux Tests de Focalisation réussis (LDB 10 l.20)', () => {
    const skills = [{ skillId: 'focalisation', spec: 'Aqshy', characteristic: 'FM' as const, advances: 5 }];
    const sans = caster({ FM: 85 }, skills);
    const avec = caster({ FM: 85 }, skills);
    avec.talents = [{ talentId: 'harmonisation-aethyrique', times: 3 }];
    for (let seed = 1; seed <= 6; seed++) {
      const a = resolveFocus(sans, ARCANE, makeRNG(seed));
      const b = resolveFocus(avec, ARCANE, makeRNG(seed));
      if (a.roll <= (a.target ?? 0)) expect(b.dr).toBe(a.dr + 3);
      else expect(b.dr).toBe(a.dr); // échec : pas de bonus (« utilisation réussie »)
    }
  });

  it('Dissipation (LDB 46 l.201-202) : Test opposé — gagné → dissipé ; perdu → le Sort garde le DR NET', () => {
    const langue = (adv: number) => [{ skillId: 'langue', spec: 'Magick', characteristic: 'Int' as const, advances: adv }];
    // contre-lanceur écrasant (valeur 99 clampée) vs jet d'incantation médiocre figé (DR 1)
    const fort = caster({ Int: 89 }, langue(10));
    const castT = { roll: 40, target: 50, success: true, sl: 1, isDouble: false };
    let dispelCount = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const out = resolveCounterspell(fort, castT, makeRNG(seed));
      expect(out.casterNetSL).toBe(castT.sl - out.counter.sl); // « le DR du Test opposé »
      if (out.dispelled) {
        dispelCount++;
        expect(out.counter.sl).toBeGreaterThan(castT.sl); // gagné = DR strictement supérieur (ou cible sup. à égalité)
      }
    }
    expect(dispelCount).toBeGreaterThan(6); // valeur 99 vs DR 1 : la dissipation domine
    // contre-lanceur nul : jamais dissipé sur un DR adverse élevé
    const nul = caster({ Int: 10 }, langue(0));
    const fortCast = { roll: 11, target: 95, success: true, sl: 8, isDouble: false };
    for (let seed = 1; seed <= 8; seed++) expect(resolveCounterspell(nul, fortCast, makeRNG(seed)).dispelled).toBe(false);
  });

  it('Dissipation : seul un SORT se dissipe — pas une Prière (LDB 46 « Si un Sort vous cible »)', () => {
    expect(isDispellableSpell(FLECHETTE)).toBe(true);
    expect(isDispellableSpell({ label: 'Bénédiction', type: 'Béni', isPrayer: true, cn: null, duration: null, desc: '' })).toBe(false);
  });

  it('le Trait « Lanceur de Sorts » (LDB 85 : « La créature peut lancer des Sorts ») dispense de la Compétence', () => {
    const c = caster({ Int: 95 }); // statbloc de bestiaire : aucune Compétence
    c.traits = [{ id: 'lanceur-de-sorts', arg: 'Sorcellerie' }];
    expect(knowsCastingSkill(c, 'langue', 'Magick')).toBe(true);
    const res = resolveCasting(c, FLECHETTE, makeRNG(1));
    expect(res.log).not.toContain('ne maîtrise pas'); // le Test se fait sur Int seule
  });
});

describe('Magie — Incantations Imparfaites & Colère des dieux', () => {
  it('chaque jet d’une table tombe sur une entrée nommée', () => {
    for (const sev of ['mineure', 'majeure', 'colere'] as const) {
      for (let seed = 0; seed < 30; seed++) {
        const r = rollMiscast(sev, makeRNG(seed));
        expect(r.name.length).toBeGreaterThan(0);
        expect(r.log).toContain(sev === 'colere' ? 'Colère des dieux' : 'Incantation Imparfaite');
      }
    }
  });
  it('les effets mécaniques (États / Blessures) sont structurés en GameOps', () => {
    // Balaye assez de graines pour observer au moins une entrée à effet.
    let sawCondition = false;
    let sawWounds = false;
    for (let seed = 0; seed < 200 && !(sawCondition && sawWounds); seed++) {
      const r = rollMiscast('majeure', makeRNG(seed));
      for (const op of r.ops) {
        if (op.op === 'condition') sawCondition = true;
        if (op.op === 'wounds') sawWounds = true;
      }
    }
    expect(sawCondition).toBe(true);
    expect(sawWounds).toBe(true);
  });
  it('la Colère ajoute +10 par Point de Péché au jet', () => {
    // Avec assez de Péché, on peut atteindre les entrées >100 (Châtiment → reduceToZero).
    let sawReduce = false;
    for (let seed = 0; seed < 50 && !sawReduce; seed++) {
      const r = rollMiscast('colere', makeRNG(seed), 10); // +100 → jet 101-200
      if (r.ops.some((o) => o.op === 'reduceToZero')) sawReduce = true;
    }
    expect(sawReduce).toBe(true);
  });
});

describe('Création de héros', () => {
  it('génère un personnage jouable et reproductible', () => {
    const hero = createHero({
      speciesId: 'humains-reiklander',
      careerId: 'agitateur',
      name: 'Test',
      rng: makeRNG(7),
    });
    expect(hero.kind).toBe('hero');
    expect(hero.skills.length).toBeGreaterThan(0);
    expect(hero.wounds.max).toBeGreaterThan(0);
    expect(hero.movement).toBe(4);
    // 40 augmentations de carrière (+5 × 8) + 24 d'espèce (3×+5 + 3×+3, LDB l.510)
    const totalAdv = hero.skills.reduce((s, sk) => s + sk.advances, 0);
    expect(totalAdv).toBe(64);
  });
});

import { describe, it, expect } from 'vitest';
import { makeRNG, RNG } from './dice';
import { Combatant } from './types';
import { evaluateTest, resolveOpposed } from './tests';
import { bonus, maxWounds } from './characteristics';
import { reverseRoll, hitLocation, parseWeaponDamage, resolveMelee } from './combat';

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
    weapons: [{ name: 'Épée', type: 'melee', damage: '+BF', qualities: [] }],
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
  parseSpellDamage,
  parseDurationRounds,
  parseHeal,
  parseConditionEffect,
  parseCharBuffs,
  buffDurationRounds,
  isMagicMissile,
  isArcaneSpell,
  knowsCastingSkill,
  resolveCasting,
  resolveMagicMissile,
  resolveFocus,
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
    expect(maxWounds(chars, true)).toBe(2 * 4 + 3); // 11
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

describe('Dégâts d’arme', () => {
  it('+BF+4 avec BF=3 → 7', () => {
    expect(parseWeaponDamage('+BF+4', 3)).toBe(7);
  });
  it('+9 (distance) ignore BF', () => {
    expect(parseWeaponDamage('+9', 3)).toBe(9);
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
    const sword: Weapon = { name: 'Épée', type: 'melee', damage: '+BF+4', qualities: [] };
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

describe('Blessure critique (dégâts > Blessures max)', () => {
  it('un coup dépassant les Blessures totales déclenche un Critique', () => {
    const heavy: Weapon = { name: 'Maillet', type: 'melee', damage: '+BF+20', qualities: [] };
    const a = dummy('Brute', { CC: 90, F: 40 }, 20, heavy);
    const d = dummy('Frêle', { CC: 20, E: 20 }, 3, heavy); // Blessures max 3
    const res = resolveMelee(a, d, heavy, makeRNG(1), { defense: 'none' });
    expect(res.hit).toBe(true);
    expect(res.woundsLost!).toBeGreaterThan(d.wounds.max);
    expect(res.critical).toBe(true);
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

const FLECHETTE: SpellLike = { label: 'Fléchette', type: 'Magie mineure', cn: 0, duration: 'Instantanée', desc: 'Il s’agit d’un Projectile magique avec Dégât +0.' };
const PRIERE: SpellLike = { label: 'Bénédiction de Bataille', type: 'Béni', cn: null, duration: '6 rounds', desc: 'Votre cible gagne +10 en Capacité de Combat.' };
const ARCANE: SpellLike = { label: 'Boule de feu', type: 'Magie des Arcanes', cn: 8, duration: 'Instantanée', desc: 'Projectile magique avec Dégâts +8.' };

describe('Magie — routage du test par branche', () => {
  it('les Prières (Béni/Invocation) utilisent Prière (Soc), sans NI', () => {
    const info = castInfo(PRIERE);
    expect(info.skill).toBe('Prière');
    expect(info.requireNI).toBe(false);
  });
  it('les Sorts utilisent Langue (Magick) (Int), avec NI', () => {
    const info = castInfo(ARCANE);
    expect(info.skill).toBe('Langue');
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
  it('parseSpellDamage lit « Dégâts +N » et les flags ignore PA / Bonus d’Endurance', () => {
    expect(parseSpellDamage('Projectile magique avec Dégâts +8.')).toEqual({ damage: 8, ignorePA: false, ignoreBE: false });
    expect(parseSpellDamage('Dégât +0 qui ignore les PA.')).toEqual({ damage: 0, ignorePA: true, ignoreBE: false });
    // B1 : Vortex d’âmes / drain de Shyish — ignore le Bonus d’Endurance ET les PA.
    expect(parseSpellDamage('Projectile magique avec Dégâts +10 qui ignore le Bonus d’Endurance et les PA.')).toEqual({
      damage: 10,
      ignorePA: true,
      ignoreBE: true,
    });
    expect(parseSpellDamage('Votre cible gagne +10 en Agilité.')).toBeNull();
  });
  it('isMagicMissile détecte les Projectiles magiques', () => {
    expect(isMagicMissile(FLECHETTE)).toBe(true);
    expect(isMagicMissile(PRIERE)).toBe(false);
  });
  it('parseDurationRounds lit « N rounds »', () => {
    expect(parseDurationRounds('6 rounds')).toBe(6);
    expect(parseDurationRounds('Instantanée')).toBeNull();
  });
});

describe('Magie — valeur d’incantation', () => {
  it('Langue (Magick) = Int + avances', () => {
    const c = caster({ Int: 40 }, [{ name: 'Langue', spec: 'Magick', characteristic: 'Int', advances: 15 }]);
    expect(castingValue(c, 'Langue', 'Magick')).toBe(55);
  });
  it('Prière = Soc + avances', () => {
    const c = caster({ Soc: 35 }, [{ name: 'Prière', characteristic: 'Soc', advances: 10 }]);
    expect(castingValue(c, 'Prière')).toBe(45);
  });
  it('sans la compétence, la Caractéristique seule est utilisée', () => {
    const c = caster({ Int: 33 });
    expect(castingValue(c, 'Langue', 'Magick')).toBe(33);
  });
});

describe('Magie — résolution de l’incantation', () => {
  it('un Sort réussi mais avec DR < NI n’est pas lancé', () => {
    // Valeur 95 → réussite quasi certaine, mais DR max ~9 < NI 20.
    const c = caster({ Int: 95 }, [{ name: 'Langue', spec: 'Magick', characteristic: 'Int', advances: 1 }]);
    const spell: SpellLike = { ...ARCANE, cn: 20 };
    const res = resolveCasting(c, spell, makeRNG(3));
    expect(res.cast).toBe(false);
  });
  it('cohérence : lancé ⇔ réussite et DR ≥ NI', () => {
    const c = caster({ Int: 60 }, [{ name: 'Langue', spec: 'Magick', characteristic: 'Int', advances: 1 }]);
    for (let seed = 0; seed < 20; seed++) {
      const res = resolveCasting(c, FLECHETTE, makeRNG(seed));
      const success = res.roll <= res.target;
      expect(res.cast).toBe(success && res.sl >= 0);
    }
  });
  it('une Prière réussie est lancée sans seuil de NI', () => {
    const c = caster({ Soc: 99 }, [{ name: 'Prière', characteristic: 'Soc', advances: 1 }]);
    const res = resolveCasting(c, PRIERE, makeRNG(2));
    expect(res.cast).toBe(res.roll <= res.target);
  });
});

describe('Magie — Projectile magique', () => {
  it('Dégâts = Dégâts du sort + DR + BFM, Localisation = jet inversé', () => {
    const c = caster({ Int: 80, FM: 40 }, [{ name: 'Langue', spec: 'Magick', characteristic: 'Int', advances: 1 }]);
    const target = caster({ E: 30 }, [], 15);
    const spell: SpellLike = { ...FLECHETTE, desc: 'Projectile magique avec Dégâts +4.' };
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
    const c = caster({ FM: 90 }, [{ name: 'Focalisation', spec: 'Aqshy', characteristic: 'FM', advances: 1 }]);
    const res = resolveFocus(c, ARCANE, makeRNG(4));
    expect(res.dr).toBeGreaterThanOrEqual(0);
    if (res.roll <= 90) expect(res.dr).toBe(Math.max(0, Math.floor(90 / 10) - Math.floor(res.roll / 10)));
  });
});

describe('Magie — effets actifs (buffs temporisés)', () => {
  it('effectiveChar applique le meilleur bonus, sans cumul', () => {
    const c = caster({ CC: 35 });
    c.activeEffects = [
      { label: 'A', char: 'CC', bonus: 10, roundsLeft: 6 },
      { label: 'B', char: 'CC', bonus: 20, roundsLeft: 6 },
    ];
    expect(effectiveChar(c, 'CC')).toBe(55); // 35 + max(10,20)
  });
  it('endOfRound décrémente et dissipe les effets expirés', () => {
    const c = caster({ CC: 35 });
    const eff: ActiveEffect = { label: 'Bénédiction de Bataille', char: 'CC', bonus: 10, roundsLeft: 1 };
    c.activeEffects = [eff];
    endOfRound(c);
    expect(c.activeEffects.length).toBe(0);
    expect(effectiveChar(c, 'CC')).toBe(35);
  });
  // Pénalités (omission-majeure corrigée) : meilleur bonus + pire pénalité, sommés.
  it('effectiveChar applique le meilleur bonus ET la pire pénalité (l.168)', () => {
    const c = caster({ Ag: 40 });
    c.activeEffects = [
      { label: 'buff', char: 'Ag', bonus: 10, roundsLeft: 6 },
      { label: 'autre buff', char: 'Ag', bonus: 20, roundsLeft: 6 },
      { label: 'Écorce', char: 'Ag', bonus: -10, roundsLeft: 6 },
    ];
    expect(effectiveChar(c, 'Ag')).toBe(50); // 40 + max(10,20) + min(-10) = 40+20-10
  });
  it('effectiveChar garde la pénalité la PIRE entre deux malus', () => {
    const c = caster({ Dex: 45 });
    c.activeEffects = [
      { label: 'a', char: 'Dex', bonus: -10, roundsLeft: 6 },
      { label: 'b', char: 'Dex', bonus: -20, roundsLeft: 6 },
    ];
    expect(effectiveChar(c, 'Dex')).toBe(25); // 45 + 0 - 20
  });
});

describe('Magie — parseCharBuffs (bonus/pénalités de caractéristique)', () => {
  it('lit un bonus simple « +N en X »', () => {
    expect(parseCharBuffs('Votre cible gagne +10 en Capacité de Combat.')).toEqual([{ char: 'CC', bonus: 10 }]);
  });
  it('lit une pénalité multi-caractéristiques « -N en X et Y » (Écorce)', () => {
    expect(parseCharBuffs('La cible subit -10 en Agilité et Dextérité.')).toEqual([
      { char: 'Ag', bonus: -10 },
      { char: 'Dex', bonus: -10 },
    ]);
  });
  it('ne confond pas « Force » et « Force Mentale »', () => {
    expect(parseCharBuffs('Vous gagnez +20 en Force Mentale.')).toEqual([{ char: 'FM', bonus: 20 }]);
    expect(parseCharBuffs('Vous gagnez +5 en Force.')).toEqual([{ char: 'F', bonus: 5 }]);
  });
});

describe('Magie — correctifs de fidélité (audit)', () => {
  // B1 — Projectile ignorant le Bonus d'Endurance : le BE n'est pas déduit.
  it('B1 : un Projectile « ignore le Bonus d’Endurance » ne déduit pas le BE', () => {
    const c = caster({ Int: 80, FM: 30 }, [{ name: 'Langue', spec: 'Magick', characteristic: 'Int', advances: 1 }]);
    const target = caster({ E: 39 }, [], 20); // BE 3
    const spell: SpellLike = {
      label: 'Vortex d’âmes',
      type: 'Magie des Arcanes',
      cn: 0,
      duration: 'Instantanée',
      desc: 'Projectile magique avec Dégâts +10 qui ignore le Bonus d’Endurance et les PA.',
    };
    const res = resolveMagicMissile(c, target, spell, makeRNG(5));
    if (res.hit) {
      // mitigation BE+PA = 0 → toutes les Blessures passent.
      expect(res.woundsLost).toBe(res.damage);
    }
  });

  // B2 — soin paramétré « (Bonus de Sociabilité) Blessures » (Caresse de Rhya).
  it('B2 : parseHeal lit le soin littéral ET « (Bonus de X) Blessures »', () => {
    const pretre = caster({ Soc: 45 }); // BSoc 4
    expect(parseHeal('Guérir 1d10... non. Guérir 3 Points de Blessure.', pretre)).toBe(3);
    expect(parseHeal('Choisissez : Guérir (Bonus de Sociabilité) Blessures.', pretre)).toBe(4);
    expect(parseHeal('Votre cible gagne +10 en Capacité de Combat.', pretre)).toBeNull();
  });

  // B3 — distinction retrait/ajout d'État ; « retirer 1 Etat » (sans accent ni nom).
  it('B3 : parseConditionEffect distingue retrait et ajout d’État', () => {
    expect(parseConditionEffect('Votre cible peut retirer 1 Etat.')).toEqual({ op: 'remove', name: undefined, value: 1 });
    expect(parseConditionEffect('La cible reçoit 1 État Sonné.')).toEqual({ op: 'add', name: 'Sonné', value: 1 });
    expect(parseConditionEffect('Le porteur perd 2 États Aveuglé.')).toEqual({ op: 'remove', name: 'Aveuglé', value: 2 });
    expect(parseConditionEffect('Votre cible gagne +10 en Agilité.')).toBeNull();
  });

  // I1 — pas d'invention d'1 round ; résolution des durées-formule « (Bonus de X) Rounds ».
  it('I1 : buffDurationRounds résout littéral et formule, null hors-rounds', () => {
    const c = caster({ FM: 45, Ag: 39 }); // BFM 4, BAg 3
    expect(buffDurationRounds('6 rounds', c)).toBe(6);
    expect(buffDurationRounds('(Bonus de Force Mentale) Rounds', c)).toBe(4);
    expect(buffDurationRounds('(Bonus d’Agilité) Rounds', c)).toBe(3);
    expect(buffDurationRounds('1 minute', c)).toBeNull(); // hors-rounds : pas de défaut inventé
    expect(buffDurationRounds(undefined, c)).toBeNull();
  });
});

describe('Magie — compétences Avancées (gating)', () => {
  it('knowsCastingSkill exige au moins 1 augmentation', () => {
    const sansSkill = caster({ Int: 80 });
    const zero = caster({ Int: 80 }, [{ name: 'Langue', spec: 'Magick', characteristic: 'Int', advances: 0 }]);
    const ok = caster({ Int: 80 }, [{ name: 'Langue', spec: 'Magick', characteristic: 'Int', advances: 1 }]);
    expect(knowsCastingSkill(sansSkill, 'Langue', 'Magick')).toBe(false);
    expect(knowsCastingSkill(zero, 'Langue', 'Magick')).toBe(false);
    expect(knowsCastingSkill(ok, 'Langue', 'Magick')).toBe(true);
  });
  it('un Sort est refusé sans la compétence Avancée (pas de repli sur la Caractéristique)', () => {
    const c = caster({ Int: 95 }); // aucune compétence Langue
    const res = resolveCasting(c, FLECHETTE, makeRNG(1));
    expect(res.cast).toBe(false);
    expect(res.log).toContain('ne maîtrise pas');
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
  it('les effets mécaniques (États / Blessures) sont structurés', () => {
    // Balaye assez de graines pour observer au moins une entrée à effet.
    let sawCondition = false;
    let sawWounds = false;
    for (let seed = 0; seed < 200 && !(sawCondition && sawWounds); seed++) {
      const r = rollMiscast('majeure', makeRNG(seed));
      for (const op of r.ops) {
        if (op.condition) sawCondition = true;
        if (op.wounds != null) sawWounds = op.wounds >= 1;
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
      if (r.ops.some((o) => o.reduceToZero)) sawReduce = true;
    }
    expect(sawReduce).toBe(true);
  });
});

describe('Création de héros', () => {
  it('génère un personnage jouable et reproductible', () => {
    const hero = createHero({
      speciesLabel: 'Humains (Reiklander)',
      careerLabel: 'Agitateur',
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

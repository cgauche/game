import { describe, it, expect } from 'vitest';
import { parseQualityInstance } from './qualities/normalize';
import { resolveMelee, resolveRanged, rangeBandModifier, rangeBandName, attackModifiers, psychDRAdjust, resolveStrayRangedHit, defenseModifiers, rollMeleeDefender, finishMelee, resolveMeleePassive, resolveTrample, attackTestLabel } from './combat';
import { evaluateTest } from './tests';
import { makeRNG } from './dice';
import { Combatant, Weapon } from './types';

const mk = (over: Partial<Combatant> = {}): Combatant =>
  ({
    id: 'x',
    name: 'X',
    kind: 'enemy',
    characteristics: { 'capacite-de-combat': 50, 'capacite-de-tir': 50, force: 30, endurance: 30, initiative: 30, agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 12, max: 12 },
    advantage: 0,
    conditions: [],
    weapons: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [],
    talents: [],
    movement: 4,
    ...over,
  }) as unknown as Combatant;

const sword: Weapon = { name: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] };
const bow: Weapon = { name: 'Arc', type: 'ranged', damage: { plusBF: false, flat: 8 }, range: 60, qualities: [] };

describe('rollMeleeDefender : pénalité de main secondaire APPLIQUÉE au jet de parade (pas que l’affichage)', () => {
  const main: Weapon = { name: 'Épée', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [], hand: 'main', hands: 1, uid: 'm' };
  const off: Weapon = { name: 'Dague', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [], hand: 'off', hands: 1, uid: 'o' };
  it('parer avec l’arme de main secondaire (non Parade) → cible du jet -20 vs main principale', () => {
    const d = mk({ weapons: [main, off] });
    const withMain = rollMeleeDefender(d, 'parade', makeRNG(1), 0, main).target;
    const withOff = rollMeleeDefender(d, 'parade', makeRNG(1), 0, off).target;
    expect(withMain - withOff).toBe(20);
  });
});

describe('attackModifiers : pénalité de main secondaire (LDB 14 l.181)', () => {
  const off: Weapon = { name: 'Dague', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [], hand: 'off', hands: 1 };
  const main: Weapon = { name: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [], hand: 'main', hands: 1 };
  it('arme de main secondaire → -20', () => {
    const mods = attackModifiers(mk(), mk(), off, { kind: 'melee' });
    expect(mods.find((m) => m.label === 'Main secondaire')?.value).toBe(-20);
  });
  it('Ambidextre 1× → -10', () => {
    const mods = attackModifiers(mk({ talents: [{ talentId: 'ambidextre', times: 1 }] }), mk(), off, { kind: 'melee' });
    expect(mods.find((m) => m.label === 'Main secondaire')?.value).toBe(-10);
  });
  it('arme de main principale → aucune pénalité', () => {
    const mods = attackModifiers(mk(), mk(), main, { kind: 'melee' });
    expect(mods.some((m) => m.label === 'Main secondaire')).toBe(false);
  });
});

describe('parade : pénalité de main secondaire + exception Parade/Défensive (LDB 62 l.192)', () => {
  const parrySpec = { skillId: 'corps-a-corps', spec: 'parade', characteristic: 'capacite-de-combat', advances: 0 } as any;
  const offShield: Weapon = { name: 'Bouclier', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [{ id: 'defensive' }], hand: 'off', hands: 1 };
  it('parade main secondaire : bouclier Défensive + spé Parade → AUCUNE pénalité', () => {
    const mods = defenseModifiers(mk({ skills: [parrySpec] }), 'parade', 0, offShield);
    expect(mods.some((m) => m.label === 'Main secondaire')).toBe(false);
  });
  it('parade main secondaire SANS spé Parade → -20', () => {
    const mods = defenseModifiers(mk({ skills: [] }), 'parade', 0, offShield);
    expect(mods.find((m) => m.label === 'Main secondaire')?.value).toBe(-20);
  });
  it('parade main principale → aucune pénalité', () => {
    const mods = defenseModifiers(mk(), 'parade', 0, { ...offShield, hand: 'main' });
    expect(mods.some((m) => m.label === 'Main secondaire')).toBe(false);
  });
});

describe('Taille en combat (T1) + env injecté — attackModifiers (LDB 14 l.151-170 / 85 l.301-303)', () => {
  // bow portée 60, distanceTiles 28 → 56 m ≤ 60 = Moyenne (+0, pas de ligne de portée) : isole la Taille.
  it('tir : mod de Taille de la cible (Grande → +20)', () => {
    const mods = attackModifiers(mk(), mk({ size: 'grande' }), bow, { kind: 'ranged', distanceTiles: 28, env: [] });
    expect(mods.find((m) => m.label.startsWith('Taille (cible)'))?.value).toBe(20);
  });
  it('tir : env injecté (Couvert -20) figure dans les mods', () => {
    const mods = attackModifiers(mk(), mk(), bow, { kind: 'ranged', distanceTiles: 28, env: [{ label: 'Couvert (moyenne)', value: -20 }] });
    expect(mods.find((m) => m.label.startsWith('Couvert'))?.value).toBe(-20);
  });
  it('+10 au plus petit en mêlée (attaquant Petite vs cible Moyenne, LDB 85 l.301-303)', () => {
    const mods = attackModifiers(mk({ size: 'petite' }), mk({ size: 'moyenne' }), sword, { kind: 'melee', env: [] });
    expect(mods.find((m) => m.label.startsWith('Taille (plus petit)'))?.value).toBe(10);
  });
  it('tir : +10 plus petit ET mod de cible se cumulent (halfling Petite tire un ogre Grande)', () => {
    const mods = attackModifiers(mk({ size: 'petite' }), mk({ size: 'grande' }), bow, { kind: 'ranged', distanceTiles: 28, env: [] });
    expect(mods.find((m) => m.label.startsWith('Taille (cible)'))?.value).toBe(20);
    expect(mods.find((m) => m.label.startsWith('Taille (plus petit)'))?.value).toBe(10);
  });
  it('Moyenne par défaut (size absent des deux côtés) : aucun mod de Taille', () => {
    const mods = attackModifiers(mk(), mk(), bow, { kind: 'ranged', distanceTiles: 28, env: [] });
    expect(mods.find((m) => m.label.startsWith('Taille'))).toBeUndefined();
  });
  it('Peur : −1 DR au jet (PAS un −10 sur la cible) quand l’attaquant vise sa source (LDB 21 l.29)', () => {
    const a = mk({ psychState: [{ type: 'peur', sourceId: 'B', calmeDR: 0 }] });
    // Le modificateur n'est PLUS une ligne de mods sur la cible : c'est un ajustement de DR (psychDRAdjust).
    const mods = attackModifiers(a, mk({ id: 'B' }), sword, { kind: 'melee', env: [] });
    expect(mods.find((m) => m.label === 'Peur')).toBeUndefined();
    expect(psychDRAdjust(a, mk({ id: 'B' }))).toBe(-1);
  });
  it('Peur : aucun ajustement de DR si la cible n’est PAS la source de Peur', () => {
    const a = mk({ psychState: [{ type: 'peur', sourceId: 'B', calmeDR: 0 }] });
    expect(psychDRAdjust(a, mk({ id: 'C' }))).toBe(0);
  });
  it('Frénésie : +1 Bonus de Force au calcul des Dégâts (LDB 21 l.34)', () => {
    const tgt = mk({ id: 'T' });
    const fr = resolveMelee(mk({ psychState: [{ type: 'frenesie' }] }), tgt, sword, makeRNG(2), { defense: 'none' });
    const no = resolveMelee(mk(), tgt, sword, makeRNG(2), { defense: 'none' });
    if (fr.hit && no.hit) expect(fr.woundsLost!).toBe(no.woundsLost! + 1);
  });
});

describe('Esquive sous la neige −20 (LDB 14 l.115-116)', () => {
  it('defenseModifiers : −20 en esquive seulement (pas en parade)', () => {
    expect(defenseModifiers(mk(), 'esquive', -20).some((m) => m.value === -20)).toBe(true);
    expect(defenseModifiers(mk(), 'parade', -20).some((m) => m.value === -20)).toBe(false);
  });
  it('rollMeleeDefender : la neige abaisse la cible de l’esquive, pas de la parade', () => {
    const d = mk();
    expect(rollMeleeDefender(d, 'esquive', makeRNG(1), -20).target).toBe(rollMeleeDefender(d, 'esquive', makeRNG(1)).target - 20);
    expect(rollMeleeDefender(d, 'parade', makeRNG(1), -20).target).toBe(rollMeleeDefender(d, 'parade', makeRNG(1)).target);
  });
});

describe('Atouts Dévastatrice / Percutante (LDB 62 l.279/313)', () => {
  // roll 34 vs cible 52 → DR (sl) = 5−3 = 2 ; dé des unités = 4. Arme '+8' (ranged) ; cible mk() E30 → BE3, PA0.
  // Sans Atout : dégâts = 8 + 2 = 10 → woundsLost 7. Dévastatrice : 8 + max(2,4)=12 → 9. Percutante : 8+2+4=14 → 11.
  const ranged = (qualities: string[]) => ({ name: 'X', type: 'ranged' as const, damage: { plusBF: false, flat: 8 }, qualities: qualities.map((s) => parseQualityInstance(s)!) });
  it('Dévastatrice : dégâts utilisent max(DR, dé des unités)', () => {
    expect(resolveStrayRangedHit(mk(), mk(), ranged([]), 34, 52).woundsLost).toBe(7);
    expect(resolveStrayRangedHit(mk(), mk(), ranged(['Dévastatrice']), 34, 52).woundsLost).toBe(9);
  });
  it('De plaies atroces (qualité magique ADE2 4 l.239) = Dévastatrice : max(DR, dé des unités)', () => {
    expect(resolveStrayRangedHit(mk(), mk(), ranged(['De plaies atroces']), 34, 52).woundsLost).toBe(9);
  });
  it('Percutante : +dé des unités sur les dégâts', () => {
    expect(resolveStrayRangedHit(mk(), mk(), ranged(['Percutante']), 34, 52).woundsLost).toBe(11);
  });
  it('Inoffensive annule Dévastatrice et Percutante', () => {
    expect(resolveStrayRangedHit(mk(), mk(), ranged(['Dévastatrice', 'Percutante', 'Inoffensive']), 34, 52).woundsLost).toBe(7);
  });
});

describe('Taille — Frappe Mortelle (cleave) + Piétinement (LDB 85 l.299/320-321)', () => {
  const hit = evaluateTest(20, 60); // succès
  it('cleave posé sur une touche de mêlée d’un plus grand', () => {
    const r = resolveMeleePassive(mk({ size: 'enorme' }), mk({ size: 'moyenne' }), sword, hit);
    expect(r.hit).toBe(true);
    expect(r.cleave).toBe(true);
  });
  it('pas de cleave si l’attaquant n’est pas plus grand', () => {
    expect(resolveMeleePassive(mk(), mk(), sword, hit).cleave).toBeFalsy();
  });
  it('resolveTrample : attaque CC qui se résout', () => {
    const r = resolveTrample(mk({ size: 'enorme', characteristics: { ...mk().characteristics, 'capacite-de-combat': 60 } }), mk({ size: 'moyenne' }), makeRNG(3));
    expect(typeof r.hit).toBe('boolean');
  });
});

describe('Taille — défense −2 DR/catégorie en parade (LDB 85 l.305-306)', () => {
  const moy = mk({ size: 'moyenne', weapons: [sword] });
  const atk = evaluateTest(30, 50); // DR 2
  const def = evaluateTest(30, 60); // DR 3 (le défenseur l'emporterait : 3 > 2)
  it('un Moyen parant un Énorme subit −4 DR → l’attaquant touche', () => {
    expect(finishMelee(mk({ size: 'enorme' }), moy, sword, atk, def, 'parade').hit).toBe(true);
  });
  it('en esquive, aucune pénalité de Taille → le défenseur évite', () => {
    expect(finishMelee(mk({ size: 'enorme' }), moy, sword, atk, def, 'esquive').hit).toBe(false);
  });
  it('attaquant de même Taille : parade normale (pas de pénalité)', () => {
    expect(finishMelee(mk({ size: 'moyenne' }), moy, sword, atk, def, 'parade').hit).toBe(false);
  });
});

describe('Taille — Dégâts ×N + Atouts conférés (LDB 85 l.295-297)', () => {
  const ranged = { name: 'Arc', type: 'ranged' as const, damage: { plusBF: false, flat: 8 }, qualities: [] };
  it('attaquant Énorme (+2 cat) vs Moyen : ×2 + Dévastatrice + Percutante, AVANT soak', () => {
    expect(resolveStrayRangedHit(mk(), mk(), ranged, 34, 52).woundsLost).toBe(7); // 8+2 −3
    // (8 + max(2,4) + 4)×2 − 3 = 32 − 3 = 29
    expect(resolveStrayRangedHit(mk({ size: 'enorme' }), mk(), ranged, 34, 52).woundsLost).toBe(29);
  });
  it('+1 cat (Grande vs Moyen) : Dévastatrice mais pas de ×N', () => {
    // 8 + max(2,4)=12, ×1 → 12 − 3 = 9
    expect(resolveStrayRangedHit(mk({ size: 'grande' }), mk(), ranged, 34, 52).woundsLost).toBe(9);
  });
});

describe('resolveStrayRangedHit — tir dévié sur un allié (LDB 14 l.136)', () => {
  it('touche automatiquement la victime depuis le jet d’origine (sans relancer)', () => {
    const att = mk({ name: 'Tireur' });
    const ally = mk({ name: 'Allié', wounds: { current: 10, max: 10 } });
    const res = resolveStrayRangedHit(att, ally, bow, 30, 55); // roll 30 ≤ cible 55 → touche
    expect(res.hit).toBe(true);
    expect(res.woundsLost).toBeGreaterThan(0); // dégâts recalculés sur l'allié
    expect(res.location).toBeTruthy();
  });
});

describe('AttackResult — détail des jets (breakdown) pour la modale', () => {
  it('mêlée opposée : détaille l’attaquant ET le défenseur (cible + DR)', () => {
    const res = resolveMelee(mk({ name: 'Att' }), mk({ name: 'Def' }), sword, makeRNG(7));
    expect(res.attackerDetail).toBeTruthy();
    expect(res.attackerDetail!.label).toBe('Corps à corps');
    expect(res.attackerDetail!.base).toBe(50); // CC de base
    // cible = base + modificateurs (Avantage, viser, États…)
    expect(res.attackerDetail!.target).toBe(res.attackerDetail!.base + res.attackerDetail!.modifier);
    expect(typeof res.attackerDetail!.sl).toBe('number'); // le DR du jet
    expect(res.defenderDetail).toBeTruthy(); // jet OPPOSÉ → le défenseur est détaillé aussi
    expect(['Parade', 'Esquive']).toContain(res.defenderDetail!.label);
  });

  it('distance : détaille l’attaquant, pas de défenseur (non opposé)', () => {
    const res = resolveRanged(mk({ name: 'Tir' }), mk({ name: 'Cible' }), bow, makeRNG(3));
    expect(res.attackerDetail!.label).toBe('Projectiles');
    expect(res.defenderDetail).toBeUndefined();
  });
});

describe('attackTestLabel — libellé du Test SUIT combatValue, ne ment jamais (#203)', () => {
  const belier: Weapon = { name: 'Bélier', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [], resolveChar: 'force' };
  it('arme à Résolution alternative (bélier → Force, ADE II 8 l.233) → libellé de la Carac', () => {
    expect(attackTestLabel(belier, 'melee')).toBe('Force');
  });
  it('arme de mêlée normale (épée) → « Corps à corps »', () => {
    expect(attackTestLabel(sword, 'melee')).toBe('Corps à corps');
  });
  it('arme à distance normale (arc) → « Projectiles »', () => {
    expect(attackTestLabel(bow, 'ranged')).toBe('Projectiles');
  });
  it('resolveMeleePassive avec un bélier : le breakdown affiche « Force », pas « Corps à corps »', () => {
    const hit = evaluateTest(20, 60);
    const r = resolveMeleePassive(mk({ characteristics: { ...mk().characteristics, force: 60 } }), mk(), belier, hit);
    expect(r.attackerDetail!.label).toBe('Force');
  });
});

describe('Bandes de portée (table des Difficultés, 14 - _GoBack.md l.82-118)', () => {
  // Arc portée 60 m ; échelle 1 case = 2 m → distanceTiles × 2 = mètres.
  it('Bout portant ≤ Portée÷10 → +40', () => expect(rangeBandModifier(2, 60)).toBe(40)); // 4 m ≤ 6
  it('Courte ≤ Portée÷2 → +20', () => expect(rangeBandModifier(10, 60)).toBe(20)); // 20 m ≤ 30
  it('Moyenne ≤ Portée → +0', () => expect(rangeBandModifier(28, 60)).toBe(0)); // 56 m ≤ 60
  it('Longue ≤ Portée×2 → −10 (corrige l’ancien 0)', () => expect(rangeBandModifier(50, 60)).toBe(-10)); // 100 m ≤ 120
  it('Extrême ≤ Portée×3 → −30', () => expect(rangeBandModifier(80, 60)).toBe(-30)); // 160 m ≤ 180
  it('hors de portée → null', () => expect(rangeBandModifier(100, 60)).toBeNull()); // 200 m > 180
  it('rangeBandName cohérent', () => {
    expect(rangeBandName(2, 60)).toBe('Bout portant');
    expect(rangeBandName(10, 60)).toBe('Courte portée');
    expect(rangeBandName(50, 60)).toBe('Longue');
  });
});

describe('Bandes de portée — échelle métrique de la Scène (#249, metresPerTile) : arme Portée 60 m', () => {
  // Scène Mer (MDG 13, ~10 m/case) : les mêmes seuils EN MÈTRES tombent sur MOINS de cases —
  // Courte ≤ Portée÷2 = 30 m → 3 cases au lieu de 15 (mpt=2, cf. describe ci-dessus).
  it('mpt=10 : Courte portée ≤ 3 cases (au lieu de 15 à mpt=2)', () => {
    expect(rangeBandModifier(3, 60, 10)).toBe(20); // 30 m ≤ 30
    expect(rangeBandModifier(4, 60, 10)).toBe(0); // 40 m > 30 → Moyenne
    expect(rangeBandModifier(15, 60, 2)).toBe(20); // même arme, échelle person-scale : Courte à 15 cases
  });
  it('mpt=10 : Bout portant/Moyenne/Longue/Extrême dérivent du MÊME seuil métrique', () => {
    expect(rangeBandModifier(0, 60, 10)).toBe(40); // 0 m ≤ 6
    expect(rangeBandModifier(1, 60, 10)).toBe(20); // 10 m > 6 (Bout portant) mais ≤ 30 (Courte)
    expect(rangeBandModifier(6, 60, 10)).toBe(0); // 60 m ≤ 60
    expect(rangeBandModifier(12, 60, 10)).toBe(-10); // 120 m ≤ 120
    expect(rangeBandModifier(18, 60, 10)).toBe(-30); // 180 m ≤ 180
    expect(rangeBandModifier(19, 60, 10)).toBeNull(); // 190 m > 180
  });
  it('attackModifiers propage metresPerTile jusqu’au mod de portée affiché', () => {
    const mods = attackModifiers(mk({ name: 'A' }), mk({ name: 'B' }), bow, { kind: 'ranged', distanceTiles: 3, metresPerTile: 10 });
    expect(mods).toContainEqual({ label: 'Courte portée', value: 20 });
  });
  it('sans metresPerTile (défaut 2, terrestre) : même distanceTiles=3 reste Bout Portant/hors-Courte, comportement BYTE-IDENTIQUE', () => {
    const mods = attackModifiers(mk({ name: 'A' }), mk({ name: 'B' }), bow, { kind: 'ranged', distanceTiles: 3 });
    expect(mods).toContainEqual({ label: 'Bout portant', value: 40 }); // 6 m ≤ 6, comme avant le câblage
  });
});

describe('attackModifiers — modificateurs étiquetés (source unique)', () => {
  it('tir à courte portée → mod « Courte portée » +20', () => {
    const mods = attackModifiers(mk({ name: 'A' }), mk({ name: 'B' }), bow, { kind: 'ranged', distanceTiles: 10 });
    expect(mods).toContainEqual({ label: 'Courte portée', value: 20 });
  });
  it('tireur qui a Visé → mod « Viser » +20 (action Viser, l.90)', () => {
    const mods = attackModifiers(mk({ name: 'A', aiming: true }), mk({ name: 'B' }), bow, { kind: 'ranged', distanceTiles: 28 });
    expect(mods).toContainEqual({ label: 'Viser', value: 20 });
  });
  it('viser une localisation → mod « Localisation visée » −10', () => {
    const mods = attackModifiers(mk({ name: 'A' }), mk({ name: 'B' }), bow, { kind: 'ranged', distanceTiles: 28, location: 'tete' });
    expect(mods).toContainEqual({ label: 'Localisation visée', value: -10 });
  });
  it('mêlée vs cible À Terre → mod « Cible vulnérable » +20', () => {
    const downed = mk({ name: 'B', conditions: [{ name: 'a-terre', value: 1 }] });
    const mods = attackModifiers(mk({ name: 'A' }), downed, sword, { kind: 'melee' });
    expect(mods).toContainEqual({ label: 'Cible vulnérable', value: 20 });
  });
});

describe('Charge montée — dégâts à la Force + Taille de la monture (LDB 14 l.183)', () => {
  it('dmgProxy augmente les dégâts (Force de la monture) et déclenche le balayage (Taille de la monture)', () => {
    const att = mk({ name: 'Cavalier', size: 'moyenne' }); // BF 3, Moyenne
    const def = mk({ name: 'Gobelin', size: 'moyenne' });
    const okAtk = { roll: 35, target: 50, success: true, sl: 2, isDouble: false }; // touche nette (déterministe)
    // Seul le proxy de dégâts (monture Grande, BF 6) change : touche identique → DÉGÂTS isolés.
    const normal = resolveMeleePassive(att, def, sword, okAtk);
    const charge = resolveMeleePassive(att, def, sword, okAtk, undefined, [], { sb: 6, size: 'grande' });
    expect(normal.hit && charge.hit).toBe(true);
    expect(charge.damage!).toBeGreaterThan(normal.damage!); // Force de la monture (6) > Force du cavalier (3)
    expect(charge.cleave).toBe(true); // monture Grande vs Moyenne → Frappe Mortelle (balayage)
    expect(normal.cleave).toBeFalsy(); // à pied, Moyenne vs Moyenne → pas de balayage
  });
  it('le toucher reste celui du CAVALIER (le proxy n’affecte que les dégâts)', () => {
    const att = mk({ name: 'Cavalier' });
    const def = mk({ name: 'Cible' });
    const a = resolveMelee(att, def, sword, makeRNG(5), { defense: 'none' });
    const b = resolveMelee(att, def, sword, makeRNG(5), { defense: 'none', dmgProxy: { sb: 9, size: 'enorme' } });
    expect(a.attackerRoll).toBe(b.attackerRoll); // jet d'attaque identique : la CC du cavalier n'est pas touchée
  });
});

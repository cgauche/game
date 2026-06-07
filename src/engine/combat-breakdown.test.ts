import { describe, it, expect } from 'vitest';
import { resolveMelee, resolveRanged, rangeBandModifier, rangeBandName, attackModifiers } from './combat';
import { makeRNG } from './dice';
import { Combatant, Weapon } from './types';

const mk = (over: Partial<Combatant> = {}): Combatant =>
  ({
    id: 'x',
    name: 'X',
    kind: 'enemy',
    characteristics: { CC: 50, CT: 50, F: 30, E: 30, I: 30, Ag: 40, Dex: 30, Int: 30, FM: 30, Soc: 30 },
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

const sword: Weapon = { name: 'Épée', type: 'melee', damage: '+BF+4', qualities: [] };
const bow: Weapon = { name: 'Arc', type: 'ranged', damage: '+8', range: 60, qualities: [] };

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

describe('Bandes de portée (table des Difficultés, 14 - _GoBack.md l.82-118)', () => {
  // Arc portée 60 m ; échelle 1 case = 2 m → distanceTiles × 2 = mètres.
  it('Bout portant ≤ Portée÷10 → +60', () => expect(rangeBandModifier(2, 60)).toBe(60)); // 4 m ≤ 6
  it('Courte ≤ Portée÷2 → +40', () => expect(rangeBandModifier(10, 60)).toBe(40)); // 20 m ≤ 30
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

describe('attackModifiers — modificateurs étiquetés (source unique)', () => {
  it('tir à courte portée → mod « Courte portée » +40', () => {
    const mods = attackModifiers(mk({ name: 'A' }), mk({ name: 'B' }), bow, { kind: 'ranged', distanceTiles: 10 });
    expect(mods).toContainEqual({ label: 'Courte portée', value: 40 });
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
    const downed = mk({ name: 'B', conditions: [{ name: 'À Terre', value: 1 }] });
    const mods = attackModifiers(mk({ name: 'A' }), downed, sword, { kind: 'melee' });
    expect(mods).toContainEqual({ label: 'Cible vulnérable', value: 20 });
  });
});

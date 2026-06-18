import { describe, it, expect, afterEach } from 'vitest';
import { combineMods, defenseModifiers, rangeBandModifier, rangeBandName, weaponReachPenalty } from './combat';
import { setRule, resetRule } from './policy';
import type { Combatant, Weapon } from './types';

describe('combineMods — Combiner les Difficultés (LDB 14 l.126-131)', () => {
  it('plafonne la somme des malus à -30', () => {
    expect(combineMods([{ label: 'a', value: -20 }, { label: 'b', value: -20 }])).toBe(-30);
  });
  it('plafonne la somme des bonus à +60', () => {
    expect(combineMods([{ label: 'a', value: 40 }, { label: 'b', value: 40 }])).toBe(60);
  });
  it('mélange bonus + malus se somme (plafonds séparés)', () => {
    expect(combineMods([{ label: 'a', value: 40 }, { label: 'b', value: -20 }])).toBe(20);
  });
  it('Avantage est hors plafond (uncapped)', () => {
    // Avantage +70 hors cap, + malus -40 plafonné -30 → +40
    expect(
      combineMods([
        { label: 'Avantage', value: 70, uncapped: true },
        { label: 'x', value: -20 },
        { label: 'y', value: -20 },
      ]),
    ).toBe(40);
  });
  it('liste vide → 0', () => {
    expect(combineMods([])).toBe(0);
  });
});

describe('combineMods — plafonds de Difficulté réglables (LDB 14 l.126, règle optionnelle)', () => {
  afterEach(() => { resetRule('combat-diff-cap-bonus'); resetRule('combat-diff-cap-malus'); });
  it('combat-diff-cap-bonus → 20 : la somme des bonus plafonne à +20 (défaut +60)', () => {
    expect(combineMods([{ label: 'a', value: 40 }, { label: 'b', value: 40 }])).toBe(60);
    setRule('combat-diff-cap-bonus', 20);
    expect(combineMods([{ label: 'a', value: 40 }, { label: 'b', value: 40 }])).toBe(20);
  });
  it('combat-diff-cap-malus → 10 : la somme des malus plafonne à −10 (défaut −30)', () => {
    expect(combineMods([{ label: 'a', value: -20 }, { label: 'b', value: -20 }])).toBe(-30);
    setRule('combat-diff-cap-malus', 10);
    expect(combineMods([{ label: 'a', value: -20 }, { label: 'b', value: -20 }])).toBe(-10);
  });
});

describe("weaponReachPenalty — Longueur d'arme (LDB 62 l.215, règle optionnelle)", () => {
  afterEach(() => resetRule('combat-weapon-reach'));
  const w = (reach: string | null) => ({ type: 'melee', reach }) as unknown as Weapon;
  it('off (défaut) : aucun malus de longueur', () => {
    expect(weaponReachPenalty(w('Très courte'), w('Longue'))).toBe(0);
  });
  it('on : arme adverse PLUS LONGUE → −10 pour la toucher', () => {
    setRule('combat-weapon-reach', true);
    expect(weaponReachPenalty(w('Très courte'), w('Longue'))).toBe(-10);
  });
  it('on : mon arme plus longue ou égale → pas de malus ; adversaire mains nues → pas de malus', () => {
    setRule('combat-weapon-reach', true);
    expect(weaponReachPenalty(w('Longue'), w('Très courte'))).toBe(0);
    expect(weaponReachPenalty(w('Moyenne'), w('Moyenne'))).toBe(0);
    expect(weaponReachPenalty(w('Moyenne'), undefined)).toBe(0);
  });
});

describe('rangeBandModifier / rangeBandName — table de portée unique (identité du refactor)', () => {
  const R = 10; // Portée 10 m ; échelle 1 case = 2 m
  it('modificateurs aux 5 bandes + hors de portée', () => {
    expect(rangeBandModifier(0, R)).toBe(60); // bout portant (m=0 ≤ 1)
    expect(rangeBandModifier(2, R)).toBe(40); // courte (m=4 ≤ 5)
    expect(rangeBandModifier(5, R)).toBe(0); // moyenne (m=10 ≤ 10)
    expect(rangeBandModifier(8, R)).toBe(-10); // longue (m=16 ≤ 20)
    expect(rangeBandModifier(14, R)).toBe(-30); // extrême (m=28 ≤ 30)
    expect(rangeBandModifier(16, R)).toBeNull(); // m=32 > 30
  });
  it('noms de bande alignés sur les mêmes seuils', () => {
    expect(rangeBandName(0, R)).toBe('Bout portant');
    expect(rangeBandName(2, R)).toBe('Courte portée');
    expect(rangeBandName(5, R)).toBe('Moyenne');
    expect(rangeBandName(8, R)).toBe('Longue');
    expect(rangeBandName(14, R)).toBe('Extrême');
    expect(rangeBandName(16, R)).toBeNull();
  });
});

describe('defenseModifiers — Avantage hors plafond, malus plafonnés (B1, parité avec l’attaque)', () => {
  it('l’Avantage de la DÉFENSE est `uncapped` → +80 NON plafonné à +60', () => {
    const d = { advantage: 8, conditions: [], weapons: [], defensiveStance: false } as unknown as Combatant;
    const mods = defenseModifiers(d, 'esquive');
    expect(mods.find((m) => m.label === 'Avantage')).toMatchObject({ value: 80, uncapped: true });
    expect(combineMods(mods)).toBe(80);
  });

  it('les malus de défense cumulés sont plafonnés à −30 (LDB 14 l.129) ; l’Avantage reste hors plafond', () => {
    // Esquive en neige (−20) + aura Perturbante (−20, État) + Maniement de deux armes (−10) = −50 brut
    // → plafonné à −30 ; Avantage +30 hors plafond → net 0.
    const d = { advantage: 3, conditions: [], perturbed: true, weapons: [], defensiveStance: false, dualStrikeDefensePenalty: true } as unknown as Combatant;
    const mods = defenseModifiers(d, 'esquive', -20);
    expect(mods.filter((m) => m.value < 0).every((m) => !m.uncapped)).toBe(true); // les malus NE sont PAS uncapped
    expect(combineMods(mods)).toBe(0); // +30 (Avantage) + max(−30, −50)
  });
});

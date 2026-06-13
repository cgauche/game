import { describe, it, expect } from 'vitest';
import { combineMods, defenseModifiers } from './combat';
import type { Combatant } from './types';

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

/**
 * engine/spellspec + SpellData — métadonnées de résolution curées.
 * Migration #5 : les specs curées vivent désormais dans SpellData (spells.json) — plus de registre
 * src/data/spellspecs/. Ces tests vérifient que la résolution applique bien les effets curés et que
 * la désambiguïsation par type fonctionne directement sur les données JSON.
 */
import { describe, it, expect } from 'vitest';
import type { Combatant } from './types';
import { applyOps, resolveFormula, COMBAT_PERSIST } from './ops';
import { spells, findSpellById, type SpellData } from '../data';
import { spellOps } from '../state/flow';

function hero(p: Partial<Combatant> = {}): Combatant {
  return {
    id: 'h', name: 'Cobaye', kind: 'hero',
    characteristics: { CC: 30, CT: 30, F: 30, E: 45, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 38, Soc: 42 },
    wounds: { current: 6, max: 12 }, advantage: 0, conditions: [], movement: 4,
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [],
    ...p,
  } as Combatant;
}

/** Applique les effets d'un sort comme applyCast le fait (ops `on:'target'` de `spell.effects`, durée
 *  résolue contre le lanceur). La durée et les effets vivent désormais sur SpellData (données JSON). */
function castVia(spell: SpellData, caster: Combatant, target: Combatant): string[] {
  const rounds = spell.durationRounds != null ? resolveFormula(spell.durationRounds, caster) : null;
  return applyOps(target, spellOps(spell.effects, 'target'), { caster, label: spell.label, defaultDurationRounds: rounds ?? COMBAT_PERSIST });
}

describe('specs curées — résolution', () => {
  it('Bénédiction de Guérison : op heal littérale (+1 PB)', () => {
    const spell = findSpellById('benediction-de-guerison')!;
    const target = hero();
    castVia(spell, hero({ id: 'c' }), target);
    expect(target.wounds.current).toBe(7);
  });

  it('Caresse de Rhya : « Guérir (Bonus de Sociabilité) Blessures » résolu contre le LANCEUR', () => {
    const spell = findSpellById('caresse-de-rhya')!;
    const caster = hero({ id: 'c' }); // Soc 42 → BSoc 4
    const target = hero();
    castVia(spell, caster, target);
    expect(target.wounds.current).toBe(10); // 6 + 4
  });

  it('Écorce : +2 BE (charMod E +20) et −10 en Agilité/Dextérité — effets lus de spell.effects', () => {
    const spell = findSpellById('ecorce')!;
    expect(spellOps(spell.effects, 'target')).toEqual([
      { op: 'charMod', char: 'E', mod: 20 },
      { op: 'charMod', char: 'Ag', mod: -10 },
      { op: 'charMod', char: 'Dex', mod: -10 },
    ]);
  });
});

describe('registre curé — couverture & désambiguïsation', () => {
  it('les 19 Bénédictions sont toutes curées', () => {
    const blessed = spells.filter((s) => s.type === 'Béni');
    expect(blessed).toHaveLength(19);
    for (const s of blessed) expect(s.curated, s.label).toBe(true);
  });

  it('labels en double : « Enchevêtrement » résolu par type (Arcane vs miracle de Taal)', () => {
    const arcane = spells.find((s) => s.label === 'Enchevêtrement' && s.type === 'Magie des Arcanes');
    const taal = spells.find((s) => s.label === 'Enchevêtrement' && s.type === 'Invocation');
    expect(arcane?.type).toBe('Magie des Arcanes');
    expect(taal?.type).toBe('Invocation');
  });
});

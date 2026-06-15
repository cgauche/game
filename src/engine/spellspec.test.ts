/**
 * engine/spellspec + data/spellspecs — specs CURÉES de sorts. Les 243 sorts de la base ont une
 * entrée relue de la source (plus de repli regex) ; ces tests vérifient que la résolution applique
 * bien les effets curés et que la désambiguïsation par type fonctionne.
 */
import { describe, it, expect } from 'vitest';
import type { Combatant } from './types';
import { spellSpecFor, curatedSpec } from '../data/spellspecs';
import { applyOps, resolveFormula, COMBAT_PERSIST } from './ops';
import { spells, type SpellData } from '../data';
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
 *  résolue contre le lanceur). Les effets vivent désormais sur la DONNÉE (Flow), plus sur la spec. */
function castVia(spell: SpellData, caster: Combatant, target: Combatant): string[] {
  const spec = spellSpecFor(spell);
  const rounds = spec.durationRounds != null ? resolveFormula(spec.durationRounds, caster) : null;
  return applyOps(target, spellOps(spell.effects, 'target'), { caster, label: spec.label, defaultDurationRounds: rounds ?? COMBAT_PERSIST });
}

describe('specs curées — résolution', () => {
  it('Bénédiction de Guérison : op heal littérale (+1 PB)', () => {
    const spell = spells.find((s) => s.label === 'Bénédiction de Guérison')!;
    const target = hero();
    castVia(spell, hero({ id: 'c' }), target);
    expect(target.wounds.current).toBe(7);
  });

  it('Caresse de Rhya : « Guérir (Bonus de Sociabilité) Blessures » résolu contre le LANCEUR', () => {
    const spell = spells.find((s) => s.label === 'Caresse de Rhya')!;
    const caster = hero({ id: 'c' }); // Soc 42 → BSoc 4
    const target = hero();
    castVia(spell, caster, target);
    expect(target.wounds.current).toBe(10); // 6 + 4
  });

  it('Écorce : +2 BE (charMod E +20) et −10 en Agilité/Dextérité — effets lus de spell.effects', () => {
    const spell = spells.find((s) => s.label === 'Écorce')!;
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
    for (const s of blessed) expect(curatedSpec(s.label), s.label).toBeDefined();
  });

  it('labels en double : « Enchevêtrement » résolu par type (Arcane vs miracle de Taal)', () => {
    expect(curatedSpec('Enchevêtrement', 'Magie des Arcanes')?.type).toBe('Magie des Arcanes');
    expect(curatedSpec('Enchevêtrement', 'Invocation')?.type).toBe('Invocation');
  });
});

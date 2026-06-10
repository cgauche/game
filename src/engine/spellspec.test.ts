/**
 * engine/spellspec + data/spellspecs — specs structurées de sorts : le repli
 * regex reproduit le POC à l'identique, et les entrées CURÉES (Bénédictions)
 * produisent le MÊME résultat que le repli (golden d'iso-comportement).
 */
import { describe, it, expect } from 'vitest';
import type { Combatant } from './types';
import { fallbackSpec } from './spellspec';
import { spellSpecFor, curatedSpec } from '../data/spellspecs';
import { applyOps, resolveFormula, COMBAT_PERSIST } from './ops';
import { spells } from '../data';

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

/** Applique la spec d'un sort comme applyCast le fait (durée résolue contre le lanceur). */
function castVia(spec: ReturnType<typeof fallbackSpec>, caster: Combatant, target: Combatant): string[] {
  const rounds = spec.durationRounds != null ? resolveFormula(spec.durationRounds, caster) : null;
  return applyOps(target, spec.ops, { caster, label: spec.label, defaultDurationRounds: rounds ?? COMBAT_PERSIST });
}

describe('fallbackSpec — synthèse depuis la desc (parseurs historiques)', () => {
  it('soin littéral : « 4 Points de Blessure » → op heal 4', () => {
    const s = fallbackSpec({ label: 'X', type: 'Béni', cn: null, desc: 'La cible regagne 4 Points de Blessure.' });
    expect(s.ops).toEqual([{ op: 'heal', amount: 4 }]);
    expect(s.curated).toBe(false);
  });

  it('soin paramétré : « Guérir (Bonus de Sociabilité) Blessures » → formule bonusOf résolue contre le LANCEUR', () => {
    const s = fallbackSpec({ label: 'Caresse', type: 'Invocation', cn: null, desc: 'Guérir (Bonus de Sociabilité) Blessures.' });
    expect(s.ops).toEqual([{ op: 'heal', amount: { bonusOf: 'Soc' } }]);
    const caster = hero({ id: 'c' }); // Soc 42 → 4
    const target = hero();
    castVia(s, caster, target);
    expect(target.wounds.current).toBe(10);
  });

  it('buff double : « -10 en Agilité et Dextérité » → 2 charMod ; durée formule « (Bonus de FM) Rounds »', () => {
    const s = fallbackSpec({ label: 'Écorce', type: 'Magie des Arcanes', cn: 5, duration: '(Bonus de Force Mentale) Rounds', desc: 'La cible gagne +2 PA mais subit -10 en Agilité et Dextérité.' });
    expect(s.ops).toEqual([
      { op: 'charMod', char: 'Ag', mod: -10 },
      { op: 'charMod', char: 'Dex', mod: -10 },
    ]);
    expect(s.durationRounds).toEqual({ bonusOf: 'FM' });
  });

  it('État : « reçoit 1 État Sonné » → op condition ; priorité exclusive soin > buff > État (iso-POC)', () => {
    const s = fallbackSpec({ label: 'Y', type: 'Magie mineure', cn: 0, desc: 'La cible reçoit 1 État Sonné.' });
    expect(s.ops).toEqual([{ op: 'condition', name: 'Sonné', value: 1 }]);
    // Une desc qui guérit ET buffe ne produit QUE le soin (comportement historique d'applyCast).
    const both = fallbackSpec({ label: 'Z', type: 'Béni', cn: null, desc: 'Guérit 2 Points de Blessure et la cible gagne +10 en Force.' });
    expect(both.ops).toHaveLength(1);
    expect(both.ops[0].op).toBe('heal');
  });

  it('desc sans effet modélisable → aucune op (journal d’incantation seul, rien d’inventé)', () => {
    const s = fallbackSpec({ label: 'Murmures', type: 'Magie mineure', cn: 0, desc: 'Vous murmurez un message à une cible en vue.' });
    expect(s.ops).toEqual([]);
  });
});

describe('registre curé — Bénédictions ≡ repli (golden iso-comportement)', () => {
  const labels = [
    'Bénédiction de Bataille', 'Bénédiction de Charisme', 'Bénédiction de Courage',
    'Bénédiction de Finesse', 'Bénédiction de Grâce', 'Bénédiction de La Chasse',
    'Bénédiction de Puissance', 'Bénédiction de Sagesse', 'Bénédiction de Vigueur',
    'Bénédiction de Vivacité', 'Bénédiction de Guérison', 'Bénédiction de Ténacité',
  ];
  it.each(labels)('%s : la spec curée produit le même état que le repli regex', (label) => {
    const spell = spells.find((s) => s.label === label)!;
    expect(spell).toBeDefined();
    const caster = hero({ id: 'c' });
    const viaCurated = hero({ conditions: [{ name: 'Exténué', value: 1 }] });
    const viaFallback = hero({ conditions: [{ name: 'Exténué', value: 1 }] });
    const cur = spellSpecFor(spell);
    expect(cur.curated).toBe(true);
    castVia(cur, caster, viaCurated);
    castVia(fallbackSpec(spell), caster, viaFallback);
    expect(viaCurated.wounds).toEqual(viaFallback.wounds);
    expect(viaCurated.conditions).toEqual(viaFallback.conditions);
    expect(viaCurated.activeEffects?.map((e) => ({ char: e.char, bonus: e.bonus, roundsLeft: e.roundsLeft })))
      .toEqual(viaFallback.activeEffects?.map((e) => ({ char: e.char, bonus: e.bonus, roundsLeft: e.roundsLeft })));
  });

  it('les 19 Bénédictions sont toutes curées', () => {
    const blessed = spells.filter((s) => s.type === 'Béni');
    expect(blessed).toHaveLength(19);
    for (const s of blessed) expect(curatedSpec(s.label), s.label).toBeDefined();
  });

  it('un sort non curé passe par le repli', () => {
    const fleche = spells.find((s) => s.label === 'Fléchette')!;
    expect(spellSpecFor(fleche).curated).toBe(false);
  });
});

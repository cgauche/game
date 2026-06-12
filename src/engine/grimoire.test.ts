/**
 * Grimoire — apprentissage/mémorisation (LDB 46 l.44-47, 47 l.33-34, Talents LDB 10) :
 * coûts par bandes (BFM ×50 / BInt ×100 / 100×connus), éligibilité par Talent,
 * Bénédictions par culte (six incluses), lecture au grimoire (NI ×2).
 */
import { describe, it, expect } from 'vitest';
import type { Combatant } from './types';
import {
  casterTalents, spellCost, learnableSpells, blessingsOf, canCastFromGrimoire, knownCount,
} from './grimoire';
import { spells } from '../data';

const sp = (label: string) => spells.find((s) => s.label === label)!;

function hero(p: Partial<Combatant> = {}): Combatant {
  return {
    id: 'h', name: 'Cobaye', kind: 'hero',
    characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 42, FM: 35, Soc: 30 },
    wounds: { current: 10, max: 12 }, advantage: 0, conditions: [], movement: 4,
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], spells: [], xp: 1000,
    ...p,
  } as Combatant;
}

describe('casterTalents — extraction des specs', () => {
  it('« Invocation (Sigmar) » → invocation/Sigmar ; « (Au choix) » → joker', () => {
    const c = hero({ talents: [
      { name: 'Invocation (Sigmar)', times: 1 },
      { name: 'Magie des Arcanes (Feu)', times: 1 },
      { name: 'Béni (Au choix)', times: 1 },
      { name: 'Magie mineure', times: 1 },
    ] });
    expect(casterTalents(c)).toEqual([
      { kind: 'invocation', spec: 'Sigmar' },
      { kind: 'arcane', spec: 'Feu' },
      { kind: 'beni', spec: undefined },
      { kind: 'mineure', spec: undefined },
    ]);
  });
});

describe('coûts de mémorisation (Talents LDB 10)', () => {
  it('Magie mineure : BFM sorts INCLUS au Talent (0 PX, l.587), puis bandes inclusives ×50', () => {
    const c = hero({ talents: [{ name: 'Magie mineure', times: 1 }] }); // FM 35 → BFM 3
    expect(spellCost(c, sp('Fléchette'))).toBe(0); // « vous mémorisez… BFM Sorts » au Talent
    c.spells = ['Alerte', 'Bruits']; // 2 connus < BFM → toujours inclus
    expect(spellCost(c, sp('Fléchette'))).toBe(0);
    c.spells = ['Alerte', 'Bruits', 'Choc']; // BFM atteint → payant : « Jusqu'à BFM ×1 » = 50
    expect(knownCount(c, 'mineure')).toBe(3);
    expect(spellCost(c, sp('Fléchette'))).toBe(50);
    c.spells = [...c.spells, 'Fléchette']; // 4 connus → « Jusqu'à BFM ×2 » = 100
    expect(spellCost(c, sp('Drain'))).toBe(100);
  });

  it('Magie des Arcanes : bandes de BInt ×100 PX ; Domaine exigé pour les sorts de Domaine', () => {
    const c = hero({ talents: [{ name: 'Magie des Arcanes (Feu)', times: 1 }] });
    expect(spellCost(c, sp('Arme aethyrique'))).toBe(100); // Arcane commun : OK
    const feu = spells.find((s) => s.type === 'Magie des Arcanes' && s.subType === 'Feu')!;
    expect(spellCost(c, feu)).toBe(100);
    const ombres = spells.find((s) => s.type === 'Magie des Arcanes' && s.subType === 'Ombres')!;
    expect(spellCost(c, ombres)).toBeNull(); // pas le Domaine
  });

  it('Arcanes — bande INCLUSIVE : à exactement BInt connus, le suivant reste à 100 PX', () => {
    const c = hero({ talents: [{ name: 'Magie des Arcanes (Feu)', times: 1 }] }); // Int 42 → BInt 4
    const arcanes = spells.filter((s) => s.type === 'Magie des Arcanes' && (s.subType === 'Feu' || s.subType == null));
    c.spells = arcanes.slice(0, 4).map((s) => s.label); // « Jusqu'à BInt ×1 » plein
    expect(spellCost(c, arcanes[4])).toBe(100);
    c.spells = arcanes.slice(0, 5).map((s) => s.label); // 5 connus → « Jusqu'à BInt ×2 » = 200
    expect(spellCost(c, arcanes[5])).toBe(200);
  });

  it('Invocation : 1er Miracle inclus (0 PX), puis 100 × connus ; culte exigé', () => {
    const c = hero({ talents: [{ name: 'Invocation (Sigmar)', times: 1 }] });
    const sigmar = spells.filter((s) => s.type === 'Invocation' && s.subType === 'Sigmar');
    expect(spellCost(c, sigmar[0])).toBe(0);
    c.spells = [sigmar[0].label];
    expect(spellCost(c, sigmar[1])).toBe(100);
    c.spells = [sigmar[0].label, sigmar[1].label, sigmar[2].label];
    expect(spellCost(c, sigmar[3])).toBe(300); // « 3 Miracles connus → 300 PX »
    const ulric = spells.find((s) => s.type === 'Invocation' && s.subType === 'Ulric')!;
    expect(spellCost(c, ulric)).toBeNull(); // autre culte
  });

  it('Béni (Culte) : les SIX Bénédictions du culte à 0 PX, les autres refusées', () => {
    const c = hero({ talents: [{ name: 'Béni (Shallya)', times: 1 }] });
    expect(blessingsOf('Shallya')).toContain('Bénédiction de Guérison');
    expect(spellCost(c, sp('Bénédiction de Guérison'))).toBe(0);
    expect(spellCost(c, sp('Bénédiction de Bataille'))).toBeNull(); // pas chez Shallya (LDB 41)
    const learn = learnableSpells(c);
    expect(learn.filter((l) => l.spell.type === 'Béni')).toHaveLength(6);
  });

  it('déjà connu / aucun Talent → null', () => {
    expect(spellCost(hero(), sp('Fléchette'))).toBeNull();
    const c = hero({ talents: [{ name: 'Magie mineure', times: 1 }], spells: ['Fléchette'] });
    expect(spellCost(c, sp('Fléchette'))).toBeNull();
  });
});

describe('lecture au grimoire (LDB 47 l.34)', () => {
  it('sort de son Domaine NON mémorisé + grimoire porté → lançable (NI ×2 côté flux)', () => {
    const c = hero({
      talents: [{ name: 'Magie des Arcanes (Feu)', times: 1 }],
      items: [{ uid: 'g1', name: 'Grimoire', kind: 'misc', enc: 1, qualities: [] } as never],
    });
    expect(canCastFromGrimoire(c, sp('Arme aethyrique'))).toBe(true);
    // mémorisé → inutile ; sans grimoire → impossible ; Prière → jamais.
    expect(canCastFromGrimoire({ ...c, spells: ['Arme aethyrique'] } as Combatant, sp('Arme aethyrique'))).toBe(false);
    expect(canCastFromGrimoire({ ...c, items: [] } as Combatant, sp('Arme aethyrique'))).toBe(false);
    expect(canCastFromGrimoire(c, sp('Bénédiction de Guérison'))).toBe(false);
  });
});

/**
 * Garde-fou de l'ÉVALUATEUR de sort op-driven (`src/state/aiSpellValue.ts`) — la valeur d'un `GameOp`
 * pour le camp du lanceur, échelle « Blessures-équivalent ». EXHAUSTIF par classification (dégâts /
 * soin / buff marginal / contrôle / invocation / défaut signé) + escompte d'opposition. PUR, déterministe.
 */
import { describe, it, expect } from 'vitest';
import { opValue, oppositionDiscount, type OpEvalCtx } from './aiSpellValue';
import type { SpellData } from '../data';
import type { Combatant, Weapon } from '../engine/types';

const MELEE: Weapon = { name: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] };

function combatant(over: Partial<Combatant> = {}): Combatant {
  return {
    id: 'c', name: 'c', kind: 'enemy',
    characteristics: { CC: 40, CT: 40, F: 40, E: 40, I: 40, Ag: 40, Dex: 40, Int: 40, FM: 40, Soc: 40 },
    wounds: { current: 12, max: 12, base: 12 }, advantage: 0, conditions: [], weapons: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], movement: 4, pos: { x: 0, y: 0 }, ...over,
  } as Combatant;
}
const ctxOf = (refEnemy: Combatant | null = null): OpEvalCtx => ({ refEnemy, horizon: 3 });
const op = (o: object): never => o as never;

describe('opValue — DÉGÂTS (wounds), espérance mitigée correcte', () => {
  const caster = () => combatant();
  it('wounds par DÉFAUT ignore BE+PA → vaut le montant plein', () => {
    const target = combatant({ characteristics: { CC: 30, CT: 30, F: 30, E: 40, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 }, armour: { tete: 0, brasG: 0, brasD: 0, corps: 4, jambeG: 0, jambeD: 0 } });
    expect(opValue(op({ op: 'wounds', amount: 6 }), caster(), target, ctxOf())).toBe(6);
  });
  it('wounds ignoreTB:false & ignoreAP:false → DÉDUIT le Bonus d’Endurance et les PA Corps', () => {
    const target = combatant({ characteristics: { CC: 30, CT: 30, F: 30, E: 40, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 }, armour: { tete: 0, brasG: 0, brasD: 0, corps: 3, jambeG: 0, jambeD: 0 } });
    // 8 − BE(4) − PA(3) = 1
    expect(opValue(op({ op: 'wounds', amount: 8, ignoreTB: false, ignoreAP: false }), caster(), target, ctxOf())).toBe(1);
  });
});

describe('opValue — SOIN plafonné aux PB manquants', () => {
  it('heal 6 sur un allié qui n’a perdu que 3 PB → 3 (jamais du soin gâché)', () => {
    const ally = combatant({ wounds: { current: 9, max: 12, base: 12 } });
    expect(opValue(op({ op: 'heal', amount: 6 }), combatant(), ally, ctxOf())).toBe(3);
  });
  it('heal 6 sur un allié à 2/12 → 6 (le soin entier est récupérable)', () => {
    const ally = combatant({ wounds: { current: 2, max: 12, base: 12 } });
    expect(opValue(op({ op: 'heal', amount: 6 }), combatant(), ally, ctxOf())).toBe(6);
  });
});

describe('opValue — BUFF de combat = bénéfice marginal (armé > 0, désarmé = 0)', () => {
  const buff = op({ op: 'charMod', char: 'CC', mod: 10 });
  const ref = combatant({ id: 'h', kind: 'hero', pos: { x: 2, y: 0 } });
  it('subject ARMÉ → +10 CC améliore l’EV d’attaque → > 0', () => {
    expect(opValue(buff, combatant(), combatant({ id: 's', weapons: [MELEE] }), ctxOf(ref))).toBeGreaterThan(0);
  });
  it('subject SANS arme → aucune attaque à améliorer → 0', () => {
    expect(opValue(buff, combatant(), combatant({ id: 's', weapons: [] }), ctxOf(ref))).toBe(0);
  });
  it('charMod NÉGATIF (débuff) sur un ennemi → valeur de contrôle > 0 (magnitude)', () => {
    expect(opValue(op({ op: 'charMod', char: 'CC', mod: -20 }), combatant(), combatant({ id: 'h' }), ctxOf())).toBeGreaterThan(0);
  });
});

describe('opValue — CONTRÔLE (condition) = aiThreat de etats.json', () => {
  it('Sonné (op:condition) → aiThreat lu en donnée sur etats.json (6)', () => {
    expect(opValue(op({ op: 'condition', name: 'sonne' }), combatant(), combatant({ id: 'h' }), ctxOf())).toBe(6);
  });
  it('État inconnu → 1 (contrôle mineur, jamais 0)', () => {
    expect(opValue(op({ op: 'condition', name: 'inexistant' }), combatant(), combatant({ id: 'h' }), ctxOf())).toBe(1);
  });
});

describe('opValue — INVOCATION', () => {
  it('summon ALLIÉ → > 0 (vaut la créature invoquée)', () => {
    expect(opValue(op({ op: 'summon', ref: 'Loup', count: 1, allyOfCaster: true }), combatant(), combatant(), ctxOf())).toBeGreaterThan(0);
  });
  it('summon HORS DE CONTRÔLE (allyOfCaster:false, démon non lié) → 0 pour le lanceur', () => {
    expect(opValue(op({ op: 'summon', ref: 'Sanguinaire de Khorne', count: 1, allyOfCaster: false }), combatant(), combatant(), ctxOf())).toBe(0);
  });
});

describe('opValue — DÉFAUT signé (longue traîne) : jamais de faux 0 silencieux', () => {
  it('op BÉNÉFIQUE non explicitement câblée (grantTalent) → petit +', () => {
    expect(opValue(op({ op: 'grantTalent', ref: 'x', times: 1 }), combatant(), combatant(), ctxOf())).toBeGreaterThan(0);
  });
  it('op HOSTILE non explicitement câblée (contractDisease) → petit + (contrôle)', () => {
    expect(opValue(op({ op: 'contractDisease', ref: 'x' }), combatant(), combatant({ id: 'h' }), ctxOf())).toBeGreaterThan(0);
  });
  it('op NEUTRE / inconnue → 0 (pas de gain inventé)', () => {
    expect(opValue(op({ op: '__inconnue__' }), combatant(), combatant(), ctxOf())).toBe(0);
  });
});

describe('oppositionDiscount — Sorts de Contact / résistés (LDB 46 l.123-124)', () => {
  const caster = () => combatant({ characteristics: { CC: 40, CT: 40, F: 40, E: 40, I: 40, Ag: 40, Dex: 40, Int: 40, FM: 40, Soc: 40 } });
  const target = () => combatant({ id: 'h', characteristics: { CC: 40, CT: 40, F: 40, E: 40, I: 40, Ag: 40, Dex: 40, Int: 40, FM: 40, Soc: 40 } });
  const spell = (opposed?: SpellData['opposed']): SpellData => ({ id: 'sp', label: 'Sort', type: 'sort', subType: null, family: 'arcane', cn: 0, range: null, target: null, duration: null, desc: '', opposed, source: { book: 'LDB', page: 0 } } as SpellData);

  it('Sort de Contact (opposé) → escompte < 1', () => {
    expect(oppositionDiscount(spell({ kind: 'contact' }), caster(), target())).toBeLessThan(1);
  });
  it('Sort résisté → 0.5', () => {
    expect(oppositionDiscount(spell({ kind: 'resist', char: 'FM' }), caster(), target())).toBe(0.5);
  });
  it('Sort NON opposé → ×1 (passe à coup sûr)', () => {
    expect(oppositionDiscount(spell(undefined), caster(), target())).toBe(1);
  });
});

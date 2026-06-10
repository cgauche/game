/**
 * Risques d'incantation & Focalisation (LDB 46 l.52-59, 176, 180-199) :
 * spécialisation par Vent, maladresse de Focalisation élargie, « Repousser les
 * Vents » (−1 DR/PA d'armure portée), Avantage sur l'Incantation (pas la
 * Focalisation).
 */
import { describe, it, expect } from 'vitest';
import type { Combatant, ItemInstance } from './types';
import { makeRNG } from './dice';
import {
  resolveFocus, castingValue, armourCastDRPenalty, resolveCasting, focusSkillFor,
} from './magic';

function wiz(p: Partial<Combatant> = {}): Combatant {
  return {
    id: 'w', name: 'Sorcière', kind: 'hero',
    characteristics: { CC: 30, CT: 30, F: 30, E: 40, I: 30, Ag: 30, Dex: 30, Int: 50, FM: 45, Soc: 30 },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], movement: 4,
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [
      { name: 'Langue', spec: 'Magick', advances: 10 },
      { name: 'Focalisation', spec: 'Feu', advances: 10 },
    ] as never,
    talents: [],
    ...p,
  } as Combatant;
}

const SORT_FEU = { label: 'Boule', type: 'Magie des Arcanes', subType: 'Feu', cn: 5, desc: 'x' };
const SORT_OMBRES = { label: 'Voile', type: 'Magie des Arcanes', subType: 'Ombres', cn: 4, desc: 'x' };
const SORT_COMMUN = { label: 'Arme aethyrique', type: 'Magie des Arcanes', subType: null, cn: 2, desc: 'x' };

describe('Focalisation — spécialisation par Vent (LDB 46)', () => {
  it('un sort de Domaine exige la Focalisation du MÊME Vent', () => {
    const c = wiz();
    expect(focusSkillFor(c, SORT_FEU)).toBeTruthy();
    expect(focusSkillFor(c, SORT_OMBRES)).toBeUndefined();
    const r = resolveFocus(c, SORT_OMBRES, makeRNG(1));
    expect(r.roll).toBe(0);
    expect(r.log).toContain('Focalisation (Ombres)');
  });
  it('un sort d\'Arcane commun accepte n\'importe quel Vent ; une compétence sans spec accepte tout', () => {
    expect(focusSkillFor(wiz(), SORT_COMMUN)).toBeTruthy();
    const legacy = wiz({ skills: [{ name: 'Focalisation', advances: 8 }] as never });
    expect(focusSkillFor(legacy, SORT_FEU)).toBeTruthy();
  });
});

describe('Focalisation — maladresse élargie (l.190-191)', () => {
  it('un échec se terminant par 0 (non-double) est une Maladresse ; un échec quelconque non', () => {
    // FM 45 + 10 → valeur 55. roll 90 (échec, finit par 0) → fumble ; roll 87 (échec) → non.
    const c = wiz();
    // On force les jets via un RNG stub.
    const rngFor = (roll: number) => ({ int: (lo: number, hi: number) => (hi === 100 ? roll : lo), next: () => 0.5 }) as never;
    const f90 = resolveFocus(c, SORT_FEU, rngFor(90));
    expect(f90.isFumble).toBe(true);
    const f87 = resolveFocus(c, SORT_FEU, rngFor(87));
    expect(f87.isFumble).toBe(false);
    const f99 = resolveFocus(c, SORT_FEU, rngFor(99)); // double raté
    expect(f99.isFumble).toBe(true);
    const f44 = resolveFocus(c, SORT_FEU, rngFor(44)); // double RÉUSSI → critique, pas maladresse
    expect(f44.isFumble).toBe(false);
    expect(f44.isCritical).toBe(true);
  });
});

describe('« Repousser les Vents » — armure portée (l.199 + exemptions l.188)', () => {
  const mailles: ItemInstance = { uid: 'a1', name: 'Chemise de mailles', kind: 'armor', enc: 2, equipped: true, pa: 2, locs: ['corps'], qualities: [] } as never;
  const cuir: ItemInstance = { uid: 'a2', name: 'Veste de cuir', kind: 'armor', enc: 1, equipped: true, pa: 1, locs: ['corps'], qualities: [] } as never;
  it('−1 DR par PA de la pièce la mieux protégée', () => {
    expect(armourCastDRPenalty(wiz())).toBe(0);
    expect(armourCastDRPenalty(wiz({ items: [mailles, cuir] }))).toBe(2);
  });
  it('Magie des Arcanes (Métal) ignore le métal ; (Bêtes) ignore le cuir', () => {
    const metalMage = wiz({ items: [mailles], talents: [{ name: 'Magie des Arcanes (Métal)', times: 1 }] });
    expect(armourCastDRPenalty(metalMage)).toBe(0);
    const beastMage = wiz({ items: [cuir], talents: [{ name: 'Magie des Arcanes (Bêtes)', times: 1 }] });
    expect(armourCastDRPenalty(beastMage)).toBe(0);
    // …mais pas l'inverse.
    expect(armourCastDRPenalty(wiz({ items: [mailles], talents: [{ name: 'Magie des Arcanes (Bêtes)', times: 1 }] }))).toBe(2);
  });
  it('le DR d\'incantation est réduit par l\'armure (succès conservé)', () => {
    // Valeur 60 (Int 50 + 10) ; jet 10 → DR +5 ; armure 2 PA → DR +3.
    const c = wiz({ items: [mailles] });
    const rngFor = (roll: number) => ({ int: (lo: number, hi: number) => (hi === 100 ? roll : lo), next: () => 0.5 }) as never;
    const res = resolveCasting(c, SORT_COMMUN, rngFor(10));
    expect(res.sl).toBe(3);
    expect(res.cast).toBe(true); // DR 3 ≥ NI 2
  });
});

describe('Avantage et magie (l.176)', () => {
  it('l\'Avantage s\'applique à l\'Incantation (+10/point), PAS à la Focalisation', () => {
    const c = wiz({ advantage: 2 });
    expect(castingValue(c, 'Langue', 'Magick')).toBe(50 + 10 + 20);
    expect(castingValue(c, 'Focalisation', 'Feu')).toBe(45 + 10);
  });
});

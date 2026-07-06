import { describe, it, expect } from 'vitest';
import { warMachineCrewPenalty, warMachineCrewRequired, warMachineFireWeapon } from './warMachineCrew';
import type { Weapon } from './types';

/**
 * Équipe des machines de guerre ADE II ch.08 l.233 : « Les armes sans Équipe complète peuvent être
 * utilisées avec une pénalité de –20. Elles ne peuvent être utilisées avec moins de la moitié de
 * l'Équipe nécessaire. » 3ᵉ courbe de sous-effectif — DISTINCTE de `crewedPenalty` (AA) et
 * `undercrewPenalty` (MDG) : PAS de recharge doublée, PAS de Défaut ajouté, PAS de tranches de 10 %.
 */
describe('warMachineCrewPenalty — ADE II ch.08 l.233', () => {
  it('Équipe au complet : aucune pénalité', () => {
    expect(warMachineCrewPenalty(4, 4)).toEqual({ toHitMod: 0, unusable: false });
    expect(warMachineCrewPenalty(6, 4)).toEqual({ toHitMod: 0, unusable: false }); // surnombre : toujours net
  });

  it('Équipe incomplète (≥ moitié) : −20, toujours utilisable', () => {
    expect(warMachineCrewPenalty(3, 4)).toEqual({ toHitMod: -20, unusable: false }); // 3/4 : incomplète mais ≥ moitié (2)
    expect(warMachineCrewPenalty(2, 4)).toEqual({ toHitMod: -20, unusable: false }); // exactement la moitié : encore utilisable
  });

  it('sous la moitié de l\'Équipe requise : INUTILISABLE (+ le −20 reste dû)', () => {
    expect(warMachineCrewPenalty(1, 4)).toEqual({ toHitMod: -20, unusable: true });
    expect(warMachineCrewPenalty(0, 6)).toEqual({ toHitMod: -20, unusable: true });
  });

  it('Équipe requise 0 (arme normale, ou Qualité absente) : jamais de pénalité', () => {
    expect(warMachineCrewPenalty(0, 0)).toEqual({ toHitMod: 0, unusable: false });
  });

  it('présent négatif (défensif) : plancher à 0', () => {
    expect(warMachineCrewPenalty(-3, 4)).toEqual({ toHitMod: -20, unusable: true });
  });
});

describe('warMachineCrewRequired — lit l\'Indice de la Qualité `equipe`', () => {
  it('arme sans Qualité equipe → 0', () => {
    const w: Weapon = { name: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] };
    expect(warMachineCrewRequired(w)).toBe(0);
  });

  it('arme avec Qualité equipe(N) → N', () => {
    const w: Weapon = { name: 'Trébuchet', type: 'ranged', damage: { plusBF: false, flat: 14 }, qualities: [{ id: 'equipe', value: 8 }] };
    expect(warMachineCrewRequired(w)).toBe(8);
  });
});

describe('warMachineFireWeapon — bake le malus PLAT, ORTHOGONAL à la Recharge/aux Qualités (≠ crewedFireWeapon AA)', () => {
  const belier = (): Weapon => ({
    name: 'Bélier', type: 'melee', damage: { plusBF: true, flat: 10 }, reach: 'Moyenne',
    qualities: [{ id: 'siege' }, { id: 'belier' }, { id: 'devastatrice' }, { id: 'percutante' }, { id: 'equipe', value: 6 }],
    resolveChar: 'F',
  });

  it('Équipe au complet (6/6) : arme INCHANGÉE (aucun crewTeamPenalty)', () => {
    const w = warMachineFireWeapon(belier(), 6);
    expect(w.crewTeamPenalty).toBeUndefined();
    expect(w.qualities).toEqual(belier().qualities); // AUCUN Défaut ajouté (≠ AA)
    expect(w.reload).toBeUndefined(); // AUCUNE recharge touchée (≠ AA)
  });

  it('Équipe incomplète (3/6) : −20 baké, Qualités/Recharge INTACTES', () => {
    const w = warMachineFireWeapon(belier(), 3);
    expect(w.crewTeamPenalty).toBe(-20);
    expect(w.qualities).toEqual(belier().qualities);
  });

  it('sous la moitié (2/6) : le −20 reste baké ici — l\'inutilisable est un gate SÉPARÉ (firedAttackBlock)', () => {
    const w = warMachineFireWeapon(belier(), 2);
    expect(w.crewTeamPenalty).toBe(-20);
  });

  it('cumule un crewTeamPenalty déjà présent (composition sûre)', () => {
    const w = warMachineFireWeapon({ ...belier(), crewTeamPenalty: -20 }, 3);
    expect(w.crewTeamPenalty).toBe(-40);
  });

  it('arme sans Qualité equipe → inchangée telle quelle (identité)', () => {
    const w: Weapon = { name: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] };
    expect(warMachineFireWeapon(w, 0)).toBe(w);
  });
});

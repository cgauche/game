/**
 * Deltas d'incantation des Vents de Magie sous l'option `magic-vdm-incantation` :
 * Influences malveillantes (`VDM 02 l.157-159`), Tableaux des Incantations Imparfaites
 * (`VDM 02 l.218-263`) et Surincantation révisée (`VDM 02 l.194-215`).
 *
 * Chaque cas est mesuré OPTION OFF puis ON sur le MÊME appel : le volet OFF est la garde de
 * non-régression du Livre de base, le volet ON rougit si le point de lecture est débranché.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { setRule, resetRule } from './policy';
import { malevolentInfluenceSeverity } from './magic';
import { rollMiscast } from './miscast';
import type { RNG } from './dice';
import {
  overcastBudget,
  extraTargetCapacity,
  overcastDurationParts,
  effectiveRangeMetres,
  zoneDiameterMultiplier,
  missileOvercastDamageBonus,
} from './overcast';
import { domains, findEffectTableById } from '../data';
import miscastJson from '../data/miscast.json';

const RULE = 'magic-vdm-incantation';

afterEach(() => resetRule(RULE));

describe('Influences malveillantes — `VDM 02 l.157-159`', () => {
  it('option OFF : seul le dé des unités à 8 déclenche (LDB 46 l.89)', () => {
    expect(malevolentInfluenceSeverity(37, false, true, false)).toBeNull();
    expect(malevolentInfluenceSeverity(38, false, true, false)).toBe('mineure');
  });

  it('option ON : TOUT lancer raté près d’une Corruption déclenche une Mineure', () => {
    setRule(RULE, true);
    expect(malevolentInfluenceSeverity(37, false, true, false)).toBe('mineure');
  });

  it('option ON : un lancer RÉUSSI ne déclenche plus rien, même en 8', () => {
    setRule(RULE, true);
    expect(malevolentInfluenceSeverity(38, true, true, false)).toBeNull();
  });

  it('option ON : escalade en Majeure si une Mineure est déjà due au même Test', () => {
    setRule(RULE, true);
    expect(malevolentInfluenceSeverity(37, false, true, true)).toBe('majeure');
  });

  it('hors proximité d’une Corruption : rien, quelle que soit l’option', () => {
    expect(malevolentInfluenceSeverity(38, false, false, false)).toBeNull();
    setRule(RULE, true);
    expect(malevolentInfluenceSeverity(37, false, false, false)).toBeNull();
  });
});

describe('Tableaux des Incantations Imparfaites — `VDM 02 l.218-263`', () => {
  const data = miscastJson as { minorVdm: { min: number; max: number }[]; majorVdm: { min: number; max: number }[] };

  it('20 rangées par table, fourchettes contiguës de 01 à 00', () => {
    for (const rows of [data.minorVdm, data.majorVdm]) {
      expect(rows).toHaveLength(20);
      expect(rows[0].min).toBe(1);
      expect(rows[rows.length - 1].max).toBe(100);
      rows.forEach((r, i) => { if (i > 0) expect(r.min).toBe(rows[i - 1].max + 1); });
    }
  });

  /** Jet figé sur 88 : la rangée 86-90 de la table Mineure VDM (« Marqué par la Magie »). */
  const rngOn88 = (): RNG => ({ int: () => 88 });

  it('option OFF : 88 tire « Double problème » (table du Livre de base)', () => {
    expect(rollMiscast('mineure', rngOn88()).label).toBe('Double problème');
  });

  it('option ON : 88 tire « Marqué par la Magie »', () => {
    setRule(RULE, true);
    expect(rollMiscast('mineure', rngOn88(), 0, 'feu').label).toBe('Marqué par la Magie');
  });

  it('option ON, lanceur d’un Domaine de Couleur : la rangée tire sur la table de MARQUES de SON Vent', () => {
    setRule(RULE, true);
    for (const d of domains.filter((x) => x.tables?.arcaneMark)) {
      const ops = rollMiscast('mineure', rngOn88(), 0, d.id).ops;
      expect(ops, `${d.id} : aucune op de tirage`).toContainEqual({ op: 'rollTable', tableId: d.tables!.arcaneMark });
      expect(findEffectTableById(d.tables!.arcaneMark).rows).toHaveLength(10);
    }
  });

  it('option ON, tradition sans table de Marques : nouveau lancer sur le Tableau Majeur (`VDM 02 l.238`)', () => {
    setRule(RULE, true);
    // Jet figé sur 88 : la rangée « Marqué par la Magie », puis 88 sur le Majeur (« Puanteur infernale »).
    const sansTable = rollMiscast('mineure', rngOn88(), 0, 'necromancie');
    expect(sansTable.label).toBe('Marqué par la Magie → Puanteur infernale');
    expect(sansTable.rolls).toEqual([88, 88]);
    expect(rollMiscast('mineure', rngOn88()).label).toBe('Marqué par la Magie → Puanteur infernale');
  });

  it('option ON : AUCUN Domaine sans table de Marques ne reste sans conséquence', () => {
    setRule(RULE, true);
    const sansMarque = domains.filter((d) => !d.tables?.arcaneMark);
    expect(sansMarque.length).toBeGreaterThan(0);
    for (const d of sansMarque) {
      expect(rollMiscast('mineure', rngOn88(), 0, d.id).label, d.id).toMatch(/^Marqué par la Magie → /);
    }
  });
});

describe('Surincantation révisée — `VDM 02 l.194-215`', () => {
  it('budget : option OFF = +2 DR par pas (LDB 47) ; ON = le surplus DR par DR', () => {
    expect(overcastBudget('arcane', 12, 4)).toBe(4);
    setRule(RULE, true);
    expect(overcastBudget('arcane', 12, 4)).toBe(8);
  });

  it('Bénédictions et Miracles restent au barème du Livre de base sous l’option', () => {
    setRule(RULE, true);
    expect(overcastBudget('blessing', 12, 0)).toBe(6);
    expect(overcastBudget('miracle', 12, 0)).toBe(6);
  });

  it('Tableau de Surincantation : les paliers 1/2/3/5/8/13/21 de chaque colonne', () => {
    setRule(RULE, true);
    expect([1, 2, 3, 5, 8, 13, 21].map((dr) => extraTargetCapacity('arcane', dr, 3))).toEqual([1, 1, 1, 2, 2, 2, 3]);
    expect([1, 2, 3, 5, 8, 13, 21].map((dr) => effectiveRangeMetres('arcane', 10, dr))).toEqual([20, 20, 20, 30, 30, 30, 40]);
    expect([1, 2, 3, 5, 8, 13, 21].map((dr) => zoneDiameterMultiplier('arcane', dr))).toEqual([1, 1, 2, 2, 2, 2, 3]);
    expect([1, 2, 3, 5, 8, 13, 21].map((dr) => overcastDurationParts('arcane', dr).mult)).toEqual([1, 2, 2, 2, 3, 3, 3]);
    expect([1, 2, 3, 5, 8, 13, 21].map((dr) => missileOvercastDamageBonus('arcane', dr))).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('option OFF : le barème du Livre de base est intact (×initial par pas)', () => {
    expect(extraTargetCapacity('arcane', 2, 3)).toBe(6);
    expect(effectiveRangeMetres('arcane', 10, 2)).toBe(30);
    expect(zoneDiameterMultiplier('arcane', 2)).toBe(3);
    expect(overcastDurationParts('arcane', 2)).toEqual({ mult: 3, bonusRounds: 0 });
    expect(missileOvercastDamageBonus('arcane', 2)).toBe(0); // LDB : pas de colonne Dégât, le DR s'ajoute ailleurs
  });

  it('0 DR dépensé sur une colonne : aucun effet, quelle que soit l’option', () => {
    setRule(RULE, true);
    expect(extraTargetCapacity('arcane', 0, 3)).toBe(0);
    expect(effectiveRangeMetres('arcane', 10, 0)).toBe(10);
    expect(zoneDiameterMultiplier('arcane', 0)).toBe(1);
    expect(overcastDurationParts('arcane', 0)).toEqual({ mult: 1, bonusRounds: 0 });
    expect(missileOvercastDamageBonus('arcane', 0)).toBe(0);
  });
});

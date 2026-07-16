import { describe, it, expect } from 'vitest';
import { sheetAlarms, alarmsFingerprint, ETAT_ANCHOR_CORRUPTION, ETAT_ANCHOR_MALADIES, ETAT_ANCHOR_ENCOMBREMENT, ETAT_ANCHOR_TRAUMAS } from './sheetAlarms';
import type { Combatant, Trauma, ItemInstance } from '../engine/types';
import type { Disease } from '../engine/disease';
import type { Mutation } from '../engine/corruption';

/** Héros de test minimal — mêmes caractéristiques que le patron `EquipmentPanel.test.tsx` (mkHero). */
const mkHero = (mut?: (c: Combatant) => void): Combatant => {
  const c = {
    id: 'h',
    name: 'H',
    kind: 'hero',
    species: 'Humains (Reiklander)',
    career: 'Soldat',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 12, max: 12 },
    conditions: [],
    skills: [],
    talents: [],
    movement: 4,
    items: [],
  } as unknown as Combatant;
  mut?.(c);
  return c;
};

const mkDisease = (name: string): Disease => ({
  name,
  symptoms: [],
  phase: 'active',
  minutesLeft: 100,
  durationMinutes: 100,
});

const mkItem = (uid: string, enc: number): ItemInstance => ({ uid, kind: 'misc', enc, qualities: [] } as unknown as ItemInstance);

describe('sheetAlarms', () => {
  it('héros sain : aucune alarme', () => {
    expect(sheetAlarms(mkHero())).toEqual([]);
  });

  it('héros corrompu + malade + surchargé : alarmes attendues avec leurs ancres', () => {
    const hero = mkHero((c) => {
      c.corruption = 3;
      c.diseases = [mkDisease('Fièvre Sanguinaire')];
      c.items = [mkItem('x', 999)];
    });
    const alarms = sheetAlarms(hero);
    const byKey = Object.fromEntries(alarms.map((a) => [a.key, a]));
    expect(byKey['corruption']).toMatchObject({ label: 'Corruption 3', anchor: ETAT_ANCHOR_CORRUPTION, tone: 'warn' });
    expect(byKey['maladie-Fièvre Sanguinaire']).toMatchObject({ label: 'Fièvre Sanguinaire', anchor: ETAT_ANCHOR_MALADIES, tone: 'danger' });
    expect(byKey['surcharge']).toMatchObject({ label: 'Surchargé', anchor: ETAT_ANCHOR_ENCOMBREMENT, tone: 'warn' });
  });

  it('trauma cosmétique seul (cicatrice) : pas d’alarme Traumas', () => {
    const hero = mkHero((c) => {
      c.traumas = [{ label: 'Cicatrice', location: 'corps', cosmetic: true } as Trauma];
    });
    expect(sheetAlarms(hero).some((a) => a.anchor === ETAT_ANCHOR_TRAUMAS)).toBe(false);
  });

  it('trauma NON cosmétique : alarme Traumas', () => {
    const hero = mkHero((c) => {
      c.traumas = [{ label: 'Bras cassé', location: 'brasG' } as Trauma];
    });
    expect(sheetAlarms(hero).find((a) => a.anchor === ETAT_ANCHOR_TRAUMAS)).toMatchObject({ label: 'Traumas 1', tone: 'warn' });
  });

  it('fingerprint : stable pour le même relevé, différent si une alarme s’ajoute', () => {
    const hero = mkHero((c) => { c.corruption = 1; });
    const fp1 = alarmsFingerprint(sheetAlarms(hero));
    const fp2 = alarmsFingerprint(sheetAlarms(hero));
    expect(fp1).toBe(fp2);
    hero.mutations = [{ label: 'Griffes', kind: 'physique' } as Mutation];
    const fp3 = alarmsFingerprint(sheetAlarms(hero));
    expect(fp3).not.toBe(fp1);
  });
});

import { describe, it, expect } from 'vitest';
import { traumaFromKind, traumaMovementHalved } from './trauma';
import { effectiveChar } from './characteristics';
import { effectiveMovement } from './encumbrance';
import { defenseValue } from './combat';
import type { Combatant } from './types';

function c(traumas: Combatant['traumas']): Combatant {
  return { traumas } as Combatant;
}

function fullCombatant(over: Partial<Combatant> = {}): Combatant {
  return {
    id: 'h', name: 'T', kind: 'hero',
    characteristics: { CC: 40, CT: 40, F: 40, E: 40, I: 40, Ag: 40, Dex: 40, Int: 40, FM: 40, Soc: 40 },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], movement: 4, items: [],
    ...over,
  } as Combatant;
}

describe('traumaFromKind (LDB 18-Traumatisme)', () => {
  it('Déchirure musculaire sur Jambe → Mouvement ÷2', () => {
    const t = traumaFromKind('dechirure', 'mineur', 'jambeD');
    expect(t.movementHalved).toBe(true);
    expect(t.label).toBe('Déchirure musculaire (Mineure)');
    expect(t.location).toBe('jambeD');
  });
  it('Déchirure musculaire sur Bras → aucun effet modélisé (enregistré)', () => {
    const t = traumaFromKind('dechirure', 'mineur', 'brasG');
    expect(t.movementHalved).toBeFalsy();
    expect(t.charPenalty).toBeUndefined();
  });
  it('Fracture Torse → F/Ag −30 + Mouvement ÷2', () => {
    const t = traumaFromKind('fracture', 'majeur', 'corps');
    expect(t.charPenalty).toEqual({ F: -30, Ag: -30 });
    expect(t.movementHalved).toBe(true);
    expect(t.label).toBe('Fracture (Majeure)');
  });
  it('Fracture Jambe → Mouvement ÷2, pas de charPenalty', () => {
    const t = traumaFromKind('fracture', 'mineur', 'jambeG');
    expect(t.movementHalved).toBe(true);
    expect(t.charPenalty).toBeUndefined();
  });
  it('Fracture Bras → aucun effet modélisé (latéralité non modélisée)', () => {
    const t = traumaFromKind('fracture', 'mineur', 'brasD');
    expect(t.movementHalved).toBeFalsy();
    expect(t.charPenalty).toBeUndefined();
  });
});

describe('traumaMovementHalved', () => {
  it('vrai si un trauma réduit le Mouvement', () => {
    expect(traumaMovementHalved(c([traumaFromKind('fracture', 'mineur', 'jambeG')]))).toBe(true);
    expect(traumaMovementHalved(c([traumaFromKind('fracture', 'mineur', 'brasD')]))).toBe(false);
    expect(traumaMovementHalved(c(undefined))).toBe(false);
  });
});

describe('traumas — câblage moteur', () => {
  it('Fracture Torse réduit Force et Agilité de 30 (effectiveChar)', () => {
    const cc = fullCombatant({ traumas: [traumaFromKind('fracture', 'mineur', 'corps')] });
    expect(effectiveChar(cc, 'F')).toBe(10);  // 40 − 30
    expect(effectiveChar(cc, 'Ag')).toBe(10);
    expect(effectiveChar(cc, 'CC')).toBe(40); // non touché
  });
  it('Trauma de jambe réduit le Mouvement effectif de moitié', () => {
    const cc = fullCombatant({ traumas: [traumaFromKind('fracture', 'mineur', 'jambeG')] });
    expect(effectiveMovement(cc)).toBe(2); // floor(4/2)
  });
  it('Sans trauma de mouvement, Mouvement inchangé', () => {
    const cc = fullCombatant({ traumas: [traumaFromKind('fracture', 'mineur', 'brasD')] });
    expect(effectiveMovement(cc)).toBe(4);
  });
  it('Fracture de jambe réduit l’Esquive de 20 (règle du Pied, LDB 18 l.369)', () => {
    const sain = fullCombatant();
    expect(defenseValue(sain, 'esquive')).toBe(40); // Ag 40, pas de pénalité
    const blesse = fullCombatant({ traumas: [traumaFromKind('fracture', 'mineur', 'jambeG')] });
    expect(defenseValue(blesse, 'esquive')).toBe(20); // 40 − 20 (mobilité)
  });
  it('Déchirure de jambe Mineure réduit l’Esquive de 10', () => {
    const c = fullCombatant({ traumas: [traumaFromKind('dechirure', 'mineur', 'jambeD')] });
    expect(defenseValue(c, 'esquive')).toBe(30); // 40 − 10
  });
});

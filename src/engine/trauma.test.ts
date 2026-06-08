import { describe, it, expect } from 'vitest';
import { traumaFromKind, traumaMovementHalved, traumaDodgePenalty, traumaCharPenalties } from './trauma';
import { effectiveChar } from './characteristics';
import { effectiveMovement } from './encumbrance';
import { defenseValue } from './combat';
import type { Combatant, ItemInstance, Trauma } from './types';

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

describe('Prothèses — annulation de la séquelle d’amputation de jambe (LDB 73)', () => {
  const legSequela: Trauma = {
    label: 'Membre inférieur amputé (jambeD)', location: 'jambeD', movementHalved: true, dodgePenalty: -20,
    prosthesis: [{ name: "Merveille d'ingénierie", cancels: 'all' }, { name: 'Fausse jambe', cancels: 'movement' }],
    note: '',
  };
  // Une prothèse doit être PORTÉE (équipée) pour lever le malus (LDB 73), pas seulement possédée.
  const item = (name: string, equipped = true): ItemInstance => ({ uid: name, name, kind: 'misc', subType: 'Prothèses', qualities: [], enc: 0, equipped } as ItemInstance);

  it('sans prothèse : Mouvement ÷2 et −20 Esquive s’appliquent', () => {
    const c = fullCombatant({ traumas: [legSequela], items: [] });
    expect(traumaMovementHalved(c)).toBe(true);
    expect(traumaDodgePenalty(c)).toBe(-20);
  });
  it('Fausse jambe portée : rétablit le déplacement, l’Esquive reste pénalisée (200 PX non modélisés)', () => {
    const c = fullCombatant({ traumas: [legSequela], items: [item('Fausse jambe')] });
    expect(traumaMovementHalved(c)).toBe(false);
    expect(traumaDodgePenalty(c)).toBe(-20);
  });
  it('Merveille d’ingénierie portée : annule TOUT (déplacement + Esquive)', () => {
    const c = fullCombatant({ traumas: [legSequela], items: [item("Merveille d'ingénierie")] });
    expect(traumaMovementHalved(c)).toBe(false);
    expect(traumaDodgePenalty(c)).toBe(0);
  });
  it('prothèse perdue (retirée des items) : la pénalité revient', () => {
    const c = fullCombatant({ traumas: [legSequela], items: [item('Couverture')] });
    expect(traumaMovementHalved(c)).toBe(true);
  });
  it('prothèse POSSÉDÉE mais non portée (au sac) : le malus reste — il faut l’ÉQUIPER (LDB 73)', () => {
    const c = fullCombatant({ traumas: [legSequela], items: [item('Fausse jambe', false)] }); // equipped:false
    expect(traumaMovementHalved(c)).toBe(true);
  });

  it('Nez doré annule le −20 Sociabilité de l’amputation du nez (charPenalty, LDB 73)', () => {
    const nez: Trauma = { label: 'Nez amputé', location: 'tete', charPenalty: { Soc: -20 }, prosthesis: [{ name: 'Nez doré', cancels: 'all' }], note: '' };
    expect(traumaCharPenalties(fullCombatant({ traumas: [nez], items: [] }), 'Soc')).toEqual([-20]);
    expect(traumaCharPenalties(fullCombatant({ traumas: [nez], items: [item('Nez doré')] }), 'Soc')).toEqual([]);
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

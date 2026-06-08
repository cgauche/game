import { describe, it, expect } from 'vitest';
import { traumaFromKind, traumaMovementHalved, traumaDodgePenalty, traumaCharPenalties, escalateSensoryLoss, consolidateAmputations } from './trauma';
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
  it('Fausse jambe ENTRAÎNÉE (200 PX, LDB 73) rétablit AUSSI l’Esquive', () => {
    const trained: ItemInstance = { ...item('Fausse jambe'), prosthesisTrained: true };
    const c = fullCombatant({ traumas: [legSequela], items: [trained] });
    expect(traumaMovementHalved(c)).toBe(false);
    expect(traumaDodgePenalty(c)).toBe(0); // entraînée → −20 Esquive levé
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

describe('consolidateAmputations — cumul doigts (l.341/344) & dents (l.338)', () => {
  const finger = (loc: 'brasG' | 'brasD', count = 1): Trauma => ({ label: `Doigts amputés (${loc})`, location: loc, count, charPenalty: loc === 'brasD' ? { CC: -5 * count, CT: -5 * count } : undefined, note: '' });
  const teeth = (count: number): Trauma => ({ label: 'Dents perdues', location: 'tete', count, note: '' });

  it('cas réel : 1 doigt (main droite) + 3 dents → −5 CC/CT et −1 Soc (3 dents = 1 paire)', () => {
    const c = fullCombatant({ traumas: [finger('brasD', 1), teeth(3)] });
    consolidateAmputations(c);
    const f = (c.traumas ?? []).find((t) => t.label?.startsWith('Doigts amputés'))!;
    expect(f.charPenalty).toEqual({ CC: -5, CT: -5 });
    const d = (c.traumas ?? []).find((t) => t.label === 'Dents perdues')!;
    expect(d.count).toBe(3);
    expect(d.charPenalty).toEqual({ Soc: -1 }); // floor(3/2) = 1 paire
  });

  it('deux pertes de doigts (même main) fusionnent : −10 CC/CT (count 2)', () => {
    const c = fullCombatant({ traumas: [finger('brasD', 1), finger('brasD', 1)] });
    consolidateAmputations(c);
    const fingers = (c.traumas ?? []).filter((t) => t.label?.startsWith('Doigts amputés'));
    expect(fingers).toHaveLength(1); // fusionné en un seul
    expect(fingers[0].count).toBe(2);
    expect(fingers[0].charPenalty).toEqual({ CC: -10, CT: -10 });
  });

  it('4 doigts perdus → règle de la main tranchée (pas d’arme à 2 mains + −20)', () => {
    const c = fullCombatant({ traumas: [finger('brasD', 3), finger('brasD', 1)] });
    consolidateAmputations(c);
    expect((c.traumas ?? []).some((t) => t.label?.startsWith('Doigts amputés'))).toBe(false); // plus de « doigts »
    const hand = (c.traumas ?? []).find((t) => t.label?.startsWith('Main/bras amputé'))!;
    expect(hand.noTwoHanded).toBe(true);
    expect(hand.charPenalty).toEqual({ CC: -20, CT: -20 });
  });

  it('idempotent : reconsolider ne change rien', () => {
    const c = fullCombatant({ traumas: [teeth(5)] });
    consolidateAmputations(c);
    const before = JSON.stringify(c.traumas);
    consolidateAmputations(c);
    expect(JSON.stringify(c.traumas)).toBe(before);
  });
});

describe('escalateSensoryLoss — cumul deux yeux/oreilles (LDB 18 l.360/363)', () => {
  const eye = (): Trauma => ({ label: 'Œil perdu', location: 'tete', charPenalty: { Soc: -5 }, note: '' });
  const ear = (): Trauma => ({ label: 'Oreille perdue', location: 'tete', charPenalty: { Soc: -5 }, note: '' });
  it('un seul œil : pas de cécité', () => {
    const c = fullCombatant({ traumas: [eye()] });
    expect(escalateSensoryLoss(c)).toHaveLength(0);
    expect((c.traumas ?? []).some((t) => t.label === 'Cécité')).toBe(false);
  });
  it('deux yeux : Cécité (−30 vue : Arme/Esquive/Chevaucher) ; idempotent', () => {
    const c = fullCombatant({ traumas: [eye(), eye()] });
    escalateSensoryLoss(c);
    const cec = (c.traumas ?? []).find((t) => t.label === 'Cécité')!;
    expect(cec.dodgePenalty).toBe(-30);
    expect(cec.charPenalty).toEqual({ CC: -30, CT: -30 });
    expect(escalateSensoryLoss(c)).toHaveLength(0); // pas de doublon
    expect((c.traumas ?? []).filter((t) => t.label === 'Cécité')).toHaveLength(1);
  });
  it('deux oreilles : Surdité (−20 Perception)', () => {
    const c = fullCombatant({ traumas: [ear(), ear()] });
    escalateSensoryLoss(c);
    expect((c.traumas ?? []).find((t) => t.label === 'Surdité')!.skillPenalty).toEqual({ perception: -20 });
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

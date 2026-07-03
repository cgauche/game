import { describe, it, expect } from 'vitest';
import { applyOps, type GameOp } from './ops';
import { effectiveChar } from './characteristics';
import { effectiveMovement } from './encumbrance';
import { endOfRound } from './conditions';
import { liveMorphRef } from './polymorph';
import { hasTraitKey } from './traits/dispatch';
import type { Combatant } from './types';

/**
 * Transformation durable & réversible (op `transform`/`endTransform`) — Métamorphose de l'Enfant d'Ulric
 * (Middenheim p.116) : le tableau RAW est un DELTA appliqué au profil HUMAIN (M+1, CC+10, F/E/I/Ag+10,
 * Dex/Int−10, Soc−20 + Traits hybrides), PERSISTANT (jamais dissipé seul) et TOGGLABLE (retour à volonté).
 * Le `tag` groupe tous les effets → retrait atomique. Générique (aucun nom d'entité en dur dans le moteur).
 */
const HYBRIDE_ULRIC: GameOp[] = [
  { op: 'charMod', char: 'CC', mod: 10 }, { op: 'charMod', char: 'F', mod: 10 },
  { op: 'charMod', char: 'E', mod: 10 }, { op: 'charMod', char: 'I', mod: 10 },
  { op: 'charMod', char: 'Ag', mod: 10 }, { op: 'charMod', char: 'Dex', mod: -10 },
  { op: 'charMod', char: 'Int', mod: -10 }, { op: 'charMod', char: 'Soc', mod: -20 },
  { op: 'moveMod', mod: 1 },
  { op: 'grantTrait', traitId: 'morsure', indice: 3 }, { op: 'grantTrait', traitId: 'armure', indice: 2 },
  { op: 'grantTrait', traitId: 'peur', indice: 2 }, { op: 'grantTrait', traitId: 'pisteur' },
  { op: 'grantTrait', traitId: 'vision-nocturne' },
];

const human = (): Combatant => ({
  id: 'u', name: 'Enfant d’Ulric', kind: 'enemy',
  characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
  movement: 4, wounds: { current: 12, max: 12, base: 12 }, advantage: 0, conditions: [],
  skills: [], talents: [], weapons: [], traits: [{ id: 'metamorphose' }],
  armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
} as unknown as Combatant);

const TAG = 'ulric-hybride';

describe('transform / endTransform — Métamorphose Enfant d’Ulric (delta RAW, Middenheim p.116)', () => {
  it('applique le DELTA du tableau + Traits hybrides + apparence, en une passe', () => {
    const c = human();
    applyOps(c, [{ op: 'transform', tag: TAG, ops: HYBRIDE_ULRIC, morphRef: 'enfant-d-ulric' }], {});
    expect(effectiveChar(c, 'CC')).toBe(40); // +10
    expect(effectiveChar(c, 'F')).toBe(40);
    expect(effectiveChar(c, 'Ag')).toBe(40);
    expect(effectiveChar(c, 'Dex')).toBe(20); // −10
    expect(effectiveChar(c, 'Soc')).toBe(10); // −20
    expect(effectiveChar(c, 'FM')).toBe(30); // inchangé (— dans le tableau)
    expect(effectiveMovement(c)).toBe(5); // M+1
    expect(hasTraitKey(c.traits, 'peur')).toBe(true);
    expect(hasTraitKey(c.traits, 'morsure')).toBe(true);
    expect(c.causesPeur).toBe(2); // scalaire psy re-dérivé (Peur 2 accordée — l'Indice, pas un booléen)
    expect(liveMorphRef(c)).toBe('enfant-d-ulric'); // apparence hybride (couche rig)
  });

  it('PERSISTE : la forme ne se dissipe pas seule en fin de Round (durée permanente)', () => {
    const c = human();
    applyOps(c, [{ op: 'transform', tag: TAG, ops: HYBRIDE_ULRIC, morphRef: 'enfant-d-ulric' }], {});
    endOfRound(c); endOfRound(c); // deux frontières de Round
    expect(effectiveChar(c, 'F')).toBe(40); // toujours transformé
    expect(liveMorphRef(c)).toBe('enfant-d-ulric');
    expect(hasTraitKey(c.traits, 'peur')).toBe(true);
  });

  it('endTransform : retour ATOMIQUE à la forme de base (Caractéristiques, Traits, apparence)', () => {
    const c = human();
    applyOps(c, [{ op: 'transform', tag: TAG, ops: HYBRIDE_ULRIC, morphRef: 'enfant-d-ulric' }], {});
    applyOps(c, [{ op: 'endTransform', tag: TAG }], {});
    expect(effectiveChar(c, 'CC')).toBe(30);
    expect(effectiveChar(c, 'F')).toBe(30);
    expect(effectiveChar(c, 'Soc')).toBe(30);
    expect(effectiveMovement(c)).toBe(4);
    expect(hasTraitKey(c.traits, 'peur')).toBe(false);
    expect(hasTraitKey(c.traits, 'morsure')).toBe(false);
    expect(c.causesPeur).toBeFalsy(); // Peur retirée → scalaire re-dérivé absent
    expect(liveMorphRef(c)).toBeUndefined();
  });

  it('endTransform sur une forme absente = no-op (idempotent)', () => {
    const c = human();
    applyOps(c, [{ op: 'endTransform', tag: TAG }], {});
    expect(effectiveChar(c, 'F')).toBe(30);
    expect(liveMorphRef(c)).toBeUndefined();
  });
});

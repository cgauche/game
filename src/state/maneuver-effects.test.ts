/**
 * Effets onHit AUTHORÉS des MANŒUVRES (`TraitData.maneuver.effects`, donnée éditable) — migrés des
 * handlers en dur de `applyFreeAttackEffects`. Appliqués SCOPED à la manœuvre (via `maneuverEffectsOf`
 * + `applyTriggeredEffects`). Preuve : Attaque caudale → À Terre si la cible est plus petite ;
 * Tentacules → Empêtré.
 */
import { describe, it, expect } from 'vitest';
import { applyFreeAttackEffects } from './combatFlow';
import type { Combatant } from '../engine/types';
import type { AttackResult } from '../engine/combat';

const mk = (over: Partial<Combatant> = {}): Combatant => ({
  id: 'c', name: 'C', kind: 'enemy',
  characteristics: { CC: 35, CT: 25, F: 35, E: 35, I: 30, Ag: 30, Dex: 30, Int: 25, FM: 25, Soc: 25 },
  wounds: { current: 15, max: 15 }, advantage: 0, conditions: [], skills: [], talents: [],
  weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, items: [],
  ...over,
} as Combatant);

const get = (() => ({ log: () => {}, battle: undefined })) as never;
const hit: AttackResult = { hit: true, woundsLost: 3 } as AttackResult;
const empetre = (c: Combatant) => c.conditions.find((x) => x.name === 'Empêtré');
const aTerre = (c: Combatant) => c.conditions.find((x) => x.name === 'À Terre');

describe('effets onHit de manœuvre (data) appliqués par applyFreeAttackEffects', () => {
  it('Attaque caudale : cible PLUS PETITE → À Terre (compare Taille acteur-vs-acteur)', () => {
    const dragon = mk({ id: 'd', traits: ['Attaque caudale +9'], size: 'enorme' });
    const prey = mk({ id: 'p', size: 'moyenne' });
    applyFreeAttackEffects(get, dragon, prey, 'caudale', hit);
    expect(aTerre(prey)?.value).toBe(1);
  });

  it('Attaque caudale : cible AUSSI GRANDE ou plus → PAS d’À Terre', () => {
    const dragon = mk({ id: 'd', traits: ['Attaque caudale +9'], size: 'moyenne' });
    const peer = mk({ id: 'p', size: 'grande' });
    applyFreeAttackEffects(get, dragon, peer, 'caudale', hit);
    expect(aTerre(peer)).toBeUndefined();
  });

  it('Tentacules : à la touche causant des Dégâts → Empêtré (Force d’évasion = Force de l’attaquant)', () => {
    const kraken = mk({ id: 'k', traits: ['Tentacules +6'] });
    const foe = mk({ id: 'f' });
    applyFreeAttackEffects(get, kraken, foe, 'tentacules', hit);
    expect(empetre(foe)?.value).toBe(1);
    expect(empetre(foe)?.escapeStrength).toBe(kraken.characteristics.F);
  });

  it('sans Dégâts (woundsLost 0) : pas d’effet de manœuvre', () => {
    const dragon = mk({ traits: ['Attaque caudale +9'], size: 'enorme' });
    const prey = mk({ size: 'petite' });
    applyFreeAttackEffects(get, dragon, prey, 'caudale', { hit: true, woundsLost: 0 } as AttackResult);
    expect(aTerre(prey)).toBeUndefined();
  });
});

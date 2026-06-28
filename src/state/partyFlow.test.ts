import { describe, it, expect } from 'vitest';
import { setItemShape } from './partyFlow';
import { itemFromTrappingById, recomputeLoadout } from '../engine/items';
import type { Combatant, ItemInstance } from '../engine/types';
import type { GameState } from './store';
import type { Get, Set } from './flowTypes';

/** Harnais MINIMAL (get/set) sur un état réduit à `party` — `setItemShape` ne lit/écrit que `party`
 *  (via mutLoadout). Le `set` fonctionnel de Zustand est miroité (merge du partiel renvoyé). */
function makeHarness(party: Combatant[]): { get: Get; set: Set } {
  let state = { party } as unknown as GameState;
  const get: Get = () => state;
  const set: Set = (p) => { state = { ...state, ...(typeof p === 'function' ? p(state) : p) }; };
  return { get, set };
}

/** Héros porteur d'une « Arme simple » ÉQUIPÉE (shape par défaut `epee`), loadout dérivé par recompute. */
function heroWithArmeSimple(): Combatant {
  const it = itemFromTrappingById('arme-simple')!;
  it.equipped = true;
  const hero = {
    id: 'h1', name: 'Test', kind: 'hero', characteristics: { F: 30, E: 30 } as Combatant['characteristics'],
    items: [it], talents: [], skills: [], conditions: [], advantage: 0, wounds: { current: 10, max: 10 },
  } as unknown as Combatant;
  recomputeLoadout(hero);
  return hero;
}

const activeWeapon = (h: Combatant, uid: string) => (h.weapons ?? []).find((w) => w.uid === uid);

describe('setItemShape — sélecteur de forme d’une arme abstraite', () => {
  it('une « Arme simple » créée via itemFromTrappingById a shape === "epee" (défaut du trapping)', () => {
    const it = itemFromTrappingById('arme-simple')!;
    expect(it.shape).toBe('epee');
  });

  it('pose item.shape sur une forme valide (∈ formChoices)', () => {
    const hero = heroWithArmeSimple();
    const uid = hero.items![0].uid;
    const { get, set } = makeHarness([hero]);
    setItemShape(get, set, hero.id, uid, 'hache');
    const after = get().party[0];
    expect((after.items ?? []).find((i: ItemInstance) => i.uid === uid)?.shape).toBe('hache');
  });

  it('ignore une forme HORS formChoices (no-op sur le shape)', () => {
    const hero = heroWithArmeSimple();
    const uid = hero.items![0].uid;
    const { get, set } = makeHarness([hero]);
    setItemShape(get, set, hero.id, uid, 'zweihander'); // arme réelle mais hors des 5 formes de l’Arme simple
    const after = get().party[0];
    expect((after.items ?? []).find((i: ItemInstance) => i.uid === uid)?.shape).toBe('epee'); // inchangé
  });

  it('l’arme ACTIVE (tenue) reprend le shape choisi après recompute (silhouette en jeu)', () => {
    const hero = heroWithArmeSimple();
    const uid = hero.items![0].uid;
    expect(activeWeapon(hero, uid)?.shape).toBe('epee'); // état initial : épée
    const { get, set } = makeHarness([hero]);
    setItemShape(get, set, hero.id, uid, 'masse');
    const after = get().party[0];
    expect(activeWeapon(after, uid)?.shape).toBe('masse'); // Weapon.shape suit ItemInstance.shape
  });
});

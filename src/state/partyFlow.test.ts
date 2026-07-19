import { describe, it, expect } from 'vitest';
import { setItemShape, transferItem } from './partyFlow';
import { itemFromTrappingById, recomputeLoadout, totalEncumbrance } from '../engine/items';
import type { Combatant, ItemInstance } from '../engine/types';
import type { GameState } from './store';
import type { Get, Set } from './flowTypes';

/** Harnais MINIMAL (get/set) sur un état réduit à `party` — `setItemShape` ne lit/écrit que `party`
 *  (via mutLoadout). Le `set` fonctionnel de Zustand est miroité (merge du partiel renvoyé). */
function makeHarness(party: Combatant[]): { get: Get; set: Set } {
  let state = { party, log: () => {} } as unknown as GameState;
  const get: Get = () => state;
  const set: Set = (p) => { state = { ...state, ...(typeof p === 'function' ? p(state) : p) }; };
  return { get, set };
}

/** Héros porteur d'une « Arme simple » ÉQUIPÉE (shape par défaut `epee`), loadout dérivé par recompute. */
function heroWithArmeSimple(): Combatant {
  const it = itemFromTrappingById('arme-simple')!;
  it.equipped = true;
  const hero = {
    id: 'h1', name: 'Test', kind: 'hero', characteristics: { force: 30, endurance: 30 } as Combatant['characteristics'],
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

/** Deux héros minimaux pour transferItem : `from` porteur des items donnés, `to` sans rien. */
function twoHeroes(fromItems: ItemInstance[]): { from: Combatant; to: Combatant } {
  const from = {
    id: 'h1', label: 'Aldric', name: 'Aldric', kind: 'hero',
    characteristics: { force: 30, endurance: 30 } as Combatant['characteristics'],
    items: fromItems, talents: [], skills: [], conditions: [], advantage: 0, wounds: { current: 10, max: 10 },
  } as unknown as Combatant;
  const to = {
    id: 'h2', label: 'Brenna', name: 'Brenna', kind: 'hero',
    characteristics: { force: 30, endurance: 30 } as Combatant['characteristics'],
    items: [], talents: [], skills: [], conditions: [], advantage: 0, wounds: { current: 10, max: 10 },
  } as unknown as Combatant;
  recomputeLoadout(from);
  recomputeLoadout(to);
  return { from, to };
}

describe('transferItem — contenants et objets rangés (#612)', () => {
  it('transférer un sac (contenant) déplace aussi son contenu, sans orphelin ni PA fantôme', () => {
    const sac: ItemInstance = { uid: 'sac', label: 'Sac à dos', kind: 'misc', qualities: [], enc: 1, equipped: false, container: { capacity: 10 } } as unknown as ItemInstance;
    const rations: ItemInstance = { uid: 'rations', label: 'Rations', kind: 'misc', qualities: [], enc: 2, equipped: false, inside: 'sac' } as unknown as ItemInstance;
    const corde: ItemInstance = { uid: 'corde', label: 'Corde', kind: 'misc', qualities: [], enc: 1, equipped: false, inside: 'sac' } as unknown as ItemInstance;
    const { from, to } = twoHeroes([sac, rations, corde]);
    const { get, set } = makeHarness([from, to]);

    transferItem(get, set, 'sac', 'h1', 'h2');

    const after = get().party;
    const afterFrom = after.find((h) => h.id === 'h1')!;
    const afterTo = after.find((h) => h.id === 'h2')!;

    expect(afterFrom.items ?? []).toHaveLength(0); // le sac ET son contenu ont quitté le donneur
    const toItems = afterTo.items ?? [];
    expect(toItems.map((i) => i.uid).sort()).toEqual(['corde', 'rations', 'sac']);
    expect(toItems.find((i) => i.uid === 'rations')?.inside).toBe('sac'); // lien préservé chez le receveur
    expect(toItems.find((i) => i.uid === 'corde')?.inside).toBe('sac');

    expect(totalEncumbrance(afterFrom)).toBe(0);
    expect(totalEncumbrance(afterTo)).toBe(1); // seul le sac compte (contenu absorbé, LDB 64)
  });

  it('transférer un objet RANGÉ dans un sac du donneur : il arrive LIBRE chez le receveur', () => {
    const sac: ItemInstance = { uid: 'sac', label: 'Sac à dos', kind: 'misc', qualities: [], enc: 1, equipped: false, container: { capacity: 10 } } as unknown as ItemInstance;
    const rations: ItemInstance = { uid: 'rations', label: 'Rations', kind: 'misc', qualities: [], enc: 2, equipped: false, inside: 'sac' } as unknown as ItemInstance;
    const { from, to } = twoHeroes([sac, rations]);
    const { get, set } = makeHarness([from, to]);

    transferItem(get, set, 'rations', 'h1', 'h2');

    const after = get().party;
    const afterFrom = after.find((h) => h.id === 'h1')!;
    const afterTo = after.find((h) => h.id === 'h2')!;

    expect((afterFrom.items ?? []).map((i) => i.uid)).toEqual(['sac']); // le sac reste, plus vide
    const received = (afterTo.items ?? []).find((i) => i.uid === 'rations');
    expect(received).toBeDefined();
    expect(received!.inside).toBeUndefined(); // aucun `inside` fantôme (le sac du donneur n'existe pas chez le receveur)
    expect(totalEncumbrance(afterTo)).toBe(2); // compté (libre), pas absorbé par un contenant absent
  });
});

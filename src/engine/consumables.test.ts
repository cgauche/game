import { describe, it, expect } from 'vitest';
import { Combatant, ItemInstance } from './types';
import { isConsumable, useConsumable } from './consumables';
import { trappings, findTrappingById } from '../data';
import { itemFromTrappingById } from './items';

const user = (over: Partial<Combatant> = {}): Combatant =>
  ({
    name: 'X',
    characteristics: { CC: 30, CT: 30, F: 30, E: 35, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
    wounds: { current: 5, max: 20, base: 20 }, conditions: [], activeEffects: [], ...over,
  }) as unknown as Combatant;

const item = (consumable?: ItemInstance['consumable']): ItemInstance =>
  ({ uid: 'i', name: 'X', kind: 'misc', qualities: [], enc: 0, equipped: false, ...(consumable ? { consumable } : {}) }) as ItemInstance;

describe('consommables — effet STRUCTURÉ `GameOp[]` (exécuté par applyOps)', () => {
  it('isConsumable = présence d’au moins un op', () => {
    expect(isConsumable(item([{ op: 'heal', amount: 1 }]))).toBe(true);
    expect(isConsumable(item())).toBe(false);
    expect(isConsumable(item([]))).toBe(false);
  });
  it('Potion de guérison : soin = Bonus d’Endurance du buveur (heal `{bonusOf:E}`)', () => {
    const c = user();
    useConsumable(c, item([{ op: 'heal', amount: { bonusOf: 'E' } }]));
    expect(c.wounds.current).toBe(8); // 5 + BE(35)=3
  });
  it('soin littéral « N Points de Blessure » (heal nombre)', () => {
    const c = user();
    useConsumable(c, item([{ op: 'heal', amount: 4 }]));
    expect(c.wounds.current).toBe(9);
  });
  it('Potion de vitalité : `removeCondition all` retire TOUT l’État Exténué', () => {
    const c = user({ conditions: [{ name: 'extenue', value: 3 }] as Combatant['conditions'] });
    useConsumable(c, item([{ op: 'removeCondition', name: 'extenue', all: true }]));
    expect(c.conditions.find((x) => x.name === 'extenue')).toBeUndefined();
  });
  it('Bandage : retire 1 pion Hémorragique (`value`) + pas d’Infection (`preventInfection`→woundDressed)', () => {
    const c = user({ conditions: [{ name: 'hemorragique', value: 2 }] as Combatant['conditions'] });
    useConsumable(c, item([{ op: 'removeCondition', name: 'hemorragique', value: 1 }, { op: 'preventInfection' }]));
    expect(c.conditions.find((x) => x.name === 'hemorragique')?.value).toBe(1);
    expect(c.woundDressed).toBe(true);
  });
  it('objet sans `consumable` → non utilisable, useConsumable inerte', () => {
    const c = user();
    expect(useConsumable(c, item())).toEqual([]);
    expect(c.wounds.current).toBe(5);
  });
});

describe('consommables — catalogue migré (LDB 307, donnée réelle)', () => {
  it('potion-de-guerison : heal `{bonusOf:E}` ; bandages : removeCondition + preventInfection', () => {
    expect(findTrappingById('potion-de-guerison')?.consumable).toEqual([{ op: 'heal', amount: { bonusOf: 'E' } }]);
    expect(findTrappingById('bandages')?.consumable).toEqual([
      { op: 'removeCondition', name: 'hemorragique', value: 1 }, { op: 'preventInfection' },
    ]);
    expect(isConsumable(itemFromTrappingById('potion-de-guerison')!)).toBe(true);
  });
  it('les consommables de la base portent `consumable`', () => {
    const ids = trappings.filter((t) => t.consumable?.length).map((t) => t.id).sort();
    expect(ids).toEqual([
      'bandages',
      'brise-coeur',
      'cataplasme-de-guerison',
      'faxtoryll',
      'gesundheit',
      'lotus-noir',
      'necessaire-antipoison',
      'potion-de-guerison',
      'potion-de-vitalite',
      'racine-des-tombes',
      'soude-commune',
    ]);
  });
});

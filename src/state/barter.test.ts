/**
 * Troc (LDB 59 l.64-76) + « Baisse des prix » (l.60) — câblage marchand : le Troc échange des biens
 * sans argent au ratio de rareté ; la baisse de moitié réduit le gain de vente.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { barterQuote, sellGain, type MerchantState } from './merchantFlow';
import { itemFromTrappingById } from '../engine/items';
import { toBrass } from '../engine/money';
import { makePregens } from '../data/pregens';
import type { Combatant, ItemInstance } from '../engine/types';

const merchant = (stock: { id: string; qty: number }[], extra: Partial<MerchantState> = {}): MerchantState => ({
  entityId: 'p', archetype: 'armurier', settlement: 'ville', resaleRate: 0.5, stock, cart: [], bargainLocked: false, ...extra,
});

beforeEach(() => { useGame.setState({ battle: null, party: [], journal: [], merchant: null, merchantStocks: {}, money: { gold: 0, silver: 0, brass: 0 } }); });

describe('barterQuote (LDB 59 l.64-76)', () => {
  it('deux biens chiffrés → ratio de rareté + nombre à céder ≥ 1', () => {
    const q = barterQuote('hallebarde', 'dague', 1);
    expect(q).toBeTruthy();
    expect(q!.giveCount).toBeGreaterThanOrEqual(1);
    // Céder une hallebarde (chère) contre une dague (bon marché) : 1 suffit largement.
    expect(q!.giveCount).toBe(1);
  });
});

describe('barterExchange', () => {
  it('cède les exemplaires requis, reçoit le bien acquis, décrémente le stock, bourse INCHANGÉE', () => {
    const hero = makePregens()[0] as Combatant;
    hero.items = [itemFromTrappingById('hallebarde'), itemFromTrappingById('hallebarde')].filter(Boolean) as ItemInstance[];
    useGame.setState({ party: [hero], merchant: merchant([{ id: 'dague', qty: 5 }]) });
    const before = toBrass(useGame.getState().money);
    useGame.getState().barterExchange({ giveHeroId: hero.id, giveTrappingId: 'hallebarde', getStockId: 'dague', getCount: 1 });
    const st = useGame.getState();
    const items = st.party[0].items ?? [];
    expect(items.filter((i) => i.trappingId === 'hallebarde')).toHaveLength(1); // 1 cédée
    expect(items.some((i) => i.trappingId === 'dague')).toBe(true); // 1 acquise
    expect(st.merchant!.stock.find((l) => l.id === 'dague')!.qty).toBe(4); // stock décrémenté
    expect(toBrass(st.money)).toBe(before); // aucun argent échangé
  });

  it('refuse si le héros n’a pas assez d’exemplaires à céder', () => {
    const hero = makePregens()[0] as Combatant;
    hero.items = []; // rien à céder
    useGame.setState({ party: [hero], merchant: merchant([{ id: 'dague', qty: 5 }]) });
    useGame.getState().barterExchange({ giveHeroId: hero.id, giveTrappingId: 'hallebarde', getStockId: 'dague', getCount: 1 });
    expect((useGame.getState().party[0].items ?? []).some((i) => i.trappingId === 'dague')).toBe(false);
  });
});

describe('Baisse des prix à la vente (LDB 59 l.60)', () => {
  it('diviser le prix par deux réduit le gain de vente', () => {
    const item = itemFromTrappingById('hallebarde')!;
    const full = toBrass(sellGain(item, merchant([])));
    const halved = toBrass(sellGain(item, merchant([], { sellHalvings: { [item.uid]: 1 } })));
    expect(halved).toBe(Math.floor(full / 2));
    const quartered = toBrass(sellGain(item, merchant([], { sellHalvings: { [item.uid]: 2 } })));
    expect(quartered).toBe(Math.floor(full / 4));
  });
});

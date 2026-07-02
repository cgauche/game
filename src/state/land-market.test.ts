import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { makePregens } from '../data/pregens';
import { seedBattleRng } from './battleRng';
import type { WorldMap } from './worldMap';
import type { CargoLot } from '../engine/cargo';

/**
 * #58 — Commerce de cargaison TERRESTRE (Mort sur le Reik Compagnon ch.11) : les consommateurs runtime du
 * moteur `landCargo` + `MapPlace.market`. Le flux `landMarketFlow` ouvre le marché à un Lieu de commerce,
 * achète (disponibilité 2 temps + Marchandage + lot partiel), vend (Demande/Mise à prix), brade (½).
 */
const get = useGame.getState.bind(useGame);

const landMap: WorldMap = {
  id: 'm', nom: 'Reikland',
  places: [
    { id: 'A', label: 'Grünburg', pos: { x: 0, y: 0 }, scene: 'ville-a', market: { taille: 4, richesse: 4, produits: ['vivres', 'vin', 'metal', 'commerce'] } },
  ],
  routes: [],
};

function freshState() {
  useGame.setState({
    party: makePregens().slice(0, 3),
    scene: { id: 'ville-a', nom: 'Ville', dimensions: { w: 2, h: 2 }, layers: [{ z: 0, tiles: ['sol', 'sol', 'sol', 'sol'] }], entities: [], dialogues: [], triggers: [] } as never,
    battle: null,
    worldMap: landMap,
    travelPlan: null,
    travelRecap: null,
    landMarket: null,
    caravanCargo: [],
    gameTime: 8 * 60,
    lastUpkeepDay: 0,
    money: { gold: 5000, silver: 0, brass: 0 },
    journal: [],
  } as never);
}

describe('#58 — commerce de cargaison terrestre (T2C ch.11)', () => {
  beforeEach(freshState);

  it('openLandMarket génère des offres d’achat (disponibilité 2 temps + Taille de cargaison)', () => {
    seedBattleRng(3);
    get().openLandMarket();
    const lm = get().landMarket;
    expect(lm).toBeTruthy();
    expect(lm!.offers.length).toBeGreaterThan(0);
    expect(lm!.offers.every((o) => o.enc > 0 && o.basePrice > 0)).toBe(true);
    // Le Vin est proposé « qualité incertaine » (qualité secrète tirée à l'ouverture, l.93-104).
    expect(lm!.offers.some((o) => o.wine)).toBe(true);
  });

  it('landBuyCargo débite la bourse et charge le convoi (caravanCargo)', () => {
    seedBattleRng(3);
    get().openLandMarket();
    const offer = get().landMarket!.offers[0];
    const before = get().money.gold;
    get().landBuyCargo(offer.cargoId, Math.min(30, offer.enc));
    const cargo = get().caravanCargo ?? [];
    expect(cargo.length).toBe(1);
    expect(cargo[0].cargoId).toBe(offer.cargoId);
    expect(cargo[0].enc).toBe(Math.min(30, offer.enc));
    expect(get().money.gold).toBeLessThanOrEqual(before); // débité (ou nul si prix arrondi à 0)
  });

  it('landSellCargo trouve un acheteur et crédite la bourse (Demande = Taille×10 +30 Commerce)', () => {
    // État direct : convoi chargé + marché ouvert (Demande = 4×10 + 30 = 70).
    const lot: CargoLot = { cargoId: 'vivres', enc: 40, basePriceGold: 2 };
    useGame.setState({ caravanCargo: [lot], landMarket: { placeId: 'A', label: 'Grünburg', market: landMap.places[0].market!, offers: [] } } as never);
    seedBattleRng(2); // d100 ≤ 70 → acheteur trouvé
    const before = get().money.gold;
    get().landSellCargo(0);
    // Vendu (tout ou moitié) → convoi réduit ou vidé, bourse créditée.
    const cargo = get().caravanCargo ?? [];
    expect(cargo.length === 0 || cargo[0].enc < 40).toBe(true);
    expect(get().money.gold).toBeGreaterThan(before);
  });

  it('landDumpCargo brade à la moitié du prix de base (Lieu de Commerce, l.160)', () => {
    const lot: CargoLot = { cargoId: 'metal', enc: 20, basePriceGold: 3 };
    useGame.setState({ caravanCargo: [lot], landMarket: { placeId: 'A', label: 'Grünburg', market: landMap.places[0].market!, offers: [] } } as never);
    const before = get().money.gold;
    get().landDumpCargo(0);
    expect((get().caravanCargo ?? []).length).toBe(0); // lot bradé en entier
    expect(get().money.gold).toBe(before + 30); // 20 Enc × 3 CO × 50 % = 30 CO
  });

  it('landDumpCargo REFUSE si le Lieu n’a pas le Commerce en Produits', () => {
    const noCommerce = { taille: 2, richesse: 2, produits: ['vivres'] };
    const lot: CargoLot = { cargoId: 'vivres', enc: 20, basePriceGold: 1 };
    useGame.setState({ caravanCargo: [lot], landMarket: { placeId: 'A', label: 'Bourg', market: noCommerce, offers: [] } } as never);
    const before = get().money.gold;
    get().landDumpCargo(0);
    expect((get().caravanCargo ?? []).length).toBe(1); // refusé : rien bradé
    expect(get().money.gold).toBe(before);
  });
});

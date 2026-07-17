import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { makePregens } from '../data/pregens';
import { seedBattleRng } from './battleRng';
import { toBrass } from '../engine/money';
import { WINE_QUALITY } from '../engine/landCargo';
import { carrierById, persistCarriersCargo } from './carriers';
import type { WorldMap } from './worldMap';
import type { CargoLot } from '../engine/cargo';
import type { ItemInstance } from '../engine/types';

/**
 * #58 — Commerce de cargaison TERRESTRE (Mort sur le Reik Compagnon ch.11) : les consommateurs runtime du
 * moteur `landCargo` + `MapPlace.market`. Le flux `landMarketFlow` ouvre le marché à un Lieu de commerce,
 * achète (disponibilité 2 temps + Marchandage + lot partiel — plafonné à la Contenance du porteur, #327),
 * vend (Demande/Mise à prix), brade (½). La cargaison vit désormais sur un PORTEUR RÉEL (`ItemInstance.cargo`).
 */
const get = useGame.getState.bind(useGame);

/** id du porteur de convoi (diligence, chargement 80) donné au groupe pour tout le commerce terrestre. */
const CARRIER_ID = 'convoi-1';
const dili = (uid = CARRIER_ID): ItemInstance =>
  ({ uid, name: 'Chariot de convoi', trappingId: 'diligence', kind: 'misc', qualities: [], enc: 0, equipped: false } as ItemInstance);

/** Cargaison du porteur de convoi (source unique = son `ItemInstance.cargo`). */
const carrierCargo = (): CargoLot[] => carrierById(get(), CARRIER_ID)?.cargo ?? [];
/** Pose directement des lots sur le porteur (bypass Contenance : mise en scène des ventes/bradages). */
function setCarrierCargo(lots: CargoLot[]): void {
  useGame.setState(persistCarriersCargo(get(), [{ carrierId: CARRIER_ID, cargo: lots }]) as never);
}

/** Draine une cascade influençable (héros piloté-humain → modale, #274). */
function drainCascade(): void {
  let g = 0;
  while (get().pendingCascade && g++ < 50) {
    const p = get().pendingCascade!;
    const cur = p.participants[p.cursor];
    if (cur && cur.target != null && !cur.result) get().cascadeRoll(cur.id);
    else get().cascadeNext();
  }
}

const landMap: WorldMap = {
  id: 'm', nom: 'Reikland',
  places: [
    { id: 'A', label: 'Grünburg', pos: { x: 0, y: 0 }, scene: 'ville-a', market: { taille: 4, richesse: 4, produits: ['vivres', 'vin', 'metal', 'commerce'] } },
  ],
  routes: [],
};

function freshState(carrier: ItemInstance | null = dili()) {
  const party = makePregens().slice(0, 3);
  if (carrier) party[0] = { ...party[0], items: [...(party[0].items ?? []), carrier] };
  useGame.setState({
    party,
    scene: { id: 'ville-a', nom: 'Ville', dimensions: { w: 2, h: 2 }, layers: [{ z: 0, tiles: ['sol', 'sol', 'sol', 'sol'] }], entities: [], dialogues: [], triggers: [] } as never,
    battle: null,
    worldMap: landMap,
    travelPlan: null,
    travelRecap: null,
    landMarket: null,
    gameTime: 8 * 60,
    lastUpkeepDay: 0,
    money: { gold: 5000, silver: 0, brass: 0 },
    journal: [],
  } as never);
}

describe('#58 — commerce de cargaison terrestre (T2C ch.13)', () => {
  beforeEach(() => freshState());

  it('openLandMarket génère des offres d’achat (disponibilité 2 temps + Taille de cargaison)', () => {
    seedBattleRng(3);
    get().openLandMarket();
    const lm = get().landMarket;
    expect(lm).toBeTruthy();
    expect(lm!.offers.length).toBeGreaterThan(0);
    expect(lm!.offers.every((o) => o.enc > 0 && o.basePrice > 0)).toBe(true);
    expect(lm!.offers.some((o) => o.wine)).toBe(true);
  });

  it('landBuyCargo débite la bourse et charge le porteur de convoi (ItemInstance.cargo)', () => {
    seedBattleRng(3);
    get().openLandMarket();
    const offer = get().landMarket!.offers[0];
    const before = get().money.gold;
    get().landBuyCargo(offer.cargoId, Math.min(30, offer.enc)); // ≤ Contenance 80
    const cargo = carrierCargo();
    expect(cargo.length).toBe(1);
    expect(cargo[0].cargoId).toBe(offer.cargoId);
    expect(cargo[0].enc).toBe(Math.min(30, offer.enc));
    expect(get().money.gold).toBeLessThanOrEqual(before);
  });

  it('landBuyCargo REFUSE au-delà de la Contenance du porteur (plafond réel, #327)', () => {
    freshState(dili()); // Contenance 80
    seedBattleRng(3);
    get().openLandMarket();
    const offer = get().landMarket!.offers[0];
    const before = get().money.gold;
    get().landBuyCargo(offer.cargoId, 200); // > 80 → refusé
    expect(carrierCargo().length).toBe(0);
    expect(get().money.gold).toBe(before);
    expect(get().journal.some((l) => /ne peut plus charger/.test(l))).toBe(true);
  });

  it('landBuyCargo REFUSE si le groupe n’a AUCUN porteur (bête/véhicule/navire)', () => {
    freshState(null); // aucun porteur
    seedBattleRng(3);
    get().openLandMarket();
    const offer = get().landMarket!.offers[0];
    const before = get().money.gold;
    get().landBuyCargo(offer.cargoId, 20);
    expect(get().money.gold).toBe(before);
    expect(get().journal.some((l) => /Aucune bête de somme ni véhicule/.test(l))).toBe(true);
  });

  it('landSellCargo trouve un acheteur et crédite la bourse (Demande = Taille×10 +30 Commerce)', () => {
    setCarrierCargo([{ cargoId: 'vivres', enc: 40, basePriceGold: 2 }]);
    useGame.setState({ landMarket: { placeId: 'A', label: 'Grünburg', market: landMap.places[0].market!, offers: [] } } as never);
    seedBattleRng(2);
    const before = get().money.gold;
    get().landSellCargo(CARRIER_ID, 0);
    const cargo = carrierCargo();
    expect(cargo.length === 0 || cargo[0].enc < 40).toBe(true);
    expect(get().money.gold).toBeGreaterThan(before);
  });

  it('landDumpCargo brade à la moitié du prix de base (Lieu de Commerce, l.160)', () => {
    setCarrierCargo([{ cargoId: 'metal', enc: 20, basePriceGold: 3 }]);
    useGame.setState({ landMarket: { placeId: 'A', label: 'Grünburg', market: landMap.places[0].market!, offers: [] } } as never);
    const before = get().money.gold;
    get().landDumpCargo(CARRIER_ID, 0);
    expect(carrierCargo().length).toBe(0);
    expect(get().money.gold).toBe(before + 30); // 20 Enc × 3 CO × 50 % = 30 CO
  });

  it('landDumpCargo REFUSE si le Lieu n’a pas le Commerce en Produits', () => {
    const noCommerce = { taille: 2, richesse: 2, produits: ['vivres'] };
    setCarrierCargo([{ cargoId: 'vivres', enc: 20, basePriceGold: 1 }]);
    useGame.setState({ landMarket: { placeId: 'A', label: 'Bourg', market: noCommerce, offers: [] } } as never);
    const before = get().money.gold;
    get().landDumpCargo(CARRIER_ID, 0);
    expect(carrierCargo().length).toBe(1); // refusé : rien bradé
    expect(get().money.gold).toBe(before);
  });

  it('landBuyCargo REFUSE un lot de moins de minCargoEnc (l.131)', () => {
    seedBattleRng(3);
    get().openLandMarket();
    const offer = get().landMarket!.offers[0];
    const before = get().money.gold;
    get().landBuyCargo(offer.cargoId, 5); // < 10 Enc → refusé
    expect(carrierCargo().length).toBe(0);
    expect(get().money.gold).toBe(before);
  });

  it('landEvalWine révèle la qualité secrète d’un lot de Vin (Test d’Évaluation, l.95)', () => {
    seedBattleRng(3);
    get().openLandMarket();
    const wine = get().landMarket!.offers.find((o) => o.wine)!;
    expect(wine.wineTier).toBeUndefined();
    get().landEvalWine(wine.cargoId);
    drainCascade();
    const after = get().landMarket!.offers.find((o) => o.cargoId === wine.cargoId)!;
    expect(WINE_QUALITY.map((w) => w.label)).toContain(after.wineTier);
    expect(typeof after.wineEvalOk).toBe('boolean');
  });

  it('rumeur commerciale (l.180) : le bien se vend au DOUBLE au Lieu DÉSIGNÉ par la rumeur du board (#99)', () => {
    const mkt = { taille: 4, richesse: 3, produits: ['vivres', 'commerce'] };
    const lot: CargoLot = { cargoId: 'vivres', enc: 100, basePriceGold: 1 };
    const rum = { placeId: 'A', biens: ['vivres'], mult: 2, text: 'Forte demande de vivres.', heardDay: 0 };
    setCarrierCargo([lot]);
    useGame.setState({ tradeRumours: [], landMarket: { placeId: 'A', label: 'X', market: mkt, offers: [] } } as never);
    seedBattleRng(2);
    const b0 = toBrass(get().money);
    get().landSellCargo(CARRIER_ID, 0);
    const base = toBrass(get().money) - b0;
    setCarrierCargo([lot]);
    useGame.setState({ tradeRumours: [rum], landMarket: { placeId: 'A', label: 'X', market: mkt, offers: [] } } as never);
    seedBattleRng(2);
    const b1 = toBrass(get().money);
    get().landSellCargo(CARRIER_ID, 0);
    const withRumour = toBrass(get().money) - b1;
    expect(base).toBeGreaterThan(0);
    expect(withRumour).toBe(base * 2);
  });

  it('rumeur commerciale : un bien NON visé n’est pas doublé — ni un Lieu NON désigné', () => {
    const mkt = { taille: 4, richesse: 3, produits: ['vivres', 'commerce'] };
    const lot: CargoLot = { cargoId: 'metal', enc: 100, basePriceGold: 1 };
    const rums = [
      { placeId: 'A', biens: ['vivres'], mult: 2, text: 'Forte demande de vivres.', heardDay: 0 },
      { placeId: 'B', biens: ['metal'], mult: 2, text: 'Le métal s’arrache à B.', heardDay: 0 },
    ];
    setCarrierCargo([lot]);
    useGame.setState({ tradeRumours: [], landMarket: { placeId: 'A', label: 'X', market: mkt, offers: [] } } as never);
    seedBattleRng(2);
    const b0 = toBrass(get().money);
    get().landSellCargo(CARRIER_ID, 0);
    const base = toBrass(get().money) - b0;
    setCarrierCargo([lot]);
    useGame.setState({ tradeRumours: rums, landMarket: { placeId: 'A', label: 'X', market: mkt, offers: [] } } as never);
    seedBattleRng(2);
    const b1 = toBrass(get().money);
    get().landSellCargo(CARRIER_ID, 0);
    expect(toBrass(get().money) - b1).toBe(base);
  });
});

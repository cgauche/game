import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import {
  cargoRaidLossPct, spoilCargoByEnc, spoilCargoByPct, cargoTotalEnc, type CargoLot,
} from '../engine/cargo';
import { applyLandCargoRaid } from './carriers';
import { spoilVesselCargoOnLeak } from './seaVoyageFlow';
import { startCascade } from './cascade';
import { seedBattleRng } from './battleRng';
import { rule, setRule, resetRule } from '../engine/policy';
import type { ItemInstance } from '../engine/types';
import type { CascadeStep } from './pendings';

const get = useGame.getState.bind(useGame);
const set = useGame.setState.bind(useGame);

const lot = (cargoId: string, enc: number): CargoLot => ({ cargoId, enc, basePriceGold: 2 });

/** Un porteur véhicule (charrette EDOC, `chargement` 25) tenu par un héros, chargé de `lots`. */
function cartHero(lots: CargoLot[]) {
  const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', name: 'H', rng: makeRNG(1) });
  const cart: ItemInstance = { uid: 'cart-1', trappingId: 'charrette', name: 'Charrette', kind: 'misc', qualities: [], enc: 10, equipped: false, cargo: lots };
  h.items = [cart];
  return h;
}

describe('Risque cargaison — tronc PUR (#327 lot D)', () => {
  it('cargoRaidLossPct : victoire = 0, fuite = fleePct, défaite = lossPct (bornés 0..100)', () => {
    expect(cargoRaidLossPct('victory', 25, 75)).toBe(0);
    expect(cargoRaidLossPct('fled', 25, 75)).toBe(25);
    expect(cargoRaidLossPct('defeat', 25, 75)).toBe(75);
    expect(cargoRaidLossPct('defeat', 25, 200)).toBe(100); // borné haut
    expect(cargoRaidLossPct('fled', -5, 75)).toBe(0); // borné bas
  });

  it('spoilCargoByEnc : retire un montant borné au CONTENU, au fil des lots, sans égard au type', () => {
    const lots = [lot('vin', 8), lot('sel', 6)];
    const r = spoilCargoByEnc(lots, 10);
    expect(r.removed).toBe(10);
    expect(cargoTotalEnc(r.lots)).toBe(4); // 14 − 10
    // Plus que le contenu : borné au total, jamais négatif.
    expect(spoilCargoByEnc(lots, 999).removed).toBe(14);
    expect(spoilCargoByEnc([], 5).removed).toBe(0);
  });

  it('spoilCargoByPct : retire un % de l’Enc total (arrondi), réparti au fil des lots', () => {
    const lots = [lot('vin', 30), lot('sel', 10)]; // total 40
    expect(spoilCargoByPct(lots, 100).removed).toBe(40);
    expect(spoilCargoByPct(lots, 25).removed).toBe(10);
    expect(spoilCargoByPct(lots, 0).removed).toBe(0);
  });
});

describe('Vol terrestre GRADUÉ par l’issue (#327 A5.1) — applyLandCargoRaid', () => {
  afterEach(() => { resetRule('landRobberyFleePct'); resetRule('landRobberyLossPct'); });

  const slice = (lots: CargoLot[]) => ({ party: [cartHero(lots)], vessel: null, worldMap: null, scene: null } as never);

  it('victoire : le convoi est sauf (0 Enc perdu)', () => {
    const r = applyLandCargoRaid(slice([lot('vin', 40)]), 'victory');
    expect(r.pct).toBe(0);
    expect(r.losses).toHaveLength(0);
  });

  it('fuite : retire landRobberyFleePct (défaut 25 %) de l’Enc du convoi', () => {
    const r = applyLandCargoRaid(slice([lot('vin', 40)]), 'fled');
    expect(r.pct).toBe(25);
    expect(r.losses.reduce((n, l) => n + l.removed, 0)).toBe(10);
  });

  it('défaite : retire landRobberyLossPct (défaut 75 %) — et respecte la surcharge éditable', () => {
    expect(applyLandCargoRaid(slice([lot('vin', 40)]), 'defeat').losses.reduce((n, l) => n + l.removed, 0)).toBe(30);
    setRule('landRobberyLossPct', 50);
    expect(applyLandCargoRaid(slice([lot('vin', 40)]), 'defeat').losses.reduce((n, l) => n + l.removed, 0)).toBe(20);
  });
});

describe('Vol terrestre — dénouement au teardown de combat (store)', () => {
  beforeEach(() => {
    useGame.setState({ party: [cartHero([lot('vin', 40)])], vessel: null, worldMap: null, scene: null, battle: null, cargoRaid: true, journal: [] } as never);
  });
  afterEach(() => useGame.setState({ cargoRaid: false } as never));

  it('resolveCargoRaid(defeat) retire 75 % des lots réels du véhicule et éteint le flag', () => {
    get().resolveCargoRaid('defeat');
    const cart = get().party[0].items![0];
    expect(cargoTotalEnc(cart.cargo ?? [])).toBe(10); // 40 − 30 (75 %)
    expect(get().cargoRaid).toBe(false);
  });

  it('resolveCargoRaid(victory) ne retire rien (convoi sauf) et éteint le flag', () => {
    get().resolveCargoRaid('victory');
    expect(cargoTotalEnc(get().party[0].items![0].cargo ?? [])).toBe(40);
    expect(get().cargoRaid).toBe(false);
  });

  it('no-op quand aucun vol n’est en cours', () => {
    useGame.setState({ cargoRaid: false } as never);
    get().resolveCargoRaid('defeat');
    expect(cargoTotalEnc(get().party[0].items![0].cargo ?? [])).toBe(40);
  });
});

describe('Voie d’eau — la coque percée/heurtée gâte 1d10 Enc (#327 D)', () => {
  it('spoilVesselCargoOnLeak : borné à 1d10 ET au contenu', () => {
    seedBattleRng(3);
    useGame.setState({ vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] }, cargo: [lot('bois', 100)] } } as never);
    const lines = spoilVesselCargoOnLeak(get, set);
    const removed = 100 - cargoTotalEnc(get().vessel!.cargo!);
    expect(removed).toBeGreaterThanOrEqual(1);
    expect(removed).toBeLessThanOrEqual(10);
    expect(lines.join(' ')).toContain('voie d\'eau');
  });

  it('cale vide : rien à gâter, aucune ligne', () => {
    useGame.setState({ vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] }, cargo: [] } } as never);
    expect(spoilVesselCargoOnLeak(get, set)).toHaveLength(0);
  });
});

describe('Cogue pirate — se soumettre : pillage + tribut (#327 A5.3)', () => {
  const hailStep = (): CascadeStep => ({
    id: 'sea-pirate-hail', kind: 'sea-pirate-hail', label: 'Cogue pirate', interactive: true, defaultChoice: 'fuir',
    meta: { crisisLabel: 'Cogue pirate', crisisDesc: 'desc' },
    options: [
      { key: 'fuir', label: 'Fuir' }, { key: 'combattre', label: 'Combattre' }, { key: 'soumettre', label: 'Se soumettre' },
    ],
  });

  beforeEach(() => {
    seedBattleRng(5);
    useGame.setState({
      party: [createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', name: 'H', rng: makeRNG(1) })],
      vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] }, cargo: [lot('vin', 30), lot('sel', 20)] } as never,
      worldMap: null, scene: null, battle: null, travelPlan: null, pendingCascade: null, suspendedCascades: [], journal: [],
    } as never);
  });

  it('soumission : pillage piratePillagePct (100 %) de la cale puis insère le choix du tribut ; livrer retire un marin', () => {
    expect(Number(rule('piratePillagePct'))).toBe(100);
    startCascade(get, set, { title: 'Cogue pirate', purpose: 'test', steps: [hailStep()] });
    get().cascadeChoose('sea-pirate-hail', 'soumettre');
    get().cascadeNext();
    // Cale VIDÉE (100 %) + étape de tribut insérée.
    expect(cargoTotalEnc(get().vessel!.cargo ?? [])).toBe(0);
    const p = get().pendingCascade;
    expect(p?.participants.some((s) => s.kind === 'sea-pirate-tribute')).toBe(true);
    // Livrer un marin : crewLost incrémenté (perte réelle).
    get().cascadeChoose('sea-pirate-tribute', 'livrer');
    get().cascadeNext();
    expect((get().vessel!.crewLost ?? 0)).toBeGreaterThan(0);
  });

  it('tribut REFUSÉ → abordage immédiat (startChaseBoarding, aucune perte silencieuse)', () => {
    startCascade(get, set, { title: 'Cogue pirate', purpose: 'test', steps: [hailStep()] });
    get().cascadeChoose('sea-pirate-hail', 'soumettre');
    get().cascadeNext();
    const crewBefore = get().vessel!.crewLost ?? 0;
    get().cascadeChoose('sea-pirate-tribute', 'refuser');
    get().cascadeNext();
    expect(get().vessel!.crewLost ?? 0).toBe(crewBefore); // refuser ne sacrifie aucun marin
  });
});

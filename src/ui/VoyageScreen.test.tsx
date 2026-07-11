import { describe, it, expect } from 'vitest';
import type { CampaignVessel } from '../state/store';
import type { Combatant } from '../engine/types';
import type { TravelPlan } from '../state/travelFlow';
import { rollSeaWeather } from '../engine/seaWeather';
import { voyageMode, voyageTiles, voyageDayCards } from './VoyageScreen';

const hero = (id: string): Combatant => ({
  id, name: `Héros ${id}`, kind: 'hero',
  characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 40, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 35, sociabilite: 30 },
  wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], skills: [], talents: [],
  weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
  items: [], movement: 4,
} as Combatant);

const vessel = (): CampaignVessel => ({
  vehicleId: 'cogue', name: 'Le Cormoran',
  morale: { score: 62, lastMoraleWeek: 0, factors: [] },
  wounds: { current: 8, max: 20 },
  provisions: 9,
  cargo: [{ cargoId: 'cereales', enc: 200, basePriceGold: 3 }],
});

const base = (): TravelPlan => ({ routeId: 'r', fromPlaceId: 'a', toPlaceId: 'b', mode: 'mer', hoursPerDay: 24, km: 380, kmDone: 212, interrupted: false });

const seaPlan = (): TravelPlan => ({ ...base(), sea: { heading: 'ouest', weather: rollSeaWeather('ete'), windFrom: 'nord', daysToEvent: 3, daysAtSea: 4, lines: [], milesToday: 0 } });
const riverPlan = (): TravelPlan => ({ ...base(), mode: 'barge-du-sel', river: { windForce: 'modere', windDir: 'contraire', daysAfloat: 2 } as TravelPlan['river'], vehicle: { ...hero('barge'), wounds: { current: 18, max: 24 } } });
const landPlan = (): TravelPlan => ({ ...base(), mode: 'monture', allure: 'trot' });

describe('VoyageScreen — hub de voyage paramétré par mode (#333)', () => {
  it('voyageMode : mer / fleuve / terre dérivés du plan', () => {
    expect(voyageMode(seaPlan())).toBe('mer');
    expect(voyageMode(riverPlan())).toBe('fleuve');
    expect(voyageMode(landPlan())).toBe('terre');
  });

  it('tuiles MER : vent, coque, moral, provisions, cale', () => {
    const keys = voyageTiles('mer', seaPlan(), vessel(), [hero('h1')], 0).map((t) => t.key);
    expect(keys).toEqual(expect.arrayContaining(['vent', 'coque', 'moral', 'provisions', 'cale']));
    const coque = voyageTiles('mer', seaPlan(), vessel(), [hero('h1')], 0).find((t) => t.key === 'coque')!;
    expect(coque.value).toBe('8 / 20');
    expect(coque.gauge).toBeDefined();
  });

  it('tuiles TERRE : allure et saison (sans navire ni bêtes)', () => {
    const keys = voyageTiles('terre', landPlan(), null, [hero('h1')], 0).map((t) => t.key);
    expect(keys).toEqual(expect.arrayContaining(['allure', 'saison']));
    const allure = voyageTiles('terre', landPlan(), null, [hero('h1')], 0).find((t) => t.key === 'allure')!;
    expect(allure.value).toBe('Trot');
  });

  it('tuiles FLEUVE : vent du jour et coque de la barge', () => {
    const keys = voyageTiles('fleuve', riverPlan(), null, [hero('h1')], 0).map((t) => t.key);
    expect(keys).toEqual(expect.arrayContaining(['vent', 'coque']));
    const coque = voyageTiles('fleuve', riverPlan(), null, [hero('h1')], 0).find((t) => t.key === 'coque')!;
    expect(coque.value).toBe('18 / 24');
  });

  it('chronique : une carte par jour clos + le jour EN COURS', () => {
    const plan: TravelPlan = { ...seaPlan(), log: [
      { kmFrom: 0, kmTo: 32, hours: 24, lines: ['Départ, vent portant'], entries: [] },
      { kmFrom: 32, kmTo: 60, hours: 24, lines: ['Grain — voiles ✓'], entries: [] },
    ] };
    const cards = voyageDayCards(plan, 'mer', 'Jour', true);
    expect(cards).toHaveLength(3);
    expect(cards[0].dayLabel).toBe('Jour 1');
    expect(cards[0].summary).toBe('Départ, vent portant');
    expect(cards[2].current).toBe(true);
    expect(cards[2].summary).toBe('EN COURS…');
    expect(cards[2].dayLabel).toBe('Jour 3');
  });
});

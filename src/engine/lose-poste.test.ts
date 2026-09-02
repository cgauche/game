import { describe, it, expect } from 'vitest';
import { applyCrewHit } from './shipCritical';
import { applyOps } from './ops';
import type { Combatant, ShipPoste } from './types';
import type { ShipCrewHit } from '../data/shipCriticals';

/** Marin minimal — assez pour `testValue('athletisme')` (Ag=36) + `applyOps` wounds (BE=3, PA=0). */
const sailor = (id: string, over: Partial<Combatant> = {}): Combatant => ({
  id, name: id, kind: 'npc', characteristics: { 'capacite-de-combat': 31, 'capacite-de-tir': 31, force: 31, endurance: 31, initiative: 31, agilite: 36, dexterite: 36, intelligence: 31, 'force-mentale': 31, sociabilite: 36 },
  skills: [], talents: [], traits: [], conditions: [], activeEffects: [], liveTraits: [], weapons: [],
  armour: { corps: 0 }, wounds: { current: 13, max: 13, base: 13 }, advantage: 0, ...over,
}) as unknown as Combatant;

/**
 * « Canon perdu » (MDG 13 l.765) : une pièce passe par-dessus bord. Mécanisé par l'op GÉNÉRIQUE
 * `removeShipPoste` (authoré en DONNÉE — `ops` du Critique dans `ship-criticals.json`), plus aucun flag/branche
 * en dur. Le `target` est la coque ; l'équipage vient de `ctx.crew` (pour démanciper le chef).
 */
describe('op removeShipPoste — Canon perdu (MDG 13 l.765)', () => {
  const setup = () => {
    const poste: ShipPoste = { item: { uid: 'p1', name: 'Pierrier' } as never, side: 'tribord', crewIds: ['chef'] };
    const hull = { id: 'hull', name: 'Cogue', postes: [poste] } as unknown as Combatant;
    const chef = { id: 'chef', name: 'Canonnier', mannedPoste: poste, weapons: [{ uid: 'p1', name: 'Pierrier', type: 'ranged' }] } as unknown as Combatant;
    return { hull, chef, poste };
  };
  const rng0 = { int: () => 0 }; // tire le poste d'index 0

  it('retire le poste de la coque ET démancipe son chef (mannedPoste + arme du poste)', () => {
    const { hull, chef } = setup();
    applyOps(hull, [{ op: 'removeShipPoste' }], { crew: [chef], rng: rng0 });
    expect(hull.postes).toHaveLength(0); // passé par-dessus bord
    expect(chef.mannedPoste).toBeUndefined(); // il ne sert plus rien
    expect(chef.weapons.find((w) => w.uid === 'p1')).toBeUndefined(); // l'arme du poste disparaît du loadout
  });

  it('coque sans poste → inerte (aucun retrait fantôme)', () => {
    const hull = { id: 'hull', postes: [] } as unknown as Combatant;
    applyOps(hull, [{ op: 'removeShipPoste' }], { crew: [], rng: rng0 });
    expect(hull.postes).toHaveLength(0);
  });

  it('ne touche au chef QUE s’il servait bien CE poste (pas de démancipation parasite)', () => {
    const { hull, chef } = setup();
    const autre: ShipPoste = { item: { uid: 'p2', name: 'Canon' } as never, side: 'babord', crewIds: ['chef'] };
    chef.mannedPoste = autre; // le chef sert un AUTRE poste
    applyOps(hull, [{ op: 'removeShipPoste' }], { crew: [chef], rng: rng0 }); // retire `poste` (p1)
    expect(chef.mannedPoste).toBe(autre); // intact : il ne servait pas le poste perdu
    expect(chef.weapons.find((w) => w.uid === 'p1')).toBeDefined();
  });
});

/** « Canon détaché » authoré en DONNÉE : le nœud `test` du Flow porte le jet ET, dans sa branche
 *  d'ÉCHEC, la conséquence en `GameOp` (branche `success` vide — `applyCrewHit` ne sert que l'échec). */
const detachTest: ShipCrewHit = {
  test: {
    kind: 'test',
    test: { skill: { id: 'athletisme' }, difficulty: 'intermediaire' },
    success: { kind: 'seq', steps: [] },
    fail: { kind: 'do', effect: { type: 'ops', ops: [{ op: 'wounds', amount: 12, ignoreTB: false, ignoreAP: false }], on: 'target' } },
  },
};

/**
 * « Canon détaché » (MDG 13 l.763-764) : l'équipage du poste encourt le `crewHit` (data-driven) ; un
 * échec applique les ops de sa branche `fail`. Le canon RESTE à bord (≠ « Canon perdu »). Plus aucune
 * valeur (12 / Athlétisme) en dur.
 */
describe('applyCrewHit — Canon détaché (data-driven, MDG 13 l.763-764)', () => {
  const hullWith = (crewIds: string[]) => {
    const poste: ShipPoste = { item: { uid: 'p1', name: 'Canon' } as never, side: 'tribord', crewIds };
    return { hull: { id: 'hull', postes: [poste] } as unknown as Combatant, poste };
  };
  // int(1,100) = d100 du Test ; int(0,n) = tirage du poste (index 0).
  const rngFail = { int: (min: number) => (min === 1 ? 100 : 0) }; // d100=100 → raté
  const rngPass = { int: (min: number) => (min === 1 ? 1 : 0) };   // d100=1  → réussi

  it('servant qui RATE → `onFail` appliqué (12 Dégâts mitigés BE/PA)', () => {
    const { hull } = hullWith(['m1']);
    const m1 = sailor('m1');
    const hits = applyCrewHit(hull, [m1], detachTest, rngFail);
    expect(hits).toEqual([{ crewId: 'm1' }]);
    expect(m1.wounds.current).toBe(13 - (12 - 3)); // 12 − BE(3) − PA(0) = 9 PB perdus → 4
  });

  it('servant qui RÉUSSIT → indemne', () => {
    const { hull } = hullWith(['m1']);
    const m1 = sailor('m1');
    expect(applyCrewHit(hull, [m1], detachTest, rngPass)).toHaveLength(0);
    expect(m1.wounds.current).toBe(13);
  });

  it('coque sans poste → [] (rien à détacher)', () => {
    const hull = { id: 'hull', postes: [] } as unknown as Combatant;
    expect(applyCrewHit(hull, [], detachTest, rngFail)).toEqual([]);
  });

  it('servants déjà hors de combat (mort / 0 PB) ignorés', () => {
    const { hull } = hullWith(['mort', 'ko']);
    const mort = sailor('mort', { dead: true });
    const ko = sailor('ko', { wounds: { current: 0, max: 13, base: 13 } as never });
    expect(applyCrewHit(hull, [mort, ko], detachTest, rngFail)).toHaveLength(0);
  });
});

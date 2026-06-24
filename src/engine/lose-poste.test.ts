import { describe, it, expect } from 'vitest';
import { loseRandomPoste, detachPosteCrewHit } from './shipCritical';
import type { Combatant, ShipPoste } from './types';

/** Marin minimal — assez pour `testValue('athletisme')` (Ag=36) + `applyOps` wounds (BE=3, PA=0). */
const sailor = (id: string, over: Partial<Combatant> = {}): Combatant => ({
  id, name: id, kind: 'npc', characteristics: { CC: 31, CT: 31, F: 31, E: 31, I: 31, Ag: 36, Dex: 36, Int: 31, FM: 31, Soc: 36 },
  skills: [], talents: [], traits: [], conditions: [], activeEffects: [], liveTraits: [], weapons: [],
  armour: { corps: 0 }, wounds: { current: 13, max: 13, base: 13 }, advantage: 0, ...over,
}) as unknown as Combatant;

/**
 * « Canon perdu » (MDG ch.13 l.765) : une pièce d'artillerie passe par-dessus bord — retirée de `hull.postes`,
 * et son chef de pièce perd son `mannedPoste` + l'arme dérivée (il ne sert plus rien). Mécanise le Critique
 * de navire (table Équipements, d10 7-8) qui n'était jusqu'ici que `note` narrative.
 */
describe('loseRandomPoste — Canon perdu (MDG ch.13 l.765)', () => {
  const setup = () => {
    const poste: ShipPoste = { item: { uid: 'p1', name: 'Pierrier' } as never, side: 'tribord', crewIds: ['chef'] };
    const hull = { id: 'hull', name: 'Cogue', postes: [poste] } as unknown as Combatant;
    const chef = { id: 'chef', name: 'Canonnier', mannedPoste: poste, weapons: [{ uid: 'p1', name: 'Pierrier', type: 'ranged' }] } as unknown as Combatant;
    return { hull, chef, poste };
  };

  it('retire le poste de la coque ET démancipe son chef (mannedPoste + arme du poste)', () => {
    const { hull, chef, poste } = setup();
    const lost = loseRandomPoste(hull, [chef], { int: () => 0 }); // rng→0 : retire le poste d'index 0
    expect(lost).toBe(poste);
    expect(hull.postes).toHaveLength(0); // passé par-dessus bord
    expect(chef.mannedPoste).toBeUndefined(); // le chef ne sert plus rien
    expect(chef.weapons.find((w) => w.uid === 'p1')).toBeUndefined(); // l'arme du poste disparaît du loadout
  });

  it('coque sans poste → null (aucun retrait fantôme)', () => {
    const hull = { id: 'hull', postes: [] } as unknown as Combatant;
    expect(loseRandomPoste(hull, [], { int: () => 0 })).toBeNull();
  });

  it('ne touche au chef QUE s’il servait bien CE poste (pas de démancipation parasite)', () => {
    const { hull, chef, poste } = setup();
    const autre: ShipPoste = { item: { uid: 'p2', name: 'Canon' } as never, side: 'babord', crewIds: ['chef'] };
    chef.mannedPoste = autre; // le chef sert un AUTRE poste
    loseRandomPoste(hull, [chef], { int: () => 0 }); // retire `poste` (p1)
    expect(chef.mannedPoste).toBe(autre); // intact : il ne servait pas le poste perdu
    expect(chef.weapons.find((w) => w.uid === 'p1')).toBeDefined();
  });
});

/**
 * « Canon détaché » (MDG ch.13 l.763-764) : amarres rompues → l'équipage du poste teste l'Athlétisme
 * Intermédiaire (+0) sous peine de 12 Dégâts. Contrairement à « Canon perdu », le canon RESTE à bord.
 */
describe('detachPosteCrewHit — Canon détaché (MDG ch.13 l.763-764)', () => {
  const hullWith = (crewIds: string[]) => {
    const poste: ShipPoste = { item: { uid: 'p1', name: 'Canon' } as never, side: 'tribord', crewIds };
    return { hull: { id: 'hull', postes: [poste] } as unknown as Combatant, poste };
  };
  // int(1,100) = d100 du Test d'Athlétisme ; int(0,n) = tirage du poste (index 0).
  const rngFail = { int: (min: number) => (min === 1 ? 100 : 0) }; // d100=100 → Athlétisme raté
  const rngPass = { int: (min: number) => (min === 1 ? 1 : 0) };   // d100=1  → Athlétisme réussi

  it('servant qui RATE l’Athlétisme → 12 Dégâts (mitigés BE/PA) appliqués', () => {
    const { hull } = hullWith(['m1']);
    const m1 = sailor('m1');
    const hits = detachPosteCrewHit(hull, [m1], rngFail);
    expect(hits).toEqual([{ crewId: 'm1', damage: 12 }]); // l'Indice du coup = 12 (la mitigation suit dans les PB)
    expect(m1.wounds.current).toBe(13 - (12 - 3)); // 12 − BE(3) − PA(0) = 9 PB perdus → 4
  });

  it('servant qui RÉUSSIT l’Athlétisme → indemne', () => {
    const { hull } = hullWith(['m1']);
    const m1 = sailor('m1');
    const hits = detachPosteCrewHit(hull, [m1], rngPass);
    expect(hits).toHaveLength(0);
    expect(m1.wounds.current).toBe(13);
  });

  it('coque sans poste → [] (rien à détacher)', () => {
    const hull = { id: 'hull', postes: [] } as unknown as Combatant;
    expect(detachPosteCrewHit(hull, [], rngFail)).toEqual([]);
  });

  it('servants déjà hors de combat (mort / 0 PB) ignorés', () => {
    const { hull } = hullWith(['mort', 'ko']);
    const mort = sailor('mort', { dead: true });
    const ko = sailor('ko', { wounds: { current: 0, max: 13, base: 13 } as never });
    const hits = detachPosteCrewHit(hull, [mort, ko], rngFail);
    expect(hits).toHaveLength(0); // aucun servant exposé → aucun Test, aucun dégât
  });
});

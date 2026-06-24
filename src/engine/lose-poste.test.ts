import { describe, it, expect } from 'vitest';
import { loseRandomPoste } from './shipCritical';
import type { Combatant, ShipPoste } from './types';

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

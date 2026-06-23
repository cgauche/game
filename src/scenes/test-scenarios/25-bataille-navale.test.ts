import { describe, it, expect } from 'vitest';
import { testScenarios } from './index';
import { spawnEnemy } from '../../state/spawn';
import { applyCriticalToTarget, firedAttackBlock, firedWeapon } from '../../state/combatFlow';
import { seedBattleRng } from '../../state/battleRng';
import { compatibleAmmo } from '../../engine/items';
import type { Combatant } from '../../engine/types';

const scen = testScenarios.find((s) => s.id === 'bataille-navale')!;

/** Reconstruit le roster ennemi du scénario depuis ses entités (ids déterministes `enemy-enc-naval-<i>`),
 *  exactement comme le fait `combatSlice` au démarrage du combat. */
function spawnRoster(): Combatant[] {
  const ents = scen.scene.entities
    .filter((e) => e.id.startsWith('enemy-enc-naval-'))
    .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  return ents.map((e) => spawnEnemy(e.ref, e.statblock, e.id, e.pos, { crewIds: e.crewIds }));
}

/**
 * Vérification BOUT-EN-BOUT du scénario jouable (sans navigateur) : l'authoring (cogue + équipage) se
 * SPAWN en un navire-Combattant lié à de vrais marins, et un Coup Critique encaissé par la coque
 * produit un effet NAVAL (État sur la coque) ou touche l'équipage — toute la chaîne MDG ch.13-14.
 */
describe('Scénario Bataille navale — chaîne navale jouable', () => {
  it('le navire spawn comme COQUE (vehicule, enemy, B50) liée à son ÉQUIPAGE (crewIds → vrais marins)', () => {
    const roster = spawnRoster();
    const ship = roster[0];
    expect(ship.bodyShape).toBe('vehicule');
    expect(ship.kind).toBe('enemy');
    expect(ship.creatureId).toBe('cogue');
    expect(ship.wounds.max).toBe(50);
    expect(ship.crewIds).toEqual(['enemy-enc-naval-1', 'enemy-enc-naval-2', 'enemy-enc-naval-3']);
    for (const id of ship.crewIds!) expect(roster.find((c) => c.id === id)).toBeTruthy();
  });

  it('frapper la coque pose un État NAVAL ou touche l’équipage lié (balayage de seeds, déterministe)', () => {
    let navalEffect = false;
    for (let seed = 1; seed <= 60 && !navalEffect; seed++) {
      seedBattleRng(seed);
      const roster = spawnRoster();
      const ship = roster[0];
      const before = roster.slice(1).map((c) => c.wounds.current);
      const get = (() => ({ battle: { combatants: roster } })) as never;
      applyCriticalToTarget(ship, 'corps', true, 0, [], (() => {}) as never, undefined, undefined, undefined, undefined, get);
      const hullState = ship.conditions.length > 0;
      const crewHurt = roster.slice(1).some((c, i) => c.wounds.current < before[i] || (c.traumas?.length ?? 0) > 0 || c.conditions.length > 0);
      navalEffect = hullState || crewHurt;
    }
    expect(navalEffect).toBe(true);
  });
});

describe('Artillerie jouable — un canonnier peut charger et tirer son pierrier sur la coque', () => {
  it('le pierrier trouve ses munitions (famille « artillerie ») → tir AUTORISÉ (pas de blocage noammo)', () => {
    const gunner = scen.makeParty()[0]; // armé d'un pierrier + balles, chargé
    gunner.pos = { x: 2, y: 6 }; // à distance de la coque (sinon firedWeapon choisit la mêlée)
    const roster = spawnRoster();
    const ship = roster[0]; // pos { x: 13, y: 6 }
    const gun = firedWeapon(gunner, ship);
    expect(gun.type).toBe('ranged'); // le pierrier est bien l'arme active à distance
    expect(gun.subType).toBe('armes-de-siege');
    expect(compatibleAmmo(gunner, gun).length).toBeGreaterThan(0); // munition de siège compatible trouvée
    // get-stub : le pierrier n'est pas un poste monté (pas de mountSide) → l'arc n'est pas évalué, get inutilisé.
    expect(firedAttackBlock((() => ({ battle: undefined })) as never, gunner, ship)).toBeNull(); // chargé + munition → le tir peut partir
  });

  it('2 héros sont des canonniers (pierrier équipé), 2 restent abordeurs', () => {
    const party = scen.makeParty();
    const gunners = party.filter((h) => (h.items ?? []).some((i) => i.trappingId === 'pierrier' && i.equipped));
    expect(gunners.length).toBe(2);
  });
});

import { describe, it, expect } from 'vitest';
import { testScenarios } from './index';
import { spawnEnemy } from '../../state/spawn';
import { applyCriticalToTarget, firedAttackBlock } from '../../state/combatFlow';
import { applyShipPostes } from '../../state/shipPostes';
import { availableAttacks } from '../../state/combatManeuvers';
import { seedBattleRng } from '../../state/battleRng';
import type { BattleState } from '../../state/store';
import type { Combatant } from '../../engine/types';

const scen = testScenarios.find((s) => s.id === 'bataille-navale')!;

/** Reconstruit le roster d'entités du scénario (ids déterministes `enemy-enc-naval-<i>` — cogue, pirates
 *  ET la barge AMIE), exactement comme `combatSlice` au démarrage : on transmet `crewIds` ET `postes`. */
function spawnRoster(): Combatant[] {
  const ents = scen.scene.entities
    .filter((e) => e.id.startsWith('enemy-enc-naval-'))
    .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  return ents.map((e) => spawnEnemy(e.ref, e.statblock, e.id, e.pos, { crewIds: e.crewIds, postes: e.postes, upgrades: e.upgrades }));
}

/**
 * Vérification BOUT-EN-BOUT du scénario jouable (sans navigateur) : l'authoring (cogue + équipage) se
 * SPAWN en un navire-Combattant lié à de vrais marins, et un Coup Critique encaissé par la coque produit
 * un effet NAVAL (État sur la coque) ou touche l'équipage — toute la chaîne MDG ch.13-14.
 */
describe('Scénario Bataille navale — chaîne navale jouable', () => {
  it('la cogue spawn comme COQUE (vehicule, enemy, B50) liée à son ÉQUIPAGE (crewIds → vrais marins)', () => {
    const ship = spawnRoster().find((c) => c.id === 'enemy-enc-naval-0')!;
    expect(ship.bodyShape).toBe('vehicule');
    expect(ship.kind).toBe('enemy');
    expect(ship.creatureId).toBe('cogue');
    expect(ship.wounds.max).toBe(50);
    expect(ship.crewIds).toEqual(['enemy-enc-naval-1', 'enemy-enc-naval-2', 'enemy-enc-naval-3']);
  });

  it('l’Amélioration d’instance « Blindage (fer) » donne 2 PA de coque au spawn (MDG ch.12 l.236)', () => {
    const ship = spawnRoster().find((c) => c.id === 'enemy-enc-naval-0')!;
    expect(ship.upgrades).toEqual(['Blindage (fer)']); // authoré sur l'instance de la scène
    expect(ship.armour.corps).toBe(2); // mitige les Dégâts navals (applyOps op wounds)
  });

  it('frapper la coque pose un État NAVAL ou touche l’équipage lié (balayage de seeds, déterministe)', () => {
    let navalEffect = false;
    for (let seed = 1; seed <= 60 && !navalEffect; seed++) {
      seedBattleRng(seed);
      const roster = spawnRoster();
      const ship = roster.find((c) => c.id === 'enemy-enc-naval-0')!;
      const crew = roster.filter((c) => ship.crewIds!.includes(c.id));
      const before = crew.map((c) => c.wounds.current);
      const get = (() => ({ battle: { combatants: roster } })) as never;
      applyCriticalToTarget(ship, 'corps', true, 0, [], (() => {}) as never, undefined, undefined, undefined, undefined, get);
      const hullState = ship.conditions.length > 0;
      const crewHurt = crew.some((c, i) => c.wounds.current < before[i] || (c.traumas?.length ?? 0) > 0 || c.conditions.length > 0);
      navalEffect = hullState || crewHurt;
    }
    expect(navalEffect).toBe(true);
  });
});

/**
 * Artillerie JOUABLE par poste servi (MDG ch.12-13) — remplace l'ancienne triche (pierrier en inventaire).
 * Au démarrage, `applyShipPostes` sert les pierriers de la barge AMIE à leurs chefs de pièce (le Soldat +
 * le Chasseur) → l'attaque dédiée « Servir le pierrier » apparaît, épinglant le canon du poste.
 */
describe('Artillerie jouable — 2 héros SERVENT un poste de pierrier (pas d’inventaire)', () => {
  it('applyShipPostes pose le mannedPoste sur le Soldat + le Chasseur, et l’attaque « Servir » apparaît', () => {
    const party = scen.makeParty();
    const all = [...party, ...spawnRoster()];
    applyShipPostes(all); // comme combatSlice au démarrage
    const gunners = party.filter((h) => h.mannedPoste);
    expect(gunners.length).toBe(2); // le Soldat (seed 101) + le Chasseur (seed 303)
    const battle = { combatants: all, acted: false } as unknown as BattleState;
    for (const g of gunners) {
      const w = g.weapons.find((x) => x.uid === g.mannedPoste!.item.uid);
      expect(w?.type).toBe('ranged'); // le pierrier servi est une arme à distance
      expect(w?.subType).toBe('armes-de-siege');
      const serve = availableAttacks(g, battle).find((o) => o.id === 'poste');
      expect(serve).toBeDefined(); // bouton « Servir le pierrier »
      expect(serve!.weaponUid).toBe(g.mannedPoste!.item.uid); // épingle le canon (≠ arme perso auto-choisie)
    }
  });

  it('les 2 autres héros (Tueur + Sorcier) ne servent AUCUN poste — ils aborderont', () => {
    const party = scen.makeParty();
    applyShipPostes([...party, ...spawnRoster()]);
    expect(party.filter((h) => !h.mannedPoste).length).toBe(2);
  });

  it('la bordée tribord PEUT TIRER sur la cogue (cap Nord = octant tribord + munition de siège + chargé)', () => {
    const party = scen.makeParty();
    const all = [...party, ...spawnRoster()];
    applyShipPostes(all);
    const gunner = party.find((h) => h.mannedPoste)!;
    gunner.pos = { x: 3, y: 6 }; // à bord de la barge
    const cogue = all.find((c) => c.id === 'enemy-enc-naval-0')!; // plein est de la barge
    const barge = all.find((c) => c.id === 'enemy-enc-naval-4')!;
    // `faceAtCombatStart` applique le cap authoré (Nord) ; la cogue plein EST tombe dans l'arc TRIBORD.
    const get = (() => ({ battle: { combatants: all }, facing: { [barge.id]: 'N' }, log: () => {} })) as never;
    // null = le tir PART : dans l'arc (cap Nord) + munition compatible + chargé. (Un cap 'E' le mettrait en
    // proue → reason 'arc' ; sans munition → 'noammo'.) → garde-fou contre les deux régressions.
    expect(firedAttackBlock(get, gunner, cogue, gunner.mannedPoste!.item.uid)).toBeNull();
  });
});

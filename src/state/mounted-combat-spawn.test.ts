import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { checkBattleOver } from './combatFlow';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { testScene } from '../scenes/test-fixture';
import type { Possession } from '../engine/possession';

/**
 * #621 — la monture de COMBAT du héros (`heroCombatMount`) accepte un cavalier si elle n'est PAS
 * Belliqueuse OU a Dressé (Monture) (LDB 339 l.… ; `possessionCombatRideable`) — INDÉPENDANT du profil
 * EDOC de voyage (`heroMount`/`partyMounts`, qui exige `montures.json` : le `cheval` LDB n'en a pas).
 * Spawnée en ALLIÉ `id = possession.uid`, appairée (`mountUp`).
 */

function makeHero() {
  return createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', rng: makeRNG(1) });
}

function startFixtureCombat(hero: ReturnType<typeof makeHero>, possessions: Possession[]) {
  useGame.setState({ party: [hero], battle: null });
  useGame.getState().startScene(testScene); // reset qui vide `possessions` (seedStartingPossessions) — injecter APRÈS
  useGame.setState({ possessions });
  useGame.getState().startCombat('enc-mutants');
}

describe('#621 — montures-possession spawnées en combat monté (LDB 14)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('un CHEVAL (LDB, non Belliqueux) avec-le-groupe est spawné en allié, appairé au héros', () => {
    const hero = makeHero();
    const cheval: Possession = {
      uid: 'pos-cheval-1', ownerId: hero.id, nature: 'bete', ref: { creatureId: 'cheval' },
      location: { kind: 'avec-le-groupe' }, items: [],
    };
    startFixtureCombat(hero, [cheval]);

    const battle = useGame.getState().battle!;
    const mount = battle.combatants.find((c) => c.id === 'pos-cheval-1');
    expect(mount).toBeTruthy();
    expect(mount!.kind).toBe('hero');
    expect(mount!.riderId).toBe(hero.id);
    expect(mount!.mountable).toBe(true);
    const heroCombatant = battle.combatants.find((c) => c.id === hero.id)!;
    expect(heroCombatant.mountId).toBe('pos-cheval-1');
  });

  it('une MULE (Belliqueuse absente de ses traits, Dressé (Monture) inné) est spawnée en allié', () => {
    const hero = makeHero();
    const mule: Possession = {
      uid: 'pos-mule-1', ownerId: hero.id, nature: 'bete', ref: { creatureId: 'mule' },
      location: { kind: 'avec-le-groupe' }, items: [],
    };
    startFixtureCombat(hero, [mule]);

    const battle = useGame.getState().battle!;
    const mount = battle.combatants.find((c) => c.id === 'pos-mule-1');
    expect(mount).toBeTruthy();
    expect(mount!.kind).toBe('hero');
    expect(mount!.riderId).toBe(hero.id);
    const heroCombatant = battle.combatants.find((c) => c.id === hero.id)!;
    expect(heroCombatant.mountId).toBe('pos-mule-1');
  });

  it('un HYPPOGRIFFE Belliqueux SANS Dressé (Monture) n’est PAS spawné en combat (LDB 339)', () => {
    const hero = makeHero();
    const hippogriffe: Possession = {
      uid: 'pos-hippo-1', ownerId: hero.id, nature: 'bete', ref: { creatureId: 'hyppogriffe' },
      location: { kind: 'avec-le-groupe' }, items: [],
    };
    startFixtureCombat(hero, [hippogriffe]);

    const battle = useGame.getState().battle!;
    expect(battle.combatants.find((c) => c.id === 'pos-hippo-1')).toBeUndefined();
    const heroCombatant = battle.combatants.find((c) => c.id === hero.id)!;
    expect(heroCombatant.mountId).toBeUndefined();
  });

  it('cavalier SEUL hors d’action, monture encore vivante → DÉFAITE (une monture `mountable` ne compte pas comme héros vivant)', () => {
    const hero = makeHero();
    const cheval: Possession = {
      uid: 'pos-cheval-defaite', ownerId: hero.id, nature: 'bete', ref: { creatureId: 'cheval' },
      location: { kind: 'avec-le-groupe' }, items: [],
    };
    startFixtureCombat(hero, [cheval]);

    const battle = useGame.getState().battle!;
    const heroCombatant = battle.combatants.find((c) => c.id === hero.id)!;
    const mount = battle.combatants.find((c) => c.id === 'pos-cheval-defaite')!;
    expect(mount.dead).toBeFalsy(); // la monture VIT
    heroCombatant.dead = true; // le cavalier est hors d'action (`isOutOfAction`)
    useGame.setState({ battle: { ...battle } });

    checkBattleOver(useGame.getState, useGame.setState);
    expect(useGame.getState().battle!.over).toBe('defeat');
  });

  it('une bête AU LIEU (pas avec le groupe), même chevauchable, n’est PAS spawnée en combat', () => {
    const hero = makeHero();
    const chevalEnPension: Possession = {
      uid: 'pos-cheval-2', ownerId: hero.id, nature: 'bete', ref: { creatureId: 'cheval' },
      location: { kind: 'au-lieu', placeId: 'ecurie-x' }, items: [],
    };
    startFixtureCombat(hero, [chevalEnPension]);

    const battle = useGame.getState().battle!;
    expect(battle.combatants.find((c) => c.id === 'pos-cheval-2')).toBeUndefined();
  });
});

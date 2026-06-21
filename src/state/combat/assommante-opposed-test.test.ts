import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from '../store';
import { fireTriggers } from '../triggeredEffects';
import '../combatFlow'; // effet de bord : installe le routeur de Test + l'applier triggeredTest + le hook onGainCondition
import { createHero } from '../../engine/character';
import { makeRNG } from '../../engine/dice';
import { seedBattleRng } from '../battleRng';
import { hasCondition } from '../../engine/conditions';
import { resolveOpposed } from '../../engine/tests';
import { testValue } from '../../engine/skills';
import { resetRule } from '../../engine/policy';
import { testScene } from '../../scenes/test-fixture';
import type { Weapon } from '../../engine/types';

/**
 * Assommante (LDB 62 l.268) en nœud Flow `test` OPPOSÉ (Lot 4c) : « Si vous touchez la Tête avec une
 * arme Assommante, tentez un Test opposé Force/Résistance contre la cible frappée. Si vous remportez le
 * Test, votre adversaire gagne Sonné. » L'attaquant (porteur de l'arme) oppose sa FORCE (FIGÉE) à la
 * RÉSISTANCE de la victime ; l'issue vient de `resolveOpposed` (PAS d'un test simple plié) — l'attaquant
 * doit REMPORTER (égalité = victime résiste, RAW). Trois cas :
 *  (a) victime HÉROS MANUEL → étape de cascade `triggeredTest` INFLUENÇABLE portant l'attaquant figé ;
 *      l'issue (Sonné ou non) suit `resolveOpposed(jetDéfenseur, aT)`.
 *  (a-bis) ÉGALITÉ (même DR + même cible) → la victime RÉSISTE, PAS de Sonné (preuve de fidélité : un
 *      test simple plié aurait conclu « réussite » sur le jet de l'attaquant, ici l'égalité ne suffit pas).
 *  (b) victime ENNEMIE → jet INLINE + Sonné si l'attaquant l'emporte.
 */
const assommante = (): Weapon => ({ name: "Marteau de guerre", type: 'melee', damage: { plusBF: true, flat: 6 }, qualities: ['assommante'] });

describe('Assommante — nœud Flow test OPPOSÉ (Force figée vs Résistance, resolveOpposed)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    resetRule('combat-cadence');
    useGame.setState({ pendingCascade: null, battle: null, pendingLogQueue: [] });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  function setup() {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', name: 'H', rng: makeRNG(1) });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const enemies = b.combatants.filter((c) => c.kind === 'enemy');
    const wielder = enemies[0]; // le porteur de l'arme Assommante (attaquant)
    const prey = enemies[1];    // une victime ENNEMIE (cas b)
    enemies.slice(2).forEach((e) => (e.dead = true));
    H.wounds.max = 200; H.wounds.current = 200;
    prey.wounds.max = 200; prey.wounds.current = 200;
    useGame.setState({ battle: { ...b }, pendingCascade: null, pendingReveals: [], pendingLogQueue: [] });
    return { H, wielder, prey };
  }

  it('(a) victime HÉROS MANUEL : étape triggeredTest OPPOSÉE influençable (Force attaquant figée dans meta.opposed)', () => {
    seedBattleRng(7);
    const { H, wielder } = setup();
    wielder.characteristics.F = 55;

    // onHit à la TÊTE → l'Atout Assommante teste Force(attaquant) vs Résistance(victime).
    fireTriggers(useGame.getState, wielder, 'onHit', { victim: H, weapon: assommante(), location: 'tete', rng: makeRNG(1), set: useGame.setState });

    const casc = useGame.getState().pendingCascade!;
    expect(casc).toBeTruthy();
    expect(casc.purpose).toBe('combat');
    const step = casc.participants.find((s) => s.kind === 'triggeredTest')!;
    expect(step).toBeTruthy();
    expect(step.actorId).toBe(H.id);
    expect(step.result).toBeFalsy();        // pas encore lancé → Chance/Pacte/Résilience possibles
    expect(step.rollLabel).toBe('Résistance'); // le DÉFENSEUR jette la Résistance
    // L'attaquant est PRÉ-JETÉ et FIGÉ dans le meta (sérialisable, coop) → la cascade re-oppose à chaque influence.
    expect(step.meta?.opposed).toBeTruthy();
    expect(typeof step.meta?.opposed?.aT.roll).toBe('number');
    expect(step.meta?.opposed?.attackerLabel).toBe('Force');
  });

  it('(a) HÉROS : cascadeRoll+cascadeNext → l’issue (Sonné ou non) SUIT resolveOpposed(jetDéfenseur, Force figée)', () => {
    seedBattleRng(3);
    const { H, wielder } = setup();
    wielder.characteristics.F = 60;
    H.characteristics.E = 30; // Résistance basse → l’attaquant l’emporte probablement

    fireTriggers(useGame.getState, wielder, 'onHit', { victim: H, weapon: assommante(), location: 'tete', rng: makeRNG(1), set: useGame.setState });
    const step = useGame.getState().pendingCascade!.participants.find((s) => s.kind === 'triggeredTest')!;
    const aT = step.meta!.opposed!.aT; // attaquant figé

    useGame.getState().cascadeRoll(step.id);
    // Le jet du défenseur (Résistance) est posé sur l’étape ; l’issue doit être COHÉRENTE avec resolveOpposed
    // (ATTAQUANT figé en 1ʳᵉ position, comme la production) : la victime résiste si l’attaquant ne l’emporte pas.
    const rolled = useGame.getState().pendingCascade!.participants.find((s) => s.id === step.id)!.result!;
    const expectedResist = resolveOpposed(aT, { roll: rolled.roll, target: rolled.target, success: rolled.success, sl: rolled.sl, isDouble: false }).winner !== 'attacker';
    useGame.getState().cascadeNext();

    const h = useGame.getState().battle!.combatants.find((x) => x.id === H.id)!;
    // Sonné posé SSI l’attaquant l’emporte (la victime ne résiste PAS) — preuve que l’applier branche via resolveOpposed.
    expect(hasCondition(h, 'sonne')).toBe(!expectedResist);
  });

  it('(a-bis) ÉGALITÉ (même DR + même cible) : la victime RÉSISTE, PAS de Sonné (fidélité resolveOpposed, pas un test simple)', () => {
    // On ALIGNE la Résistance du héros sur la Force de l’attaquant (même cible effective) → même DR → ÉGALITÉ
    // stricte → resolveOpposed = 'tie' → l’attaquant ne REMPORTE pas → la victime RÉSISTE (RAW LDB 62 l.268).
    const { H, wielder } = setup();
    wielder.characteristics.F = 50;
    const fTarget = testValue(wielder, undefined, 'F'); // cible effective de la Force de l’attaquant
    // Aligne la cible de Résistance du héros sur celle de la Force de l’attaquant (compense les avances de
    // compétence : Résistance = E + avances) → cibles strictement égales.
    H.characteristics.E += fTarget - testValue(H, 'resistance');
    expect(testValue(H, 'resistance')).toBe(fTarget);

    // seed POSÉ ICI (après le spawn qui consomme le RNG d’initiative) : la 1ʳᵉ consommation est le jet de
    // l’ATTAQUANT, la 2ᵉ celui du défenseur (cascadeRoll). seed 113 → deux d100 IDENTIQUES → ÉGALITÉ stricte.
    seedBattleRng(113);
    fireTriggers(useGame.getState, wielder, 'onHit', { victim: H, weapon: assommante(), location: 'tete', rng: makeRNG(1), set: useGame.setState });
    const step = useGame.getState().pendingCascade!.participants.find((s) => s.kind === 'triggeredTest')!;
    const aT = step.meta!.opposed!.aT;

    useGame.getState().cascadeRoll(step.id);
    const rolled = useGame.getState().pendingCascade!.participants.find((s) => s.id === step.id)!.result!;
    // Le cœur de la preuve : jet défenseur == jet attaquant (même roll/cible/DR) → ÉGALITÉ stricte.
    expect(rolled.roll).toBe(aT.roll);
    expect(rolled.target).toBe(aT.target);
    expect(rolled.sl).toBe(aT.sl);
    expect(resolveOpposed(aT, { roll: rolled.roll, target: rolled.target, success: rolled.success, sl: rolled.sl, isDouble: false }).winner).toBe('tie');
    // L’étape conclut « résiste » (success) — un test simple plié sur le jet de l’ATTAQUANT aurait conclu autrement.
    expect(rolled.success).toBe(true);
    useGame.getState().cascadeNext();

    const h = useGame.getState().battle!.combatants.find((x) => x.id === H.id)!;
    expect(hasCondition(h, 'sonne')).toBe(false); // ÉGALITÉ → PAS de Sonné (l’attaquant ne remporte pas)
  });

  it('(b) victime ENNEMIE : jet INLINE + Sonné si l’attaquant l’emporte (pas de cascade)', () => {
    seedBattleRng(5);
    const { wielder, prey } = setup();
    wielder.characteristics.F = 90; // Force élevée
    prey.characteristics.E = 1;     // Résistance minimale → l’attaquant l’emporte

    fireTriggers(useGame.getState, wielder, 'onHit', { victim: prey, weapon: assommante(), location: 'tete', rng: makeRNG(1), set: useGame.setState });

    expect(useGame.getState().pendingCascade).toBeNull(); // ennemi → jamais d’étape influençable
    const live = useGame.getState().battle!.combatants.find((c) => c.id === prey.id)!;
    expect(hasCondition(live, 'sonne')).toBe(true); // l’attaquant l’emporte → Sonné posé inline
    // La ligne d’opposition (Force vs Résistance) part dans la file différée.
    expect(useGame.getState().pendingLogQueue.some((q) => /Force.*Résistance|Résistance.*Force/.test(q.line))).toBe(true);
  });

  it('(c) touche AILLEURS qu’à la Tête : aucun Test (la Condition `location:tete` ne passe pas)', () => {
    seedBattleRng(5);
    const { wielder, prey } = setup();
    wielder.characteristics.F = 90;
    prey.characteristics.E = 1;

    fireTriggers(useGame.getState, wielder, 'onHit', { victim: prey, weapon: assommante(), location: 'corps', rng: makeRNG(1), set: useGame.setState });

    expect(useGame.getState().pendingCascade).toBeNull();
    const live = useGame.getState().battle!.combatants.find((c) => c.id === prey.id)!;
    expect(hasCondition(live, 'sonne')).toBe(false); // pas à la Tête → pas de Test opposé, pas de Sonné
  });
});

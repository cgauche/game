import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from '../store';
import '../combatFlow'; // effet de bord : enregistre l'applier 'bladeTrap' + installe les hooks (breakBlade…)
import { pushCombatStep } from '../combatEffects';
import { createHero } from '../../engine/character';
import { makeRNG } from '../../engine/dice';
import { seedBattleRng } from '../battleRng';
import { resolveOpposed } from '../../engine/tests';
import { resetRule, setRule } from '../../engine/policy';
import { testScene } from '../../scenes/test-fixture';
import type { PendingBladeTrap } from '../pendings';
import type { Weapon } from '../../engine/types';

/**
 * Piège-lame (LDB 62 l.292-295) en Test opposé CADENCE-AWARE : « Si vous obtenez un Critique en vous
 * défendant contre une arme à lame, vous pouvez choisir de la piéger… effectuez un Test opposé de Force,
 * en ajoutant votre DR obtenu au précédent Test de Corps à corps. Si vous l'emportez, l'adversaire laisse
 * tomber la lame ; Succès Stupéfiant → la lame est BRISÉE sauf Incassable ; échec → l'adversaire libère sa
 * lame. » Le HÉROS défenseur PEUT influencer le Test (Chance/Résilience) — l'étape `triggeredTest` est
 * INFLUENÇABLE ; la conséquence (désarme/bris) est PROCÉDURALE après le Test résolu (op `breakBlade`).
 */
const bladedWeapon = (uid: string, qualities: string[] = []): Weapon => ({ name: 'Épée', type: 'melee', damage: '+BF+4', qualities, uid });

describe('Piège-lame — Test opposé de Force CADENCE-AWARE (op breakBlade, désarme/bris procédural)', () => {
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
    const H = b.combatants.find((c) => c.kind === 'hero')!; // le héros piégeur (défenseur)
    const A = b.combatants.find((c) => c.kind === 'enemy')!; // l'attaquant dont la lame est visée
    useGame.setState({ battle: { ...b }, pendingCascade: null, pendingReveals: [], pendingLogQueue: [] });
    return { H, A };
  }

  /** Pousse l'étape de CHOIX « piège-lame » (créée en production au Critique défensif) puis tranche `trap`
   *  et avance → l'applier route le Test opposé cadence-aware (héros manuel → étape `triggeredTest`). */
  function openTrapChoice(H: { id: string }, A: { id: string }, weapon: Weapon, defSL: number) {
    const pbt: PendingBladeTrap = { defenderId: H.id, attackerId: A.id, weapon, parryWeaponUid: 'parry-uid', defSL, roll: 33 };
    pushCombatStep(useGame.setState, {
      id: 'cons-bladetrap', kind: 'bladeTrap', actorId: H.id, icon: '🗡️', label: 'Parade — piéger la lame ?',
      options: [{ key: 'trap', label: 'Piéger la lame' }, { key: 'crit', label: 'Coup Critique' }],
      defaultChoice: 'crit', bladeTrap: pbt, interactive: true,
    });
    useGame.getState().cascadeChoose('cons-bladetrap', 'trap');
    useGame.getState().cascadeNext(); // commit du choix → l'applier append l'étape `triggeredTest`
  }

  it('héros MANUEL : « Piéger » ouvre un Test opposé de Force INFLUENÇABLE (attaquant figé + bonus defSL)', () => {
    seedBattleRng(7);
    const { H, A } = setup();
    const weapon = bladedWeapon('atk-blade');
    A.weapons = [weapon];

    openTrapChoice(H, A, weapon, 2);

    const casc = useGame.getState().pendingCascade!;
    expect(casc).toBeTruthy();
    const step = casc.participants.find((s) => s.kind === 'triggeredTest')!;
    expect(step).toBeTruthy();
    expect(step.actorId).toBe(H.id);          // le DÉFENSEUR jette
    expect(step.result).toBeFalsy();          // pas encore lancé → Chance/Résilience possibles
    expect(step.rollLabel).toBe('Force');     // Test de Force opposée
    // L'attaquant est PRÉ-JETÉ et FIGÉ + le bonus de DR de la défense voyage dans le meta (sérialisable, coop).
    expect(step.meta?.opposed).toBeTruthy();
    expect(step.meta?.opposed?.bonusSL).toBe(2);
    expect(typeof step.meta?.opposed?.aT.sl).toBe('number');
    // Contexte de la conséquence : la lame visée + le DR figé de l'attaquant.
    expect(step.meta?.bladeTrap?.attackerId).toBe(A.id);
    expect(step.meta?.bladeTrap?.weaponUid).toBe('atk-blade');
    expect(step.meta?.bladeTrap?.attackerSL).toBe(step.meta?.opposed?.aT.sl); // pas de re-jet de l'attaquant
  });

  it('héros gagne (Force écrasante) : l’adversaire est désarmé ; BRISÉE ssi marge nette ≥ 6 (Stupéfiant)', () => {
    seedBattleRng(7);
    const { H, A } = setup();
    H.characteristics.F = 90;  // Force écrasante → le défenseur l’emporte
    const weapon = bladedWeapon('atk-blade');
    A.weapons = [weapon];

    openTrapChoice(H, A, weapon, 0); // pas de bonus de défense → seule la marge du jet décide du Stupéfiant
    const step = useGame.getState().pendingCascade!.participants.find((s) => s.kind === 'triggeredTest')!;
    const aT = step.meta!.opposed!.aT;

    useGame.getState().cascadeRoll(step.id);
    const rolled = useGame.getState().pendingCascade!.participants.find((s) => s.id === step.id)!.result!;
    const o = resolveOpposed(aT, { roll: rolled.roll, target: rolled.target, success: rolled.success, sl: rolled.sl, isDouble: false });
    expect(o.winner).not.toBe('attacker'); // le défenseur l’emporte (Force écrasante)
    useGame.getState().cascadeNext();

    const a = useGame.getState().battle!.combatants.find((x) => x.id === A.id)!;
    expect(a.weapons.find((w) => w.uid === 'atk-blade')).toBeUndefined(); // désarmé dans tous les cas de victoire
    // Bris SSI Succès Stupéfiant (marge nette ≥ 6) — preuve que la conséquence lit la marge nette (LDB 62 l.295).
    expect(weapon.destroyed === true).toBe(o.netSL >= 6);
    const rx = o.netSL >= 6 ? /BRISÉE/ : /arrachée/;
    expect(useGame.getState().pendingLogQueue.some((q) => rx.test(q.line))).toBe(true);
  });

  it('Succès Stupéfiant (marge nette ≥ 6 via gros bonus defSL) : la lame est BRISÉE', () => {
    seedBattleRng(7);
    const { H, A } = setup();
    H.characteristics.F = 90;
    const weapon = bladedWeapon('atk-blade');
    A.weapons = [weapon];

    openTrapChoice(H, A, weapon, 8); // +8 DR de défense → marge nette ≥ 6 garantie sur une victoire
    const step = useGame.getState().pendingCascade!.participants.find((s) => s.kind === 'triggeredTest')!;
    const aT = step.meta!.opposed!.aT;

    useGame.getState().cascadeRoll(step.id);
    const rolled = useGame.getState().pendingCascade!.participants.find((s) => s.id === step.id)!.result!;
    // marge nette recomposée comme la conséquence : (DR défenseur + bonus) − DR attaquant.
    const net = rolled.sl + 8 - aT.sl;
    expect(net).toBeGreaterThanOrEqual(6);
    useGame.getState().cascadeNext();

    const a = useGame.getState().battle!.combatants.find((x) => x.id === A.id)!;
    expect(a.weapons.find((w) => w.uid === 'atk-blade')).toBeUndefined(); // retirée du loadout
    expect(weapon.destroyed).toBe(true); // BRISÉE (Succès Stupéfiant)
    expect(useGame.getState().pendingLogQueue.some((q) => /BRISÉE/.test(q.line))).toBe(true);
  });

  it('Succès Stupéfiant sur une lame INCASSABLE : NON brisée (arrachée seulement)', () => {
    seedBattleRng(7);
    const { H, A } = setup();
    H.characteristics.F = 90;
    const weapon = bladedWeapon('atk-blade', ['incassable']);
    A.weapons = [weapon];

    openTrapChoice(H, A, weapon, 8);
    const step = useGame.getState().pendingCascade!.participants.find((s) => s.kind === 'triggeredTest')!;
    useGame.getState().cascadeRoll(step.id);
    useGame.getState().cascadeNext();

    const a = useGame.getState().battle!.combatants.find((x) => x.id === A.id)!;
    expect(a.weapons.find((w) => w.uid === 'atk-blade')).toBeUndefined(); // arrachée des mains
    expect(weapon.destroyed).toBeFalsy(); // Incassable → pas brisée (LDB 62 l.295)
    expect(useGame.getState().pendingLogQueue.some((q) => /résiste à la casse/.test(q.line))).toBe(true);
  });

  it('héros perd (Force minime) : RIEN (l’adversaire garde sa lame)', () => {
    seedBattleRng(7);
    const { H, A } = setup();
    H.characteristics.F = 1; // Force minime → le défenseur perd
    const weapon = bladedWeapon('atk-blade');
    A.weapons = [weapon];
    A.characteristics.F = 80;

    openTrapChoice(H, A, weapon, 0);
    const step = useGame.getState().pendingCascade!.participants.find((s) => s.kind === 'triggeredTest')!;
    const aT = step.meta!.opposed!.aT;
    useGame.getState().cascadeRoll(step.id);
    const rolled = useGame.getState().pendingCascade!.participants.find((s) => s.id === step.id)!.result!;
    expect(resolveOpposed(aT, { roll: rolled.roll, target: rolled.target, success: rolled.success, sl: rolled.sl, isDouble: false }).winner).toBe('attacker');
    useGame.getState().cascadeNext();

    const a = useGame.getState().battle!.combatants.find((x) => x.id === A.id)!;
    expect(a.weapons.find((w) => w.uid === 'atk-blade')).toBeTruthy(); // garde sa lame
    expect(weapon.destroyed).toBeFalsy();
  });

  it('héros en cadence AUTO : Test opposé INLINE (pas de cascade), désarme si le défenseur l’emporte', () => {
    setRule('combat-cadence', 'auto');
    try {
      seedBattleRng(7);
      const { H, A } = setup();
      H.characteristics.F = 90;
      const weapon = bladedWeapon('atk-blade');
      A.weapons = [weapon];

      openTrapChoice(H, A, weapon, 0);
      // Cadence auto : le choix « trap » est résolu inline ; le Test opposé aussi → aucune étape influençable.
      expect(useGame.getState().pendingCascade).toBeNull();
      const a = useGame.getState().battle!.combatants.find((x) => x.id === A.id)!;
      expect(a.weapons.find((w) => w.uid === 'atk-blade')).toBeUndefined(); // désarmé inline
      expect(useGame.getState().pendingLogQueue.some((q) => /Force/.test(q.line))).toBe(true);
    } finally {
      resetRule('combat-cadence');
    }
  });
});

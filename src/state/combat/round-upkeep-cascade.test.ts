import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from '../store';
import { openRoundEndCascade } from '../combatFlow';
import { createHero } from '../../engine/character';
import { makeRNG } from '../../engine/dice';
import { seedBattleRng } from '../battleRng';
import { addCondition, stacks, hasCondition, endOfRound, COND } from '../../engine/conditions';
import { setRule, resetRule } from '../../engine/policy';
import { testScene } from '../../scenes/test-fixture';
import type { Combatant } from '../../engine/types';

/**
 * Jets d'upkeep de fin de Round concernant un HÉROS → étapes de CASCADE influençable (Mâchoires
 * d'acier / récupération du Brisé / se-fatiguer). On vérifie : (a) un héros DÛ ouvre une cascade de
 * fin de Round avec la bonne étape (kind), non encore lancée ; (b) l'ENNEMI équivalent reste résolu
 * EN SILENCE (jamais une étape de cascade) ; (c) la validation applique bien la conséquence.
 */
describe('Upkeep de fin de Round — héros en cascade, ennemis en silence', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    resetRule('combat-se-fatiguer');
    useGame.setState({ pendingCascade: null, battle: null });
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
    const E = enemies[0];
    enemies.slice(1).forEach((e) => (e.dead = true)); // une seule source ennemie
    H.pos = { x: 10, y: 10 };
    E.pos = { x: 20, y: 20 }; // loin (pas de Peur de Taille, LoS dégagée)
    useGame.setState({ battle: { ...b }, pendingCascade: null, pendingReveals: [] });
    return { H, E };
  }

  it('Mâchoires d’acier : héros Sonné → étape steelJaw dans la cascade ; ennemi Sonné non testé ici', () => {
    seedBattleRng(7);
    const { H, E } = setup();
    H.talents = [...(H.talents ?? []), { talentId: 'machoires-d-acier', times: 1 }];
    E.talents = [...(E.talents ?? []), { talentId: 'machoires-d-acier', times: 1 }];
    addCondition(H, COND.sonne, 2);
    addCondition(E, COND.sonne, 2);

    openRoundEndCascade(useGame.getState, useGame.setState);
    const c = useGame.getState().pendingCascade!;
    expect(c).toBeTruthy();
    expect(c.purpose).toBe('combat');
    expect(c.roundBoundary).toBe(true);
    // UNE seule étape (le héros) — l'ennemi n'est JAMAIS une étape de cascade (silence côté hook).
    expect(c.participants).toHaveLength(1);
    const step = c.participants[0];
    expect(step.kind).toBe('steelJaw');
    expect(step.actorId).toBe(H.id);
    expect(step.result).toBeFalsy(); // pas encore lancé → influençable
    expect(c.participants.some((s) => s.actorId === E.id)).toBe(false);
  });

  it('Récupération du Brisé : héros Brisé (non Engagé) → étape brokenRecovery ; succès retire ≥ 1 Brisé', () => {
    seedBattleRng(1);
    const { H } = setup();
    H.characteristics.FM = 80; // Calme élevé → Test réussi
    addCondition(H, COND.brise, 2);

    openRoundEndCascade(useGame.getState, useGame.setState);
    const c = useGame.getState().pendingCascade!;
    const step = c.participants.find((s) => s.kind === 'brokenRecovery')!;
    expect(step).toBeTruthy();
    expect(step.actorId).toBe(H.id);

    useGame.getState().cascadeRoll(step.id);
    useGame.getState().cascadeNext();
    const h = useGame.getState().battle!.combatants.find((x) => x.id === H.id)!;
    expect(stacks(h, COND.brise)).toBeLessThan(2); // au moins 1 Brisé retiré
  });

  it('Se-fatiguer : héros au seuil → étape fatigue (règle ON) ; rien si la règle est OFF', () => {
    const { H } = setup();
    H.effortRounds = 9; // bien au-dessus du seuil (Bonus d'Endurance)

    // Règle OFF (défaut) : aucune étape de fatigue.
    openRoundEndCascade(useGame.getState, useGame.setState);
    expect(useGame.getState().pendingCascade).toBeNull();

    // Règle ON : étape de fatigue émise pour le héros.
    setRule('combat-se-fatiguer', true);
    openRoundEndCascade(useGame.getState, useGame.setState);
    const c = useGame.getState().pendingCascade!;
    const step = c.participants.find((s) => s.kind === 'fatigue')!;
    expect(step).toBeTruthy();
    expect(step.actorId).toBe(H.id);
  });

  it('Empoisonné : héros → étape poisonResist (influençable, non lancée) ; ennemi JAMAIS une étape (silence)', () => {
    seedBattleRng(3);
    const { H, E } = setup();
    addCondition(H, COND.empoisonne, 2);
    addCondition(E, COND.empoisonne, 2);

    openRoundEndCascade(useGame.getState, useGame.setState);
    const c = useGame.getState().pendingCascade!;
    expect(c).toBeTruthy();
    expect(c.purpose).toBe('combat');
    expect(c.roundBoundary).toBe(true);
    // UNE seule étape poisonResist (le héros) — l'ennemi n'est JAMAIS une étape (silence côté hook).
    expect(c.participants).toHaveLength(1);
    const step = c.participants[0];
    expect(step.kind).toBe('poisonResist');
    expect(step.actorId).toBe(H.id);
    expect(step.rollLabel).toBe('Résistance');
    expect(step.result).toBeFalsy(); // pas encore lancé → influençable (Chance/Résilience)
    expect(c.participants.some((s) => s.actorId === E.id)).toBe(false);
  });

  it('Empoisonné : la validation de l’étape applique le retrait (E élevé → Résistance réussie + Exténué)', () => {
    seedBattleRng(5); // graine où le Test (cible 85) réussit (roll 9)
    const { H } = setup();
    H.characteristics.E = 90; // Endurance élevée → Test de Résistance réussi
    addCondition(H, COND.empoisonne, 1);

    openRoundEndCascade(useGame.getState, useGame.setState);
    const c = useGame.getState().pendingCascade!;
    const step = c.participants.find((s) => s.kind === 'poisonResist')!;
    expect(step).toBeTruthy();

    useGame.getState().cascadeRoll(step.id);
    useGame.getState().cascadeNext();
    const h = useGame.getState().battle!.combatants.find((x) => x.id === H.id)!;
    expect(hasCondition(h, COND.empoisonne)).toBe(false); // poison surmonté
    expect(hasCondition(h, COND.extenue)).toBe(true);      // … → 1 Exténué (LDB 16 l.72)
  });

  it('endOfRound(skipPoisonResist) : les DÉGÂTS d’Empoisonné sont subis, le Test est différé (héros)', () => {
    const { H } = setup();
    addCondition(H, COND.empoisonne, 2);
    const hpBefore = H.wounds.current;
    // Le hook `end-of-round` appelle endOfRound avec skipPoisonResist=true pour un héros : DÉGÂTS oui, Test non.
    endOfRound(H, makeRNG(1), { skipPoisonResist: true });
    expect(H.wounds.current).toBe(hpBefore - 2);          // 2 Blessures subies (Empoisonné×2)
    expect(stacks(H, COND.empoisonne)).toBe(2);           // aucun pion retiré (Test différé à la cascade)
    expect(hasCondition(H, COND.extenue)).toBe(false);    // pas d'Exténué (le Test n'a pas eu lieu)
  });
});

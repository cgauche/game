import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from '../store';
import { openRoundEndCascade } from '../combatFlow';
import { createHero } from '../../engine/character';
import { makeRNG } from '../../engine/dice';
import { seedBattleRng } from '../battleRng';
import { endOfRound, pendingPlusExtensions } from '../../engine/conditions';
import { testScene } from '../../scenes/test-fixture';

/**
 * Durée « + » de fin de Round (LDB 47 l.311, #543), voie HÉROS manuel : offre opt-in (« vous pouvez »)
 * → étape de CHOIX `spellPlusChoice` (Oui/Renoncer) ; Oui pousse le Test de Force Mentale
 * (`spellPlusTest`) dans la MÊME cascade. Jumeau structurel de `round-upkeep-cascade.test.ts`.
 */
describe('Durée « + » — offre de prolongation en cascade héros (#543)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    useGame.setState({ pendingCascade: null, battle: null });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  function setup() {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', rng: makeRNG(1) });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    b.combatants.filter((c) => c.kind === 'enemy').forEach((e) => (e.dead = true)); // aucun ennemi actif
    // Effet actif d'un sort marqué « + » (arme-aethyrique, LDB 47 l.319), sur le point d'expirer.
    H.activeEffects = [{ label: 'Arme aethyrique', bonus: 0, duration: { scale: 'rounds', left: 1 }, sourceSpellId: 'arme-aethyrique' }];
    endOfRound(H); // simule le décompte de fin de Round → effet GELÉ (awaitingExtension)
    expect(pendingPlusExtensions(H)).toHaveLength(1);
    useGame.setState({ battle: { ...b }, pendingCascade: null, pendingReveals: [] });
    return { H };
  }

  it('ouvre une étape de CHOIX (Oui/Renoncer) — jamais un jet automatique', () => {
    const { H } = setup();
    openRoundEndCascade(useGame.getState, useGame.setState);
    const c = useGame.getState().pendingCascade!;
    const step = c.participants.find((s) => s.kind === 'spellPlusChoice')!;
    expect(step).toBeTruthy();
    expect(step.actorId).toBe(H.id);
    expect(step.options?.map((o) => o.key)).toEqual(['yes', 'no']);
    expect(step.defaultChoice).toBe('no');
  });

  it('Renoncer → expiration NORMALE immédiate, aucun Test poussé', () => {
    setup();
    openRoundEndCascade(useGame.getState, useGame.setState);
    const step = useGame.getState().pendingCascade!.participants.find((s) => s.kind === 'spellPlusChoice')!;
    useGame.getState().cascadeChoose(step.id, 'no');
    useGame.getState().cascadeNext();
    const h = useGame.getState().battle!.combatants.find((x) => x.kind === 'hero')!;
    expect(h.activeEffects ?? []).toHaveLength(0);
    expect(useGame.getState().pendingCascade?.participants.some((s) => s.kind === 'spellPlusTest')).toBeFalsy();
  });

  it('Oui → pousse le Test de Force Mentale (spellPlusTest) DANS la même cascade', () => {
    setup();
    openRoundEndCascade(useGame.getState, useGame.setState);
    const choice = useGame.getState().pendingCascade!.participants.find((s) => s.kind === 'spellPlusChoice')!;
    useGame.getState().cascadeChoose(choice.id, 'yes');
    useGame.getState().cascadeNext();
    const test = useGame.getState().pendingCascade!.participants.find((s) => s.kind === 'spellPlusTest');
    expect(test).toBeTruthy();
    expect(test!.rollLabel).toBe('Force Mentale');
  });

  it('Test réussi → +1 Round (effet dégelé, toujours actif)', () => {
    seedBattleRng(5); // graine donnant un jet bas → réussite avec une FM haute
    const { H } = setup();
    H.characteristics['force-mentale'] = 95;
    useGame.setState({ battle: { ...useGame.getState().battle! } });
    openRoundEndCascade(useGame.getState, useGame.setState);
    const choice = useGame.getState().pendingCascade!.participants.find((s) => s.kind === 'spellPlusChoice')!;
    useGame.getState().cascadeChoose(choice.id, 'yes');
    useGame.getState().cascadeNext();
    const test = useGame.getState().pendingCascade!.participants.find((s) => s.kind === 'spellPlusTest')!;
    useGame.getState().cascadeRoll(test.id);
    useGame.getState().cascadeNext();
    const h = useGame.getState().battle!.combatants.find((x) => x.id === H.id)!;
    expect(h.activeEffects).toHaveLength(1);
    expect(h.activeEffects![0].awaitingExtension).toBeUndefined();
    expect(h.activeEffects![0].duration).toEqual({ scale: 'rounds', left: 1 });
  });

  it('Test raté → expiration NORMALE (retrait effectif)', () => {
    seedBattleRng(1); // graine donnant un jet élevé
    const { H } = setup();
    H.characteristics['force-mentale'] = 5; // FM très basse → Test raté quasi garanti
    useGame.setState({ battle: { ...useGame.getState().battle! } });
    openRoundEndCascade(useGame.getState, useGame.setState);
    const choice = useGame.getState().pendingCascade!.participants.find((s) => s.kind === 'spellPlusChoice')!;
    useGame.getState().cascadeChoose(choice.id, 'yes');
    useGame.getState().cascadeNext();
    const test = useGame.getState().pendingCascade!.participants.find((s) => s.kind === 'spellPlusTest')!;
    useGame.getState().cascadeRoll(test.id);
    useGame.getState().cascadeNext();
    const h = useGame.getState().battle!.combatants.find((x) => x.id === H.id)!;
    expect(h.activeEffects ?? []).toHaveLength(0);
  });
});

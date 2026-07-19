import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { testScene } from '../scenes/test-fixture';

// Entretien de Round groupé (initiative + hémorragie + mort) en UNE révélation témoin.
describe('Entretien de Round en révélation (store)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    useGame.setState({ pendingReveals: [], battle: null });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('le début de combat MONTRE le champ (plan d’ensemble) — pas de modale d’Initiative (R2)', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', rng: makeRNG(1) });
    useGame.setState({ party: [hero], pendingReveals: [] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    vi.clearAllTimers();
    const st = useGame.getState();
    expect(st.pendingRoundStart?.round).toBe(1); // ouverture = pause du Round 1 : champ visible, IA gelée
    expect(st.battle!.turn).toBe(-1); // PERSONNE n'est actif pendant la pause (confirmRoundStart posera le tour)
    expect(st.pendingReveals.find((r) => r.title === 'Initiative')).toBeUndefined(); // plus de modale d'Initiative
    expect(st.battle!.order.length).toBeGreaterThan(1); // l'ordre est posé (frise d'initiative (InitiativeStrip))
  });

  it('un franchissement de Round avec hémorragie pousse UNE révélation « Fin du Round » groupée', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', rng: makeRNG(1) });
    hero.conditions = [{ id: 'hemorragique', value: 2 }];
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    H.wounds = { current: 20, max: 20, base: 20 } as never; // survit à l'hémorragie
    const enemyIds = b.combatants.filter((c) => c.kind === 'enemy').map((c) => c.id);
    const order = [...enemyIds, H.id]; // H dernier → battleEndTurn franchit le Round
    // On vide la file (révélation d'Initiative) et on neutralise les ennemis pour éviter une suspension d'IA.
    b.combatants.filter((c) => c.kind === 'enemy').forEach((e) => (e.dead = true));
    useGame.setState({ battle: { ...b, order, turn: order.length - 1 }, pendingReveals: [] });

    useGame.getState().battleEndTurn(); // franchit le Round → entretien

    const round = useGame.getState().pendingReveals.find((r) => r.kind === 'round' && r.title.startsWith('Fin du Round'));
    expect(round).toBeTruthy();
    expect(round!.lines.some((l) => /Hémorragique|Blessure/i.test(l))).toBe(true);
  });
});

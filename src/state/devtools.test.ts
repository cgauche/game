import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { buildApi } from './devtools';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { testScene } from '../scenes/test-fixture';
import { isOutOfAction } from '../engine/conditions';

describe('__wfrp.killEnemies — commande de recette (élimine les ennemis, victoire normale)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    useGame.setState({ battle: null });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('hors combat : refus explicite', () => {
    expect(buildApi().killEnemies()).toContain('❌');
  });

  it('en combat : tous les ennemis hors de combat + victoire par le flux normal (pendingVictory)', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', name: 'H', rng: makeRNG(1) });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();

    const out = buildApi().killEnemies();

    expect(out).toContain('✅');
    const b = useGame.getState().battle!;
    expect(b.over).toBe('victory');
    expect(b.combatants.filter((c) => c.kind === 'enemy').every((c) => isOutOfAction(c))).toBe(true);
    expect(useGame.getState().pendingVictory).toBeTruthy();
  });
});

describe('__wfrp — autres commandes de recette', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', name: 'H', rng: makeRNG(1) });
    useGame.setState({ battle: null, party: [hero] });
    useGame.getState().startScene(testScene);
    vi.clearAllTimers();
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('healParty : PB max, états purgés, mort relevé', () => {
    const h = useGame.getState().party[0];
    useGame.setState({
      party: [{ ...h, wounds: { ...h.wounds, current: 0 }, conditions: [{ id: 'Hémorragique', stacks: 2 }] as never, criticalWounds: 3, dead: true }],
    });
    buildApi().healParty();
    const healed = useGame.getState().party[0];
    expect(healed.wounds.current).toBe(healed.wounds.max);
    expect(healed.conditions).toEqual([]);
    expect(healed.criticalWounds).toBe(0);
    expect(healed.dead).toBe(false);
  });

  it('give / xp : bourse créditée, PX ajoutés au groupe', () => {
    const before = useGame.getState().money.gold;
    buildApi().give(5);
    expect(useGame.getState().money.gold).toBe(before + 5);
    const xpBefore = useGame.getState().party[0].xp ?? 0;
    buildApi().xp(150);
    expect(useGame.getState().party[0].xp).toBe(xpBefore + 150);
  });

  it('flag/flags : force et relit un drapeau de scénario', () => {
    buildApi().flag('zone3_clear');
    expect(buildApi().flags().zone3_clear).toBe(true);
    buildApi().flag('zone3_clear', false);
    expect(buildApi().flags().zone3_clear).toBe(false);
  });

  it('fight : sans argument liste les rencontres de la scène, avec id lance le combat', () => {
    expect(buildApi().fight()).toContain('enc-mutants');
    expect(buildApi().fight('enc-inconnue')).toContain('❌');
    const out = buildApi().fight('enc-mutants');
    expect(out).toContain('✅');
    expect(useGame.getState().battle).toBeTruthy();
  });

  it('go : id de scène inconnu → message d’erreur, scène inchangée', () => {
    const before = useGame.getState().scene?.id;
    expect(buildApi().go('scene-qui-n-existe-pas')).toContain('❌');
    expect(useGame.getState().scene?.id).toBe(before);
  });

  it('time : avance l’horloge de jeu', () => {
    const before = useGame.getState().gameTime;
    buildApi().time(90);
    expect(useGame.getState().gameTime).toBe(before + 90);
  });
});

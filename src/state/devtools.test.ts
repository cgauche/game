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
    expect(buildApi().killEnemies()).toContain('✗');
  });

  it('en combat : tous les ennemis hors de combat + victoire par le flux normal (pendingVictory)', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', name: 'H', rng: makeRNG(1) });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();

    const out = buildApi().killEnemies();

    expect(out).toContain('✓');
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
      party: [{ ...h, wounds: { ...h.wounds, current: 0 }, conditions: [{ id: 'hemorragique', stacks: 2 }] as never, criticalWounds: 3, dead: true }],
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
    expect(buildApi().fight('enc-inconnue')).toContain('✗');
    const out = buildApi().fight('enc-mutants');
    expect(out).toContain('✓');
    expect(useGame.getState().battle).toBeTruthy();
  });

  it('go : id de scène inconnu → message d’erreur, scène inchangée', () => {
    const before = useGame.getState().scene?.id;
    expect(buildApi().go('scene-qui-n-existe-pas')).toContain('✗');
    expect(useGame.getState().scene?.id).toBe(before);
  });

  it('time : avance l’horloge de jeu', () => {
    const before = useGame.getState().gameTime;
    buildApi().time(90);
    expect(useGame.getState().gameTime).toBe(before + 90);
  });

  it('seed : re-ensemence le RNG de bataille (même action que store.seedRng)', () => {
    const spy = vi.spyOn(useGame.getState(), 'seedRng');
    expect(buildApi().seed(42)).toContain('42');
    expect(spy).toHaveBeenCalledWith(42);
  });
});

describe('__wfrp.fastForward — avance-rapide des tours IA (garde anti-boucle, machinerie existante)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', name: 'H', rng: makeRNG(1) });
    useGame.setState({ battle: null, party: [hero] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    vi.clearAllTimers();
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('s’arrête au tour d’un combattant piloté humain (les mutants, loin du héros, se contentent de bouger)', async () => {
    const b = useGame.getState().battle!;
    const heroId = b.combatants.find((c) => c.kind === 'hero')!.id;
    const enemyIds = b.combatants.filter((c) => c.kind === 'enemy').map((c) => c.id);
    // Ordre forcé : les 3 Mutants d'abord — ils sont loin du héros (fixture) → pas de jet d'attaque (juste
    // du mouvement), donc pas d'issue RNG-dépendante (pas de risque de cascade de fin de combat).
    useGame.setState({ battle: { ...b, order: [...enemyIds, heroId], baseOrder: [...enemyIds, heroId], turn: -1 } });
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();

    const p = buildApi().fastForward(100);
    await vi.runAllTimersAsync();
    const msg = await p;

    expect(msg).toContain('✓');
    expect(msg).not.toContain('✗');
    const after = useGame.getState().battle;
    if (after && !after.over) {
      const active = after.combatants.find((c) => c.id === after.order[after.turn]);
      expect(active?.kind).toBe('hero'); // rendu au tour du héros (piloté humain)
    }
  });

  it('borne à maxIters (garde-fou anti-boucle infinie) si rien ne progresse jamais vers un tour humain', async () => {
    const b = useGame.getState().battle!;
    const enemyId = b.combatants.find((c) => c.kind === 'enemy')!.id;
    // Tour figé sur un Ennemi SANS jamais lancer confirmRoundStart/maybeRunEnemyTurn nous-mêmes au préalable
    // — mais fastForward RELANCE la machinerie à chaque scrutation (maybeRunEnemyTurn) : avec maxIters=0,
    // la borne mord dès la 1ʳᵉ scrutation, AVANT toute action IA — vérifie que la borne est bien respectée.
    useGame.setState({ battle: { ...b, order: [enemyId], baseOrder: [enemyId], turn: 0 } });

    const msg = await buildApi().fastForward(0);

    expect(msg).toContain('✗');
    expect(msg).toContain('borne atteinte');
  });
});

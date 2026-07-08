import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { buildApi } from './devtools';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { testScene } from '../scenes/test-fixture';
import { isOutOfAction } from '../engine/conditions';
import { itemFromTrappingById } from '../engine/items';
import type { BattleState } from './store';
import type { Combatant, ShipPoste } from '../engine/types';

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

describe('__wfrp.place — piège composite (coque à postes / membre de crew)', () => {
  const CHARS = { CC: 30, CT: 30, F: 40, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 };
  const mkPoste = (crewIds: string[]): ShipPoste => ({ item: itemFromTrappingById('belier-ade2')!, crewIds });
  const mkHull = (poste: ShipPoste, pos = { x: 5, y: 5 }): Combatant =>
    ({ id: 'hull', name: 'Bélier (poste)', kind: 'enemy', pos, conditions: [], weapons: [],
      inert: true, wounds: { current: 0, max: 0 }, advantage: 0, postes: [poste] }) as unknown as Combatant;
  const mkServant = (id: string, pos: { x: number; y: number }): Combatant =>
    ({ id, name: id, kind: 'npc', characteristics: CHARS, wounds: { current: 8, max: 8 }, advantage: 0,
      conditions: [], skills: [], talents: [], weapons: [],
      armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, movement: 4, pos }) as unknown as Combatant;

  beforeEach(() => useGame.setState({ battle: null, party: [] }));

  function setup() {
    const poste = mkPoste(['chef', 's1', 's2']);
    const hull = mkHull(poste);
    const chef = mkServant('chef', { x: 5, y: 6 });
    const s1 = mkServant('s1', { x: 6, y: 6 });
    const s2 = mkServant('s2', { x: 4, y: 6 });
    const combatants = [chef, hull, s1, s2];
    const battle: BattleState = {
      combatants, order: [chef.id], turn: 0, round: 1, action: null, selectedSpellId: null,
      reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
    };
    useGame.setState({ battle });
    return { chef, hull, s1, s2 };
  }

  it('place() de la COQUE déplace coque + tout le crew du MÊME delta', () => {
    const { hull, chef, s1, s2 } = setup();
    const from = { hull: { ...hull.pos! }, chef: { ...chef.pos! }, s1: { ...s1.pos! }, s2: { ...s2.pos! } };
    const out = buildApi().place('hull', { x: 8, y: 9 }) as { msg: string; moved: string[] };
    const delta = { x: 8 - from.hull.x, y: 9 - from.hull.y };
    expect(out.moved.sort()).toEqual(['chef', 'hull', 's1', 's2'].sort());
    const find = (id: string) => useGame.getState().battle!.combatants.find((c) => c.id === id)!;
    expect(find(hull.id).pos).toEqual({ x: 8, y: 9 });
    expect(find(chef.id).pos).toEqual({ x: from.chef.x + delta.x, y: from.chef.y + delta.y });
    expect(find(s1.id).pos).toEqual({ x: from.s1.x + delta.x, y: from.s1.y + delta.y });
    expect(find(s2.id).pos).toEqual({ x: from.s2.x + delta.x, y: from.s2.y + delta.y });
  });

  it('place() d’un MEMBRE DE CREW déplace aussi toute la formation (coque + crew) du même delta', () => {
    const { hull, chef, s1, s2 } = setup();
    const from = { hull: { ...hull.pos! }, chef: { ...chef.pos! }, s1: { ...s1.pos! }, s2: { ...s2.pos! } };
    const out = buildApi().place('s1', { x: 10, y: 10 }) as { msg: string; moved: string[] };
    const delta = { x: 10 - from.s1.x, y: 10 - from.s1.y };
    expect(out.moved.sort()).toEqual(['chef', 'hull', 's1', 's2'].sort());
    const find = (id: string) => useGame.getState().battle!.combatants.find((c) => c.id === id)!;
    expect(find(s1.id).pos).toEqual({ x: 10, y: 10 });
    expect(find(hull.id).pos).toEqual({ x: from.hull.x + delta.x, y: from.hull.y + delta.y });
    expect(find(chef.id).pos).toEqual({ x: from.chef.x + delta.x, y: from.chef.y + delta.y });
    expect(find(s2.id).pos).toEqual({ x: from.s2.x + delta.x, y: from.s2.y + delta.y });
  });

  it('place() d’un combattant SIMPLE (ni coque ni crew) reste une téléportation directe inchangée', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', name: 'H', rng: makeRNG(1) });
    hero.pos = { x: 1, y: 1 };
    const battle: BattleState = {
      combatants: [hero], order: [hero.id], turn: 0, round: 1, action: null, selectedSpellId: null,
      reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
    };
    useGame.setState({ battle });
    const out = buildApi().place(hero.id, { x: 3, y: 4 });
    expect(out).toBe(`✓ ${hero.name} → (3,4)`);
    expect(useGame.getState().battle!.combatants[0].pos).toEqual({ x: 3, y: 4 });
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

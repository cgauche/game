import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { buildApi } from './devtools';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { testScene } from '../scenes/test-fixture';
import { isOutOfAction } from '../engine/conditions';
import { itemFromTrappingById } from '../engine/items';
import { makePregens } from '../data/pregens';
import { seedBattleRng } from './battleRng';
import type { BattleState } from './store';
import type { Combatant, ShipPoste } from '../engine/types';
import type { WorldMap } from './worldMap';

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

describe('__wfrp.screen — garde d’id (#211)', () => {
  it('id invalide → throw (liste des ids valides), aucun routage silencieux vers un écran blanc', () => {
    expect(() => buildApi().screen('game')).toThrow(/game/);
    expect(() => buildApi().screen('game')).toThrow(/menu/); // la liste des ids valides est portée par le message
  });

  it('id valide → navigue normalement', () => {
    expect(buildApi().screen('menu')).toBe('menu');
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
  const CHARS = { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 40, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };
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

describe('__wfrp.advanceSeaDay / skipToArrival / dealShipDamage / clickRoute — outillage recette navale (#297)', () => {
  const seaMap: WorldMap = {
    id: 'm', nom: 'Mer des Griffes',
    places: [
      { id: 'A', label: 'Salzenmund', pos: { x: 0, y: 0 }, scene: 'port-a' },
      { id: 'B', label: 'Erengrad', pos: { x: 10, y: 0 }, scene: 'port-b', port: { taille: 3, richesse: 3, production: ['bois'] } },
    ],
    routes: [{ id: 'r1', a: 'A', b: 'B', km: 100, modes: ['mer'], sea: true, seaHeading: 'est' }],
  };
  const freshState = () => {
    seedBattleRng(1); // déterminisme (suite isolate:false)
    useGame.setState({
      party: makePregens().slice(0, 3),
      scene: { id: 'port-a', nom: 'Port', dimensions: { w: 2, h: 2 }, layers: [{ z: 0, tiles: ['sol', 'sol', 'sol', 'sol'] }], entities: [], dialogues: [], triggers: [] } as never,
      battle: null,
      worldMap: seaMap,
      travelPlan: null,
      travelRecap: null,
      pendingCrewTest: null,
      pendingRest: null,
      pendingCascade: null,
      pendingSeaActivities: null,
      suspendedCascades: [],
      gameTime: 8 * 60,
      lastUpkeepDay: 0,
      vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] } },
      journal: [],
    } as never);
  };
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    freshState();
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('advanceSeaDay() fait avancer d’UN jour (cascade + halte de nuit résolues), s’arrête sur la cascade FRAÎCHE du jour suivant', async () => {
    useGame.getState().startTravel('r1', 'mer');
    const p = buildApi().advanceSeaDay();
    await vi.runAllTimersAsync();
    const msg = await p;

    expect(msg).toContain('✓');
    expect(msg).not.toContain('✗');
    expect(useGame.getState().pendingRest).toBeNull(); // halte de nuit RÉSOLUE (pas juste ouverte)
    expect(useGame.getState().travelPlan?.sea?.daysAtSea).toBeGreaterThanOrEqual(1);
    // Le jour 2 est déjà amorcé (`runSeaDay` enchaîne) mais INTACT — pas une étape déjà consommée.
    const pc = useGame.getState().pendingCascade;
    expect(pc?.purpose).toBe('travelDay');
    expect(pc?.cursor).toBe(0);
  });

  it('advanceSeaDay() hors voyage : refus explicite', async () => {
    const msg = await buildApi().advanceSeaDay();
    expect(msg).toContain('✗');
  });

  it('skipToArrival() roule jusqu’à l’accostage (travelPlan vidé, route courte de 100 milles)', async () => {
    useGame.getState().startTravel('r1', 'mer');
    const p = buildApi().skipToArrival();
    await vi.runAllTimersAsync();
    const msg = await p;

    expect(msg).toContain('✓');
    expect(useGame.getState().travelPlan).toBeNull();
  });

  it('dealShipDamage() inflige des Dégâts HORS COMBAT via la SOURCE UNIQUE vessel.wounds (#296)', () => {
    useGame.getState().startTravel('r1', 'mer');
    // `vessel.wounds` n'est PAS encore persisté à l'appareillage (piège #296) — la coque de trajet
    // (`travelPlan.vehicle`) est la valeur RÉELLE tant qu'aucun Dégât/jour ne l'a écrite en retour.
    const before = useGame.getState().travelPlan!.vehicle!.wounds.current;

    const msg = buildApi().dealShipDamage(7);

    expect(msg).toContain('✓');
    expect(useGame.getState().vessel!.wounds!.current).toBe(before - 7);
    expect(useGame.getState().travelPlan!.vehicle!.wounds.current).toBe(before - 7); // deux copies en phase
  });

  it('dealShipDamage() au port (pas de voyage en cours) écrit directement vessel.wounds', () => {
    useGame.setState({ vessel: { ...useGame.getState().vessel!, wounds: { current: 20, max: 30 } } });

    const msg = buildApi().dealShipDamage(5);

    expect(msg).toContain('✓');
    expect(useGame.getState().vessel!.wounds!.current).toBe(15);
  });

  // `clickRoute` accède au DOM (`document.querySelectorAll`) au-delà de la validation route/carte —
  // comme `screenPos`/`hover`, non couvert en environnement 'node' (vitest) : recette navigateur seule.
  it('clickRoute() : route invalide → refus explicite (validation AVANT tout accès DOM)', () => {
    expect(buildApi().clickRoute('r-inconnue')).toContain('✗');
  });
});

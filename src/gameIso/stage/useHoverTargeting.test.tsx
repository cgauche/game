// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHero } from '../../engine/character';
import { makeRNG } from '../../engine/dice';
import { testScene } from '../../scenes/test-fixture';
import { useGame } from '../../state/store';
import { startCascade } from '../../state/cascade';
import { useHoverTargeting } from './useHoverTargeting';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;

function setup() {
  const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', rng: makeRNG(1) });
  useGame.setState({ party: [hero] });
  useGame.getState().startScene(testScene);
  useGame.getState().startCombat('enc-mutants');
  useGame.getState().confirmRoundStart();
  const battle = useGame.getState().battle!;
  const active = battle.combatants.find((combatant) => combatant.kind === 'hero')!;
  active.pos = { x: 6, y: 10 };
  active.engagedWith = [];
  let enemyX = 20;
  for (const enemy of battle.combatants.filter((combatant) => combatant.kind === 'enemy')) {
    enemy.pos = { x: enemyX++, y: 20 };
  }
  useGame.setState({
    mode: 'battle',
    battle: { ...battle, turn: battle.order.indexOf(active.id), action: null, preview: null },
    pendingAttack: null,
    pendingDefense: null,
    pendingTrample: null,
    pendingHeal: null,
    pendingCast: null,
    pendingCleave: null,
    pendingDualStrike: null,
    pendingCascade: null,
    suspendedCascades: [],
    hoverDelta: null,
    combatCursor: null,
    hoverCombatantId: null,
  });
  return active;
}

describe('useHoverTargeting — intention de déplacement', () => {
  beforeEach(() => useGame.setState({ battle: null, hoverDelta: null }));
  afterEach(() => {
    if (root) act(() => root!.unmount());
    root = null;
  });

  it('publie la résolution canonique et son delta de ressources au survol', () => {
    const active = setup();
    const hover = { x: active.pos!.x + 2, y: active.pos!.y };
    let result: ReturnType<typeof useHoverTargeting> | undefined;
    const Probe = () => {
      result = useHoverTargeting(testScene, hover, true);
      return null;
    };
    root = createRoot(document.createElement('div'));
    act(() => root!.render(<Probe />));

    expect(result?.hoverMove).toMatchObject({ kind: 'move', cost: 2 });
    expect(useGame.getState().hoverDelta).toMatchObject({
      action: 0,
      move: 2,
      adv: 0,
      movement: { status: 'ok', kind: 'move', cost: 2 },
    });
  });

  it('publie le refus du résolveur sans tracer de chemin', () => {
    const active = setup();
    active.engagedWith = ['enemy'];
    const hover = { x: active.pos!.x - 1, y: active.pos!.y };
    let result: ReturnType<typeof useHoverTargeting> | undefined;
    const Probe = () => {
      result = useHoverTargeting(testScene, hover, true);
      return null;
    };
    root = createRoot(document.createElement('div'));
    act(() => root!.render(<Probe />));

    expect(result?.hoverMove).toBeNull();
    expect(useGame.getState().hoverDelta).toEqual({
      action: 0,
      move: 0,
      adv: 0,
      movement: { status: 'blocked', reason: 'engaged' },
    });
  });
});

describe('useHoverTargeting — modale bloquante (arbitre modal)', () => {
  beforeEach(() => useGame.setState({ battle: null, hoverDelta: null }));
  afterEach(() => {
    if (root) act(() => root!.unmount());
    root = null;
  });

  /** Monte la sonde sur UNE case survolée et rend le verdict du hook (démonte aussitôt). */
  function probe(hover: { x: number; y: number }) {
    let result: ReturnType<typeof useHoverTargeting> | undefined;
    const Probe = () => {
      result = useHoverTargeting(testScene, hover, true);
      return null;
    };
    root = createRoot(document.createElement('div'));
    act(() => root!.render(<Probe />));
    act(() => root!.unmount());
    root = null;
    return result!;
  }

  /** Un ennemi collé au héros actif : cible valide au corps à corps (réticule au survol). */
  function foeNextTo(active: ReturnType<typeof setup>) {
    const battle = useGame.getState().battle!;
    const foe = battle.combatants.find((c) => c.kind === 'enemy')!;
    foe.pos = { x: active.pos!.x + 1, y: active.pos!.y };
    return foe;
  }

  it('cascade ouverte : ni réticule, ni piste, ni intention de déplacement', () => {
    const active = setup();
    const foe = foeNextTo(active);
    const empty = { x: active.pos!.x, y: active.pos!.y + 2 };

    // Référence : hors modale, la carte répond (réticule sur l'ennemi, piste sur la case vide).
    expect(probe({ x: foe.pos!.x, y: foe.pos!.y }).hoverAim?.reticle).toBe(true);
    expect(probe(empty).hoverMove).toMatchObject({ kind: 'move' });
    expect(useGame.getState().hoverDelta?.movement).toMatchObject({ status: 'ok' });

    act(() => startCascade(useGame.getState, useGame.setState, {
      title: 'Surprise', purpose: 'test',
      steps: [{ id: 'surprise-1', kind: 'sceneEntry', actorId: active.id, reveal: { kind: 'sceneEntry', title: 'Surprise', lines: ['…'] } }],
    }));

    expect(probe({ x: foe.pos!.x, y: foe.pos!.y }).hoverAim).toBeNull();
    const under = probe(empty);
    expect(under.hoverMove).toBeNull();
    expect(useGame.getState().hoverDelta).toBeNull(); // movementIntent (ActionBar) = hoverDelta.movement
  });

  it('ciblage de sort PAR LA CARTE (pickingTargets) : le réticule reste actif sous la cascade', () => {
    const active = setup();
    const foe = foeNextTo(active);
    act(() => startCascade(useGame.getState, useGame.setState, {
      title: 'Incantation', purpose: 'combat',
      steps: [{ id: 'cast-jet', kind: 'castJet', jet: 'cast', actorId: active.id }],
    }));
    // Surincantation « +Cible » : le lanceur désigne une cible SUPPLÉMENTAIRE sur la carte (mode overcast).
    useGame.setState({ pendingCast: { casterId: active.id, targetId: active.id, spellId: 'benediction-de-bataille', missile: true, focused: false, result: null, pickingTargets: true } as never });

    expect(probe({ x: foe.pos!.x, y: foe.pos!.y }).hoverAim?.reticle).toBe(true);
  });

  /**
   * Le « ciblage carte en cours » se lit au REGISTRE (`mapTargetingActive`, `state/targetingHolder.ts`),
   * plus dans une liste littérale recopiée par consommateur : `pendingSiegeAim` (pilonnage indirect,
   * placeur de case) y est déclaré, mais manquait aux deux listes locales — sur une case HORS PORTÉE
   * du placeur (aucun aperçu de mode-case), la carte reproposait une piste de déplacement pendant
   * qu'on visait.
   */
  it('placeur de case ARMÉ (pilonnage) : plus d’intention de déplacement, même hors portée du placeur', () => {
    const active = setup();
    const loin = { x: active.pos!.x, y: active.pos!.y + 3 }; // > rangeTiles : le mode-case n'a AUCUN aperçu ici

    // Référence : sans placeur armé, cette case porte une piste de déplacement.
    expect(probe(loin).hoverMove).toMatchObject({ kind: 'move' });

    useGame.setState({ pendingSiegeAim: { gunnerId: active.id, weaponUid: 'w-1', radius: 1, rangeTiles: 2 } as never });
    expect(probe(loin).hoverMove, 'une piste de déplacement se trace pendant qu’on vise une case').toBeNull();
    useGame.setState({ pendingSiegeAim: null });
  });
});

/**
 * GRISAGE HORS-LdV DU MODE INCANTATION (LDB 46 l.121) — il se déclenche sur le mode que l'entrée
 * « Incanter » du REGISTRE déclare armer (`armed`, `actions.json`), et il est indépendant de l'arme
 * portée comme de l'Action déjà dépensée (contrairement au grisage de TIR, qui s'éteint dès que
 * l'Action est consommée ou qu'un autre mode est armé).
 */
describe('useHoverTargeting — grisage hors-LdV du SORT', () => {
  beforeEach(() => useGame.setState({ battle: null, hoverDelta: null }));
  afterEach(() => {
    if (root) act(() => root!.unmount());
    root = null;
  });

  /** Arène 20×8, MUR vertical en x=10 percé d'une brèche en y=0 (même gabarit que `cast-los.test.ts`). */
  function murScene() {
    const w = 20, h = 8;
    const tiles: string[] = new Array(w * h).fill('herbe');
    for (let y = 1; y < h; y++) tiles[y * w + 10] = 'mur';
    return { id: 's', dimensions: { w, h }, layers: [{ z: 0, tiles }], entities: [], dialogues: [], triggers: [], encounters: [] } as never;
  }

  function probeGhosts() {
    let result: ReturnType<typeof useHoverTargeting> | undefined;
    const Probe = () => {
      result = useHoverTargeting(murScene(), null, true);
      return null;
    };
    root = createRoot(document.createElement('div'));
    act(() => root!.render(<Probe />));
    act(() => root!.unmount());
    root = null;
    return result!.ghostIds;
  }

  it('mode Incanter armé : l’ennemi derrière le mur est grisé, celui de la brèche non — Action dépensée comprise', () => {
    const active = setup();
    const battle = useGame.getState().battle!;
    const foes = battle.combatants.filter((c) => c.kind === 'enemy');
    expect(foes.length, 'la rencontre doit fournir deux ennemis à placer').toBeGreaterThanOrEqual(2);
    const [vu, cache] = foes;
    active.pos = { x: 2, y: 0 };
    vu.pos = { x: 16, y: 0 }; // brèche : ligne dégagée
    cache.pos = { x: 16, y: 4 }; // derrière le mur
    for (const autre of foes.slice(2)) autre.pos = { x: 0, y: 7 };
    useGame.setState({ scene: murScene(), battle: { ...battle, action: 'cast', selectedSpellId: 'carreau', acted: true } });

    const ghosts = probeGhosts();
    expect(ghosts.has(cache.id), 'sans Ligne de Vue, l’ennemi est fantomatique').toBe(true);
    expect(ghosts.has(vu.id), 'la ligne dégagée ne grise personne').toBe(false);
  });
});

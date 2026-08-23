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
import { armedIntentPortee, PORTEE_COURSE } from '../../state/localIntent';
import { effectiveMovement } from '../../engine/encumbrance';
import { t } from '../../i18n';

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
    expect(useGame.getState().hoverDelta).toBeNull(); // l'aperçu de mouvement se lit à hoverDelta.movement
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
 * COURSE À ARMER (spec HUD § ARBITRAGE 2026-08-19, école BG3) — le survol DIT LA VÉRITÉ DU CLIC :
 * au-delà de la Marche, le clic-sol est refusé tant que la case Course n'est pas armée, donc le badge
 * porte ce refus (mot du registre) au lieu de promettre « Courir ». La Frénésie, elle, IMPOSE la course
 * (`LDB 21 l.33`) : ce que la règle impose ne s'arme pas, et n'est donc jamais refusé.
 */
describe('useHoverTargeting — au-delà de la Marche, le survol porte le refus du clic', () => {
  beforeEach(() => useGame.setState({ battle: null, hoverDelta: null, localIntent: null }));
  afterEach(() => {
    if (root) act(() => root!.unmount());
    root = null;
    useGame.setState({ localIntent: null });
  });

  function probeRun(hover: { x: number; y: number }) {
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

  /** Une case DANS la zone de Course mais HORS de la Marche : le Mouvement du héros, +2 cases. */
  const caseDeCourse = (active: ReturnType<typeof setup>) => ({ x: active.pos!.x + effectiveMovement(active) + 2, y: active.pos!.y });

  it('Course NON armée : le badge dit le refus du registre, sans chemin promis', () => {
    const active = setup();
    const refus = probeRun(caseDeCourse(active)).hoverMove;
    expect(refus).toMatchObject({ kind: 'refus', label: t('cs.refusCourseNonArmee') });
    expect(refus!.path, 'aucun chemin : le clic ne le parcourra pas').toHaveLength(0);
  });

  it('Course ARMÉE : le badge redevient l’aperçu « Courir »', () => {
    const active = setup();
    useGame.setState({ localIntent: { actionId: 'course' } });
    expect(armedIntentPortee(useGame.getState), 'l’action « course » doit armer la portée de Course').toBe(PORTEE_COURSE);
    expect(probeRun(caseDeCourse(active)).hoverMove).toMatchObject({ kind: 'run' });
  });

  it('FRÉNÉSIE : la course imposée par la règle n’a rien à armer — aucun refus', () => {
    const active = setup();
    active.psychState = [...(active.psychState ?? []), { type: 'frenesie' } as never];
    expect(probeRun(caseDeCourse(active)).hoverMove).toMatchObject({ kind: 'run' });
  });
});

/**
 * INTERLUDE PILOTÉ PAR LA CARTE (recette 2026-08-23, #1411 P2-D) — une étape de cascade qui efface sa
 * modale et rend la main au champ (2ᵉ frappe des Deux armes, Frappe Mortelle, cibles de
 * Surincantation, pose de zone, bordée) laisse le SURVOL vivant : le réticule y dit ce que le clic
 * commettra, Difficulté comprise. Le verdict vient du REGISTRE (`currentInterludeAction` →
 * `modalArbiter.mapDriven`), pas d'une liste de `pending*`.
 */
describe('useHoverTargeting — pendant un interlude piloté par la carte, le survol reste vivant', () => {
  beforeEach(() => useGame.setState({ battle: null, hoverDelta: null, pendingDualStrike: null }));
  afterEach(() => {
    if (root) act(() => root!.unmount());
    root = null;
    useGame.setState({ pendingDualStrike: null, pendingCascade: null });
  });

  function probeAim(hover: { x: number; y: number }) {
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

  it('2ᵉ frappe (Deux armes) : le survol de la cible porte le réticule ET sa Difficulté', () => {
    const active = setup();
    const battle = useGame.getState().battle!;
    const foe = battle.combatants.find((c) => c.kind === 'enemy')!;
    foe.pos = { x: active.pos!.x + 1, y: active.pos!.y };
    const off = { label: 'Dague', name: 'Dague', type: 'melee', uid: 'off-1', hand: 'off', damage: { plusBF: true, flat: 2 }, qualities: [] };
    active.weapons = [...active.weapons, off as never];
    // L'interlude tel que le flux le pose : la cascade de combat tient la fenêtre, la 2ᵉ frappe attend
    // une cible SUR LA CARTE (`pendingDualStrike`) — la modale s'est effacée.
    useGame.setState({
      pendingDualStrike: { attackerId: active.id, offWeaponUid: 'off-1', mainRoll: 30 },
      pendingCascade: { id: 'combat', cursor: 0, participants: [{ actorId: active.id }] } as never,
    });

    const aim = probeAim({ x: foe.pos!.x, y: foe.pos!.y }).hoverAim;
    expect(aim?.reticle, 'la carte est rendue et cliquable : le survol ne peut pas être muet').toBe(true);
    expect(aim?.tip?.kind).toBe('info');
    expect(aim?.tip?.kind === 'info' && aim.tip.difficulty, 'le survol dit la Difficulté que la modale dira').toBeDefined();
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

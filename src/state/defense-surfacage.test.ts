import { describe, it, expect, afterEach } from 'vitest';
import { useGame, type BattleState, type PendingAttack } from './store';
import { maybeOpenDefense, resolveAttack, openAttackCascade, defenderFumbled } from './combatFlow';
import { defenseSurfaced, aiDriven, intentAllowedFor, ownsLocally, modalOwnerOf } from './netOwnership';
import { willAutoResolve } from './combatAuto';
import { opposedForcingSpent, OPPOSED_FORCING_REASON } from './rollFlowSpecs';
import { netSeatClosed } from './netFlow';
import { seedBattleRng } from './battleRng';
import { setCadence, resetCadence } from '../engine/cadence';
import type { AttackResult } from '../engine/combat';
import { testScene } from '../scenes/test-fixture';
import type { Combatant, Weapon } from '../engine/types';

/**
 * #989 — la Défense se SURFACE dès qu'un siège humain QUELCONQUE possède le défenseur : le pilote de
 * l'ATTAQUANT n'entre pas dans la condition, et un défenseur surfacé n'est jamais roulé en silence.
 * Les gardes RAW de mode restent (portée de mêlée, `rangedDefenseModes` — un tir sans mode de défense
 * RAW reste NON OPPOSÉ : « Test de Projectiles simple, non opposé », LDB 13 l.125).
 * Patron mk()/setup() de `ranged-defense-modal.test.ts`.
 */
const chars = { 'capacite-de-combat': 45, 'capacite-de-tir': 50, force: 35, endurance: 35, initiative: 30, agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };
const mk = (id: string, kind: 'hero' | 'enemy', pos: { x: number; y: number }, weapons: Weapon[]): Combatant =>
  ({ id, name: id, label: id, kind, characteristics: { ...chars }, conditions: [], engagedWith: [], skills: [], talents: [],
     weapons, advantage: 0, size: 'moyenne', pos, wounds: { current: 18, max: 18 },
     armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, movement: 4 } as unknown as Combatant);
const bow: Weapon = { name: 'Arc', label: 'Arc', type: 'ranged', damage: { plusBF: false, flat: 4 }, range: 60, qualities: [], uid: 'bw' } as unknown as Weapon;
const sword: Weapon = { name: 'Épée', label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, uid: 'sw', qualities: [] } as unknown as Weapon;

function setup(enemyPos: { x: number; y: number }, enemyWeapons: Weapon[], net?: Partial<ReturnType<typeof useGame.getState>['net']>) {
  seedBattleRng(7);
  const enemy = mk('e', 'enemy', enemyPos, enemyWeapons);
  const hero = mk('h', 'hero', { x: 0, y: 0 }, [sword]);
  const battle: BattleState = {
    combatants: [enemy, hero], order: [enemy.id, hero.id], baseOrder: [enemy.id, hero.id],
    turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
  } as unknown as BattleState;
  useGame.setState({
    battle, mode: 'battle', scene: testScene, pendingDefense: null, pendingAttack: null, pendingCascade: null,
    net: { ...useGame.getState().net, mode: 'local', mySeat: 0, gmSeat: undefined, ownership: {}, ...net },
  });
  return { enemy, hero };
}

describe('#989 — surfaçage de la défense : le pilote de l’ATTAQUANT ne décide de rien', () => {
  it('A — siège MJ posé (attaquant CONDUIT par un humain), mêlée sur un héros : la fenêtre s’OUVRE (plus de jet volé)', () => {
    const { enemy, hero } = setup({ x: 1, y: 0 }, [sword], { gmSeat: 0 });
    expect(aiDriven(useGame.getState(), enemy), 'l’ennemi n’est PAS piloté par l’IA').toBe(false);
    expect(maybeOpenDefense(useGame.getState, useGame.setState, enemy, hero)).toBe(true);
    const pd = useGame.getState().pendingDefense!;
    expect(pd.defenderId).toBe(hero.id);
    expect(useGame.getState().pendingCascade?.participants.some((s) => s.jet === 'defense' && s.actorId === hero.id)).toBe(true);
  });

  it('B — siège MJ posé, tir à Bout Portant sur un héros : la fenêtre s’OUVRE (plus de tir non opposé)', () => {
    const { enemy, hero } = setup({ x: 1, y: 0 }, [bow], { gmSeat: 0 });
    expect(maybeOpenDefense(useGame.getState, useGame.setState, enemy, hero)).toBe(true);
    expect(useGame.getState().pendingDefense!.modes).toContain('esquive');
  });

  it('B bis — tir hors Bout Portant sur un héros nu : AUCUNE fenêtre (le RAW ne donne aucun mode, LDB 13 l.125)', () => {
    const { enemy, hero } = setup({ x: 10, y: 0 }, [bow], { gmSeat: 0 });
    expect(maybeOpenDefense(useGame.getState, useGame.setState, enemy, hero)).toBe(false);
    expect(useGame.getState().pendingDefense).toBeNull();
  });

  it('C — SANS siège MJ, coop hôte : le héros d’un AUTRE siège surface aussi, et SON siège tient le jet', () => {
    const { enemy, hero } = setup({ x: 1, y: 0 }, [sword], { mode: 'host', mySeat: 0, ownership: { h: 1 } });
    expect(defenseSurfaced(useGame.getState(), hero), 'seat-agnostique : le siège local ne décide pas').toBe(true);
    expect(maybeOpenDefense(useGame.getState, useGame.setState, enemy, hero)).toBe(true);
    const s = useGame.getState();
    expect(s.pendingDefense!.defenderId).toBe(hero.id);
    expect(intentAllowedFor(s, 1, 'defenseRoll'), 'le siège 1 (propriétaire du héros) roule').toBe(true);
    expect(intentAllowedFor(s, 0, 'defenseRoll'), 'l’hôte ne roule pas le héros d’un autre').toBe(false);
  });

  it('E — héros `aiControlled` : PAS de fenêtre, mais le repli `bestRangedDefense` reste (aucune amputation)', () => {
    const { enemy, hero } = setup({ x: 1, y: 0 }, [bow]);
    hero.aiControlled = true;
    expect(defenseSurfaced(useGame.getState(), hero)).toBe(false);
    expect(maybeOpenDefense(useGame.getState, useGame.setState, enemy, hero)).toBe(false);
    seedBattleRng(7);
    const r = resolveAttack(useGame.getState, enemy, hero)!;
    expect(r.res.defenderDetail, 'le héros piloté-IA oppose sa défense RAW (Bout Portant)').toBeTruthy();
  });
});

describe('#989 — quadrant siège MJ : attaque PILOTÉE → la défense s’interpose sans avancer le tour', () => {
  it('gmSeat mêlée sur héros : attackRoll→attackConfirm interpose la fenêtre ; defenseConfirm ne fait PAS avancer le tour', () => {
    const { enemy, hero } = setup({ x: 1, y: 0 }, [sword], { gmSeat: 0 });
    const g = useGame.getState;
    openAttackCascade(g, useGame.setState, { attackerId: enemy.id, targetId: hero.id, location: null, result: null, weaponUid: 'sw' }, 'Attaque', 'action/attack');
    expect(g().pendingAttack, 'la cascade d’attaque est ouverte').toBeTruthy();
    g().attackRoll();
    expect(g().pendingAttack!.result!.defenderDetail, 'aucune défense roulée en silence au jet d’attaque').toBeUndefined();
    const turnBefore = g().battle!.turn;
    g().attackConfirm();
    const pd = g().pendingDefense;
    expect(pd, 'la fenêtre de défense s’interpose').toBeTruthy();
    expect(pd!.defenderId).toBe(hero.id);
    expect(g().pendingCascade!.participants[g().pendingCascade!.cursor].jet, 'le curseur est SUR l’étape défense').toBe('defense');
    expect(intentAllowedFor(g(), 0, 'defenseRoll'), 'le siège du héros roule sa défense').toBe(true);
    g().defenseRoll();
    g().defenseConfirm();
    expect(g().pendingDefense).toBeNull();
    expect(g().battle!.turn, 'le tour du MJ n’a PAS avancé').toBe(turnBefore);
  });

  it('héros → PNJ avec un siège MJ : la fenêtre s’ouvre POUR le siège MJ (changement assumé)', () => {
    const { enemy, hero } = setup({ x: 1, y: 0 }, [sword], { gmSeat: 0 });
    const g = useGame.getState;
    useGame.setState({ battle: { ...g().battle!, turn: 1 } }); // tour du héros
    openAttackCascade(g, useGame.setState, { attackerId: hero.id, targetId: enemy.id, location: null, result: null, weaponUid: 'sw' }, 'Attaque', 'action/attack');
    g().attackRoll();
    g().attackConfirm();
    const pd = g().pendingDefense;
    expect(pd, 'l’ennemi conduit par le MJ défend lui-même').toBeTruthy();
    expect(pd!.defenderId).toBe(enemy.id);
    expect(intentAllowedFor(g(), 0, 'defenseRoll'), 'le siège MJ tient le jet de défense de l’ennemi').toBe(true);
  });
});

describe('#989 LOT 0 — fermeture du siège MJ : `gmSeat` est PURGÉ', () => {
  it('siège MJ fermé → `net.gmSeat` null et l’ennemi repasse à l’IA (plus de modale orpheline)', () => {
    const { enemy } = setup({ x: 1, y: 0 }, [sword], { mode: 'host', mySeat: 0, gmSeat: 1, ownership: { h: 1 }, slots: [0, 1, 0, 0], seatNames: { 0: 'Hôte', 1: 'Invité' } });
    expect(aiDriven(useGame.getState(), enemy)).toBe(false);
    netSeatClosed(useGame.getState, useGame.setState, 1);
    const net = useGame.getState().net;
    expect(net.gmSeat ?? null, 'le rôle MJ ne survit pas à son siège').toBeNull();
    expect(net.ownership['h'], 'ses héros reviennent à l’hôte').toBe(0);
    expect(aiDriven(useGame.getState(), enemy), 'sans siège MJ, l’ennemi est à l’IA').toBe(true);
  });

  it('la fermeture d’un AUTRE siège ne touche pas le rôle MJ', () => {
    setup({ x: 1, y: 0 }, [sword], { mode: 'host', mySeat: 0, gmSeat: 1, slots: [0, 1, 2, 0], seatNames: { 1: 'MJ', 2: 'Autre' } });
    netSeatClosed(useGame.getState, useGame.setState, 2);
    expect(useGame.getState().net.gmSeat).toBe(1);
  });
});

// ── Parité du DR net / des Dégâts à travers la fenêtre (verdicts R1/R2 du juge) ──────────────────

/** Joue une attaque PILOTÉE de bout en bout (déclaration → jet → interposition → défense → application)
 *  et rend le résultat OPPOSÉ figé par la fenêtre (`pendingDefense.result`, avant l'Appliquer). */
function playWindow(seed: number, pa: Partial<PendingAttack>, opts?: { force?: boolean }): AttackResult {
  const { enemy, hero } = setup({ x: 1, y: 0 }, [sword], { gmSeat: 0 });
  const g = useGame.getState;
  if (opts?.force) enemy.resilience = 1; // la Résilience est une RESSOURCE : sans point, `forceSuccess` est un no-op
  seedBattleRng(seed);
  openAttackCascade(g, useGame.setState, { attackerId: enemy.id, targetId: hero.id, location: null, result: null, weaponUid: 'sw', ...pa }, 'Attaque', 'action/attack');
  g().attackRoll();
  if (opts?.force) g().attackForceSuccess();
  g().attackConfirm();
  g().defenseRoll();
  return g().pendingDefense!.result!;
}

describe('#989 R1 — le contexte d’opposition TRAVERSE la fenêtre (pas de Dégâts à deux vitesses)', () => {
  it('A — « Retenir ses coups » (AA 07 l.59-61) survit à l’interposition : le Critique est supprimé', () => {
    // Graine DÉTERMINISTE : une attaque qui touche en Critique à travers la fenêtre, SANS withhold.
    let seed = 0;
    for (let sd = 1; sd <= 400 && !seed; sd++) { const r = playWindow(sd, {}); if (r.hit && r.critical) seed = sd; }
    expect(seed, 'une graine de Critique à travers la fenêtre existe').toBeGreaterThan(0);
    const plain = playWindow(seed, {});
    const held = playWindow(seed, { withhold: true }); // même graine → mêmes dés, seul `withhold` change
    expect(plain.critical, 'sans withhold : Critique').toBe(true);
    expect(held.attackerRoll, 'mêmes dés des deux côtés').toBe(plain.attackerRoll);
    expect(held.critical, 'withhold TRANSPORTÉ : « maîtriser sans tuer » supprime le Critique').toBe(false);
  });
});

describe('#989 R2 — Résilience « Je ne faillirai pas ! » (LDB 17 l.68) honorée par la fenêtre', () => {
  it('B — 10 graines : l’attaque FORCÉE l’emporte TOUJOURS sur la défense jouée après coup', () => {
    const perdues: number[] = [];
    for (let sd = 1; sd <= 10; sd++) {
      const r = playWindow(sd, {}, { force: true });
      if (!r.hit) perdues.push(sd);
    }
    expect(perdues, 'aucune graine ne doit perdre le Test opposé après un point de Résilience').toEqual([]);
  });
});

describe('#989 R3 — cadence Rapide : l’auto-résolution suit le SIÈGE propriétaire (jamais « l’hôte par défaut »)', () => {
  afterEach(() => resetCadence());

  it('C — fenêtre possédée par le siège MJ : l’hôte ne l’auto-résout PAS ; le siège MJ, si', () => {
    const { enemy, hero } = setup({ x: 1, y: 0 }, [sword], { mode: 'host', mySeat: 0, gmSeat: 1, ownership: { h: 1 } });
    expect(maybeOpenDefense(useGame.getState, useGame.setState, enemy, hero)).toBe(true);
    setCadence('rapide');
    expect(willAutoResolve(useGame.getState()), 'l’hôte ne roule pas la défense d’un héros du siège 1').toBe(false);
    useGame.setState({ net: { ...useGame.getState().net, mySeat: 1 } });
    expect(willAutoResolve(useGame.getState()), 'le siège propriétaire, lui, auto-résout').toBe(true);
  });

  it('C bis — étape MONDE/ennemi conduit par le MJ : l’hôte ne vole pas le jet (même routage `seatOwns`)', () => {
    const { enemy, hero } = setup({ x: 1, y: 0 }, [sword], { mode: 'host', mySeat: 0, gmSeat: 1 });
    hero.aiControlled = true; // seul l'ENNEMI est surfacé → la fenêtre appartient au siège MJ
    expect(maybeOpenDefense(useGame.getState, useGame.setState, hero, enemy)).toBe(true);
    setCadence('rapide');
    expect(willAutoResolve(useGame.getState())).toBe(false);
  });

  it('SOLO (net par défaut) : comportement inchangé — tout est auto-résolu localement', () => {
    const { enemy, hero } = setup({ x: 1, y: 0 }, [sword]);
    expect(maybeOpenDefense(useGame.getState, useGame.setState, enemy, hero)).toBe(true);
    setCadence('rapide');
    expect(willAutoResolve(useGame.getState())).toBe(true);
  });
});

describe('#989 R4 — Maladresse du défenseur : UN helper, MÊME ordre (après application) des deux côtés', () => {
  /** Joue une attaque pilotée jusqu'au bout ; `wounds` = Blessures du héros AVANT le coup. */
  function playToFumble(seed: number, wounds: number) {
    const { enemy, hero } = setup({ x: 1, y: 0 }, [sword], { gmSeat: 0 });
    hero.wounds.current = wounds;
    const g = useGame.getState;
    seedBattleRng(seed);
    openAttackCascade(g, useGame.setState, { attackerId: enemy.id, targetId: hero.id, location: null, result: null, weaponUid: 'sw' }, 'Attaque', 'action/attack');
    g().attackRoll(); g().attackConfirm(); g().defenseRoll();
    const res = g().pendingDefense!.result!;
    return { hero, res, confirm: () => g().defenseConfirm(), state: g };
  }

  // Graine DÉTERMINISTE : défense RATÉE sur un double (Maladresse, LDB 14 l.48-51) ET touche qui blesse.
  let seed = 0;
  for (let sd = 1; sd <= 800 && !seed; sd++) {
    const { hero, res } = playToFumble(sd, 18);
    if (defenderFumbled(res, hero.weapons[0], hero) && res.hit && (res.woundsLost ?? 0) > 0) seed = sd;
  }

  it('une graine de Maladresse de défense AVEC touche existe', () => {
    expect(seed).toBeGreaterThan(0);
  });

  it('défenseur qui SURVIT au coup : son Oups! remonte à SON nom (contrat positif)', () => {
    const { hero, confirm, state } = playToFumble(seed, 18);
    confirm();
    expect(state().pendingCascade?.participants.some((s) => s.jet === 'fumble' && s.actorId === hero.id)).toBe(true);
  });

  it('l’Oups! du défenseur est appendu APRÈS les conséquences de l’attaque (ordre de référence = chemin réactif)', () => {
    const { hero, confirm, state } = playToFumble(seed, 1); // touche à 0 Blessure → Coup Critique empilé par l'attaque
    confirm();
    const steps = state().pendingCascade!.participants;
    const iCrit = steps.findIndex((s) => s.kind === 'critical');
    const iFumble = steps.findIndex((s) => s.jet === 'fumble' && s.actorId === hero.id);
    expect(iCrit, 'l’attaque a bien empilé sa conséquence').toBeGreaterThanOrEqual(0);
    expect(iFumble, 'l’Oups! du défenseur est là').toBeGreaterThanOrEqual(0);
    expect(iFumble, 'appendu APRÈS l’application de l’attaque, jamais avant').toBeGreaterThan(iCrit);
  });
});

// ── B1 : affichage de la fenêtre du siège MJ (contre-passe du juge) ──────────────────────────────

describe('#989 B1 — la fenêtre du siège MJ se REND chez le MJ (cadence manuelle)', () => {
  it('ennemi conduit par le MJ : `ownsLocally` (gate d’AFFICHAGE) répond comme `intentAllowedFor`', () => {
    const { enemy, hero } = setup({ x: 1, y: 0 }, [sword], { mode: 'host', mySeat: 0, gmSeat: 1 });
    hero.aiControlled = true; // seul l'ENNEMI est surfacé → la fenêtre appartient au siège MJ
    expect(maybeOpenDefense(useGame.getState, useGame.setState, hero, enemy)).toBe(true);
    const s0 = useGame.getState();
    expect(modalOwnerOf(s0), 'la fenêtre est celle de l’ennemi').toBe(enemy.id);
    expect(ownsLocally(s0, enemy.id), 'l’HÔTE ne rend pas la fenêtre du MJ (bandeau spectateur)').toBe(false);
    expect(intentAllowedFor(s0, 0, 'defenseRoll'), 'et il ne peut pas agir non plus').toBe(false);
    useGame.setState({ net: { ...s0.net, mySeat: 1 } }); // on se place au siège MJ
    const s1 = useGame.getState();
    expect(ownsLocally(s1, enemy.id), 'le MJ VOIT sa fenêtre').toBe(true);
    expect(intentAllowedFor(s1, 1, 'defenseRoll'), 'afficher et agir répondent pareil').toBe(true);
  });

  it('héros d’un autre siège : inchangé (le gate d’affichage reste l’ownership)', () => {
    const { enemy, hero } = setup({ x: 1, y: 0 }, [sword], { mode: 'host', mySeat: 0, ownership: { h: 1 } });
    expect(maybeOpenDefense(useGame.getState, useGame.setState, enemy, hero)).toBe(true);
    expect(ownsLocally(useGame.getState(), hero.id)).toBe(false);
    useGame.setState({ net: { ...useGame.getState().net, mySeat: 1 } });
    expect(ownsLocally(useGame.getState(), hero.id)).toBe(true);
  });

  it('SOLO (net par défaut) : `ownsLocally` reste vrai pour tous — bit-à-bit', () => {
    const { enemy, hero } = setup({ x: 1, y: 0 }, [sword]);
    const s = useGame.getState();
    expect([ownsLocally(s, hero.id), ownsLocally(s, enemy.id), ownsLocally(s, undefined)]).toEqual([true, true, true]);
  });
});

// ── B2 : #1000 — un même Test opposé n'est forcé qu'UNE fois ─────────────────────────────────────

describe('#1000 — second « Je ne faillirai pas ! » sur le MÊME Test opposé : refusé, point NON consommé', () => {
  it('le Point de Résilience du défenseur n’est jamais brûlé sans effet, et la raison est portée', () => {
    const { enemy, hero } = setup({ x: 1, y: 0 }, [sword], { gmSeat: 0 });
    const g = useGame.getState;
    enemy.resilience = 1; hero.resilience = 1;
    seedBattleRng(3);
    openAttackCascade(g, useGame.setState, { attackerId: enemy.id, targetId: hero.id, location: null, result: null, weaponUid: 'sw' }, 'Attaque', 'action/attack');
    g().attackRoll();
    g().attackForceSuccess(); // l'ATTAQUANT force (LDB 17 l.68)
    expect(g().pendingAttack!.forced).toBe(true);
    g().attackConfirm();
    g().defenseRoll();
    const before = { resilience: hero.resilience, def: g().pendingDefense!.def!.sl, hit: g().pendingDefense!.result!.hit };
    expect(opposedForcingSpent(g().pendingDefense!), 'le flux SAIT que le forçage est déjà consommé').toBe(true);
    g().defenseForceSuccess(); // second forçage sur le MÊME Test opposé
    const after = { resilience: hero.resilience, def: g().pendingDefense!.def!.sl, hit: g().pendingDefense!.result!.hit };
    expect(after.resilience, 'le Point du défenseur reste en poche').toBe(before.resilience);
    expect(after, 'aucun effet : ni jet re-dérivé, ni issue changée').toEqual(before);
    expect(OPPOSED_FORCING_REASON.length, 'une raison lisible existe pour le bouton gaté').toBeGreaterThan(0);
  });
});

// ── B3 : R4 en coop — le héros d'un AUTRE siège obtient son Oups! ───────────────────────────────

describe('#989 B3 — Maladresse de défense d’un héros d’un AUTRE siège (coop)', () => {
  it('l’étape Oups! existe et porte le nom du héros du siège 1', () => {
    const net = { mode: 'host' as const, mySeat: 0, ownership: { h: 1 } };
    let seed = 0;
    for (let sd = 1; sd <= 800 && !seed; sd++) {
      const { enemy, hero } = setup({ x: 1, y: 0 }, [sword], net);
      seedBattleRng(sd);
      if (!maybeOpenDefense(useGame.getState, useGame.setState, enemy, hero)) continue;
      useGame.getState().defenseRoll();
      const pd = useGame.getState().pendingDefense!;
      if (defenderFumbled(pd.result!, hero.weapons[0], hero)) seed = sd;
    }
    expect(seed, 'une graine de Maladresse de défense existe').toBeGreaterThan(0);
    const { enemy, hero } = setup({ x: 1, y: 0 }, [sword], net);
    seedBattleRng(seed);
    maybeOpenDefense(useGame.getState, useGame.setState, enemy, hero);
    useGame.getState().defenseRoll();
    useGame.getState().defenseConfirm();
    const c = useGame.getState().pendingCascade;
    expect(c?.participants.some((s) => s.jet === 'fumble' && s.actorId === hero.id),
      'le héros d’un autre siège joue SA Maladresse (surfaçage, pas affordance locale)').toBe(true);
  });
});

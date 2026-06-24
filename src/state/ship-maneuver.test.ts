import { describe, it, expect } from 'vitest';
import { rotateDir8 } from './dir8';
import { DIR8_DELTA } from '../gameIso/rig/facing';
import { inFireArc, targetArc } from './fireArc';
import { resolveShipManeuver } from '../engine/shipNavigation';
import { useGame } from './store';
import { seedBattleRng } from './battleRng';
import { maneuverShip } from './shipManeuver';
import type { Combatant, NavalTraitRef } from '../engine/types';

/**
 * Phase 2 « Manœuvre du navire » (MDG ch.13). Le cœur PUR : tourner le cap (`rotateDir8`) RE-MAPPE d'un coup
 * tous les arcs de bordée (la cible change de côté), et `resolveShipManeuver` dit si le virage réussit.
 */
describe('rotateDir8 — rotation du cap', () => {
  it('vire tribord (horaire, steps>0) / bâbord (anti-horaire, steps<0) par crans de 45°', () => {
    expect(rotateDir8('N', 2)).toBe('E'); // 90° à droite (tribord)
    expect(rotateDir8('N', -2)).toBe('O'); // 90° à gauche (bâbord)
    expect(rotateDir8('N', 1)).toBe('NE');
    expect(rotateDir8('N', -1)).toBe('NO');
    expect(rotateDir8('E', 4)).toBe('O'); // demi-tour
    expect(rotateDir8('NO', 1)).toBe('N'); // wrap horaire
    expect(rotateDir8('N', 0)).toBe('N');
  });
});

describe('Manœuvre → re-mapping des bordées (aligner / désaligner sa bordée)', () => {
  const ship = { x: 5, y: 5 };
  const east = { x: 9, y: 5 }; // cible plein EST du navire

  it('cap Nord : la cible plein est tombe dans la bordée TRIBORD', () => {
    expect(targetArc('N', ship, east)).toBe('tribord');
    expect(inFireArc('tribord', 'N', ship, east)).toBe(true);
  });

  it('virer tribord (N → E) SORT la cible de la bordée tribord (elle passe en PROUE)', () => {
    const h = rotateDir8('N', 2); // 'E'
    expect(targetArc(h, ship, east)).toBe('proue');
    expect(inFireArc('tribord', h, ship, east)).toBe(false); // la bordée tribord ne porte plus
  });

  it('virer bâbord (N → O) met la cible plein est DERRIÈRE (poupe), hors des deux bordées', () => {
    expect(targetArc(rotateDir8('N', -2), ship, east)).toBe('poupe'); // 'O' : on s'est détourné de la cible
  });

  it('demi-tour (N → S) fait passer la cible de tribord à BÂBORD (bordée opposée)', () => {
    expect(targetArc(rotateDir8('N', 4), ship, east)).toBe('babord'); // 'S'
  });
});

describe('resolveShipManeuver — réussite & DR final (MDG ch.13 l.117-119)', () => {
  it('DR final = DR du Test de Navigation + Man + extra ; réussite si ≥ 0', () => {
    expect(resolveShipManeuver(2, 5, -1).dr).toBe(1); // 2 + (-1) + 0
    expect(resolveShipManeuver(2, 5, -1).success).toBe(true);
    expect(resolveShipManeuver(0, 5, -1).success).toBe(false); // 0 - 1 = -1 < 0
  });
});

describe('shipTurn (action store) — vire le cap, branché aux arcs', () => {
  const ship = (): Combatant =>
    ({ id: 'ship', name: 'Cogue', kind: 'enemy', pos: { x: 5, y: 5 }, conditions: [], weapons: [] }) as unknown as Combatant;

  it('vire tribord 90° (N → E)', () => {
    useGame.setState({ battle: { combatants: [ship()], order: ['ship'], turn: 0 } as never, facing: { ship: 'N' } });
    useGame.getState().shipTurn('ship', 2);
    expect(useGame.getState().facing.ship).toBe('E'); // firedAttackBlock/targeting reliront ce cap → arcs re-mappés
  });

  it('vire bâbord 90° (N → O)', () => {
    useGame.setState({ battle: { combatants: [ship()], order: ['ship'], turn: 0 } as never, facing: { ship: 'N' } });
    useGame.getState().shipTurn('ship', -2);
    expect(useGame.getState().facing.ship).toBe('O');
  });

  it('navire sans cap → no-op (aucun virage fantôme)', () => {
    useGame.setState({ battle: { combatants: [], order: [], turn: 0 } as never, facing: {} });
    useGame.getState().shipTurn('ghost', 2);
    expect(useGame.getState().facing.ghost).toBeUndefined();
  });
});

describe('maneuverShip — Test de Navigation du barreur → vire le navire (MDG ch.13)', () => {
  const helmsman = (): Combatant =>
    ({
      id: 'helm', name: 'Timonier', kind: 'hero',
      characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 40, Dex: 30, Int: 30, FM: 30, Soc: 30 },
      wounds: { current: 10, max: 10 }, advantage: 0, conditions: [],
      skills: [{ skillId: 'voile', characteristic: 'Ag', advances: 40 }], talents: [], weapons: [],
      armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, movement: 4, pos: { x: 5, y: 5 },
    }) as unknown as Combatant;
  const ship = (): Combatant =>
    ({ id: 'ship', name: 'Barge', kind: 'npc', creatureId: 'bateau-de-patrouille', crewIds: ['helm'], pos: { x: 5, y: 5 }, conditions: [], weapons: [] }) as unknown as Combatant;

  it('vire le navire SSI le Test réussit (virage ⇔ réussite ; barreur = meilleur en Voile)', () => {
    seedBattleRng(7);
    useGame.setState({ battle: { combatants: [ship(), helmsman()], order: ['ship', 'helm'], turn: 0 } as never, facing: { ship: 'N' } });
    const before = useGame.getState().facing.ship;
    const r = maneuverShip(() => useGame.getState(), 'ship', 2)!;
    expect(r).toBeTruthy();
    expect(r.helmsman).toBe('Timonier'); // le seul de l'équipage → barreur désigné
    const after = useGame.getState().facing.ship;
    expect(after !== before).toBe(r.success); // le navire ne vire QUE sur une manœuvre réussie
    if (r.success) expect(after).toBe('E'); // tribord 90° depuis Nord
  });

  it('hors combat → null', () => {
    useGame.setState({ battle: null as never });
    expect(maneuverShip(() => useGame.getState(), 'ship', 2)).toBeNull();
  });

  it('« Peu maniable » pénalise la manœuvre (−1 DR/niveau, MDG ch.12 l.173) — cumulé au Man de la colonne', () => {
    // La cogue : Man −1 (colonne) ET Trait « Peu maniable » (−1 DR) → DR final = DR brut − 2 (colonnes distinctes).
    const cogue = { ...ship(), creatureId: 'cogue' } as Combatant;
    seedBattleRng(7);
    useGame.setState({ battle: { combatants: [cogue, helmsman()], order: ['ship', 'helm'], turn: 0 } as never, facing: { ship: 'N' } });
    const r = maneuverShip(() => useGame.getState(), 'ship', 2)!;
    expect(r.dr).toBe(r.navDR - 2); // Man (−1) + Peu maniable (−1)
  });

  it('« Lissage » (Amélioration d’instance) → M +1 : +1 au déplacement, DR inchangé (MDG ch.12 l.293)', () => {
    // Même barreur/seed → même DR ; seul le M de base change. testValue ≥ −2 DR (helmsman habile) → jamais la
    // bande M−1/M÷2 → +1 M ⇒ exactement +1 case de déplacement.
    const run = (upgrades?: NavalTraitRef[]) => {
      seedBattleRng(7);
      const s = { ...ship(), upgrades } as Combatant; // bateau-de-patrouille (aucun Lissage de TYPE)
      useGame.setState({ battle: { combatants: [s, helmsman()], order: ['ship', 'helm'], turn: 0 } as never, facing: { ship: 'N' } });
      return maneuverShip(() => useGame.getState(), 'ship', 2)!;
    };
    const plain = run();
    const lisse = run([{ id: 'lissage' }]);
    expect(lisse.dr).toBe(plain.dr); // Lissage n'affecte PAS le DR (≠ Peu maniable)…
    expect(lisse.movement).toBe(plain.movement + 1); // … mais +1 au Mouvement de base
  });

  it('succès → vire ET avance ; le barreur (à bord) suit la coque du MÊME delta (formation rigide)', () => {
    seedBattleRng(7);
    const s = ship();
    const h = helmsman();
    h.pos = { x: 5, y: 4 }; // équipier décalé d'une case → vérifie que l'offset est conservé
    useGame.setState({ battle: { combatants: [s, h], order: ['ship', 'helm'], turn: 0 } as never, facing: { ship: 'N' }, scene: null as never });
    const r = maneuverShip(() => useGame.getState(), 'ship', 2)!;
    expect(r.success).toBe(true); // (seed 7 : manœuvre réussie — cf. test ci-dessus)
    expect(r.advanced).toBeGreaterThan(0); // le navire AVANCE
    const d = DIR8_DELTA[useGame.getState().facing.ship]; // cap d'APRÈS le virage
    const b = useGame.getState().battle!;
    expect(b.combatants.find((c) => c.id === 'ship')!.pos).toEqual({ x: 5 + d.gx * r.advanced, y: 5 + d.gy * r.advanced });
    expect(b.combatants.find((c) => c.id === 'helm')!.pos).toEqual({ x: 5 + d.gx * r.advanced, y: 4 + d.gy * r.advanced });
  });

  it('échec → PAS de virage mais le navire avance QUAND MÊME le long du cap (RAW : déplacement inconditionnel)', () => {
    // Barreur faible (Voile ~18) sur la cogue (Man −1, Peu maniable −1) → DR final toujours < 0 (sl max 1 − 2 ≤ −1).
    const weak = helmsman();
    weak.skills = [{ skillId: 'voile', characteristic: 'Ag', advances: 0 } as never];
    weak.characteristics = { ...weak.characteristics, Ag: 18 };
    const cogue = { ...ship(), creatureId: 'cogue' } as Combatant;
    seedBattleRng(3);
    useGame.setState({ battle: { combatants: [cogue, weak], order: ['ship', 'helm'], turn: 0 } as never, facing: { ship: 'N' }, scene: null as never });
    const r = maneuverShip(() => useGame.getState(), 'ship', 2)!;
    expect(r.success).toBe(false); // manœuvre ratée
    expect(useGame.getState().facing.ship).toBe('N'); // le cap TIENT (aucun virage)
    expect(r.advanced).toBeGreaterThan(0); // … mais le navire avance quand même (M÷2 plancher)
    expect(useGame.getState().battle!.combatants.find((c) => c.id === 'ship')!.pos).toEqual({ x: 5, y: 5 - r.advanced }); // plein Nord
  });
});

describe('shipAdvance (action store) — avance coque + équipage le long du cap (MDG ch.13)', () => {
  const hull = (over: Partial<Combatant> = {}): Combatant =>
    ({ id: 'ship', name: 'Cogue', kind: 'npc', pos: { x: 5, y: 5 }, crewIds: ['m1', 'm2'], conditions: [], weapons: [], ...over }) as unknown as Combatant;
  const sailor = (id: string, pos: { x: number; y: number }): Combatant =>
    ({ id, name: id, kind: 'npc', pos, conditions: [], weapons: [] }) as unknown as Combatant;

  it('cap E, 3 cases → coque +3x ; équipage translaté du MÊME delta (offsets conservés) ; renvoie 3', () => {
    const m1 = sailor('m1', { x: 4, y: 4 });
    const m2 = sailor('m2', { x: 4, y: 6 });
    useGame.setState({ battle: { combatants: [hull(), m1, m2], order: ['ship'], turn: 0 } as never, facing: { ship: 'E' }, scene: null as never });
    expect(useGame.getState().shipAdvance('ship', 3)).toBe(3);
    const b = useGame.getState().battle!;
    expect(b.combatants.find((c) => c.id === 'ship')!.pos).toEqual({ x: 8, y: 5 });
    expect(b.combatants.find((c) => c.id === 'm1')!.pos).toEqual({ x: 7, y: 4 }); // +3x, offset (−1,−1) gardé
    expect(b.combatants.find((c) => c.id === 'm2')!.pos).toEqual({ x: 7, y: 6 });
  });

  it('clampe aux bornes de scène : coque près du bord → moved < cases, équipage translaté du même moved', () => {
    const m1 = sailor('m1', { x: 4, y: 5 });
    useGame.setState({ battle: { combatants: [hull({ crewIds: ['m1'] }), m1], order: ['ship'], turn: 0 } as never, facing: { ship: 'E' }, scene: { dimensions: { w: 7, h: 10 } } as never });
    expect(useGame.getState().shipAdvance('ship', 5)).toBe(1); // bord est à x=6 → 1 seule case dispo depuis x=5
    const b = useGame.getState().battle!;
    expect(b.combatants.find((c) => c.id === 'ship')!.pos).toEqual({ x: 6, y: 5 });
    expect(b.combatants.find((c) => c.id === 'm1')!.pos).toEqual({ x: 5, y: 5 }); // +1 (même moved)
  });

  it('cap absent OU 0 case dispo → no-op, renvoie 0 (aucune mutation)', () => {
    useGame.setState({ battle: { combatants: [hull()], order: ['ship'], turn: 0 } as never, facing: {}, scene: null as never });
    expect(useGame.getState().shipAdvance('ship', 3)).toBe(0); // pas de cap
    expect(useGame.getState().battle!.combatants.find((c) => c.id === 'ship')!.pos).toEqual({ x: 5, y: 5 }); // intacte
  });
});

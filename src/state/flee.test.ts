import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { testScene } from '../scenes/test-fixture';
import { fleeReachable } from './path';
import { emptyScene } from './scene';
import { stacks, COND } from '../engine/conditions';

describe('fleeReachable — Fuite dans la direction OPPOSÉE à l’adversaire (LDB 15 l.68)', () => {
  const scene = emptyScene(14, 14);
  const has = (m: Map<string, number>, x: number, y: number) => m.has(`${x},${y}`);
  it('exclut les cases qui RAPPROCHENT de l’adversaire, garde celles qui s’en éloignent', () => {
    const m = fleeReachable(scene, { x: 6, y: 6 }, { x: 6, y: 4 }, 4, { blocked: new Set() }); // adversaire au NORD (Tchebychev 2)
    expect(has(m, 6, 9)).toBe(true); // plein SUD : s'éloigne → permise
    expect(has(m, 6, 5)).toBe(false); // vers le NORD : rapproche → exclue
    expect(has(m, 6, 4)).toBe(false); // la case du foe : exclue
    expect(has(m, 8, 6)).toBe(true); // latérale à distance égale (Tchebychev 2) : ne rapproche pas → permise
  });
  it('bornée au range de Course passé', () => {
    const m = fleeReachable(scene, { x: 6, y: 6 }, { x: 6, y: 4 }, 4, { blocked: new Set() });
    expect(has(m, 6, 6)).toBe(true); // origine
    expect(has(m, 6, 12)).toBe(false); // 6 cases au sud > range 4 → hors de portée
  });
});

// Fuite (LDB 15 l.63-66) : coup dans le dos SUBI montré INLINE (phase 'fuir') ; le Test de
// Calme du fuyard passe par un jet INFLUENÇABLE (flux `flee`) qui DIFFÈRE la complétion de la fuite.
describe('Fuite intégrée à la modale (store)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    useGame.setState({ pendingReveals: [], pendingDisengage: null, battle: null });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('Fuir : coup dans le dos SUBI inline + Test de Calme DIFFÉRÉ (flux flee) ; fuite complétée au confirm, sans révélation', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', name: 'H', rng: makeRNG(1) });
    useGame.setState({ party: [hero], pendingReveals: [] });
    useGame.getState().seedRng(2);
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const E = b.combatants.find((c) => c.kind === 'enemy')!;
    E.characteristics['capacite-de-combat'] = 90; // le coup dans le dos (+20) touche à coup sûr
    H.wounds = { current: 40, max: 40, base: 40 } as never;
    H.engagedWith = [E.id];
    E.engagedWith = [H.id];
    useGame.setState({
      battle: { ...b },
      pendingReveals: [],
      pendingDisengage: { moverId: H.id, foeId: E.id, canSacrifice: false, phase: 'choice', atk: null, def: null, result: null },
    });

    useGame.getState().disengageFlee();

    // Plus de popin RevealModal : tout est porté par la modale de Désengagement (phase 'fuir').
    expect(useGame.getState().pendingReveals).toHaveLength(0);
    const pdf = useGame.getState().pendingDisengage!;
    expect(pdf).toBeTruthy();
    expect(pdf.phase).toBe('fuir');
    expect(typeof pdf.fuir!.attackerRoll).toBe('number');
    expect(pdf.fuir!.hit).toBe(true); // CC 90 +20 → touche
    expect(pdf.fuir!.woundsLost).toBeGreaterThan(0);
    expect(pdf.fuir!.calme).toBeNull(); // touché → Test de Calme DIFFÉRÉ (jet influençable en attente)
    // Fuite NON encore complétée : le fuyard reste Engagé tant que le Calme n'est pas confirmé.
    expect(useGame.getState().battle!.combatants.find((c) => c.id === H.id)!.engagedWith).toEqual([E.id]);

    // Le Test de Calme passe par le flux `flee` (jet INFLUENÇABLE) : Lancer puis Appliquer.
    useGame.getState().fleeRoll();
    expect(useGame.getState().pendingDisengage!.fuir!.calme).toBeTruthy(); // Calme résolu
    expect(useGame.getState().pendingReveals).toHaveLength(0); // backstab toujours inline, pas de révélation
    useGame.getState().fleeConfirm();

    // « Appliquer » complète la fuite (libération + Course) et ferme la modale.
    const after = useGame.getState();
    expect(after.pendingDisengage).toBeNull();
    expect(after.battle!.combatants.find((c) => c.id === H.id)!.engagedWith).toEqual([]); // libéré de tous les Engagements
    expect(after.battle!.reachable.size).toBeGreaterThan(0); // budget de Course posé
  });

  it("Fuir — Chance « +1 DR » réduit le nombre d'États Brisés sans basculer l'échec en réussite (LDB 17 l.26)", () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', name: 'H', rng: makeRNG(1) });
    useGame.setState({ party: [hero], pendingReveals: [] });
    useGame.getState().seedRng(2);
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const E = b.combatants.find((c) => c.kind === 'enemy')!;
    H.fortune = 2;
    H.engagedWith = [E.id];
    E.engagedWith = [H.id];
    // Phase 'fuir' avec un Test de Calme RATÉ figé (DR -2 → 3 États Brisés sans influence).
    useGame.setState({
      battle: { ...b },
      pendingReveals: [],
      pendingDisengage: { moverId: H.id, foeId: E.id, canSacrifice: false, phase: 'fuir', atk: null, def: null, result: null, fuir: { attackerRoll: 30, hit: true, woundsLost: 4, calme: { success: false, roll: 70, target: 50, sl: -2 } } },
    });

    // Chance « +1 DR » : DR -2 → -1 ; l'échec NE bascule PAS en réussite (1 Point de Chance dépensé).
    useGame.getState().fleeBonusSL();
    let st = useGame.getState();
    expect(st.pendingDisengage!.fuir!.calme!.sl).toBe(-1);
    expect(st.pendingDisengage!.fuir!.calme!.success).toBe(false);
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.fortune).toBe(1);

    // « Appliquer » : broken = 1 + max(0, 1) = 2 États Brisés (au lieu de 3 sans le +1 DR).
    useGame.getState().fleeConfirm();
    st = useGame.getState();
    expect(stacks(st.battle!.combatants.find((c) => c.id === H.id)!, COND.brise)).toBe(2);
    expect(st.pendingDisengage).toBeNull();
  });
});

/**
 * L11 — sorts à ZONE PERSISTANTE (LDB 47) : Mur de feu (« Quiconque traverse le mur de feu
 * gagne 1 État En flammes et subit une frappe de BFM Dégâts ») et Grands feux d'U'Zhul
 * (« le feu continue de brûler dans la ZdE pour la durée du Sort »).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { applyCast, wardedAgainst, organicProjectile } from './combatFlow';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { findSpell } from '../data';
import { testScene } from '../scenes/test-fixture';
import type { CastResult, MissileResult } from '../engine/magic';
import type { Combatant, Weapon } from '../engine/types';

describe('L11 — zones persistantes posées par les sorts', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null, pendingCast: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  function setup() {
    const W = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', name: 'W', rng: makeRNG(3) });
    useGame.setState({ party: [W] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    useGame.getState().seedRng(5);
    const b = useGame.getState().battle!;
    const caster = b.combatants.find((c) => c.name === 'W')!;
    caster.skills.push({ skillId: 'langue', spec: 'Magick', characteristic: 'Int', advances: 10 });
    caster.characteristics.FM = 40; // BFM 4
    caster.pos = { x: 5, y: 10 };
    const T = b.combatants.filter((c) => c.kind === 'enemy')[0];
    T.pos = { x: 10, y: 10 };
    return { caster, T };
  }

  it('Mur de feu : mur perpendiculaire centré sur la cible, durée (BFM) Rounds, onCross armé', () => {
    const { caster, T } = setup();
    const ok: CastResult = { cast: true, roll: 30, target: 70, sl: 6, isCritical: false, isFumble: false, log: 'ok' };
    applyCast(useGame.getState, useGame.setState, caster, T, findSpell('Mur de feu')!, ok, false, false);
    const wall = (useGame.getState().battle!.zones ?? []).find((z) => z.label === 'Mur de feu')!;
    expect(wall).toBeTruthy();
    expect(wall.rounds).toBe(4); // (BFM 4) Rounds
    expect(wall.onCross?.conditions?.[0]?.name).toBe('en-flammes');
    // axe O→E → mur VERTICAL passant par la cible ; longueur : BFM 4 m + 3 paliers (+2 DR) × 4 m = 16 m → 8 cases
    expect(wall.tiles.every((t) => t.x === 10)).toBe(true);
    expect(wall.tiles).toHaveLength(8);
    expect(wall.tiles.some((t) => t.y === 10)).toBe(true);
    expect(wall.casterId).toBe(caster.id);
  });

  it('Bouclier anti-flèches / Dôme : auras posées par le cast ; géométrie intérieur/extérieur', () => {
    const { caster, T } = setup();
    const ok: CastResult = { cast: true, roll: 30, target: 70, sl: 0, isCritical: false, isFumble: false, log: 'ok' };
    applyCast(useGame.getState, useGame.setState, caster, caster, findSpell('Bouclier anti-flèches')!, ok, false, false);
    applyCast(useGame.getState, useGame.setState, caster, caster, findSpell('Dôme')!, ok, false, false);
    const effects = caster.activeEffects ?? [];
    expect(effects.some((e) => e.arrowWard?.radiusMeters === 4)).toBe(true); // BFM 4 m
    expect(effects.some((e) => e.domeWard?.radiusMeters === 4)).toBe(true);
    // Géométrie : héros adjacent au porteur = couvert vs un tireur lointain…
    const ally = { ...caster, id: 'ally', activeEffects: [], pos: { x: 6, y: 10 } } as Combatant;
    const combatants = [caster, ally, T];
    expect(wardedAgainst(combatants, T, ally, 'arrowWard')).toBe(true);
    // …mais un attaquant DANS la zone n'est pas gêné (le projectile n'« entre » pas).
    const inside = { ...T, id: 'in', pos: { x: 5, y: 11 } } as Combatant;
    expect(wardedAgainst([caster, ally, inside], inside, ally, 'arrowWard')).toBe(false);
  });

  it('organicProjectile : flèches/carreaux/javelots oui — poudre/fronde/couteaux non', () => {
    const w = (name: string, subType = ''): Weapon => ({ name, subType, type: 'ranged', damage: { plusBF: false, flat: 7 }, qualities: [] } as unknown as Weapon);
    expect(organicProjectile(w('Arc long'))).toBe(true);
    expect(organicProjectile(w('Arbalète'))).toBe(true);
    expect(organicProjectile(w('Javelot'))).toBe(true);
    expect(organicProjectile(w('Pistolet', 'Poudre noire'))).toBe(false);
    expect(organicProjectile(w('Fronde'))).toBe(false);
    expect(organicProjectile(w('Couteau de lancer'))).toBe(false);
  });

  it('Grands feux d’U’Zhul : disque (BFM m) autour de la cible touchée, perRound armé', () => {
    const { caster, T } = setup();
    const ok: CastResult & Partial<MissileResult> = {
      cast: true, roll: 30, target: 70, sl: 0, isCritical: false, isFumble: false, log: 'ok',
      hit: true, woundsLost: 0, defenderDefeated: false, location: 'corps',
    };
    applyCast(useGame.getState, useGame.setState, caster, T, findSpell("Grands feux d'U'Zhul")!, ok, true, false);
    const fire = (useGame.getState().battle!.zones ?? []).find((z) => z.label === "Grands feux d'U'Zhul")!;
    expect(fire).toBeTruthy();
    expect(fire.rounds).toBe(4); // (BFM) Rounds
    expect(fire.perRound?.damage?.ignoreAP).toBe(true);
    // disque BFM 4 m → rayon 2 cases autour de la cible (10,10) → 5×5
    expect(fire.tiles).toHaveLength(25);
    expect(fire.tiles.some((t) => t.x === 10 && t.y === 10)).toBe(true);
  });
});

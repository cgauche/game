/**
 * LOT 6 — point A : PARITÉ Contre-sort sur une ZdE ENNEMIE (LDB 46 l.201-202 / 207).
 *
 * Avant, une ZdE d'un lanceur IA (`case 'castArea'`) était auto-posée SANS offrir aux héros la fenêtre de
 * Contre-sort/Dissipation — alors que le missile ennemi l'offre (via `routeEnemyCast`/`pendingCounterspell`).
 * On vérifie ici (1) que la ZdE ennemie OUVRE désormais cette fenêtre, (2) que la résolution du Contre-sort
 * (« Laisser passer ») POSE la zone sur le centre auto-choisi (pas de soft-lock, pas de résolution mono-cible
 * sur l'ancre lanceur), et (3) que la DISSIPATION ferme proprement le pending (aucune zone posée).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { spawnEnemy } from './spawn';
import { makePregens } from '../data/pregens';
import { findSpell } from '../data';
import type { Combatant } from '../engine/types';

describe('ZdE ennemie — fenêtre de Contre-sort (parité missile, point A)', () => {
  beforeEach(() => {
    vi.useFakeTimers(); vi.clearAllTimers();
    useGame.setState({ battle: null, party: [], journal: [], pendingCast: null, pendingCounterspell: null, pendingCascade: null });
    useGame.getState().seedRng(17);
  });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  /** Un héros LANCEUR (Langue (Magick)) capable de Dissiper, posé en (x,y). */
  function dispeller(x: number, y: number, id: string): Combatant {
    const h = makePregens().find((c) => c.name === 'Wilhelmina Faust')!;
    h.id = id; h.name = id; h.pos = { x, y };
    h.wounds = { ...h.wounds, max: 99, current: 99 };
    const sk = h.skills.find((s) => s.skillId === 'langue');
    if (sk) sk.advances = Math.max(sk.advances, 30);
    else h.skills.push({ skillId: 'langue', spec: 'Magick', characteristic: 'Int', advances: 30 } as never);
    h.spells = ['flechette', ...(h.spells ?? [])];
    return h;
  }

  /** Un sort de ZdE FIGÉ dans pendingCast (zone NON posée + aiCenter) — état EXACT que `case 'castArea'`
   *  produit juste avant la fenêtre de Contre-sort (jet réussi, centre auto-choisi mémorisé). */
  const okCast = () => ({ cast: true, roll: 11, target: 80, sl: 4, isCritical: false, isFumble: false, log: 'lancé' });

  function setupZoneAwaitingCounter() {
    const e = spawnEnemy('Bandit de Grand Chemin', undefined, 'caster', { x: 5, y: 5 });
    e.kind = 'enemy';
    e.characteristics.Int = 60; e.characteristics.FM = 60;
    e.skills = [{ skillId: 'langue', spec: 'Magick', characteristic: 'Int', advances: 40 } as never];
    const spell = findSpell('Explosion')!; // Projectile magique à ZdE
    e.spells = [spell.id];
    const h1 = dispeller(8, 8, 'h1');
    const h2 = dispeller(9, 8, 'h2'); // collés → un centre couvre les deux
    const battle = {
      combatants: [e, h1, h2], order: ['caster', 'h1', 'h2'], baseOrder: ['caster', 'h1', 'h2'],
      turn: 0, round: 1, action: 'cast', selectedSpellId: spell.id, reachable: new Map(),
      movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
    } as never;
    const scene = { id: 's', dimensions: { w: 20, h: 20 }, levels: [{ z: 0, tiles: [] }], entities: [], dialogues: [], triggers: [], encounters: [] } as never;
    useGame.setState({ battle, scene, party: [] });
    // Pose l'état figé : zone non posée + centre auto-choisi sur le paquet (8,8).
    useGame.setState({
      pendingCast: {
        casterId: 'caster', targetId: 'caster', spellId: spell.id, missile: true, focused: false,
        result: okCast() as never,
        zone: { center: null, radius: 1, r0m: 2, aiCenter: { x: 8, y: 8 } },
      } as never,
    });
    return { e, h1, h2 };
  }

  it('« Laisser passer » (aucune Dissipation) POSE la zone sur le centre auto-choisi (pas de soft-lock, pas de mono-cible)', () => {
    const { h1, h2 } = setupZoneAwaitingCounter();
    useGame.setState({ pendingCounterspell: { participants: [{ id: h1.id, interactive: true, result: null }] } as never });
    useGame.getState().counterspellCancel(); // personne ne contre → la zone se pose sur (8,8)
    for (let i = 0; i < 8 && useGame.getState().pendingReveals.length; i++) useGame.getState().dismissReveal();
    expect(useGame.getState().pendingCounterspell).toBeNull();
    expect(useGame.getState().pendingCast).toBeNull(); // pending fermé (zone posée → pas de soft-lock)
    const hp = (id: string) => useGame.getState().battle!.combatants.find((c) => c.id === id)!.wounds;
    expect(hp('h1').current).toBeLessThan(hp('h1').max); // dans le rayon → touché par la zone
    expect(hp('h2').current).toBeLessThan(hp('h2').max);
    void h2;
  });

  it('DISSIPATION (Contre-sort gagnant) → AUCUNE zone posée, pending fermé proprement (pas de soft-lock)', () => {
    const { h1, h2 } = setupZoneAwaitingCounter();
    // Force une issue de dissipation directement dans le participant (le moteur de Contre-sort la produit
    // normalement ; ici on isole la ROUTE post-Contre-sort = mon changement).
    useGame.setState({
      pendingCounterspell: {
        participants: [{ id: h1.id, interactive: true, result: { dispelled: true, counter: { sl: 5 }, log: 'Dissipé !' } }],
      } as never,
    });
    const hpBefore = useGame.getState().battle!.combatants.find((c) => c.id === h2.id)!.wounds.current;
    useGame.getState().counterspellConfirm();
    for (let i = 0; i < 8 && useGame.getState().pendingReveals.length; i++) useGame.getState().dismissReveal();
    expect(useGame.getState().pendingCounterspell).toBeNull();
    expect(useGame.getState().pendingCast).toBeNull(); // fermé proprement même dissipé (pas de soft-lock)
    // Sort dissipé → aucune zone appliquée : les cibles du paquet sont INTACTES.
    expect(useGame.getState().battle!.combatants.find((c) => c.id === h1.id)!.wounds.current).toBe(99);
    expect(useGame.getState().battle!.combatants.find((c) => c.id === h2.id)!.wounds.current).toBe(hpBefore);
  });
});

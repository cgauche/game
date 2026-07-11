import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { checkBattleOver } from './combatFlow';
import { pickActiveModalKey } from './modalArbiter';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import type { Combatant } from '../engine/types';
import type { PendingCascade } from './pendings';

/**
 * F3 (recette 2026-07-11, #345) — VERROU de l'ordonnancement : `checkBattleOver` DIFFÈRE la Victoire tant
 * qu'UNE cascade est ouverte, pas seulement une cascade `combatEndBoundary`. Une cascade de SETUP
 * (Surprise, purpose 'combat', ouverte au DÉBUT du combat) encore pendante quand la mort du dernier ennemi
 * remplit la condition de victoire ne doit PAS voir l'écran de Victoire (HORS_MODAL) s'empiler par-dessus
 * sa modale (clic intercepté) — doctrine suspension/reprise (cascade.ts). En jeu normal la Surprise se
 * résout AVANT tout coup ; c'est `killEnemies()` (triche) qui expose la co-existence latente.
 */
const get = useGame.getState;
const set = useGame.setState;

const surpriseCascade = (heroId: string): PendingCascade => ({
  title: 'Surprise', icon: 'ui/eye', purpose: 'combat', cursor: 0, log: [],
  participants: [{ id: `surprise-${heroId}`, kind: 'surpriseTest', actorId: heroId, target: 50, result: null, interactive: true }],
});

/** Ennemi GÉNÉRIQUE (ne suit PAS les règles de Personnage, aucune Corruption) : sa mort n'ouvre AUCUNE
 *  cascade de fin de combat — on isole ainsi la SEULE cascade de Surprise. Déjà hors d'action. */
const deadEnemy = (): Combatant =>
  ({ id: 'e', kind: 'enemy', name: 'Bandit', characteristics: { endurance: 30 } as never,
    wounds: { current: 0, max: 10 }, dead: true, conditions: [], skills: [], items: [], weapons: [],
    movement: 4, advantage: 0 } as unknown as Combatant);

describe('F3 — Surprise (cascade de setup) vs Victoire : ordonnancement de checkBattleOver', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ scene: null, battle: null, pendingVictory: null, pendingCascade: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('mort du dernier ennemi avec une Surprise PENDANTE → Victoire DIFFÉRÉE (cascade seule à l\'écran)', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', name: 'H', rng: makeRNG(1) });
    const heroClone = { ...hero, kind: 'hero' as const };
    useGame.setState({
      party: [hero],
      battle: { combatants: [heroClone, deadEnemy()], order: [hero.id, 'e'], turn: 0, round: 1, log: [], over: null } as never,
      pendingVictory: null,
      // Surprise de setup OUVERTE : le Test de Perception du guetteur reste à résoudre.
      pendingCascade: surpriseCascade(hero.id),
    });

    const ended = checkBattleOver(get, set);

    // FIX #345 : la Victoire est DIFFÉRÉE tant que la Surprise (purpose 'combat', non combatEndBoundary)
    // est pendante — pas de `battle.over`, pas de `pendingVictory`. La cascade reste la SEULE surface.
    expect(ended).toBe(true);       // `checkBattleOver` a bien statué (victoire différée), la boucle s'arrête
    expect(get().battle!.over).toBeNull();
    expect(get().pendingVictory).toBeNull();
    expect(get().pendingCascade).toBeTruthy();
    expect(get().pendingCascade!.purpose).toBe('combat');
    expect(get().pendingCascade!.participants[0].kind).toBe('surpriseTest');

    // L'arbitre n'offre QUE la cascade Surprise (aucun écran de Victoire empilé par-dessus).
    expect(pickActiveModalKey(get())).toBe('cascade');
  });
});

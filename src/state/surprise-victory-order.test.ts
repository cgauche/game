import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { checkBattleOver } from './combatFlow';
import { pickActiveModalKey } from './modalArbiter';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import type { Combatant } from '../engine/types';
import type { PendingCascade } from './pendings';

/**
 * F3 (recette 2026-07-11) — REPRO + DIAGNOSTIC, PAS de fix (l'arbitre `modalArbiter`/`ActiveModal` est le
 * territoire d'un autre codeur). Après une embuscade EXPÉDIÉE (`__wfrp.killEnemies`), la modale « Surprise »
 * restait affichée SOUS l'écran de Victoire (clic intercepté). Ce test reproduit la co-existence AU NIVEAU
 * STATE : un Test de Surprise (`pendingCascade`, purpose 'combat', NON `combatEndBoundary`) encore ouvert
 * quand la mort du dernier ennemi ouvre la Victoire.
 *
 * VERDICT (cf. rendu) : `checkBattleOver` (combatFlow.ts ~4551-4557) ne DIFFÈRE la Victoire QUE pour une
 * cascade `combatEndBoundary`. Une cascade de SETUP (Surprise, ouverte au DÉBUT du combat) n'est pas
 * couverte → `finishVictory` s'ouvre par-dessus. En jeu NORMAL la Surprise se résout à l'ouverture du
 * combat AVANT tout coup, donc Victoire et Surprise ne coexistent jamais : c'est `killEnemies()` (triche)
 * qui saute l'ordre Surprise→combat→victoire. Défaut LATENT réel néanmoins : `finishVictory` s'ouvre
 * au-dessus de N'IMPORTE quelle cascade non résolue, pas seulement `combatEndBoundary`.
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

  it('mort du dernier ennemi avec une Surprise PENDANTE → Victoire ouverte PAR-DESSUS (les deux coexistent)', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', name: 'H', rng: makeRNG(1) });
    const heroClone = { ...hero, kind: 'hero' as const };
    useGame.setState({
      party: [hero],
      battle: { combatants: [heroClone, deadEnemy()], order: [hero.id, 'e'], turn: 0, round: 1, log: [], over: null } as never,
      pendingVictory: null,
      // Surprise de setup OUVERTE : le Test de Perception du guetteur reste à résoudre.
      pendingCascade: surpriseCascade(hero.id),
    });

    checkBattleOver(get, set);

    // DÉFAUT REPRODUIT : la Victoire s'est ouverte alors que la Surprise (purpose 'combat', non
    // combatEndBoundary) est TOUJOURS pendante → l'écran de Victoire (HORS_MODAL) et la cascade Surprise
    // (MODAL) vivent en même temps (empilement z, clic intercepté).
    expect(get().battle!.over).toBe('victory');
    expect(get().pendingVictory).toBeTruthy();
    expect(get().pendingCascade).toBeTruthy();
    expect(get().pendingCascade!.purpose).toBe('combat');
    expect(get().pendingCascade!.participants[0].kind).toBe('surpriseTest');

    // L'arbitre offre bien la cascade Surprise (`pendingVictory` est HORS_MODAL, rendu par un écran séparé,
    // non masquant côté registre) → confirme la DOUBLE surface simultanée.
    expect(pickActiveModalKey(get())).toBe('cascade');
  });
});

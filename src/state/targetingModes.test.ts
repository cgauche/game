/**
 * Registre de modes de ciblage — l'aiguilleur `currentTargetingMode` rend le bon mode selon l'état, et
 * les modes à liste exposent les bonnes `candidates` (soin = alliés soignables ; Surincantation =
 * overcastTargetCandidates ; attaque = ennemis via l'affordance par défaut).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { currentTargetingMode } from './targetingModes';
import { useGame } from './store';
import { makePregens } from '../data/pregens';
import { spawnEnemy } from './spawn';

const arena = () => {
  const w = 16, h = 12;
  return { id: 's', dimensions: { w, h }, layers: [{ z: 0, tiles: new Array(w * h).fill('herbe') }], entities: [], dialogues: [], triggers: [], encounters: [] } as never;
};

/** Combat 2 héros + 2 ennemis, héros actif au centre. `over` patche le `battle`. */
function combat(over: Record<string, unknown> = {}) {
  const hero = makePregens()[0]; hero.id = 'h1'; hero.pos = { x: 6, y: 6 };
  const ally = makePregens()[1]; ally.id = 'h2'; ally.pos = { x: 5, y: 6 };
  const e1 = spawnEnemy('Bandit de Grand Chemin', undefined, 'e1', { x: 7, y: 6 }); // adjacent
  const e2 = spawnEnemy('Bandit de Grand Chemin', undefined, 'e2', { x: 8, y: 6 });
  const battle = {
    combatants: [hero, ally, e1, e2], order: ['h1', 'h2', 'e1', 'e2'], baseOrder: ['h1', 'h2', 'e1', 'e2'],
    turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null, ...over,
  } as never;
  useGame.setState({ battle, scene: arena(), party: [hero, ally], pendingCleave: null, pendingDualStrike: null, pendingCast: null, pendingAttack: null, pendingSiegeAim: null });
  return { hero, ally, e1, e2 };
}

describe('currentTargetingMode — aiguilleur unique', () => {
  beforeEach(() => { useGame.setState({ battle: null, party: [], pendingCleave: null, pendingDualStrike: null, pendingCast: null, pendingAttack: null, pendingSiegeAim: null }); });

  it('mode NEUTRE → attaque', () => {
    combat();
    expect(currentTargetingMode(useGame.getState).id).toBe('attack');
  });
  it('action=cast → mode cast', () => {
    combat({ action: 'cast', selectedSpellId: 'carreau' });
    expect(currentTargetingMode(useGame.getState).id).toBe('cast');
  });
  it('action=heal → mode soin', () => {
    combat({ action: 'heal' });
    expect(currentTargetingMode(useGame.getState).id).toBe('heal');
  });
  it('action=battery → mode bordée', () => {
    combat({ action: 'battery' });
    expect(currentTargetingMode(useGame.getState).id).toBe('battery');
  });
  it('action=teleport → mode téléportation', () => {
    combat({ action: 'teleport' });
    expect(currentTargetingMode(useGame.getState).id).toBe('teleport');
  });
  it('pendingCleave → mode Frappe Mortelle (priorité maximale)', () => {
    combat();
    useGame.setState({ pendingCleave: { attackerId: 'h1', hitIds: [], count: 0 } as never });
    expect(currentTargetingMode(useGame.getState).id).toBe('cleave');
  });
  it('pendingDualStrike → mode 2ᵉ frappe', () => {
    combat();
    useGame.setState({ pendingDualStrike: { attackerId: 'h1', offWeaponUid: 'x', mainRoll: 10 } as never });
    expect(currentTargetingMode(useGame.getState).id).toBe('dual');
  });
  it('pendingCast.pickingTargets → mode Surincantation', () => {
    combat();
    useGame.setState({ pendingCast: { casterId: 'h1', targetId: 'e1', spellId: 'carreau', missile: true, pickingTargets: true, result: { cast: true } } as never });
    expect(currentTargetingMode(useGame.getState).id).toBe('overcast');
  });
  it('pose de zone (pilonnage indirect) → mode placing-zone', () => {
    combat();
    useGame.setState({ pendingSiegeAim: { gunnerId: 'h1', weaponUid: 'w', radius: 2, rangeTiles: 10 } as never });
    expect(currentTargetingMode(useGame.getState).id).toBe('placing-zone');
  });
});

describe('candidates des modes à liste', () => {
  beforeEach(() => { useGame.setState({ battle: null, party: [], pendingCleave: null, pendingDualStrike: null, pendingCast: null, pendingAttack: null, pendingSiegeAim: null }); });

  it('soin : candidates = alliés soignables (un allié blessé adjacent)', () => {
    const { hero, ally } = combat({ action: 'heal' });
    ally.wounds.current = Math.max(0, ally.wounds.max - 4); // soignable
    useGame.setState({ battle: { ...useGame.getState().battle! } });
    const mode = currentTargetingMode(useGame.getState);
    const ids = mode.candidates!(useGame.getState, hero).map((c) => c.id);
    expect(ids).toContain('h2');
    expect(ids).not.toContain('e1'); // jamais un ennemi
  });

  it('surincantation : candidates = overcastTargetCandidates (autres ennemis en portée, hors la cible)', () => {
    const { hero } = combat();
    useGame.setState({ pendingCast: { casterId: 'h1', targetId: 'e1', spellId: 'carreau', missile: true, pickingTargets: true, result: { cast: true } } as never });
    const mode = currentTargetingMode(useGame.getState);
    const ids = mode.candidates!(useGame.getState, hero).map((c) => c.id);
    expect(ids).toContain('e2'); // l'autre ennemi en portée
    expect(ids).not.toContain('e1'); // la cible principale est exclue
    expect(ids).not.toContain('h1'); // ni le lanceur
  });

  it('attaque : l’affordance vise les ENNEMIS (réticule sur l’ennemi, none sur l’allié)', () => {
    const { hero, ally, e1 } = combat();
    const mode = currentTargetingMode(useGame.getState);
    expect(mode.affordance!(useGame.getState, hero, e1).kind).toBe('ok'); // ennemi adjacent → frappe
    expect(mode.affordance!(useGame.getState, hero, ally).kind).toBe('none'); // allié → pas une cible d'attaque
  });
});

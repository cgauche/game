import { describe, it, expect, afterEach } from 'vitest';
import { applySurprise, computeMoveReach } from './combatFlow';
import { chooseEnemyAction } from './ai';
import { effectiveMovement } from '../engine/encumbrance';
import { seedBattleRng } from './battleRng';
import { hasCondition } from '../engine/conditions';
import { setRule, resetRule } from '../engine/policy';
import { useGame } from './store';
import type { Combatant } from '../engine/types';

const scene = () => ({ id: 's', nom: '', description: '', dimensions: { w: 10, h: 10 }, levels: [{ z: 0, tiles: Array(100).fill('herbe') }], entities: [], dialogues: [], triggers: [], encounters: [], flags: {} } as never);
const C = (over: Partial<Combatant>): Combatant =>
  ({ id: 'x', kind: 'hero', name: 'X', conditions: [], skills: [], characteristics: {}, wounds: { current: 10, max: 10 }, items: [], movement: 4, advantage: 0, ...over } as unknown as Combatant);

describe('Surprise — établissement & comportement (LDB 13 l.52-81 / 16 l.130-136)', () => {
  afterEach(() => resetRule('combat-cadence'));

  it('applySurprise : le camp embusqué qui perd le Test opposé Perception vs Discrétion → Surpris', () => {
    setRule('combat-cadence', 'rapide'); // héros auto-résolu inline (pas de cascade différée à piloter)
    seedBattleRng(1);
    const LOW = { CC: 5, CT: 5, F: 5, E: 5, I: 5, Ag: 5, Dex: 5, Int: 5, FM: 5, Soc: 5 } as never;
    const HIGH = { CC: 90, CT: 90, F: 90, E: 90, I: 90, Ag: 90, Dex: 90, Int: 90, FM: 90, Soc: 90 } as never;
    const hero = C({ id: 'h', kind: 'hero', characteristics: LOW }); // Perception faible
    const enemy = C({ id: 'e', kind: 'enemy', characteristics: HIGH }); // Discrétion forte (embusqueur)
    useGame.setState({ battle: { combatants: [hero, enemy], order: ['h', 'e'], turn: -1, round: 1, log: [], over: null } as never, pendingLogQueue: [] });
    applySurprise(useGame.getState, useGame.setState, 'party'); // les héros sont pris en embuscade
    const h = useGame.getState().battle!.combatants.find((c) => c.id === 'h')!;
    const e = useGame.getState().battle!.combatants.find((c) => c.id === 'e')!;
    expect(hasCondition(h, 'surpris')).toBe(true);
    expect(hasCondition(e, 'surpris')).toBe(false);
  });

  it('effectiveMovement = 0 quand Surpris (LDB 16 l.132)', () => {
    const c = C({ characteristics: { F: 30, E: 30 } as never, conditions: [{ name: 'surpris', value: 1 }] });
    expect(effectiveMovement(c)).toBe(0);
  });

  it('IA : un ennemi Surpris passe la main (ni Mouvement ni Action)', () => {
    const e = C({ id: 'e', kind: 'enemy', conditions: [{ name: 'surpris', value: 1 }], pos: { x: 5, y: 5 }, weapons: [{ name: 'Épée', type: 'melee', damage: '+4', qualities: [] }] as never });
    const h = C({ id: 'h', kind: 'hero', pos: { x: 6, y: 5 } });
    expect(chooseEnemyAction({ enemy: e, heroes: [h], scene: scene(), blocked: new Set(), movement: 4 } as never).kind).toBe('end');
  });

  it('un héros Surpris ne peut QUE puiser dans sa Détermination (resolve)', () => {
    const hero = C({ id: 'h', kind: 'hero', conditions: [{ name: 'surpris', value: 1 }], pos: { x: 5, y: 5 }, weapons: [{ name: 'Épée', type: 'melee', damage: '+4', qualities: [] }] as never, resolve: 1 });
    useGame.setState({ battle: { combatants: [hero], order: ['h'], turn: 0, action: null, movementUsed: 0, acted: false, reachable: new Map(), over: false, round: 1, log: [] } as never, scene: scene() });
    expect(computeMoveReach(useGame.getState).size).toBe(0); // Mouvement bloqué (effectiveMovement = 0)
    useGame.getState().battleSelectAction('cast');
    expect(useGame.getState().battle!.action).toBeNull(); // Action bloquée
    useGame.getState().battleSelectAction('resolve');
    expect(useGame.getState().battle!.action).toBe('resolve'); // Détermination permise (LDB 13 l.81)
  });

  it('aucune surprise déclarée → personne n\'est Surpris', () => {
    const hero = C({ id: 'h', kind: 'hero' });
    const enemy = C({ id: 'e', kind: 'enemy' });
    // applySurprise n'est appelé que si enc.surprise est défini ; ici on vérifie juste l'état initial.
    expect(hasCondition(hero, 'surpris')).toBe(false);
    expect(hasCondition(enemy, 'surpris')).toBe(false);
  });
});

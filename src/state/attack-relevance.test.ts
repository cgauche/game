/**
 * Scoreur de pertinence d'attaque (partagé joueur clic droit / IA). Tests PURS de la branche zone
 * (bonus multi-cible auto) + du poids ÉDITABLE par manœuvre (`priority`). La branche mêlée (dégâts via
 * previewAttack/attackPlan) est couverte en intégration (recette navigateur).
 */
import { describe, it, expect } from 'vitest';
import { scoreAttack } from './attackRelevance';
import type { AttackOption } from './combatFlow';
import type { Combatant } from '../engine/types';
import type { BattleState } from './store';

const at = (kind: 'hero' | 'enemy', id: string, x: number, y: number): Combatant =>
  ({ id, name: id, kind, pos: { x, y }, conditions: [], wounds: { current: 10, max: 10 } }) as unknown as Combatant;
const battleOf = (cs: Combatant[]): BattleState => ({ combatants: cs }) as unknown as BattleState;
const stubGet = (() => ({})) as never; // la branche zone n'appelle pas get() (pas d'attackPlan/previewAttack)
const zoneOpt: AttackOption = { id: 'souffle', kind: 'souffle', label: 'Souffle', icon: 'creature/breath', targeting: 'zone', cost: { action: false, advantage: 2 } };

describe('scoreAttack — zone (bonus multi-cible auto) + priority éditable', () => {
  it('zone : le score CROÎT avec le nombre d’ennemis groupés autour du point d’impact', () => {
    const hero = at('hero', 'H', 0, 0);
    const tgt = at('enemy', 'E1', 10, 10);
    const isolated = battleOf([hero, tgt]);
    const grouped = battleOf([hero, tgt, at('enemy', 'E2', 10, 11), at('enemy', 'E3', 11, 10)]);
    expect(scoreAttack(stubGet, hero, zoneOpt, tgt, grouped)).toBeGreaterThan(scoreAttack(stubGet, hero, zoneOpt, tgt, isolated));
  });

  it('priority éditable : poids 0 → jamais auto-choisie (-Infinity) ; poids ×2 double le score', () => {
    const hero = at('hero', 'H', 0, 0);
    const tgt = at('enemy', 'E1', 10, 10);
    const b = battleOf([hero, tgt]);
    expect(scoreAttack(stubGet, hero, { ...zoneOpt, priority: 0 }, tgt, b)).toBe(-Infinity);
    const base = scoreAttack(stubGet, hero, { ...zoneOpt, priority: 1 }, tgt, b);
    expect(scoreAttack(stubGet, hero, { ...zoneOpt, priority: 2 }, tgt, b)).toBe(base * 2);
  });
});

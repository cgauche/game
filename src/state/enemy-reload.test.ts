import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame, type BattleState } from './store';
import { applyAttackResult, runEnemyAI } from './combatFlow';
import { chooseEnemyAction, type EnemyTurnInput } from './ai';
import { spawnEnemy } from './spawn';
import { findTrappingById } from '../data';
import { qualityIndice } from '../engine/qualities/dispatch';
import { QUALITY_IDS } from '../engine/qualities/ids';
import { seedBattleRng } from './battleRng';
import { emptyScene } from './scene';
import type { Combatant, Weapon } from '../engine/types';
import type { AttackResult } from '../engine/combat';

/**
 * #126 — Recharge (Indice) (LDB 62 l.333-335) ne distingue pas héros/ennemi : « Une arme déchargée
 * possédant ce défaut nécessite un Test étendu de Projectiles […] pour être rechargée. » Un tireur ENNEMI
 * suit donc le MÊME cycle `loaded`/rechargement que le héros (spawn chargé → tir → déchargé → Test étendu),
 * sans état ni chemin parallèle. Ces tests figent la parité de bout en bout.
 */
const CROSSBOW: Weapon = { name: 'Arbalète', type: 'ranged', damage: { plusBF: false, flat: 9 }, range: 60, reload: 1, qualities: [] };
const CHARS = { CC: 40, CT: 60, F: 35, E: 35, I: 35, Ag: 35, Dex: 35, Int: 35, FM: 35, Soc: 35 };

function enemyWith(over: Partial<Combatant>): Combatant {
  return {
    id: 'e1', name: 'Arbalétrier', kind: 'enemy', characteristics: CHARS, wounds: { current: 10, max: 10 },
    advantage: 0, conditions: [], movement: 4, skills: [], talents: [], traits: [], engagedWith: [],
    size: 'moyenne', weapons: [CROSSBOW], items: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    ...over,
  } as unknown as Combatant;
}
function heroAt(x: number, y: number): Combatant {
  return {
    id: 'h1', name: 'Héros', kind: 'hero', characteristics: CHARS, wounds: { current: 12, max: 12 },
    advantage: 0, conditions: [], movement: 4, skills: [], talents: [], traits: [], engagedWith: [],
    pos: { x, y }, size: 'moyenne',
    weapons: [{ name: 'Épée', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [] }],
    items: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
  } as unknown as Combatant;
}

const hitResult: AttackResult = {
  hit: true, attackerRoll: 40, netSL: 2, location: 'corps', damage: 5, woundsLost: 5,
  critical: false, advantageTo: 'attacker', defenderDefeated: false, log: '',
};

describe('#126 — Rechargement des ennemis (parité héros, LDB 62 l.333-335)', () => {
  // (1) Résolution de l'Indice de Recharge par LIBELLÉ d'arme (creatureEquip) + (2) spawn chargé.
  it('(a) un ennemi fraîchement spawné avec une arme à Recharge démarre CHARGÉ (peut tirer au tour 1, pas de softlock)', () => {
    // L'armement de créature est en Traits (« À distance (Arbalète) +9 (60) », arg = id `arbalete` du
    // catalogue `trappings`) : l'Indice de Recharge est résolu par la Qualité du trapping au spawn.
    expect(qualityIndice(findTrappingById('arbalete')!, QUALITY_IDS.Recharge)).toBe(1);
    const e = spawnEnemy(undefined, { name: 'Arbalétrier', char: { B: 10 }, traits: [{ id: 'a-distance', value: 9, arg: 'arbalete', range: 60 }] } as never, 'e1', { x: 5, y: 5 });
    const rw = e.weapons.find((w) => w.type === 'ranged')!;
    expect(rw.reload).toBe(1);   // Indice de Recharge résolu par libellé
    expect(e.loaded).toBe(true); // chargé au spawn → PAS de recharge à vide au 1er Round
    // Preuve « pas de softlock tour 1 » : l'IA choisit de TIRER (pas de reload), l'arme étant chargée.
    const scene = emptyScene(16, 16);
    const h = heroAt(1, 1);
    const input: EnemyTurnInput = { enemy: e, heroes: [h], scene, blocked: new Set(['1,1']), movement: e.movement, spells: [] };
    expect(chooseEnemyAction(input).kind).toBe('shoot');
  });

  // (3) applyAttackResult généralisé : tir ennemi à Recharge → déchargé (source unique héros+ennemi).
  it('(b) un ENNEMI qui tire avec une arme à Recharge se retrouve DÉCHARGÉ après le coup', () => {
    const enemy = enemyWith({ pos: { x: 5, y: 0 }, loaded: true });
    const hero = heroAt(0, 0);
    const battle = {
      combatants: [enemy, hero], order: [enemy.id, hero.id], baseOrder: [enemy.id, hero.id],
      turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
      movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
    } as unknown as BattleState;
    useGame.setState({ battle, mode: 'battle' });
    applyAttackResult(useGame.getState, useGame.setState, enemy, hero, CROSSBOW, hitResult);
    const e = useGame.getState().battle!.combatants.find((c) => c.id === enemy.id)!;
    expect(e.loaded).toBe(false); // Recharge 1 → déchargé, exactement comme le héros
  });

  // (4) Dispatch IA `reload` INLINE : Test étendu de Projectiles, cumul de DR → restaure `loaded`.
  describe('(c) l\'action reload de l\'IA résout le Test étendu et restaure loaded', () => {
    beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); });
    afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

    it('arme déchargée + cible en vue → reload accumule les DR et recharge (Indice 1 atteint)', () => {
      seedBattleRng(7); // 1er d100 = 2 → réussite franche (CT 60) → DR ≥ Indice 1
      const enemy = enemyWith({ pos: { x: 5, y: 5 }, loaded: false, reloadProgress: 0 });
      const hero = heroAt(1, 1); // visible + en portée, NON adjacent (pas de mêlée) → l'IA doit recharger
      const battle = {
        combatants: [enemy, hero], order: [enemy.id, hero.id], baseOrder: [enemy.id, hero.id],
        turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
        movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
      } as unknown as BattleState;
      useGame.setState({ battle, scene: emptyScene(16, 16), party: [], partyPos: { x: 0, y: 0 }, mode: 'battle' });

      runEnemyAI(useGame.getState, useGame.setState, enemy.id); // le reload INLINE est synchrone (avant advanceTurn différé)

      const e = useGame.getState().battle!.combatants.find((c) => c.id === enemy.id)!;
      expect(e.loaded).toBe(true);        // Indice 1 atteint → rechargée
      expect(e.reloadProgress ?? 0).toBe(0); // cumul remis à zéro après complétion
      expect(useGame.getState().battle!.acted).toBe(true); // recharger coûte l'Action
    });
  });
});

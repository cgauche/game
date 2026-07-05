import { describe, it, expect } from 'vitest';
import { attackEnv } from './combatFlow';
import type { Get } from './flowTypes';
import type { Combatant, Weapon } from '../engine/types';
import type { Scene } from './scene';

/**
 * Cible dissimulée par le brouillard/la brume/l'obscurité → malus au TIR de −10 (bande Complexe de la
 * table Difficulté de Combat, LDB 14). PDF FR : l'exemple combiné « brouillard + Localisation précise »
 * donne un Test Difficile −20 par la SOMME des modificateurs → chacun vaut −10. (Le −20/−30 existe pour
 * d'AUTRES cas : météo extrême = Difficile −20 ; tir dans le noir = Très Difficile −30.)
 */
const bow = { name: 'Arc', type: 'ranged' } as unknown as Weapon;
const mk = (id: string, kind: 'hero' | 'enemy', x: number): Combatant =>
  ({ id, name: id, kind, size: 'moyenne', pos: { x, y: 5 }, conditions: [], talents: [], liveTraits: [], skills: [], weapons: [], movement: 4, loaded: true, advantage: 0,
     characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
     wounds: { current: 12, max: 12 }, armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 } }) as unknown as Combatant;
const fogScene = (): Scene =>
  ({ id: 's', name: 's', dimensions: { w: 40, h: 40 }, ambiance: 'jour', weather: 'brouillard', metresPerTile: 2,
     layers: [{ z: 0, tiles: new Array(40 * 40).fill('herbe') }], entities: [], dialogues: [], triggers: [], encounters: [] }) as unknown as Scene;

describe('attackEnv (tir) — cible dissimulée par le brouillard = −10 (Complexe, LDB 14)', () => {
  it('brouillard, tireur sans vision nocturne → −10 (et pas −20)', () => {
    const attacker = mk('att', 'hero', 5);
    const target = mk('tgt', 'enemy', 8);
    const get = (() => ({ scene: fogScene(), battle: { combatants: [attacker, target], movementUsed: 0 }, facing: {}, gameTime: 12 * 60 })) as unknown as Get;
    const env = attackEnv(get, attacker, target, bow).env;
    const conceal = env.find((m) => m.value < 0); // seul malus de ce setup minimal = la dissimulation
    expect(conceal).toBeTruthy();
    expect(conceal!.value).toBe(-10);
  });
});

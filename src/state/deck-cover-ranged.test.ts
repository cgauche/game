import { describe, it, expect } from 'vitest';
import { attackEnv } from './combatFlow';
import type { Get } from './flowTypes';
import type { Combatant, Weapon, ShipPoste } from '../engine/types';
import type { Scene } from './scene';

/**
 * #248 — COUVERT DE PONT au calcul de touche. Un défenseur SERVANT un poste couvert (T2C f.66 l.111,
 * Plat-bord = « couverture moyenne » → tir Difficile −20 ; Sabord/Murs blindés = totale −30) reçoit sa
 * classe par le MÊME chemin que le couvert de terrain (`worstCover` sur la ligne `cf.coverLabel`). Le
 * barème est le canon `coverModifier` (lineOfSight.ts) — aucun modificateur parallèle. Mêlée non affectée.
 */
const bow = { name: 'Arc', type: 'ranged' } as unknown as Weapon;
const sword = { name: 'Épée', type: 'melee' } as unknown as Weapon;
const mk = (id: string, kind: 'hero' | 'enemy', x: number): Combatant =>
  ({ id, name: id, kind, size: 'moyenne', pos: { x, y: 5 }, conditions: [], talents: [], liveTraits: [], skills: [], weapons: [], movement: 4, loaded: true, advantage: 0,
     characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
     wounds: { current: 12, max: 12 }, armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 } }) as unknown as Combatant;
const clearScene = (): Scene =>
  ({ id: 's', name: 's', dimensions: { w: 40, h: 40 }, ambiance: 'jour', weather: 'clair', metresPerTile: 2,
     layers: [{ z: 0, tiles: new Array(40 * 40).fill('herbe') }], entities: [], dialogues: [], triggers: [], encounters: [] }) as unknown as Scene;

/** Coque-témoin portant un poste dont `tgt` fait partie de l'équipage (source `crewPosteOf`). Hors LdV
 *  (sans `pos`) → jamais compté comme occupant/bloqueur. `cover` absent = servant à découvert. */
const hullServing = (cover?: 'moyenne' | 'totale'): Combatant =>
  ({ id: 'hull', name: 'coque', kind: 'enemy', conditions: [], wounds: { current: 30, max: 30 },
     postes: [{ crewIds: ['tgt'], cover } as unknown as ShipPoste] }) as unknown as Combatant;

function envFor(weapon: Weapon, hull?: Combatant) {
  const attacker = mk('att', 'enemy', 5); // enemy : pas de « Tir en bougeant » par défaut (bruit héros)
  const target = mk('tgt', 'enemy', 8);
  const combatants = hull ? [attacker, target, hull] : [attacker, target];
  const get = (() => ({ scene: clearScene(), battle: { combatants, movementUsed: 0 }, facing: {}, gameTime: 12 * 60 })) as unknown as Get;
  return attackEnv(get, attacker, target, weapon).env;
}
const cover = (env: { label: string; value: number }[]) => env.find((e) => e.value < 0);

describe('#248 — couvert de pont raccordé au calcul de touche', () => {
  it('tir contre servant à poste `totale` → −30 (Sabord/Murs blindés)', () => {
    expect(cover(envFor(bow, hullServing('totale')))!.value).toBe(-30);
  });
  it('tir contre servant à poste `moyenne` → −20 (Plat-bord, « couverture moyenne » = Difficile)', () => {
    expect(cover(envFor(bow, hullServing('moyenne')))!.value).toBe(-20);
  });
  it('tir contre cible SANS couvert (aucun poste) → aucune ligne de couvert', () => {
    expect(envFor(bow)).toEqual([]);
    expect(envFor(bow, hullServing(undefined))).toEqual([]); // servant à découvert (poste sans cover)
  });
  it('MÊLÉE contre servant à poste `totale` → NON affectée (aucune ligne de couvert)', () => {
    expect(cover(envFor(sword, hullServing('totale')))).toBeUndefined();
  });
});

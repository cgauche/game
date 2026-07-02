import { describe, it, expect } from 'vitest';
import { placeCombatant } from './spawn';
import type { Scene } from './scene';
import type { Combatant } from '../engine/types';

/** Scène minimale 3×1 : eau | sol | eau. */
const scene = {
  id: 's', nom: 'Mer', dimensions: { w: 3, h: 1 },
  layers: [{ z: 0, tiles: ['eau', 'sol', 'eau'] }],
  entities: [], dialogues: [], triggers: [],
} as unknown as Scene;

const marine = (): Combatant => ({
  id: 'm1', name: 'Wyrm', kind: 'enemy',
  characteristics: { CC: 30, CT: 0, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
  movement: 6, wounds: { current: 20, max: 20 }, weapons: [], skills: [], talents: [],
  traits: [{ id: 'creature-marine' }],
} as unknown as Combatant);

describe('placeCombatant — drapeau positionnel offTerrain (op offTerrainMod, MDG p.140)', () => {
  it('posé HORS de l’eau, retiré DANS l’eau — re-dérivé à chaque placement (chokepoint unique)', () => {
    const c = marine();
    placeCombatant(c, scene, { x: 1, y: 0 }); // case 'sol'
    expect(c.offTerrain).toBe(true);
    placeCombatant(c, scene, { x: 0, y: 0 }); // case 'eau'
    expect(c.offTerrain).toBe(false);
  });

  it('un combattant SANS passif de terrain ne porte jamais le drapeau', () => {
    const c = { ...marine(), traits: [] } as Combatant;
    placeCombatant(c, scene, { x: 1, y: 0 });
    expect(c.offTerrain).toBeUndefined();
  });
});

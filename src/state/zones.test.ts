/**
 * Zones persistantes (Jalon 2.6 L11) : géométrie, TTL, traversée (Mur de feu, LDB 47),
 * occupation par Round (Grands feux d'U'Zhul, LDB 47), mitigation des Dégâts (BE + PA corps).
 */
import { describe, it, expect } from 'vitest';
import type { Combatant } from '../engine/types';
import type { RNG } from '../engine/dice';
import { wallTiles, discTiles, decayZones, crossZones, zonesRoundTick, losBlockingTiles, type BattleZone } from './zones';

const rng: RNG = { int: () => 5 } as RNG;

function mk(over: Partial<Combatant> = {}): Combatant {
  return {
    id: 'c', name: 'Cobaye', kind: 'enemy', size: 'moyenne', advantage: 0,
    characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 40, Soc: 30 },
    conditions: [], skills: [], talents: [], traits: [], groups: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    movement: 4, wounds: { current: 12, max: 12 }, pos: { x: 5, y: 5 },
    ...over,
  } as unknown as Combatant;
}

describe('wallTiles — Mur de feu perpendiculaire à l’axe lanceur→centre', () => {
  it('axe horizontal → mur vertical centré, longueur exacte', () => {
    const t = wallTiles({ x: 0, y: 5 }, { x: 4, y: 5 }, 3);
    expect(t).toContainEqual({ x: 4, y: 4 });
    expect(t).toContainEqual({ x: 4, y: 5 });
    expect(t).toContainEqual({ x: 4, y: 6 });
    expect(t).toHaveLength(3);
  });
  it('axe diagonal → perpendiculaire diagonale', () => {
    const t = wallTiles({ x: 0, y: 0 }, { x: 3, y: 3 }, 3);
    expect(t).toContainEqual({ x: 3, y: 3 });
    expect(t).toHaveLength(3);
  });
});

describe('decayZones — TTL en Rounds', () => {
  it('décrémente et dissipe à 0', () => {
    const { zones, log } = decayZones([
      { label: 'Fumée', tiles: [{ x: 1, y: 1 }], rounds: 2 },
      { label: 'Mur de feu', tiles: [{ x: 2, y: 2 }], rounds: 1 },
    ]);
    expect(zones).toHaveLength(1);
    expect(zones[0].rounds).toBe(1);
    expect(log.join(' ')).toMatch(/Mur de feu se dissipe/);
  });
});

describe('crossZones — « Quiconque traverse le mur de feu » (LDB 47)', () => {
  const wall: BattleZone = {
    label: 'Mur de feu', tiles: [{ x: 4, y: 4 }, { x: 4, y: 5 }, { x: 4, y: 6 }], rounds: 3,
    onCross: { damage: { amount: { bonusOf: 'FM' } }, conditions: [{ name: 'En flammes' }] },
    casterId: 'w',
  };
  const caster = mk({ id: 'w', name: 'Pyromancien', characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 40, Soc: 30 } as Combatant['characteristics'] });
  it('chemin qui traverse : BFM Dégâts (mitigés BE) + En flammes, UNE fois par zone', () => {
    const m = mk({ id: 'm', name: 'Brigand' }); // E 30 → BE 3 ; FM lanceur 40 → 4 Dégâts → 1 PB
    const lines = crossZones([wall], m, [{ x: 3, y: 5 }, { x: 4, y: 5 }, { x: 5, y: 5 }], () => caster, rng);
    expect(m.wounds.current).toBe(11);
    expect(m.conditions.some((c) => c.name === 'En flammes')).toBe(true);
    expect(lines.join(' ')).toMatch(/traverse Mur de feu/);
  });
  it('chemin qui contourne : rien', () => {
    const m = mk({ id: 'm2' });
    const lines = crossZones([wall], m, [{ x: 3, y: 8 }, { x: 4, y: 8 }, { x: 5, y: 8 }], () => caster, rng);
    expect(m.wounds.current).toBe(12);
    expect(lines).toHaveLength(0);
  });
});

describe('zonesRoundTick — « Quiconque se trouve dans la ZdE au début d’un Round » (Grands feux)', () => {
  const fire: BattleZone = {
    label: "Grands feux d'U'Zhul", tiles: discTiles({ x: 5, y: 5 }, 2), rounds: 4,
    perRound: { damage: { amount: { dice: { n: 1, sides: 10, plus: 6 } }, ignoreAP: true }, conditions: [{ name: 'En flammes' }] },
  };
  it('occupant : 1d10+6 Dégâts ignorant les PA (mitigés BE) + 1 En flammes', () => {
    const inZone = mk({ id: 'a', pos: { x: 6, y: 5 }, armour: { tete: 9, brasG: 9, brasD: 9, corps: 9, jambeG: 9, jambeD: 9 } as Combatant['armour'] });
    const outZone = mk({ id: 'b', pos: { x: 20, y: 20 } });
    const lines = zonesRoundTick([fire], [inZone, outZone], rng);
    // d10 scripté = 5 → 11 Dégâts − BE 3 = 8 (PA 9 ignorées)
    expect(inZone.wounds.current).toBe(4);
    expect(inZone.conditions.some((c) => c.name === 'En flammes')).toBe(true);
    expect(outZone.wounds.current).toBe(12);
    expect(lines.join(' ')).toMatch(/ignore PA/);
  });
});

describe('losBlockingTiles — seules les zones opaques bloquent la vue', () => {
  it('fumée opaque vs feu transparent', () => {
    const tiles = losBlockingTiles([
      { label: 'Fumée', tiles: [{ x: 1, y: 1 }], rounds: 2, blocksLoS: true },
      { label: 'Mur de feu', tiles: [{ x: 2, y: 2 }], rounds: 2 },
    ]);
    expect(tiles).toEqual([{ x: 1, y: 1 }]);
  });
});

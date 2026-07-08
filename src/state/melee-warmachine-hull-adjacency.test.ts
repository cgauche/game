import { describe, it, expect } from 'vitest';
import { attackPlan } from './combatFlow';
import { combatGeomOf, combatGeomOfList } from './mount';
import { meleeWarMachineHullOf, isMeleeWarMachine } from './siegePush';
import type { Combatant, ShipPoste } from '../engine/types';
import type { GameState } from './store';
import type { Scene } from './scene';

/**
 * #210 Lot 2 — l'attaque d'une pièce de MÊLÉE servie (bélier, ADE II ch.08 l.233) est ancrée à la
 * COQUE/l'affût, pas au chef qui la sert : `meleeWarMachineHullOf`/`combatGeomOf` (mount.ts, siegePush.ts)
 * remplacent l'adjacence du CHEF par celle de la PIÈCE dans `attackPlan`/`firedAttackBlock`/`firedWeapon`.
 * Les pièces à DISTANCE (baliste/canon) gardent la géométrie du chef — inchangé.
 */
const ramWeapon = { uid: 'ram-w', trappingId: 'belier-test', name: 'Bélier', kind: 'melee' as const, damage: { plusBF: true, flat: 10 }, qualities: [{ id: 'equipe', value: 6 }], weaponGroup: 'machine-de-guerre' };
const cannonWeapon = { uid: 'cannon-w', trappingId: 'canon-test', name: 'Canon', kind: 'ranged' as const, damage: { plusBF: false, flat: 14 }, range: 75, qualities: [{ id: 'equipe', value: 6 }], weaponGroup: 'poudre-noire' };

const ramPoste: ShipPoste = { item: ramWeapon as never, crewIds: ['chef'] };
const cannonPoste: ShipPoste = { item: cannonWeapon as never, crewIds: ['chef'] };

const combatant = (over: Partial<Combatant>): Combatant =>
  ({
    id: 'chef', name: 'Chef', kind: 'hero',
    characteristics: { CC: 30, CT: 30, F: 50, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [],
    weapons: [{ name: 'Bélier', type: 'melee', damage: { plusBF: true, flat: 10 }, reach: 'Moyenne', qualities: [{ id: 'equipe', value: 6 }], weaponGroup: 'machine-de-guerre', uid: 'ram-w' }],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], movement: 4, bodyShape: 'humanoide',
    ...over,
  }) as unknown as Combatant;

const hull = (pos: { x: number; y: number }, poste: ShipPoste, footprint?: number): Combatant =>
  ({ id: 'hull', name: 'Affût', kind: 'ally', pos, conditions: [], wounds: { current: 20, max: 20 }, dead: false, postes: [poste], footprint, bodyShape: 'engin', inert: true }) as unknown as Combatant;

const door = (pos: { x: number; y: number }): Combatant =>
  ({ id: 'door', name: 'Porte', kind: 'enemy', pos, conditions: [], wounds: { current: 20, max: 20 }, dead: false, bodyShape: 'structure', inert: true }) as unknown as Combatant;

const scene = (): Scene =>
  ({ id: 's', name: 's', dimensions: { w: 10, h: 10 }, ambiance: 'jour', layers: [{ z: 0, tiles: new Array(100).fill('herbe') }], entities: [], dialogues: [], triggers: [], encounters: [] }) as unknown as Scene;

const NET_LOCAL = { mode: 'local', mySeat: 0, ownership: {}, slots: [0, 0, 0, 0] };
const mkGet = (combatants: Combatant[]): (() => GameState) =>
  (() => ({ scene: scene(), battle: { combatants, movementUsed: 0 }, facing: {}, gameTime: 0, log: () => {}, net: NET_LOCAL })) as unknown as () => GameState;

describe('#210 — adjacence d\'une pièce de MÊLÉE servie = celle de la COQUE, jamais celle du chef', () => {
  it('(a) coque ADJACENTE à la porte, chef PAS adjacent (loin) : attaque DISPONIBLE', () => {
    const gate = door({ x: 5, y: 0 });
    const ram = hull({ x: 4, y: 0 }, ramPoste); // adjacente à la porte (distance 1)
    const chef = combatant({ pos: { x: 0, y: 0 }, mannedPoste: ramPoste } as never); // très loin de la porte
    const plan = attackPlan(mkGet([chef, ram, gate]), chef, gate);
    expect(plan.kind).toBe('attack');
  });

  it('(b) chef ADJACENT à la porte mais coque À DISTANCE : attaque INDISPONIBLE (le bug corrigé)', () => {
    const gate = door({ x: 5, y: 0 });
    const chef = combatant({ pos: { x: 4, y: 0 }, mannedPoste: ramPoste } as never); // adjacent à la porte
    const ram = hull({ x: 0, y: 0 }, ramPoste); // très loin de la porte
    const plan = attackPlan(mkGet([chef, ram, gate]), chef, gate);
    expect(plan.kind).toBe('blocked'); // une structure ne se charge/rejoint jamais implicitement (isInanimate)
  });

  it('(c) empreinte >1 : une coque 2×2 dont UNE case touche la porte reste adjacente', () => {
    const gate = door({ x: 5, y: 0 });
    const ram = hull({ x: 3, y: 0 }, ramPoste, 2); // occupe (3,0)-(4,1) : la tuile (4,0) touche la porte (5,0)
    const chef = combatant({ pos: { x: 0, y: 0 }, mannedPoste: ramPoste } as never);
    const plan = attackPlan(mkGet([chef, ram, gate]), chef, gate);
    expect(plan.kind).toBe('attack');
  });

  it('(d) non-régression PIÈCE À DISTANCE (canon/baliste) : géométrie du CHEF inchangée', () => {
    const chef = combatant({ id: 'chef', pos: { x: 4, y: 0 }, mannedPoste: cannonPoste } as never);
    const far = hull({ x: 0, y: 0 }, cannonPoste); // coque du canon très loin — ne doit RIEN changer
    expect(isMeleeWarMachine({ type: 'ranged', qualities: cannonWeapon.qualities })).toBe(false);
    expect(meleeWarMachineHullOf(chef, [chef, far])).toBeUndefined();
    expect(combatGeomOf({ combatants: [chef, far] } as never, chef)).toBe(chef);
    expect(combatGeomOfList([chef, far], chef)).toBe(chef);
  });

  it('meleeWarMachineHullOf : `undefined` si aucun poste servi, ou si la pièce n\'est pas de mêlée', () => {
    const noPoste = combatant({ id: 'chef' });
    expect(meleeWarMachineHullOf(noPoste, [noPoste])).toBeUndefined();
    const ram = hull({ x: 1, y: 0 }, ramPoste);
    const chef = combatant({ id: 'chef', mannedPoste: ramPoste } as never);
    expect(meleeWarMachineHullOf(chef, [chef, ram])).toBe(ram);
  });
});

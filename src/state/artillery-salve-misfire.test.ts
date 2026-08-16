import { describe, it, expect } from 'vitest';
import { applyOups } from './combatFlow';
import { useGame } from './store';
import type { Combatant, Weapon } from '../engine/types';

/**
 * #450 — branchement de la Table AA « Incidents de Tir d'Artillerie par Salve » (AA 10 l.270-277) :
 * une arme dotée de l'Atout *Salve* (id `salve`) qui subit un Incident de tir (`applyOups`,
 * cas `misfire`) tire EN PLUS sur ce tableau d10 dédié — AA 10 l.264. DISTINCT de l'Incident de tir
 * GÉNÉRIQUE d'Arme d'équipe (MDG 12 l.464) déjà résolu par le même appelant.
 */
const chars = { 'capacite-de-combat': 30, 'capacite-de-tir': 40, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };
const mkHero = (id: string, over: Partial<Combatant> = {}): Combatant =>
  ({ id, name: id, kind: 'hero', characteristics: { ...chars },
    wounds: { current: 20, max: 20 }, advantage: 0, conditions: [], items: [],
    skills: [], talents: [], weapons: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, movement: 4, pos: { x: 5, y: 5 }, ...over }) as unknown as Combatant;

const salveGun: Weapon = {
  name: 'Batterie tonnerre de feu', type: 'ranged', subType: 'ingenierie',
  damage: { flat: 12, plusBF: false },
  qualities: [{ id: 'salve', value: 9 }, { id: 'arme-d-equipe', value: 3 }],
} as unknown as Weapon;

const setup = (chef: Combatant, aide?: Combatant) => {
  useGame.setState({
    battle: { combatants: aide ? [chef, aide] : [chef], order: [chef.id], turn: 0, round: 1, acted: false, log: [] } as never,
    party: aide ? [chef, aide] : [chef], facing: {}, scene: null as never,
  });
  return { get: () => useGame.getState(), set: ((patch: never) => useGame.setState(patch)) as never };
};

describe('Incident de Tir d’Artillerie par Salve (AA 10 l.270-277) — branchement `applyOups`', () => {
  it("arme à Atout Salve : le tireur encaisse ET journalise l'Incident par Salve en plus du misfire générique", () => {
    const chef = mkHero('chef');
    const { get, set } = setup(chef);
    applyOups(get, set, chef, { ...salveGun, chambered: 5 }, { roll: 44, kind: 'misfire', label: 'Incident de Tir !' });
    expect(chef.wounds.current).toBeLessThan(20);
    const log = get().battle!.log.map((l) => l.text ?? l).join(' | ');
    expect(log).toContain('Salve');
  });

  it('arme à Salve ET Arme d’équipe : le second servant (aide) encaisse aussi la Table par Salve', () => {
    const chef = mkHero('chef', { mannedPoste: { crewIds: ['chef', 'aide'] } as never });
    const aide = mkHero('aide');
    const { get, set } = setup(chef, aide);
    applyOups(get, set, chef, { ...salveGun, chambered: 0 }, { roll: 44, kind: 'misfire', label: 'Incident de Tir !' });
    // Générique d'équipe (MDG 12 l.464) ET Table par Salve (AA) frappent tous deux l'aide au moins une fois.
    expect(aide.wounds.current).toBeLessThan(20);
  });

  it('arme SANS Atout Salve : aucun jet/branchement sur la Table par Salve (misfire générique inchangé)', () => {
    const gun: Weapon = { name: 'Arbalète', type: 'ranged', damage: { flat: 8, plusBF: false }, qualities: [] } as unknown as Weapon;
    const chef = mkHero('chef');
    const { get, set } = setup(chef);
    applyOups(get, set, chef, gun, { roll: 44, kind: 'misfire', label: 'Incident de Tir !' });
    const log = get().battle!.log.map((l) => l.text ?? l).join(' | ');
    expect(log).not.toContain('Salve');
  });
});

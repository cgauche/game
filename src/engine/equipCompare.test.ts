import { describe, it, expect } from 'vitest';
import { compareEquip, isShieldItem } from './equipCompare';
import type { Combatant, ItemInstance, Weapon } from './types';

// « Actuellement équipé » = l'arme tenue dans le set actif (Weapon dérivés `c.weapons`) ; l'armure reste pilotée
// par `items.equipped`. On modélise donc l'équipement courant via `weapons` (armes) et `items` (armure).
const hero = (p: { weapons?: Partial<Weapon>[]; items?: Partial<ItemInstance>[] }): Combatant =>
  ({ id: 'h', name: 'H', weapons: (p.weapons ?? []) as Weapon[], items: (p.items ?? []) as ItemInstance[] } as unknown as Combatant);
const it_ = (p: Partial<ItemInstance>): ItemInstance =>
  ({ uid: p.uid ?? 'n', name: 'X', kind: 'melee', qualities: [], enc: 0, equipped: false, ...p } as ItemInstance);

describe('compareEquip (accordéon « équiper » du marchand)', () => {
  it('mêlée : améliore les Dégâts et l’Allonge vs l’arme actuelle', () => {
    const h = hero({ weapons: [{ uid: 'cur', name: 'Dague', type: 'melee', damage: '+BF', reach: 'Très courte', qualities: [] }] });
    const epee = it_({ uid: 'new', name: 'Épée', kind: 'melee', damage: '+BF+4', reach: 'Moyenne', qualities: ['Équilibrée'] });
    const c = compareEquip(epee, h);
    expect(c.slot).toBe('melee');
    expect(c.currentName).toBe('Dague');
    const dmg = c.rows.find((r) => r.label === 'Dégâts')!;
    expect(dmg.next).toBe('+BF+4');
    expect(dmg.trend).toBe('up');
    expect(c.rows.find((r) => r.label === 'Allonge')!.trend).toBe('up');
  });

  it('mêlée sans arme tenue (mains nues seules) : compare aux mains nues, pas de currentName', () => {
    const h = hero({ weapons: [{ uid: 'mn', name: 'Mains nues', type: 'melee', damage: '+BF+0', qualities: [] }] });
    const c = compareEquip(it_({ name: 'Dague', damage: '+BF', reach: 'Très courte' }), h);
    expect(c.currentName).toBeNull(); // les Mains nues ne comptent pas comme arme « actuelle »
    expect(c.rows.find((r) => r.label === 'Dégâts')!.trend).toBe('up'); // +BF (0) > +BF-2 (-2)
  });

  it('mêlée : downgrade signalé (Dégâts inférieurs)', () => {
    const h = hero({ weapons: [{ uid: 'cur', name: 'Zweihänder', type: 'melee', damage: '+BF+6', reach: 'Longue', qualities: [] }] });
    const c = compareEquip(it_({ name: 'Couteau', damage: '+BF-1', reach: 'Très courte' }), h);
    expect(c.rows.find((r) => r.label === 'Dégâts')!.trend).toBe('down');
    expect(c.rows.find((r) => r.label === 'Allonge')!.trend).toBe('down');
  });

  it('distance : compare la Portée, n’exige pas d’arme de mêlée tenue', () => {
    const h = hero({ weapons: [{ uid: 'm', name: 'Épée', type: 'melee', damage: '+BF+4', qualities: [] }] });
    const arc = it_({ name: 'Arc', kind: 'ranged', damage: '+9', range: 90, qualities: [] });
    const c = compareEquip(arc, h);
    expect(c.slot).toBe('ranged');
    expect(c.currentName).toBeNull(); // pas d'arme à distance tenue
    expect(c.rows.find((r) => r.label === 'Portée')!.trend).toBe('up');
  });

  it('armure : PA par zone, gain sur le Corps quand la neuve fait mieux', () => {
    const h = hero({ items: [{ uid: 'cur', name: 'Veste de cuir', kind: 'armor', pa: 1, locs: ['corps'], qualities: [], equipped: true }] });
    const maille = it_({ name: 'Chemise de mailles', kind: 'armor', pa: 3, locs: ['corps'], qualities: [] });
    const c = compareEquip(maille, h);
    expect(c.slot).toBe('armor');
    const corps = c.rows.find((r) => r.label === 'PA Corps')!;
    expect(corps.current).toBe('1');
    expect(corps.next).toBe('3');
    expect(corps.trend).toBe('up');
  });

  it('bouclier : compare la Protection (Protectrice N), exclut l’objet lui-même', () => {
    expect(isShieldItem({ qualities: ['Protectrice 1'] })).toBe(true);
    const h = hero({ weapons: [{ uid: 'cur', name: 'Bouclier (Targe)', type: 'melee', qualities: ['Protectrice 1', 'Défensive'] }] });
    const grand = it_({ uid: 'new', name: 'Bouclier (Grand)', kind: 'melee', qualities: ['Protectrice 3', 'Défensive'] });
    const c = compareEquip(grand, h);
    expect(c.slot).toBe('shield');
    expect(c.currentName).toBe('Bouclier (Targe)');
    expect(c.rows[0].trend).toBe('up');
  });
});

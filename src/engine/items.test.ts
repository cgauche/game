import { describe, it, expect } from 'vitest';
import { recomputeLoadout, totalEncumbrance, maxEncumbrance, itemFromTrapping, weaponWithAmmo, compatibleAmmo, emptyArmour, damageArmour } from './items';
import { Combatant, ItemInstance, Weapon } from './types';

const item = (o: Partial<ItemInstance>): ItemInstance =>
  ({ uid: 'u', name: 'x', kind: 'misc', qualities: [], enc: 0, equipped: false, ...o }) as ItemInstance;

describe('items — recomputeLoadout / encombrement', () => {
  it('recomputeLoadout dérive armes ET armure actives des objets ÉQUIPÉS', () => {
    const c = {
      characteristics: { F: 30, E: 30 },
      items: [
        item({ name: 'Hache', kind: 'melee', damage: '+BF+4', equipped: true }),
        item({ name: 'Plastron', kind: 'armor', pa: 2, locs: ['corps'], equipped: true }),
        item({ name: 'Casque rangé', kind: 'armor', pa: 3, locs: ['tete'], equipped: false }),
      ],
    } as unknown as Combatant;
    recomputeLoadout(c);
    expect(c.weapons.map((w) => w.name)).toContain('Hache');
    expect(c.weapons.map((w) => w.name)).toContain('Mains nues'); // dernier recours toujours présent
    expect(c.armour.corps).toBe(2); // armure équipée appliquée à sa localisation
    expect(c.armour.tete).toBe(0); // l'armure NON équipée ne compte pas
  });
  it('recomputeLoadout propage le SKIN d’un objet légendaire au Weapon actif (rendu recoloré)', () => {
    const c = { items: [item({ name: 'Lame du Crépuscule', kind: 'melee', damage: '+BF+5', equipped: true, skin: { metal: '#caa64a' } })] } as unknown as Combatant;
    recomputeLoadout(c);
    expect(c.weapons.find((w) => w.name === 'Lame du Crépuscule')?.skin).toEqual({ metal: '#caa64a' });
    expect(c.weapons.find((w) => w.name === 'Mains nues')?.skin).toBeUndefined();
  });
  it("totalEncumbrance somme l'encombrement de tous les objets portés", () => {
    const c = { items: [item({ enc: 2 }), item({ enc: 3 }), item({ enc: 0 })] } as unknown as Combatant;
    expect(totalEncumbrance(c)).toBe(5);
  });
  it("maxEncumbrance = Bonus de Force + Bonus d'Endurance (LDB)", () => {
    expect(maxEncumbrance({ characteristics: { F: 35, E: 42 } } as unknown as Combatant)).toBe(3 + 4);
  });
  it('maxEncumbrance : +2 par niveau de Costaud (LDB talents)', () => {
    const c = { characteristics: { F: 30, E: 30 }, talents: [{ name: 'Costaud', times: 1 }] } as unknown as Combatant;
    expect(maxEncumbrance(c)).toBe(3 + 3 + 2); // BF+BE + Costaud×2
  });
  it('totalEncumbrance : une armure ÉQUIPÉE (portée) compte −1 ; arme tenue et armure rangée non (LDB Enc. l.22)', () => {
    const c = {
      items: [
        item({ name: 'Armure de cuir', kind: 'armor', enc: 1, equipped: true }), // portée → 0
        item({ name: 'Cotte de mailles', kind: 'armor', enc: 2, equipped: true }), // portée → 1
        item({ name: 'Plastron rangé', kind: 'armor', enc: 2, equipped: false }), // rangé → 2
        item({ name: 'Épée', kind: 'melee', enc: 1, equipped: true }), // tenue, non « portée » → 1
      ],
    } as unknown as Combatant;
    expect(totalEncumbrance(c)).toBe(0 + 1 + 2 + 1);
  });
  it('itemFromTrapping : trapping inconnu → null', () => {
    expect(itemFromTrapping('Objet Totalement Imaginaire XYZ')).toBeNull();
  });
  it('itemFromTrapping : objet du catalogue = identifié (qualités connues) (#2)', () => {
    const it = itemFromTrapping('Hallebarde');
    expect(it).toBeTruthy();
    expect(it!.identified).not.toBe(false); // connu (undefined = identifié par défaut)
  });
});

describe('totalEncumbrance — qualités d’artisanat (LDB 60 l.56/91)', () => {
  const enc = (items: ItemInstance[]) => totalEncumbrance({ items } as unknown as Combatant);
  it('Léger réduit l’Enc de 1 (plancher 0)', () => {
    expect(enc([item({ kind: 'misc', enc: 2, qualities: ['Léger'] })])).toBe(1);
    expect(enc([item({ kind: 'misc', enc: 1, qualities: ['Léger'] })])).toBe(0);
  });
  it('Volumineux augmente l’Enc de 1 (objet NON porté)', () => {
    expect(enc([item({ kind: 'melee', enc: 2, qualities: ['Volumineux'] })])).toBe(3);
  });
  it('armure portée : -1 (existant) ; Volumineux porté = Enc 1 ; Léger porté cumule (l.91)', () => {
    expect(enc([item({ kind: 'armor', enc: 2, equipped: true })])).toBe(1); // 2-1 (inchangé)
    expect(enc([item({ kind: 'armor', enc: 2, equipped: true, qualities: ['Volumineux'] })])).toBe(1); // forcé à 1
    expect(enc([item({ kind: 'armor', enc: 3, equipped: true, qualities: ['Léger'] })])).toBe(1); // (3-1)-1 = 1
  });
});

describe('Dégâts d’armure (LDB 63 l.52-55)', () => {
  const heroWith = (items: ItemInstance[]): Combatant =>
    ({ characteristics: { F: 30, E: 30 }, items, armour: emptyArmour() }) as unknown as Combatant;

  it('recomputeLoadout dérive la PA NETTE des dégâts (pa − damageTaken, plancher 0)', () => {
    const c = heroWith([item({ kind: 'armor', pa: 3, locs: ['corps'], equipped: true, damageTaken: 1 })]);
    recomputeLoadout(c);
    expect(c.armour.corps).toBe(2);
  });
  it('pièce réduite à 0 (damageTaken ≥ pa) → n’apporte plus de PA', () => {
    const c = heroWith([item({ kind: 'armor', pa: 2, locs: ['corps'], equipped: true, damageTaken: 5 })]);
    recomputeLoadout(c);
    expect(c.armour.corps).toBe(0);
  });
  it('damageArmour (héros) : endommage la pièce la plus solide + re-dérive', () => {
    const c = heroWith([item({ kind: 'armor', pa: 3, locs: ['corps'], equipped: true })]);
    recomputeLoadout(c);
    expect(damageArmour(c, 'corps')).toBe(true);
    expect(c.armour.corps).toBe(2);
  });
  it('damageArmour (ennemi sans items : armure plate) : décrément direct', () => {
    const enemy = { armour: { ...emptyArmour(), tete: 2 } } as unknown as Combatant;
    expect(damageArmour(enemy, 'tete')).toBe(true);
    expect(enemy.armour.tete).toBe(1);
  });
  it('damageArmour : pas d’armure utilisable → false', () => {
    expect(damageArmour({ armour: emptyArmour() } as unknown as Combatant, 'corps')).toBe(false);
  });
});

describe('Munitions & rechargement', () => {
  it('itemFromTrapping lit subType + qty (préfixe) pour une munition', () => {
    const fleche = itemFromTrapping('Flèche')!;
    expect(fleche.kind).toBe('ammo');
    expect(fleche.subType).toBe('Arc');
    expect(fleche.qty).toBe(12);
    expect(fleche.qualities).toContain('Empaleuse');
  });
  it('weaponWithAmmo combine Dégâts (concaténés) et fusionne les Atouts', () => {
    const arc: Weapon = { name: 'Arc', type: 'ranged', damage: '+9', range: 60, qualities: [], subType: 'Arc', reload: 0 };
    const fleche = itemFromTrapping('Flèche')!;
    const w = weaponWithAmmo(arc, fleche);
    expect(w.qualities).toContain('Empaleuse');
    // La Flèche n'a pas de modificateur de Dégâts → reste +9.
    expect(w.damage).toBe('+9');
  });
  it('compatibleAmmo filtre par subType et qty>0', () => {
    const c = { items: [itemFromTrapping('Flèche'), itemFromTrapping('Carreau')] } as unknown as Combatant;
    const arc: Weapon = { name: 'Arc', type: 'ranged', damage: '+9', qualities: [], subType: 'Arc', reload: 0 };
    const list = compatibleAmmo(c, arc);
    expect(list.length).toBe(1);
    expect(list[0].name).toBe('Flèche');
  });
  it('compatibleAmmo : Poudre noire ET Ingénierie acceptent les munitions « Poudre noire et ingénierie » (LDB 62 l.150)', () => {
    const c = { items: [itemFromTrapping('Balle et Poudre')] } as unknown as Combatant;
    const pistolet: Weapon = { name: 'Pistolet', type: 'ranged', damage: '+8', qualities: ['Pistolet'], subType: 'Poudre noire', reload: 1 };
    const arqRep: Weapon = { name: 'Arquebus à répétition', type: 'ranged', damage: '+9', qualities: [], subType: 'Ingénierie', reload: 5 };
    expect(compatibleAmmo(c, pistolet).map((a) => a.name)).toContain('Balle et Poudre');
    expect(compatibleAmmo(c, arqRep).map((a) => a.name)).toContain('Balle et Poudre');
  });
  it('recomputeLoadout dérive reload depuis « Recharge N » + subType', () => {
    const c = {
      items: [{ ...itemFromTrapping('Tromblon')!, equipped: true }],
      weapons: [],
      armour: emptyArmour(),
      characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
    } as unknown as Combatant;
    recomputeLoadout(c);
    const tromblon = c.weapons.find((w) => w.name === 'Tromblon')!;
    expect(tromblon.reload).toBe(2);
    expect(tromblon.subType).toBe('Poudre noire');
  });
  it('recomputeLoadout : Arc (sans « Recharge ») → reload 0', () => {
    const c = {
      items: [{ ...itemFromTrapping('Arc')!, equipped: true }],
      weapons: [],
      armour: emptyArmour(),
      characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
    } as unknown as Combatant;
    recomputeLoadout(c);
    const arc = c.weapons.find((w) => w.name === 'Arc')!;
    expect(arc.reload).toBe(0);
    expect(arc.subType).toBe('Arc');
  });
});

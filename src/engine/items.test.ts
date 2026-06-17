import { describe, it, expect } from 'vitest';
import { recomputeLoadout, totalEncumbrance, maxEncumbrance, itemFromTrapping, weaponWithAmmo, compatibleAmmo, emptyArmour, damageArmour, weaponHands, activeLoadout, ensureDefaultLoadout, unarmedWeapon, loadoutCreate, loadoutRename, loadoutDelete, loadoutSetActive, loadoutSetSlot, armourLayer, equipConflicts, isCapeItem, buildInventory } from './items';
import { Combatant, ItemInstance, Weapon } from './types';

const item = (o: Partial<ItemInstance>): ItemInstance =>
  ({ uid: 'u', name: 'x', kind: 'misc', qualities: [], enc: 0, equipped: false, ...o }) as ItemInstance;

describe('weaponHands (latéralité)', () => {
  const it_ = (p: Partial<ItemInstance>): ItemInstance =>
    ({ uid: 'w', name: 'X', kind: 'melee', qualities: [], enc: 0, equipped: false, ...p } as ItemInstance);

  it('`hands` posé fait foi', () => {
    expect(weaponHands(it_({ name: 'Hallebarde', subType: "Armes d'hast", hands: 2 }))).toBe(2);
    expect(weaponHands(it_({ name: 'Epee', subType: 'Base', hands: 1 }))).toBe(1);
  });
  it('fallback sans `hands` : marqueur (2M) dans le nom, ou Groupe Deux-mains', () => {
    expect(weaponHands(it_({ name: '(2M) Lance', subType: "Armes d'hast" }))).toBe(2);
    expect(weaponHands(it_({ name: 'Espadon', subType: 'Deux-mains' }))).toBe(2);
    expect(weaponHands(it_({ name: 'Epee', subType: 'Base' }))).toBe(1);
  });
  it('itemFromTrapping pose `hands` depuis le marqueur (2M) — mêlée ET distance', () => {
    expect(itemFromTrapping('Arc')?.hands).toBe(2);
    expect(itemFromTrapping('Arbalète de poing')?.hands).toBe(1);
    expect(itemFromTrapping('Pistolet')?.hands).toBe(1);
    expect(itemFromTrapping('Hallebarde')?.hands).toBe(2);
  });
  it('Poudre noire/Ingénierie classées par le marqueur canonique (LDB 62 « (2M) ») : arquebuses 2 mains, pistolets 1 main', () => {
    expect(itemFromTrapping('Arquebuse')?.hands).toBe(2);
    expect(itemFromTrapping('Tromblon')?.hands).toBe(2);
    expect(itemFromTrapping("Long fusil d'Hochland")?.hands).toBe(2);
    expect(itemFromTrapping('Pistolet à répétition')?.hands).toBe(1);
  });
});

describe('mutateurs de loadout (purs)', () => {
  const w = (uid: string, name: string, p: Partial<ItemInstance> = {}): ItemInstance =>
    ({ uid, name, kind: 'melee', qualities: [], enc: 1, equipped: true, hands: 1, ...p } as ItemInstance);
  const hero = (items: ItemInstance[]): Combatant =>
    ({ id: 'h', name: 'H', kind: 'hero', items, loadouts: [], activeLoadoutId: undefined } as unknown as Combatant);

  it('loadoutCreate ajoute un loadout vide et le rend actif', () => {
    const c = hero([w('e', 'Epee')]);
    const id = loadoutCreate(c, 'Test');
    const lo = c.loadouts!.find((l) => l.id === id)!;
    expect(lo.name).toBe('Test');
    expect(lo.main).toBeUndefined();
    expect(lo.off).toBeUndefined();
    expect(c.activeLoadoutId).toBe(id);
  });

  it('loadoutSetSlot pose une arme ; une arme 2 mains en main vide le slot off', () => {
    const c = hero([w('h2', 'Hallebarde', { hands: 2 }), w('b', 'Bouclier')]);
    const id = loadoutCreate(c, 'L');
    loadoutSetSlot(c, id, 'off', 'b');
    loadoutSetSlot(c, id, 'main', 'h2'); // 2 mains → off effacé
    const lo = c.loadouts!.find((l) => l.id === id)!;
    expect(lo.main).toBe('h2');
    expect(lo.off).toBeUndefined();
  });

  it('loadoutSetSlot(slot, null) vide le slot', () => {
    const c = hero([w('e', 'Epee')]);
    const id = loadoutCreate(c, 'L');
    loadoutSetSlot(c, id, 'main', 'e');
    loadoutSetSlot(c, id, 'main', null);
    expect(c.loadouts!.find((l) => l.id === id)!.main).toBeUndefined();
  });

  it('loadoutRename / loadoutSetActive (ignore un id invalide)', () => {
    const c = hero([w('e', 'Epee')]);
    const id = loadoutCreate(c, 'L');
    loadoutRename(c, id, 'Garde');
    expect(c.loadouts!.find((l) => l.id === id)!.name).toBe('Garde');
    loadoutCreate(c, 'L2');
    loadoutSetActive(c, id);
    expect(c.activeLoadoutId).toBe(id);
    loadoutSetActive(c, 'inconnu');
    expect(c.activeLoadoutId).toBe(id);
  });

  it('loadoutDelete : supprime ; si actif, bascule sur le 1er restant', () => {
    const c = hero([w('e', 'Epee')]);
    const a = loadoutCreate(c, 'A');
    const b = loadoutCreate(c, 'B'); // actif = b
    loadoutDelete(c, b);
    expect(c.loadouts!.map((l) => l.id)).toEqual([a]);
    expect(c.activeLoadoutId).toBe(a);
  });
});

describe('unarmedWeapon (Mains nues canoniques, LDB 62 l.75)', () => {
  it('dérivées du trapping : +BF+0, Personnelle, Inoffensive (pas +BF-2)', () => {
    const u = unarmedWeapon();
    expect(u.damage).toBe('+BF+0');
    expect(u.reach).toBe('Personnelle');
    expect(u.qualities).toContain('inoffensive'); // runtime = id de qualité (pas le libellé)
    expect(u.hand).toBe('main');
  });
});

describe('activeLoadout', () => {
  const base = (over: Partial<Combatant>): Combatant =>
    ({ id: 'h', name: 'H', kind: 'hero', items: [], ...over } as unknown as Combatant);

  it('aucun loadout → null (chemin legacy)', () => {
    expect(activeLoadout(base({}))).toBeNull();
  });
  it('renvoie le loadout actif par id', () => {
    const c = base({ loadouts: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], activeLoadoutId: 'b' });
    expect(activeLoadout(c)?.id).toBe('b');
  });
  it('id inconnu → 1er loadout (repli)', () => {
    const c = base({ loadouts: [{ id: 'a', name: 'A' }], activeLoadoutId: 'zzz' });
    expect(activeLoadout(c)?.id).toBe('a');
  });
});

describe('recomputeLoadout piloté par loadout', () => {
  const heroWith = (items: ItemInstance[], lo?: { loadouts: any[]; activeLoadoutId: string }): Combatant =>
    ({ id: 'h', name: 'H', kind: 'hero', characteristics: { F: 30, E: 30 } as any, items,
       talents: [], skills: [], conditions: [], wounds: { current: 10, max: 10 }, advantage: 0, ...lo } as unknown as Combatant);
  const w = (uid: string, name: string, p: Partial<ItemInstance> = {}): ItemInstance =>
    ({ uid, name, kind: 'melee', qualities: [], enc: 1, equipped: true, ...p } as ItemInstance);

  it('loadout 1 main + bouclier → 2 armes taguées main/off + Mains nues', () => {
    const epee = w('e', 'Epee', { subType: 'Base', hands: 1 });
    const bouc = w('b', 'Bouclier', { subType: 'Base', hands: 1, qualities: ['Défensive'] });
    const c = heroWith([epee, bouc], { loadouts: [{ id: 'l1', name: 'EB', main: 'e', off: 'b' }], activeLoadoutId: 'l1' });
    recomputeLoadout(c);
    expect(c.weapons.map((x) => [x.name, x.hand])).toEqual([
      ['Epee', 'main'], ['Bouclier', 'off'], ['Mains nues', 'main'],
    ]);
  });

  it('loadout arme 2 mains → slot off ignoré', () => {
    const halle = w('h', 'Hallebarde', { subType: "Armes d'hast", hands: 2 });
    const bouc = w('b', 'Bouclier', { subType: 'Base', hands: 1 });
    const c = heroWith([halle, bouc], { loadouts: [{ id: 'l', name: 'H', main: 'h', off: 'b' }], activeLoadoutId: 'l' });
    recomputeLoadout(c);
    expect(c.weapons.map((x) => x.name)).toEqual(['Hallebarde', 'Mains nues']);
  });

  it('auto-prune : un slot référençant une arme absente (vendue/transférée) est vidé', () => {
    const c = heroWith([w('e', 'Epee', { subType: 'Base', hands: 1 })], { loadouts: [{ id: 'l', name: 'L', main: 'e', off: 'disparu' }], activeLoadoutId: 'l' });
    recomputeLoadout(c);
    const lo = c.loadouts!.find((l) => l.id === 'l')!;
    expect(lo.main).toBe('e');
    expect(lo.off).toBeUndefined(); // 'disparu' nettoyé
  });

  it('sans loadout : recompute AUTO-GÉNÈRE un loadout par défaut (un seul modèle, plus de « toutes équipées »)', () => {
    const a = w('a', 'A', { subType: 'Base', hands: 1, damage: '+BF+4' });
    const b = w('b', 'B', { subType: 'Base', hands: 1, damage: '+BF' });
    const c = heroWith([a, b]);
    recomputeLoadout(c);
    expect((c.loadouts ?? []).length).toBeGreaterThanOrEqual(1); // loadout créé à la volée
    expect(c.weapons.map((x) => [x.name, x.hand])).toEqual([['A', 'main'], ['B', 'off'], ['Mains nues', 'main']]);
  });
});

describe('ensureDefaultLoadout', () => {
  const w = (uid: string, name: string, p: Partial<ItemInstance> = {}): ItemInstance =>
    ({ uid, name, kind: 'melee', qualities: [], enc: 1, equipped: true, damage: '+BF+4', ...p } as ItemInstance);
  const hero = (items: ItemInstance[]): Combatant =>
    ({ id: 'h', name: 'H', kind: 'hero', items } as unknown as Combatant);

  it('crée « Set I » = meilleure arme de mêlée en main, bouclier en secondaire', () => {
    const c = hero([
      w('e', 'Epee', { subType: 'Base', hands: 1, damage: '+BF+4' }),
      w('b', 'Bouclier', { subType: 'Base', hands: 1, damage: '+BF', qualities: ['Défensive'] }),
    ]);
    ensureDefaultLoadout(c);
    const lo = c.loadouts!.find((l) => l.name === 'Set I')!;
    expect(lo.main).toBe('e');
    expect(lo.off).toBe('b');
    expect(c.activeLoadoutId).toBe(lo.id);
  });

  it('crée TOUJOURS deux sets : « Set II » porte la 1re arme à distance (sinon vide)', () => {
    const c = hero([
      w('e', 'Epee', { subType: 'Base', hands: 1 }),
      w('arc', 'Arc', { kind: 'ranged', subType: 'Arc', hands: 2, equipped: true, damage: '+9' }),
    ]);
    ensureDefaultLoadout(c);
    expect(c.loadouts!.map((l) => l.name)).toEqual(['Set I', 'Set II']);
    expect(c.loadouts!.find((l) => l.name === 'Set II')!.main).toBe('arc');
    const soloMelee = hero([w('e', 'Epee', { subType: 'Base', hands: 1 })]);
    ensureDefaultLoadout(soloMelee);
    expect(soloMelee.loadouts!.map((l) => [l.name, l.main])).toEqual([['Set I', 'e'], ['Set II', undefined]]);
  });

  it('héros sans arme distance équipée : actif = Set I ; sans mêlée : actif = Set II', () => {
    const c = hero([w('arc', 'Arc', { kind: 'ranged', subType: 'Arc', hands: 2, equipped: true, damage: '+9' })]);
    ensureDefaultLoadout(c);
    expect(c.loadouts!.find((l) => l.id === c.activeLoadoutId)!.name).toBe('Set II');
  });

  it('idempotent : ne recrée pas si loadouts déjà présents', () => {
    const c = hero([w('e', 'Epee', { subType: 'Base', hands: 1 })]);
    c.loadouts = [{ id: 'x', name: 'Custom', main: 'e' }];
    c.activeLoadoutId = 'x';
    ensureDefaultLoadout(c);
    expect(c.loadouts).toHaveLength(1);
    expect(c.activeLoadoutId).toBe('x');
  });
});

describe('couches d’armure (LDB 63) — armourLayer / equipConflicts', () => {
  const hero = (items: ItemInstance[]): Combatant => ({ id: 'h', items } as unknown as Combatant);

  it('armourLayer lit la donnée réelle : Cuir souple / Flexible (Mailles) / rigide (Cuir bouilli, Plate)', () => {
    expect(armourLayer(itemFromTrapping('Justaucorps de cuir')!)).toBe('souple'); // subType Cuir souple (LDB 63 l.93)
    expect(armourLayer(itemFromTrapping('Chemise de mailles')!)).toBe('flexible'); // qualité Flexible (l.105-106)
    expect(armourLayer(itemFromTrapping('Plastron de cuir')!)).toBe('rigide'); // Cuir bouilli
    expect(armourLayer(itemFromTrapping('Plastron')!)).toBe('rigide'); // Plate
  });

  it('2 cuirs souples sur le Corps = conflit ; souple + maille + plate se superposent sans conflit', () => {
    const justau = { ...itemFromTrapping('Justaucorps de cuir')!, equipped: true };
    const veste = itemFromTrapping('Veste de cuir')!; // souple, Bras+Corps
    const maille = { ...itemFromTrapping('Chemise de mailles')!, equipped: true };
    const plastron = { ...itemFromTrapping('Plastron')!, equipped: true };
    const c = hero([justau, veste, maille, plastron]);
    expect(equipConflicts(c, veste).map((i) => i.name)).toEqual(['Justaucorps de cuir']); // même couche, loc commune
    expect(equipConflicts(c, justau)).toEqual([]); // déjà porté : maille/plate = autres couches
    expect(equipConflicts(c, maille)).toEqual([]);
    expect(equipConflicts(c, plastron)).toEqual([]);
  });

  it('pas de conflit sans localisation commune (calotte vs justaucorps, tous deux souples)', () => {
    const calotte = { ...itemFromTrapping('Calotte de cuir')!, equipped: true };
    const justau = itemFromTrapping('Justaucorps de cuir')!;
    expect(equipConflicts(hero([calotte, justau]), justau)).toEqual([]);
  });

  it('isCapeItem reconnaît Cape/Manteau (trappings sans stats) ; une seule cape portée', () => {
    const cape = { ...itemFromTrapping('Cape')!, equipped: true };
    const manteau = itemFromTrapping('Manteau')!;
    expect(isCapeItem(cape)).toBe(true);
    expect(isCapeItem(manteau)).toBe(true);
    expect(isCapeItem(itemFromTrapping('Justaucorps de cuir')!)).toBe(false);
    expect(equipConflicts(hero([cape, manteau]), manteau).map((i) => i.name)).toEqual(['Cape']);
  });

  it('buildInventory n’équipe qu’UNE pièce par couche × localisation (meilleure PA)', () => {
    const items = buildInventory(['Justaucorps de cuir', 'Veste de cuir', 'Chemise de mailles', 'Plastron']);
    const worn = items.filter((i) => i.equipped).map((i) => i.name).sort();
    // Justaucorps et Veste sont tous deux Cuir souple sur le Corps → une seule des deux portée.
    expect(worn).toContain('Chemise de mailles');
    expect(worn).toContain('Plastron');
    expect(worn.filter((n) => n === 'Justaucorps de cuir' || n === 'Veste de cuir')).toHaveLength(1);
  });
});

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
  it('amputation de main : arme à deux mains exclue de la dotation ; Merveille PORTÉE la rétablit (LDB 18 l.352 / 73)', () => {
    const c = {
      characteristics: { F: 30, E: 30 },
      traumas: [{ label: 'Main', location: 'brasD', ops: [{ op: 'maxWeaponHands', hands: 1 }], prosthesis: [{ name: "Merveille d'ingénierie", cancels: 'all' }], note: '' }],
      items: [item({ name: 'Espadon', kind: 'melee', damage: '+BF+5', subType: 'deux-mains', equipped: true })],
    } as unknown as Combatant;
    recomputeLoadout(c);
    expect(c.weapons.map((w) => w.name)).not.toContain('Espadon'); // pas d'arme à 2 mains avec une main amputée
    c.items!.push(item({ name: "Merveille d'ingénierie", subType: 'Prothèses', equipped: true }));
    recomputeLoadout(c);
    expect(c.weapons.map((w) => w.name)).toContain('Espadon'); // prothèse portée → arme à 2 mains de nouveau utilisable
  });
  it('Crochet porté (prothèse) fournit une arme « Dague » (+BF+2, LDB 73)', () => {
    const c = { characteristics: { F: 30, E: 30 }, items: [item({ name: 'Crochet', subType: 'Prothèses', equipped: true })] } as unknown as Combatant;
    recomputeLoadout(c);
    const cr = c.weapons.find((w) => w.name === 'Crochet');
    expect(cr?.damage).toBe('+BF+2');
  });
  it('amputation de main : loadout Arc (2 mains) exclu → Mains nues ; loadout Arbalète de poing (1 main) utilisable', () => {
    const c = {
      characteristics: { F: 30, E: 30 },
      traumas: [{ label: 'Main', location: 'brasD', ops: [{ op: 'maxWeaponHands', hands: 1 }], note: '' }],
      items: [
        item({ uid: 'arc', name: 'Arc long', kind: 'ranged', subType: 'Arc', hands: 2, equipped: true }),
        item({ uid: 'arb', name: 'Arbalète de poing', kind: 'ranged', subType: 'Arbalète', hands: 1, equipped: true }),
      ],
      loadouts: [{ id: 'larc', name: 'Arc', main: 'arc' }, { id: 'larb', name: 'Arbalète', main: 'arb' }],
      activeLoadoutId: 'larc',
    } as unknown as Combatant;
    recomputeLoadout(c);
    expect(c.weapons.map((w) => w.name)).toEqual(['Mains nues']); // Arc à 2 mains exclu par l'amputation
    c.activeLoadoutId = 'larb';
    recomputeLoadout(c);
    expect(c.weapons.map((w) => w.name)).toContain('Arbalète de poing'); // 1 main → utilisable
  });
  it('amputation de la main SECONDAIRE (brasG) : le bouclier (slot off) tombe ; l’arme directrice reste (LDB 18)', () => {
    const c = {
      characteristics: { F: 30, E: 30 },
      traumas: [{ label: 'Main', location: 'brasG', ops: [{ op: 'maxWeaponHands', hands: 1 }], note: '' }],
      items: [
        item({ uid: 'ep', name: 'Épée', kind: 'melee', damage: '+BF+4', equipped: true }),
        item({ uid: 'bo', name: 'Bouclier', kind: 'melee', damage: '+BF', qualities: ['Bouclier', 'Défensive'], equipped: true }),
      ],
      loadouts: [{ id: 'l1', name: 'Épée+Bouclier', main: 'ep', off: 'bo' }],
      activeLoadoutId: 'l1',
    } as unknown as Combatant;
    recomputeLoadout(c);
    expect(c.weapons.map((w) => w.name)).toContain('Épée');
    expect(c.weapons.map((w) => w.name)).not.toContain('Bouclier'); // main secondaire amputée → impossible de tenir le bouclier
  });
  it('amputation de la main DIRECTRICE (brasD) : arme directrice conservée (−20, adaptation) ; la 2e arme (slot off) tombe', () => {
    const c = {
      characteristics: { F: 30, E: 30 },
      traumas: [{ label: 'Main', location: 'brasD', ops: [{ op: 'maxWeaponHands', hands: 1 }], note: '' }],
      items: [
        item({ uid: 'ep', name: 'Épée', kind: 'melee', damage: '+BF+4', equipped: true }),
        item({ uid: 'da', name: 'Dague', kind: 'melee', damage: '+BF', equipped: true }),
      ],
      loadouts: [{ id: 'l1', name: 'Deux armes', main: 'ep', off: 'da' }],
      activeLoadoutId: 'l1',
    } as unknown as Combatant;
    recomputeLoadout(c);
    expect(c.weapons.map((w) => w.name)).toContain('Épée'); // conservée (il reste une main)
    expect(c.weapons.map((w) => w.name)).not.toContain('Dague'); // une seule main fonctionnelle → la 2e arme tombe
  });
  it('amputation des DEUX mains : Mains nues seulement', () => {
    const c = {
      characteristics: { F: 30, E: 30 },
      traumas: [
        { label: 'Main', location: 'brasD', ops: [{ op: 'maxWeaponHands', hands: 1 }], note: '' },
        { label: 'Main', location: 'brasG', ops: [{ op: 'maxWeaponHands', hands: 1 }], note: '' },
      ],
      items: [item({ uid: 'ep', name: 'Épée', kind: 'melee', damage: '+BF+4', equipped: true })],
      loadouts: [{ id: 'l1', name: 'X', main: 'ep' }],
      activeLoadoutId: 'l1',
    } as unknown as Combatant;
    recomputeLoadout(c);
    expect(c.weapons.map((w) => w.name)).toEqual(['Mains nues']);
  });
  it('auto-prune : un slot pointant vers une arme DÉTRUITE (Incident de Tir / usure) est vidé', () => {
    const c = {
      characteristics: { F: 30, E: 30 },
      items: [item({ uid: 'ep', name: 'Épée', kind: 'melee', damage: '+BF+4', equipped: true, destroyed: true })],
      loadouts: [{ id: 'l1', name: 'X', main: 'ep' }],
      activeLoadoutId: 'l1',
    } as unknown as Combatant;
    recomputeLoadout(c);
    expect(c.loadouts![0].main).toBeUndefined(); // slot vidé (l'arme détruite n'est plus tenable)
    expect(c.weapons.map((w) => w.name)).toEqual(['Mains nues']);
  });
  it('Merveille d’ingénierie (cancels all) sur la main secondaire amputée : le bouclier reste utilisable (LDB 73)', () => {
    const c = {
      characteristics: { F: 30, E: 30 },
      traumas: [{ label: 'Main', location: 'brasG', ops: [{ op: 'maxWeaponHands', hands: 1 }], prosthesis: [{ name: "Merveille d'ingénierie", cancels: 'all' }], note: '' }],
      items: [
        item({ uid: 'ep', name: 'Épée', kind: 'melee', damage: '+BF+4', equipped: true }),
        item({ uid: 'bo', name: 'Bouclier', kind: 'melee', damage: '+BF', qualities: ['Bouclier'], equipped: true }),
        item({ name: "Merveille d'ingénierie", subType: 'Prothèses', equipped: true }),
      ],
      loadouts: [{ id: 'l1', name: 'X', main: 'ep', off: 'bo' }],
      activeLoadoutId: 'l1',
    } as unknown as Combatant;
    recomputeLoadout(c);
    expect(c.weapons.map((w) => w.name)).toContain('Bouclier'); // prothèse « tout » → main rétablie, bouclier de nouveau tenu
  });
  it('prothèse PORTÉE = Enc 0 ; possédée mais non portée = son Enc (LDB 73)', () => {
    const worn = { items: [item({ name: 'Fausse jambe', subType: 'Prothèses', enc: 2, equipped: true })] } as unknown as Combatant;
    expect(totalEncumbrance(worn)).toBe(0);
    const carried = { items: [item({ name: 'Fausse jambe', subType: 'Prothèses', enc: 2, equipped: false })] } as unknown as Combatant;
    expect(totalEncumbrance(carried)).toBe(2);
  });
  it("maxEncumbrance = Bonus de Force + Bonus d'Endurance (LDB)", () => {
    expect(maxEncumbrance({ characteristics: { F: 35, E: 42 } } as unknown as Combatant)).toBe(3 + 4);
  });
  it('maxEncumbrance : +2 par niveau de Costaud (LDB talents)', () => {
    const c = { characteristics: { F: 30, E: 30 }, talents: [{ talentId: 'costaud', times: 1 }] } as unknown as Combatant;
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
    expect(fleche.qualities).toContain('empaleuse'); // runtime = id
  });
  it('weaponWithAmmo combine Dégâts (concaténés) et fusionne les Atouts', () => {
    const arc: Weapon = { name: 'Arc', type: 'ranged', damage: '+9', range: 60, qualities: [], subType: 'Arc', reload: 0 };
    const fleche = itemFromTrapping('Flèche')!;
    const w = weaponWithAmmo(arc, fleche);
    expect(w.qualities).toContain('empaleuse'); // runtime = id
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

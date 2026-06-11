import { describe, it, expect } from 'vitest';
import { migrateSceneEntity, migrateEntityKind } from './sceneMigrate';

describe('migrateEntityKind', () => {
  it('objet → prop, pnj/ennemi → personnage, le reste passe', () => {
    expect(migrateEntityKind('objet')).toBe('prop');
    expect(migrateEntityKind('pnj')).toBe('personnage');
    expect(migrateEntityKind('ennemi')).toBe('personnage');
    expect(migrateEntityKind('prop')).toBe('prop');
    expect(migrateEntityKind('heroStart')).toBe('heroStart');
    expect(migrateEntityKind('personnage')).toBe('personnage');
    expect(migrateEntityKind('zzz')).toBe('personnage');
  });
});

describe('migrateSceneEntity', () => {
  it('objet + search → prop interactif qui RESTE (consume false)', () => {
    const e = migrateSceneEntity({ id: 'a', kind: 'objet', pos: { x: 1, y: 1 }, search: [{ type: 'giveTrapping', trapping: 'Dague' }] });
    expect(e.kind).toBe('prop');
    expect(e.interact?.effects).toEqual([{ type: 'giveTrapping', trapping: 'Dague' }]);
    expect(e.interact?.consume).toBe(false);
    expect((e as any).search).toBeUndefined();
  });
  it('objet + loot → prop qui DISPARAÎT (consume true), loot→giveTrapping', () => {
    const e = migrateSceneEntity({ id: 'b', kind: 'objet', pos: { x: 0, y: 0 }, loot: ['Épée', 'Potion'] });
    expect(e.kind).toBe('prop');
    expect(e.interact?.consume).toBe(true);
    expect(e.interact?.effects).toEqual([{ type: 'giveTrapping', trapping: 'Épée' }, { type: 'giveTrapping', trapping: 'Potion' }]);
    expect((e as any).loot).toBeUndefined();
  });
  it('objet + loot ET search → effets concaténés (search d’abord), reste (consume false)', () => {
    const e = migrateSceneEntity({
      id: 'd',
      kind: 'objet',
      pos: { x: 2, y: 2 },
      search: [{ type: 'journal', text: 'Un corps.' }],
      loot: ['Bourse'],
    });
    expect(e.kind).toBe('prop');
    expect(e.interact?.effects).toEqual([{ type: 'journal', text: 'Un corps.' }, { type: 'giveTrapping', trapping: 'Bourse' }]);
    expect(e.interact?.consume).toBe(false); // search présent → reste
  });
  it('décor pur (prop sans loot/search) → pas d’interact', () => {
    const e = migrateSceneEntity({ id: 'c', kind: 'prop', pos: { x: 0, y: 0 }, ref: 'tonneau' });
    expect(e.interact).toBeUndefined();
    expect(e.ref).toBe('tonneau');
  });
  it('préserve les autres champs (label, ref, facing, foot)', () => {
    const e = migrateSceneEntity({ id: 'e', kind: 'prop', pos: { x: 3, y: 3 }, label: 'Charrette', ref: 'charrette', facing: 'N', foot: { w: 2, h: 1 } });
    expect(e.label).toBe('Charrette');
    expect(e.ref).toBe('charrette');
    expect(e.facing).toBe('N');
    expect(e.foot).toEqual({ w: 2, h: 1 });
  });
});

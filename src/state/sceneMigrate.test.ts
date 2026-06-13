import { describe, it, expect } from 'vitest';
import { migrateSceneEntity, migrateEntityKind, migrateEncounters } from './sceneMigrate';
import type { Scene } from './scene';

const blank = (over: Partial<Scene> = {}): Scene => ({
  id: 's', nom: 's', description: '', dimensions: { w: 10, h: 10 }, tiles: [], entities: [],
  dialogues: [], triggers: [], encounters: [], flags: {}, entryPoints: {}, ...over,
});

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

describe('migrateEncounters — fusion ennemis legacy → entités cachées + membres', () => {
  it('un ennemi inline devient une entité cachée + un membre qui la référence', () => {
    const s = migrateEncounters(blank({
      encounters: [{ id: 'enc-1', enemies: [{ ref: 'Mutant', pos: { x: 2, y: 3 }, weapon: 'Hache', optionals: ['Peur 1'], spells: ['Fléchette'], randomChars: true }] }],
    }));
    expect(s.encounters[0].enemies).toBeUndefined(); // legacy retiré
    const m = s.encounters[0].members![0];
    expect(m.entityId).toBe('enemy-enc-1-0');
    const ent = s.entities.find((e) => e.id === 'enemy-enc-1-0')!;
    expect(ent.kind).toBe('personnage');
    expect(ent.pos).toEqual({ x: 2, y: 3 });
    expect(ent.ref).toBe('Mutant');
    expect(ent.weapon).toBe('Hache');
    expect(ent.combat).toEqual({ hiddenUntilCombat: true, optionals: ['Peur 1'], spells: ['Fléchette'], randomChars: true });
  });

  it('idempotent : une rencontre déjà en `members` passe inchangée', () => {
    const already = blank({
      entities: [{ id: 'x', kind: 'personnage', pos: { x: 1, y: 1 } }],
      encounters: [{ id: 'enc-1', members: [{ entityId: 'x' }] }],
    });
    expect(migrateEncounters(already)).toEqual(already);
    // double passage = stable
    expect(migrateEncounters(migrateEncounters(already))).toEqual(already);
  });

  it('camp/monture préservés ; rides (index) → ridesEntityId (réf stable)', () => {
    const s = migrateEncounters(blank({
      encounters: [{ id: 'e', enemies: [
        { ref: 'Cheval', pos: { x: 0, y: 0 }, mount: true, side: 'ally' },
        { ref: 'Bandit', pos: { x: 0, y: 0 }, rides: 0 },
      ] }],
    }));
    const [cheval, bandit] = s.encounters[0].members!;
    expect(cheval).toEqual({ entityId: 'enemy-e-0', side: 'ally', mount: true });
    expect(bandit).toEqual({ entityId: 'enemy-e-1', ridesEntityId: 'enemy-e-0' });
  });

  it('migrateEncounters double-pass = idempotent sur du legacy (la 2ᵉ passe ne re-convertit pas)', () => {
    const once = migrateEncounters(blank({ encounters: [{ id: 'e', enemies: [{ ref: 'Mutant', pos: { x: 1, y: 1 } }] }] }));
    expect(migrateEncounters(once)).toEqual(once);
  });
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { rosterLoad, rosterAdd, rosterRemove, rosterUpdate, rosterExport, rosterImport, RosterEntry } from './roster';
import { Combatant } from '../engine/types';

/** Fake Storage minimal — l'environnement de test est `node` (pas de localStorage). */
function fakeStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
  } as Storage;
}

const hero = (id: string, label = 'Héros'): Combatant => ({ id, label, kind: 'hero' }) as unknown as Combatant;
const entry = (id: string): RosterEntry => ({
  hero: hero(id),
  wealth: { gold: 1, silver: 2, brass: 3 },
});

describe('roster — persistance des personnages créés', () => {
  beforeEach(() => {
    (globalThis as { localStorage?: Storage }).localStorage = fakeStorage();
  });
  afterEach(() => {
    delete (globalThis as { localStorage?: Storage }).localStorage;
  });

  it('vide au départ', () => {
    expect(rosterLoad()).toEqual([]);
  });

  it('rosterAdd puis rosterLoad : le personnage et sa richesse initiale sont retrouvés', () => {
    rosterAdd(entry('h1'));
    const list = rosterLoad();
    expect(list).toHaveLength(1);
    expect(list[0].hero.id).toBe('h1');
    expect(list[0].wealth).toEqual({ gold: 1, silver: 2, brass: 3 });
  });

  it('rosterAdd avec le même hero.id remplace (pas de doublon)', () => {
    rosterAdd(entry('h1'));
    rosterAdd({ hero: hero('h1', 'Renommé'), wealth: { gold: 0, silver: 0, brass: 9 } });
    const list = rosterLoad();
    expect(list).toHaveLength(1);
    expect(list[0].hero.label).toBe('Renommé');
    expect(list[0].wealth.brass).toBe(9);
  });

  it('rosterRemove retire l’entrée visée et garde les autres', () => {
    rosterAdd(entry('h1'));
    rosterAdd(entry('h2'));
    rosterRemove('h1');
    const list = rosterLoad();
    expect(list).toHaveLength(1);
    expect(list[0].hero.id).toBe('h2');
  });

  it('stockage corrompu (JSON invalide ou pas un tableau) → []', () => {
    localStorage.setItem('wfrp4.roster.v1', '{pas du json');
    expect(rosterLoad()).toEqual([]);
    localStorage.setItem('wfrp4.roster.v1', '{"a":1}');
    expect(rosterLoad()).toEqual([]);
  });

  it('entrées invalides filtrées au chargement', () => {
    localStorage.setItem(
      'wfrp4.roster.v1',
      JSON.stringify([null, 42, { hero: { id: 'ok', name: 'X' }, wealth: { gold: 0, silver: 0, brass: 0 } }, { hero: {} }]),
    );
    const list = rosterLoad();
    expect(list).toHaveLength(1);
    expect(list[0].hero.id).toBe('ok');
  });

  it('rosterLoad rejoue la migration name→label (#604) sur une entrée ANCIEN FORMAT (kind présent)', () => {
    localStorage.setItem(
      'wfrp4.roster.v1',
      JSON.stringify([
        { hero: { id: 'legacy1', name: 'Ancien Nom', kind: 'hero' }, wealth: { gold: 0, silver: 0, brass: 0 } },
      ]),
    );
    const list = rosterLoad();
    expect(list).toHaveLength(1);
    expect(list[0].hero.label).toBe('Ancien Nom');
    expect((list[0].hero as unknown as { name?: string }).name).toBeUndefined();
  });

  it('rosterLoad rejoue la migration name→label (#608 Lot B) sur un `draft` ANCIEN FORMAT (speciesId+careerId présents)', () => {
    localStorage.setItem(
      'wfrp4.roster.v1',
      JSON.stringify([
        {
          hero: { id: 'legacy2', label: 'Déjà migré', kind: 'hero' },
          wealth: { gold: 0, silver: 0, brass: 0 },
          draft: { speciesId: 'humain', careerId: 'soldat', name: 'Ancien Nom Draft' },
        },
      ]),
    );
    const list = rosterLoad();
    expect(list).toHaveLength(1);
    expect(list[0].draft?.label).toBe('Ancien Nom Draft');
    expect((list[0].draft as unknown as { name?: string })?.name).toBeUndefined();
  });

  it('sans localStorage (environnement sans stockage) : load → [], add/remove ne jettent pas', () => {
    delete (globalThis as { localStorage?: Storage }).localStorage;
    expect(rosterLoad()).toEqual([]);
    expect(() => rosterAdd(entry('h1'))).not.toThrow();
    expect(() => rosterRemove('h1')).not.toThrow();
  });

  it('rosterUpdate : met à jour le héros présent (bio propagée), sans doublon', () => {
    rosterAdd(entry('h1'));
    const edited = { id: 'h1', name: 'Héros', motivation: 'Foi', details: { ambitionShort: 'Survivre', ambitionLong: 'Régner' } } as unknown as Combatant;
    rosterUpdate(edited);
    const list = rosterLoad();
    expect(list).toHaveLength(1);
    expect(list[0].hero.motivation).toBe('Foi');
    expect(list[0].hero.details?.ambitionShort).toBe('Survivre');
    expect(list[0].hero.details?.ambitionLong).toBe('Régner');
  });

  it('rosterUpdate : N’AJOUTE PAS un héros absent du roster (prétiré édité)', () => {
    rosterAdd(entry('h1'));
    rosterUpdate(hero('absent'));
    const list = rosterLoad();
    expect(list).toHaveLength(1);
    expect(list[0].hero.id).toBe('h1');
  });
});

describe('roster — export / import (portabilité, versionné via migrateDoc)', () => {
  it('round-trip v1 valide → entry restituée', () => {
    const back = rosterImport(rosterExport(entry('h1')));
    expect(back.entry).toBeDefined();
    expect(back.entry!.hero.id).toBe('h1');
    expect(back.entry!.wealth).toEqual({ gold: 1, silver: 2, brass: 3 });
  });

  it('richesse par défaut (0) si absente (mais kind/v présents)', () => {
    const str = JSON.stringify({ kind: 'wfrp4-hero', v: 1, hero: { id: 'h3', name: 'X' } });
    expect(rosterImport(str).entry?.wealth).toEqual({ gold: 0, silver: 0, brass: 0 });
  });

  it('sans version/kind (RosterEntry nu) → message explicite, jamais un import silencieux', () => {
    const res = rosterImport(JSON.stringify(entry('h2')));
    expect(res.entry).toBeUndefined();
    expect(res.error).toBeTruthy();
  });

  it('version future/inconnue (v99) → message explicite', () => {
    const res = rosterImport(JSON.stringify({ kind: 'wfrp4-hero', v: 99, hero: { id: 'h4' } }));
    expect(res.entry).toBeUndefined();
    expect(res.error).toBeTruthy();
  });

  it('kind différent → message explicite', () => {
    const res = rosterImport(JSON.stringify({ kind: 'autre-chose', v: 1, hero: { id: 'h5' } }));
    expect(res.entry).toBeUndefined();
    expect(res.error).toBeTruthy();
  });

  it('erreur (JSON invalide ou hero.id manquant/non-chaîne) → message explicite, jamais null muet', () => {
    expect(rosterImport('pas du json').error).toBeTruthy();
    expect(rosterImport('{}').error).toBeTruthy();
    expect(rosterImport(JSON.stringify({ kind: 'wfrp4-hero', v: 1, hero: {} })).error).toBeTruthy();
    expect(rosterImport(JSON.stringify({ kind: 'wfrp4-hero', v: 1, hero: { id: 42 } })).error).toBeTruthy();
  });
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { rosterLoad, rosterAdd, rosterRemove, rosterExport, rosterImport, RosterEntry } from './roster';
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

const hero = (id: string, name = 'Héros'): Combatant => ({ id, name }) as unknown as Combatant;
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
    expect(list[0].hero.name).toBe('Renommé');
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

  it('sans localStorage (environnement sans stockage) : load → [], add/remove ne jettent pas', () => {
    delete (globalThis as { localStorage?: Storage }).localStorage;
    expect(rosterLoad()).toEqual([]);
    expect(() => rosterAdd(entry('h1'))).not.toThrow();
    expect(() => rosterRemove('h1')).not.toThrow();
  });
});

describe('roster — export / import (portabilité)', () => {
  it('round-trip préserve héros + richesse', () => {
    const back = rosterImport(rosterExport(entry('h1')));
    expect(back).not.toBeNull();
    expect(back!.hero.id).toBe('h1');
    expect(back!.wealth).toEqual({ gold: 1, silver: 2, brass: 3 });
  });

  it('accepte un RosterEntry nu (sans tag kind/v)', () => {
    expect(rosterImport(JSON.stringify(entry('h2')))?.hero.id).toBe('h2');
  });

  it('richesse par défaut (0) si absente', () => {
    expect(rosterImport(JSON.stringify({ hero: { id: 'h3', name: 'X' } }))?.wealth).toEqual({ gold: 0, silver: 0, brass: 0 });
  });

  it('null sur JSON invalide ou hero.id manquant/non-chaîne', () => {
    expect(rosterImport('pas du json')).toBeNull();
    expect(rosterImport('{}')).toBeNull();
    expect(rosterImport(JSON.stringify({ hero: {} }))).toBeNull();
    expect(rosterImport(JSON.stringify({ hero: { id: 42 } }))).toBeNull();
  });
});

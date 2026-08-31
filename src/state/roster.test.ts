import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { rosterLoad, rosterAdd, rosterRemove, rosterUpdate, rosterExport, rosterImport, RosterEntry } from './roster';
import { Combatant } from '../engine/types';
import { skillBaseValue } from '../engine/skills';

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

/** Le lot L2 #1548 renomme `SkillInstance.skillId` → `id` (`engine/types.ts`). Le roster persiste des
 *  `SkillInstance` par DEUX canaux — l'export versionné (`EXPORT_VERSION`) et la liste localStorage nue.
 *  `skillBaseValue` (`engine/skills.ts:153`) ne lit QUE `s.id` : sans remap aux deux canaux, un héros
 *  d'avant le lot repart avec ses Compétences muettes (Caractéristique nue, Augmentations perdues) sans
 *  qu'aucun type ne bronche. Le roster ne se PURGE pas pour autant (l'arbitrage 2026-08-17 est borné aux
 *  saves — `migrateDoc.ts` interdit nommément la purge du roster par imitation) : il MIGRE, comme #311
 *  et #604 avant lui. Témoin : Résistance (Endurance), Endurance 35 + 20 Augmentations = 55. */
describe('roster — remap `skillId`→`id` des Compétences persistées (#1548 L2, les DEUX canaux)', () => {
  const ancienHero = (id: string) => ({
    id,
    label: 'Vétéran d’avant le lot',
    kind: 'hero',
    characteristics: { endurance: 35 },
    skills: [{ skillId: 'resistance', characteristic: 'endurance', advances: 20 }],
    talents: [],
  });

  beforeEach(() => {
    (globalThis as { localStorage?: Storage }).localStorage = fakeStorage();
  });
  afterEach(() => {
    delete (globalThis as { localStorage?: Storage }).localStorage;
  });

  it('(a) un export à l’ANCIENNE graphie CHARGE avec ses Augmentations vivantes — jamais des Compétences muettes', () => {
    const str = JSON.stringify({ kind: 'wfrp4-hero', v: 3, hero: ancienHero('h-export'), wealth: { gold: 0, silver: 0, brass: 0 } });
    const res = rosterImport(str);
    expect(res.error).toBeUndefined();
    const skills = res.entry!.hero.skills as unknown as Record<string, unknown>[];
    expect(skills[0].id).toBe('resistance');
    expect('skillId' in skills[0]).toBe(false); // la graphie morte ne survit pas au remap
    expect(skillBaseValue(res.entry!.hero, 'resistance')).toBe(55); // 35 + 20, jamais 35 muet
  });

  it('(b) une entrée localStorage d’AVANT le lot est remappée à la lecture, les entrées saines intactes', () => {
    const saine = {
      id: 'h-saine',
      label: 'Déjà migré',
      kind: 'hero',
      characteristics: { endurance: 30 },
      skills: [{ id: 'resistance', characteristic: 'endurance', advances: 5 }],
      talents: [],
    };
    localStorage.setItem(
      'wfrp4.roster.v1',
      JSON.stringify([
        { hero: ancienHero('h-prelot'), wealth: { gold: 0, silver: 0, brass: 0 } },
        { hero: saine, wealth: { gold: 1, silver: 0, brass: 0 } },
      ]),
    );
    const list = rosterLoad();
    expect(list.map((e) => e.hero.id)).toEqual(['h-prelot', 'h-saine']); // aucune purge : les deux survivent
    expect(skillBaseValue(list[0].hero, 'resistance')).toBe(55); // remappée
    expect(skillBaseValue(list[1].hero, 'resistance')).toBe(35); // 30 + 5, intacte (le remap est un no-op)
    expect(list[1].wealth).toEqual({ gold: 1, silver: 0, brass: 0 });
  });

  it('le remap est IDEMPOTENT : une 2ᵉ lecture ne change plus rien (et `id` prime si les deux graphies traînent)', () => {
    const deuxGraphies = { ...ancienHero('h-deux'), id: 'h-deux', skills: [{ id: 'resistance', skillId: 'perime', characteristic: 'endurance', advances: 20 }] };
    localStorage.setItem('wfrp4.roster.v1', JSON.stringify([{ hero: deuxGraphies, wealth: { gold: 0, silver: 0, brass: 0 } }]));
    const un = rosterLoad();
    expect((un[0].hero.skills as unknown as Record<string, unknown>[])[0]).toEqual({ id: 'resistance', characteristic: 'endurance', advances: 20 });
    rosterAdd(un[0]); // ré-écrit puis relit : 2e passage
    expect(rosterLoad()[0].hero.skills).toEqual(un[0].hero.skills);
  });
});

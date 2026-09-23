/**
 * GARDE — `PROJECT_MIGRATIONS[12]` : un projet AUTHORÉ AVANT #1897 se charge encore.
 *
 * QUESTION : `narratif.presetsPnj[].profil` reprend le def créature, dont `spells` adopte
 * `refs('spell')` — la référence de sort passe de `{ id }` à l'id NU. Un `.json` exporté avant ce lot,
 * resté dans une bibliothèque utilisateur, ressort-il avec les sorts de ses PNJ ?
 *
 * FIXTURE GELÉE : le document ci-dessous porte la forme `schema: 12` — un preset dont le profil liste
 * ses sorts en `{ id }`, un autre qui les liste déjà nus. Il est FIGÉ ; le « moderniser » détruirait ce
 * que la garde mesure.
 */
import { describe, expect, it } from 'vitest';
import { parseProject, CURRENT_PROJECT_SCHEMA, PROJECT_MIGRATIONS } from './worldMap';
import { DEFAULT_RELIEF_DEFAULTS, DEFAULT_ROOF_DEFAULTS } from './scene';

/** Document schema 12 — FIGÉ. Ne pas dénuder `sorcier` : c'est le sujet de la mesure. */
const PROJET_FORMAT_12 = {
  type: 'projet',
  schema: 12,
  id: 'campagne-gelee-12',
  label: 'Campagne gelée (format 12)',
  versionContenu: 1,
  maison: 'fixture de test — aucun livre ne la publie',
  narratif: {
    affaires: [],
    indices: [],
    presetsPnj: [
      { id: 'sorcier', base: 'squelette', profil: { spells: [{ id: 'flechette' }, { id: 'alarme' }] } },
      { id: 'deja-nu', base: 'squelette', profil: { spells: ['flechette'] } },
    ],
    objets: [],
  },
  scenes: [
    {
      type: 'scene',
      id: 'quai',
      label: 'Le quai',
      dimensions: { w: 1, h: 1 },
      reliefDefaults: { ...DEFAULT_RELIEF_DEFAULTS },
      roofDefaults: { ...DEFAULT_ROOF_DEFAULTS },
      layers: [{ z: 0, tiles: ['herbe'] }],
      entities: [],
    },
  ],
};

const presetsMigrés = () => parseProject(structuredClone(PROJET_FORMAT_12)).narratif.presetsPnj;

describe('PROJECT_MIGRATIONS[12] — un projet format 12 se charge à travers la migration (#1897)', () => {
  it('le document gelé est bien au format ANTÉRIEUR (sans quoi la garde ne mesurerait rien)', () => {
    expect(PROJET_FORMAT_12.schema).toBe(12);
    expect(PROJET_FORMAT_12.schema).toBeLessThan(CURRENT_PROJECT_SCHEMA);
    expect(PROJET_FORMAT_12.narratif.presetsPnj[0].profil.spells[0]).toEqual({ id: 'flechette' });
  });

  it('les sorts `{ id }` d’un preset ressortent en ids NUS, dans leur ORDRE', () => {
    expect(presetsMigrés()[0].profil?.spells).toEqual(['flechette', 'alarme']);
  });

  it('un preset dont les sorts sont DÉJÀ nus traverse INTACT', () => {
    expect(presetsMigrés()[1].profil?.spells).toEqual(['flechette']);
  });

  it('IDEMPOTENT : rejoué sur sa propre sortie, le migrateur ne change plus rien', () => {
    const une = PROJECT_MIGRATIONS[12]!({ ...structuredClone(PROJET_FORMAT_12), version: 12 } as never);
    const deux = PROJECT_MIGRATIONS[12]!({ ...structuredClone(une), version: 12 } as never);
    expect(JSON.stringify(deux)).toBe(JSON.stringify(une));
  });

  it('SANS le migrateur, le sort `{ id }` serait REFUSÉ au parse', () => {
    const bricole = { ...structuredClone(PROJET_FORMAT_12), schema: CURRENT_PROJECT_SCHEMA };
    expect(() => parseProject(bricole)).toThrow(/spells/);
  });

  it('un id de sort MORT n’est pas du ressort de la migration : le schéma le NOMME', () => {
    const mort = structuredClone(PROJET_FORMAT_12);
    mort.narratif.presetsPnj[0].profil.spells = [{ id: 'zzz-disparu' }];
    expect(() => parseProject(mort)).toThrow(/ref\('spell'\) : id « zzz-disparu » absent de spells\.json/);
  });
});

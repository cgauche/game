/**
 * Génération de noms à la création (Jalon 3). Pools : `src/data/names.json` (banque de noms par
 * race et par sexe, projet WarhammerV2 de l'utilisateur). Structure par espèce : « Prénom + Nom »
 * pour tous, SAUF les Nains dont le nom de famille est GÉNÉRÉ selon le canon — parent + suffixe
 * sexué (LDB 05 l.620-624 : « –sson » fils de…, « –sdottir » fille de…, « –snev »/« –sniz »).
 */
import { describe, it, expect } from 'vitest';
import { makeRNG } from './dice';
import { generateName, NAIN_SUFFIXES } from './names';
import { names as N } from '../data';
const startsWithOne = (name: string, pool: string[]) => pool.some((p) => name.startsWith(p + ' '));
const endsWithOne = (name: string, pool: string[]) => pool.some((p) => name.endsWith(' ' + p));

describe('generateName — banque names.json + canon nain (LDB 05 l.622)', () => {
  it('Humain : « Prénom Famille », prénom du pool du SEXE', () => {
    for (let s = 1; s <= 25; s++) {
      const m = generateName('Humains (Reiklander)', 'M', makeRNG(s))!;
      expect(startsWithOne(m, N.Humain.maleFirstNames), m).toBe(true);
      expect(endsWithOne(m, N.Humain.lastNames), m).toBe(true);
      const f = generateName('Humains (Middenheim)', 'F', makeRNG(s))!;
      expect(startsWithOne(f, N.Humain.femaleFirstNames), f).toBe(true);
    }
  });

  it('Nain : famille = parent + suffixe SEXUÉ (l.622), jamais le pool (vide)', () => {
    for (let s = 1; s <= 25; s++) {
      const m = generateName('Nains', 'M', makeRNG(s))!;
      expect(startsWithOne(m, N.Nain.maleFirstNames), m).toBe(true);
      expect(m).toMatch(/(sson|snev)$/);
      const f = generateName('Nains (Norse)', 'F', makeRNG(s))!;
      expect(startsWithOne(f, N.Nain.femaleFirstNames), f).toBe(true);
      expect(f).toMatch(/(sdottir|sniz)$/);
    }
  });

  it('le parent du patronyme nain vient du pool de prénoms nains (mono-mot)', () => {
    const m = generateName('Nains', 'M', makeRNG(7))!;
    const fam = m.slice(m.lastIndexOf(' ') + 1);
    const suffix = NAIN_SUFFIXES.M.find((sf) => fam.endsWith(sf))!;
    const parent = fam.slice(0, -suffix.length);
    expect([...N.Nain.maleFirstNames, ...N.Nain.femaleFirstNames]).toContain(parent);
  });

  it('Elfes : prénom du pool de la lignée + épithète (lastNames)', () => {
    const he = generateName('Hauts elfes', 'M', makeRNG(3))!;
    expect(startsWithOne(he, N['Haut Elfe'].maleFirstNames), he).toBe(true);
    expect(endsWithOne(he, N['Haut Elfe'].lastNames), he).toBe(true);
    const es = generateName('Elfes sylvains', 'F', makeRNG(3))!;
    expect(startsWithOne(es, N['Elfe Sylvain'].femaleFirstNames), es).toBe(true);
    expect(endsWithOne(es, N['Elfe Sylvain'].lastNames), es).toBe(true);
  });

  it('TOUTES les espèces jouables de species.json produisent un nom (M et F)', () => {
    for (const label of ['Humains (Tiléens)', 'Halflings (Piedfoin)', 'Nains (Cragforge Clan)', 'Gnomes', 'Ogres', 'Hauts elfes', 'Elfes sylvains']) {
      for (const sex of ['M', 'F'] as const) {
        const n = generateName(label, sex, makeRNG(11));
        expect(n, `${label} ${sex}`).toBeTruthy();
        expect(n!.split(' ').length).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('déterministe à graine égale, varie avec la graine', () => {
    expect(generateName('Nains', 'F', makeRNG(42))).toBe(generateName('Nains', 'F', makeRNG(42)));
    const set = new Set(Array.from({ length: 12 }, (_, i) => generateName('Humains (Reiklander)', 'M', makeRNG(i + 1))));
    expect(set.size).toBeGreaterThan(6); // banque large → très peu de collisions sur 12 tirages
  });
});

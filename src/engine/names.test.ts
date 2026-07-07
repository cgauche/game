/**
 * Génération de noms à la création (Jalon 3). Pools : `src/data/names.json` (banque de noms par
 * race et par sexe, projet WarhammerV2 de l'utilisateur). Structure par espèce : « Prénom + Nom »
 * pour tous, SAUF les Nains dont le nom de famille est GÉNÉRÉ selon le canon — parent + suffixe
 * sexué (LDB 05 l.620-624 : « –sson » fils de…, « –sdottir » fille de…, « –snev »/« –sniz »).
 */
import { describe, it, expect } from 'vitest';
import { makeRNG } from './dice';
import { generateName } from './names';
import { names as N } from '../data';
import speciesJson from '../data/species.json';
const startsWithOne = (name: string, pool: string[]) => pool.some((p) => name.startsWith(p + ' '));
const endsWithOne = (name: string, pool: string[]) => pool.some((p) => name.endsWith(' ' + p));

// generateName est keyé par `species.refChar` (clé de names.json) — jamais par le libellé.
describe('generateName — banque names.json + canon nain (LDB 05 l.622)', () => {
  it('Humain : « Prénom Famille », prénom du pool du SEXE', () => {
    for (let s = 1; s <= 25; s++) {
      const m = generateName('Humain', 'M', makeRNG(s))!;
      expect(startsWithOne(m, N.Humain.maleFirstNames), m).toBe(true);
      expect(endsWithOne(m, N.Humain.lastNames), m).toBe(true);
      const f = generateName('Humain', 'F', makeRNG(s))!;
      expect(startsWithOne(f, N.Humain.femaleFirstNames), f).toBe(true);
    }
  });

  it('Nain : famille = parent + suffixe SEXUÉ (l.622), jamais le pool (vide)', () => {
    for (let s = 1; s <= 25; s++) {
      const m = generateName('Nain', 'M', makeRNG(s))!;
      expect(startsWithOne(m, N.Nain.maleFirstNames), m).toBe(true);
      expect(m).toMatch(/(sson|snev)$/);
      const f = generateName('Nain', 'F', makeRNG(s))!;
      expect(startsWithOne(f, N.Nain.femaleFirstNames), f).toBe(true);
      expect(f).toMatch(/(sdottir|sniz)$/);
    }
  });

  it('le parent du patronyme nain vient du pool de prénoms nains (mono-mot)', () => {
    const m = generateName('Nain', 'M', makeRNG(7))!;
    const fam = m.slice(m.lastIndexOf(' ') + 1);
    const suffix = N.Nain.lastNameSuffixes!.M.find((sf) => fam.endsWith(sf))!;
    const parent = fam.slice(0, -suffix.length);
    expect([...N.Nain.maleFirstNames, ...N.Nain.femaleFirstNames]).toContain(parent);
  });

  it('Elfes : prénom du pool de la lignée + épithète (lastNames) — clés divergentes (espace)', () => {
    const he = generateName('Haut Elfe', 'M', makeRNG(3))!;
    expect(startsWithOne(he, N['Haut Elfe'].maleFirstNames), he).toBe(true);
    expect(endsWithOne(he, N['Haut Elfe'].lastNames), he).toBe(true);
    const es = generateName('Elfe Sylvain', 'F', makeRNG(3))!;
    expect(startsWithOne(es, N['Elfe Sylvain'].femaleFirstNames), es).toBe(true);
    expect(endsWithOne(es, N['Elfe Sylvain'].lastNames), es).toBe(true);
  });

  it('CHAQUE species de species.json résout son pool (via refChar) et produit un nom (M et F)', () => {
    // Preuve du routage par refChar : on parcourt les VRAIES espèces (variantes régionales et
    // elfes inclus — dont les refChar divergent par l'espace : « Haut Elfe », « Elfe Sylvain »).
    const species = speciesJson as { label: string; refChar: string }[];
    for (const sp of species) {
      expect(N[sp.refChar], `${sp.label} → refChar ${JSON.stringify(sp.refChar)} absent de names.json`).toBeTruthy();
      for (const sex of ['M', 'F'] as const) {
        const n = generateName(sp.refChar, sex, makeRNG(11));
        expect(n, `${sp.label} (${sp.refChar}) ${sex}`).toBeTruthy();
        expect(n!.split(' ').length).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('déterministe à graine égale, varie avec la graine', () => {
    expect(generateName('Nain', 'F', makeRNG(42))).toBe(generateName('Nain', 'F', makeRNG(42)));
    const set = new Set(Array.from({ length: 12 }, (_, i) => generateName('Humain', 'M', makeRNG(i + 1))));
    expect(set.size).toBeGreaterThan(6); // banque large → très peu de collisions sur 12 tirages
  });
});

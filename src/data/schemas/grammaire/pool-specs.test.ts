/**
 * CONTRAT DE DONNÉE du pool de spécialisations (#1466 L1a) — ce que `SPECS_PAR_DATASET`
 * (`npm run gen`) expose doit être CE QUE L'APPLICATION RÉSOUT, et la donnée authorée doit y tenir.
 *
 * Deux verrous, tous deux mesurés sur les données réelles du dépôt :
 *  1. le miroir outillage `POOLS_DERIVES` (`scripts/gen-registry.mjs`) et le catalogue applicatif
 *     `SPEC_SOURCES`/`specCatalogOf` (`src/data/index.ts`) rendent le MÊME pool, source par source ;
 *  2. toute spécialisation AUTHORÉE sur une entrée à pool DÉRIVÉ d'un type à pool FERMÉ appartient au
 *     pool exposé — donc passe `specRef`. Sans la résolution de `specsSource` au générateur, ces
 *     entrées ont un pool VIDE et 34 spécialisations réelles sont rejetées au parse.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { SPECS_PAR_DATASET } from '../_ids.generated';
import { specRef } from './ref';
import { skills, talents, traits, specCatalogOf } from '../../index';

const DATASETS: { fichier: string; entrees: { id: string; specsSource?: string }[]; ferme: boolean }[] = [
  { fichier: 'skills.json', entrees: skills as never, ferme: false },
  { fichier: 'talents.json', entrees: talents as never, ferme: true },
  { fichier: 'traits.json', entrees: traits as never, ferme: true },
];

describe('pool de spécialisations — le registre généré et le catalogue applicatif s’accordent', () => {
  it('rend le MÊME pool que `specCatalogOf` pour CHAQUE entrée à `specsSource`', () => {
    const vus = new Set<string>();
    let compares = 0;
    for (const { fichier, entrees } of DATASETS) {
      for (const e of entrees) {
        if (!e.specsSource) continue;
        vus.add(e.specsSource);
        compares++;
        const genere = [...(SPECS_PAR_DATASET[fichier]?.[e.id] ?? [])].sort();
        const applicatif = [...specCatalogOf(e as never)].sort();
        expect(genere, `${fichier} « ${e.id} » (specsSource ${e.specsSource})`).toEqual(applicatif);
        expect(genere.length).toBeGreaterThan(0);
      }
    }
    expect(compares).toBeGreaterThan(0);
    expect(vus.size).toBeGreaterThan(0);
  });

  it('rend le MÊME catalogue que `specCatalogOf` pour une entrée à `specs[]` inline', () => {
    for (const { fichier, entrees } of DATASETS) {
      for (const e of entrees) {
        if (e.specsSource) continue;
        const applicatif = [...specCatalogOf(e as never)].sort();
        if (!applicatif.length) continue;
        expect([...(SPECS_PAR_DATASET[fichier]?.[e.id] ?? [])].sort(), `${fichier} « ${e.id} »`).toEqual(applicatif);
      }
    }
  });
});

/** Paires `{ id, spec }` authorées, à toute profondeur, dans les datasets de `src/data`. */
function paitesAuthorees(): Map<string, Set<string>> {
  const R = 'src/data';
  const trouves = new Map<string, Set<string>>();
  const walk = (v: unknown) => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (v && typeof v === 'object') {
      const o = v as { id?: unknown; spec?: unknown };
      if (typeof o.id === 'string' && typeof o.spec === 'string') {
        if (!trouves.has(o.id)) trouves.set(o.id, new Set());
        trouves.get(o.id)!.add(o.spec);
      }
      Object.values(v).forEach(walk);
    }
  };
  for (const f of readdirSync(R).filter((x) => x.endsWith('.json'))) {
    try { walk(JSON.parse(readFileSync(`${R}/${f}`, 'utf8'))); } catch { /* dataset illisible : couvert ailleurs */ }
  }
  return trouves;
}

describe('pool DÉRIVÉ — la donnée authorée passe la porte `specRef`', () => {
  const authorees = paitesAuthorees();

  /** Ids portés par PLUSIEURS datasets (Talent « haine » et Trait « haine ») : une paire `{id, spec}`
   *  brute ne dit pas lequel elle vise, la mesure serait ambiguë. La désambiguïsation par slot est le
   *  lot L2 (`ActorRef`/graphies historiques, #1463). */
  const homonymes = new Set(
    DATASETS.flatMap(({ entrees }) => entrees.map((e) => e.id)).filter((id, i, tous) => tous.indexOf(id) !== i),
  );

  it('toute spec authorée sur une entrée à pool dérivé d’un type FERMÉ appartient au pool exposé', () => {
    const rejets: string[] = [];
    let verifiees = 0;
    for (const { fichier, entrees, ferme } of DATASETS) {
      if (!ferme) continue;
      for (const e of entrees) {
        if (!e.specsSource || homonymes.has(e.id)) continue;
        const pool = SPECS_PAR_DATASET[fichier]?.[e.id] ?? [];
        for (const spec of authorees.get(e.id) ?? []) {
          verifiees++;
          if (!pool.includes(spec)) rejets.push(`${fichier} ${e.id} :: « ${spec} » (pool=${pool.length})`);
        }
      }
    }
    expect(verifiees).toBeGreaterThan(0);
    expect(rejets).toEqual([]);
  });

  it('les 4 Talents à pool dérivé passent `specRef(\'talent\')` avec leurs specs réelles', () => {
    for (const id of ['magie-des-arcanes', 'beni', 'invocation', 'magie-du-chaos']) {
      const specs = [...(authorees.get(id) ?? [])];
      expect(specs.length, `aucune spec authorée pour « ${id} »`).toBeGreaterThan(0);
      for (const spec of specs) {
        expect(specRef('talent').safeParse({ id, spec }).success, `${id} :: ${spec}`).toBe(true);
      }
    }
  });
});

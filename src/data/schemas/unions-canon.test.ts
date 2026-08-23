/**
 * CONTRAT des unions PARTAGÉES entre le moteur et les schémas de donnée (#1440) : `Availability`
 * (LDB 59) et `StakeForm` (forme déclarée d'un enjeu) ont chacune UN tuple canon dans
 * `src/engine/types.ts`, dont le schéma zod de `schemas/common.ts` DÉRIVE. Ce fichier verrouille
 * les deux moitiés du lien :
 *  - au TYPE (`Eq<…>` ci-dessous, gaté par `npm run typecheck`) : le type inféré du schéma et le
 *    type moteur sont mutuellement assignables — un palier ajouté d'un seul côté ne compile pas ;
 *  - au RUNTIME : les options du schéma sont EXACTEMENT le tuple canon, et PERSONNE dans `src/` ne
 *    re-tape le littéral à côté (c'était l'état d'avant : 6 recopies pour `StakeForm`, 4 pour
 *    `Availability` ; puis 10 de plus, hors des schémas, que le scan élargi a mesurées et migrées).
 *
 * Le volet « re-tape » se lit à l'AST (`scanUnionRecopies`, TypeScript compiler API) : un littéral de
 * tableau ou une union de types littéraux portant ≥2 membres du canon est une recopie, quelle que soit
 * sa mise en page. Le scan couvre `src/**` — PROD ET TESTS : un test qui recopie l'union verrouille
 * une divergence aussi sûrement qu'un module. Une SÉLECTION dérivée (`availabilitySchema.extract([…])`)
 * n'en est pas une : le compilateur borne son argument au canon.
 */
import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import type { z } from 'zod';
import { tsSources, scanUnionRecopies } from '../../../scripts/guards/lib/canonUnique.mjs';
import { AVAILABILITIES, STAKE_FORMS, type Availability, type StakeForm, type TestedAvailability } from '../../engine/types';
import { availabilitySchema, harvestRaritySchema, stakeFormSchema } from './common';
import { dispoPctAvailabilitySchema } from './defs/disponibilite';
import type { HarvestRarity } from '../index';

const ROOT = fileURLToPath(new URL('../../..', import.meta.url));
/** Les deux canons verrouillés, sous la forme attendue par le scan. */
const CANONS = [
  { nom: 'AVAILABILITIES', membres: AVAILABILITIES },
  { nom: 'STAKE_FORMS', membres: STAKE_FORMS },
];
/** Les deux SEULS fichiers qui ont le droit de taper les membres : le foyer du tuple, et ce fichier-ci
 *  (ses fixtures SONT des recopies, c'est leur métier). `schemas/common.ts` n'y figure pas : il DÉRIVE
 *  (`z.enum(AVAILABILITIES)`), il ne tape rien. */
const FOYERS = ['src/engine/types.ts', 'src/data/schemas/unions-canon.test.ts'];
const corpus = () => tsSources(ROOT, ['src']).filter(({ rel }) => !FOYERS.includes(rel));

type Eq<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const _availabilityExact: Eq<Availability, z.infer<typeof availabilitySchema>> = true;
const _stakeFormExact: Eq<StakeForm, z.infer<typeof stakeFormSchema>> = true;
const _harvestRarityExact: Eq<HarvestRarity, z.infer<typeof harvestRaritySchema>> = true;
const _testedExact: Eq<TestedAvailability, z.infer<typeof dispoPctAvailabilitySchema>> = true;
void _availabilityExact; void _stakeFormExact; void _harvestRarityExact; void _testedExact;

describe('unions partagées moteur ⇄ schémas de donnée (#1440)', () => {
  it('`availabilitySchema` expose EXACTEMENT les paliers de `AVAILABILITIES`', () => {
    expect(availabilitySchema.options).toEqual([...AVAILABILITIES]);
  });

  it('`harvestRaritySchema` = les paliers canon + le 5ᵉ palier RAW `Unique` (`ZI 13 l.286`)', () => {
    expect(harvestRaritySchema.options).toEqual([...AVAILABILITIES, 'Unique']);
  });

  it('`stakeFormSchema` expose EXACTEMENT `STAKE_FORMS`', () => {
    expect(stakeFormSchema.options).toEqual([...STAKE_FORMS]);
  });

  it('PERSONNE dans `src/` ne re-tape le littéral des unions partagées — prod ET tests', () => {
    const fautifs = corpus().flatMap(({ rel, code }) => scanUnionRecopies(rel, code, CANONS).map((f) => `${rel}:${f.line} — ${f.detail}`));
    expect(fautifs, 'importer le tuple `engine/types` (ou le schéma dérivé de `schemas/common.ts`) — #1440').toEqual([]);
  });

  it('`TestedAvailability` et sa sélection zod nomment le MÊME couple (le sous-ensemble n’a qu’un site)', () => {
    expect(dispoPctAvailabilitySchema.options).toEqual(['Limitée', 'Rare']);
    expect(AVAILABILITIES.filter((a) => !dispoPctAvailabilitySchema.options.includes(a as never))).toEqual(['Commune', 'Exotique']);
  });

  it('le scan LIT L’AST : une recopie MULTI-LIGNE et DIVERGENTE est vue (une regex de ligne ne la voit pas)', () => {
    const multi = `export const s = z.enum([
      'verbatim',
      'descripteur',
      'resume',
    ]);`;
    expect(scanUnionRecopies('fixture.ts', multi, CANONS)).toEqual([{ line: 1, detail: "STAKE_FORMS recopiée ('verbatim', 'descripteur')" }]);
    const union = `type F =
      | 'verbatim'
      | 'descripteur';`;
    expect(scanUnionRecopies('fixture.ts', union, CANONS)).toHaveLength(1);
    const partiel = `const a = [
      'Rare',
      'Exotique',
    ];`;
    expect(scanUnionRecopies('fixture.ts', partiel, CANONS)).toHaveLength(1);
  });

  it('une SÉLECTION dérivée du canon n’est pas une recopie (le compilateur borne l’argument)', () => {
    const derive = `const s = availabilitySchema.extract([
      'Limitée',
      'Rare',
    ]);`;
    expect(scanUnionRecopies('fixture.ts', derive, CANONS)).toEqual([]);
  });

  it('le scan couvre bien `src/` (sanity : > 1500 fichiers, defs de schémas compris)', () => {
    const vus = corpus();
    expect(vus.length).toBeGreaterThan(1500);
    expect(vus.filter(({ rel }) => rel.startsWith('src/data/schemas/defs/')).length).toBeGreaterThan(40);
  });
});
